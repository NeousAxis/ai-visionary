/**
 * db-local-pg.ts
 *
 * Postgres client for the VPS local database (aya_local).
 * Only active when VPS_PG_PASSWORD is set in the environment.
 * Safe to import on Vercel — every helper returns empty results when unconfigured.
 */

import { Pool } from 'pg';
import type { QueryResult } from 'pg';

// ── Entity type — mirrors aya_registry columns ───────────────────────────────

export type Entity = {
    entity_id: string;
    legal_name: string | null;
    display_name: string | null;
    entity_type: string | null;
    country_legal: string | null;
    sector_macro: string | null;
    website: string | null;
    asr_score: number | null;
    payment_completed: boolean | null;
    contact_email: string | null;
    data_origin: string | null;
    asr_payload: Record<string, unknown> | null;
    recommendability: Record<string, unknown> | null;
};

// ── SELECT columns (shared) ───────────────────────────────────────────────────

const ENTITY_COLS = `
    entity_id, legal_name, display_name, entity_type,
    country_legal, sector_macro, website, asr_score,
    payment_completed, contact_email, data_origin,
    asr_payload, recommendability,
    valid_until, created_at, last_update, updated_at,
    pack_type, subscription_status
`;

// ── Singleton Pool ────────────────────────────────────────────────────────────

let _pool: Pool | null = null;
let _warnLogged = false;

export function isLocalPgConfigured(): boolean {
    return !!process.env.VPS_PG_PASSWORD;
}

