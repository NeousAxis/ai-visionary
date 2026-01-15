import { NextResponse } from 'next/server';
import { Resend } from 'resend';
import { db } from '@/lib/db';
import { generateRealAsrJson } from '@/lib/ayo-crypto';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const email = searchParams.get('email');
    const url = searchParams.get('url');

    if (!email) {
        return new Response('<h1>❌ Email manquant</h1><p>Veuillez utiliser le lien fourni dans le chat.</p>', {
            headers: { 'Content-Type': 'text/html; charset=utf-8' },
        });
    }

    // Initialize Resend
    const resendKey = process.env.RESEND_API_KEY;
    if (!resendKey) return NextResponse.json({ error: 'Resend Key Missing' }, { status: 500 });
    const resend = new Resend(resendKey);

    try {
        console.log(`🚀 Sending LIGHT report to ${email}${url ? ` for ${url}` : ''}...`);

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
            return new Response('<h1>⚠️ Analyse non trouvée</h1><p>Veuillez d\'abord lancer une analyse de votre site dans le chat.</p>', {
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
                const iObs = item.observation || "Données manquantes.";

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
                    <h3 style="color:#333; margin-bottom:10px; font-size:16px;">🛑 Diagnostic des Manquements :</h3>
                    ${rows}
                </div>
            `;
        };

        // Fallback Logic for detailed contents
        let blocksToRender = (analysis as any).data?.analysis_blocks;
        if (!blocksToRender && analysisData.score > 0) {
            // Reconstruct likely blocks from score if missing
            const s = analysisData.score;
            blocksToRender = {
                identite: {
                    score: s > 50 ? 8 : 4, max: 10, label: "Identité & Ancrage",
                    status: s > 50 ? 'success' : 'warning',
                    observation: s > 50 ? "Identité validée." : "Identité numérique faible."
                },
                offre: {
                    score: s > 60 ? 15 : 8, max: 20, label: "Clarté de l'Offre",
                    status: s > 60 ? 'success' : 'warning',
                    observation: s > 60 ? "Offre claire." : "Sémantique à préciser."
                },
                technique: {
                    score: 0, max: 10, label: "Socle Technique",
                    status: 'error',
                    observation: "Absence de fichiers ASR (Corrigé par ce Pack)."
                }
            };
        }

        const computedAuditReport = renderAuditTable(blocksToRender);
        const finalAuditHtml = (analysisData as any).audit_report || computedAuditReport || "<p>Analyse sommaire uniquement.</p>";

        // 3. Send Email
        const emailResponse = await resend.emails.send({
            from: 'AI Visionary System <hello@ai-visionary.com>',
            replyTo: 'hello@ai-visionary.com',
            to: [email],
            subject: 'Votre Pack AIO Light (Gratuit) - AI Visionary',
            html: `
                <div style="font-family: sans-serif; color: #333;">
                    <head><meta charset="utf-8"></head>
                    <h1>Votre Pack AIO Light est prêt &#128274;&#127464;&#127469;</h1>
                    <p>Bonjour,</p>
                    <p>Voici votre Pack AIO Light suite à l'analyse de <strong>${analysisData.url}</strong>.</p>
                    
                    <div style="background: #f4f4f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
                        <p><strong>Score AIO :</strong> ${analysisData.score} / 100</p>
                    </div>

                    ${finalAuditHtml}

                    <h3>📦 VOTRE CODE ASR (JSON)</h3>
                    <p>Copiez ce code si la pièce jointe est bloquée :</p>
                    <pre style="background: #1e1e1e; color: #d4d4d4; padding: 15px; overflow-x: auto; border-radius: 5px; font-size: 11px;">
${JSON.stringify(asrJson, null, 2)}
                    </pre>
                    
                    <div style="background: #e3f2fd; padding: 20px; border-radius: 5px; margin: 30px 0; border: 1px solid #bbdefb;">
                        <h3 style="margin-top:0; color: #0d47a1;">🛠 GUIDE D'INSTALLATION (Tuto Pas à Pas)</h3>
                        <p style="font-size: 14px; font-weight: bold;">Objectif : Rendre ce fichier accessible aux IA.</p>
                        <ol style="font-size:13px; padding-left:20px; line-height: 1.6;">
                            <li>Accédez à votre serveur (FTP) ou gestionnaire de fichiers.</li>
                            <li>À la racine de votre site (au même niveau que <code>index.html</code>), créez un nouveau dossier nommé exactement : <br><code>.ayo</code> (avec le point devant).</li>
                            <li>Dans ce dossier <code>.ayo</code>, créez le fichier <code>asr.json</code> et collez-y le code ci-dessus.</li>
                            <li>Vérifiez l'accès en tapant dans votre navigateur : <br><code>https://votre-site.com/.ayo/asr.json</code></li>
                        </ol>
                        <p style="margin-top: 15px; font-size: 13px; font-style: italic;">
                            <strong>Alternative WordPress/Wix :</strong> Si vous ne pouvez pas créer de dossier, copiez le contenu du <code>asr.json</code> et collez-le dans le <code>&lt;HEAD&gt;</code> de votre site, entouré des balises :<br>
                            <code>&lt;script type="application/ld+json"&gt; ... CODE ICI ... &lt;/script&gt;</code>
                        </p>
                    </div>

                    <div style="background: #fff3e0; padding: 15px; border-radius: 5px; margin: 20px 0; border: 1px solid #ffe0b2;">
                        <h4 style="margin-top:0; color: #e65100;">🆘 Besoin d'aide pour l'installation ?</h4>
                        <p style="font-size: 13px; margin-bottom: 0;">Si vous rencontrez des difficultés techniques pour installer ces fichiers, notre équipe est là pour vous aider.</p>
                        <p style="font-size: 13px; font-weight: bold; margin-top: 5px;">Contactez-nous : <a href="mailto:hello@ai-visionary.com" style="color: #e65100;">hello@ai-visionary.com</a></p>
                    </div>

                    <hr style="margin: 30px 0; border: 0; border-top: 1px solid #eee;">
                    
                    <p style="font-size: 14px; color: #666;">
                        <a href="https://ai-visionary.com" style="color: #000; text-decoration: underline;">Retourner sur AI Visionary</a>
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

        // Check for specific Resend error even in success flow if any
        if (emailResponse.error) {
            throw new Error(emailResponse.error.message);
        }

        return new Response(`
            <div style="font-family: sans-serif; text-align: center; margin-top: 50px;">
                <h1 style="color: #10b981;">✅ Dossier envoyé !</h1>
                <p>Email envoyé à <strong>${email}</strong>.</p>
                <div style="background: #f0fdf4; padding: 10px; display: inline-block; margin: 15px 0; border-radius: 5px; color: #15803d; font-family: monospace;">
                    ID Suivi : ${emailResponse.data?.id}
                </div>
                <p style="font-size: 0.9rem; color: #666;">Si vous ne recevez rien, vérifiez vos spams ou contactez le support avec l'ID ci-dessus.</p>
                <br>
                <a href="/" style="color: #6366f1; text-decoration: none;">&larr; Retour à l'accueil</a>
            </div>
        `, {
            headers: { 'Content-Type': 'text/html; charset=utf-8' },
        });

    } catch (error: any) {
        console.error("❌ Send Light Error:", error);
        return new Response(`
            <div style="font-family: sans-serif; text-align: center; margin-top: 50px; color: #dc2626;">
                <h1>❌ Erreur d'envoi</h1>
                <p>Impossible d'envoyer l'email à <strong>${email}</strong>.</p>
                <div style="background: #fef2f2; padding: 15px; border: 1px solid #fca5a5; display: inline-block; text-align: left; margin-top: 20px;">
                    <strong>Message Technique :</strong><br>
                    <code>${error.message || JSON.stringify(error)}</code>
                </div>
                <br><br>
                <p>Vérifiez que votre clé API Resend est valide et que le domaine est vérifié.</p>
            </div>
        `, {
            headers: { 'Content-Type': 'text/html; charset=utf-8' },
        });
    }
}
