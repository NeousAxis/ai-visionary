import { createClient } from '@supabase/supabase-js';
import { localPgGetEntityById as _localPgGetEntityById } from '@/lib/db-local-pg';
import { resolveSectorMacro } from '@/lib/aya/llm-format';

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

// Check if Supabase is configured (must be checked before any DB operation)
const isSupabaseConfigured = (): boolean => {
    return !!(supabaseUrl && supabaseKey);
};

// Lazy-init: only create client if configured (prevents crash at build time)
// Using 'any' type to avoid Supabase generics issues with untyped tables
let _supabaseClient: any = null;
const getSupabase = (): any => {
    if (!_supabaseClient) {
        if (!isSupabaseConfigured()) {
            console.warn('⚠️ Supabase not configured — SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY required');
            return null;
        }
        _supabaseClient = createClient(supabaseUrl, supabaseKey);
    }
    return _supabaseClient;
};

// Export for modules that need direct access (admin/logs, debug/clean)
export const supabase = isSupabaseConfigured() ? createClient(supabaseUrl, supabaseKey) : null as any;

// Type definition for analysis records
type AnalysisRecord = {
    id: string;
    url: string;
    email: string | null;
    score: number;
    data: any;
    timestamp: string;
};

export const database = {
    /**
     * Save or update an analysis record
     */
    saveAnalysis: async (id: string, record: Partial<AnalysisRecord>): Promise<void> => {
        if (!isSupabaseConfigured()) {
            console.log(`⚠️ DB Disabled: Skipping save for ID ${id}`);
            return;
        }

        const client = getSupabase();
        if (!client) {
            console.error('❌ [Supabase] Client not available for saveAnalysis');
            return;
        }

        try {
            // 🔥 MERGE STRATEGY: Read existing record first to avoid overwriting enriched data
            // Bug fix: partial saves (e.g. email-only) were overwriting score/data with defaults
            let existing: Partial<AnalysisRecord> = {};
            const { data: existingRow, error: readErr } = await client
                .from('analyses')
                .select('*')
                .eq('id', id)
                .maybeSingle();

            if (!readErr && existingRow) {
                existing = existingRow as AnalysisRecord;
                console.log(`🔄 [Supabase] Merging into existing record: id=${id}, existing score=${existing.score}`);
            }

            // Build merged record: existing values are preserved unless explicitly overridden
            const dataToSave: any = {
                id,
                url: record.url ?? existing.url ?? null,
                email: record.email !== undefined ? record.email : (existing.email ?? null),
                score: record.score !== undefined ? record.score : (existing.score ?? 0),
                data: record.data !== undefined ? record.data : (existing.data ?? {}),
                updated_at: new Date().toISOString(),
            };

            // Only set created_at for NEW records (don't overwrite on update)
            if (!existingRow) {
                dataToSave.created_at = new Date().toISOString();
            }

            // Deep merge for data field: if both existing and new have data, merge fields
            if (record.data && existing.data && typeof record.data === 'object' && typeof existing.data === 'object') {
                dataToSave.data = {
                    ...existing.data,
                    ...record.data,
                    // Deep merge 'fields' if both exist
                    fields: {
                        ...(existing.data.fields || {}),
                        ...(record.data.fields || {}),
                    },
                };
            }

            const { error } = await client
                .from('analyses')
                .upsert(dataToSave, { onConflict: 'id' });

            if (error) {
                console.error('❌ [Supabase] Save Error:', error);
                return;
            }
            console.log(`💾 [Supabase] Analysis saved for ID: ${id} (score=${dataToSave.score}, hasData=${!!dataToSave.data?.fields})`);
        } catch (error) {
            console.error('❌ [Supabase] Save Error:', error);
        }
    },

    /**
     * Retrieve an analysis record by ID
     */
    getAnalysis: async (id: string): Promise<AnalysisRecord | null> => {
        if (!isSupabaseConfigured()) return null;
        const client = getSupabase();
        if (!client) return null;

        try {
            const { data, error } = await client
                .from('analyses')
                .select('*')
                .eq('id', id)
                .single();

            if (error) {
                if (error.code === 'PGRST116') {
                    // No rows returned
                    console.warn(`⚠️ [Supabase] No analysis found for ID: ${id}`);
                    return null;
                }
                console.error('❌ [Supabase] Read Error:', error);
                return null;
            }

            console.log(`✅ [Supabase] Analysis retrieved for ID: ${id}`);
            return data as AnalysisRecord;
        } catch (error) {
            console.error('❌ [Supabase] Read Error:', error);
            return null;
        }
    },

    /**
     * Normalize URL for consistent matching
     */
    normalizeUrl: (url: string): string => {
        try {
            let normalized = url.toLowerCase().trim();
            // Remove protocol
            normalized = normalized.replace(/^https?:\/\//, '');
            // Remove www
            normalized = normalized.replace(/^www\./, '');
            // Remove trailing slash
            normalized = normalized.replace(/\/$/, '');
            return normalized;
        } catch (_e) {
            return url.toLowerCase().trim();
        }
    },

    /**
     * Retrieve the latest analysis for a given URL
     * Uses url_normalized GENERATED column for matching
     */
    getLatestAnalysisByUrl: async (url: string): Promise<AnalysisRecord | null> => {
        if (!isSupabaseConfigured()) return null;
        const client = getSupabase();
        if (!client) return null;

        try {
            const normalizedUrl = database.normalizeUrl(url);

            // Query by normalized URL, order by score DESC to get the best result
            const { data: rawData, error } = await client
                .from('analyses')
                .select('*')
                .eq('url_normalized', normalizedUrl)
                .order('created_at', { ascending: false })
                .limit(10);

            if (error) {
                console.error('❌ [Supabase] Query By URL Error:', error);
                return null;
            }

            const data = rawData as any[];
            if (!data || data.length === 0) {
                console.log(`⚠️ [Supabase] No analysis found for URL: ${url}`);
                return null;
            }

            // Pick the best result: prefer entries WITH block scores, then highest score
            let bestResult: AnalysisRecord | null = null;
            let bestHasBlocks = false;
            for (const row of data) {
                const hasData = row.data?.fields && Object.keys(row.data.fields).some((k: string) => row.data.fields[k] && Object.keys(row.data.fields[k]).length > 0);
                const hasBlocks = row.data?.blocks && Object.keys(row.data.blocks).length > 0;
                const score = row.score || 0;

                if (!hasData) continue;
                // Prefer analysis with blocks over one without, regardless of score
                if (hasBlocks && !bestHasBlocks) {
                    bestResult = row as AnalysisRecord;
                    bestHasBlocks = true;
                    console.log(`🔍 [Supabase] Analysis with blocks found: score=${score}, id=${row.id}`);
                } else if (hasBlocks === bestHasBlocks && score > (bestResult?.score || 0)) {
                    bestResult = row as AnalysisRecord;
                    bestHasBlocks = hasBlocks;
                    console.log(`🔍 [Supabase] Better analysis found: score=${score}, id=${row.id}`);
                }
            }

            if (bestResult) {
                console.log(`✅ [Supabase] Best analysis for URL ${url}: score=${bestResult.score}, id=${bestResult.id}`);
                return bestResult;
            }

            console.log(`⚠️ [Supabase] No analysis with data found for URL: ${url}`);
            return null;
        } catch (error) {
            console.error('❌ [Supabase] Query By URL Error:', error);
            return null;
        }
    },

    getAnalysesHistoryByUrl: async (url: string, limit = 5): Promise<any[]> => {
        if (!isSupabaseConfigured()) return [];
        const client = getSupabase();
        if (!client) return [];

        try {
            const normalizedUrl = database.normalizeUrl(url);
            const { data, error } = await client
                .from('analyses')
                .select('id, url, score, data, created_at')
                .eq('url_normalized', normalizedUrl)
                .order('created_at', { ascending: false })
                .limit(limit);

            if (error) {
                console.error('❌ [Supabase] Analyses history error:', error);
                return [];
            }
            return data || [];
        } catch (err) {
            console.error('❌ [Supabase] Analyses history exception:', err);
            return [];
        }
    },

    /**
     * Retrieve the latest analysis for a given EMAIL
     */
    getLatestAnalysisByEmail: async (email: string): Promise<AnalysisRecord | null> => {
        if (!isSupabaseConfigured()) return null;
        const client = getSupabase();
        if (!client) return null;

        try {
            const { data: rawData, error } = await client
                .from('analyses')
                .select('*')
                .eq('email', email)
                .order('created_at', { ascending: false })
                .limit(10);

            if (error) {
                console.error('❌ [Supabase] Query By EMAIL Error:', error);
                return null;
            }

            const data = rawData as any[];
            if (!data || data.length === 0) {
                console.log(`⚠️ [Supabase] No analysis found for EMAIL: ${email}`);
                return null;
            }

            // Pick the doc with the HIGHEST score that has data
            let bestResult: AnalysisRecord | null = null;
            for (const row of data) {
                const hasData = row.data?.fields && Object.keys(row.data.fields).some((k: string) => row.data.fields[k] && Object.keys(row.data.fields[k]).length > 0);
                const score = row.score || 0;
                if (hasData && score > (bestResult?.score || 0)) {
                    bestResult = row as AnalysisRecord;
                }
            }

            if (bestResult) {
                console.log(`✅ [Supabase] Best analysis for EMAIL ${email}: score=${bestResult.score}, id=${bestResult.id}`);
                return bestResult;
            }

            // Fallback: return the most recent one
            return data[0] as AnalysisRecord;
        } catch (error) {
            console.error('❌ [Supabase] Query By EMAIL Error:', error);
            return null;
        }
    },

    /**
     * Update an AYA entity's recommendability data
     */
    updateEntityRecommendability: async (entityId: string, data: any): Promise<void> => {
        if (!isSupabaseConfigured()) {
            console.log(`⚠️ DB Disabled: Skipping AYA update for ${entityId}`);
            return;
        }
        const client = getSupabase();
        if (!client) return;
        try {
            // Remove aya_entity_id from data (TypeScript schema uses aya_entity_id but Supabase column is entity_id)
            const { aya_entity_id: _drop, ...cleanData } = data as any;
            const { error } = await client
                .from('aya_registry')
                .upsert({ entity_id: entityId, ...cleanData }, { onConflict: 'entity_id' });

            if (error) {
                console.error('❌ [Supabase] AYA Update Error:', error);
                return;
            }
            console.log(`💾 [Supabase] AYA Entity updated: ${entityId}`);
        } catch (error) {
            console.error('❌ [Supabase] AYA Update Error:', error);
        }
    },

    /**
     * Update an existing AYA entity's data fields using .update() (NOT .upsert())
     * Safe: will NOT create a new row if entity_id doesn't exist.
     */
    updateEntityData: async (entityId: string, data: Record<string, any>): Promise<boolean> => {
        if (!isSupabaseConfigured()) {
            console.log(`⚠️ DB Disabled: Skipping AYA update for ${entityId}`);
            return false;
        }
        const client = getSupabase();
        if (!client) return false;
        try {
            const { aya_entity_id: _drop, ...cleanData } = data as any;
            const { error } = await client
                .from('aya_registry')
                .update(cleanData)
                .eq('entity_id', entityId);

            if (error) {
                console.error('❌ [Supabase] AYA updateEntityData Error:', error);
                return false;
            }
            console.log(`💾 [Supabase] AYA Entity data updated (safe): ${entityId}`);
            return true;
        } catch (error) {
            console.error('❌ [Supabase] AYA updateEntityData Error:', error);
            return false;
        }
    },

    /**
     * Get all entities from AYA Registry (certified + indexed)
     * Sorted: payment_completed=true first, then by score DESC
     */
    getAyaEntities: async (limit: number = 10000): Promise<any[]> => {
        if (!isSupabaseConfigured()) return [];
        const client = getSupabase();
        if (!client) return [];

        try {
            // Supabase limits to 1000 rows per query — paginate to get all
            const allData: any[] = [];
            const pageSize = 1000;
            let offset = 0;

            while (offset < limit) {
                const { data, error } = await client
                    .from('aya_registry')
                    .select('*')
                    .order('created_at', { ascending: false })
                    .range(offset, offset + pageSize - 1);

                if (error) {
                    console.error('❌ [Supabase] Get AYA Entities Error:', error);
                    break;
                }

                if (!data || data.length === 0) break;
                allData.push(...data);
                if (data.length < pageSize) break; // Last page
                offset += pageSize;
            }

            return allData;
        } catch (error) {
            console.error('❌ [Supabase] Get AYA Entities Error:', error);
            return [];
        }
    },

    /**
     * Get bot-indexed entities eligible for V2 re-scoring.
     * Filters: payment_completed != true, website not null, ordered by entity_id ASC.
     */
    getEntitiesForRescore: async (limit: number = 10, offset: number = 0): Promise<any[]> => {
        if (!isSupabaseConfigured()) return [];
        const client = getSupabase();
        if (!client) return [];
        try {
            const { data, error } = await client
                .from('aya_registry')
                .select('entity_id, display_name, legal_name, website, asr_score, payment_completed, asr_payload, created_at')
                .or('payment_completed.is.null,payment_completed.eq.false')
                .not('website', 'is', null)
                .order('entity_id', { ascending: true })
                .range(offset, offset + limit - 1);
            if (error) { console.error('❌ [Supabase] getEntitiesForRescore Error:', error); return []; }
            return data || [];
        } catch (error) { console.error('❌ [Supabase] getEntitiesForRescore Error:', error); return []; }
    },

    /**
     * Count bot-indexed entities eligible for V2 re-scoring.
     */
    countEntitiesForRescore: async (): Promise<{ total: number; rescored: number }> => {
        if (!isSupabaseConfigured()) return { total: 0, rescored: 0 };
        const client = getSupabase();
        if (!client) return { total: 0, rescored: 0 };
        try {
            const { count: total, error } = await client
                .from('aya_registry')
                .select('entity_id', { count: 'exact', head: true })
                .or('payment_completed.is.null,payment_completed.eq.false')
                .not('website', 'is', null);
            if (error) { console.error('❌ [Supabase] countEntitiesForRescore Error:', error); return { total: 0, rescored: 0 }; }
            // Count rescored by checking for rescore_v2 marker — Supabase JSONB filter
            const { count: rescored, error: e2 } = await client
                .from('aya_registry')
                .select('entity_id', { count: 'exact', head: true })
                .or('payment_completed.is.null,payment_completed.eq.false')
                .not('website', 'is', null)
                .not('asr_payload->rescore_v2->scored_at', 'is', null);
            if (e2) { return { total: total || 0, rescored: 0 }; }
            return { total: total || 0, rescored: rescored || 0 };
        } catch (error) { console.error('❌ [Supabase] countEntitiesForRescore Error:', error); return { total: 0, rescored: 0 }; }
    },

    /**
     * Retrieve an AYA Entity by its ID
     */
    /**
     * Get the email used during registration (from analyses table).
     * This is the OWNER's email, not the company contact email.
     */
    getRegistrationEmail: async (url: string): Promise<string | null> => {
        if (!isSupabaseConfigured()) return null;
        const client = getSupabase();
        if (!client) return null;
        try {
            const normalized = url.replace(/\/+$/, '').toLowerCase();
            const { data } = await client
                .from('analyses')
                .select('email')
                .or(`url.ilike.%${normalized.replace(/^https?:\/\/(www\.)?/, '')}%`)
                .not('email', 'is', null)
                .order('created_at', { ascending: false })
                .limit(1)
                .single();
            return data?.email || null;
        } catch {
            return null;
        }
    },

    getAyaEntityById: async (id: string): Promise<any | null> => {
        if (!isSupabaseConfigured()) return null;
        const client = getSupabase();
        if (!client) return null;

        try {
            console.log(`🔍 [Supabase] Fetching AYA Entity ID: ${id}`);
            const { data, error } = await client
                .from('aya_registry')
                .select('*')
                .eq('entity_id', id)
                .single();

            if (error) {
                if (error.code === 'PGRST116') {
                    console.warn(`⚠️ [Supabase] Entity not found: ${id}`);
                    return null;
                }
                console.error('❌ [Supabase] Get Entity By ID Error:', error);
                return null;
            }

            return data;
        } catch (error) {
            console.error('❌ [Supabase] Get Entity By ID Error:', error);
            return null;
        }
    },

    /**
     * Retrieve an AYA Entity by its URL (Smart Search via normalized URL)
     */
    getAyaEntityByUrl: async (url: string): Promise<any | null> => {
        if (!isSupabaseConfigured()) return null;
        const client = getSupabase();
        if (!client) return null;

        try {
            const normalizedTarget = database.normalizeUrl(url);
            console.log(`🔍 [Supabase] Searching for AYA Entity with URL: ${normalizedTarget}`);

            // Single query using website_normalized GENERATED column
            const { data, error } = await client
                .from('aya_registry')
                .select('*')
                .eq('website_normalized', normalizedTarget)
                .limit(1)
                .single();

            if (error) {
                if (error.code === 'PGRST116') {
                    // No rows returned
                    return null;
                }
                console.error('❌ [Supabase] Query AYA By URL Error:', error);
                return null;
            }

            console.log(`✅ [Supabase] AYA Entity found by normalized URL.`);
            return data;
        } catch (error) {
            console.error('❌ [Supabase] Query AYA By URL Error:', error);
            return null;
        }
    },

    /**
     * Retrieve an AYA Entity by contact_email (for renew webhook fallback)
     */
    getAyaEntityByContactEmail: async (email: string): Promise<any | null> => {
        if (!isSupabaseConfigured()) return null;
        const client = getSupabase();
        if (!client) return null;
        try {
            const { data, error } = await client
                .from('aya_registry')
                .select('*')
                .eq('contact_email', email)
                .eq('payment_completed', true)
                .order('created_at', { ascending: false })
                .limit(1)
                .single();
            if (error) return null;
            return data;
        } catch {
            return null;
        }
    },

    /**
     * Update the owner_email for an entity (delegation of access)
     */
    updateOwnerEmail: async (entityId: string, newOwnerEmail: string): Promise<boolean> => {
        if (!isSupabaseConfigured()) return false;
        const client = getSupabase();
        if (!client) return false;
        try {
            const { error } = await client
                .from('aya_registry')
                .update({ owner_email: newOwnerEmail.trim().toLowerCase() })
                .eq('entity_id', entityId);
            if (error) {
                console.error('❌ [Supabase] updateOwnerEmail Error:', error);
                return false;
            }
            console.log(`✅ [Supabase] owner_email updated for ${entityId}`);
            return true;
        } catch {
            return false;
        }
    },

    /**
     * OTP MANAGEMENT (One Time Password)
     */
    saveOTP: async (email: string, code: string): Promise<boolean> => {
        if (!isSupabaseConfigured()) { console.error('❌ [Supabase] OTP save: Supabase not configured'); return false; }
        const client = getSupabase();
        if (!client) { console.error('❌ [Supabase] OTP save: no client'); return false; }

        try {
            // Delete any existing OTP for this email first (one active per email)
            await client
                .from('otp_codes')
                .delete()
                .eq('email', email);

            const { error } = await client
                .from('otp_codes')
                .insert({
                    email,
                    code,
                    expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(), // 10 mins validity
                });

            if (error) {
                console.error('❌ [Supabase] OTP Save Error:', error);
                return false;
            }
            console.log(`🔐 [Supabase] OTP saved for ${email}`);
            return true;
        } catch (e) {
            console.error('❌ [Supabase] Error saving OTP:', e);
            return false;
        }
    },

    verifyOTP: async (email: string, code: string): Promise<boolean> => {
        if (!isSupabaseConfigured()) return false;
        const client = getSupabase();
        if (!client) return false;

        try {
            // Find the latest OTP for this email
            const { data, error } = await client
                .from('otp_codes')
                .select('*')
                .eq('email', email)
                .eq('used', false)
                .order('created_at', { ascending: false })
                .limit(1)
                .single();

            if (error || !data) {
                console.log(`❌ [Supabase] No OTP found for ${email}`);
                return false;
            }

            const now = new Date();
            const expires = new Date(data.expires_at);

            if (now > expires) {
                console.log(`❌ [Supabase] OTP expired for ${email}`);
                // Cleanup expired OTP
                await client.from('otp_codes').delete().eq('id', data.id);
                return false;
            }

            if (data.code === code) {
                console.log(`✅ [Supabase] OTP Validated for ${email}`);
                // Burn the code (One Time Use) — delete it
                await client.from('otp_codes').delete().eq('id', data.id);
                return true;
            }

            console.log(`❌ [Supabase] Invalid OTP for ${email}`);
            return false;
        } catch (e) {
            console.error('Error verifying OTP:', e);
            return false;
        }
    },

    /**
     * Save scan state for a URL
     */
    saveScanState: async (urlOrId: string, data: any): Promise<void> => {
        if (!isSupabaseConfigured()) {
            console.log(`⚠️ DB Disabled: Skipping scan state save for ${urlOrId}`);
            return;
        }
        const client = getSupabase();
        if (!client) return;

        try {
            const url = data.url || urlOrId;
            const normalizedUrl = database.normalizeUrl(url);

            // Delete any existing scan state for this URL, then insert fresh
            await client
                .from('scan_states')
                .delete()
                .eq('url_normalized', normalizedUrl);

            const { error } = await client
                .from('scan_states')
                .insert({
                    url,
                    state: data,
                });

            if (error) {
                console.error('❌ [Supabase] Scan State Save Error:', error);
                return;
            }
            console.log(`💾 [Supabase] Scan state saved for URL: ${url}`);
        } catch (error) {
            console.error('❌ [Supabase] Scan State Save Error:', error);
        }
    },

    /**
     * Get scan state by URL (normalized matching)
     */
    getScanState: async (url: string): Promise<any | null> => {
        if (!isSupabaseConfigured()) return null;
        const client = getSupabase();
        if (!client) return null;

        try {
            const normalizedUrl = database.normalizeUrl(url);

            const { data, error } = await client
                .from('scan_states')
                .select('*')
                .eq('url_normalized', normalizedUrl)
                .order('created_at', { ascending: false })
                .limit(1)
                .single();

            if (error) {
                if (error.code === 'PGRST116') return null;
                console.error('❌ [Supabase] Get Scan State Error:', error);
                return null;
            }

            return data?.state || null;
        } catch (error) {
            console.error('❌ [Supabase] Get Scan State Error:', error);
            return null;
        }
    },

    /**
     * Persist a structured log entry
     */
    logPersist: async (entry: {
        correlation_id: string;
        level: string;
        source: string;
        step: string;
        message: string;
        data?: any;
    }): Promise<void> => {
        if (!isSupabaseConfigured()) return;
        const client = getSupabase();
        if (!client) return;

        try {
            const { error } = await client
                .from('system_logs')
                .insert({
                    correlation_id: entry.correlation_id,
                    level: entry.level,
                    source: entry.source,
                    step: entry.step,
                    message: entry.message,
                    data: entry.data ?? null,
                });

            if (error) {
                console.error('❌ [Supabase] Log Persist Error:', error);
            }
        } catch (error) {
            console.error('❌ [Supabase] Log Persist Error:', error);
        }
    },

    /**
     * Get paginated entities from AYA Registry with server-side search, sort, and count
     * Used by the /aya page for server-side pagination (instead of loading ALL entities)
     */
    getAyaEntitiesPaginated: async (options: {
        page: number;
        pageSize: number;
        search?: string;
        sort?: 'default' | 'alpha' | 'score' | 'country' | 'certified';
    }): Promise<{ data: any[]; total: number; certifiedCount: number; indexedCount: number }> => {
        if (!isSupabaseConfigured()) return { data: [], total: 0, certifiedCount: 0, indexedCount: 0 };
        const client = getSupabase();
        if (!client) return { data: [], total: 0, certifiedCount: 0, indexedCount: 0 };

        const { page, pageSize, search, sort = 'default' } = options;

        try {
            // 1. Get total counts (always unfiltered for stats bar)
            const { count: totalCount, error: countErr } = await client
                .from('aya_registry')
                .select('*', { count: 'exact', head: true });

            const { count: certCount, error: certErr } = await client
                .from('aya_registry')
                .select('*', { count: 'exact', head: true })
                .eq('payment_completed', true);

            if (countErr || certErr) {
                console.error('❌ [Supabase] Count Error:', countErr || certErr);
            }

            const total = totalCount || 0;
            const certifiedCount = certCount || 0;
            const indexedCount = total - certifiedCount;

            // 2. Build filtered query for count
            let filteredTotal = total;
            if (search) {
                const q = `%${search}%`;
                const { count: filteredCount, error: filteredErr } = await client
                    .from('aya_registry')
                    .select('*', { count: 'exact', head: true })
                    .or(`display_name.ilike.${q},legal_name.ilike.${q},website.ilike.${q},sector_macro.ilike.${q},country_legal.ilike.${q}`);

                if (!filteredErr && filteredCount !== null) {
                    filteredTotal = filteredCount;
                }
            }

            // For 'certified' sort mode, only count certified entities
            if (sort === 'certified') {
                if (search) {
                    const q = `%${search}%`;
                    const { count: certFilteredCount } = await client
                        .from('aya_registry')
                        .select('*', { count: 'exact', head: true })
                        .eq('payment_completed', true)
                        .or(`display_name.ilike.${q},legal_name.ilike.${q},website.ilike.${q},sector_macro.ilike.${q},country_legal.ilike.${q}`);
                    filteredTotal = certFilteredCount || 0;
                } else {
                    filteredTotal = certifiedCount;
                }
            }

            // 3. Build paginated data query
            const offset = (page - 1) * pageSize;
            let query = client
                .from('aya_registry')
                .select('entity_id, display_name, legal_name, website, sector_macro, country_legal, entity_type, asr_score, payment_completed, created_at, asr_payload');

            // Apply search filter
            if (search) {
                const q = `%${search}%`;
                query = query.or(`display_name.ilike.${q},legal_name.ilike.${q},website.ilike.${q},sector_macro.ilike.${q},country_legal.ilike.${q}`);
            }

            // Apply certified filter
            if (sort === 'certified') {
                query = query.eq('payment_completed', true);
            }

            // Exclude NSFW and garbage entries
            query = query
                .not('display_name', 'ilike', '%porn%')
                .not('display_name', 'ilike', '% sex %')
                .not('display_name', 'ilike', '%xxx%')
                .not('display_name', 'ilike', '%escort%')
                .not('display_name', 'ilike', '%onlyfans%')
                .not('display_name', 'ilike', "['%")   // Python lists
                .not('display_name', 'ilike', '{{%');  // Template artifacts

            // Apply sort order
            if (sort === 'alpha') {
                query = query.order('display_name', { ascending: true, nullsFirst: false });
            } else if (sort === 'score') {
                query = query.order('asr_score', { ascending: false, nullsFirst: false });
            } else if (sort === 'country') {
                query = query.order('country_legal', { ascending: true, nullsFirst: false });
            } else {
                // 'default': newest first (dynamic feel). 'certified': certified only (filtered above)
                query = query.order('created_at', { ascending: false });
            }

            // Apply pagination
            query = query.range(offset, offset + pageSize - 1);

            const { data, error } = await query;

            if (error) {
                console.error('❌ [Supabase] Paginated Query Error:', error);
                return { data: [], total: filteredTotal, certifiedCount, indexedCount };
            }

            return {
                data: data || [],
                total: filteredTotal,
                certifiedCount,
                indexedCount,
            };
        } catch (error) {
            console.error('❌ [Supabase] Paginated Query Error:', error);
            return { data: [], total: 0, certifiedCount: 0, indexedCount: 0 };
        }
    },

    /**
     * Get entities filtered by sector_macro or country_legal (server-side filter, paginated).
     * Used for /aya/sector/[macro] and /aya/country/[code] landing pages.
     */
    getAyaEntitiesByFilter: async (options: {
        sector?: string;
        country?: string;
        limit?: number;
        offset?: number;
    }): Promise<{ data: any[]; total: number }> => {
        if (!isSupabaseConfigured()) return { data: [], total: 0 };
        const client = getSupabase();
        if (!client) return { data: [], total: 0 };

        const { sector, country, limit = 100, offset = 0 } = options;

        try {
            let countQuery = client.from('aya_registry').select('*', { count: 'exact', head: true });
            if (sector) countQuery = countQuery.eq('sector_macro', sector);
            if (country) countQuery = countQuery.eq('country_legal', country.toUpperCase());
            const { count: total } = await countQuery;

            let query = client
                .from('aya_registry')
                .select('entity_id, display_name, legal_name, website, sector_macro, country_legal, entity_type, asr_score, payment_completed, asr_payload')
                .not('display_name', 'ilike', '%porn%')
                .not('display_name', 'ilike', '%xxx%')
                .not('display_name', 'ilike', '%escort%')
                .not('display_name', 'ilike', '%onlyfans%')
                .not('display_name', 'ilike', "['%")
                .not('display_name', 'ilike', '{{%');

            if (sector) query = query.eq('sector_macro', sector);
            if (country) query = query.eq('country_legal', country.toUpperCase());

            query = query.order('asr_score', { ascending: false, nullsFirst: false }).range(offset, offset + limit - 1);

            const { data, error } = await query;
            if (error) {
                console.error('❌ [Supabase] getAyaEntitiesByFilter Error:', error);
                return { data: [], total: 0 };
            }

            return { data: data || [], total: total || 0 };
        } catch (error) {
            console.error('❌ [Supabase] getAyaEntitiesByFilter Error:', error);
            return { data: [], total: 0 };
        }
    },

    /**
     * List distinct sector_macro values with their entity count. Used for sitemap + index pages.
     */
    getAyaSectors: async (): Promise<{ sector: string; count: number }[]> => {
        if (!isSupabaseConfigured()) return [];
        const client = getSupabase();
        if (!client) return [];

        try {
            const { data, error } = await client
                .from('aya_registry')
                .select('sector_macro')
                .not('sector_macro', 'is', null);
            if (error) return [];
            const counts: Record<string, number> = {};
            for (const row of data || []) {
                const s = (row as any).sector_macro;
                if (!s) continue;
                counts[s] = (counts[s] || 0) + 1;
            }
            return Object.entries(counts)
                .filter(([, c]) => c >= 2)
                .sort((a, b) => b[1] - a[1])
                .map(([sector, count]) => ({ sector, count }));
        } catch {
            return [];
        }
    },

    /**
     * List distinct country_legal values with their entity count. Used for sitemap + index pages.
     */
    getAyaCountries: async (): Promise<{ country: string; count: number }[]> => {
        if (!isSupabaseConfigured()) return [];
        const client = getSupabase();
        if (!client) return [];

        try {
            const { data, error } = await client
                .from('aya_registry')
                .select('country_legal')
                .not('country_legal', 'is', null)
                .neq('country_legal', '')
                .neq('country_legal', 'XX');
            if (error) return [];
            const counts: Record<string, number> = {};
            for (const row of data || []) {
                const c = ((row as any).country_legal || '').toUpperCase();
                if (!c || c === 'XX') continue;
                counts[c] = (counts[c] || 0) + 1;
            }
            return Object.entries(counts)
                .filter(([, c]) => c >= 2)
                .sort((a, b) => b[1] - a[1])
                .map(([country, count]) => ({ country, count }));
        } catch {
            return [];
        }
    },

    /**
     * List non-empty (sector_macro, country_legal) combinations. Used for sitemap cross-pages.
     * Returns only pairs where at least 1 entity has both fields set and asr_score >= 20.
     */
    getAyaSectorCountryCombinations: async (): Promise<{ sector: string; country: string; count: number }[]> => {
        if (!isSupabaseConfigured()) return [];
        const client = getSupabase();
        if (!client) return [];

        try {
            // Fetch minimal fields — Supabase doesn't support GROUP BY in the JS client,
            // so we pull the two columns and count client-side. Cap at 50 000 rows which
            // covers the full Supabase AYA registry comfortably.
            const { data, error } = await client
                .from('aya_registry')
                .select('sector_macro, country_legal')
                .not('sector_macro', 'is', null)
                .not('country_legal', 'is', null)
                .neq('country_legal', '')
                .neq('country_legal', 'XX')
                .gte('asr_score', 20);

            if (error) {
                console.error('❌ [Supabase] getAyaSectorCountryCombinations Error:', error);
                return [];
            }

            const counts: Record<string, number> = {};
            for (const row of data || []) {
                const s = (row as any).sector_macro;
                const c = ((row as any).country_legal || '').toUpperCase();
                if (!s || !c || c === 'XX') continue;
                const key = `${s}||${c}`;
                counts[key] = (counts[key] || 0) + 1;
            }

            return Object.entries(counts)
                .filter(([, n]) => n >= 1)
                .sort((a, b) => b[1] - a[1])
                .map(([key, count]) => {
                    const [sector, country] = key.split('||');
                    return { sector, country, count };
                });
        } catch {
            return [];
        }
    },

    // ========================================================================
    // LIFECYCLE MANAGEMENT — Expiry, reviews, subscriptions
    // ========================================================================

    /**
     * Get entities expiring within N days (payment_completed=true, valid_until approaching)
     */
    getExpiringEntities: async (daysUntilExpiry: number): Promise<any[]> => {
        if (!isSupabaseConfigured()) return [];
        const client = getSupabase();
        if (!client) return [];

        try {
            const now = new Date().toISOString();
            const futureDate = new Date(Date.now() + daysUntilExpiry * 24 * 60 * 60 * 1000).toISOString();

            const { data, error } = await client
                .from('aya_registry')
                .select('*')
                .eq('payment_completed', true)
                .not('valid_until', 'is', null)
                .gte('valid_until', now)
                .lte('valid_until', futureDate)
                .order('valid_until', { ascending: true });

            if (error) {
                console.error('❌ [Supabase] getExpiringEntities Error:', error);
                return [];
            }

            return data || [];
        } catch (error) {
            console.error('❌ [Supabase] getExpiringEntities Error:', error);
            return [];
        }
    },

    /**
     * Get entities needing annual review (next_review_due <= now, reminder not yet sent)
     * Only certified entities (payment_completed = true)
     */
    getEntitiesNeedingReview: async (): Promise<any[]> => {
        if (!isSupabaseConfigured()) return [];
        const client = getSupabase();
        if (!client) return [];

        try {
            const now = new Date().toISOString();

            const { data, error } = await client
                .from('aya_registry')
                .select('*')
                .eq('payment_completed', true)
                .lte('next_review_due', now)
                .or('renewal_reminder_sent.is.null,renewal_reminder_sent.eq.false')
                .order('next_review_due', { ascending: true });

            if (error) {
                console.error('❌ [Supabase] getEntitiesNeedingReview Error:', error);
                return [];
            }

            return data || [];
        } catch (error) {
            console.error('❌ [Supabase] getEntitiesNeedingReview Error:', error);
            return [];
        }
    },

    /**
     * Update lifecycle fields on an AYA entity
     */
    updateEntityLifecycle: async (
        entityId: string,
        fields: Partial<{
            pack_type: string;
            subscription_id: string;
            subscription_status: string;
            next_review_due: string;
            renewal_reminder_sent: boolean;
            renewal_reminder_sent_at: string;
            valid_until: string;
            payment_completed: boolean;
            aya_status: string;
            contact_email: string;
            expiry_reminder_7d_sent: boolean;
            expiry_reminder_7d_sent_at: string;
            expiry_reminder_30d_sent: boolean;
            expiry_reminder_30d_sent_at: string;
            expiry_reminder_90d_sent: boolean;
            expiry_reminder_90d_sent_at: string;
        }>
    ): Promise<boolean> => {
        if (!isSupabaseConfigured()) return false;
        const client = getSupabase();
        if (!client) return false;

        try {
            const { error } = await client
                .from('aya_registry')
                .update({ ...fields, updated_at: new Date().toISOString() })
                .eq('entity_id', entityId);

            if (error) {
                console.error(`❌ [Supabase] updateEntityLifecycle Error for ${entityId}:`, error);
                return false;
            }

            console.log(`💾 [Supabase] Lifecycle updated for entity: ${entityId}`);
            return true;
        } catch (error) {
            console.error(`❌ [Supabase] updateEntityLifecycle Error for ${entityId}:`, error);
            return false;
        }
    },

    /**
     * Find an AYA entity by Stripe subscription_id
     */
    getEntityBySubscriptionId: async (subscriptionId: string): Promise<any | null> => {
        if (!isSupabaseConfigured()) return null;
        const client = getSupabase();
        if (!client) return null;

        try {
            const { data, error } = await client
                .from('aya_registry')
                .select('*')
                .eq('subscription_id', subscriptionId)
                .limit(1)
                .single();

            if (error) {
                if (error.code === 'PGRST116') return null; // No rows
                console.error('❌ [Supabase] getEntityBySubscriptionId Error:', error);
                return null;
            }

            return data;
        } catch (error) {
            console.error('❌ [Supabase] getEntityBySubscriptionId Error:', error);
            return null;
        }
    },

    /**
     * Mark expired entities (valid_until < now) as no longer active
     * Returns the list of entity IDs that were expired
     */
    markEntitiesExpired: async (): Promise<string[]> => {
        if (!isSupabaseConfigured()) return [];
        const client = getSupabase();
        if (!client) return [];

        try {
            const now = new Date().toISOString();

            // First, get the entities that will be expired (for logging)
            const { data: toExpire, error: fetchErr } = await client
                .from('aya_registry')
                .select('entity_id, display_name, website, valid_until')
                .eq('payment_completed', true)
                .not('valid_until', 'is', null)
                .lt('valid_until', now);

            if (fetchErr) {
                console.error('❌ [Supabase] markEntitiesExpired fetch Error:', fetchErr);
                return [];
            }

            if (!toExpire || toExpire.length === 0) return [];

            const entityIds = toExpire.map((e: any) => e.entity_id);

            // Update all expired entities
            const { error: updateErr } = await client
                .from('aya_registry')
                .update({
                    payment_completed: false,
                    subscription_status: 'expired',
                    updated_at: now,
                })
                .in('entity_id', entityIds);

            if (updateErr) {
                console.error('❌ [Supabase] markEntitiesExpired update Error:', updateErr);
                return [];
            }

            console.log(`⏰ [Supabase] Marked ${entityIds.length} entities as expired`);
            return entityIds;
        } catch (error) {
            console.error('❌ [Supabase] markEntitiesExpired Error:', error);
            return [];
        }
    },

    // ── API Analytics ───────────────────────────────────────

    insertAyaAnalytics: async (rows: { recorded_at: string; endpoint: string; caller_type: string; call_count: number; sample_ua: string | null; domain: string | null }[]): Promise<void> => {
        if (!isSupabaseConfigured() || rows.length === 0) return;
        const client = getSupabase();
        if (!client) return;
        try {
            const { error } = await client.from('aya_api_analytics').insert(rows);
            if (error) console.error('❌ [Supabase] insertAyaAnalytics Error:', error.message);
        } catch (error) {
            console.error('❌ [Supabase] insertAyaAnalytics Error:', error);
        }
    },

    getAyaAnalytics: async (days: number = 7): Promise<any[]> => {
        if (!isSupabaseConfigured()) return [];
        const client = getSupabase();
        if (!client) return [];
        try {
            const since = new Date(Date.now() - days * 86400000).toISOString();
            const { data, error } = await client
                .from('aya_api_analytics')
                .select('*')
                .gte('recorded_at', since)
                .order('recorded_at', { ascending: false });
            if (error) { console.error('❌ [Supabase] getAyaAnalytics Error:', error); return []; }
            return data || [];
        } catch (error) {
            console.error('❌ [Supabase] getAyaAnalytics Error:', error);
            return [];
        }
    },
};

// Export as 'db' for backward compatibility
export const db = database;

// ── Aggregated helper (Supabase + optional VPS Postgres) ─────────────────────

/**
 * In-memory cache for VPS fetch results.
 * Key: cache key string → { data: any[], exp: timestamp }
 */
const _vpsCache = new Map<string, { data: any[]; exp: number }>();
const VPS_CACHE_TTL_MS = 60_000; // 60 seconds

/**
 * getAyaEntitiesAggregated
 *
 * Fetches entities from Supabase (authoritative, paying customers) and,
 * when AYA_VPS_API_URL is set, also from the VPS /api/aya-local/live endpoint.
 * Results are merged and deduplicated by entity_id — Supabase wins on conflicts.
 *
 * Falls back gracefully to Supabase-only on VPS network errors or timeouts.
 * NEVER throws.
 */
export async function getAyaEntitiesAggregated(options: {
    page: number;
    pageSize: number;
    search?: string;
    sort?: 'default' | 'alpha' | 'score' | 'country' | 'certified';
}): Promise<{ data: any[]; total: number; certifiedCount: number; indexedCount: number }> {
    // Always start with Supabase (authoritative source)
    const supabaseResult = await database.getAyaEntitiesPaginated(options);

    const vpsBaseUrl = process.env.AYA_VPS_API_URL?.replace(/\/$/, '');
    if (!vpsBaseUrl) {
        // VPS aggregation not configured — return Supabase-only result
        return supabaseResult;
    }

    // Build VPS cache key
    const cacheKey = `${vpsBaseUrl}|${options.search ?? ''}|${options.sort ?? 'default'}`;
    const cached = _vpsCache.get(cacheKey);
    let vpsEntities: any[] = [];

    // We track the VPS total count separately from the page data.
    let vpsTotalFromApi = 0;

    if (cached && Date.now() < cached.exp) {
        vpsEntities    = cached.data;
        // The total is stored as the first element when not in search mode
        vpsTotalFromApi = (cached as any).total ?? vpsEntities.length;
    } else {
        try {
            // Bug 2 fix: fetch only one page worth of rows from VPS (pageSize) to avoid
            // returning thousands of rows in the HTML payload (26 MB issue).
            // The VPS total is read from json.total (not array length) — Bug 1 fix.
            // Full cross-source pagination is deferred to MV.3 (Vercel→VPS migration).
            const searchParam = options.search ? `&search=${encodeURIComponent(options.search)}` : '';
            const sortParam   = options.sort   ? `&sort=${encodeURIComponent(options.sort)}`     : '';
            const vpsUrl = `${vpsBaseUrl}/live?limit=${options.pageSize}${searchParam}${sortParam}`;

            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 5_000);

            const res = await fetch(vpsUrl, { signal: controller.signal });
            clearTimeout(timeout);

            if (!res.ok) {
                console.warn(`[getAyaEntitiesAggregated] VPS returned ${res.status} — falling back to Supabase only`);
            } else {
                // Bug 1 fix: use json.total (the VPS full row count) for arithmetic,
                // NOT the length of json.data (which is capped to one page size).
                const json = await res.json() as { data?: any[]; total?: number };
                vpsEntities    = Array.isArray(json.data) ? json.data : [];
                vpsTotalFromApi = typeof json.total === 'number' ? json.total : vpsEntities.length;
                const entry = Object.assign(
                    { data: vpsEntities, exp: Date.now() + VPS_CACHE_TTL_MS },
                    { total: vpsTotalFromApi }
                );
                _vpsCache.set(cacheKey, entry);
            }
        } catch (err) {
            console.warn('[getAyaEntitiesAggregated] VPS fetch failed — falling back to Supabase only:', err);
        }
    }

    if (vpsEntities.length === 0 && vpsTotalFromApi === 0) {
        return supabaseResult;
    }

    // Collect Supabase entity_ids from the current page result for dedup
    const supabaseIds = new Set<string>(supabaseResult.data.map((e: any) => e.entity_id as string));

    // Filter VPS page rows: exclude any entity_id already in Supabase
    const vpsUnique = vpsEntities.filter((e: any) => !supabaseIds.has(e.entity_id));

    // Merge: Supabase rows first (certified, authoritative), then VPS-unique rows.
    // Bug 2 fix: vpsUnique is already one page (pageSize rows from VPS) — no 26 MB payload.
    const merged = [...supabaseResult.data, ...vpsUnique];

    // Bug 1 fix: use vpsTotalFromApi (full VPS count) instead of vpsUnique.length (page slice)
    // so that numberOfItems in JSON-LD reflects the real registry size.
    const adjustedTotal = supabaseResult.total + vpsTotalFromApi;

    return {
        data:           merged,
        total:          adjustedTotal,
        certifiedCount: supabaseResult.certifiedCount,  // Only Supabase has paying customers
        indexedCount:   supabaseResult.indexedCount + vpsTotalFromApi,
    };
}

