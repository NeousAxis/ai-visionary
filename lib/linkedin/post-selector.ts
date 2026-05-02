/**
 * Selection d'une entite eligible pour un post LinkedIn.
 *
 * Criteres MVP :
 * - Domaine dans KNOWN_DOMAINS (entreprises connues uniquement)
 * - asr_score <= 50 (cap doctrinal sans ASR)
 * - payment_completed = false (pas un client AYA Sub / PRO)
 * - contact_email present (entite scrapee correctement)
 * - asr_payload.enrichment.gemini_description present (enrichissement OK)
 * - Pas postee dans les 30 derniers jours
 *
 * Source de verite : Supabase (table aya_registry contient les entites
 * legacy + certifiees, mais on ne pose que sur les non-payantes).
 * Les ~25 860 entites Postgres VPS Tranco sont aussi candidates a terme.
 */

import { db, supabase } from '@/lib/db';
import { computeAioScore } from '@/lib/aio-score-engine';
import { isKnownDomain, KNOWN_DOMAINS } from './known-entities';

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

    // Simule ce qu'AYO PRO fournit : ASR + FAQ + glossary + docs + JSON-LD + sitemap
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
  } catch (e) {
    // Fallback heuristique
    return Math.min(85, currentScore + 30);
  }
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
 */
export async function selectNextEntity(): Promise<SelectableEntity | null> {
  if (!supabase) {
    console.warn('[linkedin-selector] Supabase not configured');
    return null;
  }

  // 1. Charger les entites recemment postees (anti-doublon 30j)
  const cutoff = new Date(Date.now() - POST_FREQUENCY_DAYS * 24 * 3600 * 1000).toISOString();
  const { data: recentPosts } = await supabase
    .from('linkedin_posts')
    .select('entity_id')
    .gte('scheduled_at', cutoff);

  const excludedIds = new Set((recentPosts || []).map((p: any) => p.entity_id));

  // 2. Charger les candidates : entites non-payantes avec score <= 50
  //    et description Gemini enrichie
  const { data: candidates, error } = await supabase
    .from('aya_registry')
    .select('entity_id, display_name, website, asr_score, sector_macro, country_legal, contact_email, asr_payload')
    .lte('asr_score', 50)
    .eq('payment_completed', false)
    .not('contact_email', 'is', null)
    .limit(500);

  if (error || !candidates || candidates.length === 0) {
    console.warn('[linkedin-selector] No candidates found', error?.message);
    return null;
  }

  // 3. Filtrer : domaine connu + pas exclu + enrichi
  const eligibles = candidates.filter((c: any) => {
    if (excludedIds.has(c.entity_id)) return false;
    const domain = extractDomain(c.website);
    if (!isKnownDomain(domain)) return false;
    const enrichment = c.asr_payload?.enrichment;
    if (!enrichment?.gemini_description) return false;
    return true;
  });

  if (eligibles.length === 0) {
    console.warn(`[linkedin-selector] No eligible entity (${candidates.length} candidates, ${excludedIds.size} excluded recent, KNOWN_DOMAINS=${KNOWN_DOMAINS.size})`);
    return null;
  }

  // 4. Random pick
  const picked = eligibles[Math.floor(Math.random() * eligibles.length)];
  const domain = extractDomain(picked.website);
  const projectedScore = computeProjectedScore(picked.asr_payload?.data, picked.asr_score);

  // Extract city from asr_payload if present
  const city = picked.asr_payload?.data?.fields?.identite?.city?.value || undefined;

  return {
    entity_id: picked.entity_id,
    domain,
    display_name: picked.display_name || domain,
    current_score: picked.asr_score,
    projected_score: projectedScore,
    sector_macro: picked.sector_macro,
    city,
    country: picked.country_legal,
    contact_email: picked.contact_email,
  };
}
