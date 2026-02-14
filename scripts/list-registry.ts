
import { db } from '../lib/db';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function listRegistry() {
    console.log("Listing aya_registry entries...");
    const entities = await db.getAyaEntities(100);
    console.log(`Found ${entities.length} entities.`);
    entities.forEach(e => {
        console.log(`- ${e.legal_name} | URL: ${e.website} | PayloadURL: ${e.asr_payload?.data?.url}`);
    });
}

listRegistry().catch(console.error);
