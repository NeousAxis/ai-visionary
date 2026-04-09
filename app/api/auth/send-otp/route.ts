import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { sendEmail } from '@/lib/mailer';
import { createLogger, generateCorrelationId } from '@/lib/logger';
import { checkRateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { urlSchema } from '@/lib/validators';
import { maskEmail } from '@/lib/sanitize';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
    // Rate limit: 5 requests/min per IP
    const rateLimited = checkRateLimit(req, 'send-otp', RATE_LIMITS.otp);
    if (rateLimited) return rateLimited;

    const logger = createLogger(generateCorrelationId(), 'auth');

    try {
        const body = await req.json();
        const { url, email, entityId } = body;
        // Read locale from request body or NEXT_LOCALE cookie, default to 'fr'
        const cookieHeader = req.headers.get('cookie') || '';
        const cookieLocaleMatch = cookieHeader.match(/NEXT_LOCALE=(fr|en)/);
        const locale: 'fr' | 'en' = body.locale === 'en' ? 'en' : (cookieLocaleMatch?.[1] === 'en' ? 'en' : 'fr');
        const en = locale === 'en';

        // Look up entity by entityId (MODE 2) or URL (MODE 1)
        let entity: any = null;
        let lookupLabel = '';

        if (email && entityId) {
            lookupLabel = `entity ${entityId}`;
            logger.info('OTP_SEND_START', `OTP request for ${lookupLabel} with email`);
            entity = await db.getAyaEntityById(entityId);
        } else if (url) {
            const parsed = urlSchema.safeParse(url);
            if (!parsed.success) {
                logger.warn('OTP_INVALID_URL', `Invalid URL format: ${url}`);
                return NextResponse.json({ error: "URL invalide" }, { status: 400 });
            }
            lookupLabel = url;
            logger.info('OTP_SEND_START', `OTP request for ${lookupLabel}`);
            entity = await db.getAyaEntityByUrl(url);
        } else {
            return NextResponse.json({ error: "Email ou URL requis." }, { status: 400 });
        }

        if (!entity) {
            logger.warn('OTP_ENTITY_NOT_FOUND', `Entity not found: ${lookupLabel}`);
            return NextResponse.json({ error: "Entite introuvable." }, { status: 404 });
        }

        // SECURITY: Only registered emails (owner_email or contact_email) can authenticate
        const ownerEmail = entity.owner_email?.trim().toLowerCase() || '';
        const contactEmail = (entity.contact_email || entity.email || '').trim().toLowerCase();
        const adminEmail = ownerEmail || contactEmail;

        if (!adminEmail) {
            logger.warn('OTP_NO_OWNER', `No owner_email or contact_email set for ${lookupLabel}`);
            return NextResponse.json({ error: en ? "No registered email for this entity. Contact support@ai-visionary.xyz." : "Aucun email enregistre pour cette entite. Contactez support@ai-visionary.xyz." }, { status: 403 });
        }

        // MODE 2: verify the provided email matches owner_email OR contact_email
        if (email && entityId) {
            const inputEmail = email.trim().toLowerCase();
            const matchesOwner = ownerEmail && inputEmail === ownerEmail;
            const matchesContact = contactEmail && inputEmail === contactEmail;
            if (!matchesOwner && !matchesContact) {
                logger.warn('OTP_EMAIL_MISMATCH', `Email ${maskEmail(email)} does not match owner/contact for ${lookupLabel}`);
                return NextResponse.json({ error: en ? "This email does not match the registered email for this entity." : "Cet email ne correspond pas a celui enregistre pour cette entite." }, { status: 403 });
            }
        }

        const entityName = entity.display_name || entity.legal_name || '';

        // 2. Generate 6-digit Code
        const code = Math.floor(100000 + Math.random() * 900000).toString();

        // 3. Save to DB (expires in 10 mins)
        await db.saveOTP(adminEmail, code);

        // 4. Send Email via SMTP
        const otpSubject = en
            ? `🔒 Your security code: ${code}`
            : `🔒 Votre code de sécurité : ${code}`;
        const entityLabel = entityName || (en ? 'your entity' : 'votre entité');
        const { error } = await sendEmail({
            from: 'AI Visionary Security <hello@ai-visionary.xyz>',
            to: [adminEmail],
            subject: otpSubject,
            html: `
            <div style="font-family: sans-serif; padding: 20px; color: #333;">
                <h2>${en ? 'Secure Authentication' : 'Authentification Sécurisée'}</h2>
                <p>${en
                    ? `You requested admin access for <strong>${entityLabel}</strong>.`
                    : `Vous avez demandé un accès administrateur pour <strong>${entityLabel}</strong>.`
                }</p>
                <p>${en ? 'Here is your one-time code (valid for 10 minutes):' : 'Voici votre code unique (valable 10 minutes) :'}</p>
                <div style="background-color: #f4f4f4; padding: 15px; font-size: 24px; letter-spacing: 5px; font-weight: bold; text-align: center; border-radius: 8px; border: 1px solid #ddd;">
                    ${code}
                </div>
                <p style="margin-top: 20px; font-size: 12px; color: #666;">
                    ${en ? 'If you did not request this, please ignore this email.' : "Si vous n'êtes pas à l'origine de cette demande, ignorez cet email."}
                </p>
            </div>
            `,
        });

        if (error) {
            logger.error('OTP_EMAIL_FAIL', `Failed to send OTP email`, { error });
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
