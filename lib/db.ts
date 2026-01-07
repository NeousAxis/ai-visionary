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

// Initialize Firebase Admin (singleton pattern)
if (!getApps().length) {
    try {
        // Vercel Environment Variables for Firebase
        console.log('🔧 Initializing Firebase Admin...');
        console.log('📋 FIREBASE_PROJECT_ID:', process.env.FIREBASE_PROJECT_ID ? 'Present ✅' : 'Missing ❌');
        console.log('📋 FIREBASE_CLIENT_EMAIL:', process.env.FIREBASE_CLIENT_EMAIL ? 'Present ✅' : 'Missing ❌');
        console.log('📋 FIREBASE_PRIVATE_KEY:', process.env.FIREBASE_PRIVATE_KEY ? 'Present ✅' : 'Missing ❌');

        // FIX: Handle all possible newline formats in private key
        let privateKey = process.env.FIREBASE_PRIVATE_KEY;
        if (privateKey) {
            // Replace literal \n with actual newlines
            privateKey = privateKey.replace(/\\n/g, '\n');
            // Also handle double backslashes (escaped in some environments)
            privateKey = privateKey.replace(/\\\\n/g, '\n');
        }

        const serviceAccount = {
            projectId: process.env.FIREBASE_PROJECT_ID,
            clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
            privateKey: privateKey
        };

        if (!serviceAccount.projectId || !serviceAccount.clientEmail || !serviceAccount.privateKey) {
            throw new Error('Missing Firebase credentials in environment variables');
        }

        initializeApp({
            credential: cert(serviceAccount as any)
        });

        console.log('✅ Firebase Admin initialized successfully');
    } catch (error) {
        console.error('❌ Firebase Admin initialization failed:', error);
        throw error;
    }
} else {
    console.log('✅ Firebase Admin already initialized (reusing existing app)');
}

// Get Firestore instance
const firestore = getFirestore();

export const database = {
    /**
     * Save or update an analysis record
     */
    saveAnalysis: async (id: string, record: Partial<AnalysisRecord>): Promise<void> => {
        try {
            const docRef = firestore.collection('analyses').doc(id);

            const dataToSave = {
                ...record,
                timestamp: new Date().toISOString(),
                id: id
            };

            await docRef.set(dataToSave, { merge: true });
            console.log(`💾 [Firestore] Analysis saved for ID: ${id}`);
        } catch (error) {
            console.error('❌ [Firestore] Save Error:', error);
            throw error;
        }
    },

    /**
     * Retrieve an analysis record by ID
     */
    getAnalysis: async (id: string): Promise<AnalysisRecord | null> => {
        try {
            const docRef = firestore.collection('analyses').doc(id);
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
            throw error;
        }
    }
};

// Export as 'db' for backward compatibility
export const db = database;

