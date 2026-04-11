// app/api/diagnostic/compare/route.ts — Find competitors by COMMON KEYWORDS (dynamic, IDF-weighted)

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// ── Always exclude these domains (our own platform) ──
const EXCLUDED_DOMAINS = ['ai-visionary.xyz', 'ai-visionary.com'];

// ── Entity type compatibility matrix ──
// Prevents comparing a design agency with a nonprofit, etc.
const INCOMPATIBLE_TYPES: Record<string, Set<string>> = {
  // Agencies/corporates should NOT be compared with associations/nonprofits
  'DesignAgency': new Set(['association', 'nonprofit', 'ngo', 'fondation', 'foundation']),
  'MarketingAgency': new Set(['association', 'nonprofit', 'ngo', 'fondation', 'foundation']),
  'ConsultingFirm': new Set(['association', 'nonprofit', 'ngo', 'fondation', 'foundation']),
  'TechnologyCompany': new Set(['association', 'nonprofit', 'ngo', 'fondation', 'foundation']),
  'FinancialService': new Set(['association', 'nonprofit', 'ngo', 'fondation', 'foundation']),
  'LegalService': new Set(['association', 'nonprofit', 'ngo', 'fondation', 'foundation']),
  'MedicalBusiness': new Set(['association', 'nonprofit', 'ngo', 'fondation', 'foundation']),
  // Associations/NGOs should NOT be compared with commercial entities
  'NonprofitOrganization': new Set(['agency', 'sarl', 'gmbh', 'sas', 'sa', 'inc', 'ltd', 'consulting', 'marketing', 'design', 'finance', 'recruitment', 'recrutement', 'security', 'sécurité', 'retail', 'e-commerce']),
  // E-commerce should not be compared with services
  'Store': new Set(['consulting', 'conseil', 'advisory', 'agency', 'agence', 'nonprofit', 'ngo', 'fondation', 'foundation']),
};

function isEntityTypeCompatible(siteType: string, entity: any): boolean {
  if (!siteType) return true; // no info = allow all
  const incompatible = INCOMPATIBLE_TYPES[siteType];
  if (!incompatible) return true; // no rule for this siteType

  // Check entity's sector_macro, entity_type, and display_name for incompatible markers
  const entitySector = norm(entity.sector_macro || '');
  const entityType = norm(entity.entity_type || '');
  const entityName = norm(entity.display_name || entity.legal_name || '');

  for (const marker of incompatible) {
    if (entitySector.includes(marker) || entityType.includes(marker) || entityName.includes(marker)) {
      return false;
    }
  }
  return true;
}

// ── Business stopwords: words too generic to be discriminative ──
// These appear in almost every company description and carry zero signal.
const STOPWORDS = new Set([
  // Generic business
  'entreprise', 'entreprises', 'company', 'companies', 'business',
  'service', 'services', 'solution', 'solutions', 'product', 'products',
  'management', 'consulting', 'conseil', 'platform', 'plateforme',
  'client', 'clients', 'customer', 'customers',
  'team', 'equipe', 'global', 'international', 'world', 'monde',
  'leader', 'leading', 'innovation', 'innovative', 'innovant',
  'quality', 'qualite', 'professional', 'professionnel',
  'experience', 'expertise', 'expert', 'experts',
  // Generic tech
  'digital', 'numerique', 'online', 'web', 'website', 'site',
  'data', 'donnees', 'system', 'systeme', 'software', 'logiciel',
  'app', 'application', 'api', 'cloud', 'tech', 'technology',
  'technologie', 'tools', 'outils', 'tool', 'outil',
  // Generic actions
  'delivery', 'support', 'help', 'aide', 'offer', 'offre',
  'design', 'develop', 'development', 'developpement', 'build',
  'provide', 'create', 'manage', 'improve', 'ameliorer',
  'accompagnement', 'accompagner',
  // Locations (too generic)
  'suisse', 'swiss', 'france', 'europe', 'geneve', 'geneva',
  'paris', 'london', 'zurich', 'bern',
  // Entity types
  'association', 'sarl', 'gmbh', 'sas', 'inc', 'ltd', 'corp',
  // Generic creative/project
  'creative', 'creatif', 'creation', 'projet', 'projets', 'project', 'projects',
  'communication', 'strategie', 'strategy', 'branding', 'brand',
  'marketing', 'agence', 'agency', 'studio', 'freelance',
  'identite', 'identity', 'visuelle', 'visual', 'graphique', 'graphic',
  'atelier', 'workshop', 'formation', 'training',
  // Generic institutional/academic words (too broad to discriminate)
  'research', 'recherche', 'policy', 'politique', 'program', 'programme',
  'protection', 'assistance', 'advocacy', 'awareness',
  'mission', 'impact', 'action', 'governance', 'gouvernance',
  'report', 'reporting', 'analysis', 'analyse', 'study', 'etude',
  // Filler
  'based', 'base', 'pour', 'avec', 'dans', 'from', 'with',
  'that', 'this', 'also', 'more', 'plus', 'best', 'across',
  'offers', 'propose', 'propose', 'permet', 'permettant',
  'including', 'such', 'bien', 'tout', 'tous', 'leur', 'leurs',
  'elle', 'sont', 'etre', 'faire', 'fait', 'entre',
  'menu', 'conditions', 'compliance',
]);

