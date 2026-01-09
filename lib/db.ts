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
     * Retrieve the latest analysis for a given URL
     */
    getLatestAnalysisByUrl: async (url: string): Promise<AnalysisRecord | null> => {
        const dbInstance = getDb();
        if (!dbInstance) return null;

        try {
            const snapshot = await dbInstance.collection('analyses')
                .where('url', '==', url)
                .orderBy('timestamp', 'desc')
                .limit(1)
                .get();

            if (snapshot.empty) {
                console.log(`⚠️ [Firestore] No analysis found for URL: ${url}`);
                return null;
            }

            const data = snapshot.docs[0].data() as AnalysisRecord;
            console.log(`✅ [Firestore] Latest analysis retrieved for URL: ${url}`);
            return data;
        } catch (error) {
            console.error('❌ [Firestore] Query By URL Error:', error);
            // Fallback: query without sorting if index is missing
            try {
                const snapshot = await dbInstance.collection('analyses')
                    .where('url', '==', url)
                    .limit(1)
                    .get();
                if (!snapshot.empty) return snapshot.docs[0].data() as AnalysisRecord;
            } catch (e) {
                console.error('❌ [Firestore] Fallback Query Error:', e);
            }
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
            const snapshot = await dbInstance.collection('analyses')
                .where('email', '==', email)
                .orderBy('timestamp', 'desc')
                .limit(1)
                .get();

            if (snapshot.empty) {
                console.log(`⚠️ [Firestore] No analysis found for EMAIL: ${email}`);
                return null;
            }

            const data = snapshot.docs[0].data() as AnalysisRecord;
            console.log(`✅ [Firestore] Latest analysis retrieved for EMAIL: ${email}`);
            return data;
        } catch (error) {
            console.error('❌ [Firestore] Query By EMAIL Error:', error);
            // Fallback: query without sorting if index is missing
            try {
                const snapshot = await dbInstance.collection('analyses')
                    .where('email', '==', email)
                    .limit(1)
                    .get();
                if (!snapshot.empty) return snapshot.docs[0].data() as AnalysisRecord;
            } catch (e) {
                console.error('❌ [Firestore] Fallback Query Error:', e);
            }
            return null;
        }
    }
};

// Export as 'db' for backward compatibility
export const db = database;

