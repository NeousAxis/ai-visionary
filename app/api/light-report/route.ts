import { NextResponse } from 'next/server';
import { Resend } from 'resend';
import { db } from '@/lib/db';
import { generateRealAsrJson } from '@/lib/ayo-crypto';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const email = searchParams.get('email');

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
        console.log(`🚀 Sending LIGHT report to ${email}...`);

        // 1. Retrieve Analysis
        const analysis = await db.getLatestAnalysisByEmail(email);

        let analysisData;
        if (analysis) {
            analysisData = {
                score: analysis.score,
                extract: analysis.data?.fields || {},
                url: analysis.url
            };
        } else {
            // Fallback: try by domain? Or just fail gently?
            // For LIGHT report, maybe we can accept just knowing the email and if no data, send a "Please analyze first" email?
            // But usually, chat has already analyzed it.
            return new Response('<h1>⚠️ Analyse non trouvée</h1><p>Veuillez d\'abord lancer une analyse de votre site dans le chat.</p>', {
                headers: { 'Content-Type': 'text/html; charset=utf-8' },
            });
        }

        // 2. Generate ASR Light
        const asrJson = await generateRealAsrJson(
            analysisData.extract,
            analysisData.score,
            analysisData.url,
            'LIGHT'
        );

        // 3. Send Email
        await resend.emails.send({
            from: 'AYO <hello@ai-visionary.com>',
            to: [email],
            subject: 'Votre Certification ASR Light (Gratuit) - AI Visionary',
            html: `
                <div style="font-family: sans-serif; color: #333;">
                    <h1>Votre Pack AYO Light est prêt 🛡</h1>
                    <p>Bonjour,</p>
                    <p>Voici votre certification ASR standard (version Light) suite à l'analyse de <strong>${analysisData.url}</strong>.</p>
                    
                    <div style="background: #f4f4f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
                        <p><strong>Score AIO :</strong> ${Math.round(analysisData.score)} / 100</p>
                        <p><strong>Statut :</strong> Non Certifié (Version Gratuite)</p>
                    </div>

                    <p>Vous trouverez ci-joint votre fichier <code>asr.json</code>.</p>
                    
                    <h3>⚠️ Installation</h3>
                    <p>Ce fichier doit être placé à la racine de votre site dans le dossier <code>/.ayo/</code> pour être détecté par les moteurs d'IA.</p>
                    <p><code>https://${analysisData.url.replace('https://', '')}/.ayo/asr.json</code></p>

                    <hr style="margin: 30px 0; border: 0; border-top: 1px solid #eee;">
                    
                    <p style="font-size: 14px; color: #666;">
                        <strong>Besoin d'aller plus loin ?</strong><br>
                        Passez à la version <strong>Essential</strong> ou <strong>PRO</strong> pour obtenir la certification Verified, 
                        la signature cryptographique et les corrections SEO détaillées.
                    </p>
                    <p>
                        <a href="https://ai-visionary.com" style="background: #000; color: #fff; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Retourner sur AI Visionary</a>
                    </p>
                </div>
            `,
            attachments: [
                {
                    filename: 'asr.json',
                    content: JSON.stringify(asrJson, null, 2),
                },
            ],
        });

        return new Response(`
            <div style="font-family: sans-serif; text-align: center; margin-top: 50px;">
                <h1 style="color: #10b981;">✅ Dossier envoyé !</h1>
                <p>Votre ASR Light a été envoyé à <strong>${email}</strong>.</p>
                <p>Vérifiez vos emails (et vos spams).</p>
                <br>
                <a href="/" style="color: #6366f1; text-decoration: none;">&larr; Retour à l'accueil</a>
            </div>
        `, {
            headers: { 'Content-Type': 'text/html; charset=utf-8' },
        });

    } catch (error: any) {
        console.error("❌ Send Light Error:", error);
        return new Response(`<h1>❌ Erreur</h1><p>${error.message}</p>`, {
            headers: { 'Content-Type': 'text/html; charset=utf-8' },
        });
    }
}
