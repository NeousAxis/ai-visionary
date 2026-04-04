// app/api/diagnostic/compare/route.ts — Find REAL sector competitors from AYA registry

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// Map detected keywords to AYA sector_macro values
const SECTOR_KEYWORDS: Record<string, string[]> = {
  'consulting': ['consulting', 'conseil', 'stratégie', 'strategy', 'accompagnement', 'advisory'],
  'technology': ['tech', 'software', 'saas', 'digital', 'platform', 'app', 'développement', 'it services'],
  'finance': ['finance', 'bank', 'insurance', 'fintech', 'investissement', 'crédit'],
  'education': ['education', 'formation', 'training', 'école', 'university', 'learning'],
  'healthcare': ['health', 'santé', 'medical', 'pharma', 'clinic'],
  'retail': ['retail', 'commerce', 'e-commerce', 'shop', 'store', 'boutique'],
  'sustainability': ['durable', 'durabilité', 'sustainability', 'rse', 'csr', 'environnement', 'écologie', 'green', 'transition'],
  'association': ['association', 'ong', 'ngo', 'fondation', 'non-profit', 'bénévol'],
  'media': ['media', 'presse', 'journal', 'communication', 'marketing', 'agence'],
  'legal': ['legal', 'juridique', 'avocat', 'law', 'notaire', 'droit'],
  'real-estate': ['immobilier', 'real estate', 'property', 'construction'],
  'food': ['food', 'restaurant', 'alimentation', 'gastronomie', 'cuisine'],
  'manufacturing': ['industrie', 'manufacturing', 'production', 'usine', 'fabrication'],
};

function detectSector(services: string[], title: string): string[] {
  const allText = [...services, title].join(' ').toLowerCase();
  const matches: string[] = [];
  for (const [sector, keywords] of Object.entries(SECTOR_KEYWORDS)) {
    if (keywords.some(kw => allText.includes(kw))) {
      matches.push(sector);
    }
  }
  return matches.length > 0 ? matches : ['consulting']; // fallback
}

export async function POST(req: NextRequest) {
  try {
    const { country, services, siteName, siteUrl } = await req.json();

    const allEntities = await db.getAyaEntities(1000);
    if (!allEntities || allEntities.length === 0) {
      return NextResponse.json({ competitors: [], averageScore: 0, totalInSector: 0 });
    }

    // Detect sector from services
    const sectors = detectSector(services || [], siteName || '');

    // Normalize site URL for exclusion
    const siteUrlNorm = (siteUrl || '').replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/$/, '').toLowerCase();

    // Filter: same sector + exclude the tested site itself
    const sectorPool = allEntities.filter((e: any) => {
      const name = (e.display_name || e.legal_name || '').toLowerCase();
      const entitySector = (e.sector_macro || '').toLowerCase();
      const entityUrl = (e.website || '').replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/$/, '').toLowerCase();

      // Exclude the tested site
      if (siteUrlNorm && entityUrl && entityUrl.includes(siteUrlNorm)) return false;
      if (siteUrlNorm && siteUrlNorm.includes(entityUrl) && entityUrl.length > 3) return false;
      if (siteName && name === siteName.toLowerCase()) return false;

      // Must have a name
      if (name.length < 2) return false;

      // Match sector
      return sectors.some(s =>
        entitySector.includes(s) ||
        SECTOR_KEYWORDS[s]?.some(kw => entitySector.includes(kw) || name.includes(kw))
      );
    });

    // If sector filter too restrictive, try country filter
    let pool = sectorPool;
    if (pool.length < 3 && country) {
      const cl = country.toLowerCase();
      pool = allEntities.filter((e: any) => {
        const entityUrl = (e.website || '').replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/$/, '').toLowerCase();
        if (siteUrlNorm && entityUrl.includes(siteUrlNorm)) return false;
        const n = (e.display_name || e.legal_name || '');
        return n.length > 1 && (e.country_legal || '').toLowerCase().includes(cl);
      });
    }

    // If no sector match, DON'T fall back to random companies
    // Instead return empty competitors with a flag

    // Sort by score, prefer certified
    const sorted = pool
      .filter((e: any) => (e.asr_score || 0) > 0)
      .sort((a: any, b: any) => {
        // Certified first, then by score
        const aCert = a.payment_completed ? 1 : 0;
        const bCert = b.payment_completed ? 1 : 0;
        if (aCert !== bCert) return bCert - aCert;
        return (b.asr_score || 0) - (a.asr_score || 0);
      });

    const competitors = sorted.slice(0, 5).map((e: any) => ({
      name: e.display_name || e.legal_name,
      score: e.asr_score || 0,
      country: e.country_legal || '',
      certified: e.payment_completed === true,
      sector: e.sector_macro || '',
    }));

    // Average
    const scores = pool.map((e: any) => e.asr_score || 0).filter((s: number) => s > 0);
    const averageScore = scores.length > 0
      ? Math.round(scores.reduce((a: number, b: number) => a + b, 0) / scores.length)
      : 0;

    // If pool is too small or only has generic 50-score entities, don't show fake competitors
    const hasRealCompetitors = competitors.length > 0 && competitors.some((c: any) => c.score !== 50);

    return NextResponse.json({
      competitors: hasRealCompetitors ? competitors : [],
      averageScore,
      totalInSector: sectorPool.length,
      detectedSectors: sectors,
      noCompetitors: !hasRealCompetitors,
    });
  } catch (err) {
    console.error('[compare]', err);
    return NextResponse.json({ competitors: [], averageScore: 0, totalInSector: 0 });
  }
}
