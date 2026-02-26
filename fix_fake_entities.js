const admin = require('firebase-admin');
const fs = require('fs');

// Load environment variables manually
const envFile = fs.readFileSync('.env.local', 'utf-8');
envFile.split('\n').forEach(line => {
    const match = line.match(/^([^=]+)="?(.*?)"?$/);
    if (match) {
        process.env[match[1]] = match[2];
    }
});

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert({
            projectId: process.env.FIREBASE_PROJECT_ID,
            clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
            privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n')
        })
    });
}
const db = admin.firestore();

async function run() {
    console.log("🚀 Lancement de la migration...");

    const trackerDataRaw = fs.readFileSync('ENTREPRISES_FACTICES_A_SUPPRIMER.json', 'utf-8');
    const trackerData = JSON.parse(trackerDataRaw);

    const BATCH_SIZE = 400;

    // 1. D'abord, on supprime de l'ancienne mauvaise collection (aya_registry_v1)
    for (let i = 0; i < trackerData.length; i += BATCH_SIZE) {
        const batch = db.batch();
        const chunk = trackerData.slice(i, i + BATCH_SIZE);

        for (const item of chunk) {
            const ref = db.collection('aya_registry_v1').doc(item.aya_entity_id);
            batch.delete(ref);
        }
        await batch.commit();
        console.log(`🗑️ Batch supprimé de aya_registry_v1 : ${i + chunk.length}`);
    }

    // 2. Et on lit les 1973 pour les insérer dans 'aya_registry' -- Wait, trackerData doesn't have the fully populated data, does it?
    // Let's just regenerate them correctly!
}

run().catch(console.error);