function getPool(): Pool | null {
    if (!isLocalPgConfigured()) {
        if (!_warnLogged) {
            console.warn(
                '[db-local-pg] VPS Postgres not configured — VPS_PG_PASSWORD missing. ' +
                'All helpers return empty results.'
            );
            _warnLogged = true;
        }
        return null;
    }
    if (!_pool) {
        _pool = new Pool({
            host:     process.env.VPS_PG_HOST     || 'localhost',
            port:     parseInt(process.env.VPS_PG_PORT || '5432', 10),
            database: process.env.VPS_PG_DB       || 'aya_local',
            user:     process.env.VPS_PG_USER     || 'aya_app',
            password: process.env.VPS_PG_PASSWORD,
            max: 5,
            idleTimeoutMillis:    30_000,
            connectionTimeoutMillis: 5_000,
        });
        _pool.on('error', (err: Error) => {
            console.error('[db-local-pg] Pool error:', err.message);
        });
    }
    return _pool;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Paginated entity list — equivalent of db.getAyaEntitiesPaginated.
 */
export async function localPgGetEntities(options: {
    limit: number;
    offset: number;
    search?: string;
    sort?: 'default' | 'alpha' | 'score' | 'country' | 'certified';
}): Promise<{ data: Entity[]; total: number }> {
    const pool = getPool();
    if (!pool) return { data: [], total: 0 };

    const { limit, offset, search, sort = 'default' } = options;

    // Default order: certified first, then by score DESC, then md5(entity_id) for deterministic shuffle (~25K rows at score 50)
    let orderBy = "payment_completed DESC NULLS LAST, asr_score DESC NULLS LAST, md5(entity_id::text)";
    if (sort === 'alpha')    orderBy = 'display_name ASC NULLS LAST';
    if (sort === 'score')    orderBy = 'asr_score DESC NULLS LAST';
    if (sort === 'country')  orderBy = 'country_legal ASC NULLS LAST';
    const certFilter = sort === 'certified' ? 'AND payment_completed = true' : '';

    try {
        if (search) {
            const q = `%${search}%`;
            const countRes: QueryResult<{ cnt: string }> = await pool.query(
                `SELECT COUNT(*) AS cnt
                 FROM aya_registry
                 WHERE (display_name ILIKE $1 OR legal_name ILIKE $1 OR website ILIKE $1
                        OR sector_macro ILIKE $1 OR country_legal ILIKE $1)
                 AND display_name NOT ILIKE '%porn%'
                 AND display_name NOT ILIKE '% sex %'
                 AND display_name NOT ILIKE '%xxx%'
                 AND display_name NOT ILIKE '%escort%'
                 AND display_name NOT ILIKE '%onlyfans%'
                 AND display_name NOT ILIKE $2
                 AND display_name NOT ILIKE $3`,
                [q, "['%", '{{%']
            );
            const total = parseInt(countRes.rows[0]?.cnt ?? '0', 10);

            const dataRes: QueryResult<Entity> = await pool.query(
                `SELECT ${ENTITY_COLS}
                 FROM aya_registry
                 WHERE (display_name ILIKE $1 OR legal_name ILIKE $1 OR website ILIKE $1
                        OR sector_macro ILIKE $1 OR country_legal ILIKE $1)
                 AND display_name NOT ILIKE '%porn%'
                 AND display_name NOT ILIKE '% sex %'
                 AND display_name NOT ILIKE '%xxx%'
                 AND display_name NOT ILIKE '%escort%'
                 AND display_name NOT ILIKE '%onlyfans%'
                 AND display_name NOT ILIKE $2
                 AND display_name NOT ILIKE $3
                 ORDER BY ${orderBy}
                 LIMIT $4 OFFSET $5`,
                [q, "['%", '{{%', limit, offset]
            );
            return { data: dataRes.rows, total };
        }

        // No search
        const countRes: QueryResult<{ cnt: string }> = await pool.query(
            `SELECT COUNT(*) AS cnt
             FROM aya_registry
             WHERE 1=1 ${certFilter}
             AND display_name NOT ILIKE '%porn%'
             AND display_name NOT ILIKE '% sex %'
             AND display_name NOT ILIKE '%xxx%'
             AND display_name NOT ILIKE '%escort%'
             AND display_name NOT ILIKE '%onlyfans%'
             AND display_name NOT ILIKE $1
             AND display_name NOT ILIKE $2`,
            ["['%", '{{%']
        );
        const total = parseInt(countRes.rows[0]?.cnt ?? '0', 10);

        const dataRes: QueryResult<Entity> = await pool.query(
            `SELECT ${ENTITY_COLS}
             FROM aya_registry
             WHERE 1=1 ${certFilter}
             AND display_name NOT ILIKE '%porn%'
             AND display_name NOT ILIKE '% sex %'
             AND display_name NOT ILIKE '%xxx%'
             AND display_name NOT ILIKE '%escort%'
             AND display_name NOT ILIKE '%onlyfans%'
             AND display_name NOT ILIKE $1
             AND display_name NOT ILIKE $2
             ORDER BY ${orderBy}
             LIMIT $3 OFFSET $4`,
            ["['%", '{{%', limit, offset]
        );
        return { data: dataRes.rows, total };
    } catch (err) {
        console.error('[db-local-pg] localPgGetEntities error:', err);
        return { data: [], total: 0 };
    }
}

/**
 * Find one entity by domain.
 * Accepts bare domain (e.g. "stripe.com") or full URL.
 *
 * Bug 3 fix: uses regexp_replace to normalise the stored website column before
 * comparing, so that rows with trailing slashes, www prefix, http vs https all
 * match.  Input is also normalised the same way.
 */
export async function localPgGetEntityByDomain(domain: string): Promise<Entity | null> {
    const pool = getPool();
    if (!pool) return null;

    // Normalise input: strip scheme, www, path, query, fragment — keep only the host
    const bare = domain
        .toLowerCase()
        .replace(/^https?:\/\//, '')
        .replace(/^www\./, '')
        .split('/')[0]
        .split('?')[0]
        .split('#')[0];

    try {
        // Normalise stored website the same way: strip scheme/www, then strip path
        // (everything after first `/`). This catches rows like
        // https://stripe.com/de-ch, https://www.example.com/, etc.
        const res: QueryResult<Entity> = await pool.query(
            `SELECT ${ENTITY_COLS}
             FROM aya_registry
             WHERE
               regexp_replace(
                 regexp_replace(lower(website), '^https?://(www\\.)?', '', 'g'),
                 '/.*$', '', 'g'
               ) = $1
             ORDER BY asr_score DESC NULLS LAST
             LIMIT 1`,
            [bare]
        );
        return res.rows[0] ?? null;
    } catch (err) {
        console.error('[db-local-pg] localPgGetEntityByDomain error:', err);
        return null;
    }
}

/**
 * Filter entities by sector and/or country, paginated.
 */
export async function localPgGetEntitiesByFilter(options: {
    sector?: string;
    country?: string;
    limit: number;
    offset: number;
}): Promise<{ data: Entity[]; total: number }> {
    const pool = getPool();
    if (!pool) return { data: [], total: 0 };

    const { sector, country, limit, offset } = options;
    const params: unknown[] = [];

    const sectorClause  = sector  ? `AND sector_macro  = $${params.push(sector)}`                 : '';
    const countryClause = country ? `AND country_legal = $${params.push(country.toUpperCase())}` : '';

    try {
        const countRes: QueryResult<{ cnt: string }> = await pool.query(
            `SELECT COUNT(*) AS cnt
             FROM aya_registry
             WHERE 1=1 ${sectorClause} ${countryClause}`,
            params
        );
        const total = parseInt(countRes.rows[0]?.cnt ?? '0', 10);

        const dataParams: unknown[] = [...params];
        dataParams.push(limit);
        const limitIdx = dataParams.length;
        dataParams.push(offset);
        const offsetIdx = dataParams.length;

        const dataRes: QueryResult<Entity> = await pool.query(
            `SELECT ${ENTITY_COLS}
             FROM aya_registry
             WHERE 1=1 ${sectorClause} ${countryClause}
             ORDER BY asr_score DESC NULLS LAST
             LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
            dataParams
        );
        return { data: dataRes.rows, total };
    } catch (err) {
        console.error('[db-local-pg] localPgGetEntitiesByFilter error:', err);
        return { data: [], total: 0 };
    }
}

export type LocalPgStats = {
    total: number;
    total_entities: number;
    certified_count: number;
    indexed_count: number;
    scores: { average: number; min: number; max: number; median: number };
    sectors: { sector: string; count: number }[];
    countries: { country: string; count: number }[];
};

/**
 * Aggregate stats — same shape as /api/aya/stats.
 */
export async function localPgGetStats(): Promise<LocalPgStats> {
    const empty: LocalPgStats = {
        total: 0,
        total_entities: 0,
        certified_count: 0,
        indexed_count: 0,
        scores: { average: 0, min: 0, max: 0, median: 0 },
        sectors: [],
        countries: [],
    };
    const pool = getPool();
    if (!pool) return empty;

    try {
        const [totalRes, certifiedRes, scoreRes, sectorRes, countryRes] = await Promise.all([
            pool.query<{ cnt: string }>(
                `SELECT COUNT(*) AS cnt FROM aya_registry`
            ),
            pool.query<{ cnt: string }>(
                `SELECT COUNT(*) AS cnt FROM aya_registry WHERE payment_completed = true`
            ),
            pool.query<{ avg: string; min_s: string; max_s: string; med: string }>(
                `SELECT
                   ROUND(AVG(asr_score))::text AS avg,
                   MIN(asr_score)::text         AS min_s,
                   MAX(asr_score)::text         AS max_s,
                   PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY asr_score)::text AS med
                 FROM aya_registry
                 WHERE asr_score IS NOT NULL`
            ),
            pool.query<{ sector_macro: string; cnt: string }>(
                `SELECT sector_macro, COUNT(*) AS cnt
                 FROM aya_registry
                 WHERE sector_macro IS NOT NULL
                 GROUP BY sector_macro
                 ORDER BY cnt DESC`
            ),
            pool.query<{ country_legal: string; cnt: string }>(
                `SELECT country_legal, COUNT(*) AS cnt
                 FROM aya_registry
                 WHERE country_legal IS NOT NULL
                   AND country_legal <> ''
                   AND country_legal <> 'XX'
                 GROUP BY country_legal
                 ORDER BY cnt DESC`
            ),
        ]);

        const s = scoreRes.rows[0];
        const total = parseInt(totalRes.rows[0]?.cnt ?? '0', 10);
        const certified = parseInt(certifiedRes.rows[0]?.cnt ?? '0', 10);

        return {
            total,
            total_entities: total,
            certified_count: certified,
            indexed_count: total - certified,
            scores: {
                average: s ? parseInt(s.avg   ?? '0', 10) : 0,
                min:     s ? parseInt(s.min_s ?? '0', 10) : 0,
                max:     s ? parseInt(s.max_s ?? '0', 10) : 0,
                median:  s ? parseInt(s.med   ?? '0', 10) : 0,
            },
            sectors:   sectorRes.rows.map((r) => ({ sector:  r.sector_macro,  count: parseInt(r.cnt, 10) })),
            countries: countryRes.rows.map((r) => ({ country: r.country_legal, count: parseInt(r.cnt, 10) })),
        };
    } catch (err) {
        console.error('[db-local-pg] localPgGetStats error:', err);
        return empty;
    }
}

/**
 * Find one entity by its UUID primary key.
 */
export async function localPgGetEntityById(id: string): Promise<Entity | null> {
    const pool = getPool();
    if (!pool) return null;
    try {
        const res: QueryResult<Entity> = await pool.query(
            `SELECT ${ENTITY_COLS} FROM aya_registry WHERE entity_id = $1::uuid LIMIT 1`,
            [id]
        );
        return res.rows[0] ?? null;
    } catch (err) {
        console.error('[db-local-pg] localPgGetEntityById error:', err);
        return null;
    }
}

/**
 * Multi-word ILIKE search — mirrors the logic in /api/aya/search.
 */
export async function localPgSearch(q: string, limit: number): Promise<Entity[]> {
    const pool = getPool();
    if (!pool) return [];

    const stopWords = new Set([
        'le', 'la', 'les', 'de', 'du', 'des', 'un', 'une', 'et', 'en',
        'à', 'a', 'au', 'aux', 'dans', 'pour', 'sur', 'par', 'avec',
        'the', 'of', 'in', 'and', 'for', 'on', 'at', 'to', 'is', 'an',
    ]);
    const words = q
        .toLowerCase()
        .split(/\s+/)
        .filter((w) => w.length >= 2 && !stopWords.has(w));

    if (words.length === 0) return [];

    try {
        const params: unknown[] = [];
        const clauses = words.map((word) => {
            params.push(`%${word}%`);
            const idx = params.length;
            return `(display_name ILIKE $${idx} OR legal_name ILIKE $${idx}
                      OR website ILIKE $${idx} OR sector_macro ILIKE $${idx}
                      OR country_legal ILIKE $${idx})`;
        });
        params.push(limit);
        const limitIdx = params.length;

        const res: QueryResult<Entity> = await pool.query(
            `SELECT ${ENTITY_COLS}
             FROM aya_registry
             WHERE ${clauses.join(' AND ')}
             ORDER BY payment_completed DESC NULLS LAST, asr_score DESC NULLS LAST
             LIMIT $${limitIdx}`,
            params
        );
        return res.rows;
    } catch (err) {
        console.error('[db-local-pg] localPgSearch error:', err);
        return [];
    }
}

// ── Filter / taxonomy helpers ─────────────────────────────────────────────────

/**
 * Distinct sector_macro values with entity counts.
 * Mirrors db.getAyaSectors() but reads from VPS Postgres.
 */
export async function localPgGetSectors(): Promise<{ sector: string; count: number }[]> {
    const pool = getPool();
    if (!pool) return [];
    try {
        const res: QueryResult<{ sector_macro: string; cnt: string }> = await pool.query(
            `SELECT sector_macro, COUNT(*) AS cnt
             FROM aya_registry
             WHERE sector_macro IS NOT NULL
               AND sector_macro <> ''
             GROUP BY sector_macro
             ORDER BY cnt DESC`
        );
        return res.rows
            .map((r) => ({ sector: r.sector_macro, count: parseInt(r.cnt, 10) }))
            .filter((r) => r.count >= 2);
    } catch (err) {
        console.error('[db-local-pg] localPgGetSectors error:', err);
        return [];
    }
}

/**
 * Distinct country_legal values with entity counts.
 * Mirrors db.getAyaCountries() but reads from VPS Postgres.
 */
export async function localPgGetCountries(): Promise<{ country: string; count: number }[]> {
    const pool = getPool();
    if (!pool) return [];
    try {
        const res: QueryResult<{ country_legal: string; cnt: string }> = await pool.query(
            `SELECT country_legal, COUNT(*) AS cnt
             FROM aya_registry
             WHERE country_legal IS NOT NULL
               AND country_legal <> ''
               AND country_legal <> 'XX'
             GROUP BY country_legal
             ORDER BY cnt DESC`
        );
        return res.rows
            .map((r) => ({ country: r.country_legal.toUpperCase(), count: parseInt(r.cnt, 10) }))
            .filter((r) => r.count >= 2);
    } catch (err) {
        console.error('[db-local-pg] localPgGetCountries error:', err);
        return [];
    }
}

/**
 * Non-empty (sector_macro, country_legal) combinations with count >= 1.
 * Mirrors db.getAyaSectorCountryCombinations() but reads from VPS Postgres.
 */
export async function localPgGetSectorCountryCombinations(): Promise<
    { sector: string; country: string; count: number }[]
> {
    const pool = getPool();
    if (!pool) return [];
    try {
        const res: QueryResult<{ sector_macro: string; country_legal: string; cnt: string }> =
            await pool.query(
                `SELECT sector_macro, country_legal, COUNT(*) AS cnt
                 FROM aya_registry
                 WHERE sector_macro   IS NOT NULL
                   AND country_legal  IS NOT NULL
                   AND country_legal  <> ''
                   AND country_legal  <> 'XX'
                   AND asr_score      >= 20
                 GROUP BY sector_macro, country_legal
                 HAVING COUNT(*) >= 1
                 ORDER BY cnt DESC`
            );
        return res.rows.map((r) => ({
            sector:  r.sector_macro,
            country: r.country_legal.toUpperCase(),
            count:   parseInt(r.cnt, 10),
        }));
    } catch (err) {
        console.error('[db-local-pg] localPgGetSectorCountryCombinations error:', err);
        return [];
    }
}

// ── aya_registry write helpers (added during full Supabase -> VPS migration) ───
// All writes that used to go to Supabase aya_registry now go to Postgres VPS local.

/** Upsert by entity_id — used by updateEntityRecommendability (new/existing). */
export async function localPgUpsertEntity(entityId: string, data: Record<string, unknown>): Promise<boolean> {
    const pool = getPool();
    if (!pool) return false;
    const { aya_entity_id: _drop, entity_id: _drop2, ...clean } = data as any;
    const cols = Object.keys(clean);
    if (cols.length === 0) return false;
    const setExpr = cols.map((c, i) => `${c}=EXCLUDED.${c}`).join(', ');
    const placeholders = cols.map((_, i) => `$${i + 2}`).join(', ');
    const sql = `INSERT INTO aya_registry (entity_id, ${cols.join(', ')}) VALUES ($1, ${placeholders})
                 ON CONFLICT (entity_id) DO UPDATE SET ${setExpr}`;
    const values = [entityId, ...cols.map(c => {
        const v = (clean as any)[c];
        return (typeof v === 'object' && v !== null) ? JSON.stringify(v) : v;
    })];
    try {
        await pool.query(sql, values);
        return true;
    } catch (e) {
        console.error('[db-local-pg] localPgUpsertEntity error:', e);
        return false;
    }
}

/** Update specific fields on an existing entity by entity_id. */
export async function localPgUpdateEntity(entityId: string, fields: Record<string, unknown>): Promise<boolean> {
    const pool = getPool();
    if (!pool) return false;
    const { aya_entity_id: _drop, entity_id: _drop2, ...clean } = fields as any;
    const cols = Object.keys(clean);
    if (cols.length === 0) return true;
    const setExpr = cols.map((c, i) => `${c}=$${i + 2}`).join(', ');
    const sql = `UPDATE aya_registry SET ${setExpr}, last_update=NOW() WHERE entity_id=$1`;
    const values = [entityId, ...cols.map(c => {
        const v = (clean as any)[c];
        return (typeof v === 'object' && v !== null) ? JSON.stringify(v) : v;
    })];
    try {
        const res = await pool.query(sql, values);
        return (res.rowCount ?? 0) > 0;
    } catch (e) {
        console.error('[db-local-pg] localPgUpdateEntity error:', e);
        return false;
    }
}

/** Find entity by Stripe subscription_id. */
export async function localPgGetEntityBySubscriptionId(subscriptionId: string): Promise<Entity | null> {
    const pool = getPool();
    if (!pool) return null;
    try {
        const res = await pool.query<Entity>(`SELECT * FROM aya_registry WHERE subscription_id=$1 LIMIT 1`, [subscriptionId]);
        return res.rows[0] ?? null;
    } catch (e) {
        console.error('[db-local-pg] localPgGetEntityBySubscriptionId error:', e);
        return null;
    }
}

/** Mark entities past valid_until as expired. Returns the list of expired entity_ids. */
export async function localPgMarkEntitiesExpired(): Promise<string[]> {
    const pool = getPool();
    if (!pool) return [];
    try {
        const res = await pool.query<{ entity_id: string }>(
            `UPDATE aya_registry
             SET payment_completed=false, subscription_status='expired', last_update=NOW()
             WHERE payment_completed=true AND valid_until IS NOT NULL AND valid_until < NOW()
             RETURNING entity_id`
        );
        return res.rows.map(r => r.entity_id);
    } catch (e) {
        console.error('[db-local-pg] localPgMarkEntitiesExpired error:', e);
        return [];
    }
}

/** Get count of entities matching a payment_completed status. */
export async function localPgGetAyaEntities(limit: number = 10000): Promise<any[]> {
    const pool = getPool();
    if (!pool) return [];
    try {
        const res = await pool.query(`SELECT * FROM aya_registry ORDER BY created_at DESC LIMIT $1`, [limit]);
        return res.rows;
    } catch (e) {
        console.error('[db-local-pg] localPgGetAyaEntities error:', e);
        return [];
    }
}

// ── LinkedIn poster helpers (1er mai 2026) ────────────────────────────────────
// Ces helpers ecrivent dans la table linkedin_posts (Postgres VPS uniquement,
// pas Supabase, pour respecter la grace period jusqu'au 7 mai).

export interface LinkedinPostInput {
    entity_id: string;
    entity_domain: string;
    entity_name: string;
    current_score: number;
    projected_score: number;
    post_text: string;
    post_locale: string;
    status: 'draft' | 'approved' | 'published' | 'failed' | 'skipped';
    linkedin_post_url?: string | null;
    error_message?: string | null;
    /** 'passed' = Gemini check OK (entite non citee, safe a publier),
     *  'skipped_visible' = entite citee par Gemini (skip auto),
     *  null/undefined = pas teste (drafts pre-filtre). */
    visibility_check?: string | null;
}

/**
 * Insert dans linkedin_posts. Retourne l'id genere ou null si echec.
 * Sur Vercel (sans Postgres VPS configure), retourne null silencieusement.
 */
export async function linkedinInsertPost(input: LinkedinPostInput): Promise<string | null> {
    const pool = getPool();
    if (!pool) return null;
    try {
        const publishedAt = input.status === 'published' ? new Date() : null;
        const res: QueryResult<{ id: string }> = await pool.query(
            `INSERT INTO linkedin_posts (
                entity_id, entity_domain, entity_name,
                current_score, projected_score,
                post_text, post_locale, status,
                linkedin_post_url, error_message,
                scheduled_at, published_at,
                visibility_check
             ) VALUES ($1::uuid, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), $11, $12)
             RETURNING id`,
            [
                input.entity_id,
                input.entity_domain,
                input.entity_name,
                input.current_score,
                input.projected_score,
                input.post_text,
                input.post_locale,
                input.status,
                input.linkedin_post_url ?? null,
                input.error_message ?? null,
                publishedAt,
                input.visibility_check ?? null,
            ]
        );
        return res.rows[0]?.id ?? null;
    } catch (err) {
        console.error('[db-local-pg] linkedinInsertPost error:', err);
        return null;
    }
}

/**
 * Liste paginee des linkedin_posts (admin UI).
 */
export interface LinkedinPostRow {
    id: string;
    entity_id: string;
    entity_domain: string;
    entity_name: string;
    current_score: number;
    projected_score: number;
    post_text: string;
    post_locale: string;
    status: string;
    linkedin_post_url: string | null;
    error_message: string | null;
    scheduled_at: string;
    published_at: string | null;
    created_at: string;
    visibility_check: string | null;
}

export async function linkedinListPosts(opts: {
    limit?: number;
    offset?: number;
    statusFilter?: string;
}): Promise<{ rows: LinkedinPostRow[]; total: number }> {
    const pool = getPool();
    if (!pool) return { rows: [], total: 0 };
    const { limit = 50, offset = 0, statusFilter } = opts;

    try {
        const params: unknown[] = [];
        const whereClause = statusFilter ? `WHERE status = $${params.push(statusFilter)}` : '';
        const countQuery = `SELECT COUNT(*)::text AS cnt FROM linkedin_posts ${whereClause}`;
        const countRes = await pool.query<{ cnt: string }>(countQuery, params);
        const total = parseInt(countRes.rows[0]?.cnt ?? '0', 10);

        const limitIdx = params.push(limit);
        const offsetIdx = params.push(offset);
        const dataQuery = `
            SELECT id::text, entity_id::text, entity_domain, entity_name,
                   current_score, projected_score, post_text, post_locale,
                   status, linkedin_post_url, error_message,
                   scheduled_at::text, published_at::text, created_at::text,
                   visibility_check
            FROM linkedin_posts
            ${whereClause}
            ORDER BY scheduled_at DESC
            LIMIT $${limitIdx} OFFSET $${offsetIdx}
        `;
        const dataRes = await pool.query<LinkedinPostRow>(dataQuery, params);
        return { rows: dataRes.rows, total };
    } catch (err) {
        console.error('[db-local-pg] linkedinListPosts error:', err);
        return { rows: [], total: 0 };
    }
}

/**
 * Recupere le plus ancien post avec status='approved' (FIFO de la queue
 * de publication automatique).
 */
export async function linkedinGetOldestApproved(): Promise<LinkedinPostRow | null> {
    const pool = getPool();
    if (!pool) return null;
    try {
        const res: QueryResult<LinkedinPostRow> = await pool.query(
            `SELECT id::text, entity_id::text, entity_domain, entity_name,
                    current_score, projected_score, post_text, post_locale,
                    status, linkedin_post_url, error_message,
                    scheduled_at::text, published_at::text, created_at::text,
                    visibility_check
             FROM linkedin_posts
             WHERE status = 'approved'
             ORDER BY scheduled_at ASC
             LIMIT 1`
        );
        return res.rows[0] ?? null;
    } catch (err) {
        console.error('[db-local-pg] linkedinGetOldestApproved error:', err);
        return null;
    }
}

/**
 * Met a jour le status d'un post linkedin_posts.
 */
export async function linkedinUpdatePostStatus(
    id: string,
    status: 'draft' | 'approved' | 'published' | 'failed' | 'skipped',
    extra?: { linkedin_post_url?: string; error_message?: string }
): Promise<boolean> {
    const pool = getPool();
    if (!pool) return false;
    try {
        const publishedAt = status === 'published' ? new Date() : null;
        // Important : pour status='published' ou 'draft' ou 'approved', on
        // EFFACE l'error_message precedent (sinon une vieille erreur reste
        // affichee meme apres une publication reussie). Pour 'failed', on
        // ecrit le nouveau message.
        const shouldClearError = status === 'published' || status === 'draft' || status === 'approved';
        const newErrorMessage = shouldClearError
            ? null
            : (extra?.error_message ?? null);

        await pool.query(
            `UPDATE linkedin_posts
             SET status = $1,
                 linkedin_post_url = COALESCE($2, linkedin_post_url),
                 error_message = $3,
                 published_at = COALESCE($4, published_at)
             WHERE id = $5::uuid`,
            [status, extra?.linkedin_post_url ?? null, newErrorMessage, publishedAt, id]
        );
        return true;
    } catch (err) {
        console.error('[db-local-pg] linkedinUpdatePostStatus error:', err);
        return false;
    }
}

/**
 * Liste des entity_id deja postes dans les N derniers jours.
 * Utilise pour eviter les doublons.
 */
export async function linkedinGetRecentEntityIds(daysSinceCutoff: number): Promise<Set<string>> {
    const pool = getPool();
    if (!pool) return new Set();
    try {
        const res: QueryResult<{ entity_id: string }> = await pool.query(
            `SELECT DISTINCT entity_id::text
             FROM linkedin_posts
             WHERE scheduled_at > NOW() - ($1 || ' days')::interval`,
            [String(daysSinceCutoff)]
        );
        return new Set(res.rows.map((r) => r.entity_id));
    } catch (err) {
        console.error('[db-local-pg] linkedinGetRecentEntityIds error:', err);
        return new Set();
    }
}

/**
 * Selection des entites candidates pour un post LinkedIn.
 *
 * Mode useKnownDomainsFilter=true (defaut, retro-compat) :
 *   Filtres : score <= 50, payment_completed = false, contact_email present,
 *             website dans la liste de domaines connus passee en argument,
 *             asr_payload present.
 *
 * Mode useKnownDomainsFilter=false (pool elargi Tranco 25k+) :
 *   Supprime le filtre sur knownDomains et ajoute des filtres qualite
 *   supplementaires sur asr_payload, gemini_description et display_name.
 */
export async function linkedinSelectCandidates(opts: {
    knownDomains: string[];
    excludeEntityIds: string[];
    limit: number;
    /** Si false, ignore le filtre domain IN(knownDomains) et applique des
     *  filtres qualite supplementaires pour ouvrir le pool aux ~25k entites
     *  Tranco. Default : true (retro-compat). */
    useKnownDomainsFilter?: boolean;
}): Promise<Entity[]> {
    const pool = getPool();
    if (!pool) return [];

    const useKnownFilter = opts.useKnownDomainsFilter !== false; // default true
    if (useKnownFilter && opts.knownDomains.length === 0) return [];

    try {
        const params: unknown[] = [];

        // Clause domaine connu (mode original)
        let domainClause = '';
        if (useKnownFilter) {
            params.push(opts.knownDomains);
            domainClause = `AND lower(
                     regexp_replace(
                       regexp_replace(COALESCE(website, ''), '^https?://(www\\.)?', ''),
                       '/.*$', ''
                     )
                   ) = ANY($${params.length})`;
        }

        // Clause asr_payload + gemini_description (mode pool elargi uniquement)
        let payloadClause = '';
        if (!useKnownFilter) {
            payloadClause = `
               AND asr_payload IS NOT NULL
               AND (asr_payload->'data'->'enrichment'->>'gemini_description') IS NOT NULL
               AND LENGTH(asr_payload->'data'->'enrichment'->>'gemini_description') >= 100`;
        }

        // Clause display_name qualite (mode pool elargi uniquement)
        let nameQualityClause = '';
        if (!useKnownFilter) {
            nameQualityClause = `
               AND display_name IS NOT NULL
               AND display_name != ''
               AND LENGTH(display_name) >= 3
               AND LENGTH(display_name) <= 60
               AND display_name NOT LIKE 'http%'`;
        }

        // Clause exclude entity_ids
        const excludeClause = opts.excludeEntityIds.length > 0
            ? `AND entity_id::text != ALL($${params.length + 1})`
            : '';
        if (opts.excludeEntityIds.length > 0) params.push(opts.excludeEntityIds);

        // LIMIT toujours en dernier param
        params.push(opts.limit);
        const limitIdx = params.length;

        const res: QueryResult<Entity> = await pool.query(
            `SELECT ${ENTITY_COLS}
             FROM aya_registry
             WHERE asr_score <= 50
               AND COALESCE(payment_completed, false) = false
               AND contact_email IS NOT NULL
               AND contact_email != ''
               ${domainClause}
               ${payloadClause}
               ${nameQualityClause}
               ${excludeClause}
             ORDER BY RANDOM()
             LIMIT $${limitIdx}`,
            params
        );
        return res.rows;
    } catch (err) {
        console.error('[db-local-pg] linkedinSelectCandidates error:', err);
        return [];
    }
}

// ── Cashback Pollen helpers (16 juin 2026) ────────────────────────────────────
// Tables cashback_offers + cashback_claims (Postgres VPS uniquement).
// Voir migrations/2026-06-16_cashback_pollen.sql.

export interface CashbackOfferRow {
    id: string;
    entity_id: string | null;
    entity_domain: string;
    service_name: string | null;
    cashback_type: string;        // flat | percent
    cashback_value: number;
    currency: string;
    cpa_total: number | null;
    honey_value: number | null;
    vertical: string | null;
    status: string;               // active | paused | ended
    notes: string | null;
    affiliate_url: string | null; // lien d'affiliation taggé servi à l'agent (Amazon, Hostinger, etc.)
}

function bareDomain(input: string): string {
    return input
        .toLowerCase()
        .replace(/^https?:\/\//, '')
        .replace(/^www\./, '')
        .split('/')[0]
        .split('?')[0]
        .split('#')[0]
        .trim();
}

/** Offre cashback ACTIVE pour un domaine (ou null). Lecture indexee, ms. */
export async function localPgGetActiveCashbackOffer(domain: string): Promise<CashbackOfferRow | null> {
    const pool = getPool();
    if (!pool) return null;
    try {
        const res = await pool.query<CashbackOfferRow>(
            `SELECT id::text, entity_id::text, entity_domain, service_name,
                    cashback_type, cashback_value::float8 AS cashback_value, currency,
                    cpa_total::float8 AS cpa_total, honey_value::float8 AS honey_value,
                    vertical, status, notes, affiliate_url
             FROM cashback_offers
             WHERE entity_domain = $1 AND status = 'active'
             LIMIT 1`,
            [bareDomain(domain)],
        );
        return res.rows[0] ?? null;
    } catch (err) {
        console.error('[db-local-pg] localPgGetActiveCashbackOffer error:', err);
        return null;
    }
}

/** Cree/active une offre (admin). Upsert sur (entity_domain) actif. */
export async function localPgUpsertCashbackOffer(input: {
    entityId?: string | null;
    entityDomain: string;
    serviceName?: string | null;
    cashbackType?: 'flat' | 'percent';
    cashbackValue: number;
    currency?: string;
    cpaTotal?: number | null;
    honeyValue?: number | null;
    vertical?: string | null;
    notes?: string | null;
    affiliateUrl?: string | null;
}): Promise<string | null> {
    const pool = getPool();
    if (!pool) return null;
    try {
        const res = await pool.query<{ id: string }>(
            `INSERT INTO cashback_offers
                (entity_id, entity_domain, service_name, cashback_type, cashback_value,
                 currency, cpa_total, honey_value, vertical, affiliate_url, status)
             VALUES ($1::uuid, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'active')
             ON CONFLICT (entity_domain) WHERE status = 'active'
             DO UPDATE SET service_name=EXCLUDED.service_name,
                           cashback_type=EXCLUDED.cashback_type,
                           cashback_value=EXCLUDED.cashback_value,
                           currency=EXCLUDED.currency,
                           cpa_total=EXCLUDED.cpa_total,
                           honey_value=EXCLUDED.honey_value,
                           vertical=EXCLUDED.vertical,
                           affiliate_url=EXCLUDED.affiliate_url,
                           updated_at=NOW()
             RETURNING id::text`,
            [
                input.entityId ?? null,
                bareDomain(input.entityDomain),
                input.serviceName ?? null,
                input.cashbackType ?? 'flat',
                input.cashbackValue,
                input.currency ?? 'CHF',
                input.cpaTotal ?? null,
                input.honeyValue ?? null,
                input.vertical ?? null,
                input.affiliateUrl ?? null,
            ],
        );
        return res.rows[0]?.id ?? null;
    } catch (err) {
        console.error('[db-local-pg] localPgUpsertCashbackOffer error:', err);
        return null;
    }
}

/** Un claim existe-t-il deja pour ce jti ? (anti-rejeu). */
export async function localPgGetCashbackClaimByJti(jti: string): Promise<{ id: string; status: string } | null> {
    const pool = getPool();
    if (!pool) return null;
    try {
        const res = await pool.query<{ id: string; status: string }>(
            `SELECT id::text, status FROM cashback_claims WHERE jti = $1 LIMIT 1`,
            [jti],
        );
        return res.rows[0] ?? null;
    } catch (err) {
        console.error('[db-local-pg] localPgGetCashbackClaimByJti error:', err);
        return null;
    }
}

/** Enregistre un claim (status 'claimed' → validation manuelle). Retourne l'id ou null. */
export async function localPgInsertCashbackClaim(input: {
    jti: string;
    offerId: string;
    entityId?: string | null;
    entityDomain: string;
    agentId?: string | null;
    principalRef?: string | null;
    proof?: unknown;
    currency?: string;
    tokenIssuedAt?: Date | null;
    tokenExp?: Date | null;
}): Promise<string | null> {
    const pool = getPool();
    if (!pool) return null;
    try {
        const res = await pool.query<{ id: string }>(
            `INSERT INTO cashback_claims
                (jti, offer_id, entity_id, entity_domain, agent_id, principal_ref,
                 status, proof, currency, token_issued_at, token_exp)
             VALUES ($1, $2::uuid, $3::uuid, $4, $5, $6, 'claimed', $7::jsonb, $8, $9, $10)
             ON CONFLICT (jti) DO NOTHING
             RETURNING id::text`,
            [
                input.jti,
                input.offerId,
                input.entityId ?? null,
                bareDomain(input.entityDomain),
                input.agentId ?? null,
                input.principalRef ?? null,
                input.proof != null ? JSON.stringify(input.proof) : null,
                input.currency ?? 'CHF',
                input.tokenIssuedAt ?? null,
                input.tokenExp ?? null,
            ],
        );
        return res.rows[0]?.id ?? null;
    } catch (err) {
        console.error('[db-local-pg] localPgInsertCashbackClaim error:', err);
        return null;
    }
}

/** Offres actives pour un lot de domaines → Map(domain → offre). Pour annoter les resultats agent. */
export async function localPgGetActiveCashbackOffersForDomains(
    domains: string[],
): Promise<Map<string, CashbackOfferRow>> {
    const out = new Map<string, CashbackOfferRow>();
    const pool = getPool();
    if (!pool || domains.length === 0) return out;
    const bare = Array.from(new Set(domains.map(bareDomain).filter(Boolean)));
    if (bare.length === 0) return out;
    try {
        const res = await pool.query<CashbackOfferRow>(
            `SELECT id::text, entity_id::text, entity_domain, service_name,
                    cashback_type, cashback_value::float8 AS cashback_value, currency,
                    cpa_total::float8 AS cpa_total, honey_value::float8 AS honey_value,
                    vertical, status, notes, affiliate_url
             FROM cashback_offers
             WHERE status = 'active' AND entity_domain = ANY($1)`,
            [bare],
        );
        for (const row of res.rows) out.set(row.entity_domain, row);
        return out;
    } catch (err) {
        console.error('[db-local-pg] localPgGetActiveCashbackOffersForDomains error:', err);
        return out;
    }
}

/** Liste des offres (admin). */
export async function localPgListCashbackOffers(limit = 200): Promise<CashbackOfferRow[]> {
    const pool = getPool();
    if (!pool) return [];
    try {
        const res = await pool.query<CashbackOfferRow>(
            `SELECT id::text, entity_id::text, entity_domain, service_name,
                    cashback_type, cashback_value::float8 AS cashback_value, currency,
                    cpa_total::float8 AS cpa_total, honey_value::float8 AS honey_value,
                    vertical, status, notes, affiliate_url
             FROM cashback_offers
             ORDER BY created_at DESC
             LIMIT $1`,
            [limit],
        );
        return res.rows;
    } catch (err) {
        console.error('[db-local-pg] localPgListCashbackOffers error:', err);
        return [];
    }
}

/** Change le status d'une offre (active | paused | ended). */
export async function localPgSetCashbackOfferStatus(id: string, status: string): Promise<boolean> {
    const pool = getPool();
    if (!pool) return false;
    try {
        const res = await pool.query(
            `UPDATE cashback_offers SET status=$2, updated_at=NOW() WHERE id=$1::uuid`,
            [id, status],
        );
        return (res.rowCount ?? 0) > 0;
    } catch (err) {
        console.error('[db-local-pg] localPgSetCashbackOfferStatus error:', err);
        return false;
    }
}

export interface CashbackClaimRow {
    id: string;
    jti: string;
    offer_id: string;
    entity_id: string | null;
    entity_domain: string;
    agent_id: string | null;
    principal_ref: string | null;
    status: string;
    proof: unknown;
    amount_cashback: number | null;
    amount_honey: number | null;
    currency: string;
    claimed_at: string;
    validated_at: string | null;
    paid_at: string | null;
    review_notes: string | null;
    // jointure offre (pour resoudre les montants)
    offer_cashback_type?: string;
    offer_cashback_value?: number;
    offer_honey_value?: number | null;
}

/** Liste paginee des claims (admin), filtrable par status, avec champs offre joints. */
export async function localPgListCashbackClaims(opts: {
    status?: string;
    limit?: number;
    offset?: number;
}): Promise<{ rows: CashbackClaimRow[]; total: number }> {
    const pool = getPool();
    if (!pool) return { rows: [], total: 0 };
    const { status, limit = 100, offset = 0 } = opts;
    try {
        const params: unknown[] = [];
        const where = status ? `WHERE c.status = $${params.push(status)}` : '';
        const countRes = await pool.query<{ cnt: string }>(
            `SELECT COUNT(*)::text AS cnt FROM cashback_claims c ${where}`,
            params,
        );
        const total = parseInt(countRes.rows[0]?.cnt ?? '0', 10);
        const limitIdx = params.push(limit);
        const offsetIdx = params.push(offset);
        const res = await pool.query<CashbackClaimRow>(
            `SELECT c.id::text, c.jti, c.offer_id::text, c.entity_id::text, c.entity_domain,
                    c.agent_id, c.principal_ref, c.status, c.proof,
                    c.amount_cashback::float8 AS amount_cashback,
                    c.amount_honey::float8 AS amount_honey, c.currency,
                    c.claimed_at::text, c.validated_at::text, c.paid_at::text, c.review_notes,
                    o.cashback_type AS offer_cashback_type,
                    o.cashback_value::float8 AS offer_cashback_value,
                    o.honey_value::float8 AS offer_honey_value
             FROM cashback_claims c
             LEFT JOIN cashback_offers o ON o.id = c.offer_id
             ${where}
             ORDER BY c.claimed_at DESC
             LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
            params,
        );
        return { rows: res.rows, total };
    } catch (err) {
        console.error('[db-local-pg] localPgListCashbackClaims error:', err);
        return { rows: [], total: 0 };
    }
}

