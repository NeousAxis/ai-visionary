const { getFirestore } = require('firebase-admin/firestore');
const { initializeApp, getApps, cert } = require('firebase-admin/app');
require('dotenv').config({ path: '.env.local' });

async function check() {
    initializeApp({
        credential: cert({
            projectId: process.env.FIREBASE_PROJECT_ID,
            clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
            privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
        })
    });
    const db = getFirestore();
    const snapshot = await db.collection('aya_registry').get();
    const matching = snapshot.docs.filter(d => JSON.stringify(d.data()).includes('eclore-asso'));
    console.log(`Found ${matching.length} matching entries`);
    matching.forEach(d => console.log(d.id, d.data().website));
}
check();
