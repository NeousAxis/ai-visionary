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
                .limit(1)
                .get();

            if (!snapshot.empty) {
                const data = snapshot.docs[0].data() as AnalysisRecord;
                console.log(`✅ [Firestore] Analysis retrieved for URL (exact): ${url}`);
                return data;
            }

            // If exact match fails, try normalized search
            const normalizedSearch = database.normalizeUrl(url);
            console.log(`🔍 Trying normalized search: ${normalizedSearch}`);

            // Get all analyses and filter manually (since we can't query on normalized field)
            const allDocs = await dbInstance.collection('analyses').get();

            for (const doc of allDocs.docs) {
                const data = doc.data() as AnalysisRecord;
                if (data.url && database.normalizeUrl(data.url) === normalizedSearch) {
                    console.log(`✅ [Firestore] Analysis found via normalization: ${data.url} → ${normalizedSearch}`);
                    return data;
                }
            }

            console.log(`⚠️ [Firestore] No analysis found for URL: ${url} (tried normalized too)`);
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
                .limit(1)
                .get();

            if (snapshot.empty) {
                console.log(`⚠️ [Firestore] No analysis found for EMAIL: ${email}`);
                return null;
            }

            const data = snapshot.docs[0].data() as AnalysisRecord;
            console.log(`✅ [Firestore] Analysis retrieved for EMAIL: ${email}`);
            return data;
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
    }
};

// Export as 'db' for backward compatibility
export const db = database;