/** Un claim + son offre (pour la validation, resolution des montants). */
export async function localPgGetClaimWithOffer(id: string): Promise<CashbackClaimRow | null> {
    const pool = getPool();
    if (!pool) return null;
    try {
        const res = await pool.query<CashbackClaimRow>(
            `SELECT c.id::text, c.jti, c.offer_id::text, c.entity_id::text, c.entity_domain,
                    c.agent_id, c.principal_ref, c.status, c.proof,
                    c.amount_cashback::float8 AS amount_cashback,
                    c.amount_honey::float8 AS amount_honey, c.currency,
                    c.claimed_at::text, c.validated_at::text, c.paid_at::text, c.review_notes,
                    o.cashback_type AS offer_cashback_type,
                    o.cashback_value::float8 AS offer_cashback_value,
                    o.honey_value::float8 AS offer_honey_value
             FROM cashback_claims c
             LEFT JOIN cashback_offers o ON o.id = c.offer_id
             WHERE c.id = $1::uuid LIMIT 1`,
            [id],
        );
        return res.rows[0] ?? null;
    } catch (err) {
        console.error('[db-local-pg] localPgGetClaimWithOffer error:', err);
        return null;
    }
}

/** Met a jour un claim lors de la validation manuelle (validate | pay | reject). */
export async function localPgUpdateCashbackClaim(id: string, fields: {
    status?: string;
    amountCashback?: number | null;
    amountHoney?: number | null;
    validatedAt?: Date | null;
    paidAt?: Date | null;
    reviewNotes?: string | null;
}): Promise<boolean> {
    const pool = getPool();
    if (!pool) return false;
    const sets: string[] = [];
    const params: unknown[] = [id];
    const add = (col: string, val: unknown) => { params.push(val); sets.push(`${col}=$${params.length}`); };
    if (fields.status !== undefined)        add('status', fields.status);
    if (fields.amountCashback !== undefined) add('amount_cashback', fields.amountCashback);
    if (fields.amountHoney !== undefined)    add('amount_honey', fields.amountHoney);
    if (fields.validatedAt !== undefined)    add('validated_at', fields.validatedAt);
    if (fields.paidAt !== undefined)         add('paid_at', fields.paidAt);
    if (fields.reviewNotes !== undefined)    add('review_notes', fields.reviewNotes);
    if (sets.length === 0) return true;
    try {
        const res = await pool.query(
            `UPDATE cashback_claims SET ${sets.join(', ')} WHERE id=$1::uuid`,
            params,
        );
        return (res.rowCount ?? 0) > 0;
    } catch (err) {
        console.error('[db-local-pg] localPgUpdateCashbackClaim error:', err);
        return false;
    }
}

