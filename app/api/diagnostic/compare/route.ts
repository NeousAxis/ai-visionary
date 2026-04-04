// app/api/diagnostic/compare/route.ts — Find real competitors from AYA registry

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function POST(req: NextRequest) {
  try {
    const { country, currentScore } = await req.json();

    // Strategy: get entities from the same country with REAL scores
    // (not just default 50 from bot indexing)
    const allEntities = await db.getAyaEntities(500);

    if (!allEntities || allEntities.length === 0) {
      return NextResponse.json({ competitors: [], averageScore: 0, totalInSector: 0 });
    }

    // Filter: same country if available, otherwise all
    let pool = allEntities;
    if (country) {
      const countryLower = country.toLowerCase();
      const countryPool = pool.filter((e: any) =>
        (e.country || '').toLowerCase().includes(countryLower) ||
        countryLower.includes((e.country || '').toLowerCase())
      );
      // Only use country filter if we have enough results
      if (countryPool.length >= 5) {
        pool = countryPool;
      }
    }

    // Separate entities with real scores (certified/PRO with payment)
    // vs bot-indexed (all have exactly 50)
    const withRealScore = pool.filter((e: any) => {
      const score = e.asr_score || 0;
      return score > 0 && score !== 50; // 50 = default bot score
    });

    const certified = pool.filter((e: any) => e.payment_completed === true);

    // Combine: prefer certified entities + entities with non-default scores
    const meaningfulEntities = [
      ...certified,
      ...withRealScore.filter((e: any) => !certified.some((c: any) => c.aya_entity_id === e.aya_entity_id)),
    ];

    // If we don't have enough meaningful entities, include some bot-indexed ones
    // but spread the scores to show variety
    let competitors: { name: string; score: number; country: string; certified: boolean }[];

    if (meaningfulEntities.length >= 3) {
      competitors = meaningfulEntities
        .sort((a: any, b: any) => (b.asr_score || 0) - (a.asr_score || 0))
        .slice(0, 5)
        .map((e: any) => ({
          name: e.name || e.entity_name || 'Unknown',
          score: e.asr_score || 0,
          country: e.country || '',
          certified: e.payment_completed === true,
        }));
    } else {
      // Use all pool but prefer variety in scores
      competitors = pool
        .filter((e: any) => (e.asr_score || 0) > 0)
        .sort((a: any, b: any) => (b.asr_score || 0) - (a.asr_score || 0))
        .slice(0, 5)
        .map((e: any) => ({
          name: e.name || e.entity_name || 'Unknown',
          score: e.asr_score || 0,
          country: e.country || '',
          certified: e.payment_completed === true,
        }));
    }

    // Calculate real average (from all entities with scores)
    const allScores = pool
      .map((e: any) => e.asr_score || 0)
      .filter((s: number) => s > 0);
    const averageScore = allScores.length > 0
      ? Math.round(allScores.reduce((a: number, b: number) => a + b, 0) / allScores.length)
      : 0;

    return NextResponse.json({
      competitors,
      averageScore,
      totalInSector: pool.length,
    });
  } catch (err) {
    console.error('[compare]', err);
    return NextResponse.json({ competitors: [], averageScore: 0, totalInSector: 0 });
  }
}