// ── getAyaEntitiesByFilterAggregated ─────────────────────────────────────────

/**
 * Fetch entities filtered by sector_macro and/or country_legal from Supabase +
 * optional VPS Postgres.  Dedupes by entity_id — Supabase wins on conflicts.
 *
 * IMPORTANT: `sector` is resolved via resolveSectorMacro() before being sent to
 * either source.  This fixes the FR/EN sector mismatch (e.g. URL param
 * "Technology & SaaS" is converted to "Technologie & SaaS" before the SQL eq()).
 *
 * Falls back to Supabase-only if VPS is down or times out (5 s).
 * NEVER throws.
 */
export async function getAyaEntitiesByFilterAggregated(options: {
    sector?: string;
    country?: string;
    limit?: number;
    offset?: number;
}): Promise<{ data: any[]; total: number }> {
    const { limit = 100, offset = 0 } = options;

    // Resolve sector to the canonical FR key stored in DB
    const sector  = options.sector  ? resolveSectorMacro(options.sector)  : undefined;
    const country = options.country ? options.country.toUpperCase()       : undefined;

    // Always start with Supabase (authoritative source — certified/paying customers)
    const supabaseResult = await database.getAyaEntitiesByFilter({ sector, country, limit, offset });

    const vpsBaseUrl = process.env.AYA_VPS_API_URL?.replace(/\/$/, '');
    if (!vpsBaseUrl) return supabaseResult;

    const cacheKey = `_byfilter_${sector ?? ''}_${country ?? ''}_${limit}_${offset}`;
    const cached = _vpsCache.get(cacheKey);
    let vpsData: any[]  = [];
    let vpsTotal = 0;

    if (cached && Date.now() < cached.exp) {
        vpsData  = cached.data;
        vpsTotal = (cached as any).total ?? vpsData.length;
    } else {
        try {
            const params = new URLSearchParams();
            if (sector)  params.set('sector',  sector);
            if (country) params.set('country', country);
            params.set('limit',  String(limit));
            params.set('offset', String(offset));

            const vpsUrl = `${vpsBaseUrl}/by-filter?${params.toString()}`;
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 5_000);
            const res = await fetch(vpsUrl, { signal: controller.signal });
            clearTimeout(timeout);

            if (!res.ok) {
                console.warn(`[getAyaEntitiesByFilterAggregated] VPS returned ${res.status} — Supabase only`);
            } else {
                const json = await res.json() as { data?: any[]; total?: number };
                vpsData  = Array.isArray(json.data) ? json.data : [];
                vpsTotal = typeof json.total === 'number' ? json.total : vpsData.length;
                const entry = Object.assign(
                    { data: vpsData, exp: Date.now() + VPS_CACHE_TTL_MS },
                    { total: vpsTotal }
                );
                _vpsCache.set(cacheKey, entry);
            }
        } catch (err) {
            console.warn('[getAyaEntitiesByFilterAggregated] VPS fetch failed — Supabase only:', err);
        }
    }

    if (vpsData.length === 0 && vpsTotal === 0) return supabaseResult;

    const supabaseIds = new Set<string>(supabaseResult.data.map((e: any) => e.entity_id as string));
    const vpsUnique   = vpsData.filter((e: any) => !supabaseIds.has(e.entity_id));

    return {
        data:  [...supabaseResult.data, ...vpsUnique],
        total: supabaseResult.total + vpsTotal,
    };
}

