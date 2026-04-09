import { NextRequest, NextResponse } from 'next/server';
import { sendEmail } from '@/lib/mailer';
import JSZip from 'jszip';
import crypto from 'crypto';
import { createLogger, generateCorrelationId } from '@/lib/logger';
import { checkRateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { db } from '@/lib/db';
import { sanitizeExtract } from '@/lib/ayo-generators';
import { generateProPack, type ArchitecteInput } from '@/lib/agents/architecte';
import { verifyUpdateToken } from '@/lib/update-token';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * POST /api/regenerate-files
 *
 * Regenerates the 5 PRO files for a certified entity and sends them by email.
 * Used after a client updates their data via /api/update-entity.
 *
 * Body: { entityId: string }
 */
export async function POST(req: NextRequest) {
    // Rate limit: same as checkout (5 req/min)
    const rateLimited = checkRateLimit(req, 'regenerate-files', RATE_LIMITS.checkout);
    if (rateLimited) return rateLimited;

    const logger = createLogger(generateCorrelationId(), 'regenerate-files');

    try {
        const body = await req.json();
        const { entityId, token } = body;

        // Locale detection: from request body, NEXT_LOCALE cookie, or default 'en'
        const locale: 'fr' | 'en' =
            (body.locale === 'fr' ? 'fr' : null) ||
            (req.cookies.get('NEXT_LOCALE')?.value === 'fr' ? 'fr' : null) ||
            'en';
        const en = locale === 'en';

        // --- Validate ---
        if (!entityId || typeof entityId !== 'string') {
            logger.warn('REGEN_MISSING_ID', 'Missing entityId');
            return NextResponse.json({ error: 'entityId requis' }, { status: 400 });
        }

        // --- Verify auth token (Bug 2&3 fix) ---
        if (!token || !verifyUpdateToken(token, entityId)) {
            logger.warn('REGEN_INVALID_TOKEN', `Invalid or expired token for entity ${entityId}`);
            return NextResponse.json({ error: 'Token invalide ou expire. Rechargez la page.' }, { status: 401 });
        }

        logger.info('REGEN_START', `Regenerating files for entity ${entityId}`);

        // --- Fetch entity ---
        const entity = await db.getAyaEntityById(entityId);
        if (!entity) {
            logger.warn('REGEN_NOT_FOUND', `Entity not found: ${entityId}`);
            return NextResponse.json({ error: 'Entite introuvable' }, { status: 404 });
        }

        if (!entity.payment_completed) {
            logger.warn('REGEN_NOT_CERTIFIED', `Entity not certified: ${entityId}`);
            return NextResponse.json(
                { error: 'Seules les entites certifiees peuvent regenerer leurs fichiers' },
                { status: 403 }
            );
        }

        // --- Build extractData from entity's asr_payload ---
        const asrPayload = entity.asr_payload || {};
        const extractData = asrPayload.data || {};

        // Resolve entity name
        const entityName =
            extractData.identite?.name?.value ||
            extractData.identite?.legal_name?.value ||
            entity.display_name ||
            'Entreprise';

        const entityUrl = entity.website || '';
        const customerEmail = entity.contact_email || '';

        if (!customerEmail) {
            logger.error('REGEN_NO_EMAIL', `No contact email for entity ${entityId}`);
            return NextResponse.json(
                { error: 'Aucun email de contact associe a cette entite' },
                { status: 400 }
            );
        }

        // --- Sanitize data ---
        if (extractData && typeof extractData === 'object') {
            const { cleanedFields } = sanitizeExtract(extractData);
            for (const field of cleanedFields) {
                logger.info('REGEN_SANITIZE', `Cleaned template value from ${field}`);
            }
        }

        // --- Generate files via Agent Architecte ---
        const asrId = `asr_${entityId.replace(/[^a-zA-Z0-9]/g, '').substring(0, 16)}_${crypto.randomUUID().replace(/-/g, '').substring(0, 8)}`;
        const score = entity.asr_score || asrPayload.score || 0;

        const architecteInput: ArchitecteInput = {
            extractData,
            url: entityUrl,
            email: customerEmail,
            mode: 'PRO',
            score,
            date: new Date().toISOString(),
            asrId,
        };

        const architecteResult = await generateProPack(architecteInput);

        logger.info('REGEN_ARCHITECTE', `Architecte: delivered=${architecteResult.delivered}, attempts=${architecteResult.attempts}`, {
            delivered: architecteResult.delivered,
            attempts: architecteResult.attempts,
            totalErrors: architecteResult.qcResult.errors.length,
        });

        if (!architecteResult.delivered) {
            const blockingErrors = architecteResult.qcResult.errors
                .filter((e) => e.severity === 'blocking')
                .map((e) => `${e.file}:${e.field} — ${e.message}`);
            logger.warn('REGEN_QC_WARN', `QC issues after ${architecteResult.attempts} attempts`, {
                blockingErrors,
            });
        }

        // --- Build ZIP ---
        const zip = new JSZip();
        zip.file('ASR-Protocol.json', JSON.stringify(architecteResult.files.asr, null, 2));
        zip.file('manifest.json', JSON.stringify(architecteResult.files.manifest, null, 2));
        zip.file('faq.json', JSON.stringify(architecteResult.files.faq, null, 2));
        zip.file('glossary.json', JSON.stringify(architecteResult.files.glossary, null, 2));
        zip.file('external_context.json', JSON.stringify(architecteResult.files.externalContext, null, 2));

        const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' });
        logger.info('REGEN_ZIP', `ZIP built (${zipBuffer.length} bytes) for ${entityName}`);

        // --- Send email ---
        if (!process.env.SMTP_USER) {
            logger.error('REGEN_NO_SMTP', 'SMTP not configured (SMTP_USER missing)');
            return NextResponse.json(
                { error: 'Service email non configure' },
                { status: 500 }
            );
        }

        const ayaLink = `https://www.ai-visionary.xyz/aya/e/${entityId}`;

        const emailHtml = `<div style="font-family: 'Helvetica Neue', Arial, sans-serif; color: #333; max-width: 640px; margin: 0 auto;">
    <div style="background: linear-gradient(135deg, #212E53 0%, #4A919E 100%); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
        <h1 style="color: #fff; margin: 0; font-size: 22px;">${en ? 'Your AYO files have been updated' : 'Vos fichiers AYO mis a jour'}</h1>
        <p style="color: #BED3C3; margin: 10px 0 0; font-size: 14px;">${en ? 'Following your data update' : 'Suite a la mise a jour de vos donnees'}</p>
    </div>

    <div style="background: #fff; padding: 25px; border: 1px solid #e5e7eb;">
        <p>${en ? 'Hello,' : 'Bonjour,'}</p>
        <p>${en ? `Following your information update for <strong>${entityName}</strong>, we have regenerated your ASR files.` : `Suite a la mise a jour de vos informations pour <strong>${entityName}</strong>, nous avons regenere vos fichiers ASR.`}</p>

        <div style="background: #f0fdf4; padding: 20px; border-radius: 8px; margin: 20px 0; text-align: center; border: 2px solid #86efac;">
            <p style="margin:0; font-size: 14px; color: #666;">${en ? 'New AIO Score' : 'Nouveau Score AIO'}</p>
            <p style="margin: 5px 0; font-size: 42px; font-weight: bold; color: ${score >= 60 ? '#166534' : score >= 40 ? '#854d0e' : '#991b1b'};">${Math.round(score)} / 100</p>
        </div>

        <div style="background: #f9fafb; padding: 15px; border-radius: 8px; border: 1px solid #e5e7eb;">
            <h3 style="margin-top: 0; color: #212E53;">${en ? 'Regenerated files' : 'Fichiers regeneres'}</h3>
            <ul style="list-style: none; padding: 0; margin: 0; font-size: 14px; line-height: 2;">
                <li>&#128081; <strong>ASR-Protocol.json</strong> — ${en ? 'Updated semantic identity' : 'Identite semantique mise a jour'}</li>
                <li>&#9881;&#65039; <strong>manifest.json</strong> — ${en ? 'AI recommendation policy' : 'Politique de recommandation IA'}</li>
                <li>&#128172; <strong>faq.json</strong> — ${en ? 'Structured FAQ' : 'FAQ structuree'}</li>
                <li>&#128214; <strong>glossary.json</strong> — ${en ? 'Business vocabulary' : 'Vocabulaire metier'}</li>
                <li>&#127760; <strong>external_context.json</strong> — ${en ? 'Signals and context' : 'Signaux et contexte'}</li>
            </ul>
        </div>

        <p style="margin-top: 20px; text-align: center;">
            <a href="${ayaLink}" style="background: #4A919E; color: #fff; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: bold;">${en ? 'View my AYA certificate' : 'Voir mon certificat AYA'}</a>
        </p>

        <div style="background: #e3f2fd; padding: 15px; border-radius: 8px; margin: 20px 0; border: 1px solid #bbdefb;">
            <p style="margin: 0; font-size: 13px;"><strong>${en ? 'Reminder:' : 'Rappel :'}</strong> ${en ? 'Replace the old files on your website with the ones attached to this email to update your AI visibility.' : 'Remplacez les anciens fichiers sur votre site par ceux joints a cet email pour mettre a jour votre visibilite IA.'}</p>
        </div>
    </div>

    <div style="background: #f9fafb; padding: 15px; border-radius: 0 0 12px 12px; text-align: center; border: 1px solid #e5e7eb; border-top: 0;">
        <p style="font-size: 12px; color: #9ca3af; margin: 0;">
            <a href="https://ai-visionary.xyz" style="color: #4A919E; text-decoration: none;">AI Visionary</a> — ${en ? 'Make your business visible to AI' : 'Rendez votre entreprise visible par les IA'}
        </p>
    </div>
</div>`;

        const emailResult = await sendEmail({
            from: 'AYO Delivery <delivery@ai-visionary.xyz>',
            to: [customerEmail],
            subject: en ? `Your AYO files have been updated — ${entityName}` : `Vos fichiers AYO mis a jour — ${entityName}`,
            attachments: [{ filename: 'AYO_Pack_PRO_Updated.zip', content: zipBuffer }],
            html: emailHtml,
        });

        if (!emailResult.success) {
            logger.error('REGEN_EMAIL_FAIL', `Email send failed: ${emailResult.error}`);
            throw new Error(emailResult.error || 'Email sending failed');
        }

        logger.info('REGEN_EMAIL_SENT', `Email sent to ${customerEmail}`);

        return NextResponse.json({
            success: true,
            message: 'Fichiers regeneres et envoyes par email',
            filesGenerated: 5,
            score,
            entityName,
        });
    } catch (error: any) {
        logger.error('REGEN_ERROR', error.message || 'Unknown error', {
            stack: error.stack?.substring(0, 500),
        });
        return NextResponse.json(
            { error: 'Une erreur est survenue lors de la regeneration des fichiers' },
            { status: 500 }
        );
    }
}
