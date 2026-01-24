import { NextResponse } from 'next/server';
import { Resend } from 'resend';
import Stripe from 'stripe';
import { db } from '@/lib/db';
import { generateRealAsrJson } from '@/lib/ayo-crypto';
import { generateExternalContextJson } from '@/lib/external-context';

export async function POST(req: Request) {
    const stripeKey = process.env.STRIPE_SECRET_KEY;
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    const resendKey = process.env.RESEND_API_KEY;

    if (!stripeKey || !webhookSecret || !resendKey) {
        return new Response("Config Error", { status: 500 });
    }

    const stripe = new Stripe(stripeKey);
    const resend = new Resend(resendKey);

    try {
        const rawBody = await req.text();
        const signature = req.headers.get('stripe-signature') || "";
        let event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);

        if (event.type === 'checkout.session.completed') {
            const session = event.data.object as Stripe.Checkout.Session;

            // 1. Extraction email (Priorité Metadata Stripe car c'est nous qui la pilotons)
            let email = session.metadata?.customer_email ||
                session.customer_details?.email ||
                session.customer_email || "";

            if (!email && session.client_reference_id) {
                try {
                    const decoded = JSON.parse(Buffer.from(session.client_reference_id, 'base64').toString());
                    email = decoded.e;
                } catch (e) { }
            }

            if (!email) {
                console.error("❌ WEBHOOK: Aucun email trouvé pour la session " + session.id);
                return NextResponse.json({ received: true });
            }

            // 2. Préparation des données (Fallback rapide)
            const url = session.metadata?.analyzed_url || "votre-site.com";
            let score = 75;
            let fields = { identite: { name: { value: "Client AI Visionary" } } };

            try {
                const dbAnalysis = await db.getLatestAnalysisByEmail(email);
                if (dbAnalysis) {
                    score = dbAnalysis.score || 75;
                    fields = dbAnalysis.data?.fields || fields;
                    console.log("✅ Données récupérées de la DB");
                }
            } catch (dbErr) {
                console.warn("⚠️ Utilisation des données par défaut");
            }

            // 3. Génération des fichiers
            const packType: 'ESSENTIAL' | 'PRO' = session.metadata?.pack_type === 'PRO' ? 'PRO' : 'ESSENTIAL';
            const asrObject = await generateRealAsrJson(fields, score, new Date().toISOString(), session.id, packType);
            const asrJson = JSON.stringify(asrObject, null, 2);

            const extData = (fields as any)?.external_context || {};
            const extObject = generateExternalContextJson({
                ecosystem_presence: extData.ecosystem_presence?.value || [],
                reputation_signals: extData.reputation_signals?.value || false,
                keywords: extData.keywords?.value || [],
                intents: extData.intents?.value || [],
                channels: extData.channels?.value || [],
                permissions: extData.permissions?.value || []
            });
            const externalContextJson = JSON.stringify(extObject, null, 2);

            // 4. Envoi de l'email
            // On utilise un sujet très neutre pour éviter les filtres SPF/DKIM trop zélés
            await resend.emails.send({
                from: 'Support AI Visionary <hello@ai-visionary.com>',
                to: [email],
                bcc: ['hello@ai-visionary.com'], // Copie de sécurité
                subject: `Livrable de votre commande - ${url}`,
                text: `Bonjour, votre pack AIO ${packType} est prêt. Veuillez trouver vos fichiers ASR et Context en pièces jointes. Command ID: ${session.id}`,
                html: `
                    <div style="font-family: sans-serif; padding: 20px; border: 1px solid #eee;">
                        <h2>Votre Pack AIO est disponible</h2>
                        <p>Merci pour votre confiance. Voici les fichiers pour <b>${url}</b>.</p>
                        <p><b>Détails de la commande :</b></p>
                        <ul>
                            <li>Pack : ${packType}</li>
                            <li>Score IA : ${score}/100</li>
                        </ul>
                        <p>Les fichiers sont joints à cet email.</p>
                    </div>
                `,
                attachments: [
                    { filename: 'asr.json', content: Buffer.from(asrJson) },
                    { filename: 'external_context.json', content: Buffer.from(externalContextJson) }
                ]
            });

            console.log(`✅ Webhook terminé avec succès pour ${email}`);
        }

        return NextResponse.json({ received: true });

    } catch (err: any) {
        console.error("❌ CRITICAL WEBHOOK ERROR:", err.message);
        return NextResponse.json({ received: true });
    }
}
