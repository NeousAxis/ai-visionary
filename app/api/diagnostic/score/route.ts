// app/api/diagnostic/score/route.ts — Compute AIO score from extract

import { NextRequest, NextResponse } from 'next/server';
import { computeAioScore } from '@/lib/aio-score-engine';
import type { AyoExtract } from '@/lib/aio-score-engine';

export async function POST(req: NextRequest) {
  try {
    const { extract } = await req.json() as { extract: AyoExtract };

    if (!extract || !extract.version) {
      return NextResponse.json({ error: 'Valid AyoExtract required' }, { status: 400 });
    }

    const score = computeAioScore(extract);
    return NextResponse.json({ score });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Score computation failed' },
      { status: 500 }
    );
  }
}
