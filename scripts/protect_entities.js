const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
    console.log("🔍 Recherche des vraies entites...");

    // Fetch all entities
    const { data: allEntities, error } = await supabase
        .from('aya_registry')
        .select('*');

    if (error) {
        console.error("❌ Erreur lecture:", error.message);
        return;
    }

    let realEntities = [];
    let fakeEntities = [];

    (allEntities || []).forEach(entity => {
        if (entity.asr_payload && entity.asr_payload.data && entity.asr_payload.data.isFake) {
            fakeEntities.push(entity);
        } else {
            realEntities.push(entity);
        }
    });

    console.log(`✅ Trouve ${realEntities.length} vraies entites et ${fakeEntities.length} factices.`);

    let timeCursor = Date.now();

    // 1. Les Vraies Entites — mettre en haut (last_update recent)
    for (const entity of realEntities) {
        const { error: updateErr } = await supabase
            .from('aya_registry')
            .update({ last_update: new Date(timeCursor).toISOString() })
            .eq('aya_entity_id', entity.aya_entity_id);

        if (updateErr) console.error(`⚠️ Update error for ${entity.aya_entity_id}:`, updateErr.message);
        timeCursor -= 1000;
    }

    // 2. Trois Fausses entites (pour completer les 6)
    const threeFakes = fakeEntities.slice(0, 3);
    for (const entity of threeFakes) {
        // Remove the isFake flag and update last_update
        const updatedPayload = { ...entity.asr_payload };
        if (updatedPayload.data) {
            delete updatedPayload.data.isFake;
        }

        const { error: updateErr } = await supabase
            .from('aya_registry')
            .update({
                last_update: new Date(timeCursor).toISOString(),
                asr_payload: updatedPayload
            })
            .eq('aya_entity_id', entity.aya_entity_id);

        if (updateErr) console.error(`⚠️ Update error for ${entity.aya_entity_id}:`, updateErr.message);
        timeCursor -= 1000;
    }

    console.log("🚀 Les 3 vraies et 3 fausses ont ete propulsees en haut de la liste ! Le mot 'isFake' a ete efface des 3 fausses visibles.");
}

run().catch(console.error);
