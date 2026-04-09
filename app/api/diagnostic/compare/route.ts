// app/api/diagnostic/compare/route.ts — Find REAL sector competitors from AYA registry

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// Standard AYA sectors
const SECTORS = [
  'Conseil & Services Pro',
  'Technologie & SaaS',
  'Finance & Assurance',
  'Éducation & Formation',
  'Santé & Pharma',
  'Commerce & Retail',
  'Média & Communication',
  'Tourisme & Transport',
  'Industrie & Manufacture',
  'Immobilier & Construction',
  'Alimentation & Restaurant',
  'Juridique & Compliance',
];

// Keywords that map to each sector — use WORD BOUNDARIES to avoid false positives
// Each keyword is a regex pattern matched as a whole word
const SECTOR_KEYWORDS: Record<string, string[]> = {
  'Conseil & Services Pro': ['consulting', 'conseil', 'stratégie', 'strategie', 'strategy', 'accompagnement', 'advisory', 'coaching', 'durabilité', 'durable', 'sustainability', 'sustainable', '\\brse\\b', '\\bcsr\\b', 'audit', 'transition'],
  'Technologie & SaaS': ['software', '\\bsaas\\b', 'digital', 'platform', 'développement web', 'development', '\\bcloud\\b', '\\bapi\\b', 'agentic', 'website creation', 'cybersecurity', 'machine learning', 'deep learning'],
  'Finance & Assurance': ['finance', 'bank', 'insurance', 'fintech', 'investissement', 'assurance', 'crédit', 'trading', 'asset management'],
  'Éducation & Formation': ['education', 'formation', 'training', 'école', 'university', 'learning', 'cours', 'pédagogie'],
  'Santé & Pharma': ['health', 'santé', 'medical', 'pharma', 'clinic', 'hôpital', 'biotech', 'thérapie'],
  'Commerce & Retail': ['retail', 'e-commerce', 'shop', 'store', 'boutique', 'vente en ligne', 'marketplace'],
  'Média & Communication': ['media', 'presse', 'communication', 'marketing', 'publicité', 'branding', 'journalisme'],
  'Tourisme & Transport': ['tourisme', 'transport', 'voyage', 'hotel', 'airline', 'travel', 'logistics'],
  'Industrie & Manufacture': ['industrie', 'manufacturing', 'production', 'usine', 'fabrication', 'engineering'],
  'Immobilier & Construction': ['immobilier', 'real estate', 'property', 'construction', 'architecture'],
  'Alimentation & Restaurant': ['food', 'restaurant', 'alimentation', 'gastronomie', 'café', 'traiteur'],
  'Juridique & Compliance': ['legal', 'juridique', 'avocat', 'law', 'notaire', 'compliance', 'droit'],
};

/**
 * Detect sector from services using word-boundary matching.
 * Counts keyword matches; highest score wins.
 */
function detectSectorFromServices(services: string[], title: string): string | null {
  const allText = [...services, title].join(' ').toLowerCase();
  let best: string | null = null;
  let bestScore = 0;
  for (const [sector, patterns] of Object.entries(SECTOR_KEYWORDS)) {
    let score = 0;
    for (const pat of patterns) {
      try {
        // Use word boundary regex to avoid false positives ("ai" in "souverains")
        const re = pat.startsWith('\\b') ? new RegExp(pat, 'i') : new RegExp(`\\b${pat}\\b`, 'i');
        if (re.test(allText)) score++;
      } catch {
        // Fallback to simple includes if regex fails
        if (allText.includes(pat)) score++;
      }
    }
    if (score > bestScore) { bestScore = score; best = sector; }
  }
  console.log(`[compare] Detected sector: ${best} (score=${bestScore}) from ${services.length} services`);
  return best;
}

/**
 * Check if an entity belongs to the target sector.
 * STRICT: only exact match with standard sector names.
 * For non-standard sector_macro (long descriptions), require 3+ keyword matches.
 */
function entityMatchesSector(entitySector: string, targetSector: string): boolean {
  if (!entitySector || !targetSector) return false;
  const es = entitySector.toLowerCase().trim();
  const ts = targetSector.toLowerCase().trim();

  // Exact match with target
  if (es === ts) return true;

  // Entity has a standard sector name — only match if identical
  if (SECTORS.some(s => s.toLowerCase() === es)) {
    return es === ts;
  }

  // Non-standard sector (long description) — require 3+ keyword matches (strict)
  const patterns = SECTOR_KEYWORDS[targetSector] || [];
  let matchCount = 0;
  for (const pat of patterns) {
    try {
      const re = pat.startsWith('\\b') ? new RegExp(pat, 'i') : new RegExp(`\\b${pat}\\b`, 'i');
      if (re.test(es)) matchCount++;
    } catch {
      if (es.includes(pat)) matchCount++;
    }
  }
  return matchCount >= 3;
}

export async function POST(req: NextRequest) {
  try {
    const { country, services, siteName, siteUrl } = await req.json();

    // Fetch ALL entities — must include older certified entities like Eclore
    const allEntities = await db.getAyaEntities(10000);
    if (!allEntities?.length) {
      return NextResponse.json({ competitors: [], averageScore: 0, totalInSector: 0 });
    }

    const detectedSector = detectSectorFromServices(services || [], siteName || '');
    const siteNorm = (siteUrl || '').replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/$/, '').toLowerCase();

    // Filter by STRICT sector match + exclude tested site
    const sectorPool = allEntities.filter((e: any) => {
      const eName = (e.display_name || e.legal_name || '');
      const eUrl = (e.website || '').replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/$/, '').toLowerCase();

      // Exclude tested site
      if (siteNorm && eUrl && (eUrl.includes(siteNorm) || siteNorm.includes(eUrl))) return false;
      if (siteName && eName.toLowerCase() === siteName.toLowerCase()) return false;
      if (eName.length < 2) return false;

      // STRICT sector match
      if (!detectedSector) return false;
      return entityMatchesSector(e.sector_macro || '', detectedSector);
    });

    // Certified competitors — STRICT sector match required
    const sorted = sectorPool
      .filter((e: any) => e.payment_completed === true && (e.asr_score || 0) > 0)
      .sort((a: any, b: any) => (b.asr_score || 0) - (a.asr_score || 0));

    const competitors = sorted.slice(0, 5).map((e: any) => ({
      name: e.display_name || e.legal_name,
      score: e.asr_score || 0,
      country: e.country_legal || '',
      certified: e.payment_completed === true,
      sector: e.sector_macro || '',
    }));

    // Average from sector pool (bot + certified)
    const scores = sectorPool.map((e: any) => e.asr_score || 0).filter((s: number) => s > 0);
    const averageScore = scores.length > 0
      ? Math.round(scores.reduce((a: number, b: number) => a + b, 0) / scores.length)
      : 0;

    console.log(`[compare] sector=${detectedSector}, pool=${sectorPool.length}, certified=${sorted.length}, avg=${averageScore}`);

    return NextResponse.json({
      competitors,
      averageScore,
      totalInSector: sectorPool.length,
      detectedSector,
    });
  } catch (err) {
    console.error('[compare]', err);
    return NextResponse.json({ competitors: [], averageScore: 0, totalInSector: 0 });
  }
}
