// app/api/diagnostic/compare/route.ts — Find REAL sector competitors from AYA registry

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// Map detected service keywords to AYA sector_macro values (in French)
const SECTOR_MAP: Record<string, string[]> = {
  'Conseil & Services Pro': ['consulting', 'conseil', 'stratégie', 'strategy', 'accompagnement', 'advisory', 'coaching', 'formation', 'durabilité', 'sustainability', 'rse', 'csr'],
  'Technologie & SaaS': ['tech', 'software', 'saas', 'digital', 'platform', 'app', 'développement', 'it', 'web', 'ai', 'data', 'cloud', 'api'],
  'Finance & Assurance': ['finance', 'bank', 'insurance', 'fintech', 'investissement', 'crédit', 'assurance'],
  'Éducation & Formation': ['education', 'formation', 'training', 'école', 'university', 'learning'],
  'Santé & Pharma': ['health', 'santé', 'medical', 'pharma', 'clinic', 'hôpital'],
  'Commerce & Retail': ['retail', 'commerce', 'e-commerce', 'shop', 'store', 'boutique', 'vente'],
  'Média & Communication': ['media', 'presse', 'journal', 'communication', 'marketing', 'agence', 'pub'],
  'Tourisme & Transport': ['tourisme', 'transport', 'voyage', 'hotel', 'airline', 'travel'],
  'Industrie & Manufacture': ['industrie', 'manufacturing', 'production', 'usine', 'fabrication'],
  'Immobilier & Construction': ['immobilier', 'real estate', 'property', 'construction'],
  'Alimentation & Restaurant': ['food', 'restaurant', 'alimentation', 'gastronomie'],
  'Juridique & Compliance': ['legal', 'juridique', 'avocat', 'law', 'notaire', 'droit'],
};

function detectSectorMacro(services: string[], title: string): string | null {
  const allText = [...services, title].join(' ').toLowerCase();
  let bestMatch: string | null = null;
  let bestCount = 0;

  for (const [sectorMacro, keywords] of Object.entries(SECTOR_MAP)) {
    const count = keywords.filter(kw => allText.includes(kw)).length;
    if (count > bestCount) {
      bestCount = count;
      bestMatch = sectorMacro;
    }
  }
  return bestMatch;
}

export async function POST(req: NextRequest) {
  try {
    const { country, services, siteName, siteUrl } = await req.json();

    const allEntities = await db.getAyaEntities(1000);
    if (!allEntities || allEntities.length === 0) {
      return NextResponse.json({ competitors: [], averageScore: 0, totalInSector: 0 });
    }

    // Detect sector from services
    const detectedSector = detectSectorMacro(services || [], siteName || '');

    // Normalize site URL for exclusion
    const siteNorm = (siteUrl || '').replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/$/, '').toLowerCase();

    // Filter by sector_macro + exclude tested site
    const sectorPool = allEntities.filter((e: any) => {
      const eName = (e.display_name || e.legal_name || '');
      const eUrl = (e.website || '').replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/$/, '').toLowerCase();

      // Exclude tested site
      if (siteNorm && eUrl && (eUrl.includes(siteNorm) || siteNorm.includes(eUrl))) return false;
      if (siteName && eName.toLowerCase() === siteName.toLowerCase()) return false;
      if (eName.length < 2) return false;

      // Match sector
      if (!detectedSector) return true; // no sector detected = show all
      const eSector = (e.sector_macro || '');
      return eSector === detectedSector;
    });

    // Use ONLY sector pool — no fallback to random companies
    const pool = sectorPool;

    // Sort: certified first, then by score descending — exclude pure 50s unless certified
    const sorted = pool
      .filter((e: any) => (e.asr_score || 0) > 0)
      .filter((e: any) => e.payment_completed === true || (e.asr_score || 0) !== 50)
      .sort((a: any, b: any) => {
        const ac = a.payment_completed ? 1 : 0;
        const bc = b.payment_completed ? 1 : 0;
        if (ac !== bc) return bc - ac;
        return (b.asr_score || 0) - (a.asr_score || 0);
      });

    const competitors = sorted.slice(0, 5).map((e: any) => ({
      name: e.display_name || e.legal_name,
      score: e.asr_score || 0,
      country: e.country_legal || '',
      certified: e.payment_completed === true,
      sector: e.sector_macro || '',
    }));

    // Average from sector pool
    const scores = pool.map((e: any) => e.asr_score || 0).filter((s: number) => s > 0);
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
