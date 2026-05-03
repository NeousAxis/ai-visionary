/**
 * db-local-pg.ts
 *
 * Postgres client for the VPS local database (aya_local).
 * Only active when VPS_PG_PASSWORD is set in the environment.
 * Safe to import on Vercel — every helper returns empty results when unconfigured.
 */

import { Pool, QueryResult } from 'pg';

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
    asr_payload, recommendability
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

    let orderBy = 'created_at DESC';
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
        scores: { average: 0, min: 0, max: 0, median: 0 },
        sectors: [],
        countries: [],
    };
    const pool = getPool();
    if (!pool) return empty;

    try {
        const [totalRes, scoreRes, sectorRes, countryRes] = await Promise.all([
            pool.query<{ cnt: string }>(
                `SELECT COUNT(*) AS cnt FROM aya_registry`
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

        return {
            total: parseInt(totalRes.rows[0]?.cnt ?? '0', 10),
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
 * Filtres : score <= 50, payment_completed = false, contact_email present,
 *           website dans la liste de domaines connus passee en argument,
 *           asr_payload.enrichment.gemini_description present.
 */
export async function linkedinSelectCandidates(opts: {
    knownDomains: string[];
    excludeEntityIds: string[];
    limit: number;
}): Promise<Entity[]> {
    const pool = getPool();
    if (!pool) return [];
    if (opts.knownDomains.length === 0) return [];

    try {
        // On utilise un ANY array pour matcher les domaines (insensible a la casse via lower)
        const params: unknown[] = [opts.knownDomains, opts.limit];
        const excludeClause = opts.excludeEntityIds.length > 0
            ? `AND entity_id::text != ALL($${params.length + 1})`
            : '';
        if (opts.excludeEntityIds.length > 0) params.push(opts.excludeEntityIds);

        const res: QueryResult<Entity> = await pool.query(
            `SELECT ${ENTITY_COLS}
             FROM aya_registry
             WHERE asr_score <= 50
               AND COALESCE(payment_completed, false) = false
               AND contact_email IS NOT NULL
               AND lower(
                     regexp_replace(
                       regexp_replace(COALESCE(website, ''), '^https?://(www\\.)?', ''),
                       '/.*$', ''
                     )
                   ) = ANY($1)
               ${excludeClause}
             ORDER BY RANDOM()
             LIMIT $2`,
            params
        );
        return res.rows;
    } catch (err) {
        console.error('[db-local-pg] linkedinSelectCandidates error:', err);
        return [];
    }
}
