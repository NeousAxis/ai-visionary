/**
 * Cron endpoint : selection d'une entite, generation d'un post LinkedIn,
 * publication (si auto-publish active) ou sauvegarde en draft.
 *
 * Auth : header `Authorization: Bearer ${CRON_SECRET}` (env var dediee).
 *
 * Modes :
 * - LINKEDIN_AUTO_PUBLISH=true  -> publie via Playwright + log status=published
 * - LINKEDIN_AUTO_PUBLISH=false -> log status=draft (Cyril valide manuellement)
 *
 * Cron VPS attendu : 0 9,17,1 * * * curl -X POST -H "Authorization: Bearer X"
 *                    http://localhost:3000/api/cron/linkedin-post
 */

import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { supabase } from '@/lib/db';
import { selectNextEntity } from '@/lib/linkedin/post-selector';
import { generatePost, pickLocale } from '@/lib/linkedin/post-generator';
import { publishToLinkedIn, teardown } from '@/lib/linkedin/playwright-poster';
import { createLogger, generateCorrelationId } from '@/lib/logger';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

function authIsValid(authHeader: string): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const expected = `Bearer ${secret}`;
  const a = Buffer.from(authHeader);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  try {
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export async function POST(req: NextRequest) {
  const logger = createLogger(generateCorrelationId(), 'cron');

  // --- Auth (timing-safe HMAC comparison) ---
  const auth = req.headers.get('authorization') || '';
  if (!authIsValid(auth)) {
    logger.warn('CRON_UNAUTHORIZED', 'Bad CRON_SECRET');
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // --- 1. Selection entite ---
    const entity = await selectNextEntity();
    if (!entity) {
      logger.info('CRON_NO_ELIGIBLE', 'Aucune entite eligible (KNOWN_DOMAINS x score<=50 x non posted 30j)');
      return NextResponse.json({ skipped: true, reason: 'no_eligible_entity' });
    }
    logger.info('CRON_ENTITY_PICKED', `${entity.display_name} (${entity.domain}) score=${entity.current_score}->${entity.projected_score}`);

    // --- 2. Generation post ---
    const locale = pickLocale(entity.country);
    const post = generatePost({
      entityName: entity.display_name,
      entityDomain: entity.domain,
      entityId: entity.entity_id,
      currentScore: entity.current_score,
      projectedScore: entity.projected_score,
      sectorMacro: entity.sector_macro,
      city: entity.city,
      country: entity.country,
      locale,
    });

    // --- 3. Decision publish vs draft ---
    const autoPublish = process.env.LINKEDIN_AUTO_PUBLISH === 'true';
    let status: 'draft' | 'published' | 'failed' = 'draft';
    let postUrl: string | undefined;
    let errorMessage: string | undefined;

    if (autoPublish) {
      logger.info('CRON_PUBLISHING', `Publishing post for ${entity.domain}`);
      const result = await publishToLinkedIn(post.text);
      if (result.success) {
        status = 'published';
        postUrl = result.postUrl;
        logger.info('CRON_PUBLISHED', `OK : ${postUrl}`);
      } else {
        status = 'failed';
        errorMessage = result.error;
        logger.warn('CRON_PUBLISH_FAILED', `Erreur : ${result.error}`);
      }
      // Liberer Playwright apres usage
      await teardown().catch(() => {});
    } else {
      logger.info('CRON_DRAFT_MODE', 'LINKEDIN_AUTO_PUBLISH != true, save as draft');
    }

    // --- 4. Log dans linkedin_posts (Supabase) — HARD requirement pour anti-doublon ---
    if (!supabase) {
      logger.error('CRON_NO_SUPABASE', 'Supabase non configure, abandon (sinon doublon possible)');
      return NextResponse.json({ error: 'Database not available' }, { status: 503 });
    }

    const { error: insertError } = await supabase.from('linkedin_posts').insert({
      entity_id: entity.entity_id,
      entity_domain: entity.domain,
      entity_name: entity.display_name,
      current_score: entity.current_score,
      projected_score: entity.projected_score,
      post_text: post.text,
      post_locale: post.locale,
      status,
      linkedin_post_url: postUrl || null,
      scheduled_at: new Date().toISOString(),
      published_at: status === 'published' ? new Date().toISOString() : null,
      error_message: errorMessage || null,
    });

    if (insertError) {
      logger.error('CRON_DB_INSERT_FAIL', `Supabase insert failed : ${insertError.message}`);
      // Hard fail : si on ne peut pas tracer en DB, on ne sait pas si l'entite a deja
      // ete postee dans le futur -> risque de doublon. On retourne une erreur pour
      // que le cron retry / alerte plutot que de silencieusement reussir.
      return NextResponse.json(
        { error: 'Failed to log post to DB', status },
        { status: 500 }
      );
    }

    // --- 5. Reponse minimaliste (pas de leak de post.text complet ni d'errMsg interne) ---
    return NextResponse.json({
      success: true,
      status,
      entity_domain: entity.domain,
      entity_name: entity.display_name,
      post_url: postUrl || null,
    });
  } catch (e: any) {
    logger.error('CRON_ERROR', e?.message || 'Unknown error');
    await teardown().catch(() => {});
    // Pas de leak de e.message dans la reponse HTTP (peut contenir des fragments
    // de stack, env vars, paths, etc.). Le detail va dans les logs serveur.
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
