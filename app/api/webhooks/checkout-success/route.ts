import { NextResponse } from 'next/server';
import { Resend } from 'resend';
import Stripe from 'stripe';
import JSZip from 'jszip';

// Initialize Services
const resend = new Resend(process.env.RESEND_API_KEY || 're_build_placeholder');

import { db } from '@/lib/db';
import { generateRealAsrJson } from '@/lib/ayo-crypto';
import { createLogger } from '@/lib/logger';

// --- HELPERS ---

// Pack detection by Stripe price_id (env vars) — replaces fragile price threshold
function detectPackType(session: Stripe.Checkout.Session): string {
    const ayaSubPriceId = process.env.STRIPE_PRICE_AYA_SUB;
    const proPriceId = process.env.STRIPE_PRICE_PRO;

    // Method 1: Match by price_id from line_items metadata
    const lineItemPriceId = (session as any).line_items?.data?.[0]?.price?.id;
    if (lineItemPriceId) {
        if (ayaSubPriceId && lineItemPriceId === ayaSubPriceId) return "AYA_SUB";
        if (proPriceId && lineItemPriceId === proPriceId) return "PRO";
    }

    // Method 2: Fallback to session.mode (reliable for subscription vs one-time)
    if (session.mode === 'subscription') return "AYA_SUB";
    if (session.mode === 'payment') return "PRO";

    return "UNKNOWN";
}