// ════════════════════════════════════════════════════════════════════════════
// OUTREACH ENGINE — cold B2B SMTP individuel throttle.
// Tables outreach_recipients / outreach_suppression / outreach_events.
// Voir migrations/2026-06-24_outreach_engine.sql + [[project_outreach_engine]].
// ════════════════════════════════════════════════════════════════════════════

// Pays servis en francais — DOIT rester aligne avec lib/outreach/lang.ts.
const OUTREACH_FR_COUNTRIES = ['FR', 'MC', 'CH', 'LU', 'BE', 'MQ', 'GP', 'GF', 'RE', 'NC', 'PF'];

export type OutreachRecipientRow = {
    id: string;
    entity_id: string | null;
    domain: string | null;
    email: string;
    display_name: string | null;
    sector_macro: string | null;
    country_legal: string | null;
    lang: string;
    asr_score: number | null;
    campaign: string;
    status: string;
    unsubscribe_token: string;
    kind: string;
};

/**
 * Importe des cibles depuis aya_registry dans la file outreach_recipients.
 * Filtre : email present + secteur dans la liste + pays non exclus + non supprime.
 * Deduplique par email (garde le meilleur score). ON CONFLICT DO NOTHING (idempotent).
 * Retourne le nombre de lignes REELLEMENT inserees.
 */
