const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const fs = require('fs');
const crypto = require('crypto');

// 1. SUPPRIMER LES ANCIENNES ENTITES FACTICES
async function cleanOldFakeEntities() {
    console.log("🧹 Suppression des anciennes entreprises factices...");
    try {
        const trackerDataRaw = fs.readFileSync('ENTREPRISES_FACTICES_A_SUPPRIMER.json', 'utf-8');
        const trackerData = JSON.parse(trackerDataRaw);

        const ids = trackerData.map(item => item.aya_entity_id);

        // Supabase delete with IN filter (batch by 100)
        const BATCH_SIZE = 100;
        for (let i = 0; i < ids.length; i += BATCH_SIZE) {
            const chunk = ids.slice(i, i + BATCH_SIZE);
            const { error } = await supabase
                .from('aya_registry')
                .delete()
                .in('aya_entity_id', chunk);

            if (error) console.error(`⚠️ Batch delete error:`, error.message);
            else console.log(`🗑️ Batch efface : ${i + chunk.length} supprimes.`);
        }
        console.log("✅ Anciennes entreprises factices effacees de la base de donnees.");
    } catch (e) {
        console.error("⚠️ Impossible de lire ou supprimer via l'ancien fichier tracker :", e.message);
    }
}

// 2. GENERER DES NOMS UNIQUES
const prefixes = [
    "Montblanc", "Leman", "Rhone", "Cervin", "Helvetia", "Alpen", "Lombard", "Edelweiss", "Jura", "Gruyere",
    "Odin", "Acero", "Vertex", "Solstice", "Equinox", "Meridian", "Horizon", "Pinnacle", "Aura", "Nova",
    "Pulse", "Vanguard", "Catalyst", "Zenith", "Apex", "Omni", "Core", "Nexis", "Synergy", "Quantum",
    "Alpha", "Omega", "Echo", "Atlas", "Titan", "Orion", "Lyra", "Cygnus", "Aria", "Terra",
    "Aero", "Aqua", "Lumina", "Ignis", "Aether", "Chronos", "Kudos", "Valor", "Fortis", "Strata",
    "Prisma", "Crest", "Summit", "Coda", "Delta", "Sigma", "Nexus", "Eon", "Aegis", "Flux",
    "Vector", "Pivot", "Axiom", "Paradigm", "Matrix", "Helix", "Radius", "Polygon", "Sphere", "Node",
    "Link", "Mesh", "Grid", "Flow", "Stream", "Wave", "Tide", "Peak", "Ridge", "Cliff",
    "Dune", "Grove", "Vale", "Brook", "Cove", "Bay", "Port", "Haven", "Shore", "Isle",
    "Reef", "Cape", "Peninsula", "Estuary", "Fjord", "Glacier", "Tundra", "Taiga", "Savannah", "Oasis",
    "Mirage", "Canyon", "Valley", "Plateau", "Mesa", "Butte", "Crag", "Spire", "Tower", "Bastion",
    "Citadel", "Keep", "Vault", "Archive", "Forge", "Foundry", "Mill", "Loom", "Kiln", "Atrium",
    "Forum", "Agora", "Plaza", "Market", "Bazaar", "Exchange", "Global", "Optima", "Prime"
];

const suffixes = [
    "Tech", "Industries", "Consulting", "Groupe", "Partners", "Invest", "Innovations", "Solutions",
    "Services", "Digital", "Conseil", "Design", "Logistics", "Media", "Finance", "Capital",
    "Dynamics", "Systems", "Ventures", "Labs", "Analytics", "Operations", "Management", "Strategy",
    "Holdings", "Enterprises", "Resources", "Networks", "Security", "Technologies", "Productions",
    "Vision", "Concept", "Studio", "Architecture", "Engineering", "Construct", "Medical", "Pharma"
];

const sectors = ['Construction', 'Sante', 'Finance', 'Technologie', 'Retail', 'Logistique', 'Marketing', 'Legal', 'Immobilier', 'Industrie'];
const countries = ['CH', 'CH', 'CH', 'FR', 'FR', 'BE', 'LU', 'CA'];
const types = ['company', 'company', 'company', 'association'];

function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

const allCombinations = [];
for (const p of prefixes) {
    for (const s of suffixes) {
        allCombinations.push(`${p} ${s}`);
    }
}
shuffleArray(allCombinations);

function generate1973FakeEntities() {
    const TOTAL = 1973;
    const names = allCombinations.slice(0, TOTAL);

    const entities = [];
    for (let i = 0; i < TOTAL; i++) {
        const suffixLegal = Math.random() > 0.5 ? 'SA' : (Math.random() > 0.5 ? 'Sarl' : 'GmbH');
        const name = `${names[i]} ${suffixLegal}`;
        const cleanName = names[i].toLowerCase().replace(/[^a-z0-9]/g, '');
        const url = `https://www.${cleanName}.com`;
        const entityId = crypto.randomUUID();
        const date = new Date(Date.now() - Math.floor(Math.random() * 30 * 24 * 60 * 60 * 1000));

        entities.push({
            aya_entity_id: entityId,
            legal_name: name,
            display_name: name,
            entity_type: types[Math.floor(Math.random() * types.length)],
            country_legal: countries[Math.floor(Math.random() * countries.length)],
            sector_macro: sectors[Math.floor(Math.random() * sectors.length)],
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
        });
    }
    return entities;
}

// 3. EXECUTION
async function run() {
    // A. Clean
    await cleanOldFakeEntities();

    // B. Generate
    console.log("🚀 Generation de 1973 nouvelles entreprises (NOMS 100% UNIQUES)...");
    const entities = generate1973FakeEntities();

    const trackerData = entities.map(e => ({
        name: e.display_name,
        url: e.website,
        aya_entity_id: e.aya_entity_id
    }));

    fs.writeFileSync('ENTREPRISES_FACTICES_A_SUPPRIMER.json', JSON.stringify(trackerData, null, 2));
    console.log("✅ Nouveau fichier de suivi reecrit : ENTREPRISES_FACTICES_A_SUPPRIMER.json");

    // C. Upload via Supabase upsert (batch by 100)
    const BATCH_SIZE = 100;
    for (let i = 0; i < entities.length; i += BATCH_SIZE) {
        const chunk = entities.slice(i, i + BATCH_SIZE);
        const { error } = await supabase
            .from('aya_registry')
            .upsert(chunk, { onConflict: 'aya_entity_id' });

        if (error) console.error(`⚠️ Batch insert error:`, error.message);
        else console.log(`📦 Batch insere (aya_registry) : de ${i + 1} a ${Math.min(i + BATCH_SIZE, entities.length)}`);
    }

    console.log("🎉 SUCCESS: 1973 entreprises factices uniques ajoutees dans aya_registry.");
}

run().catch(console.error);
