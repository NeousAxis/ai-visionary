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

// Keywords that map to each sector
const SECTOR_KEYWORDS: Record<string, string[]> = {
  'Conseil & Services Pro': ['consulting', 'conseil', 'stratégie', 'strategy', 'accompagnement', 'advisory', 'coaching', 'durabilité', 'sustainability', 'rse', 'csr', 'audit'],
  'Technologie & SaaS': ['tech', 'software', 'saas', 'digital', 'platform', 'app', 'développement', 'development', 'web', 'ai', 'data', 'cloud', 'api', 'native', 'agentic', 'website creation', 'mobile'],
  'Finance & Assurance': ['finance', 'bank', 'insurance', 'fintech', 'investissement', 'assurance', 'crédit', 'trading'],
  'Éducation & Formation': ['education', 'formation', 'training', 'école', 'university', 'learning', 'cours'],
  'Santé & Pharma': ['health', 'santé', 'medical', 'pharma', 'clinic', 'hôpital', 'biotech'],
  'Commerce & Retail': ['retail', 'commerce', 'e-commerce', 'shop', 'store', 'boutique', 'vente'],
  'Média & Communication': ['media', 'presse', 'communication', 'marketing', 'agence', 'publicité', 'design'],
  'Tourisme & Transport': ['tourisme', 'transport', 'voyage', 'hotel', 'airline', 'travel', 'logistics'],
  'Industrie & Manufacture': ['industrie', 'manufacturing', 'production', 'usine', 'fabrication', 'engineering'],
  'Immobilier & Construction': ['immobilier', 'real estate', 'property', 'construction', 'architecture'],
  'Alimentation & Restaurant': ['food', 'restaurant', 'alimentation', 'gastronomie', 'café', 'traiteur'],
  'Juridique & Compliance': ['legal', 'juridique', 'avocat', 'law', 'notaire', 'compliance', 'droit'],
};

function detectSectorFromServices(services: string[], title: string): string | null {
  const allText = [...services, title].join(' ').toLowerCase();
  let best: string | null = null;
  let bestScore = 0;
  for (const [sector, keywords] of Object.entries(SECTOR_KEYWORDS)) {
    const score = keywords.filter(kw => allText.includes(kw)).length;
    if (score > bestScore) { bestScore = score; best = sector; }
  }
  return best;
}

function entityMatchesSector(entitySector: string, targetSector: string): boolean {
  if (!entitySector || !targetSector) return false;
  const es = entitySector.toLowerCase();
  const ts = targetSector.toLowerCase();

  // Exact match
  if (es === ts) return true;

  // Entity has standard sector that matches target
  if (SECTORS.some(s => s.toLowerCase() === es && s.toLowerCase() === ts)) return true;

  // Entity has long description — check if it contains keywords of target sector
  const keywords = SECTOR_KEYWORDS[targetSector] || [];
  const matchCount = keywords.filter(kw => es.includes(kw)).length;
  return matchCount >= 2; // At least 2 keyword matches
}

export async function POST(req: NextRequest) {
  try {
    const { country, services, siteName, siteUrl } = await req.json();

    const allEntities = await db.getAyaEntities(1000);
    if (!allEntities?.length) {
      return NextResponse.json({ competitors: [], averageScore: 0, totalInSector: 0 });
    }

    const detectedSector = detectSectorFromServices(services || [], siteName || '');
    const siteNorm = (siteUrl || '').replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/$/, '').toLowerCase();

    // Filter by sector + exclude tested site
    const sectorPool = allEntities.filter((e: any) => {
      const eName = (e.display_name || e.legal_name || '');
      const eUrl = (e.website || '').replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/$/, '').toLowerCase();

      // Exclude tested site
      if (siteNorm && eUrl && (eUrl.includes(siteNorm) || siteNorm.includes(eUrl))) return false;
      if (siteName && eName.toLowerCase() === siteName.toLowerCase()) return false;
      if (eName.length < 2) return false;

      // Match sector
      if (!detectedSector) return false;
      return entityMatchesSector(e.sector_macro || '', detectedSector);
    });

    // ONLY certified entities — bot-indexed at 50 are NOT comparable (pending V2 re-scoring batch)
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

    // Average from sector pool
    const scores = sectorPool.map((e: any) => e.asr_score || 0).filter((s: number) => s > 0);
    const averageScore = scores.length > 0
      ? Math.round(scores.reduce((a: number, b: number) => a + b, 0) / scores.length)
      : 0;

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