export async function localPgImportOutreachRecipients(opts: {
    sectors: string[];
    campaign: string;
    excludeCountries?: string[];
    minScore?: number | null;
    limit?: number;
}): Promise<{ inserted: number; error?: string }> {
    const pool = getPool();
    if (!pool) return { inserted: 0, error: 'pg_unconfigured' };

    const sectors = opts.sectors;
    const campaign = opts.campaign || 'default';
    const exclude = (opts.excludeCountries ?? []).map((c) => c.toUpperCase());
    const minScore = opts.minScore ?? null;
    const limit = Math.min(Math.max(opts.limit ?? 5000, 1), 100_000);

    const frList = OUTREACH_FR_COUNTRIES.map((c) => `'${c}'`).join(',');

    try {
        const res = await pool.query(
            `INSERT INTO outreach_recipients
                (entity_id, domain, email, display_name, sector_macro, country_legal, lang, asr_score, campaign, unsubscribe_token)
             (
               SELECT entity_id, domain, email, display_name, sector_macro, country_legal, lang, asr_score, campaign, token
               FROM (
                 SELECT DISTINCT ON (lower(r.contact_email))
                   r.entity_id AS entity_id,
                   regexp_replace(regexp_replace(lower(r.website), '^https?://(www\\.)?', '', 'g'), '/.*$', '', 'g') AS domain,
                   lower(r.contact_email) AS email,
                   r.display_name AS display_name,
                   r.sector_macro AS sector_macro,
                   r.country_legal AS country_legal,
                   CASE WHEN upper(coalesce(r.country_legal,'')) IN (${frList}) THEN 'fr' ELSE 'en' END AS lang,
                   r.asr_score AS asr_score,
                   $1::text AS campaign,
                   gen_random_uuid()::text AS token
                 FROM aya_registry r
                 LEFT JOIN outreach_suppression s ON s.email = lower(r.contact_email)
                 WHERE r.contact_email IS NOT NULL
                   AND position('@' in r.contact_email) > 1
                   AND r.contact_email !~* '(@pec\\.|legalmail|postecert|pecimprese|@cert\\.)'
                   AND r.contact_email !~* '\\.apix\\.fi'
                   AND r.contact_email !~* '\\.netvisor\\.fi'
                   AND r.contact_email !~* 'procountor'
                   AND r.contact_email !~* 'posrednik'
                   AND lower(split_part(r.contact_email,'@',2)) <> 'domain.com'
                   AND lower(split_part(r.contact_email,'@',2)) !~ '^(gmail|yahoo|ymail|hotmail|outlook|live|msn|libero|virgilio|aol|gmx|orange|wanadoo|free|laposte|sfr|t-online)\\.'
                   AND split_part(r.contact_email,'@',1) !~ '^[0-9]{5,}'
                   AND split_part(r.contact_email,'@',1) !~ '^[0-9]+$'
                   AND split_part(r.contact_email,'@',1) ~* '^[a-z0-9]'  -- pas de local-part malformé (tiret/point en tête = artefact de scraping)
                   AND length(split_part(r.contact_email,'@',1)) >= 3
                   AND lower(split_part(r.contact_email,'@',1)) !~ '^(copyright|legal|abuse|postmaster|webmaster|hostmaster|noreply|no-reply|donotreply|do-not-reply|mailer-daemon|privacy|dpo|compliance|gdpr|rgpd|spam|root|nobody|notification|notifications|newsletter|unsubscribe|marketing|press|presse|info|contact|sales|support|hello|mail|office|enquiry|enquiries|ventes|vente|kontakt|hi|team|service|reception|accueil|shop|boutique|booking|reservation|reservations)$'
                   AND r.sector_macro = ANY($2::text[])
                   AND s.email IS NULL
                   AND (cardinality($3::text[]) = 0 OR upper(coalesce(r.country_legal,'')) <> ALL($3::text[]))
                   AND ($4::numeric IS NULL OR r.asr_score >= $4::numeric)
                   AND coalesce(r.display_name,'') NOT ILIKE '%porn%'
                   AND coalesce(r.display_name,'') NOT ILIKE '%escort%'
                   AND coalesce(r.display_name,'') NOT ILIKE '%xxx%'
                   AND coalesce(r.display_name,'') NOT ILIKE '%onlyfans%'
                 ORDER BY lower(r.contact_email), r.asr_score DESC NULLS LAST
               ) q
               LIMIT $5
             )
             ON CONFLICT (lower(email), campaign) DO NOTHING`,
            [campaign, sectors, exclude, minScore, limit],
        );
        return { inserted: res.rowCount ?? 0 };
    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error('[db-local-pg] localPgImportOutreachRecipients error:', msg);
        return { inserted: 0, error: msg };
    }
}

