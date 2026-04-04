// app/api/diagnostic/compare/route.ts — Find real competitors from AYA registry

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function POST(req: NextRequest) {
  try {
    const { country } = await req.json();

    const allEntities = await db.getAyaEntities(500);
    if (!allEntities || allEntities.length === 0) {
      return NextResponse.json({ competitors: [], averageScore: 0, totalInSector: 0 });
    }

    // Filter by country if available
    let pool = allEntities;
    if (country) {
      const cl = country.toLowerCase();
      const countryPool = pool.filter((e: any) =>
        (e.country_legal || e.country || '').toLowerCase().includes(cl)
      );
      if (countryPool.length >= 3) pool = countryPool;
    }

    // Only keep entities WITH a name (no "Unknown")
    const named = pool.filter((e: any) => {
      const n = e.display_name || e.legal_name || '';
      return n.length > 1 && n !== 'Unknown';
    });

    // Prefer certified entities (real scores), then entities with non-50 scores
    const certified = named.filter((e: any) => e.payment_completed === true && (e.asr_score || 0) > 0);
    const withRealScore = named.filter((e: any) => {
      const s = e.asr_score || 0;
      return s > 0 && s !== 50 && !certified.some((c: any) => c.entity_id === e.entity_id);
    });

    const meaningful = [...certified, ...withRealScore];

    // Build competitors list — only named entities
    const competitors = (meaningful.length >= 3 ? meaningful : named.filter((e: any) => (e.asr_score || 0) > 0))
      .sort((a: any, b: any) => (b.asr_score || 0) - (a.asr_score || 0))
      .slice(0, 5)
      .map((e: any) => ({
        name: e.display_name || e.legal_name || 'N/A',
        score: e.asr_score || 0,
        country: e.country_legal || e.country || '',
        certified: e.payment_completed === true,
      }))
      .filter((c: any) => c.name !== 'N/A'); // Extra safety

    // Average from pool
    const scores = named.map((e: any) => e.asr_score || 0).filter((s: number) => s > 0);
    const averageScore = scores.length > 0
      ? Math.round(scores.reduce((a: number, b: number) => a + b, 0) / scores.length)
      : 0;

    return NextResponse.json({
      competitors,
      averageScore,
      totalInSector: named.length,
    });
  } catch (err) {
    console.error('[compare]', err);
    return NextResponse.json({ competitors: [], averageScore: 0, totalInSector: 0 });
  }
}
