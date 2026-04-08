
import { db } from '../db';
import { AyaEntity } from './schema';
import crypto from 'crypto';

/**
 * AYA REGISTRY MODULE (lib/aya/registry.ts)
 * Gestion centrale des enregistrements : Création, Mise à jour, Lecture.
 */

// Note: Table name is managed by db.ts ('aya_registry')

export async function registerOrUpdateEntity(
    entityData: Partial<AyaEntity>,
    mode: 'subscription' | 'purchase'
): Promise<string> {

    console.log(`📝 AYA REGISTRY: Registering entity... Mode: ${mode}`);

    // 1. Déterminer la validité (36 mois pour achat, 1 mois pour abo)
    const now = new Date();
    const validUntil = new Date();

    if (mode === 'purchase') {
        validUntil.setFullYear(now.getFullYear() + 3); // +3 ans
    } else {
        validUntil.setMonth(now.getMonth() + 1); // +1 mois (renouvelable)
    }

    // 3. CHECK DUPLICATE & PREPARE MERGE
    let entityId = entityData.aya_entity_id;
    const targetUrl = entityData.website || (entityData.asr_payload?.data?.url as string);
    let existingData: Partial<AyaEntity> = {};

    if (!entityId && targetUrl) {
        try {
            console.log(`🔍 AYA REGISTRY: Checking for existing entity with URL: ${targetUrl}`);
            const existing = await db.getAyaEntityByUrl(targetUrl);
            if (existing && existing.aya_entity_id) {
                console.log(`♻️ AYA REGISTRY: DUPLICATE FOUND. Updating existing Entity ID: ${existing.aya_entity_id}`);
                entityId = existing.aya_entity_id;
                existingData = existing; // Keep existing data
            } else {
                console.log(`✨ AYA REGISTRY: No duplicate found. Creating new Entity.`);
            }
        } catch (checkErr) {
            console.error("⚠️ AYA REGISTRY: Error checking duplicate", checkErr);
        }
    }

    if (!entityId) {
        entityId = crypto.randomUUID();
    }

    // 4. Construire l'objet Final (MERGE STRATEGY: New Data > Existing Data > Defaults)
    const newRecord: AyaEntity = {
        aya_entity_id: entityId,
        legal_name: entityData.legal_name || existingData.legal_name || "Unknown Entity",
        // ALWAYS prefer new legal_name for display if existing is generic
        display_name: entityData.display_name
            || (entityData.legal_name && entityData.legal_name !== "Entity" && entityData.legal_name !== "Unknown Entity" ? entityData.legal_name : null)
            || (existingData.display_name && existingData.display_name !== "Unknown" && existingData.display_name !== "Entity" ? existingData.display_name : null)
            || entityData.legal_name
            || existingData.display_name
            || "Entreprise",
        entity_type: entityData.entity_type || existingData.entity_type || 'company',
        country_legal: entityData.country_legal || existingData.country_legal || 'CH',
        sector_macro: (() => {
            const PLACEHOLDER_RE = /^(type schema\.?org|schema\.?org|organisation|organization|non spécifié|n\/a|undefined|null)$/i;
            const raw = entityData.sector_macro || '';
            if (raw && !PLACEHOLDER_RE.test(raw.trim())) return raw;
            const existing = existingData.sector_macro || '';
            if (existing && !PLACEHOLDER_RE.test(existing.trim())) return existing;
            return 'General';
        })(),
        website: targetUrl || existingData.website || undefined,

        // CRITICAL FIX: Respect new score if provided, else keep existing, else 0
        asr_score: (entityData.asr_score !== undefined && entityData.asr_score !== null) ? entityData.asr_score : (existingData.asr_score || 0),

        created_at: existingData.created_at || entityData.created_at || now.toISOString(),
        last_update: now.toISOString(), // Always refresh update time
        valid_until: validUntil.toISOString(), // Refresh validity

        data_origin: 'AYO',
        payment_completed: true, // Entité visible sur AYA uniquement après paiement
        pack_type: mode === 'purchase' ? 'PRO' : 'AYA_SUB',
        contact_email: entityData.contact_email || existingData.contact_email,
        // owner_email = Stripe payer email. Once set, never overwrite automatically.
        owner_email: existingData.owner_email || entityData.contact_email || existingData.contact_email,

        asr_payload: entityData.asr_payload || existingData.asr_payload || { version: "1.0", data: {}, signature: { hash: "", public_key: "" } },

        recommendability: {
            machine_readable: true,
            status: 'fresh',
            freshness_score: 1.0,
            priority_level: 'normal',
            source_url: `https://www.ai-visionary.xyz/aya/e/${entityId}`
        }
    };

    // 3. Sauvegarde via db.ts
    try {
        await db.updateEntityRecommendability(entityId, newRecord);
        console.log(`✅ AYA REGISTRY: Success! Entity ${entityId} registered until ${validUntil.toISOString()}`);
    } catch (err) {
        console.error(`❌ AYA REGISTRY: Failed to save entity ${entityId}`, err);
    }

    return entityId;
}

/**
 * Fetch all active entities from the Supabase database
 */
export async function getLiveEntities(): Promise<AyaEntity[]> {
    console.log('🔍 AYA REGISTRY: Fetching live entities from Supabase...');
    try {
        const entities = await db.getAyaEntities(); // No limit — uses default from db.ts (10000)
        return entities as AyaEntity[];
    } catch (err) {
        console.error('❌ AYA REGISTRY: Failed to fetch live entities', err);
        return [];
    }
}
