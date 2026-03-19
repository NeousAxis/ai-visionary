const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const fs = require('fs');

async function run() {
    console.log("🚀 Lancement de la migration...");

    const trackerDataRaw = fs.readFileSync('ENTREPRISES_FACTICES_A_SUPPRIMER.json', 'utf-8');
    const trackerData = JSON.parse(trackerDataRaw);

    // 1. Supprimer de l'ancienne collection aya_registry_v1 (si elle existe dans Supabase)
    const ids = trackerData.map(item => item.aya_entity_id);
    const BATCH_SIZE = 100;

    for (let i = 0; i < ids.length; i += BATCH_SIZE) {
        const chunk = ids.slice(i, i + BATCH_SIZE);
        const { error } = await supabase
            .from('aya_registry')
            .delete()
            .in('aya_entity_id', chunk);

        if (error) console.error(`⚠️ Batch delete error:`, error.message);
        else console.log(`🗑️ Batch supprime : ${i + chunk.length}`);
    }

    console.log("✅ Migration terminee.");
}

run().catch(console.error);
