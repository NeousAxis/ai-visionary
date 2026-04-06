import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';
import { createLogger, generateCorrelationId } from '@/lib/logger';
import { checkRateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { runAllAgents, mergeAgentResultsToExtract } from '@/lib/micro-agents/orchestrator';
import { computeAioScore } from '@/lib/aio-score-engine';

export const maxDuration = 120;

/**
 * POST /api/admin/rescore
 *
 * Modes:
 *   { status: true }                                  — count eligible/done/remaining
 *   { entity_id: string }                             — rescore single entity
 *   { batch_size?: number, offset?: number, dry_run?: boolean } — batch rescore
 */
export async function POST(req: NextRequest) {
    const auth = requireAdmin(req);
    if (!auth.authorized) return auth.response!;

    const rateLimited = checkRateLimit(req, 'admin-rescore', RATE_LIMITS.debug);
    if (rateLimited) return rateLimited;

    const logger = createLogger(generateCorrelationId(), 'admin');
    const body = await req.json();

    try {
        // ── Mode 1: Status ──────────────────────────────────
        if (body.status) {
            const counts = await db.countEntitiesForRescore();
            return NextResponse.json({
                total_eligible: counts.total,
                already_rescored: counts.rescored,
                remaining: counts.total - counts.rescored,
            });
        }

        // ── Mode 2: Single entity ───────────────────────────
        if (body.entity_id) {
            const entity = await db.getAyaEntityById(body.entity_id);
            if (!entity) return NextResponse.json({ error: 'Entity not found' }, { status: 404 });
            const result = await rescoreEntity(entity, body.dry_run === true, logger);
            return NextResponse.json(result);
        }

        // ── Mode 3: Batch ───────────────────────────────────
        const batchSize = Math.min(body.batch_size || 3, 10); // max 10 per call
        const offset = body.offset || 0;
        const dryRun = body.dry_run === true;

        const entities = await db.getEntitiesForRescore(batchSize, offset);
        if (entities.length === 0) {
            return NextResponse.json({ results: [], remaining: 0, next_offset: null, message: 'No more entities to rescore' });
        }

        logger.info('RESCORE_BATCH_START', `Batch offset=${offset} size=${entities.length} dry_run=${dryRun}`);

        const results: any[] = [];
        for (const entity of entities) {
            const result = await rescoreEntity(entity, dryRun, logger);
            results.push(result);
            // 2s delay between entities to respect Gemini rate limits
            if (entities.indexOf(entity) < entities.length - 1) {
                await new Promise(r => setTimeout(r, 2000));
            }
        }

        const success = results.filter(r => r.success).length;
        const skipped = results.filter(r => r.skipped).length;
        const failed = results.filter(r => !r.success && !r.skipped).length;

        // Count remaining
        const counts = await db.countEntitiesForRescore();
        const remaining = counts.total - counts.rescored;

        return NextResponse.json({
            batch_offset: offset,
            batch_size: entities.length,
            success,
            skipped,
            failed,
            remaining,
            next_offset: entities.length === batchSize ? offset + batchSize : null,
            dry_run: dryRun,
            results,
        });
    } catch (err) {
        logger.error('RESCORE_ERROR', `Rescore failed: ${err instanceof Error ? err.message : 'unknown'}`);
        return NextResponse.json({ error: 'Internal error' }, { status: 500 });
    }
}

interface RescoreResult {
    entity_id: string;
    name: string;
    website: string;
    success: boolean;
    skipped: boolean;
    old_score: number;
    new_score: number | null;
    duration_ms: number;
    dry_run: boolean;
    error?: string;
}

async function rescoreEntity(entity: any, dryRun: boolean, logger: any): Promise<RescoreResult> {
    const start = Date.now();
    const entityId = entity.entity_id;
    const name = entity.display_name || entity.legal_name || entityId;
    const website = entity.website;
    const oldScore = entity.asr_score ?? 0;

    // Resume: skip if already rescored
    if (entity.asr_payload?.rescore_v2?.scored_at) {
        return { entity_id: entityId, name, website, success: false, skipped: true, old_score: oldScore, new_score: entity.asr_payload.rescore_v2.new_score, duration_ms: 0, dry_run: dryRun };
    }

    // Skip if no website
    if (!website) {
        return { entity_id: entityId, name, website: '', success: false, skipped: false, old_score: oldScore, new_score: null, duration_ms: 0, dry_run: dryRun, error: 'no_website' };
    }

    try {
        logger.info('RESCORE_START', `Rescoring ${name} (${website})`);

        // Run V2 pipeline
        const { fetchResult, results } = await runAllAgents(website);

        if (!fetchResult.isReachable) {
            logger.warn('RESCORE_UNREACHABLE', `${website} unreachable (status ${fetchResult.statusCode})`);
            return { entity_id: entityId, name, website, success: false, skipped: false, old_score: oldScore, new_score: null, duration_ms: Date.now() - start, dry_run: dryRun, error: 'site_unreachable' };
        }

        // Merge agent results → AyoExtract
        const extract = await mergeAgentResultsToExtract(website, fetchResult, results);

        // Compute score
        const score = computeAioScore(extract);
        const newScore = Math.round(score.total);

        logger.info('RESCORE_SCORED', `${name}: ${oldScore} → ${newScore} (${newScore > oldScore ? '+' : ''}${newScore - oldScore})`);

        if (!dryRun) {
            // Update entity in Supabase
            const payload = { ...(entity.asr_payload || {}) };
            payload.data = extract;
            payload.rescore_v2 = {
                scored_at: new Date().toISOString(),
                old_score: oldScore,
                new_score: newScore,
                blocks: score.blocks,
                method: score.method || 'AYO_V3_CONTEXTUAL_BIBLE',
                pipeline_version: 'V2_MICRO_AGENTS',
            };

            await db.updateEntityData(entityId, {
                asr_score: newScore,
                asr_payload: payload,
            });
        }

        return { entity_id: entityId, name, website, success: true, skipped: false, old_score: oldScore, new_score: newScore, duration_ms: Date.now() - start, dry_run: dryRun };
    } catch (err) {
        const errMsg = err instanceof Error ? err.message : 'unknown';
        logger.error('RESCORE_ENTITY_FAIL', `${name}: ${errMsg}`);
        return { entity_id: entityId, name, website, success: false, skipped: false, old_score: oldScore, new_score: null, duration_ms: Date.now() - start, dry_run: dryRun, error: errMsg };
    }
}