/**
 * Normalize a keyword for comparison: lowercase, strip accents, trim.
 */
function norm(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim();
}

/**
 * Check if a normalized keyword is meaningful (not a stopword, long enough).
 */
function isMeaningful(kw: string): boolean {
  if (kw.length < 3) return false;
  if (STOPWORDS.has(kw)) return false;
  return true;
}

/**
 * Extract SPECIFIC keywords from an AYA entity's asr_payload.
 * Only keeps meaningful terms (no stopwords, no filler).
 */
function extractEntityKeywords(entity: any): string[] {
  const kw: string[] = [];
  const payload = entity.asr_payload;

  // sector_macro — split on common separators
  if (entity.sector_macro) {
    const parts = entity.sector_macro.split(/[&,\/]+/).map((s: string) => s.trim()).filter(Boolean);
    kw.push(...parts);
  }

  if (!payload) return kw.map(norm).filter(isMeaningful);

  // gemini_keywords (enrichment) — highest quality, AI-curated
  const gk = payload.enrichment?.gemini_keywords;
  if (Array.isArray(gk)) kw.push(...gk);

  // external_context keywords
  const eck = payload.data?.external_context?.keywords?.value;
  if (Array.isArray(eck)) kw.push(...eck);

  // offre services — only short items (actual service names, not sentences)
  const svc = payload.data?.offre?.services?.value;
  if (Array.isArray(svc)) {
    for (const s of svc) {
      if (typeof s === 'string' && s.length <= 60) kw.push(s);
    }
  }

  // offre block keywords_detected
  const okd = payload.data?.aio_blocks?.offre?.fields?.keywords_detected;
  if (Array.isArray(okd)) kw.push(...okd);

  // gemini_description — REMOVED: extracting individual words from free-text descriptions
  // produces too many false positive matches (generic words like "projet", "creativite", "communication"
  // match across completely unrelated entities like design agencies vs nonprofits)

  return Array.from(new Set(kw.map(norm).filter(isMeaningful)));
}

/**
 * Build an IDF (inverse document frequency) map:
 * keywords that appear in many entities have LOW weight,
 * keywords that appear in few entities have HIGH weight.
 */
function buildIdfMap(allKeywords: string[][]): Map<string, number> {
  const docCount = allKeywords.length;
  const df = new Map<string, number>(); // document frequency

  for (const kwList of allKeywords) {
    const unique = new Set(kwList);
    for (const kw of Array.from(unique)) {
      df.set(kw, (df.get(kw) || 0) + 1);
    }
  }

  const idf = new Map<string, number>();
  for (const [kw, count] of Array.from(df.entries())) {
    // IDF = log(total / count). Words in >20% of entities get near-zero weight.
    const ratio = count / docCount;
    if (ratio > 0.15) {
      idf.set(kw, 0); // too common = zero weight
    } else {
      idf.set(kw, Math.log(docCount / count));
    }
  }

  return idf;
}

/**
 * Compute IDF-weighted keyword overlap between site and entity.
 */
