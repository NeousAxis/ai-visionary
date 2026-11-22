import { NextRequest, NextResponse } from 'next/server';

// ============================================================
// Simple In-Memory Rate Limiter for Vercel Serverless
// Note: Each serverless instance has its own memory, so this
// provides per-instance rate limiting (sufficient for basic protection)
// ============================================================

interface RateLimitEntry {
    count: number;
    resetAt: number;
}

const store = new Map<string, RateLimitEntry>();

// Cleanup old entries periodically to prevent memory leaks
const CLEANUP_INTERVAL = 60_000; // 1 minute
let lastCleanup = Date.now();

function cleanup() {
    const now = Date.now();
    if (now - lastCleanup < CLEANUP_INTERVAL) return;
    lastCleanup = now;

    for (const [key, entry] of store.entries()) {
        if (now > entry.resetAt) {
            store.delete(key);
        }
    }
}

/**
 * IP du client. Derrière le nginx du VPS, X-Real-IP vaut $remote_addr : fiable.
 * X-Forwarded-For ($proxy_add_x_forwarded_for) garde ce que le client envoie,
 * donc sa PREMIÈRE valeur se falsifie et permettait de contourner toutes les
 * limites (corrigé le 22.11.2026). À défaut de X-Real-IP, on prend la DERNIÈRE
 * valeur, ajoutée par notre proxy.
 */
function getClientIp(req: NextRequest): string {
    const real = req.headers.get('x-real-ip')?.trim();
    if (real) return real;
    const parts = (req.headers.get('x-forwarded-for') || '').split(',').map((s) => s.trim()).filter(Boolean);
    return parts[parts.length - 1] || 'unknown';
}

/** Rate limit configuration */
interface RateLimitConfig {
    /** Maximum requests allowed in the window */
    maxRequests: number;
    /** Window duration in milliseconds */
    windowMs: number;
}

/** Pre-configured limits for different endpoints */
export const RATE_LIMITS = {
    otp: { maxRequests: 5, windowMs: 60_000 } as RateLimitConfig,       // 5/min
    chat: { maxRequests: 15, windowMs: 60_000 } as RateLimitConfig,     // 15/min
    checkout: { maxRequests: 5, windowMs: 60_000 } as RateLimitConfig,  // 5/min
    debug: { maxRequests: 10, windowMs: 60_000 } as RateLimitConfig,    // 10/min
    default: { maxRequests: 30, windowMs: 60_000 } as RateLimitConfig,  // 30/min
} as const;

/** Check rate limit. Returns null if allowed, or a 429 Response if blocked. */
export function checkRateLimit(
    req: NextRequest,
    endpointKey: string,
    config: RateLimitConfig = RATE_LIMITS.default
): NextResponse | null {
    cleanup();

    const ip = getClientIp(req);
    const key = `${endpointKey}:${ip}`;
    const now = Date.now();

    const entry = store.get(key);

    if (!entry || now > entry.resetAt) {
        // New window
        store.set(key, { count: 1, resetAt: now + config.windowMs });
        return null;
    }

    entry.count++;

    if (entry.count > config.maxRequests) {
        const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
        return NextResponse.json(
            { error: 'Trop de requetes. Reessayez dans quelques instants.' },
            {
                status: 429,
                headers: {
                    'Retry-After': String(retryAfter),
                    'X-RateLimit-Limit': String(config.maxRequests),
                    'X-RateLimit-Remaining': '0',
                    'X-RateLimit-Reset': String(entry.resetAt),
                },
            }
        );
    }

    return null;
}
