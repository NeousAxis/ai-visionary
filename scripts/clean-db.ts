import { getFirestore } from 'firebase-admin/firestore';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import * as dotenv from 'dotenv';
import * as fs from 'fs';

let envPath = '.env.production.local';
if (!fs.existsSync(envPath)) envPath = '.env.local';

dotenv.config({ path: envPath });

async function cleanEclore() {
    console.log('🔧 Initializing Firebase Admin...');
    const projectId = process.env.FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    let privateKey = process.env.FIREBASE_PRIVATE_KEY;

    if (projectId && clientEmail && privateKey) {
        if (privateKey.startsWith('"') && privateKey.endsWith('"')) {
            privateKey = privateKey.slice(1, -1);
        }
        privateKey = privateKey.replace(/\\n/g, '\n').replace(/\\\\n/g, '\n');

        try {
            initializeApp({
                credential: cert({ projectId, clientEmail, privateKey })
            });

            const db = getFirestore();
            const docs = await db.collection('aya_registry').where('website', '==', 'https://www.eclore-asso.org').get();
            if (docs.empty) {
                console.log('No documents found for eclore-asso.org');
            } else {
                for (const doc of docs.docs) {
                    console.log(`Deleting doc ${doc.id}`);
                    await doc.ref.delete();
                }
                console.log('Cleanup successful (eclore-asso.org)');
            }

            const docs2 = await db.collection('aya_registry').where('website', '==', 'https://eclore-asso.org').get();
            if (!docs2.empty) {
                for (const doc2 of docs2.docs) {
                    console.log(`Deleting doc ${doc2.id}`);
                    await doc2.ref.delete();
                }
            }

        } catch (e) {
            console.error(e);
        }
    } else {
        console.log('Missing env variables');
    }
}

cleanEclore().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