// ── getAyaSectorsAggregated ───────────────────────────────────────────────────

/**
 * Distinct sector_macro values with counts from Supabase + optional VPS.
 * Counts are merged per FR key (additive).  Min count threshold: 2.
 * NEVER throws.
 */
export async function getAyaSectorsAggregated(): Promise<{ sector: string; count: number }[]> {
    const supabaseSectors = await database.getAyaSectors();

    const vpsBaseUrl = process.env.AYA_VPS_API_URL?.replace(/\/$/, '');
    if (!vpsBaseUrl) return supabaseSectors;

    const cacheKey = '_sectors_agg';
    const cached = _vpsCache.get(cacheKey);
    let vpsSectors: { sector: string; count: number }[] = [];

    if (cached && Date.now() < cached.exp) {
        vpsSectors = cached.data as { sector: string; count: number }[];
    } else {
        try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 5_000);
            const res = await fetch(`${vpsBaseUrl}/sectors`, { signal: controller.signal });
            clearTimeout(timeout);

            if (res.ok) {
                const json = await res.json() as { sectors?: { sector: string; count: number }[] };
                vpsSectors = Array.isArray(json.sectors) ? json.sectors : [];
                _vpsCache.set(cacheKey, { data: vpsSectors, exp: Date.now() + VPS_CACHE_TTL_MS });
            } else {
                console.warn(`[getAyaSectorsAggregated] VPS returned ${res.status} — Supabase only`);
            }
        } catch (err) {
            console.warn('[getAyaSectorsAggregated] VPS fetch failed — Supabase only:', err);
        }
    }

    if (vpsSectors.length === 0) return supabaseSectors;

    // Merge counts per FR sector key
    const merged: Record<string, number> = {};
    for (const { sector, count } of supabaseSectors) {
        merged[sector] = (merged[sector] || 0) + count;
    }
    for (const { sector, count } of vpsSectors) {
        merged[sector] = (merged[sector] || 0) + count;
    }

    return Object.entries(merged)
        .filter(([, c]) => c >= 2)
        .sort((a, b) => b[1] - a[1])
        .map(([sector, count]) => ({ sector, count }));
}

