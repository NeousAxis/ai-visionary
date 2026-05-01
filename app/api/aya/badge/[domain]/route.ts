import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { trackAyaCall } from '@/lib/aya/api-tracker';
import { checkRateLimit, RATE_LIMITS } from '@/lib/rate-limit';

// ── Helpers ────────────────────────────────────────────────────────────────

function truncate(str: string, max: number): string {
    if (str.length <= max) return str;
    return str.slice(0, max) + '…';
}

function scoreColor(score: number): string {
    if (score >= 75) return '#15803D';
    if (score >= 50) return '#4A919E';
    if (score >= 30) return '#D97706';
    return '#CE6A6B';
}

function escapeXml(str: string): string {
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}

function buildFoundBadge(name: string, score: number): string {
    const displayName = escapeXml(truncate(name, 20));
    const color = scoreColor(score);

    return `<svg xmlns="http://www.w3.org/2000/svg" width="220" height="50" role="img" aria-label="AYA Score: ${score}/100">
  <title>AYA Score: ${score}/100</title>
  <rect width="220" height="50" rx="6" ry="6" fill="#F8FAFC" stroke="#CBD5E1" stroke-width="1"/>
  <rect width="40" height="50" rx="6" ry="6" fill="#212E53"/>
  <rect width="6" height="50" x="34" fill="#212E53"/>
  <text x="20" y="32" font-family="system-ui,-apple-system,sans-serif" font-size="12" font-weight="800" fill="#FFFFFF" text-anchor="middle">AYA</text>
  <text x="130" y="20" font-family="system-ui,-apple-system,sans-serif" font-size="11" font-weight="600" fill="#1E293B" text-anchor="middle">${displayName}</text>
  <text x="130" y="38" font-family="system-ui,-apple-system,sans-serif" font-size="13" font-weight="700" fill="${color}" text-anchor="middle">Score AIO: ${score}/100</text>
</svg>`;
}

function buildNotFoundBadge(): string {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="220" height="50" role="img" aria-label="Get your AYA score">
  <title>Get your AYA score</title>
  <rect width="220" height="50" rx="6" ry="6" fill="#F8FAFC" stroke="#CBD5E1" stroke-width="1"/>
  <rect width="40" height="50" rx="6" ry="6" fill="#212E53"/>
  <rect width="6" height="50" x="34" fill="#212E53"/>
  <text x="20" y="32" font-family="system-ui,-apple-system,sans-serif" font-size="12" font-weight="800" fill="#FFFFFF" text-anchor="middle">AYA</text>
  <text x="130" y="20" font-family="system-ui,-apple-system,sans-serif" font-size="11" font-weight="500" fill="#64748B" text-anchor="middle">Not yet registered</text>
  <text x="130" y="38" font-family="system-ui,-apple-system,sans-serif" font-size="11" font-weight="600" fill="#4A919E" text-anchor="middle">Get your AYA score →</text>
</svg>`;
}

// ── Route handler ──────────────────────────────────────────────────────────

export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ domain: string }> }
): Promise<NextResponse> {
    // Rate limit
    const rateLimitResponse = checkRateLimit(req, 'aya-badge', RATE_LIMITS.default);
    if (rateLimitResponse) return rateLimitResponse;

    const { domain } = await params;

    // Track (fire-and-forget)
    trackAyaCall(req, 'badge', domain);

    // Lookup entity
    let entity: any = await db.getAyaEntityByUrl('https://' + domain);
    if (!entity) {
        entity = await db.getAyaEntityByUrl('https://www.' + domain);
    }

    const svg = entity && entity.asr_score !== null && entity.asr_score !== undefined
        ? buildFoundBadge(
            entity.display_name || entity.legal_name || domain,
            entity.asr_score
        )
        : buildNotFoundBadge();

    return new NextResponse(svg, {
        status: 200,
        headers: {
            'Content-Type': 'image/svg+xml',
            'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
            'X-Content-Type-Options': 'nosniff',
        },
    });
}
