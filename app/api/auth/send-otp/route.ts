import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { Resend } from 'resend';
import { createLogger, generateCorrelationId } from '@/lib/logger';
import { checkRateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { urlSchema } from '@/lib/validators';
import { maskEmail } from '@/lib/sanitize';

export const dynamic = 'force-dynamic';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(req: NextRequest) {
    // Rate limit: 5 requests/min per IP
    const rateLimited = checkRateLimit(req, 'send-otp', RATE_LIMITS.otp);
    if (rateLimited) return rateLimited;

    const logger = createLogger(generateCorrelationId(), 'auth');

    try {
        const body = await req.json();
        const { url } = body;

        if (!url) {
            return NextResponse.json({ error: "URL is required" }, { status: 400 });
        }

        // Validate URL format
        const parsed = urlSchema.safeParse(url);
        if (!parsed.success) {
            logger.warn('OTP_INVALID_URL', `Invalid URL format: ${url}`);
            return NextResponse.json({ error: "URL invalide" }, { status: 400 });
        }

        logger.info('OTP_SEND_START', `OTP request for ${url}`);

        // 1. Find Admin Email associated with this entity
        // @ts-ignore
        const client = await db.getAyaEntityByUrl(url);

        if (!client) {
            logger.warn('OTP_ENTITY_NOT_FOUND', `No entity for ${url}`);
            return NextResponse.json({ error: "Entity not found." }, { status: 404 });
        }

        const adminEmail = client.contact_email;

        if (!adminEmail) {
            logger.error('OTP_NO_EMAIL', `No email found for ${url}`);
            return NextResponse.json({ error: "No admin email linked to this entity." }, { status: 400 });
        }

        // 2. Generate 6-digit Code
        const code = Math.floor(100000 + Math.random() * 900000).toString();

        // 3. Save to DB (expires in 10 mins)
        // @ts-ignore
        await db.saveOTP(adminEmail, code);

        // 4. Send Email via Resend
        const { data, error } = await resend.emails.send({
            from: 'AI Visionary Security <security@ai-visionary.com>',
            to: [adminEmail],
            subject: `🔒 Votre code de sécurité : ${code}`,
            html: `
            <div style="font-family: sans-serif; padding: 20px; color: #333;">
                <h2>Authentification Sécurisée</h2>
                <p>Vous avez demandé un accès administrateur pour <strong>${client.display_name || url}</strong>.</p>
                <p>Voici votre code unique (valable 10 minutes) :</p>
                <div style="background-color: #f4f4f4; padding: 15px; font-size: 24px; letter-spacing: 5px; font-weight: bold; text-align: center; border-radius: 8px; border: 1px solid #ddd;">
                    ${code}
                </div>
                <p style="margin-top: 20px; font-size: 12px; color: #666;">
                    Si vous n'êtes pas à l'origine de cette demande, ignorez cet email.
                </p>
            </div>
            `,
        });

        if (error) {
            logger.error('OTP_EMAIL_FAIL', `Failed to send OTP email`, { error: error.message });
            return NextResponse.json({ error: "Failed to send email." }, { status: 500 });
        }

        logger.info('OTP_SENT', `OTP sent to ${maskEmail(adminEmail)}`);

        // Return masked email for UI
        const masked = maskEmail(adminEmail);

        return NextResponse.json({ success: true, maskedEmail: masked }, { status: 200 });

    } catch (e: unknown) {
        const message = e instanceof Error ? e.message : 'Unknown error';
        logger.error('OTP_SEND_ERROR', message);
        return NextResponse.json({ error: 'Erreur interne' }, { status: 500 });
    }
}