/**
 * Apercu (lecture seule) des cibles potentielles, sans rien importer.
 * Sert a la BD (liste de candidats deal cashback) et a valider un ciblage.
 */
export async function localPgPreviewOutreachTargets(opts: {
    sectors: string[];
    excludeCountries?: string[];
    minScore?: number | null;
    limit?: number;
}): Promise<{ rows: Array<{ domain: string | null; display_name: string | null; sector_macro: string | null; country_legal: string | null; contact_email: string | null; asr_score: number | null }>; total_with_email: number }> {
    const pool = getPool();
    if (!pool) return { rows: [], total_with_email: 0 };

    const sectors = opts.sectors;
    const exclude = (opts.excludeCountries ?? []).map((c) => c.toUpperCase());
    const minScore = opts.minScore ?? null;
    const limit = Math.min(Math.max(opts.limit ?? 100, 1), 5000);

    const where = `
        r.contact_email IS NOT NULL
        AND position('@' in r.contact_email) > 1
                   AND r.contact_email !~* '(@pec\\.|legalmail|postecert|pecimprese|@cert\\.)'
                   AND r.contact_email !~* '\\.apix\\.fi'
                   AND r.contact_email !~* '\\.netvisor\\.fi'
                   AND r.contact_email !~* 'procountor'
                   AND r.contact_email !~* 'posrednik'
                   AND lower(split_part(r.contact_email,'@',2)) <> 'domain.com'
                   AND lower(split_part(r.contact_email,'@',2)) !~ '^(gmail|yahoo|ymail|hotmail|outlook|live|msn|libero|virgilio|aol|gmx|orange|wanadoo|free|laposte|sfr|t-online)\\.'
                   AND split_part(r.contact_email,'@',1) !~ '^[0-9]{5,}'
                   AND split_part(r.contact_email,'@',1) !~ '^[0-9]+$'
                   AND split_part(r.contact_email,'@',1) ~* '^[a-z0-9]'  -- pas de local-part malformé (tiret/point en tête = artefact de scraping)
                   AND length(split_part(r.contact_email,'@',1)) >= 3
                   AND lower(split_part(r.contact_email,'@',1)) !~ '^(copyright|legal|abuse|postmaster|webmaster|hostmaster|noreply|no-reply|donotreply|do-not-reply|mailer-daemon|privacy|dpo|compliance|gdpr|rgpd|spam|root|nobody|notification|notifications|newsletter|unsubscribe|marketing|press|presse|info|contact|sales|support|hello|mail|office|enquiry|enquiries|ventes|vente|kontakt|hi|team|service|reception|accueil|shop|boutique|booking|reservation|reservations)$'
        AND r.sector_macro = ANY($1::text[])
        AND (cardinality($2::text[]) = 0 OR upper(coalesce(r.country_legal,'')) <> ALL($2::text[]))
        AND ($3::numeric IS NULL OR r.asr_score >= $3::numeric)
        AND coalesce(r.display_name,'') NOT ILIKE '%porn%'
        AND coalesce(r.display_name,'') NOT ILIKE '%escort%'
        AND coalesce(r.display_name,'') NOT ILIKE '%xxx%'
        AND coalesce(r.display_name,'') NOT ILIKE '%onlyfans%'`;

    try {
        const countRes = await pool.query(
            `SELECT COUNT(DISTINCT lower(r.contact_email))::int AS cnt FROM aya_registry r WHERE ${where}`,
            [sectors, exclude, minScore],
        );
        const dataRes = await pool.query(
            `SELECT DISTINCT ON (lower(r.contact_email))
               regexp_replace(regexp_replace(lower(r.website), '^https?://(www\\.)?', '', 'g'), '/.*$', '', 'g') AS domain,
               r.display_name, r.sector_macro, r.country_legal, lower(r.contact_email) AS contact_email,
               r.asr_score::float8 AS asr_score
             FROM aya_registry r
             WHERE ${where}
             ORDER BY lower(r.contact_email), r.asr_score DESC NULLS LAST
             LIMIT $4`,
            [sectors, exclude, minScore, limit],
        );
        return { rows: dataRes.rows as any[], total_with_email: (countRes.rows[0]?.cnt as number) ?? 0 };
    } catch (err) {
        console.error('[db-local-pg] localPgPreviewOutreachTargets error:', err);
        return { rows: [], total_with_email: 0 };
    }
}

