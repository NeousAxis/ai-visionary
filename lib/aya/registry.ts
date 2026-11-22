
import { db } from '../db';
import { AyaEntity } from './schema';
import { normalizeCountryCode } from './country-iso';
import { MIN_VISIBLE_TEXT } from '../micro-agents/constants';
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

// ccTLD -> ISO country (couverture des suffixes les plus courants ; le cron qualité affine ensuite).
// Ni .io ni .eu : le premier est un suffixe générique, le second n'est pas un pays.
const CCTLD_COUNTRY: Record<string, string> = {
    ch: 'CH', fr: 'FR', de: 'DE', uk: 'GB', be: 'BE', nl: 'NL', it: 'IT', es: 'ES',
    at: 'AT', lu: 'LU', us: 'US', ca: 'CA', pt: 'PT', se: 'SE', no: 'NO', dk: 'DK',
    fi: 'FI', ie: 'IE', pl: 'PL', cz: 'CZ',
};

/** Déduit un code ISO pays depuis la valeur scannée (texte) ou, à défaut, le ccTLD du domaine. */
function resolveCountryISO(rawCountry: string, url: string): string {
    const iso = normalizeCountryCode(rawCountry);
    if (iso) return iso;
    try {
        const host = new URL(url.startsWith('http') ? url : `https://${url}`).hostname;
        const tld = host.split('.').pop()?.toLowerCase() || '';
        if (CCTLD_COUNTRY[tld]) return CCTLD_COUNTRY[tld];
    } catch { /* ignore */ }
    return 'XX';
}

function bareHost(url: string): string {
    try { return new URL(url.startsWith('http') ? url : `https://${url}`).hostname.replace(/^www\./, ''); }
    catch { return url; }
}

function sectorLabel(raw?: string): string {
    const s = (raw || '').trim();
    if (!s) return 'General';
    return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Colonnes d'une ligne existante dont l'indexation a besoin (renvoyées par db.getAyaEntityByUrl). */
export type ExistingEntityRow = {
    entity_id?: string;
    aya_entity_id?: string;
    data_origin?: string | null;
    payment_completed?: boolean | null;
    asr_score?: number | string | null;
    legal_name?: string | null;
    display_name?: string | null;
    contact_email?: string | null;
    country_legal?: string | null;
    sector_macro?: string | null;
    last_update?: string | Date | null;
};

type DiagnosticIndexInput = {
    url: string;
    score: number;
    /**
     * Caracteres de texte reellement lus sur le site (fetchResult.textContent.length).
     * En dessous de MIN_VISIBLE_TEXT, AYO n'a rien lu : aucune ecriture.
     */
    contentChars: number;
    name?: string;
    country?: string;
    sector?: string;
    contactEmail?: string;
};

/**
 * Rafraichit une ligne que cette fonction a elle-meme creee (AYO-SCAN, non payee) avec le
 * dernier scan lisible. Mise a jour etroite : le score, et les champs encore vides ou restes
 * a leur valeur de repli. Jamais une ligne du bot ni une entite certifiee.
 */
async function refreshOwnScanRow(entityId: string, existing: ExistingEntityRow, input: DiagnosticIndexInput): Promise<void> {
    const host = bareHost(input.url);
    const isFallback = (v: unknown) => !v || !String(v).trim() || String(v).trim().toLowerCase() === host;
    const fields: Record<string, unknown> = { asr_score: input.score };
    const cleanName = (input.name || '').trim();
    if (cleanName && isFallback(existing.display_name)) fields.display_name = cleanName;
    if (cleanName && isFallback(existing.legal_name)) fields.legal_name = cleanName;
    if (input.contactEmail && !existing.contact_email) fields.contact_email = input.contactEmail;
    const iso = resolveCountryISO(input.country || '', input.url);
    if (iso !== 'XX' && (!existing.country_legal || existing.country_legal === 'XX')) fields.country_legal = iso;
    const sector = sectorLabel(input.sector);
    if (sector !== 'General' && (!existing.sector_macro || existing.sector_macro === 'General')) fields.sector_macro = sector;

    const ok = await db.updateEntityData(entityId, fields);
    if (ok) {
        console.log(`🔄 AYA INDEX: ligne AYO-SCAN ${entityId} rafraichie par le diagnostic (${host}, score ${existing.asr_score} -> ${input.score})`);
    } else {
        console.error(`❌ AYA INDEX: rafraichissement refuse par la base pour ${entityId} (${host})`);
    }
}

/**
 * Indexe automatiquement une entité dans AYA dès qu'un diagnostic est lancé.
 *
 * Entrée INDEXÉE (non certifiée) : `payment_completed=false`, `data_origin='AYO-SCAN'`.
 * Doctrine : pas d'ASR généré = pas certifié. L'entité apparaît dans le registre
 * (volume / API / pages crawlables) mais reste distincte des entités certifiées AYO.
 *
 * Site non lu (contentChars sous MIN_VISIBLE_TEXT) : rien n'est écrit. AYO n'invente rien,
 * et un score calculé sans lecture serait figé par la dédup (incident du 14.10.2026).
 *
 * Dédup par URL : une entité du bot ou certifiée n'est JAMAIS touchée (on ne dégrade jamais
 * une entité existante). Une ligne AYO-SCAN non payée, créée par cette fonction, suit le
 * dernier scan lisible, sinon un score faux écrit une fois restait figé pour toujours.
 *
 * @returns l'entity_id (existant ou nouveau), ou null en cas d'échec ou de refus.
 */
export async function indexEntityFromDiagnostic(input: DiagnosticIndexInput): Promise<string | null> {
    const targetUrl = input.url;
    if (!targetUrl) return null;

    // 0. Garde de lisibilité. La porte principale est dans fetchHtml ; celle-ci protège le
    // registre contre tout appelant qui calculerait un score sans avoir lu le site.
    if (!(input.contentChars >= MIN_VISIBLE_TEXT)) {
        console.warn(`⛔ AYA INDEX: ${targetUrl} non lu (${input.contentChars || 0} caractères de texte), rien n'est inscrit.`);
        return null;
    }

    // 1. Dédup par URL — ne jamais dupliquer une entité existante
    let existing: ExistingEntityRow | null = null;
    try {
        existing = await db.getAyaEntityByUrl(targetUrl);
    } catch (checkErr) {
        console.error('⚠️ AYA INDEX: duplicate check failed', checkErr);
        // En cas d'erreur de lecture, on s'abstient d'écrire pour éviter les doublons.
        return null;
    }
    const existingId = existing?.entity_id || existing?.aya_entity_id;
    if (existing && existingId) {
        if (existing.data_origin === 'AYO-SCAN' && existing.payment_completed !== true) {
            try {
                await refreshOwnScanRow(existingId, existing, input);
            } catch (err) {
                console.error(`❌ AYA INDEX: rafraichissement ${existingId} en échec`, err);
            }
        } else {
            console.log(`♻️ AYA INDEX: Already in registry (${existingId}, ${existing.data_origin || '?'}) — diagnostic ne modifie rien.`);
        }
        return existingId;
    }

    // 2. Construire l'entrée indexée
    const now = new Date();
    const entityId = crypto.randomUUID();
    const host = bareHost(targetUrl);
    const cleanName = (input.name || '').trim();
    const displayName = cleanName || host;
    const sector = sectorLabel(input.sector);

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
