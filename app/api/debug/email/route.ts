import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';
import { requireAdmin } from '@/lib/auth';
import { checkRateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { createLogger, generateCorrelationId } from '@/lib/logger';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
    // Require admin auth for debug endpoints
    const auth = requireAdmin(req);
    if (!auth.authorized) return auth.response!;

    // Rate limit debug endpoints
    const rateLimited = checkRateLimit(req, 'debug', RATE_LIMITS.debug);
    if (rateLimited) return rateLimited;

    const logger = createLogger(generateCorrelationId(), 'admin');
    const { searchParams } = new URL(req.url);
    const targetEmail = searchParams.get('email');

    if (!targetEmail) {
        return NextResponse.json({
            error: "Please provide an email query param. Example: /api/debug/email?email=votre@email.com&secret=YOUR_SECRET",
        });
    }

    const resend = new Resend(process.env.RESEND_API_KEY);

    try {
        // Locale: from query param or default 'en'
        const locale = searchParams.get('locale') === 'fr' ? 'fr' : 'en';
        const en = locale === 'en';

        const data = await resend.emails.send({
            from: 'AI Visionary Debug <hello@ai-visionary.com>',
            to: [targetEmail],
            subject: en ? 'AYO Email Configuration Test' : 'Test de Configuration Email AYO',
            html: en
                ? `<h1>This is a technical test.</h1><p>If you receive this, the Email configuration (Resend) is working on Vercel.</p>`
                : `<h1>Ceci est un test technique.</h1><p>Si vous recevez ceci, la configuration Email (Resend) fonctionne sur Vercel.</p>`
        });

        return NextResponse.json({
            success: true,
            data,
            message: `Email sent to ${targetEmail}`
        });
    } catch (error: any) {
        logger.error('DEBUG_EMAIL_ERROR', error.message || 'Unknown error');
        return NextResponse.json({
            success: false,
            error: error.message,
        }, { status: 500 });
    }
}
