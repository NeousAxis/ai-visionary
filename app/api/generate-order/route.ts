import { NextResponse } from 'next/server';
import { Resend } from 'resend';
import Stripe from 'stripe';
import { db } from '@/lib/db';
import { generateRealAsrJson } from '@/lib/ayo-crypto';
import { generateExternalContextJson } from '@/lib/external-context';

export async function POST(req: Request) {
    const stripeKey = process.env.STRIPE_SECRET_KEY;
    const resendKey = process.env.RESEND_API_KEY;

    if (!stripeKey || !resendKey) {
        return NextResponse.json({ error: "Server Misconfiguration" }, { status: 500 });
    }

    const stripe = new Stripe(stripeKey);
    const resend = new Resend(resendKey);

    try {
        const body = await req.json();
        const { session_id } = body;

        if (!session_id) return NextResponse.json({ error: "Missing session_id" }, { status: 400 });

        console.log(`⚙️ GENERATING RICH ORDER: ${session_id}`);

        // 1. RETRIEVE SESSION
        const stripeSession = await stripe.checkout.sessions.retrieve(session_id, {
            expand: ['payment_intent.payment_method', 'customer']
        });

        if (stripeSession.payment_status !== 'paid') {
            return NextResponse.json({ error: "Not paid" }, { status: 402 });
        }

        // 2. EXTRACT EMAIL
        let customerEmail = "";
        if (stripeSession.client_reference_id) {
            try {
                const jsonStr = Buffer.from(stripeSession.client_reference_id, 'base64').toString('utf-8');
                const payload = JSON.parse(jsonStr);
                if (payload.e) customerEmail = payload.e;
            } catch (e) { }
        }
        if (!customerEmail) customerEmail = stripeSession.customer_details?.email || stripeSession.customer_email || "";

        // 3. RETRIEVE ANALYSIS
        const dbAnalysis = await db.getLatestAnalysisByEmail(customerEmail);
        const analysisData = {
            score: dbAnalysis?.score || 75,
            extract: dbAnalysis?.data?.fields || { identite: { name: { value: "Client AYO" } } },
            url: dbAnalysis?.url || "votre-site.com",
            analysis_blocks: dbAnalysis?.data?.analysis_blocks
        };

        // 4. GENERATE FILES
        const packType = stripeSession.metadata?.pack_type === "PRO" || (stripeSession.amount_total! / 100) >= 450 ? "PRO" : "ESSENTIAL";
        const sessionDate = new Date().toISOString();
        const asrObject = await generateRealAsrJson(analysisData.extract, analysisData.score, sessionDate, session_id, packType);
        const asrJson = JSON.stringify(asrObject, null, 2);

        const extData = analysisData.extract?.external_context || {};
        const extObject = generateExternalContextJson({
            ecosystem_presence: extData.ecosystem_presence?.value || [],
            reputation_signals: extData.reputation_signals?.value || false,
            keywords: extData.keywords?.value || [],
            intents: extData.intents?.value || [],
            channels: extData.channels?.value || [],
            permissions: extData.permissions?.value || []
        });
        const externalContextJson = JSON.stringify(extObject, null, 2);

        // 5. SEND RICH EMAIL (Anti-Spam Strategy)
        const subject = packType === "PRO" ? `Votre Pack AIO PRO (Activé) - Score ${analysisData.score}/100` : `Votre Pack AIO Essential - Score ${analysisData.score}/100`;

        const emailHtml = `
            <div style="font-family: sans-serif; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #eee; border-radius: 8px; overflow: hidden;">
                <div style="background: #000; color: #fff; padding: 30px; text-align: center;">
                    <h1 style="margin:0; font-size: 24px;">AI VISIONARY</h1>
                    <p style="margin:10px 0 0 0; opacity: 0.8;">Optimisation de Visibilité IA</p>
                </div>
                <div style="padding: 30px;">
                    <p>Bonjour,</p>
                    <p>Merci pour votre commande. Votre Pack <b>${packType}</b> est prêt pour le site <b>${analysisData.url}</b>.</p>
                    
                    <div style="background: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #4a919e;">
                        <h3 style="margin:0; color: #4a919e;">📊 Score AI Vision : ${analysisData.score}/100</h3>
                    </div>

                    <h3>📦 Vos fichiers sont prêts</h3>
                    <p>Nous avons joint vos certificats <b>asr.json</b> et <b>external_context.json</b> à cet email.</p>
                    
                    <h3>🛠 Comment les installer ?</h3>
                    <ol>
                        <li>Extrayez les fichiers joints.</li>
                        <li>Uploadez-les à la racine de votre site via FTP (ex: <code>votre-site.com/asr.json</code>).</li>
                        <li><b>Recommandé :</b> Placez-les dans un dossier nommé <code>.ayo</code> à la racine.</li>
                    </ol>

                    <hr style="border:0; border-top:1px solid #eee; margin: 30px 0;" />
                    <p style="font-size: 12px; color: #94A3B8;">Réf commande : ${session_id}</p>
                    <p style="font-size: 12px; color: #94A3B8;">Besoin d'aide ? Contactez-nous sur hello@ai-visionary.com</p>
                </div>
            </div>
        `;

        await resend.emails.send({
            from: 'AI Visionary <hello@ai-visionary.com>',
            to: [customerEmail],
            bcc: ['hello@ai-visionary.com'],
            subject: subject,
            html: emailHtml,
            attachments: [
                { filename: 'asr.json', content: Buffer.from(asrJson) },
                { filename: 'external_context.json', content: Buffer.from(externalContextJson) }
            ]
        });

        return NextResponse.json({
            success: true,
            files: { asr: asrJson, external_context: externalContextJson }
        });

    } catch (err: any) {
        console.error("❌ API ERROR:", err.message);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
