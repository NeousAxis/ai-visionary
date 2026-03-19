require('dotenv').config({ path: '.env.local' });
const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
let pk = process.env.FIREBASE_PRIVATE_KEY || '';
pk = pk.replace(/\\n/g, '\n').replace(/\\\\n/g, '\n');
initializeApp({ credential: cert({ projectId: process.env.FIREBASE_PROJECT_ID, clientEmail: process.env.FIREBASE_CLIENT_EMAIL, privateKey: pk }) });
const db = getFirestore();

(async () => {
  // 1. Check webhook_debug logs for latest webhook
  const logs = await db.collection('webhook_debug').orderBy('timestamp', 'desc').limit(10).get();
  console.log('=== WEBHOOK LOGS (last 10) ===');
  logs.docs.forEach(d => {
    const data = d.data();
    console.log(d.id, '|', data.step, '|', (data.message || '').substring(0, 150));
  });

  // 2. Check analyses collection for eclore
  console.log('\n=== ANALYSES WITH eclore (www) ===');
  const all = await db.collection('analyses').where('url', '>=', 'https://www.eclore').where('url', '<=', 'https://www.eclore\uf8ff').limit(10).get();
  all.docs.forEach(d => {
    const data = d.data();
    const hasFields = data.data && data.data.fields && Object.keys(data.data.fields).length > 0;
    console.log(d.id, '| score:', data.score, '| email:', data.email, '| hasFields:', hasFields, '| keys:', Object.keys(data).join(','));
  });

  // 3. Also check without www
  console.log('\n=== ANALYSES WITH eclore (no www) ===');
  const all2 = await db.collection('analyses').where('url', '>=', 'https://eclore').where('url', '<=', 'https://eclore\uf8ff').limit(10).get();
  all2.docs.forEach(d => {
    const data = d.data();
    const hasFields = data.data && data.data.fields && Object.keys(data.data.fields).length > 0;
    console.log(d.id, '| score:', data.score, '| email:', data.email, '| hasFields:', hasFields, '| keys:', Object.keys(data).join(','));
  });

  // 4. Check ALL analyses docs (latest 5)
  console.log('\n=== LATEST 5 ANALYSES ===');
  const latest = await db.collection('analyses').orderBy('timestamp', 'desc').limit(5).get();
  latest.docs.forEach(d => {
    const data = d.data();
    const hasFields = data.data && data.data.fields && Object.keys(data.data.fields).length > 0;
    console.log(d.id, '| score:', data.score, '| url:', data.url, '| email:', data.email, '| hasFields:', hasFields);
  });

  process.exit(0);
})();
