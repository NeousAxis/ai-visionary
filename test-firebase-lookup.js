/**
 * 🧪 TEST LOCAL FIREBASE LOOKUP
 * 
 * Ce script teste si Firebase peut retrouver vos analyses.
 * 
 * Usage:
 * node test-firebase-lookup.js EMAIL_TEST@DOMAINE.com
 */

const { initializeApp, cert, getApps } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
require('dotenv').config({ path: '.env.local' });

const testEmail = process.argv[2] || 'test@ai-visionary.com';

console.log('🔍 TEST FIREBASE LOOKUP');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
console.log(`📧 Email de test: ${testEmail}\n`);

// 1. Check Firebase credentials
const projectId = process.env.FIREBASE_PROJECT_ID;
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
let privateKey = process.env.FIREBASE_PRIVATE_KEY;

console.log('1️⃣ Vérification des credentials Firebase:');
console.log(`   Project ID: ${projectId ? '✅' : '❌'}`);
console.log(`   Client Email: ${clientEmail ? '✅' : '❌'}`);
console.log(`   Private Key: ${privateKey ? '✅' : '❌'}\n`);

if (!projectId || !clientEmail || !privateKey) {
    console.error('❌ ERREUR: Credentials Firebase manquants dans .env.local\n');
    process.exit(1);
}

// 2. Initialize Firebase
console.log('2️⃣ Initialisation Firebase...');
try {
    if (!getApps().length) {
        privateKey = privateKey.replace(/\\n/g, '\n').replace(/\\\\n/g, '\n');
        initializeApp({
            credential: cert({
                projectId,
                clientEmail,
                privateKey
            })
        });
    }
    console.log('   ✅ Firebase initialisé\n');
} catch (error) {
    console.error('   ❌ ERREUR:', error.message, '\n');
    process.exit(1);
}

const db = getFirestore();

// 3. Extract domain
const emailDomain = testEmail.split('@')[1]?.toLowerCase();
console.log('3️⃣ Extraction du domaine:');
console.log(`   Email: ${testEmail}`);
console.log(`   Domaine: ${emailDomain}\n`);

// 4. Test lookups
async function testLookup() {
    const urls = [
        `https://${emailDomain}`,
        `http://${emailDomain}`,
        emailDomain,
        `www.${emailDomain}`,
        `https://www.${emailDomain}`
    ];

    console.log('4️⃣ Test de recherche dans Firebase:\n');

    for (const url of urls) {
        try {
            console.log(`   🔎 Recherche: "${url}"`);
            const snapshot = await db.collection('analyses')
                .where('url', '==', url)
                .limit(1)
                .get();

            if (!snapshot.empty) {
                const doc = snapshot.docs[0];
                const data = doc.data();
                console.log(`   ✅ TROUVÉ!`);
                console.log(`      ID: ${doc.id}`);
                console.log(`      URL stockée: ${data.url}`);
                console.log(`      Email: ${data.email || 'null'}`);
                console.log(`      Score: ${data.score}`);
                console.log(`      Timestamp: ${data.timestamp}`);
                console.log(`      Domaines match: ${data.url === url ? '✅' : '❌'}\n`);
                return data;
            } else {
                console.log(`   ❌ Rien trouvé\n`);
            }
        } catch (error) {
            console.log(`   ⚠️ Erreur: ${error.message}\n`);
        }
    }

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log('❌ DIAGNOSTIC: Aucune analyse trouvée dans Firebase\n');
    console.log('🔧 SOLUTIONS POSSIBLES:');
    console.log('   1. Vérifiez que vous avez bien fait une analyse via le chatbot AYO');
    console.log('   2. Vérifiez que Firebase enregistre bien les données (logs Vercel)');
    console.log('   3. Listez toutes les analyses pour voir ce qui est stocké:\n');
    console.log('      Aller sur Firebase Console > Firestore > Collection "analyses"\n');

    // List all analyses
    console.log('5️⃣ Liste de TOUTES les analyses stockées:\n');
    try {
        const allDocs = await db.collection('analyses').limit(10).get();
        if (allDocs.empty) {
            console.log('   ⚠️ AUCUNE analyse dans la base de données!\n');
        } else {
            allDocs.forEach(doc => {
                const data = doc.data();
                console.log(`   📄 ${doc.id}`);
                console.log(`      URL: ${data.url}`);
                console.log(`      Email: ${data.email || 'null'}`);
                console.log(`      Score: ${data.score}`);
                console.log(`      Date: ${data.timestamp}\n`);
            });
        }
    } catch (error) {
        console.error('   ❌ Erreur listage:', error.message, '\n');
    }

    return null;
}

testLookup()
    .then(() => {
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('✅ Test terminé\n');
        process.exit(0);
    })
    .catch(error => {
        console.error('❌ ERREUR FATALE:', error);
        process.exit(1);
    });