export async function POST(req: Request) {
    const stripeKey = process.env.STRIPE_SECRET_KEY;
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    let stripe: Stripe | null = null;

    if (stripeKey) stripe = new Stripe(stripeKey);

    const logger = createLogger('webhook', 'stripe');
    let session_id_tracking = "unknown";

    try {
        const rawBody = await req.text();
        const signature = req.headers.get('stripe-signature');

        // SECURITY: Stripe webhook signature verification is MANDATORY
        if (!webhookSecret || !signature || !stripe) {
            logger.error('WEBHOOK_CONFIG_MISSING', 'Missing Stripe config');
            return NextResponse.json({ error: 'Webhook not configured' }, { status: 500 });
        }

        let event: Stripe.Event;
        try {
            event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Unknown signature error';
            logger.error('WEBHOOK_SIG_FAIL', message);
            return NextResponse.json({ error: 'Signature invalide' }, { status: 400 });
        }

        if (event.type !== 'checkout.session.completed') {
            return NextResponse.json({ received: true });
        }

        const session = (event.data.object as Stripe.Checkout.Session);
        const session_id = session.id;
        session_id_tracking = session_id;

        logger.info('WEBHOOK_START', `Checkout completed`, { mode: session.mode, amount: session.amount_total, session_id });

        // 1. EXTRACT CUSTOMER DATA from client_reference_id and metadata
        let customerEmail = session.customer_details?.email || session.customer_email || "";
        let analyzedUrl = "";
        let analysisId = "";

        if (session.client_reference_id) {
            try {
                const payload = JSON.parse(Buffer.from(session.client_reference_id, 'base64').toString('utf-8'));
                if (payload.e) customerEmail = payload.e;
                if (payload.u) analyzedUrl = payload.u;
                if (payload.aid) analysisId = payload.aid;
                logger.info('WEBHOOK_PAYLOAD_DECODED', `Decoded client_reference_id`, payload);
            } catch { /* Invalid base64 — not critical */ }
        }

        if (!analyzedUrl && session.metadata?.analyzed_url) analyzedUrl = session.metadata.analyzed_url;
        if (!customerEmail && session.metadata?.customer_email) customerEmail = session.metadata.customer_email;

        logger.info('WEBHOOK_IDENTIFIED', `Customer identified`, { email: customerEmail, url: analyzedUrl, aid: analysisId });

        if (!customerEmail) {
            logger.critical('WEBHOOK_NO_EMAIL', `No customer email found for session ${session_id}`, { session_id });
            return NextResponse.json({ error: 'Webhook processing error' }, { status: 500 });
        }

        // 2. PACK TYPE DETECTION (by price_id, fallback to session.mode)
        const packType = detectPackType(session);
        logger.info('WEBHOOK_PACK', `Pack: ${packType}`, { packType, amount: session.amount_total });

        // 3. RETRIEVE ANALYSIS DATA from Firestore (saved during chat)
        let dbAnalysis = null;
        if (analysisId) dbAnalysis = await db.getAnalysis(analysisId);
        if (!dbAnalysis && analyzedUrl) dbAnalysis = await db.getLatestAnalysisByUrl(analyzedUrl);
        if (!dbAnalysis && customerEmail) dbAnalysis = await db.getLatestAnalysisByEmail(customerEmail);

        let analysisData: { score: number; extract: Record<string, unknown>; url: string };

        if (dbAnalysis) {
            analysisData = {
                score: dbAnalysis.score || 0,
                extract: dbAnalysis.data?.fields || {},
                url: dbAnalysis.url || analyzedUrl || ""
            };
            logger.info('WEBHOOK_DATA_FOUND', `Analysis found, score=${analysisData.score}`, { score: analysisData.score, aid: analysisId });
        } else {
            // CRITICAL: Data not found — do NOT re-analyze (was Bug "Score 0")
            // Log critical error and use minimal fallback data so the customer still gets SOMETHING
            logger.critical('WEBHOOK_DATA_NOT_FOUND', `No analysis data in Firestore for session ${session_id}. Customer paid but data is missing.`, {
                session_id, analyzedUrl, analysisId, customerEmail
            });
            analysisData = {
                score: 0,
                extract: {},
                url: analyzedUrl || ""
            };
        }

        // 4. REGISTRY AYA
        let ayaId = "pending";
        try {
            const { registerOrUpdateEntity } = await import('@/lib/aya/registry');
            ayaId = await registerOrUpdateEntity({
                legal_name: (analysisData.extract as Record<string, any>).identite?.legal_name?.value || "Entity",
                website: analysisData.url,
                asr_score: Math.round(analysisData.score || 0),
                asr_payload: { data: analysisData.extract } as any
            }, packType === 'AYA_SUB' ? 'subscription' : 'purchase');
            logger.info('WEBHOOK_AYA_OK', `AYA registered: ${ayaId}`, { ayaId });
        } catch (e: unknown) {
            const message = e instanceof Error ? e.message : 'Unknown error';
            logger.error('WEBHOOK_AYA_ERROR', message, { session_id });
        }

        // 5. DELIVERY
        if (packType === 'AYA_SUB') {
            await resend.emails.send({
                from: 'AYO Registry <registry@ai-visionary.com>',
                to: [customerEmail],
                subject: '✅ Activation AYA',
                html: `<p>Votre certificat est disponible : https://www.ai-visionary.com/aya/e/${ayaId}</p>`
            });
            logger.info('WEBHOOK_EMAIL_SUB', `Sub email sent to ${customerEmail}`);
        } else if (packType === 'PRO') {
            const zip = new JSZip();
            const asr = await generateRealAsrJson(analysisData.extract, analysisData.score, new Date().toISOString(), session_id, "PRO");
            zip.file("ASR-Protocol.json", JSON.stringify(asr, null, 2));
            const zipBuffer = await zip.generateAsync({ type: "nodebuffer" });

            await resend.emails.send({
                from: 'AYO Delivery <delivery@ai-visionary.com>',
                to: [customerEmail],
                subject: '📥 Votre Pack AYO PRO est prêt',
                attachments: [{ filename: 'AYO_Pack_PRO.zip', content: zipBuffer }],
                html: `<h1>Merci !</h1><p>Veuillez trouver votre pack PRO en pièce jointe.</p>`
            });
            logger.info('WEBHOOK_EMAIL_PRO', `PRO email sent to ${customerEmail}`);
        } else {
            logger.warn('WEBHOOK_NO_DELIVERY', `Unknown pack type: ${packType}`, { packType, session_id });
        }

        return NextResponse.json({ received: true });

    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        const stack = err instanceof Error ? err.stack : undefined;
        logger.critical('WEBHOOK_FATAL', message, { session_id: session_id_tracking, stack });
        return NextResponse.json({ error: 'Webhook processing error' }, { status: 500 });
    }
}
