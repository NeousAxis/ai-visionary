import { NextRequest, NextResponse } from 'next/server';
import { sendEmail } from '@/lib/mailer';
import { db } from '@/lib/db';
import { generateRealAsrJson } from '@/lib/ayo-crypto';
import { createLogger, generateCorrelationId } from '@/lib/logger';
import { checkRateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { emailSchema } from '@/lib/validators';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
    // Rate limit: 5 requests/min per IP
    const rateLimited = checkRateLimit(req, 'light-report', RATE_LIMITS.checkout);
    if (rateLimited) return rateLimited;

    const logger = createLogger(generateCorrelationId(), 'email');
    const { searchParams } = new URL(req.url);
    const email = searchParams.get('email');
    const url = searchParams.get('url');
    // Read locale from query param or NEXT_LOCALE cookie, default 'fr'
    const localeParam = searchParams.get('locale');
    const cookieHeader = req.headers.get('cookie') || '';
    const cookieLocaleMatch = cookieHeader.match(/NEXT_LOCALE=(fr|en)/);
    const locale: 'fr' | 'en' = localeParam === 'en' ? 'en' : (cookieLocaleMatch?.[1] === 'en' ? 'en' : 'fr');
    const en = locale === 'en';

    if (!email) {
        return new Response(en
            ? '<h1>❌ Email missing</h1><p>Please use the link provided in the chat.</p>'
            : '<h1>❌ Email manquant</h1><p>Veuillez utiliser le lien fourni dans le chat.</p>', {
            headers: { 'Content-Type': 'text/html; charset=utf-8' },
        });
    }

    // Validate email
    const emailParsed = emailSchema.safeParse(email);
    if (!emailParsed.success) {
        logger.warn('LIGHT_INVALID_EMAIL', `Invalid email: ${email}`);
        return new Response(en ? '<h1>❌ Invalid email</h1>' : '<h1>❌ Email invalide</h1>', {
            headers: { 'Content-Type': 'text/html; charset=utf-8' },
        });
    }

    try {
        logger.info('LIGHT_REPORT_START', `Sending LIGHT report to ${email}${url ? ` for ${url}` : ''}`);

        // 1. Retrieve Analysis (prioritize URL if provided)
        let analysis;
        if (url) {
            analysis = await db.getLatestAnalysisByUrl(url);
            console.log(`🔍 Found analysis by URL: ${!!analysis}`);
        } else {
            analysis = await db.getLatestAnalysisByEmail(email);
            console.log(`🔍 Found analysis by Email: ${!!analysis}`);
        }

        let analysisData;
        if (analysis) {
            analysisData = {
                score: analysis.score,
                extract: analysis.data?.fields || {},
                url: analysis.url,
                audit_report: analysis.data?.audit_report
            };
        } else {
            return new Response(en
                ? '<h1>⚠️ Analysis not found</h1><p>Please run an analysis of your site in the chat first.</p>'
                : '<h1>⚠️ Analyse non trouvée</h1><p>Veuillez d\'abord lancer une analyse de votre site dans le chat.</p>', {
                headers: { 'Content-Type': 'text/html; charset=utf-8' },
            });
        }

        // 2. Generate ASR Light
        const asrJson = await generateRealAsrJson(
            analysisData.extract,
            analysisData.score,
            analysisData.url,
            null, // asrId
            'LIGHT' // Explicit Tier
        );

        // 2. Generate detailed Analysis HTML (Audit) if needed
        // Helper to render Audit Table from Structured Data
        const renderAuditTable = (blocks: any) => {
            if (!blocks) return null;

            const rows = Object.keys(blocks).map(key => {
                const item = blocks[key];
                if (!item) return '';
                const iScore = item.score || 0;
                const iMax = item.max || 10;
                const iLabel = item.label || key;
                const iStatus = item.status || 'error';
                const iObs = item.observation || (en ? "Missing data." : "Données manquantes.");

                const color = iStatus === 'success' ? '#166534' : (iStatus === 'warning' ? '#854d0e' : '#991b1b');
                const bg = iStatus === 'success' ? '#dcfce7' : (iStatus === 'warning' ? '#fef9c3' : '#fee2e2');
                const icon = iStatus === 'success' ? '✅' : (iStatus === 'warning' ? '⚠️' : '❌');

                return `
                    <div style="background:${bg}; border-left:4px solid ${color}; padding:10px; margin-bottom:10px; border-radius:4px;">
                        <div style="display:flex; justify-content:space-between; align-items:center;">
                            <strong style="color:${color}; font-size:14px;">${icon} ${iLabel}</strong>
                            <span style="font-size:12px; background:#fff; padding:2px 6px; border-radius:10px; border:1px solid ${color}; color:${color}; font-weight:bold;">${iScore}/${iMax}</span>
                        </div>
                        <p style="margin:5px 0 0 0; font-size:13px; color:#333;">${iObs}</p>
                    </div>
                `;
            }).join('');

            return `
                <div style="margin:20px 0;">
                    <h3 style="color:#333; margin-bottom:10px; font-size:16px;">${en ? '🛑 Gap Diagnostic:' : '🛑 Diagnostic des Manquements :'}</h3>
                    ${rows}
                </div>
            `;
        };

        // Use real analysis_blocks from Firestore (saved by chat/route.ts during scoring)
        const blocksToRender = (analysis as any).data?.analysis_blocks || null;

        const computedAuditReport = renderAuditTable(blocksToRender);
        const fallbackAudit = en ? "<p>Summary analysis only.</p>" : "<p>Analyse sommaire uniquement.</p>";
        const finalAuditHtml = (analysisData as any).audit_report || computedAuditReport || fallbackAudit;

        // 3. Send Email
        const { success: emailSuccess, error: emailError } = await sendEmail({
            from: 'AI Visionary System <hello@ai-visionary.com>',
            replyTo: 'hello@ai-visionary.com',
            to: [email],
            subject: en
                ? 'Your AIO Light Pack (Free) - AI Visionary'
                : 'Votre Pack AIO Light (Gratuit) - AI Visionary',
            html: `
                <div style="font-family: sans-serif; color: #333;">
                    <head><meta charset="utf-8"></head>
                    <h1>${en ? 'Your AIO Light Pack is ready &#128274;' : 'Votre Pack AIO Light est prêt &#128274;&#127464;&#127469;'}</h1>
                    <p>${en ? 'Hello,' : 'Bonjour,'}</p>
                    <p>${en
                        ? `Here is your AIO Light Pack following the analysis of <strong>${analysisData.url}</strong>.`
                        : `Voici votre Pack AIO Light suite à l'analyse de <strong>${analysisData.url}</strong>.`
                    }</p>

                    <div style="background: #f4f4f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
                        <p><strong>${en ? 'AIO Score:' : 'Score AIO :'}</strong> ${analysisData.score} / 100</p>
                    </div>

                    ${finalAuditHtml}

                    <h3>${en ? '📦 YOUR ASR CODE (JSON)' : '📦 VOTRE CODE ASR (JSON)'}</h3>
                    <p>${en ? 'Copy this code if the attachment is blocked:' : 'Copiez ce code si la pièce jointe est bloquée :'}</p>
                    <pre style="background: #1e1e1e; color: #d4d4d4; padding: 15px; overflow-x: auto; border-radius: 5px; font-size: 11px;">
${JSON.stringify(asrJson, null, 2)}
                    </pre>

                    <div style="background: #e3f2fd; padding: 20px; border-radius: 5px; margin: 30px 0; border: 1px solid #bbdefb;">
                        <h3 style="margin-top:0; color: #0d47a1;">${en ? '🛠 SIMPLIFIED INSTALLATION GUIDE' : '🛠 GUIDE D\'INSTALLATION SIMPLIFIÉ'}</h3>
                        <p style="font-size: 14px; font-weight: bold;">${en ? 'How to install your ASR file?' : 'Comment installer votre fichier ASR ?'}</p>

                        <div style="background: #fff; padding: 15px; border-radius: 5px; margin-bottom: 15px; border: 1px solid #bbdefb;">
                            <h4 style="margin: 0 0 10px 0; color: #0277bd;">${en ? 'METHOD 1: SIMPLEST (Recommended)' : 'METHODE 1 : LA PLUS SIMPLE (Recommandée)'}</h4>
                            <p style="margin: 0 0 10px 0; font-size: 13px;">${en ? 'Ideal for WordPress, Wix, Shopify, Squarespace...' : 'Idéal pour WordPress, Wix, Shopify, Squarespace...'}</p>
                            <p style="margin: 0; font-size: 13px;">${en
                                ? 'Copy the JSON code above and paste it into the <code>&lt;HEAD&gt;</code> of your website, between script tags.'
                                : 'Copiez le code JSON ci-dessus et collez-le dans l\'en-tête <code>&lt;HEAD&gt;</code> de votre site web, entre des balises script.'
                            }</p>
                            <div style="background: #f5f5f5; padding: 10px; margin-top: 10px; font-family: monospace; font-size: 11px; border: 1px dashed #ccc; color: #555;">
                                &lt;script type="application/ld+json"&gt;<br>
                                ${en ? '... PASTE THE JSON CODE HERE ...' : '... COLLEZ LE CODE JSON ICI ...'}<br>
                                &lt;/script&gt;
                            </div>
                        </div>

                        <div style="background: #fff; padding: 15px; border-radius: 5px; border: 1px solid #bbdefb;">
                            <h4 style="margin: 0 0 10px 0; color: #0277bd;">${en ? 'METHOD 2: EXPERT / DEVELOPER' : 'METHODE 2 : EXPERT / DEVELOPPEUR'}</h4>
                            <p style="margin: 0 0 5px 0; font-size: 13px;">${en ? 'If you have technical access:' : 'Si vous avez un accès technique :'}</p>
                            <ul style="font-size:13px; padding-left:20px; margin: 0; line-height: 1.5;">
                                <li>${en ? 'Create a folder named <code>.ayo</code> at the root of your site.' : 'Créez un dossier nommé <code>.ayo</code> à la racine du site.'}</li>
                                <li>${en ? 'Place the <code>asr.json</code> file in it.' : 'Placez-y le fichier <code>asr.json</code>.'}</li>
                                <li>${en ? 'This is the cleanest method technically.' : 'C\'est la méthode la plus propre techniquement.'}</li>
                            </ul>
                        </div>
                    </div>

                    <div style="background: #fff3e0; padding: 15px; border-radius: 5px; margin: 20px 0; border: 1px solid #ffe0b2;">
                        <h4 style="margin-top:0; color: #e65100;">${en ? '🆘 Need help with the installation?' : '🆘 Besoin d\'aide pour l\'installation ?'}</h4>
                        <p style="font-size: 13px; margin-bottom: 0;">${en
                            ? 'If you encounter technical difficulties installing these files, our team is here to help.'
                            : 'Si vous rencontrez des difficultés techniques pour installer ces fichiers, notre équipe est là pour vous aider.'
                        }</p>
                        <p style="font-size: 13px; font-weight: bold; margin-top: 5px;">${en ? 'Contact us:' : 'Contactez-nous :'} <a href="mailto:hello@ai-visionary.com" style="color: #e65100;">hello@ai-visionary.com</a></p>
                    </div>

                    <hr style="margin: 30px 0; border: 0; border-top: 1px solid #eee;">

                    <p style="font-size: 14px; color: #666;">
                        <a href="https://ai-visionary.xyz" style="color: #000; text-decoration: underline;">${en ? 'Return to AI Visionary' : 'Retourner sur AI Visionary'}</a>
                    </p>
                </div>
            `,
            attachments: [
                {
                    filename: 'asr.json',
                    content: Buffer.from(JSON.stringify(asrJson, null, 2)),
                },
            ],
        });

        if (!emailSuccess) {
            throw new Error(emailError || 'Email sending failed');
        }

        return new Response(`
            <div style="font-family: sans-serif; text-align: center; margin-top: 50px;">
                <h1 style="color: #10b981;">${en ? '✅ Report sent!' : '✅ Dossier envoyé !'}</h1>
                <p>${en ? 'Email sent to' : 'Email envoyé à'} <strong>${email}</strong>.</p>
                <p style="font-size: 0.9rem; color: #666;">${en
                    ? 'If you don\'t receive anything, check your spam folder or contact support.'
                    : 'Si vous ne recevez rien, vérifiez vos spams ou contactez le support.'
                }</p>
                <br>
                <a href="/" style="color: #6366f1; text-decoration: none;">${en ? '&larr; Back to home' : '&larr; Retour à l\'accueil'}</a>
            </div>
        `, {
            headers: { 'Content-Type': 'text/html; charset=utf-8' },
        });

    } catch (error: any) {
        logger.error('LIGHT_REPORT_ERROR', error.message || 'Unknown error');
        return new Response(`
            <div style="font-family: sans-serif; text-align: center; margin-top: 50px; color: #dc2626;">
                <h1>${en ? '❌ Sending error' : '❌ Erreur d\'envoi'}</h1>
                <p>${en
                    ? 'Unable to send the email. Please try again or contact support.'
                    : 'Impossible d\'envoyer l\'email. Veuillez réessayer ou contacter le support.'
                }</p>
                <p style="margin-top: 20px;"><a href="mailto:hello@ai-visionary.com" style="color: #dc2626;">hello@ai-visionary.com</a></p>
            </div>
        `, {
            headers: { 'Content-Type': 'text/html; charset=utf-8' },
        });
    }
}
