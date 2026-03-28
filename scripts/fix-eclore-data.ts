/**
 * Fix Éclore data in Supabase
 * - Restore original client description (gemini_description_fr)
 * - Fix contact_email to Stripe payer email
 *
 * Usage: npx tsx scripts/fix-eclore-data.ts
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const ECLORE_ENTITY_ID = 'f4bbbde8-5520-448b-8dc7-78a86af2e0ce';

const CORRECT_DESCRIPTION_FR = "L'Association Éclore est un Bureau Conseil en Imagination Collective et Prospective Sociale & Environnementale basé à Genève. Elle propose des Ateliers de la Transition et de la Coopération pour les entreprises, communes, administrations et citoyens en Suisse Romande.";

const CORRECT_CONTACT_EMAIL = 'cyril@eclore-asso.org';

async function main() {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
        console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
        process.exit(1);
    }

    const supabase = createClient(url, key);

    // 1. Read current data
    const { data: entity, error: readErr } = await supabase
        .from('aya_registry')
        .select('*')
        .eq('entity_id', ECLORE_ENTITY_ID)
        .single();

    if (readErr || !entity) {
        console.error('Entity not found:', readErr);
        process.exit(1);
    }

    console.log('Current contact_email:', entity.contact_email);
    console.log('Current gemini_description_fr:', entity.asr_payload?.enrichment?.gemini_description_fr || 'N/A');

    // 2. Update gemini_description_fr in asr_payload
    const updatedPayload = { ...entity.asr_payload };
    if (!updatedPayload.enrichment) updatedPayload.enrichment = {};
    updatedPayload.enrichment.gemini_description_fr = CORRECT_DESCRIPTION_FR;

    // 3. Write back
    const { error: updateErr } = await supabase
        .from('aya_registry')
        .update({
            contact_email: CORRECT_CONTACT_EMAIL,
            asr_payload: updatedPayload,
        })
        .eq('entity_id', ECLORE_ENTITY_ID);

    if (updateErr) {
        console.error('Update failed:', updateErr);
        process.exit(1);
    }

    console.log('✅ Éclore data fixed:');
    console.log('   contact_email →', CORRECT_CONTACT_EMAIL);
    console.log('   gemini_description_fr →', CORRECT_DESCRIPTION_FR.substring(0, 80) + '...');
}

main();
