const admin = require('firebase-admin');

// Ensure we have env vars initialized, but we might just use the existing service account JSON
require('dotenv').config({ path: '.env.local' });
if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert({
            projectId: process.env.FIREBASE_PROJECT_ID,
            clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
            privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n')
        })
    });
}
const fireDB = admin.firestore();

async function run() {
    try {
        console.log("Searching for globalworkflow.xyz...");
        const snapshot = await fireDB.collection('aya_registry_v1').where('website', '==', 'https://globalworkflow.xyz').get();
        if (!snapshot.empty) {
            for (const doc of snapshot.docs) {
                console.log("Found entity:", doc.id);
                await doc.ref.delete();
                console.log("Deleted ghost entity.");
            }
        } else {
            console.log("No entity found for https://globalworkflow.xyz");
        }

        // Search also for "globalworkflow.xyz" without https
        const snapshot2 = await fireDB.collection('aya_registry_v1').where('website', '==', 'globalworkflow.xyz').get();
        if (!snapshot2.empty) {
            for (const doc of snapshot2.docs) {
                console.log("Found entity:", doc.id);
                await doc.ref.delete();
                console.log("Deleted ghost entity.");
            }
        } else {
            console.log("No entity found for globalworkflow.xyz");
        }

    } catch (e) {
        console.error("Error:", e);
    }
}
run();
