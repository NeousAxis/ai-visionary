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
        } catch (e) {
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
            // First try exact match
            let snapshot = await dbInstance.collection('analyses')
                .where('url', '==', url)
                .orderBy('timestamp', 'desc')
                .limit(5) // Fetch a few to filter out empty ones in code
                .get();

            if (!snapshot.empty) {
                // Return the first one that has actual data
                for (const doc of snapshot.docs) {
                    const data = doc.data() as AnalysisRecord;
                    if (data.data?.fields || data.score) {
                        console.log(`✅ [Firestore] Analysis retrieved for URL (latest with data): ${url}`);
                        return data;
                    }
                }
                // Fallback to first one if none have data (though unlikely to be useful)
                return snapshot.docs[0].data() as AnalysisRecord;
            }

            // If exact match fails, try common URL variants (NO full collection scan)
            const normalizedSearch = database.normalizeUrl(url);
            console.log(`🔍 Trying URL variants for: ${normalizedSearch}`);

            const variants = [
                `https://${normalizedSearch}`,
                `https://www.${normalizedSearch}`,
                `http://${normalizedSearch}`,
                `${url}/`,
                url.replace(/\/$/, ''),
            ];

            for (const variant of variants) {
                if (variant === url) continue; // Skip already tried
                const variantSnapshot = await dbInstance.collection('analyses')
                    .where('url', '==', variant)
                    .orderBy('timestamp', 'desc')
                    .limit(1)
                    .get();
                if (!variantSnapshot.empty) {
                    const data = variantSnapshot.docs[0].data() as AnalysisRecord;
                    if (data.data?.fields || data.score) {
                        console.log(`✅ [Firestore] Analysis found via variant: ${variant}`);
                        return data;
                    }
                }
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
            // SIMPLIFIED: Removed orderBy to avoid "Index Link" error
            const snapshot = await dbInstance.collection('analyses')
                .where('email', '==', email)
                .orderBy('timestamp', 'desc')
                .limit(5)
                .get();

            if (snapshot.empty) {
                console.log(`⚠️ [Firestore] No analysis found for EMAIL: ${email}`);
                return null;
            }

            for (const doc of snapshot.docs) {
                const data = doc.data() as AnalysisRecord;
                if (data.data?.fields || data.score) {
                    console.log(`✅ [Firestore] Analysis retrieved for EMAIL (latest with data): ${email}`);
                    return data;
                }
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
                .orderBy('last_update', 'desc')
                .limit(limit)
                .get();

            if (snapshot.empty) return [];

            return snapshot.docs.map(doc => doc.data());
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

