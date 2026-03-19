const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
require('dotenv').config({ path: '.env.local' });
const sa = { projectId: process.env.FIREBASE_PROJECT_ID, clientEmail: process.env.FIREBASE_CLIENT_EMAIL, privateKey: (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n') };
initializeApp({ credential: cert(sa) });
const fdb = getFirestore();
(async () => {
    const logs = await fdb.collection('system_logs').orderBy('timestamp', 'desc').limit(20).get();
    logs.forEach(doc => {
        const d = doc.data();
        console.log(`[${d.level}] ${d.step}: ${d.message} | ${JSON.stringify(d.data || {}).substring(0, 200)}`);
    });
    process.exit(0);
})();
