import { db } from './lib/db';

async function run() {
    try {
        console.log("Searching for globalworkflow.xyz...");
        
        let found = false;
        const targetUrl = 'globalworkflow.xyz';
        
        const entity = await db.getAyaEntityByUrl(targetUrl);
        if (entity && entity.aya_entity_id) {
            console.log("Found entity via direct URL:", entity.aya_entity_id);
            const admin = require('firebase-admin');
            const fireDB = admin.firestore();
            await fireDB.collection('aya_registry_v1').doc(entity.aya_entity_id).delete();
            console.log("Deleted ghost entity.");
            found = true;
        }

        const targetUrlHttps = 'https://globalworkflow.xyz';
        const entity2 = await db.getAyaEntityByUrl(targetUrlHttps);
        if (entity2 && entity2.aya_entity_id) {
            console.log("Found entity via internal getAyaEntityByUrl:", entity2.aya_entity_id);
            const admin = require('firebase-admin');
            const fireDB = admin.firestore();
            await fireDB.collection('aya_registry_v1').doc(entity2.aya_entity_id).delete();
            console.log("Deleted ghost entity.");
            found = true;
        }

        if (!found) {
            console.log("No ghost entity found.");
        }
    } catch (e) {
        console.error("Error:", e);
    }
}
run();
