import { createClient } from '@supabase/supabase-js';

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

            // Pick the best result: highest score WITH actual data
            let bestResult: AnalysisRecord | null = null;
            for (const row of data) {
                const hasData = row.data?.fields && Object.keys(row.data.fields).some((k: string) => row.data.fields[k] && Object.keys(row.data.fields[k]).length > 0);
                const score = row.score || 0;

                if (hasData && score > (bestResult?.score || 0)) {
                    bestResult = row as AnalysisRecord;
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
     * OTP MANAGEMENT (One Time Password)
     */
    saveOTP: async (email: string, code: string): Promise<void> => {
        if (!isSupabaseConfigured()) return;
        const client = getSupabase();
        if (!client) return;

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
                return;
            }
            console.log(`🔐 [Supabase] OTP saved for ${email}`);
        } catch (e) {
            console.error('Error saving OTP:', e);
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
};

// Export as 'db' for backward compatibility
export const db = database;