// ── getAyaCountriesAggregated ─────────────────────────────────────────────────

/**
 * Distinct country_legal ISO codes with counts from Supabase + optional VPS.
 * Counts are merged per country code (additive).  Min count threshold: 2.
 * NEVER throws.
 */
export async function getAyaCountriesAggregated(): Promise<{ country: string; count: number }[]> {
    const supabaseCountries = await database.getAyaCountries();

    const vpsBaseUrl = process.env.AYA_VPS_API_URL?.replace(/\/$/, '');
    if (!vpsBaseUrl) return supabaseCountries;

    const cacheKey = '_countries_agg';
    const cached = _vpsCache.get(cacheKey);
    let vpsCountries: { country: string; count: number }[] = [];

    if (cached && Date.now() < cached.exp) {
        vpsCountries = cached.data as { country: string; count: number }[];
    } else {
        try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 5_000);
            const res = await fetch(`${vpsBaseUrl}/countries`, { signal: controller.signal });
            clearTimeout(timeout);

            if (res.ok) {
                const json = await res.json() as { countries?: { country: string; count: number }[] };
                vpsCountries = Array.isArray(json.countries) ? json.countries : [];
                _vpsCache.set(cacheKey, { data: vpsCountries, exp: Date.now() + VPS_CACHE_TTL_MS });
            } else {
                console.warn(`[getAyaCountriesAggregated] VPS returned ${res.status} — Supabase only`);
            }
        } catch (err) {
            console.warn('[getAyaCountriesAggregated] VPS fetch failed — Supabase only:', err);
        }
    }

    if (vpsCountries.length === 0) return supabaseCountries;

    // Merge counts per ISO country code
    const merged: Record<string, number> = {};
    for (const { country, count } of supabaseCountries) {
        merged[country] = (merged[country] || 0) + count;
    }
    for (const { country, count } of vpsCountries) {
        merged[country] = (merged[country] || 0) + count;
    }

    return Object.entries(merged)
        .filter(([, c]) => c >= 2)
        .sort((a, b) => b[1] - a[1])
        .map(([country, count]) => ({ country, count }));
}

