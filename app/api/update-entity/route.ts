import { NextRequest, NextResponse } from 'next/server';
import { createLogger, generateCorrelationId } from '@/lib/logger';
import { checkRateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { db } from '@/lib/db';
import { computeAioScore, type AyoExtract, type Quality } from '@/lib/aio-score-engine';

export const dynamic = 'force-dynamic';

/**
 * Expected body format:
 * {
 *   entityId: string,
 *   blocks: {
 *     identite?: { name?, legal_name?, business_type?, city?, country?, contact_email?, contact_phone? },
 *     offre?: { services?: string[], products?: string[], use_cases?: string[], target_audience?, pricing_indication? },
 *     processus_methodes?: { process_steps?: string[], delivery_mode?, geographies_served?, quality_assurance? },
 *     engagements_conformite?: { policies?: string[], frameworks?: string[], certifications?: string[], security_measures?: string[] },
 *     indicateurs?: { key_indicators?: any[], last_review_date? },
 *     contenus_pedagogiques?: { has_faq?: boolean, has_glossary?: boolean, has_documentation?: boolean },
 *     structure_technique?: { has_asr?: boolean, has_jsonld?: boolean, has_sitemap?: boolean, mobile_optimized?: boolean }
 *   }
 * }
 */

// Block names matching the AyoExtract.fields keys
const VALID_BLOCKS = [
    'identite', 'offre', 'processus_methodes', 'engagements_conformite',
    'indicateurs', 'contenus_pedagogiques', 'structure_technique',
] as const;

/**
 * Convert form blocks into {value, q, evidence} FieldNode format
 * compatible with AyoExtract.fields
 */
function toFieldNode<T>(value: T, q: Quality = 1): { value: T; q: Quality; evidence: string[] } {
    return { value, q, evidence: ['client_update'] };
}

/**
 * Deep-merge form block data into existing asr_payload.data,
 * converting raw values to {value, q:1, evidence} format.
 * Only non-null, non-undefined fields from formBlocks are merged.
 */
function mergeBlocksIntoPayload(
    existing: Record<string, any>,
    formBlocks: Record<string, Record<string, any>>
): Record<string, any> {
    const merged = { ...existing };

    for (const blockName of VALID_BLOCKS) {
        const formBlock = formBlocks[blockName];
        if (!formBlock || typeof formBlock !== 'object') continue;

        const existingBlock = merged[blockName] || {};
        const mergedBlock = { ...existingBlock };

        for (const [field, rawValue] of Object.entries(formBlock)) {
            // Skip null/undefined values (don't overwrite existing data)
            if (rawValue === null || rawValue === undefined) continue;

            // Skip empty strings
            if (typeof rawValue === 'string' && rawValue.trim() === '') continue;

            // Skip empty arrays
            if (Array.isArray(rawValue) && rawValue.length === 0) continue;

            // Convert to FieldNode format with q=1
            mergedBlock[field] = toFieldNode(rawValue);
        }

        merged[blockName] = mergedBlock;
    }

    return merged;
}

/**
 * Build a minimal AyoExtract from merged data for score calculation.
 * Fills missing fields with empty FieldNodes (q=0) so the score engine
 * doesn't crash on missing properties.
 */
function buildExtractFromData(
    data: Record<string, any>,
    entity: any
): AyoExtract {
    const emptyStr = (): { value: string; q: Quality; evidence: string[] } =>
        ({ value: '', q: 0, evidence: [] });
    const emptyArr = (): { value: string[]; q: Quality; evidence: string[] } =>
        ({ value: [], q: 0, evidence: [] });
    const emptyBool = (): { value: boolean; q: Quality; evidence: string[] } =>
        ({ value: false, q: 0, evidence: [] });
    const emptyAny = (): { value: any[]; q: Quality; evidence: string[] } =>
        ({ value: [], q: 0, evidence: [] });

    const get = (block: string, field: string) => data?.[block]?.[field];

    // Determine scan flags from entity metadata
    const asrPayload = entity.asr_payload || {};
    const scanData = asrPayload.scan || {};

    return {
        version: 'AYO-EXTRACT-3.0',
        source: {
            url: entity.website || '',
            scan: {
                is_reachable: scanData.is_reachable ?? true,
                has_jsonld: scanData.has_jsonld ?? (get('structure_technique', 'has_jsonld')?.value === true),
                jsonld_count: scanData.jsonld_count ?? null,
                has_asr_file: scanData.has_asr_file ?? (get('structure_technique', 'has_asr')?.value === true),
                has_faq_content: scanData.has_faq_content ?? (get('contenus_pedagogiques', 'has_faq')?.value === true),
                has_faq_schema: scanData.has_faq_schema ?? false,
                is_aya_registered: entity.payment_completed === true,
            },
        },
        fields: {
            identite: {
                name: get('identite', 'name') || emptyStr(),
                legal_name: get('identite', 'legal_name') || emptyStr(),
                business_type: get('identite', 'business_type') || emptyStr(),
                city: get('identite', 'city') || emptyStr(),
                country: get('identite', 'country') || emptyStr(),
                contact_email: get('identite', 'contact_email') || emptyStr(),
                contact_phone: get('identite', 'contact_phone') || emptyStr(),
            },
            offre: {
                services: get('offre', 'services') || emptyArr(),
                products: get('offre', 'products') || emptyArr(),
                use_cases: get('offre', 'use_cases') || emptyArr(),
                target_audience: get('offre', 'target_audience') || emptyStr(),
                pricing_indication: get('offre', 'pricing_indication') || emptyStr(),
            },
            processus_methodes: {
                process_steps: get('processus_methodes', 'process_steps') || emptyArr(),
                delivery_mode: get('processus_methodes', 'delivery_mode') || emptyStr(),
                geographies_served: get('processus_methodes', 'geographies_served') || emptyStr(),
                quality_assurance: get('processus_methodes', 'quality_assurance') || emptyStr(),
            },
            engagements_conformite: {
                policies: get('engagements_conformite', 'policies') || emptyArr(),
                frameworks: get('engagements_conformite', 'frameworks') || emptyArr(),
                certifications: get('engagements_conformite', 'certifications') || emptyArr(),
                security_measures: get('engagements_conformite', 'security_measures') || emptyArr(),
            },
            indicateurs: {
                key_indicators: get('indicateurs', 'key_indicators') || emptyAny(),
                last_review_date: get('indicateurs', 'last_review_date') || emptyStr(),
            },
            contenus_pedagogiques: {
                has_faq: get('contenus_pedagogiques', 'has_faq') || emptyBool(),
                has_glossary: get('contenus_pedagogiques', 'has_glossary') || emptyBool(),
                has_documentation: get('contenus_pedagogiques', 'has_documentation') || emptyBool(),
            },
            structure_technique: {
                has_asr: get('structure_technique', 'has_asr') || emptyBool(),
                has_jsonld: get('structure_technique', 'has_jsonld') || emptyBool(),
                has_sitemap: get('structure_technique', 'has_sitemap') || emptyBool(),
                mobile_optimized: get('structure_technique', 'mobile_optimized') || emptyBool(),
            },
            contextual_signals: {
                pricing_level: emptyStr(),
                access_mode: emptyStr(),
                service_mode: emptyArr(),
                schedule_type: emptyArr(),
            },
            recommandation: {
                contextual_relevance: { value: [], q: 0, evidence: [] },
                selection_conditions: { value: { required: [], exclusion: [] }, q: 0, evidence: [] },
                ai_simulation: { value: [], q: 0, evidence: [] },
            },
        },
    };
}

/**
 * POST /api/update-entity
 *
 * Updates an existing AYA entity's data (certified clients only).
 * Accepts full 7-block data, recalculates AIO score, resets next_review_due.
 */
export async function POST(req: NextRequest) {
    // Rate limit: 5 requests/min per IP
    const rateLimited = checkRateLimit(req, 'update-entity', RATE_LIMITS.checkout);
    if (rateLimited) return rateLimited;

    const logger = createLogger(generateCorrelationId(), 'update-entity');

    try {
        const body = await req.json();
        const { entityId, blocks } = body;

        // --- Validate entityId ---
        if (!entityId || typeof entityId !== 'string') {
            logger.warn('UPDATE_MISSING_ID', 'Missing entityId in request body');
            return NextResponse.json({ error: 'entityId requis' }, { status: 400 });
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
                { error: 'Au moins un bloc valide requis (identite, offre, processus_methodes, etc.)' },
                { status: 400 }
            );
        }

        logger.info('UPDATE_START', `Updating entity ${entityId}`, {
            blocksProvided: providedBlocks,
        });

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

        // --- Deep-merge form blocks into existing asr_payload.data ---
        const existingPayload = entity.asr_payload || {};
        const existingData = existingPayload.data || {};
        const oldScore = entity.asr_score || 0;

        const mergedData = mergeBlocksIntoPayload(existingData, blocks);

        // --- Recalculate AIO score ---
        const extract = buildExtractFromData(mergedData, entity);
        const scoreResult = computeAioScore(extract);
        const newScore = Math.round(scoreResult.total);

        logger.info('UPDATE_SCORE', `Score recalculated: ${oldScore} -> ${newScore}`, {
            oldScore,
            newScore,
            delta: newScore - oldScore,
            blocks: scoreResult.blocks,
        });

        // --- Build updated payload ---
        const updatedPayload = {
            ...existingPayload,
            data: mergedData,
            score: newScore,
            blocks: scoreResult.blocks,
            audit: scoreResult.audit,
            last_client_update: new Date().toISOString(),
        };

        // --- Calculate next review due date (NOW + 365 days) ---
        const nextReviewDue = new Date();
        nextReviewDue.setDate(nextReviewDue.getDate() + 365);

        // --- Extract top-level fields for Supabase columns ---
        const displayName =
            mergedData.identite?.name?.value ||
            mergedData.identite?.legal_name?.value ||
            entity.display_name;
        const legalName =
            mergedData.identite?.legal_name?.value ||
            mergedData.identite?.name?.value ||
            entity.legal_name;
        const country = mergedData.identite?.country?.value || entity.country_legal;
        const contactEmail =
            mergedData.identite?.contact_email?.value || entity.contact_email;

        // Resolve sector from business_type or first service
        const businessType = mergedData.identite?.business_type?.value || '';
        const firstService = mergedData.offre?.services?.value?.[0] || '';
        const sector = businessType || firstService || entity.sector_macro;

        // --- Update Supabase ---
        const updateFields: Record<string, any> = {
            display_name: displayName,
            legal_name: legalName,
            sector_macro: sector,
            country_legal: typeof country === 'string' && country.length === 2
                ? country.toUpperCase()
                : entity.country_legal,
            asr_payload: updatedPayload,
            asr_score: newScore,
            last_update: new Date().toISOString(),
            next_review_due: nextReviewDue.toISOString(),
            renewal_reminder_sent: false,
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
    } catch (error: any) {
        logger.error('UPDATE_ERROR', error.message || 'Unknown error');
        return NextResponse.json(
            { error: 'Une erreur est survenue lors de la mise a jour' },
            { status: 500 }
        );
    }
}
