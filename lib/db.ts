import fs from 'fs';
import path from 'path';

// Simulation d'une DB persistante via le système de fichiers (fonctionne sur /tmp en serverless pour des sessions courtes)
// En production lourde, ceci devrait être remplacé par Vercel KV (Redis) ou Postgres.

const DB_PATH = '/tmp/ayo_analysis_db.json';

type AnalysisRecord = {
    id: string; // The Analysis ID (passed as client_reference_id)
    url: string;
    email: string | null;
    score: number;
    data: any; // The Full JSON-LD / Analysis data
    timestamp: string;
};

// Initialiser DB si besoin
function initDB() {
    if (!fs.existsSync(DB_PATH)) {
        fs.writeFileSync(DB_PATH, JSON.stringify({}));
    }
}

export const db = {
    saveAnalysis: async (id: string, record: Partial<AnalysisRecord>) => {
        try {
            initDB();
            const current = JSON.parse(fs.readFileSync(DB_PATH, 'utf-8'));
            const updated = {
                ...current,
                [id]: { ...current[id], ...record, timestamp: new Date().toISOString() }
            };
            fs.writeFileSync(DB_PATH, JSON.stringify(updated));
            console.log(`💾 [DB] Analysis saved for ID: ${id}`);
        } catch (e) {
            console.error("❌ DB Save Error:", e);
        }
    },

    getAnalysis: async (id: string): Promise<AnalysisRecord | null> => {
        try {
            initDB();
            const current = JSON.parse(fs.readFileSync(DB_PATH, 'utf-8'));
            return current[id] || null;
        } catch (e) {
            console.error("❌ DB Read Error:", e);
            return null;
        }
    }
};
