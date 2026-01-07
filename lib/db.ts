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
        const serviceAccount = {
            projectId: process.env.FIREBASE_PROJECT_ID,
            clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
            privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n')
        };

        initializeApp({
            credential: cert(serviceAccount as any)
        });

        console.log('✅ Firebase Admin initialized');
    } catch (error) {
        console.error('❌ Firebase Admin initialization failed:', error);
        throw error;
    }
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