/** Prochaine fournee a envoyer : pending, non supprimes, pour une campagne. */
export async function localPgGetOutreachBatch(campaign: string, limit: number): Promise<OutreachRecipientRow[]> {
    const pool = getPool();
    if (!pool) return [];
    try {
        const res: QueryResult<OutreachRecipientRow> = await pool.query(
            `SELECT rec.id::text, rec.entity_id::text, rec.domain, rec.email, rec.display_name,
                    rec.sector_macro, rec.country_legal, rec.lang, rec.asr_score::float8 AS asr_score,
                    rec.campaign, rec.status, rec.unsubscribe_token, rec.kind
             FROM outreach_recipients rec
             LEFT JOIN outreach_suppression s ON s.email = lower(rec.email)
             WHERE rec.campaign = $1 AND rec.status = 'pending' AND s.email IS NULL
             ORDER BY rec.asr_score DESC NULLS LAST, rec.created_at ASC
             LIMIT $2`,
            [campaign, Math.min(Math.max(limit, 1), 1000)],
        );
        return res.rows;
    } catch (err) {
        console.error('[db-local-pg] localPgGetOutreachBatch error:', err);
        return [];
    }
}

export async function localPgMarkOutreachSent(id: string, messageId?: string | null): Promise<boolean> {
    const pool = getPool();
    if (!pool) return false;
    try {
        const res = await pool.query(
            `UPDATE outreach_recipients
             SET status='sent', message_id=$2, attempts=attempts+1, sent_at=NOW(), updated_at=NOW()
             WHERE id=$1::uuid`,
            [id, messageId ?? null],
        );
        return (res.rowCount ?? 0) > 0;
    } catch (err) {
        console.error('[db-local-pg] localPgMarkOutreachSent error:', err);
        return false;
    }
}

export async function localPgMarkOutreachFailed(id: string, error: string, status: 'failed' | 'bounced' = 'failed'): Promise<boolean> {
    const pool = getPool();
    if (!pool) return false;
    try {
        const res = await pool.query(
            `UPDATE outreach_recipients
             SET status=$3, error=$2, attempts=attempts+1, updated_at=NOW()
             WHERE id=$1::uuid`,
            [id, error.slice(0, 500), status],
        );
        return (res.rowCount ?? 0) > 0;
    } catch (err) {
        console.error('[db-local-pg] localPgMarkOutreachFailed error:', err);
        return false;
    }
}

export async function localPgAddOutreachSuppression(email: string, reason: string, source: string): Promise<boolean> {
    const pool = getPool();
    if (!pool) return false;
    try {
        await pool.query(
            `INSERT INTO outreach_suppression (email, reason, source)
             VALUES (lower($1), $2, $3)
             ON CONFLICT (email) DO NOTHING`,
            [email, reason, source],
        );
        return true;
    } catch (err) {
        console.error('[db-local-pg] localPgAddOutreachSuppression error:', err);
        return false;
    }
}

export async function localPgGetOutreachByToken(token: string): Promise<OutreachRecipientRow | null> {
    const pool = getPool();
    if (!pool) return null;
    try {
        const res: QueryResult<OutreachRecipientRow> = await pool.query(
            `SELECT id::text, entity_id::text, domain, email, display_name, sector_macro,
                    country_legal, lang, asr_score::float8 AS asr_score, campaign, status, unsubscribe_token
             FROM outreach_recipients WHERE unsubscribe_token = $1 LIMIT 1`,
            [token],
        );
        return res.rows[0] ?? null;
    } catch (err) {
        console.error('[db-local-pg] localPgGetOutreachByToken error:', err);
        return null;
    }
}

/** Desinscription via jeton : marque le destinataire + ajoute a la suppression globale. */
export async function localPgUnsubscribeOutreach(token: string, source: string): Promise<{ ok: boolean; email?: string }> {
    const pool = getPool();
    if (!pool) return { ok: false };
    try {
        const res = await pool.query(
            `UPDATE outreach_recipients SET status='unsubscribed', updated_at=NOW()
             WHERE unsubscribe_token=$1 RETURNING email`,
            [token],
        );
        const email: string | undefined = res.rows[0]?.email;
        if (!email) return { ok: false };
        await localPgAddOutreachSuppression(email, 'unsubscribe', source);
        await localPgInsertOutreachEvent({ email, type: 'unsubscribe', detail: { source } });
        return { ok: true, email };
    } catch (err) {
        console.error('[db-local-pg] localPgUnsubscribeOutreach error:', err);
        return { ok: false };
    }
}

export async function localPgInsertOutreachEvent(input: {
    recipientId?: string | null;
    email?: string | null;
    type: string;
    detail?: Record<string, unknown> | null;
}): Promise<void> {
    const pool = getPool();
    if (!pool) return;
    try {
        await pool.query(
            `INSERT INTO outreach_events (recipient_id, email, type, detail)
             VALUES ($1, $2, $3, $4::jsonb)`,
            [input.recipientId ?? null, input.email ?? null, input.type, JSON.stringify(input.detail ?? {})],
        );
    } catch (err) {
        console.error('[db-local-pg] localPgInsertOutreachEvent error:', err);
    }
}

/** Compteurs par statut + adressables restants + supprimes. */
export async function localPgOutreachStats(campaign?: string): Promise<{
    by_status: Record<string, number>;
    total: number;
    suppressed: number;
    campaigns: string[];
}> {
    const pool = getPool();
    if (!pool) return { by_status: {}, total: 0, suppressed: 0, campaigns: [] };
    try {
        const clause = campaign ? 'WHERE campaign = $1' : '';
        const params = campaign ? [campaign] : [];
        const statusRes = await pool.query(
            `SELECT status, COUNT(*)::int AS cnt FROM outreach_recipients ${clause} GROUP BY status`,
            params,
        );
        const by_status: Record<string, number> = {};
        let total = 0;
        for (const r of statusRes.rows as { status: string; cnt: number }[]) {
            by_status[r.status] = r.cnt;
            total += r.cnt;
        }
        const supRes = await pool.query(`SELECT COUNT(*)::int AS cnt FROM outreach_suppression`);
        const campRes = await pool.query(`SELECT DISTINCT campaign FROM outreach_recipients ORDER BY campaign`);
        return {
            by_status,
            total,
            suppressed: (supRes.rows[0]?.cnt as number) ?? 0,
            campaigns: (campRes.rows as { campaign: string }[]).map((r) => r.campaign),
        };
    } catch (err) {
        console.error('[db-local-pg] localPgOutreachStats error:', err);
        return { by_status: {}, total: 0, suppressed: 0, campaigns: [] };
    }
}