// ── getAyaSectorCountryCombinationsAggregated ─────────────────────────────────

/**
 * Non-empty (sector_macro FR key, country_legal ISO code) pairs from Supabase +
 * optional VPS.  Counts are merged per key pair.  Min count threshold: 1.
 * NEVER throws.
 */
export async function getAyaSectorCountryCombinationsAggregated(): Promise<
    { sector: string; country: string; count: number }[]
> {
    const supabaseCombinations = await database.getAyaSectorCountryCombinations();

    const vpsBaseUrl = process.env.AYA_VPS_API_URL?.replace(/\/$/, '');
    if (!vpsBaseUrl) return supabaseCombinations;

    const cacheKey = '_sector_country_combos_agg';
    const cached = _vpsCache.get(cacheKey);
    let vpsCombinations: { sector: string; country: string; count: number }[] = [];

    if (cached && Date.now() < cached.exp) {
        vpsCombinations = cached.data as { sector: string; country: string; count: number }[];
    } else {
        try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 5_000);
            const res = await fetch(`${vpsBaseUrl}/sector-country-combinations`, { signal: controller.signal });
            clearTimeout(timeout);

            if (res.ok) {
                const json = await res.json() as {
                    combinations?: { sector: string; country: string; count: number }[];
                };
                vpsCombinations = Array.isArray(json.combinations) ? json.combinations : [];
                _vpsCache.set(cacheKey, { data: vpsCombinations, exp: Date.now() + VPS_CACHE_TTL_MS });
            } else {
                console.warn(`[getAyaSectorCountryCombinationsAggregated] VPS returned ${res.status} — Supabase only`);
            }
        } catch (err) {
            console.warn('[getAyaSectorCountryCombinationsAggregated] VPS fetch failed — Supabase only:', err);
        }
    }

    if (vpsCombinations.length === 0) return supabaseCombinations;

    // Merge counts per (sector||country) key pair
    const merged: Record<string, number> = {};
    for (const { sector, country, count } of supabaseCombinations) {
        const key = `${sector}||${country}`;
        merged[key] = (merged[key] || 0) + count;
    }
    for (const { sector, country, count } of vpsCombinations) {
        const key = `${sector}||${country}`;
        merged[key] = (merged[key] || 0) + count;
    }

    return Object.entries(merged)
        .filter(([, n]) => n >= 1)
        .sort((a, b) => b[1] - a[1])
        .map(([key, count]) => {
            const [sector, country] = key.split('||');
            return { sector, country, count };
        });
}

