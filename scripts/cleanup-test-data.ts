/**
 * Supprime TOUTES les données de test d'un domaine de Firestore
 * Usage: npx ts-node scripts/cleanup-test-data.ts meditationinclusive
 * Collections: analyses, scan_states, aya_registry, otps
 */
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import * as dotenv from 'dotenv';
import path from 'path';

// Load .env.local
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

// Init Firebase Admin
if (!getApps().length) {
    const projectId = process.env.FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    let privateKey = process.env.FIREBASE_PRIVATE_KEY;
    if (privateKey) privateKey = privateKey.replace(/\\n/g, '\n');

    if (!projectId || !clientEmail || !privateKey) {
        console.error('❌ Missing Firebase credentials in .env.local');
        process.exit(1);
    }

    initializeApp({ credential: cert({ projectId, clientEmail, privateKey } as any) });
}

const db = getFirestore();
const TARGET = process.argv[2] || 'api-glossaries';

async function cleanup() {
    let totalDeleted = 0;

    // 1. Collection "analyses" — cherche toutes les variantes d'URL
    console.log('\n🔍 Scanning "analyses" collection...');
    const analysesSnap = await db.collection('analyses').get();
    for (const doc of analysesSnap.docs) {
        const data = doc.data();
        const url = (data.url || '').toLowerCase();
        const id = doc.id.toLowerCase();
        if (url.includes(TARGET) || id.includes(TARGET)) {
            console.log(`  🗑️  Deleting analyses/${doc.id} (url: ${data.url})`);
            await doc.ref.delete();
            totalDeleted++;
        }
    }

    // 2. Collection "scan_states" — base64url variants
    console.log('\n🔍 Scanning "scan_states" collection...');
    const domain = `${TARGET}.com`;
    const scanVariants = [
        domain,
        `http://${domain}`,
        `http://${domain}/`,
        `https://${domain}`,
        `https://${domain}/`,
        `https://www.${domain}`,
        `https://www.${domain}/`,
        `www.${domain}`,
    ];
    for (const variant of scanVariants) {
        const docId = Buffer.from(variant).toString('base64url').substring(0, 128);
        const doc = await db.collection('scan_states').doc(docId).get();
        if (doc.exists) {
            console.log(`  🗑️  Deleting scan_states/${docId} (variant: ${variant})`);
            await doc.ref.delete();
            totalDeleted++;
        }
    }
    // Also scan all scan_states for any URL containing TARGET
    const allScanSnap = await db.collection('scan_states').get();
    for (const doc of allScanSnap.docs) {
        const data = doc.data();
        const url = (data.url || data.normalizedUrl || '').toLowerCase();
        if (url.includes(TARGET)) {
            console.log(`  🗑️  Deleting scan_states/${doc.id} (url: ${url})`);
            await doc.ref.delete();
            totalDeleted++;
        }
    }

    // 3. Collection "aya_registry"
    console.log('\n🔍 Scanning "aya_registry" collection...');
    const ayaSnap = await db.collection('aya_registry').get();
    for (const doc of ayaSnap.docs) {
        const data = doc.data();
        const website = (data.website || '').toLowerCase();
        const id = doc.id.toLowerCase();
        if (website.includes(TARGET) || id.includes(TARGET)) {
            console.log(`  🗑️  Deleting aya_registry/${doc.id} (website: ${data.website})`);
            await doc.ref.delete();
            totalDeleted++;
        }
    }

    // 4. Collection "otps" — au cas où
    console.log('\n🔍 Scanning "otps" collection...');
    const otpSnap = await db.collection('otps').get();
    for (const doc of otpSnap.docs) {
        const data = doc.data();
        if ((data.email || '').includes(TARGET)) {
            console.log(`  🗑️  Deleting otps/${doc.id}`);
            await doc.ref.delete();
            totalDeleted++;
        }
    }

    console.log(`\n✅ Nettoyage terminé — ${totalDeleted} documents supprimés.`);
}

cleanup().catch(err => {
    console.error('❌ Erreur:', err);
    process.exit(1);
});
