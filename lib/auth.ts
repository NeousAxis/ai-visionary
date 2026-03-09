import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

// ============================================================
// Admin Authentication Middleware
// Uses ADMIN_SECRET env var for protecting admin endpoints
// ============================================================

const ADMIN_SECRET = process.env.ADMIN_SECRET || '';

/** Verify admin secret from query param or Authorization header */
export function requireAdmin(req: NextRequest): { authorized: boolean; response?: NextResponse } {
    if (!ADMIN_SECRET) {
        console.error('[AUTH] ADMIN_SECRET env var is not set');
        return {
            authorized: false,
            response: NextResponse.json({ error: 'Service non configure' }, { status: 503 }),
        };
    }

    // Check Authorization header first
    const authHeader = req.headers.get('authorization');
    if (authHeader) {
        const token = authHeader.replace('Bearer ', '');
        if (timingSafeEqual(token, ADMIN_SECRET)) {
            return { authorized: true };
        }
    }

    // Fallback: check query param
    const url = new URL(req.url);
    const secret = url.searchParams.get('secret');
    if (secret && timingSafeEqual(secret, ADMIN_SECRET)) {
        return { authorized: true };
    }

    return {
        authorized: false,
        response: NextResponse.json({ error: 'Non autorise' }, { status: 401 }),
    };
}

/** Timing-safe string comparison to prevent timing attacks */
function timingSafeEqual(a: string, b: string): boolean {
    if (a.length !== b.length) {
        // Compare against b anyway to maintain constant time
        crypto.timingSafeEqual(Buffer.from(a), Buffer.from(a));
        return false;
    }
    return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
}
