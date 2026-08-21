
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
            // Supabase returns column as `entity_id` (not `aya_entity_id`)
            const existingId = existing?.entity_id || existing?.aya_entity_id;
            if (existing && existingId) {
                console.log(`♻️ AYA REGISTRY: DUPLICATE FOUND. Updating existing Entity ID: ${existingId}`);
                entityId = existingId;
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
            source_url: `https://ai-visionary.xyz/aya/e/${entityId}`
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

// ccTLD -> ISO country (couverture des suffixes les plus courants ; le cron qualité affine ensuite)
const CCTLD_COUNTRY: Record<string, string> = {
    ch: 'CH', fr: 'FR', de: 'DE', uk: 'GB', be: 'BE', nl: 'NL', it: 'IT', es: 'ES',
    at: 'AT', lu: 'LU', us: 'US', ca: 'CA', pt: 'PT', se: 'SE', no: 'NO', dk: 'DK',
    fi: 'FI', ie: 'IE', pl: 'PL', cz: 'CZ', io: 'GB', eu: 'EU',
};

// Noms de pays usuels -> ISO (pour les valeurs textuelles renvoyées par le scan)
const COUNTRY_NAME_ISO: Record<string, string> = {
    switzerland: 'CH', suisse: 'CH', schweiz: 'CH', svizzera: 'CH',
    france: 'FR', germany: 'DE', deutschland: 'DE', allemagne: 'DE',
    'united kingdom': 'GB', uk: 'GB', england: 'GB', 'royaume-uni': 'GB',
    belgium: 'BE', belgique: 'BE', netherlands: 'NL', 'pays-bas': 'NL',
    italy: 'IT', italie: 'IT', spain: 'ES', espagne: 'ES', austria: 'AT', autriche: 'AT',
    luxembourg: 'LU', 'united states': 'US', usa: 'US', 'états-unis': 'US', canada: 'CA',
};

/** Déduit un code ISO pays depuis la valeur scannée (texte) ou, à défaut, le ccTLD du domaine. */
function resolveCountryISO(rawCountry: string, url: string): string {
    const c = (rawCountry || '').trim();
    if (/^[A-Za-z]{2}$/.test(c)) return c.toUpperCase();
    if (c) {
        const iso = COUNTRY_NAME_ISO[c.toLowerCase()];
        if (iso) return iso;
    }
    try {
        const host = new URL(url.startsWith('http') ? url : `https://${url}`).hostname;
        const tld = host.split('.').pop()?.toLowerCase() || '';
        if (CCTLD_COUNTRY[tld]) return CCTLD_COUNTRY[tld];
    } catch { /* ignore */ }
    return 'XX';
}

/**
 * Indexe automatiquement une entité dans AYA dès qu'un diagnostic est lancé.
 *
 * Entrée INDEXÉE (non certifiée) : `payment_completed=false`, `data_origin='AYO-SCAN'`.
 * Doctrine : pas d'ASR généré = pas certifié. L'entité apparaît dans le registre
 * (volume / API / pages crawlables) mais reste distincte des entités certifiées AYO.
 *
 * Dédup par URL : si l'entité existe déjà (bot indexé OU certifiée), on NE TOUCHE À RIEN
 * (on ne dégrade jamais une entité existante) et on renvoie son id.
 *
 * @returns l'entity_id (existant ou nouveau), ou null en cas d'échec.
 */
export async function indexEntityFromDiagnostic(input: {
    url: string;
    score: number;
    name?: string;
    country?: string;
    sector?: string;
    contactEmail?: string;
}): Promise<string | null> {
    const targetUrl = input.url;
    if (!targetUrl) return null;

    // 1. Dédup par URL — ne jamais dupliquer ni écraser une entité existante
    try {
        const existing = await db.getAyaEntityByUrl(targetUrl);
        const existingId = existing?.entity_id || existing?.aya_entity_id;
        if (existing && existingId) {
            console.log(`♻️ AYA INDEX: Already in registry (${existingId}) — diagnostic ne modifie rien.`);
            return existingId;
        }
    } catch (checkErr) {
        console.error('⚠️ AYA INDEX: duplicate check failed', checkErr);
        // En cas d'erreur de lecture, on s'abstient d'écrire pour éviter les doublons.
        return null;
    }

    // 2. Construire l'entrée indexée
    const now = new Date();
    const entityId = crypto.randomUUID();
    const host = (() => {
        try { return new URL(targetUrl.startsWith('http') ? targetUrl : `https://${targetUrl}`).hostname.replace(/^www\./, ''); }
        catch { return targetUrl; }
    })();
    const cleanName = (input.name || '').trim();
    const displayName = cleanName || host;
    const sector = (() => {
        const s = (input.sector || '').trim();
        if (!s) return 'General';
        return s.charAt(0).toUpperCase() + s.slice(1);
    })();

    const record: AyaEntity = {
        aya_entity_id: entityId,
        legal_name: cleanName || displayName,
        display_name: displayName,
        entity_type: 'company',
        country_legal: resolveCountryISO(input.country || '', targetUrl),
        sector_macro: sector,
        website: targetUrl,
        asr_score: typeof input.score === 'number' ? input.score : 0,
        created_at: now.toISOString(),
        last_update: now.toISOString(),
        valid_until: now.toISOString(), // non pertinent pour une entrée indexée (payment_completed=false)
        data_origin: 'AYO-SCAN',
        payment_completed: false, // INDEXÉE, pas certifiée
        contact_email: input.contactEmail || undefined,
        asr_payload: { version: '1.0', data: {}, signature: { hash: '', public_key: '' } },
        recommendability: {
            machine_readable: true,
            status: 'fresh',
            freshness_score: 1.0,
            priority_level: 'normal',
            source_url: `https://ai-visionary.xyz/aya/e/${entityId}`,
        },
    };

    try {
        await db.updateEntityRecommendability(entityId, record);
        console.log(`✅ AYA INDEX: Entité indexée depuis diagnostic — ${entityId} (${host}, score ${record.asr_score})`);
        return entityId;
    } catch (err) {
        console.error(`❌ AYA INDEX: échec sauvegarde ${entityId}`, err);
        return null;
    }
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
