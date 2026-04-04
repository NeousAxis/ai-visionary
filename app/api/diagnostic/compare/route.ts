// app/api/diagnostic/compare/route.ts — Find real competitors from AYA registry

import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const { sector, country, currentScore } = await req.json();

    const query = [sector, country].filter(Boolean).join(' ') || 'consulting';
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://ai-visionary.com';

    // Use our own AYA search API
    const res = await fetch(`${baseUrl}/api/aya/search?q=${encodeURIComponent(query)}&limit=20`, {
      headers: { 'User-Agent': 'AYO-Internal' },
    });

    if (!res.ok) {
      return NextResponse.json({ competitors: [], averageScore: 32 });
    }

    const data = await res.json();
    const entities = data.results || data.entities || data || [];

    if (!Array.isArray(entities) || entities.length === 0) {
      return NextResponse.json({ competitors: [], averageScore: 32 });
    }

    // Calculate average score
    const scores = entities
      .map((e: any) => e.asr_score || e.score || 0)
      .filter((s: number) => s > 0);
    const averageScore = scores.length > 0
      ? Math.round(scores.reduce((a: number, b: number) => a + b, 0) / scores.length)
      : 32;

    // Pick top 5 with highest scores
    const competitors = entities
      .filter((e: any) => (e.asr_score || e.score || 0) > 0)
      .sort((a: any, b: any) => (b.asr_score || b.score || 0) - (a.asr_score || a.score || 0))
      .slice(0, 5)
      .map((e: any) => ({
        name: e.name || e.entity_name || 'Unknown',
        score: e.asr_score || e.score || 0,
        country: e.country || '',
      }));

    return NextResponse.json({
      competitors,
      averageScore,
      totalInSector: entities.length,
    });
  } catch {
    return NextResponse.json({ competitors: [], averageScore: 32 });
  }
}
