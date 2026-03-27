import { NextRequest, NextResponse } from 'next/server';
import { createLogger, generateCorrelationId } from '@/lib/logger';
import { checkRateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { db } from '@/lib/db';
import { computeAioScore, type AyoExtract } from '@/lib/aio-score-engine';
import { verifyUpdateToken } from '@/lib/update-token';
import { formDataToAyoExtract } from '@/lib/form-to-extract';

export const dynamic = 'force-dynamic';

// Block names matching the AyoExtract.fields keys
const VALID_BLOCKS = [
    'identite', 'offre', 'processus_methodes', 'engagements_conformite',
    'indicateurs', 'contenus_pedagogiques', 'structure_technique',
] as const;

/**
 * POST /api/update-entity
 *
 * Updates an existing AYA entity's data (certified clients only).
 * Accepts changed 7-block data, merges with existing AyoExtract,
 * recalculates AIO score, saves to Supabase.
 */
export async function POST(req: NextRequest) {
    // Rate limit: 5 requests/min per IP
    const rateLimited = checkRateLimit(req, 'update-entity', RATE_LIMITS.checkout);
    if (rateLimited) return rateLimited;

    const logger = createLogger(generateCorrelationId(), 'update-entity');

    try {
        const body = await req.json();
        const { entityId, blocks, token } = body;

        // --- Validate entityId ---
        if (!entityId || typeof entityId !== 'string') {
            logger.warn('UPDATE_MISSING_ID', 'Missing entityId in request body');
            return NextResponse.json({ error: 'entityId requis' }, { status: 400 });
        }

        // --- Verify auth token ---
        if (!token || !verifyUpdateToken(token, entityId)) {
            logger.warn('UPDATE_INVALID_TOKEN', `Invalid or expired token for entity ${entityId}`);
            return NextResponse.json({ error: 'Token invalide ou expire. Rechargez la page.' }, { status: 401 });
        }

        // --- Validate blocks object ---
        if (!blocks || typeof blocks !== 'object') {
            logger.warn('UPDATE_MISSING_BLOCKS', 'Missing blocks in request body');
            return NextResponse.json({ error: 'blocks requis (objet avec les 7 blocs AIO)' }, { status: 400 });
        }

        // Verify at least one valid block is present
        const providedBlocks = Object.keys(blocks).filter((k) =>
            (VALID_BLOCKS as readonly string[]).includes(k)
        );
        if (providedBlocks.length === 0) {
            return NextResponse.json(
                { error: 'Aucune modification detectee. Modifiez au moins un champ avant d\'enregistrer.' },
                { status: 400 }
            );
        }

        logger.info('UPDATE_START', `Updating entity ${entityId}`, { blocksProvided: providedBlocks });

        // --- Fetch entity and verify certification ---
        const entity = await db.getAyaEntityById(entityId);
        if (!entity) {
            logger.warn('UPDATE_NOT_FOUND', `Entity not found: ${entityId}`);
            return NextResponse.json({ error: 'Entite introuvable' }, { status: 404 });
        }

        if (!entity.payment_completed) {
            logger.warn('UPDATE_NOT_CERTIFIED', `Entity not certified: ${entityId}`);
            return NextResponse.json(
                { error: 'Seules les entites certifiees peuvent mettre a jour leurs donnees' },
                { status: 403 }
            );
        }

        // --- Build AyoExtract by merging form blocks into existing payload ---
        const existingPayload = entity.asr_payload || {};

        // Resolve the actual AyoExtract — three possible storage shapes:
        //  A) asr_payload = { version, fields, source, ... }         → full AyoExtract at root
        //  B) asr_payload = { data: { version, fields, source } }    → wrapped AyoExtract
        //  C) asr_payload = { data: { identite, offre, ... } }       → OLD flat format (no fields wrapper)
        //     In case C, data IS the fields object — wrap it into a proper AyoExtract.
        let existingExtract: Partial<AyoExtract>;

        if (existingPayload.version && existingPayload.fields) {
            // Shape A
            existingExtract = existingPayload as Partial<AyoExtract>;
        } else {
            const data = (existingPayload.data || existingPayload) as Record<string, unknown>;

            if (data.fields && typeof data.fields === 'object') {
                // Shape B — data already has a fields wrapper
                existingExtract = data as Partial<AyoExtract>;
            } else {
                // Shape C — flat blocks (identite, offre, ...) ARE the fields
                // Wrap them so formDataToAyoExtract can find extract.fields
                const scan = (existingPayload.scan || {}) as AyoExtract['source']['scan'];
                existingExtract = {
                    version: 'AYO-EXTRACT-3.0',
                    source: {
                        url: entity.website || '',
                        scan,
                    },
                    fields: data as unknown as AyoExtract['fields'],
                };
            }
        }

        const oldScore = entity.asr_score || 0;

        const extract = formDataToAyoExtract(blocks, existingExtract);

        // --- Recalculate AIO score ---
        const scoreResult = computeAioScore(extract);
        const newScore = Math.round(scoreResult.total);

        logger.info('UPDATE_SCORE', `Score recalculated: ${oldScore} -> ${newScore}`, {
            oldScore,
            newScore,
            delta: newScore - oldScore,
            blocks: scoreResult.blocks,
        });

        // --- Build updated asr_payload to store ---
        // Preserve original storage structure (wrap in .data if that's how it was stored)
        let updatedPayload: Record<string, unknown>;
        if (existingPayload.version && existingPayload.fields) {
            // Was stored flat — update in-place
            updatedPayload = {
                ...existingPayload,
                ...extract,
                score: newScore,
                blocks: scoreResult.blocks,
                last_client_update: new Date().toISOString(),
            };
        } else {
            // Was stored as { data: <extract>, ... }
            updatedPayload = {
                ...existingPayload,
                data: extract,
                score: newScore,
                blocks: scoreResult.blocks,
                last_client_update: new Date().toISOString(),
            };
        }

        // --- Calculate next review due date ---
        const nextReviewDue = new Date();
        nextReviewDue.setDate(nextReviewDue.getDate() + 365);

        // --- Extract top-level fields for Supabase columns ---
        const identite = extract.fields?.identite;
        const offre = extract.fields?.offre;

        const displayName =
            identite?.name?.value ||
            identite?.legal_name?.value ||
            entity.display_name;
        const legalName =
            identite?.legal_name?.value ||
            identite?.name?.value ||
            entity.legal_name;
        const country = identite?.country?.value || entity.country_legal;
        const contactEmail = identite?.contact_email?.value || entity.contact_email;
        const businessType = (identite?.business_type?.value as string) || '';
        const firstService = (offre?.services?.value as string[])?.[0] || '';
        const sector = businessType || firstService || entity.sector_macro;

        // --- Update Supabase ---
        const updateFields: Record<string, unknown> = {
            display_name: displayName,
            legal_name: legalName,
            sector_macro: sector,
            country_legal: typeof country === 'string' && country.length === 2
                ? country.toUpperCase()
                : entity.country_legal,
            asr_payload: updatedPayload,
            asr_score: newScore,
        };

        if (contactEmail && typeof contactEmail === 'string' && contactEmail.trim()) {
            updateFields.contact_email = contactEmail.trim();
        }

        const updated = await db.updateEntityData(entityId, updateFields);

        if (!updated) {
            logger.error('UPDATE_DB_FAIL', `Failed to update entity ${entityId} in Supabase`);
            return NextResponse.json(
                { error: 'Erreur lors de la mise a jour en base' },
                { status: 500 }
            );
        }

        logger.info('UPDATE_SUCCESS', `Entity ${entityId} updated successfully`, {
            displayName,
            oldScore,
            newScore,
            nextReviewDue: nextReviewDue.toISOString(),
        });

        return NextResponse.json({
            success: true,
            message: 'Donnees mises a jour avec succes',
            oldScore,
            newScore,
            nextReviewDue: nextReviewDue.toISOString(),
        });

    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        logger.error('UPDATE_ERROR', message);
        return NextResponse.json(
            { error: 'Une erreur est survenue lors de la mise a jour' },
            { status: 500 }
        );
    }
}
