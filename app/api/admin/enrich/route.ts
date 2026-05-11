import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';
import { createLogger, generateCorrelationId } from '@/lib/logger';
import { checkRateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { generateCertifiedTranslations } from '@/lib/ayo-semantics';

export const maxDuration = 120;

/**
 * POST /api/admin/enrich
 *
 * Body:
 *   { entity_id: string }          — enrich a single entity
 *   { all: true }                  — enrich all certified entities missing enrichment
 *   { all: true, force: true }     — re-enrich ALL certified entities (overwrite existing)
 */
export async function POST(req: NextRequest) {
    const auth = requireAdmin(req);
    if (!auth.authorized) return auth.response!;

    const rateLimited = checkRateLimit(req, 'admin-enrich', RATE_LIMITS.debug);
    if (rateLimited) return rateLimited;

    const logger = createLogger(generateCorrelationId(), 'admin');
    const body = await req.json();

    try {
        if (body.entity_id) {
            // Single entity mode
            const result = await enrichEntity(body.entity_id, logger);
            return NextResponse.json(result);
        }

        if (body.all) {
            // Batch mode — all certified entities missing enrichment
            const entities = await db.getAyaEntities(10000);
            const certified = entities.filter((e: any) => e.payment_completed === true);
            const targets = body.force
                ? certified
                : certified.filter((e: any) => !hasEnrichment(e));

            logger.info('ENRICH_BATCH_START', `Processing ${targets.length} entities (${certified.length} certified total)`);

            const results: any[] = [];
            for (const entity of targets) {
                const eid = entity.entity_id || entity.aya_entity_id;
                if (!eid) continue;
                const result = await enrichEntity(eid, logger, entity);
                results.push(result);
                // Small delay to avoid Gemini rate limits
                await new Promise(r => setTimeout(r, 500));
            }

            const success = results.filter(r => r.success).length;
            const failed = results.filter(r => !r.success).length;

            return NextResponse.json({
                total: targets.length,
                success,
                failed,
                results,
            });
        }

        return NextResponse.json({ error: 'Provide entity_id or all:true' }, { status: 400 });
    } catch (err) {
        logger.error('ENRICH_ERROR', `Enrichment failed: ${err instanceof Error ? err.message : 'unknown'}`);
        return NextResponse.json({ error: 'Internal error' }, { status: 500 });
    }
}

function hasEnrichment(entity: any): boolean {
    const enrichment = entity.asr_payload?.enrichment;
    return !!(enrichment?.gemini_description && enrichment.gemini_description.length > 5);
}

/** Extract enrichment inputs from entity data (handles both V1 chat extract and V2 micro-agents extract) */
function extractInputs(entity: any): { name: string; businessType: string; services: string[]; audience: string; country: string } {
    const name = entity.display_name || entity.legal_name || '';
    const country = entity.country_legal || 'XX';

    const asrData = entity.asr_payload?.data || {};
    // V1 format: fields nested under extract.fields or extract directly
    const fields = asrData.fields || asrData;

    // Business type
    const businessType = fields.identite?.business_type?.value
        || asrData.identite?.business_type?.value
        || '';

    // Services — try multiple paths
    let services: string[] = [];
    const svcRaw = fields.offre?.services?.value
        || asrData.offre?.services?.value
        || [];
    if (Array.isArray(svcRaw)) {
        services = svcRaw;
    } else if (typeof svcRaw === 'string' && svcRaw.length > 2) {
        services = [svcRaw];
    }

    // Audience
    const audRaw = fields.offre?.target_audience?.value
        || asrData.offre?.target_audience?.value
        || '';
    const audience = Array.isArray(audRaw) ? audRaw.join(', ') : (typeof audRaw === 'string' ? audRaw : '');

    return { name, businessType, services, audience, country };
}

async function enrichEntity(entityId: string, logger: any, preloaded?: any): Promise<any> {
    try {
        const entity = preloaded || await db.getAyaEntityById(entityId);
        if (!entity) {
            return { entity_id: entityId, success: false, error: 'Entity not found' };
        }

        const inputs = extractInputs(entity);
        if (!inputs.name || inputs.name === 'Unknown') {
            // Try domain as fallback name
            if (entity.website) {
                inputs.name = entity.website.replace(/^https?:\/\/(www\.)?/, '').split('/')[0];
            }
        }

        logger.info('ENRICH_ENTITY', `Enriching ${inputs.name} (${entityId})`, inputs);

        // Call Gemini with retry x2
        let translations = await generateCertifiedTranslations(
            inputs.name,
            inputs.businessType,
            inputs.services,
            inputs.audience,
            inputs.country,
        );

        // Retry once if failed
        if (!translations.gemini_description) {
            logger.warn('ENRICH_RETRY', `First attempt failed for ${inputs.name}, retrying...`);
            await new Promise(r => setTimeout(r, 1000));
            translations = await generateCertifiedTranslations(
                inputs.name,
                inputs.businessType,
                inputs.services,
                inputs.audience,
                inputs.country,
            );
        }

        if (!translations.gemini_description) {
            return { entity_id: entityId, name: inputs.name, success: false, error: 'Gemini returned empty', inputs };
        }

        // Update entity in Supabase. The top-level spread is shallow, so we MUST
        // also clone the nested `enrichment` object — `entity` may be a reference into
        // the in-process cache in lib/db.ts (getAyaEntities), and mutating it in place
        // would leak uncommitted writes to concurrent readers and survive a failed
        // updateEntityData (cache only clears on success).
        const payload = { ...(entity.asr_payload || {}) };
        payload.enrichment = { ...((payload.enrichment as Record<string, any>) || {}) };
        payload.enrichment.gemini_description = translations.gemini_description;
        payload.enrichment.gemini_description_fr = translations.gemini_description_fr;
        payload.enrichment.gemini_keywords = translations.gemini_keywords;
        payload.enrichment.gemini_keywords_fr = translations.gemini_keywords_fr;
        payload.enrichment.enriched_at = new Date().toISOString();

        const eid = entity.entity_id || entityId;
        await db.updateEntityData(eid, { asr_payload: payload });

        logger.info('ENRICH_OK', `Enriched ${inputs.name}: "${translations.gemini_description.slice(0, 80)}..."`);

        return {
            entity_id: eid,
            name: inputs.name,
            success: true,
            description: translations.gemini_description,
            keywords: translations.gemini_keywords,
        };
    } catch (err) {
        return {
            entity_id: entityId,
            success: false,
            error: err instanceof Error ? err.message : 'unknown',
        };
    }
}