// ── PARTENAIRES CASHBACK (détection programme d'affiliation) ─────────────────

export type PartnerScanCandidate = {
    domain: string;
    entity_id: string | null;
    display_name: string | null;
    sector_macro: string | null;
    country_legal: string | null;
    contact_email: string | null;
    asr_score: number | null;
};

/** Domaines candidats à scanner (digital/SaaS/fintech/crypto, email présent) PAS encore scannés. */
export async function localPgGetPartnerScanCandidates(opts: {
    sectors: string[];
    excludeCountries?: string[];
    limit?: number;
}): Promise<PartnerScanCandidate[]> {
    const pool = getPool();
    if (!pool) return [];
    const exclude = (opts.excludeCountries ?? []).map((c) => c.toUpperCase());
    const limit = Math.min(Math.max(opts.limit ?? 25, 1), 200);
    try {
        const res = await pool.query(
            `SELECT DISTINCT ON (dom) dom AS domain, entity_id::text, display_name, sector_macro,
                    country_legal, contact_email, asr_score::float8 AS asr_score
             FROM (
               SELECT r.entity_id, r.display_name, r.sector_macro, r.country_legal, r.contact_email, r.asr_score,
                      regexp_replace(regexp_replace(lower(r.website), '^https?://(www\\.)?', '', 'g'), '/.*$', '', 'g') AS dom
               FROM aya_registry r
               WHERE r.contact_email IS NOT NULL AND position('@' in r.contact_email) > 1
                   AND r.contact_email !~* '(@pec\\.|legalmail|postecert|pecimprese|@cert\\.)'
                   AND r.contact_email !~* '\\.apix\\.fi'
                   AND r.contact_email !~* '\\.netvisor\\.fi'
                   AND r.contact_email !~* 'procountor'
                   AND r.contact_email !~* 'posrednik'
                   AND lower(split_part(r.contact_email,'@',2)) <> 'domain.com'
                   AND lower(split_part(r.contact_email,'@',2)) !~ '^(gmail|yahoo|ymail|hotmail|outlook|live|msn|libero|virgilio|aol|gmx|orange|wanadoo|free|laposte|sfr|t-online)\\.'
                   AND split_part(r.contact_email,'@',1) !~ '^[0-9]{5,}'
                   AND split_part(r.contact_email,'@',1) !~ '^[0-9]+$'
                   AND split_part(r.contact_email,'@',1) ~* '^[a-z0-9]'  -- pas de local-part malformé (tiret/point en tête = artefact de scraping)
                   AND length(split_part(r.contact_email,'@',1)) >= 3
                   AND lower(split_part(r.contact_email,'@',1)) !~ '^(copyright|legal|abuse|postmaster|webmaster|hostmaster|noreply|no-reply|donotreply|do-not-reply|mailer-daemon|privacy|dpo|compliance|gdpr|rgpd|spam|root|nobody|notification|notifications|newsletter|unsubscribe|marketing|press|presse|info|contact|sales|support|hello|mail|office|enquiry|enquiries|ventes|vente|kontakt|hi|team|service|reception|accueil|shop|boutique|booking|reservation|reservations)$'
                 AND r.sector_macro = ANY($1::text[])
                 AND (cardinality($2::text[]) = 0 OR upper(coalesce(r.country_legal,'')) <> ALL($2::text[]))
                 AND coalesce(r.website,'') <> ''
             ) q
             WHERE dom <> '' AND dom NOT IN (SELECT domain FROM partner_candidates)
             ORDER BY dom, asr_score DESC NULLS LAST
             LIMIT $3`,
            [opts.sectors, exclude, limit],
        );
        return res.rows as PartnerScanCandidate[];
    } catch (err) {
        console.error('[db-local-pg] localPgGetPartnerScanCandidates error:', err);
        return [];
    }
}

export async function localPgUpsertPartnerCandidate(row: {
    domain: string; entityId?: string | null; displayName?: string | null; sector?: string | null;
    country?: string | null; email?: string | null; asrScore?: number | null;
    hasAffiliate: boolean; affiliateUrl?: string | null; signals?: unknown;
}): Promise<void> {
    const pool = getPool();
    if (!pool) return;
    try {
        await pool.query(
            `INSERT INTO partner_candidates
                (domain, entity_id, display_name, sector_macro, country_legal, contact_email, asr_score, has_affiliate, affiliate_url, signals, scanned_at)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb, NOW())
             ON CONFLICT (domain) DO UPDATE SET
                has_affiliate=EXCLUDED.has_affiliate, affiliate_url=EXCLUDED.affiliate_url,
                signals=EXCLUDED.signals, scanned_at=NOW()`,
            [row.domain, row.entityId ?? null, row.displayName ?? null, row.sector ?? null, row.country ?? null,
             row.email ?? null, row.asrScore ?? null, row.hasAffiliate, row.affiliateUrl ?? null, JSON.stringify(row.signals ?? [])],
        );
    } catch (err) {
        console.error('[db-local-pg] localPgUpsertPartnerCandidate error:', err);
    }
}

/** Met un partenaire qualifié dans la file outreach (kind=partner) + marque queued. */
export async function localPgQueuePartnerRecipient(row: {
    domain: string; entityId?: string | null; email: string; displayName?: string | null;
    sector?: string | null; country?: string | null; lang: string; asrScore?: number | null; campaign: string;
}): Promise<boolean> {
    const pool = getPool();
    if (!pool) return false;
    try {
        // brand = 1er label du domaine (24mx.co.uk -> "24mx") ; ON CONFLICT non ciblé
        // dédupe sur l'email OU la marque (index partiel uq_outreach_partner_brand).
        const r = await pool.query(
            `INSERT INTO outreach_recipients
                (entity_id, domain, email, display_name, sector_macro, country_legal, lang, asr_score, campaign, kind, brand, unsubscribe_token)
             VALUES ($1,$2,lower($3),$4,$5,$6,$7,$8,$9,'partner',
                     split_part(regexp_replace(lower($2),'^www\\.',''),'.',1), gen_random_uuid()::text)
             ON CONFLICT DO NOTHING`,
            [row.entityId ?? null, row.domain, row.email, row.displayName ?? null, row.sector ?? null,
             row.country ?? null, row.lang, row.asrScore ?? null, row.campaign],
        );
        await pool.query(`UPDATE partner_candidates SET queued=true WHERE domain=$1`, [row.domain]);
        return (r.rowCount ?? 0) > 0;
    } catch (err) {
        console.error('[db-local-pg] localPgQueuePartnerRecipient error:', err);
        return false;
    }
}

/** Shortlist BD : candidats partenaires (par défaut ceux avec affiliation détectée). */
export async function localPgListPartnerCandidates(opts: { onlyAffiliate?: boolean; limit?: number } = {}): Promise<{
    rows: Array<{ domain: string; display_name: string | null; sector_macro: string | null; country_legal: string | null; contact_email: string | null; asr_score: number | null; has_affiliate: boolean; affiliate_url: string | null; queued: boolean }>;
    affiliate_count: number;
    scanned_count: number;
}> {
    const pool = getPool();
    if (!pool) return { rows: [], affiliate_count: 0, scanned_count: 0 };
    try {
        const where = opts.onlyAffiliate ? 'WHERE has_affiliate = true' : '';
        // Dédup par MARQUE (1 ligne par brand : 24mx.* -> 1 seule entrée).
        const dataRes = await pool.query(
            `SELECT domain, display_name, sector_macro, country_legal, contact_email,
                    asr_score, has_affiliate, affiliate_url, queued
             FROM (
               SELECT DISTINCT ON (split_part(regexp_replace(lower(domain),'^www\\.',''),'.',1))
                      domain, display_name, sector_macro, country_legal, contact_email,
                      asr_score::float8 AS asr_score, has_affiliate, affiliate_url, queued
               FROM partner_candidates ${where}
               ORDER BY split_part(regexp_replace(lower(domain),'^www\\.',''),'.',1), has_affiliate DESC, asr_score DESC NULLS LAST
             ) q
             ORDER BY has_affiliate DESC, asr_score DESC NULLS LAST
             LIMIT $1`,
            [Math.min(Math.max(opts.limit ?? 100, 1), 1000)],
        );
        // Comptes dédupés par marque.
        const c = await pool.query(
            `SELECT count(DISTINCT brand) FILTER (WHERE has_affiliate)::int AS aff,
                    count(DISTINCT brand)::int AS tot
             FROM (SELECT split_part(regexp_replace(lower(domain),'^www\\.',''),'.',1) AS brand, has_affiliate
                   FROM partner_candidates) x`,
        );
        return {
            rows: dataRes.rows as any[],
            affiliate_count: (c.rows[0]?.aff as number) ?? 0,
            scanned_count: (c.rows[0]?.tot as number) ?? 0,
        };
    } catch (err) {
        console.error('[db-local-pg] localPgListPartnerCandidates error:', err);
        return { rows: [], affiliate_count: 0, scanned_count: 0 };
    }
}
