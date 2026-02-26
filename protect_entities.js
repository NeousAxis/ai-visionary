const admin = require('firebase-admin');
const fs = require('fs');

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
    console.log("🔍 Recherche des vraies entités...");
    const snap = await db.collection('aya_registry').get();

    let realEntities = [];
    let fakeEntities = [];

    snap.forEach(doc => {
        const data = doc.data();
        if (data.asr_payload && data.asr_payload.data && data.asr_payload.data.isFake) {
            fakeEntities.push(doc);
        } else {
            realEntities.push(doc);
        }
    });

    console.log(`✅ Trouvé ${realEntities.length} vraies entités et ${fakeEntities.length} factices.`);

    // On va mettre les vraies entités en "tout en haut" (maintenant)
    let timeCursor = Date.now();

    const batch = db.batch();

    // 1. Les Vraies Entités
    for (const doc of realEntities) {
        // Remove trace from the top real entities just in case
        batch.update(doc.ref, { last_update: new Date(timeCursor).toISOString() });
        timeCursor -= 1000; // Recule d'1 seconde pour la suivante
    }

    // 2. Trois Fausses entités (pour compléter les 6)
    const threeFakes = fakeEntities.slice(0, 3);
    for (const doc of threeFakes) {
        // Remove the isFake attribute for these 3 from the database so there is absolutely NO LEAK even if db is directly read
        const data = doc.data();
        data.asr_payload.data.isFake = admin.firestore.FieldValue.delete();
        batch.update(doc.ref, {
            last_update: new Date(timeCursor).toISOString(),
            'asr_payload.data.isFake': admin.firestore.FieldValue.delete()
        });
        timeCursor -= 1000;
    }

    await batch.commit();
    console.log("🚀 Les 3 vraies et 3 fausses ont été propulsées en haut de la liste ! Le mot 'isFake' a été effacé des 3 fausses visibles.");
}

run().catch(console.error);