// ── Shared result types ───────────────────────────────────────────────────────

export interface AyaSearchResult {
    name: string;
    domain: string;
    country: string;
    sector: string;
    score: number;
    certified: boolean;
    entity_id: string;
    url: string;
}

export interface AyaStatsShape {
    total_entities: number;
    certified_count: number;
    indexed_count: number;
    scores: {
        average: number;
        min: number;
        max: number;
        median: number;
    };
    sectors: { sector: string; count: number }[];
    countries: { country: string; count: number }[];
    last_updated: string;
}

// ── getAyaSearchAggregated ────────────────────────────────────────────────────

/**
 * Search entities across Supabase (authoritative) + optional VPS Postgres.
 * Dedupes by entity_id — Supabase wins on conflicts.
 * NEVER throws.
 */
export async function getAyaSearchAggregated(
    q: string,
    limit: number,
): Promise<AyaSearchResult[]> {
    // ── Supabase search ──────────────────────────────────────────────────────
    const stopWords = new Set(['le','la','les','de','du','des','un','une','et','en','à','a','au','aux','dans','pour','sur','par','avec','the','of','in','and','for','on','at','to','is','an']);
    const qLower = q.toLowerCase();
    const words = qLower.split(/\s+/).filter(w => w.length >= 2 && !stopWords.has(w));

    const mapToResult = (e: any): AyaSearchResult => ({
        name:      e.display_name || e.legal_name || '',
        domain:    e.website ? e.website.replace(/^https?:\/\/(www\.)?/, '').split('/')[0] : '',
        country:   e.country_legal || '',
        sector:    e.sector_macro || '',
        score:     e.asr_score ?? 0,
        certified: e.payment_completed === true,
        entity_id: e.entity_id || '',
        url:       `https://ai-visionary.xyz/aya/e/${e.entity_id || ''}`,
    });

    let supabaseResults: AyaSearchResult[] = [];
    try {
        const allEntities = await database.getAyaEntities();
        const scored = allEntities
            .map((e: any) => {
                const basicText = [
                    e.display_name, e.legal_name, e.website,
                    e.sector_macro, e.country_legal, e.contact_email,
                ].filter(Boolean).join(' ').toLowerCase();
                const payloadText = e.asr_payload
                    ? (typeof e.asr_payload === 'string'
                        ? e.asr_payload.toLowerCase()
                        : JSON.stringify(e.asr_payload).toLowerCase())
                    : '';
                const fullText = basicText + ' ' + payloadText;
                const matchCount = words.filter(word => fullText.includes(word)).length;
                const certBonus = e.payment_completed ? 0.5 : 0;
                return { entity: e, matchCount, score: matchCount + certBonus };
            })
            .filter(item => item.matchCount > 0)
            .sort((a, b) => b.score - a.score)
            .slice(0, limit)
            .map(item => mapToResult(item.entity));
        supabaseResults = scored;
    } catch (err) {
        console.warn('[getAyaSearchAggregated] Supabase search failed:', err);
    }

    // ── VPS search ───────────────────────────────────────────────────────────
    const vpsBaseUrl = process.env.AYA_VPS_API_URL?.replace(/\/$/, '');
    if (!vpsBaseUrl) return supabaseResults;

    const cacheKey = `_search_${q}_${limit}`;
    const cached = _vpsCache.get(cacheKey);
    let vpsResults: AyaSearchResult[] = [];

    if (cached && Date.now() < cached.exp) {
        vpsResults = cached.data as AyaSearchResult[];
    } else {
        try {
            const vpsUrl = `${vpsBaseUrl}/search?q=${encodeURIComponent(q)}&limit=${limit}`;
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 5_000);
            const res = await fetch(vpsUrl, { signal: controller.signal });
            clearTimeout(timeout);
            if (!res.ok) {
                console.warn(`[getAyaSearchAggregated] VPS returned ${res.status} — Supabase only`);
            } else {
                const json = await res.json() as { results?: AyaSearchResult[] };
                vpsResults = Array.isArray(json.results) ? json.results : [];
                _vpsCache.set(cacheKey, { data: vpsResults, exp: Date.now() + VPS_CACHE_TTL_MS });
            }
        } catch (err) {
            console.warn('[getAyaSearchAggregated] VPS fetch failed — Supabase only:', err);
        }
    }

    if (vpsResults.length === 0) return supabaseResults;

    const supabaseIds = new Set<string>(supabaseResults.map(r => r.entity_id));
    const vpsUnique = vpsResults.filter(r => !supabaseIds.has(r.entity_id));
    return [...supabaseResults, ...vpsUnique].slice(0, limit);
}

