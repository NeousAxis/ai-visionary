import { getFirestore } from 'firebase-admin/firestore';
import { initializeApp, getApps, cert } from 'firebase-admin/app';

// Type definition for analysis records
type AnalysisRecord = {
    id: string;
    url: string;
    email: string | null;
    score: number;
    data: any;
    timestamp: string;
};

let isFirebaseInitialized = false;

// Initialize Firebase Admin (singleton pattern)
if (!getApps().length) {
    try {
        console.log('🔧 Initializing Firebase Admin...');

        // Check for Env Vars (Soft Check)
        const projectId = process.env.FIREBASE_PROJECT_ID;
        const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
        let privateKey = process.env.FIREBASE_PRIVATE_KEY;

        if (projectId && clientEmail && privateKey) {
            // Handle newline formats in private key
            privateKey = privateKey.replace(/\\n/g, '\n').replace(/\\\\n/g, '\n');

            const serviceAccount = {
                projectId,
                clientEmail,
                privateKey
            };

            initializeApp({
                credential: cert(serviceAccount as any)
            });

            isFirebaseInitialized = true;
            console.log('✅ Firebase Admin initialized successfully');
        } else {
            console.warn('⚠️ Firebase Credentials Missing. Running in Stateless/Fallback Mode. (DB features disabled)');
            console.log('debug: missing vars', { projectId: !!projectId, clientEmail: !!clientEmail, privateKey: !!privateKey });
        }
    } catch (error) {
        console.error('❌ Firebase Admin initialization failed (Soft Fail):', error);
        // Do not throw, just stay uninitialized
    }
} else {
    isFirebaseInitialized = true;
    console.log('✅ Firebase Admin already initialized');
}

// Helper to safely get firestore
const getDb = () => {
    if (!isFirebaseInitialized) return null;
    try {
        return getFirestore();
    } catch (e) {
        console.error("Error accessing Firestore:", e);
        return null;
    }
}

