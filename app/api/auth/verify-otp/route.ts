import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import crypto from 'crypto';
import { createLogger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

// Use a dedicated session secret, NOT the Stripe key
const SESSION_SECRET = process.env.SESSION_SECRET || process.env.ADMIN_SECRET;

export async function POST(req: NextRequest) {
    const logger = createLogger('otp_verify', 'auth');

    try {
        const body = await req.json();
        const { url, code } = body;

        if (!url || !code) {
            return NextResponse.json({ error: "Parametres manquants." }, { status: 400 });
        }

        // Validate OTP format (4-6 digits)
        if (!/^\d{4,6}$/.test(code)) {
            return NextResponse.json({ error: "Format de code invalide." }, { status: 400 });
        }

        logger.info('OTP_VERIFY_START', `Verify attempt for ${url}`);

        // 1. Get Admin Email
        const client = await db.getAyaEntityByUrl(url);

        if (!client || !client.contact_email) {
            logger.warn('OTP_ENTITY_NOT_FOUND', `No entity for ${url}`);
            return NextResponse.json({ error: "Entite non trouvee." }, { status: 404 });
        }

        const email = client.contact_email;

        // 2. Verify Code
        const isValid = await db.verifyOTP(email, code);

        if (isValid) {
            logger.info('OTP_VALIDATED', `OTP valid for ${email}`);

            if (!SESSION_SECRET) {
                logger.error('OTP_NO_SECRET', 'SESSION_SECRET env var not set');
                return NextResponse.json({ error: 'Erreur de configuration' }, { status: 500 });
            }

            // 3. Generate a secure session token with expiration
            const expiresAt = Date.now() + 3600_000; // 1 hour
            const payload = JSON.stringify({ email, url, exp: expiresAt });
            const sessionToken = crypto
                .createHmac('sha256', SESSION_SECRET)
                .update(payload)
                .digest('hex');

            // 4. Store token in Firestore for server-side validation
            try {
                const dbInstance = (db as any).getDb?.() ?? null;
                if (dbInstance) {
                    await dbInstance.collection('sessions').doc(sessionToken.substring(0, 40)).set({
                        email,
                        url,
                        token_hash: crypto.createHash('sha256').update(sessionToken).digest('hex'),
                        created_at: new Date().toISOString(),
                        expires_at: new Date(expiresAt).toISOString(),
                    });
                }
            } catch {
                // Non-blocking: token still works via HMAC validation
            }

            return NextResponse.json({
                success: true,
                token: sessionToken,
                expires_at: new Date(expiresAt).toISOString(),
            });
        } else {
            logger.warn('OTP_INVALID', `Invalid OTP for ${email}`);
            return NextResponse.json({ success: false, error: "Code invalide ou expire." }, { status: 401 });
        }

    } catch (e: unknown) {
        const message = e instanceof Error ? e.message : 'Unknown error';
        logger.error('OTP_VERIFY_ERROR', message);
        return NextResponse.json({ error: 'Erreur interne' }, { status: 500 });
    }
}