// ── getAyaStatsAggregated ─────────────────────────────────────────────────────

/**
 * Compute stats across Supabase + optional VPS Postgres.
 * Merges totals, sectors, countries with correct weighting.
 * NEVER throws.
 */
export async function getAyaStatsAggregated(): Promise<AyaStatsShape> {
    // ── Supabase stats ───────────────────────────────────────────────────────
    let supabaseStats: AyaStatsShape = {
        total_entities: 0,
        certified_count: 0,
        indexed_count: 0,
        scores: { average: 0, min: 0, max: 0, median: 0 },
        sectors: [],
        countries: [],
        last_updated: new Date().toISOString(),
    };

    try {
        const allEntities = await database.getAyaEntities();
        const scores = allEntities.map((e: any) => e.asr_score ?? 0);
        const certified = allEntities.filter((e: any) => e.payment_completed);

        const sectors: Record<string, number> = {};
        for (const e of allEntities) { const s = e.sector_macro || 'Unknown'; sectors[s] = (sectors[s] || 0) + 1; }

        const countries: Record<string, number> = {};
        for (const e of allEntities) { const c = e.country_legal || 'XX'; countries[c] = (countries[c] || 0) + 1; }

        const sortedScores = [...scores].sort((a: number, b: number) => a - b);

        supabaseStats = {
            total_entities: allEntities.length,
            certified_count: certified.length,
            indexed_count: allEntities.length - certified.length,
            scores: {
                average: scores.length ? Math.round(scores.reduce((a: number, b: number) => a + b, 0) / scores.length) : 0,
                min:     scores.length ? Math.min(...scores) : 0,
                max:     scores.length ? Math.max(...scores) : 0,
                median:  scores.length ? sortedScores[Math.floor(sortedScores.length / 2)] : 0,
            },
            sectors:  Object.entries(sectors).sort((a, b) => b[1] - a[1]).map(([sector, count]) => ({ sector, count })),
            countries: Object.entries(countries).sort((a, b) => b[1] - a[1]).map(([country, count]) => ({ country, count })),
            last_updated: new Date().toISOString(),
        };
    } catch (err) {
        console.warn('[getAyaStatsAggregated] Supabase stats failed:', err);
    }

    // ── VPS stats ────────────────────────────────────────────────────────────
    const vpsBaseUrl = process.env.AYA_VPS_API_URL?.replace(/\/$/, '');
    if (!vpsBaseUrl) return supabaseStats;

    const cacheKey = '_stats';
    const cached = _vpsCache.get(cacheKey);
    let vpsStats: AyaStatsShape | null = null;

    if (cached && Date.now() < cached.exp) {
        vpsStats = cached.data[0] as AyaStatsShape;
    } else {
        try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 5_000);
            const res = await fetch(`${vpsBaseUrl}/stats`, { signal: controller.signal });
            clearTimeout(timeout);
            if (!res.ok) {
                console.warn(`[getAyaStatsAggregated] VPS returned ${res.status} — Supabase only`);
            } else {
                vpsStats = await res.json() as AyaStatsShape;
                _vpsCache.set(cacheKey, { data: [vpsStats], exp: Date.now() + VPS_CACHE_TTL_MS });
            }
        } catch (err) {
            console.warn('[getAyaStatsAggregated] VPS fetch failed — Supabase only:', err);
        }
    }

    if (!vpsStats) return supabaseStats;

    // ── Merge ────────────────────────────────────────────────────────────────
    const sbCount  = supabaseStats.total_entities;
    const vpsCount = vpsStats.total_entities;
    const totalCount = sbCount + vpsCount;

    const weightedAvg = totalCount > 0
        ? Math.round((supabaseStats.scores.average * sbCount + vpsStats.scores.average * vpsCount) / totalCount)
        : 0;

    // Merge sectors
    const sectorsMap: Record<string, number> = {};
    for (const { sector, count } of supabaseStats.sectors)  sectorsMap[sector]  = (sectorsMap[sector]  || 0) + count;
    for (const { sector, count } of vpsStats.sectors)        sectorsMap[sector]  = (sectorsMap[sector]  || 0) + count;
    const mergedSectors = Object.entries(sectorsMap).sort((a, b) => b[1] - a[1]).map(([sector, count]) => ({ sector, count }));

    // Merge countries
    const countriesMap: Record<string, number> = {};
    for (const { country, count } of supabaseStats.countries) countriesMap[country] = (countriesMap[country] || 0) + count;
    for (const { country, count } of vpsStats.countries)       countriesMap[country] = (countriesMap[country] || 0) + count;
    const mergedCountries = Object.entries(countriesMap).sort((a, b) => b[1] - a[1]).map(([country, count]) => ({ country, count }));

    // last_updated: take the more recent of the two
    const lastUpdated = supabaseStats.last_updated > (vpsStats.last_updated ?? '') ? supabaseStats.last_updated : (vpsStats.last_updated ?? supabaseStats.last_updated);

    return {
        total_entities: totalCount,
        certified_count: supabaseStats.certified_count, // only Supabase has paying customers
        indexed_count:   supabaseStats.indexed_count + vpsCount,
        scores: {
            average: weightedAvg,
            min:     Math.min(supabaseStats.scores.min, vpsStats.scores.min ?? supabaseStats.scores.min),
            max:     Math.max(supabaseStats.scores.max, vpsStats.scores.max ?? supabaseStats.scores.max),
            median:  supabaseStats.scores.median, // can't correctly merge medians without raw data
        },
        sectors:   mergedSectors,
        countries: mergedCountries,
        last_updated: lastUpdated,
    };
}