function computeWeightedOverlap(
  siteKeywords: string[],
  entityKeywords: string[],
  idf: Map<string, number>,
): number {
  let score = 0;
  const entitySet = new Set(entityKeywords);

  for (const sk of siteKeywords) {
    const weight = idf.get(sk) ?? 1;
    if (weight === 0) continue; // skip overused keywords

    // Exact match
    if (entitySet.has(sk)) {
      score += weight * 2;
      continue;
    }

    // Containment match — strict: min 6 chars + contained word must be >= 40% of container
    // Prevents "research" matching "humanitarian policy research" across unrelated sectors
    if (sk.length >= 6) {
      for (const ek of entityKeywords) {
        if (ek.length < 6) continue;
        const shorter = sk.length <= ek.length ? sk : ek;
        const longer = sk.length <= ek.length ? ek : sk;
        if (longer.includes(shorter) && shorter.length / longer.length >= 0.4) {
          const matchWeight = idf.get(ek) ?? 1;
          if (matchWeight > 0) {
            score += Math.min(weight, matchWeight) * 0.5; // half weight for partial match
            break;
          }
        }
      }
    }
  }

  return score;
}

export async function POST(req: NextRequest) {
  try {
    const { services, siteName, siteUrl, siteType, industryKeywords } = await req.json();

    // ── Sector affinity: map businessType → sector_macro patterns for boosting ──
    const SECTOR_AFFINITY: Record<string, string[]> = {
      'TechnologyCompany': ['technology', 'tech', 'software', 'saas', 'hardware', 'electronics', 'computer', 'peripheral', 'gaming', 'informatique', 'numerique', 'digital'],
      'DesignAgency': ['design', 'creative', 'graphi', 'branding', 'ux', 'ui', 'agence', 'studio'],
      'MarketingAgency': ['marketing', 'communication', 'publicite', 'advertising', 'media', 'seo', 'agence'],
      'ConsultingFirm': ['consulting', 'conseil', 'advisory', 'strateg', 'management'],
      'EducationalOrganization': ['education', 'formation', 'training', 'school', 'university', 'ecole'],
      'LegalService': ['legal', 'juridique', 'avocat', 'law', 'droit', 'notaire'],
      'MedicalBusiness': ['health', 'sante', 'medical', 'pharma', 'clinic', 'hospital'],
      'FinancialService': ['finance', 'bank', 'assurance', 'insurance', 'investissement', 'comptab', 'audit'],
      'ProfessionalService': ['professional', 'service'],
      'NonprofitOrganization': ['nonprofit', 'ngo', 'ong', 'humanitarian', 'humanitaire', 'charity', 'fondation', 'foundation', 'association', 'croix-rouge', 'red cross'],
      'Store': ['retail', 'e-commerce', 'ecommerce', 'shop', 'boutique', 'magasin', 'store', 'marketplace', 'vente'],
    };

    function getSectorBoost(entity: any): number {
      if (!siteType) return 1;
      const patterns = SECTOR_AFFINITY[siteType];
      if (!patterns) return 1;
      const entitySector = norm(entity.sector_macro || '');
      const entityServices = (entity.asr_payload?.data?.offre?.services?.value || []).map((s: string) => norm(s)).join(' ');
      const combined = `${entitySector} ${entityServices}`;
      let matches = 0;
      for (const p of patterns) {
        if (combined.includes(p)) matches++;
      }
      if (matches >= 2) return 5;   // strong sector match
      if (matches === 1) return 2.5; // partial sector match
      return 0.3;                     // different sector = heavy penalty
    }

    // Build site keywords — PRIORITIZE industry keywords from LLM (high quality, specific)
    // Fall back to raw services if no industry keywords available
    const rawSiteKeywords: string[] = [];
    if (Array.isArray(industryKeywords) && industryKeywords.length > 0) {
      rawSiteKeywords.push(...industryKeywords);
    }
    if (Array.isArray(services)) rawSiteKeywords.push(...services);
    // Do NOT include siteName — it pollutes matching with company name words
    const siteKeywords = Array.from(new Set(rawSiteKeywords.map(norm).filter(isMeaningful)));

    if (!siteKeywords.length) {
      return NextResponse.json({ competitors: [], averageScore: 0, totalInSector: 0 });
    }

    // Fetch ALL entities
    const allEntities = await db.getAyaEntities(10000);
    if (!allEntities?.length) {
      return NextResponse.json({ competitors: [], averageScore: 0, totalInSector: 0 });
    }

    const siteNorm = (siteUrl || '').replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/$/, '').toLowerCase();

    // Pre-extract keywords for all entities + build IDF map
    const entityData: { entity: any; keywords: string[] }[] = [];
    const allKeywordSets: string[][] = [];

    for (const e of allEntities) {
      const eUrl = (e.website || '').replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/$/, '').toLowerCase();

      // Always exclude our own platform
      if (EXCLUDED_DOMAINS.some(d => eUrl.includes(d))) continue;

      // Exclude the scanned site itself
      if (siteNorm && eUrl && (eUrl.includes(siteNorm) || siteNorm.includes(eUrl))) continue;

      const eName = (e.display_name || e.legal_name || '');
      if (eName.length < 2) continue;

      // Filter out incompatible entity types (e.g. don't compare agency vs nonprofit)
      if (!isEntityTypeCompatible(siteType, e)) continue;

      const kw = extractEntityKeywords(e);
      entityData.push({ entity: e, keywords: kw });
      allKeywordSets.push(kw);
    }

    // Build IDF from all entity keywords
    const idf = buildIdfMap(allKeywordSets);

    // Score each entity
    const scored: { entity: any; overlap: number; matchedKw: string[] }[] = [];

    for (const { entity, keywords } of entityData) {
      const rawOverlap = computeWeightedOverlap(siteKeywords, keywords, idf);

      if (rawOverlap > 0) {
        // Apply sector affinity boost/penalty
        const sectorMultiplier = getSectorBoost(entity);
        const overlap = rawOverlap * sectorMultiplier;

        // Track which site keywords actually matched (same strict rules as scoring)
        const entitySet = new Set(keywords);
        const matched = siteKeywords.filter(sk => {
          if (entitySet.has(sk)) return true;
          if (sk.length >= 6) {
            return keywords.some(ek => {
              if (ek.length < 6) return false;
              const shorter = sk.length <= ek.length ? sk : ek;
              const longer = sk.length <= ek.length ? ek : sk;
              return longer.includes(shorter) && shorter.length / longer.length >= 0.4;
            });
          }
          return false;
        });
        scored.push({ entity, overlap, matchedKw: matched });
      }
    }

    // Sort by overlap (desc), then certified first, then score
    scored.sort((a, b) => {
      if (b.overlap !== a.overlap) return b.overlap - a.overlap;
      const aCert = a.entity.payment_completed === true ? 1 : 0;
      const bCert = b.entity.payment_completed === true ? 1 : 0;
      if (bCert !== aCert) return bCert - aCert;
      return (b.entity.asr_score || 0) - (a.entity.asr_score || 0);
    });

    // Top 5 competitors — require at least 2 matched keywords to avoid false positives
    const top = scored
      .filter(s => (s.entity.asr_score || 0) > 0 && s.matchedKw.length >= 2)
      .slice(0, 5);

    const competitors = top.map(s => ({
      name: s.entity.display_name || s.entity.legal_name,
      score: s.entity.asr_score || 0,
      country: s.entity.country_legal || '',
      certified: s.entity.payment_completed === true,
      sector: s.entity.sector_macro || '',
      keywordOverlap: Math.round(s.overlap * 10) / 10,
      commonKeywords: s.matchedKw.slice(0, 5),
    }));

    // Average from all matched entities (with meaningful overlap)
    const meaningfulMatches = scored.filter(s => s.overlap >= 2);
    const allScores = meaningfulMatches.map(s => s.entity.asr_score || 0).filter((s: number) => s > 0);
    const averageScore = allScores.length > 0
      ? Math.round(allScores.reduce((a: number, b: number) => a + b, 0) / allScores.length)
      : 0;

    console.log(`[compare] site keywords: [${siteKeywords.join(', ')}], IDF filtered, matched=${meaningfulMatches.length}, top5=${competitors.map(c => `${c.name}(${c.keywordOverlap}:[${c.commonKeywords.join(',')}])`).join(', ')}`);

    return NextResponse.json({
      competitors,
      averageScore,
      totalInSector: meaningfulMatches.length,
      matchedKeywords: siteKeywords.slice(0, 8),
    });
  } catch (err) {
    console.error('[compare]', err);
    return NextResponse.json({ competitors: [], averageScore: 0, totalInSector: 0 });
  }
}
