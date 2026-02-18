
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { url, code } = body;

        if (!url || !code) {
            return NextResponse.json({ error: "Missing parameters." }, { status: 400 });
        }

        console.log(`🔐 OTP VERIFY REQUEST: ${code} for ${url}`);

        // 1. Get Admin Email
        // @ts-ignore
        const client = await db.getAyaEntityByUrl(url);

        if (!client || !client.contact_email) {
            return NextResponse.json({ error: "Entity not found or no email." }, { status: 404 });
        }

        const email = client.contact_email;

        // 2. Verify Code
        // @ts-ignore
        const isValid = await db.verifyOTP(email, code);

        if (isValid) {
            console.log(`✅ OTP VALIDATED for ${email}`);

            // 3. Generate a Secured Token (Session ID)
            // This token will be passed to subsequent actions (like accessing portal)
            // For now, we return a simple success flag and a temporary signed hash
            const sessionToken = crypto.createHmac('sha256', process.env.STRIPE_SECRET_KEY || 'secret').update(email + Date.now()).digest('hex');

            return NextResponse.json({
                success: true,
                token: sessionToken
            });
        } else {
            console.warn(`❌ OTP INVALID for ${email}`);
            return NextResponse.json({ success: false, error: "Code invalide ou expiré." }, { status: 401 });
        }

    } catch (e: any) {
        console.error("🔥 OTP VERIFY ERROR:", e);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
