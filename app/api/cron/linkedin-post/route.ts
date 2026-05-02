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
import { selectNextEntity, type SelectableEntity } from '@/lib/linkedin/post-selector';
import { generatePost, pickLocale } from '@/lib/linkedin/post-generator';
import { publishToLinkedIn, teardown } from '@/lib/linkedin/playwright-poster';
import { linkedinInsertPost, isLocalPgConfigured } from '@/lib/db-local-pg';
import { checkVisibility } from '@/lib/linkedin/visibility-checker';
import { createLogger, generateCorrelationId } from '@/lib/logger';

/** Country code → english country name (mirror of post-generator) */
const COUNTRY_NAMES: Record<string, string> = {
  CH: 'Switzerland', FR: 'France', DE: 'Germany', GB: 'the UK', UK: 'the UK',
  IT: 'Italy', ES: 'Spain', NL: 'the Netherlands', BE: 'Belgium', AT: 'Austria',
  PL: 'Poland', SE: 'Sweden', DK: 'Denmark', NO: 'Norway', FI: 'Finland',
  IE: 'Ireland', PT: 'Portugal', US: 'the US', CA: 'Canada', AU: 'Australia', IL: 'Israel',
};
const MAX_VISIBILITY_RETRIES = 5;

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

  // --- VPS-only : Postgres VPS doit etre accessible (sinon on est sur Vercel) ---
  if (!isLocalPgConfigured()) {
    logger.warn('CRON_NOT_VPS', 'VPS_PG_PASSWORD missing, this route only runs on VPS');
    return NextResponse.json(
      { error: 'This endpoint requires VPS Postgres (run on VPS only)' },
      { status: 503 }
    );
  }

  try {
    // --- 1. Selection entite + verification de NON-VISIBILITE dans LLM ---
    // Boucle : on essaie max 5 entites. Pour chacune on demande a Gemini de
    // lister 5 leaders du secteur. Si l'entite est citee → skip (poster un
    // contenu factuellement faux serait nuisible). Si elle n'est pas citee →
    // on a notre cible : on poste.
    let entity: SelectableEntity | null = null;
    let invisibleAttempts: { name: string; cited: string[] }[] = [];

    for (let i = 0; i < MAX_VISIBILITY_RETRIES; i++) {
      const candidate = await selectNextEntity();
      if (!candidate) {
        logger.info('CRON_NO_ELIGIBLE', 'Pool epuise (filtres ou doublons 30j)');
        return NextResponse.json({ skipped: true, reason: 'no_eligible_entity', attempts: invisibleAttempts });
      }

      const sectorEn = candidate.override_sector_en || 'company';
      const countryName = candidate.country ? COUNTRY_NAMES[candidate.country.toUpperCase()] : undefined;

      const vis = await checkVisibility({
        entityName: candidate.display_name,
        sectorPhrase: sectorEn,
        country: countryName,
      });

      if (vis.visible) {
        // Log skipped_visible pour eviter de re-tester cette entite avant 30j
        // (sert aussi a alimenter la blacklist implicite via linkedin_posts)
        await linkedinInsertPost({
          entity_id: candidate.entity_id,
          entity_domain: candidate.domain,
          entity_name: candidate.display_name,
          current_score: candidate.current_score,
          projected_score: candidate.projected_score,
          post_text: '(skipped: cited by Gemini at position ' + (vis.position ?? '?') + ')',
          post_locale: 'en',
          status: 'skipped',
          error_message: vis.error || `cited: ${vis.cited_companies.slice(0, 5).join(', ')}`,
        });
        invisibleAttempts.push({ name: candidate.display_name, cited: vis.cited_companies });
        logger.info('CRON_SKIP_VISIBLE', `${candidate.display_name} cite par Gemini (pos ${vis.position}) — skip`);
        continue;
      }

      // Trouve : entite invisible
      entity = candidate;
      logger.info('CRON_ENTITY_PICKED', `${entity.display_name} (${entity.domain}) score=${entity.current_score}->${entity.projected_score} [${i + 1} essais visibility]`);
      break;
    }

    if (!entity) {
      logger.warn('CRON_ALL_VISIBLE', `Toutes les ${MAX_VISIBILITY_RETRIES} entites testees etaient deja citees`);
      return NextResponse.json({
        skipped: true,
        reason: 'all_candidates_visible',
        attempts: invisibleAttempts,
      });
    }

    // --- 2. Generation post ---
    // Decision 2 mai 2026 : tous les posts en EN (pas de FR).
    const locale: 'en' = 'en';
    void pickLocale; // import garde pour back-compat, plus utilise
    const sectorPhrase = entity.override_sector_en;
    const post = generatePost({
      entityName: entity.display_name,
      entityDomain: entity.domain,
      entityId: entity.entity_id,
      currentScore: entity.current_score,
      projectedScore: entity.projected_score,
      sectorPhrase,
      city: entity.city,
      country: entity.country,
      locale,
      linkedinSlug: entity.linkedin_slug,
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

    // --- 4. Log dans linkedin_posts (Postgres VPS) — HARD requirement anti-doublon ---
    const postId = await linkedinInsertPost({
      entity_id: entity.entity_id,
      entity_domain: entity.domain,
      entity_name: entity.display_name,
      current_score: entity.current_score,
      projected_score: entity.projected_score,
      post_text: post.text,
      post_locale: post.locale,
      status,
      linkedin_post_url: postUrl || null,
      error_message: errorMessage || null,
    });

    if (!postId) {
      logger.error('CRON_DB_INSERT_FAIL', `linkedin_posts insert failed (returned null)`);
      // Hard fail : sans trace DB, risque de doublon au prochain cron.
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
