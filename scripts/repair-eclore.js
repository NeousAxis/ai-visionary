
const { initializeApp, cert, getApps } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const fs = require('fs');

// Manual .env.local loader
const envLocal = fs.readFileSync('.env.local', 'utf8');
envLocal.split('\n').forEach(line => {
    const parts = line.split('=');
    if (parts.length >= 2) {
        process.env[parts[0].trim()] = parts.slice(1).join('=').trim().replace(/^"(.*)"$/, '$1');
    }
});

const projectId = process.env.FIREBASE_PROJECT_ID;
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
let privateKey = process.env.FIREBASE_PRIVATE_KEY;

if (!getApps().length) {
    privateKey = privateKey.replace(/\\n/g, '\n').replace(/\\\\n/g, '\n');
    initializeApp({
        credential: cert({ projectId, clientEmail, privateKey })
    });
}

const db = getFirestore();

async function repairEclore() {
    const entityId = "acc6c0e7-5a16-4a0e-abf2-74ea11a5f2cc";
    const website = "https://www.eclore-asso.org";

    console.log(`🔧 Repairing Eclore record (${entityId})...`);
    await db.collection('aya_registry').doc(entityId).update({
        website: website,
        "asr_payload.data.url": website
    });
    console.log("✅ Eclore record repaired with URL.");
}

repairEclore().catch(console.error);
