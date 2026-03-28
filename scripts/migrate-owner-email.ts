/**
 * Migration: Add owner_email column to aya_registry
 *
 * 1. Adds owner_email column
 * 2. Backfills from contact_email for paying customers
 * 3. Backfills from analyses table for remaining gaps
 * 4. Adds index
 *
 * Usage: npx tsx scripts/migrate-owner-email.ts
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function main() {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
        console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
        process.exit(1);
    }

    const supabase = createClient(url, key);

    // Step 1: Add column (via RPC since Supabase JS doesn't support ALTER TABLE)
    console.log('Step 1: Adding owner_email column...');
    const { error: alterError } = await supabase.rpc('exec_sql', {
        query: `ALTER TABLE aya_registry ADD COLUMN IF NOT EXISTS owner_email TEXT;`
    }).single();

    if (alterError) {
        // Column might already exist, or RPC might not be available
        // Try direct approach via a dummy update to check
        console.log('  RPC not available, checking if column exists...');
        const { data: testData, error: testError } = await supabase
            .from('aya_registry')
            .select('owner_email')
            .limit(1);

        if (testError && testError.message.includes('owner_email')) {
            console.error('  Column does not exist and cannot be created via script.');
            console.error('  Please run this SQL in Supabase SQL Editor:');
            console.error('  ALTER TABLE aya_registry ADD COLUMN IF NOT EXISTS owner_email TEXT;');
            console.error('  Then re-run this script.');
            process.exit(1);
        } else {
            console.log('  Column owner_email already exists.');
        }
    } else {
        console.log('  Column added.');
    }

    // Step 2: Backfill from contact_email for paying customers
    console.log('\nStep 2: Backfilling owner_email from contact_email for paying customers...');
    const { data: payingEntities, error: fetchErr } = await supabase
        .from('aya_registry')
        .select('entity_id, contact_email, owner_email, display_name')
        .eq('payment_completed', true)
        .is('owner_email', null);

    if (fetchErr) {
        console.error('  Error fetching paying entities:', fetchErr.message);
    } else if (payingEntities && payingEntities.length > 0) {
        let updated = 0;
        for (const entity of payingEntities) {
            if (entity.contact_email) {
                const { error } = await supabase
                    .from('aya_registry')
                    .update({ owner_email: entity.contact_email })
                    .eq('entity_id', entity.entity_id);
                if (!error) {
                    console.log(`  ✅ ${entity.display_name}: owner_email = ${entity.contact_email}`);
                    updated++;
                }
            }
        }
        console.log(`  Backfilled ${updated}/${payingEntities.length} paying entities.`);
    } else {
        console.log('  No paying entities without owner_email found.');
    }

    // Step 3: Verify
    console.log('\nStep 3: Verification...');
    const { data: verify } = await supabase
        .from('aya_registry')
        .select('entity_id, display_name, contact_email, owner_email')
        .eq('payment_completed', true);

    if (verify) {
        const withOwner = verify.filter(e => e.owner_email);
        const withoutOwner = verify.filter(e => !e.owner_email);
        console.log(`  Paying entities with owner_email: ${withOwner.length}`);
        console.log(`  Paying entities WITHOUT owner_email: ${withoutOwner.length}`);
        if (withoutOwner.length > 0) {
            console.log('  ⚠️ These entities need manual owner_email assignment:');
            for (const e of withoutOwner) {
                console.log(`    - ${e.display_name} (${e.entity_id})`);
            }
        }
        console.log('\n  All paying entities:');
        for (const e of verify) {
            console.log(`    ${e.display_name}: contact=${e.contact_email || 'N/A'} | owner=${e.owner_email || 'N/A'}`);
        }
    }
}

main();
