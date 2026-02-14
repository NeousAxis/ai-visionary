
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

if (!projectId || !clientEmail || !privateKey) {
    console.error('❌ Missing credentials');
    process.exit(1);
}

if (!getApps().length) {
    privateKey = privateKey.replace(/\\n/g, '\n').replace(/\\\\n/g, '\n');
    initializeApp({
        credential: cert({ projectId, clientEmail, privateKey })
    });
}

const db = getFirestore();

async function listRegistry() {
    console.log("Listing aya_registry entries...");
    const snapshot = await db.collection('aya_registry').get();
    console.log(`Found ${snapshot.size} entities.`);
    snapshot.forEach(doc => {
        const e = doc.data();
        console.log(`--- ENTITY: ${doc.id} ---`);
        console.log(JSON.stringify(e, null, 2));
    });
}

listRegistry().catch(console.error);
