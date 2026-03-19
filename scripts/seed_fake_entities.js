const admin = require('firebase-admin');
const fs = require('fs');
const crypto = require('crypto');

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

const adjectives = ['Global', 'Nexus', 'Optima', 'Prime', 'Apex', 'Core', 'Eon', 'Aegis', 'Vanguard', 'Aurora', 'Zenith', 'Quantum', 'Lumina'];
const nouns = ['Solutions', 'Tech', 'Consulting', 'Health', 'Group', 'Dynamics', 'Partners', 'Systems', 'Ventures', 'Labs', 'Analytics'];
const sectors = ['Construction', 'Santé', 'Finance', 'Technologie', 'Retail', 'Logistique', 'Marketing', 'Legal'];
const countries = ['CH', 'FR', 'BE', 'CA', 'LU'];
const types = ['company', 'association', 'public_body'];

function getRandomItem(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}

function generateFakeEntity() {
    const name = `${getRandomItem(adjectives)} ${getRandomItem(nouns)} ${Math.random() > 0.5 ? 'SA' : 'Sarl'}`;
    const url = `https://www.${name.toLowerCase().replace(/\\s+/g, '')}.com`;
    const entityId = crypto.randomUUID();

    const date = new Date(Date.now() - Math.floor(Math.random() * 30 * 24 * 60 * 60 * 1000));

    return {
        aya_entity_id: entityId,
        legal_name: name,
        display_name: name,
        entity_type: getRandomItem(types),
        country_legal: getRandomItem(countries),
        sector_macro: getRandomItem(sectors),
        website: url,
        asr_score: Math.floor(Math.random() * 51) + 50,
        created_at: date.toISOString(),
        last_update: date.toISOString(),
        valid_until: new Date(date.getTime() + 1000 * 60 * 60 * 24 * 365).toISOString(),
        data_origin: 'AYO',
        asr_payload: {
            version: "1.0",
            data: { isFake: true, message: "Factice entity for AYA registry testing" },
            signature: { hash: "fake-hash", public_key: "ayo-system-v1" }
        },
        recommendability: {
            machine_readable: true,
            status: 'fresh',
            freshness_score: 1.0,
            priority_level: 'normal',
            source_url: `https://www.ai-visionary.com/aya/e/${entityId}`
        }
    };
}

async function run() {
    console.log("🚀 Regénération des 1973 entreprises factices dans aya_registry...");

    const TOTAL_ENTITIES = 1973;
    const entities = [];
    const trackerData = [];

    for (let i = 0; i < TOTAL_ENTITIES; i++) {
        const entity = generateFakeEntity();
        entities.push(entity);
        trackerData.push({
            name: entity.display_name,
            url: entity.website,
            aya_entity_id: entity.aya_entity_id
        });
    }

    fs.writeFileSync('ENTREPRISES_FACTICES_A_SUPPRIMER.json', JSON.stringify(trackerData, null, 2));

    const BATCH_SIZE = 400;
    for (let i = 0; i < entities.length; i += BATCH_SIZE) {
        const batch = db.batch();
        const chunk = entities.slice(i, i + BATCH_SIZE);

        chunk.forEach(entity => {
            const ref = db.collection('aya_registry').doc(entity.aya_entity_id);
            batch.set(ref, entity);
        });

        await batch.commit();
        console.log(`📦 Batch inséré (aya_registry) : de ${i + 1} à ${Math.min(i + BATCH_SIZE, entities.length)}`);
    }

    console.log("🎉 SUCCESS: 1973 entreprises ajoutées dans aya_registry.");
}

run().catch(console.error);
