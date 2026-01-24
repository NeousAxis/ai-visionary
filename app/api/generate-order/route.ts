import { NextResponse } from 'next/server';
import { Resend } from 'resend';
import Stripe from 'stripe';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { generateText } from 'ai';
import { scanUrlForAioSignals } from '@/lib/aio-scanner';
import { computeAioScore, AyoExtract } from '@/lib/aio-score-engine';
import { db } from '@/lib/db';
import { generateRealAsrJson } from '@/lib/ayo-crypto';
import { generateExternalContextJson } from '@/lib/external-context';

export async function POST(req: Request) {
    const stripeKey = process.env.STRIPE_SECRET_KEY;
    const resendKey = process.env.RESEND_API_KEY;

    if (!stripeKey || !resendKey) {
        console.error("❌ CONFIG ERROR: Missing Stripe or Resend Key");
        return NextResponse.json({ error: "Server Misconfiguration" }, { status: 500 });
    }

    const stripe = new Stripe(stripeKey);
    const resend = new Resend(resendKey);

    try {
        const body = await req.json();
        const { session_id } = body;

        if (!session_id) {
            return NextResponse.json({ error: "Missing session_id" }, { status: 400 });
        }

        console.log(`⚙️ PROCESSING ORDER: ${session_id}`);

        // 1. RETRIEVE STRIPE SESSION
        let stripeSession: Stripe.Checkout.Session;
        try {
            stripeSession = await stripe.checkout.sessions.retrieve(session_id, {
                expand: ['payment_intent.payment_method', 'customer']
            });
            if (stripeSession.payment_status !== 'paid') {
                return NextResponse.json({ error: "Payment not completed" }, { status: 402 });
            }
        } catch (e: any) {
            console.error("❌ Stripe Retrieval Failed:", e.message);
            return NextResponse.json({ error: "Invalid Session" }, { status: 404 });
        }

        // 2. EXTRACT CUSTOMER EMAIL (Robust Logic)
        let customerEmail = "";

        // Priority A: Client Reference ID (Our Base64 payload from Chat)
        if (stripeSession.client_reference_id) {
            try {
                const jsonStr = Buffer.from(stripeSession.client_reference_id, 'base64').toString('utf-8');
                const payload = JSON.parse(jsonStr);
                if (payload.e && payload.e.includes('@')) customerEmail = payload.e;
            } catch (e) { }
        }

        // Priority B: Stripe Standard Fields
        if (!customerEmail) customerEmail = stripeSession.customer_details?.email || stripeSession.customer_email || "";

        // Priority C: Deep Fetch if needed
        if (!customerEmail && typeof stripeSession.customer === 'string') {
            const customer = await stripe.customers.retrieve(stripeSession.customer);
            customerEmail = (customer as Stripe.Customer).email || "";
        }

        console.log(`📧 Detected Email: ${customerEmail || "NOT FOUND"}`);

        if (!customerEmail) {
            console.error("❌ CRITICAL: No email found for session", session_id);
            // We proceed to analysis but will fail at email step
        }

        // 3. RETRIEVE OR PERFORM ANALYSIS
        let analysisData: any = null;
        let targetUrl = "";

        // Try to get from DB first
        if (customerEmail) {
            const dbAnalysis = await db.getLatestAnalysisByEmail(customerEmail);
            if (dbAnalysis) {
                console.log("✅ Analysis found in DB");
                analysisData = {
                    score: dbAnalysis.score,
                    extract: dbAnalysis.data?.fields || {},
                    url: dbAnalysis.url,
                    analysis_blocks: dbAnalysis.data?.analysis_blocks
                };
                targetUrl = dbAnalysis.url;
            }
        }

        // If not in DB, we MUST have a URL (from payload or domain)
        if (!analysisData) {
            console.log("⚠️ No DB Analysis. Using fallback logic.");
            targetUrl = customerEmail ? `https://${customerEmail.split('@')[1]}` : "https://votre-site.com";
            analysisData = {
                score: 75,
                extract: { identite: { name: { value: "Client AYO" } } },
                url: targetUrl
            };
        }

        // 4. GENERATE FILES
        const packType = stripeSession.metadata?.pack_type === "PRO" || (stripeSession.amount_total! / 100) >= 450 ? "PRO" : "ESSENTIAL";
        const sessionDate = new Date().toISOString();

        const asrObject = await generateRealAsrJson(
            analysisData.extract,
            analysisData.score,
            sessionDate,
            session_id,
            packType
        );
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

        // 5. SEND EMAIL
        let emailSent = false;
        let emailError = null;

        if (customerEmail && customerEmail.includes('@')) {
            try {
                const subject = packType === "PRO" ? `Votre Pack AIO PRO (Activé) - Score ${analysisData.score}/100` : `Votre Pack AIO Essential - Score ${analysisData.score}/100`;

                await resend.emails.send({
                    from: 'AI Visionary <hello@ai-visionary.com>',
                    to: [customerEmail],
                    bcc: ['hello@ai-visionary.com'],
                    subject: subject,
                    html: `<p>Félicitations, votre pack <b>${packType}</b> est prêt.</p><p>Trouvez vos fichiers ASR en pièces jointes.</p><p>ID Commande: ${session_id}</p>`,
                    attachments: [
                        { filename: 'asr.json', content: Buffer.from(asrJson) },
                        { filename: 'external_context.json', content: Buffer.from(externalContextJson) }
                    ]
                });
                emailSent = true;
                console.log(`✅ Email sent to ${customerEmail}`);
            } catch (err: any) {
                console.error("❌ Resend Error:", err.message);
                emailError = err.message;
            }
        }

        // 6. RESPONSE
        return NextResponse.json({
            success: true,
            email_sent: emailSent,
            email_error: emailError,
            files: {
                asr: asrJson,
                external_context: externalContextJson
            }
        });

    } catch (globalErr: any) {
        console.error("❌ GLOBAL GENERATION ERROR:", globalErr);
        return NextResponse.json({ error: globalErr.message }, { status: 500 });
    }
}
