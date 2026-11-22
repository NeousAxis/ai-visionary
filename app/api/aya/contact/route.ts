import { NextRequest, NextResponse } from 'next/server';
import { startContact, confirmContact } from '@/lib/aya/contact';
import { checkRateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { allow, realIp } from '@/lib/aya/guard';

export const dynamic = 'force-dynamic';

/**
 * POST /api/aya/contact
 * { step: 'start',   entity_id, email, subject, message }          -> { ok, token }
 * { step: 'confirm', entity_id, email, subject, message, token, code } -> { ok }
 * Voir lib/aya/contact.ts.
 */
export async function POST(req: NextRequest) {
    const limited = checkRateLimit(req, 'aya-contact', RATE_LIMITS.otp);
    if (limited) return limited;
    // IP réelle : 10 appels par 10 minutes, 30 par jour.
    const ip = realIp(req);
    if (!allow(`contact:m:${ip}`, 10, 600_000) || !allow(`contact:d:${ip}`, 30, 86_400_000)) {
        return NextResponse.json({ ok: false, error: 'rate' }, { status: 429 });
    }

    let body: any;
    try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: 'invalid' }, { status: 400 }); }

    const input = {
        entityId: String(body?.entity_id || ''),
        email: String(body?.email || ''),
        subject: String(body?.subject || ''),
        message: String(body?.message || ''),
    };
    try {
        if (body?.step === 'start') {
            const r = await startContact(input);
            return NextResponse.json(r, { status: r.ok ? 200 : r.error === 'rate' ? 429 : 400 });
        }
        if (body?.step === 'confirm') {
            const r = await confirmContact({ ...input, token: String(body?.token || ''), code: String(body?.code || '') });
            return NextResponse.json(r, { status: r.ok ? 200 : 400 });
        }
        return NextResponse.json({ ok: false, error: 'invalid' }, { status: 400 });
    } catch (err) {
        console.error('[aya/contact] error:', err);
        return NextResponse.json({ ok: false, error: 'send' }, { status: 500 });
    }
}