export const database = {
    /**
     * Save or update an analysis record
     */
    saveAnalysis: async (id: string, record: Partial<AnalysisRecord>): Promise<void> => {
        const dbInstance = getDb();
        if (!dbInstance) {
            console.log(`⚠️ DB Disabled: Skipping save for ID ${id}`);
            return;
        }

        try {
            const docRef = dbInstance.collection('analyses').doc(id);

            const dataToSave = {
                ...record,
                timestamp: new Date().toISOString(),
                id: id
            };

            await docRef.set(dataToSave, { merge: true });
            console.log(`💾 [Firestore] Analysis saved for ID: ${id}`);
        } catch (error) {
            console.error('❌ [Firestore] Save Error:', error);
            // Don't throw to preserve flow
        }
    },

    /**
     * Retrieve an analysis record by ID
     */
    getAnalysis: async (id: string): Promise<AnalysisRecord | null> => {
        const dbInstance = getDb();
        if (!dbInstance) return null;

        try {
            const docRef = dbInstance.collection('analyses').doc(id);
            const doc = await docRef.get();

            if (!doc.exists) {
                console.warn(`⚠️ [Firestore] No analysis found for ID: ${id}`);
                return null;
            }

            const data = doc.data() as AnalysisRecord;
            console.log(`✅ [Firestore] Analysis retrieved for ID: ${id}`);
            return data;
        } catch (error) {
            console.error('❌ [Firestore] Read Error:', error);
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
     */
    getLatestAnalysisByUrl: async (url: string): Promise<AnalysisRecord | null> => {
        const dbInstance = getDb();
        if (!dbInstance) return null;

        try {
            // Build ALL URL variants to search (www/no-www, http/https, trailing slash)
            const normalizedSearch = database.normalizeUrl(url);
            const allVariants = new Set([
                url,
                `https://${normalizedSearch}`,
                `https://www.${normalizedSearch}`,
                `http://${normalizedSearch}`,
                `http://www.${normalizedSearch}`,
                `${url}/`,
                url.replace(/\/$/, ''),
            ]);

            // Search ALL variants and collect the BEST result (highest score with data)
            // NOTE: NO orderBy to avoid FAILED_PRECONDITION (missing composite index).
            // We sort client-side instead — we want the BEST score anyway, not the latest.
            let bestResult: AnalysisRecord | null = null;

            for (const variant of allVariants) {
                try {
                    const snapshot = await dbInstance.collection('analyses')
                        .where('url', '==', variant)
                        .limit(10)
                        .get();

                    for (const doc of snapshot.docs) {
                        const data = doc.data() as AnalysisRecord;
                        if (!data.id) data.id = doc.id;
                        const hasData = data.data?.fields && Object.keys(data.data.fields).some((k: string) => data.data.fields[k] && Object.keys(data.data.fields[k]).length > 0);
                        const score = data.score || 0;

                        if (hasData && score > (bestResult?.score || 0)) {
                            bestResult = data;
                            console.log(`🔍 [Firestore] Better analysis found: variant=${variant}, score=${score}, id=${data.id}`);
                        }
                    }
                } catch (variantErr) {
                    // Per-variant catch so one failure doesn't abort all searches
                    console.warn(`⚠️ [Firestore] Variant query failed for ${variant}:`, variantErr);
                }
            }

            if (bestResult) {
                console.log(`✅ [Firestore] Best analysis for URL ${url}: score=${bestResult.score}, id=${bestResult.id}`);
                return bestResult;
            }

            console.log(`⚠️ [Firestore] No analysis found for URL: ${url}`);
            return null;
        } catch (error) {
            console.error('❌ [Firestore] Query By URL Error:', error);
            return null;
        }
    },

    /**
     * Retrieve the latest analysis for a given EMAIL
     */
    getLatestAnalysisByEmail: async (email: string): Promise<AnalysisRecord | null> => {
        const dbInstance = getDb();
        if (!dbInstance) return null;

        try {
            // NO orderBy — avoids FAILED_PRECONDITION (missing composite index)
            // We get all docs and pick the best score client-side
            const snapshot = await dbInstance.collection('analyses')
                .where('email', '==', email)
                .limit(10)
                .get();

            if (snapshot.empty) {
                console.log(`⚠️ [Firestore] No analysis found for EMAIL: ${email}`);
                return null;
            }

            // Pick the doc with the HIGHEST score
            let bestResult: AnalysisRecord | null = null;
            for (const doc of snapshot.docs) {
                const data = doc.data() as AnalysisRecord;
                if (!data.id) data.id = doc.id;
                const score = data.score || 0;
                const hasData = data.data?.fields && Object.keys(data.data.fields).some((k: string) => data.data.fields[k] && Object.keys(data.data.fields[k]).length > 0);
                if (hasData && score > (bestResult?.score || 0)) {
                    bestResult = data;
                }
            }

            if (bestResult) {
                console.log(`✅ [Firestore] Best analysis for EMAIL ${email}: score=${bestResult.score}, id=${bestResult.id}`);
                return bestResult;
            }

            return snapshot.docs[0].data() as AnalysisRecord;
        } catch (error) {
            console.error('❌ [Firestore] Query By EMAIL Error:', error);
            return null;
        }
    },
    updateEntityRecommendability: async (entityId: string, data: any): Promise<void> => {
        const dbInstance = getDb();
        if (!dbInstance) {
            console.log(`⚠️ DB Disabled: Skipping AYA update for ${entityId}`);
            return;
        }
        try {
            await dbInstance.collection('aya_registry').doc(entityId).set(data, { merge: true });
            console.log(`💾 [Firestore] AYA Entity updated: ${entityId}`);
        } catch (error) {
            console.error('❌ [Firestore] AYA Update Error:', error);
        }
    },
    /**
     * Get all active entities from AYA Registry
     */
    getAyaEntities: async (limit: number = 20): Promise<any[]> => {
        const dbInstance = getDb();
        if (!dbInstance) return [];

        try {
            const snapshot = await dbInstance.collection('aya_registry')
                .where('payment_completed', '==', true)
                .limit(limit)
                .get();

            if (snapshot.empty) return [];

            // Tri client-side par last_update desc
            return snapshot.docs.map(doc => doc.data()).sort((a: any, b: any) =>
                (b.last_update || '').localeCompare(a.last_update || '')
            );
        } catch (error) {
            console.error('❌ [Firestore] Get AYA Entities Error:', error);
            return [];
        }
    },

    /**
     * Retrieve an AYA Entity by its ID
     */
    getAyaEntityById: async (id: string): Promise<any | null> => {
        const dbInstance = getDb();
        if (!dbInstance) return null;

        try {
            console.log(`🔍 [Firestore] Fetching AYA Entity ID: ${id}`);
            const doc = await dbInstance.collection('aya_registry').doc(id).get();

            if (!doc.exists) {
                console.warn(`⚠️ [Firestore] Entity not found: ${id}`);
                return null;
            }
            return doc.data();
        } catch (error) {
            console.error('❌ [Firestore] Get Entity By ID Error:', error);
            return null;
        }
    },

    /**
     * Retrieve an AYA Entity by its URL (Smart Search)
     */
    getAyaEntityByUrl: async (url: string): Promise<any | null> => {
        const dbInstance = getDb();
        if (!dbInstance) return null;

        try {
            const normalizedTarget = database.normalizeUrl(url);
            console.log(`🔍 [Firestore] Searching for AYA Entity with URL: ${normalizedTarget}`);

            // 1. Try finding by 'website' field (Fastest)
            const snapshot = await dbInstance.collection('aya_registry')
                .where('website', '==', url)
                .limit(1)
                .get();

            if (!snapshot.empty) {
                console.log(`✅ [Firestore] AYA Entity found by 'website' field.`);
                return snapshot.docs[0].data();
            }

            // 2. Try URL variants instead of full collection scan
            const variants = [
                `https://${normalizedTarget}`,
                `https://www.${normalizedTarget}`,
                `http://${normalizedTarget}`,
            ];

            for (const variant of variants) {
                if (variant === url) continue;
                const variantSnapshot = await dbInstance.collection('aya_registry')
                    .where('website', '==', variant)
                    .limit(1)
                    .get();
                if (!variantSnapshot.empty) {
                    console.log(`✅ [Firestore] AYA Entity found via variant: ${variant}`);
                    return variantSnapshot.docs[0].data();
                }
            }

            return null;
        } catch (error) {
            console.error('❌ [Firestore] Query AYA By URL Error:', error);
            return null;
        }
    },

    /**
     * OTP MANAGEMENT (One Time Password)
     */
    saveOTP: async (email: string, code: string): Promise<void> => {
        const dbInstance = getDb();
        if (!dbInstance) return;

        try {
            // ID = email (easy lookup, one code per user at a time)
            // But emails can have special chars, so hash or sanitize? Firestore doc IDs allow most.
            // Let's us sanitize just in case.
            const docId = email.replace(/[^a-zA-Z0-9]/g, '_');

            await dbInstance.collection('otps').doc(docId).set({
                email: email,
                code: code,
                created_at: new Date().toISOString(),
                expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString() // 10 mins validity
            });
            console.log(`🔐 [Firestore] OTP saved for ${email}`);
        } catch (e) {
            console.error("Error saving OTP:", e);
        }
    },

    verifyOTP: async (email: string, code: string): Promise<boolean> => {
        const dbInstance = getDb();
        if (!dbInstance) return false;

        try {
            const docId = email.replace(/[^a-zA-Z0-9]/g, '_');
            const docRef = dbInstance.collection('otps').doc(docId);
            const doc = await docRef.get();

            if (!doc.exists) {
                console.log(`❌ [Firestore] No OTP found for ${email}`);
                return false;
            }

            const data = doc.data();
            if (!data) return false;

            const now = new Date();
            const expires = new Date(data.expires_at);

            if (now > expires) {
                console.log(`❌ [Firestore] OTP expired for ${email}`);
                await docRef.delete(); // Cleanup
                return false;
            }

            if (data.code === code) {
                console.log(`✅ [Firestore] OTP Validated for ${email}`);
                await docRef.delete(); // Burn the code (One Time Use)
                return true;
            }

            console.log(`❌ [Firestore] Invalid OTP for ${email}`);
            return false;
        } catch (e) {
            console.error("Error verifying OTP:", e);
            return false;
        }
    }
};

// Export as 'db' for backward compatibility
export const db = database;

