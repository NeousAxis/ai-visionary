/**
 * Selection d'une entite eligible pour un post LinkedIn.
 *
 * Source de verite : Postgres VPS (lib/db-local-pg.ts) UNIQUEMENT.
 * Aucune lecture Supabase pendant la grace period (jusqu'au 7 mai 2026).
 *
 * Criteres MVP :
 * - Domaine dans KNOWN_DOMAINS (entreprises connues uniquement)
 * - asr_score <= 50 (cap doctrinal sans ASR)
 * - payment_completed = false (pas un client AYA Sub / PRO)
 * - contact_email present (entite scrapee correctement)
 * - asr_payload.enrichment.gemini_description present (enrichissement OK)
 * - Pas postee dans les 30 derniers jours (table linkedin_posts)
 */

import { computeAioScore } from '@/lib/aio-score-engine';
import {
  linkedinGetRecentEntityIds,
  linkedinSelectCandidates,
  type Entity,
} from '@/lib/db-local-pg';
import { getKnownEntityMeta } from './known-entities';

export interface SelectableEntity {
  entity_id: string;
  domain: string;
  display_name: string;
  current_score: number;
  projected_score: number;
  sector_macro?: string;
  city?: string;
  country?: string;
  contact_email?: string;
  /** Locale forcee (override pickLocale par country quand override present dans KNOWN_DOMAINS_META) */
  override_locale?: 'fr' | 'en';
  /** Sector formule explicitement, override le sector_macro de la DB */
  override_sector_fr?: string;
  override_sector_en?: string;
  /** Handle LinkedIn @company depuis KNOWN_DOMAINS_META */
  linkedin_slug?: string;
}

const POST_FREQUENCY_DAYS = 30;

/**
 * Recharge un proScore en simulant l'ajout d'un ASR sur l'entite.
 * Reproduit la logique de app/api/diagnostic/scan/route.ts:85-96.
 *
 * Si l'extract est mal forme ou si computeAioScore plante, retourne
 * un fallback heuristique : min(85, current + 30).
 */
function computeProjectedScore(asrPayloadData: any, currentScore: number): number {
  try {
    if (!asrPayloadData || !asrPayloadData.fields) {
      return Math.min(85, currentScore + 30);
    }

    const proExtract = JSON.parse(JSON.stringify(asrPayloadData));

    if (proExtract.fields.contenus_pedagogiques) {
      proExtract.fields.contenus_pedagogiques.has_faq = { value: true, q: 1, evidence: ['ayo_pro_simulated'] };
      proExtract.fields.contenus_pedagogiques.has_glossary = { value: true, q: 1, evidence: ['ayo_pro_simulated'] };
      proExtract.fields.contenus_pedagogiques.has_documentation = { value: true, q: 1, evidence: ['ayo_pro_simulated'] };
    }
    if (proExtract.fields.structure_technique) {
      proExtract.fields.structure_technique.has_asr = { value: true, q: 1, evidence: ['ayo_pro_simulated'] };
      proExtract.fields.structure_technique.has_jsonld = { value: true, q: 1, evidence: ['ayo_pro_simulated'] };
      proExtract.fields.structure_technique.has_sitemap = { value: true, q: 1, evidence: ['ayo_pro_simulated'] };
    }
    if (proExtract.source && proExtract.source.scan) {
      proExtract.source.scan.has_asr_file = true;
      proExtract.source.scan.has_jsonld = true;
      proExtract.source.scan.is_aya_registered = true;
    }

    const proScore = computeAioScore(proExtract);
    return Math.round(proScore.total);
  } catch {
    return Math.min(85, currentScore + 30);
  }
}

/**
 * Nettoie un display_name : strip un TLD eventuellement collé au nom
 * (ex. "Manor.ch" → "Manor", "Zalando.com" → "Zalando").
 */
function cleanDisplayName(name: string): string {
  return name.replace(/\.(ch|fr|de|it|es|nl|be|com|co\.uk|uk|net|org|so|io|co|ai)$/i, '').trim();
}

/**
 * Extrait le domaine canonique depuis website (strip protocol/www/path).
 */
function extractDomain(website: string | null | undefined): string {
  if (!website) return '';
  return website
    .toLowerCase()
    .trim()
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .split('/')[0]
    .split('?')[0];
}

/**
 * Selectionne une entite eligible pour un post LinkedIn.
 * Retourne null si rien d'eligible.
 *
 * Pool source : toutes les entites Tranco VPS (~25k) qui passent les filtres
 * qualite SQL (asr_payload, gemini_description >= 100 chars, display_name propre).
 * Les overrides KNOWN_DOMAINS_META restent appliques en post-filtre si l'entite
 * pickee fait partie de la liste curee (locale, sector_fr/en, linkedin_slug, city).
 */
export async function selectNextEntity(): Promise<SelectableEntity | null> {
  // 1. Charger les entity_id recemment postees (anti-doublon 30j)
  const excludedIds = await linkedinGetRecentEntityIds(POST_FREQUENCY_DAYS);

  // 2. Charger les candidates depuis Postgres VPS — pool elargi (pas de filtre KNOWN_DOMAINS)
  const candidates: Entity[] = await linkedinSelectCandidates({
    knownDomains: [],          // inutilise en mode useKnownDomainsFilter=false
    excludeEntityIds: Array.from(excludedIds),
    limit: 50,
    useKnownDomainsFilter: false,
  });

  if (candidates.length === 0) {
    console.warn(
      `[linkedin-selector] No eligible entity (pool elargi, excluded=${excludedIds.size})`
    );
    return null;
  }

  // 3. Random pick parmi les candidats (deja randomises par RANDOM() en SQL)
  const picked = candidates[0];
  const domain = extractDomain(picked.website);
  const projectedScore = computeProjectedScore(picked.asr_payload?.data, picked.asr_score ?? 0);

  // 4. Override metadata depuis KNOWN_DOMAINS_META si l'entite est dans la liste curee.
  //    Sinon fallback sur les donnees DB directement.
  //    - linkedin_slug : undefined si non connu (le generateur de post utilise le nom seul)
  //    - locale : pickLocale() retourne toujours 'en' (decision 2 mai 2026)
  //    - sector_fr / sector_en : sector_macro de la DB tel quel
  const meta = getKnownEntityMeta(domain);

  return {
    entity_id: picked.entity_id,
    domain,
    display_name: cleanDisplayName(picked.display_name || domain),
    current_score: picked.asr_score ?? 0,
    projected_score: projectedScore,
    sector_macro: picked.sector_macro || undefined,
    city: meta?.city || undefined,
    country: meta?.country || picked.country_legal || undefined,
    contact_email: picked.contact_email || undefined,
    // Locale : override curee si dispo, sinon 'en' (pickLocale retourne toujours 'en')
    override_locale: meta?.locale ?? 'en',
    // Sector : override curee si dispo, sinon sector_macro brut de la DB
    override_sector_fr: meta?.sector_fr ?? picked.sector_macro ?? undefined,
    override_sector_en: meta?.sector_en ?? picked.sector_macro ?? undefined,
    // Slug LinkedIn : uniquement si connu dans KNOWN_DOMAINS_META
    linkedin_slug: meta?.linkedin_slug,
  };
}