// ── getAyaLiveAggregated ──────────────────────────────────────────────────────

/**
 * Fetch all live entities across Supabase + optional VPS Postgres.
 * Supports limit/offset for pagination across the combined dataset.
 * NEVER throws.
 */
export async function getAyaLiveAggregated(
    limit: number = 5000,
    offset: number = 0,
): Promise<{ success: boolean; data: any[] }> {
    // ── Supabase live ────────────────────────────────────────────────────────
    let supabaseEntities: any[] = [];
    try {
        supabaseEntities = await database.getAyaEntities();
    } catch (err) {
        console.warn('[getAyaLiveAggregated] Supabase fetch failed:', err);
    }

    // ── VPS live ─────────────────────────────────────────────────────────────
    const vpsBaseUrl = process.env.AYA_VPS_API_URL?.replace(/\/$/, '');
    if (!vpsBaseUrl) {
        const slice = supabaseEntities.slice(offset, offset + limit);
        return { success: true, data: slice };
    }

    const cacheKey = `_live_${limit}_${offset}`;
    const cached = _vpsCache.get(cacheKey);
    let vpsEntities: any[] = [];

    if (cached && Date.now() < cached.exp) {
        vpsEntities = cached.data;
    } else {
        try {
            const vpsUrl = `${vpsBaseUrl}/live?limit=${limit}&offset=${offset}`;
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 5_000);
            const res = await fetch(vpsUrl, { signal: controller.signal });
            clearTimeout(timeout);
            if (!res.ok) {
                console.warn(`[getAyaLiveAggregated] VPS returned ${res.status} — Supabase only`);
            } else {
                const json = await res.json() as { data?: any[] };
                vpsEntities = Array.isArray(json.data) ? json.data : [];
                _vpsCache.set(cacheKey, { data: vpsEntities, exp: Date.now() + VPS_CACHE_TTL_MS });
            }
        } catch (err) {
            console.warn('[getAyaLiveAggregated] VPS fetch failed — Supabase only:', err);
        }
    }

    // Dedupe VPS by entity_id against Supabase
    const supabaseIds = new Set<string>(supabaseEntities.map((e: any) => e.entity_id as string));
    const vpsUnique = vpsEntities.filter((e: any) => !supabaseIds.has(e.entity_id));

    const merged = [...supabaseEntities, ...vpsUnique];
    const slice  = merged.slice(offset, offset + limit);

    return { success: true, data: slice };
}

// ── getAyaEntityByIdAggregated ────────────────────────────────────────────────

/**
 * Look up a single AYA entity by its UUID across Supabase (authoritative) and,
 * when AYA_VPS_API_URL is set, the VPS /api/aya-local/entity-by-id/{id} endpoint.
 *
 * Strategy:
 *  1. Try Supabase first — if found, return immediately (no VPS call needed).
 *  2. On Supabase miss, try VPS (with 5 s timeout). Cache the result (60 s) to
 *     avoid hammering the VPS on repeated requests for the same id (including 404s).
 *  3. NEVER throws — any error returns null.
 */
export async function getAyaEntityByIdAggregated(id: string): Promise<any | null> {
    // 1. Supabase first (authoritative, paying customers)
    try {
        const sbEntity = await database.getAyaEntityById(id);
        if (sbEntity) return sbEntity;
    } catch (err) {
        console.warn('[getAyaEntityByIdAggregated] Supabase lookup failed:', err);
    }

    // 2. VPS fallback
    const vpsBaseUrl = process.env.AYA_VPS_API_URL?.replace(/\/$/, '');
    if (!vpsBaseUrl) return null;

    const cacheKey = `entity_id:${id}`;
    const cached = _vpsCache.get(cacheKey);
    if (cached && Date.now() < cached.exp) {
        // Cached null is stored as empty array
        return cached.data.length > 0 ? cached.data[0] : null;
    }

    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5_000);
        const res = await fetch(`${vpsBaseUrl}/entity-by-id/${encodeURIComponent(id)}`, { signal: controller.signal });
        clearTimeout(timeout);

        if (!res.ok) {
            // Cache the miss so we don't hammer the VPS on repeated 404s
            _vpsCache.set(cacheKey, { data: [], exp: Date.now() + VPS_CACHE_TTL_MS });
            console.warn(`[getAyaEntityByIdAggregated] VPS returned ${res.status} for id=${id}`);
            return null;
        }

        const json = await res.json() as { entity?: any };
        const entity = json.entity ?? null;
        _vpsCache.set(cacheKey, { data: entity ? [entity] : [], exp: Date.now() + VPS_CACHE_TTL_MS });
        return entity;
    } catch (err) {
        console.warn('[getAyaEntityByIdAggregated] VPS fetch failed:', err);
        return null;
    }
}

// ── getAyaEntityByUrlAggregated ───────────────────────────────────────────────

/**
 * Look up a single AYA entity by URL/domain across Supabase + optional VPS.
 *
 * Internally tries both https://<domain> and https://www.<domain> before giving up,
 * so call sites only need one call (no double-try pattern in the caller).
 *
 * Caching: 60 s in-memory keyed by `entity_url:<normalized-domain>`.
 * NEVER throws.
 */
export async function getAyaEntityByUrlAggregated(url: string): Promise<any | null> {
    // Normalise to bare domain for cache key and VPS call
    const bare = url
        .toLowerCase()
        .replace(/^https?:\/\//, '')
        .replace(/^www\./, '')
        .split('/')[0]
        .split('?')[0]
        .split('#')[0];

    // 1. Supabase first — try without www, then with www
    try {
        let sbEntity = await database.getAyaEntityByUrl(`https://${bare}`);
        if (!sbEntity) sbEntity = await database.getAyaEntityByUrl(`https://www.${bare}`);
        if (sbEntity) return sbEntity;
    } catch (err) {
        console.warn('[getAyaEntityByUrlAggregated] Supabase lookup failed:', err);
    }

    // 2. VPS fallback
    const vpsBaseUrl = process.env.AYA_VPS_API_URL?.replace(/\/$/, '');
    if (!vpsBaseUrl) return null;

    const cacheKey = `entity_url:${bare}`;
    const cached = _vpsCache.get(cacheKey);
    if (cached && Date.now() < cached.exp) {
        return cached.data.length > 0 ? cached.data[0] : null;
    }

    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5_000);
        const res = await fetch(`${vpsBaseUrl}/entity/${encodeURIComponent(bare)}`, { signal: controller.signal });
        clearTimeout(timeout);

        if (!res.ok) {
            _vpsCache.set(cacheKey, { data: [], exp: Date.now() + VPS_CACHE_TTL_MS });
            console.warn(`[getAyaEntityByUrlAggregated] VPS returned ${res.status} for domain=${bare}`);
            return null;
        }

        const json = await res.json() as { entity?: any };
        const entity = json.entity ?? null;
        _vpsCache.set(cacheKey, { data: entity ? [entity] : [], exp: Date.now() + VPS_CACHE_TTL_MS });
        return entity;
    } catch (err) {
        console.warn('[getAyaEntityByUrlAggregated] VPS fetch failed:', err);
        return null;
    }
}
