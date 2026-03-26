import { NextRequest, NextResponse } from 'next/server';
import { createLogger, generateCorrelationId } from '@/lib/logger';
import { checkRateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

/**
 * POST /api/update-entity
 *
 * Updates an existing AYA entity's data (certified clients only).
 * Resets the next_review_due to NOW + 365 days.
 */
export async function POST(req: NextRequest) {
    // Rate limit: 5 requests/min per IP
    const rateLimited = checkRateLimit(req, 'update-entity', RATE_LIMITS.checkout);
    if (rateLimited) return rateLimited;

    const logger = createLogger(generateCorrelationId(), 'update-entity');

    try {
        const body = await req.json();
        const { entityId, legalName, sector, services, targetAudience, country, contactEmail } = body;

        // Validate required fields
        if (!entityId || typeof entityId !== 'string') {
            logger.warn('UPDATE_MISSING_ID', 'Missing entityId in request body');
            return NextResponse.json({ error: 'entityId requis' }, { status: 400 });
        }

        if (!legalName || typeof legalName !== 'string' || legalName.trim().length < 2) {
            return NextResponse.json({ error: 'Nom legal requis (minimum 2 caracteres)' }, { status: 400 });
        }

        // Validate email format if provided
        if (contactEmail && typeof contactEmail === 'string' && contactEmail.trim()) {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(contactEmail.trim())) {
                return NextResponse.json({ error: 'Format email invalide' }, { status: 400 });
            }
        }

        logger.info('UPDATE_START', `Updating entity ${entityId}`, { legalName, sector });

        // Fetch entity and verify it exists and is a certified client
        const entity = await db.getAyaEntityById(entityId);
        if (!entity) {
            logger.warn('UPDATE_NOT_FOUND', `Entity not found: ${entityId}`);
            return NextResponse.json({ error: 'Entite introuvable' }, { status: 404 });
        }

        if (!entity.payment_completed) {
            logger.warn('UPDATE_NOT_CERTIFIED', `Entity not certified: ${entityId}`);
            return NextResponse.json({ error: 'Seules les entites certifiees peuvent mettre a jour leurs donnees' }, { status: 403 });
        }

        // Build updated asr_payload (merge with existing)
        const existingPayload = entity.asr_payload || {};
        const existingData = existingPayload.data || {};

        // Parse services into an array
        const servicesList = typeof services === 'string'
            ? services.split(',').map((s: string) => s.trim()).filter((s: string) => s.length > 0)
            : [];

        // Deep merge asr_payload.data with updated fields
        const updatedData = {
            ...existingData,
            identite: {
                ...(existingData.identite || {}),
                name: { value: legalName.trim(), q: 1 },
                ...(country ? { country: { value: country.trim(), q: 1 } } : {}),
            },
            offre: {
                ...(existingData.offre || {}),
                ...(servicesList.length > 0 ? { services: { value: servicesList, q: 1 } } : {}),
                ...(targetAudience ? { target_audience: { value: targetAudience.trim(), q: 1 } } : {}),
            },
        };

        const updatedPayload = {
            ...existingPayload,
            data: updatedData,
        };

        // Calculate next review due date (NOW + 365 days)
        const nextReviewDue = new Date();
        nextReviewDue.setDate(nextReviewDue.getDate() + 365);

        // Update entity in Supabase
        const updateFields: Record<string, any> = {
            display_name: legalName.trim(),
            legal_name: legalName.trim(),
            sector_macro: sector || entity.sector_macro,
            country_legal: country || entity.country_legal,
            asr_payload: updatedPayload,
            last_update: new Date().toISOString(),
            next_review_due: nextReviewDue.toISOString(),
            renewal_reminder_sent: false,
        };

        if (contactEmail && contactEmail.trim()) {
            updateFields.contact_email = contactEmail.trim();
        }

        await db.updateEntityRecommendability(entityId, updateFields);

        logger.info('UPDATE_SUCCESS', `Entity ${entityId} updated successfully`, {
            legalName: legalName.trim(),
            sector,
            nextReviewDue: nextReviewDue.toISOString(),
        });

        return NextResponse.json({
            success: true,
            message: 'Donnees mises a jour avec succes',
            nextReviewDue: nextReviewDue.toISOString(),
        });

    } catch (error: any) {
        logger.error('UPDATE_ERROR', error.message || 'Unknown error');
        return NextResponse.json(
            { error: 'Une erreur est survenue lors de la mise a jour' },
            { status: 500 }
        );
    }
}
