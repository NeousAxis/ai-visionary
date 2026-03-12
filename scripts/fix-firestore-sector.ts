#!/usr/bin/env npx tsx
/**
 * Fix Firestore AYA registry entries with placeholder sector_macro values
 * Scans all entities, finds "Type Schema.org" and similar placeholders,
 * replaces with first service or fallback
 */

import '@/lib/db';
import { getFirestore } from 'firebase-admin/firestore';

const PLACEHOLDER_RE = /^(type schema\.?org|schema\.?org|organisation|organization|non spécifié|n\/a|undefined|null|general)$/i;

async function fixSectors() {
    const firestore = getFirestore();
    const snapshot = await firestore.collection('aya_registry').get();

    console.log(`Found ${snapshot.size} entities in aya_registry\n`);

    let fixed = 0;
    let skipped = 0;

    for (const doc of snapshot.docs) {
        const data = doc.data();
        const name = data.display_name || data.legal_name || doc.id;
        const currentSector = data.sector_macro || '';

        if (PLACEHOLDER_RE.test(currentSector.trim())) {
            // Try to find a better value from asr_payload
            const ext = data.asr_payload?.data;
            const businessType = ext?.identite?.business_type?.value;
            const firstService = Array.isArray(ext?.offre?.services?.value)
                ? ext.offre.services.value[0]
                : null;

            // Pick best replacement
            let newSector: string | null = null;
            if (businessType && !PLACEHOLDER_RE.test(businessType.trim())) {
                newSector = businessType;
            } else if (firstService) {
                newSector = firstService;
            }

            if (newSector) {
                console.log(`[FIX] ${name}: "${currentSector}" → "${newSector}"`);
                await firestore.collection('aya_registry').doc(doc.id).update({
                    sector_macro: newSector
                });
                fixed++;
            } else {
                console.log(`[SKIP] ${name}: "${currentSector}" — no better value found, keeping as is`);
                skipped++;
            }
        } else {
            console.log(`[OK] ${name}: "${currentSector}"`);
        }
    }

    console.log(`\n--- Done: ${fixed} fixed, ${skipped} skipped ---`);
}

fixSectors().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});
