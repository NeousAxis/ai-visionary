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
        const { url, email, entityId } = body;

        let adminEmail: string | null = null;
        let entityName: string = '';

        if (email && entityId) {
            // MODE 2: Direct email + entityId (from update form OTP gate)
            // Verify that this email matches the registration email for this entity
            logger.info('OTP_SEND_START', `OTP request for entity ${entityId} with email`);

            const entity = await db.getAyaEntityById(entityId);
            if (!entity) {
                logger.warn('OTP_ENTITY_NOT_FOUND', `Entity not found: ${entityId}`);
                return NextResponse.json({ error: "Entite introuvable." }, { status: 404 });
            }

            // Check email matches: registration email (from analyses) or contact_email
            const registrationEmail = await db.getRegistrationEmail(entity.website || '');
            const validEmails = [registrationEmail, entity.contact_email]
                .filter(Boolean)
                .map((e: string) => e.toLowerCase());

            if (!validEmails.includes(email.trim().toLowerCase())) {
                logger.warn('OTP_EMAIL_MISMATCH', `Email ${maskEmail(email)} does not match entity ${entityId}`);
                return NextResponse.json({ error: "Cet email ne correspond pas a celui enregistre pour cette entite." }, { status: 403 });
            }

            adminEmail = email.trim();
            entityName = entity.display_name || entity.legal_name || '';
        } else if (url) {
            // MODE 1: URL-based lookup (original flow)
            const parsed = urlSchema.safeParse(url);
            if (!parsed.success) {
                logger.warn('OTP_INVALID_URL', `Invalid URL format: ${url}`);
                return NextResponse.json({ error: "URL invalide" }, { status: 400 });
            }

            logger.info('OTP_SEND_START', `OTP request for ${url}`);

            const client = await db.getAyaEntityByUrl(url);
            if (!client) {
                logger.warn('OTP_ENTITY_NOT_FOUND', `No entity for ${url}`);
                return NextResponse.json({ error: "Entity not found." }, { status: 404 });
            }

            adminEmail = client.contact_email;
            entityName = client.display_name || client.legal_name || '';
        } else {
            return NextResponse.json({ error: "Email ou URL requis." }, { status: 400 });
        }

        if (!adminEmail) {
            logger.error('OTP_NO_EMAIL', `No email found`);
            return NextResponse.json({ error: "Aucun email associe a cette entite." }, { status: 400 });
        }

        // 2. Generate 6-digit Code
        const code = Math.floor(100000 + Math.random() * 900000).toString();

        // 3. Save to DB (expires in 10 mins)
        await db.saveOTP(adminEmail, code);

        // 4. Send Email via Resend
        const { error } = await resend.emails.send({
            from: 'AI Visionary Security <security@ai-visionary.com>',
            to: [adminEmail],
            subject: `🔒 Votre code de sécurité : ${code}`,
            html: `
            <div style="font-family: sans-serif; padding: 20px; color: #333;">
                <h2>Authentification Sécurisée</h2>
                <p>Vous avez demandé un accès administrateur pour <strong>${entityName || 'votre entité'}</strong>.</p>
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
