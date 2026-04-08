const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const fs = require('fs');
const crypto = require('crypto');

const adjectives = ['Global', 'Nexus', 'Optima', 'Prime', 'Apex', 'Core', 'Eon', 'Aegis', 'Vanguard', 'Aurora', 'Zenith', 'Quantum', 'Lumina'];
const nouns = ['Solutions', 'Tech', 'Consulting', 'Health', 'Group', 'Dynamics', 'Partners', 'Systems', 'Ventures', 'Labs', 'Analytics'];
const sectors = ['Construction', 'Sante', 'Finance', 'Technologie', 'Retail', 'Logistique', 'Marketing', 'Legal'];
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
            source_url: `https://www.ai-visionary.xyz/aya/e/${entityId}`
        }
    };
}

async function run() {
    console.log("🚀 Regeneration des 1973 entreprises factices dans aya_registry...");

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

    // Supabase upsert (batch by 100)
    const BATCH_SIZE = 100;
    for (let i = 0; i < entities.length; i += BATCH_SIZE) {
        const chunk = entities.slice(i, i + BATCH_SIZE);
        const { error } = await supabase
            .from('aya_registry')
            .upsert(chunk, { onConflict: 'aya_entity_id' });

        if (error) console.error(`⚠️ Batch insert error:`, error.message);
        else console.log(`📦 Batch insere (aya_registry) : de ${i + 1} a ${Math.min(i + BATCH_SIZE, entities.length)}`);
    }

    console.log("🎉 SUCCESS: 1973 entreprises ajoutees dans aya_registry.");
}

run().catch(console.error);
