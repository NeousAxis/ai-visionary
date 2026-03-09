
import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { db } from '@/lib/db';

// Force dynamic because we use request headers
export const dynamic = 'force-dynamic';

// Initialize Stripe lazily to avoid build-time crash
let _stripe: Stripe | null = null;
function getStripe(): Stripe {
    if (!_stripe) {
        _stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'sk_placeholder', {
            apiVersion: '2025-01-27.acacia' as any,
        });
    }
    return _stripe;
}

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { detectedUrl } = body;

        if (!detectedUrl) {
            return NextResponse.json({ error: "No URL provided." }, { status: 400 });
        }

        console.log(`🔐 STRIPE PORTAL REQUEST: Initiated for URL: ${detectedUrl}`);

        // 1. Retrieve the Client Entity from DB
        // @ts-ignore
        const client = await db.getAyaEntityByUrl(detectedUrl);

        if (!client) {
            console.warn(`⚠️ Client not found in DB for URL: ${detectedUrl}`);
            return NextResponse.json({ error: "Client not found." }, { status: 404 });
        }

        // 2. We need a Stripe Customer ID
        // It should be stored in the 'aya_registry' collection or 'analyses' collection.
        // Let's assume it's in the client object as `stripe_customer_id`.

        let customerId = client.stripe_customer_id;

        // Fallback: If not in DB, try to find in Stripe via Email
        if (!customerId && client.contact_email) {
            console.log(`🔍 Customer ID missing in DB. Searching Stripe by email: ${client.contact_email}`);
            const customers = await getStripe().customers.list({
                email: client.contact_email,
                limit: 1,
            });

            if (customers.data.length > 0) {
                customerId = customers.data[0].id;
                console.log(`✅ FOUND Customer ID in Stripe: ${customerId}`);

                // TODO: Save this ID back to DB for future speed?
            }
        }

        if (!customerId) {
            console.error(`❌ CRITICAL: No Stripe Customer ID found anywhere for ${detectedUrl}`);
            return NextResponse.json({
                error: "No Billing Account found. Please contact support manually.",
                is_legacy: true // Flag to tell frontend to show mailto fallback
            }, { status: 404 });
        }

        // 3. Create the Portal Session
        // This generates a short-lived URL where the customer can manage billing
        const session = await getStripe().billingPortal.sessions.create({
            customer: customerId,
            return_url: `https://www.ai-visionary.com`, // Where to go after "Done"
        });

        console.log(`✅ PORTAL SESSION CREATED: ${session.url}`);

        return NextResponse.json({
            success: true,
            url: session.url
        });

    } catch (error: any) {
        console.error("🔥 STRIPE PORTAL ERROR:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
