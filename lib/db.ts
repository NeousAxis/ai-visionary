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
     * Get all entities from AYA Registry (certified + indexed)
     * Sorted: payment_completed=true first, then by score DESC
     */
    getAyaEntities: async (limit: number = 500): Promise<any[]> => {
        if (!isSupabaseConfigured()) return [];
        const client = getSupabase();
        if (!client) return [];

        try {
            const { data, error } = await client
                .from('aya_registry')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(limit);

            if (error) {
                console.error('❌ [Supabase] Get AYA Entities Error:', error);
                return [];
            }

            return data || [];
        } catch (error) {
            console.error('❌ [Supabase] Get AYA Entities Error:', error);
            return [];
        }
    },

    /**
     * Retrieve an AYA Entity by its ID
     */
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
};

// Export as 'db' for backward compatibility
export const db = database;
