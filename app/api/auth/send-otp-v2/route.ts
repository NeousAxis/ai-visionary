// POST /api/auth/send-otp-v2 — Send OTP to any email matching the scanned URL domain
// Used by diagnostic V2 to verify the requester belongs to the company

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { Resend } from 'resend';
import { checkRateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { maskEmail } from '@/lib/sanitize';

export const dynamic = 'force-dynamic';

const resend = new Resend(process.env.RESEND_API_KEY);

/** Extract bare domain from a URL (strips protocol, www, path) */
function extractDomain(input: string): string {
    return input.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0].toLowerCase();
}

export async function POST(req: NextRequest) {
    // Rate limit: 5 requests/min per IP
    const rateLimited = checkRateLimit(req, 'send-otp-v2', RATE_LIMITS.otp);
    if (rateLimited) return rateLimited;

    try {
        const body = await req.json();
        const { url, email } = body;

        // Read locale from body or cookie
        const cookieHeader = req.headers.get('cookie') || '';
        const cookieLocaleMatch = cookieHeader.match(/NEXT_LOCALE=(fr|en)/);
        const locale: 'fr' | 'en' = body.locale === 'en' ? 'en' : (cookieLocaleMatch?.[1] === 'en' ? 'en' : 'fr');
        const en = locale === 'en';

        // 1. Validate required fields
        if (!url || !email) {
            console.log('[otp-v2] Missing url or email');
            return NextResponse.json(
                { error: en ? 'URL and email are required.' : 'URL et email requis.' },
                { status: 400 }
            );
        }

        const trimmedEmail = email.trim().toLowerCase();

        // 2. Extract domains
        const urlDomain = extractDomain(url);
        const emailDomain = trimmedEmail.split('@')[1];

        if (!urlDomain || !emailDomain) {
            console.log('[otp-v2] Invalid url or email format');
            return NextResponse.json(
                { error: en ? 'Invalid URL or email format.' : 'Format URL ou email invalide.' },
                { status: 400 }
            );
        }

        // 3. Verify domains match
        if (urlDomain !== emailDomain) {
            console.log(`[otp-v2] Domain mismatch: url=${urlDomain} email=${emailDomain}`);
            return NextResponse.json(
                { error: en ? 'Email domain must match the website domain.' : "Le domaine de l'email doit correspondre au domaine du site." },
                { status: 403 }
            );
        }

        // 4. Generate 6-digit code
        const code = Math.floor(100000 + Math.random() * 900000).toString();

        // 5. Save to DB (expires in 10 mins)
        await db.saveOTP(trimmedEmail, code);
        console.log(`[otp-v2] OTP saved for ${maskEmail(trimmedEmail)}`);

        // 6. Send email via Resend
        const otpSubject = en
            ? `Your verification code: ${code}`
            : `Votre code de verification : ${code}`;

        const { error } = await resend.emails.send({
            from: 'AI Visionary Security <security@ai-visionary.com>',
            to: [trimmedEmail],
            subject: otpSubject,
            html: `
            <div style="font-family: sans-serif; padding: 20px; color: #333;">
                <h2>${en ? 'Email Verification' : 'Verification Email'}</h2>
                <p>${en
                    ? `You requested a verification code for <strong>${urlDomain}</strong>.`
                    : `Vous avez demande un code de verification pour <strong>${urlDomain}</strong>.`
                }</p>
                <p>${en ? 'Here is your one-time code (valid for 10 minutes):' : 'Voici votre code unique (valable 10 minutes) :'}</p>
                <div style="background-color: #f4f4f4; padding: 15px; font-size: 24px; letter-spacing: 5px; font-weight: bold; text-align: center; border-radius: 8px; border: 1px solid #ddd;">
                    ${code}
                </div>
                <p style="margin-top: 20px; font-size: 12px; color: #666;">
                    ${en ? 'If you did not request this, please ignore this email.' : "Si vous n'etes pas a l'origine de cette demande, ignorez cet email."}
                </p>
            </div>
            `,
        });

        if (error) {
            console.log(`[otp-v2] Email send failed: ${error.message}`);
            return NextResponse.json({ error: 'Failed to send email.' }, { status: 500 });
        }

        const masked = maskEmail(trimmedEmail);
        console.log(`[otp-v2] OTP sent to ${masked}`);

        return NextResponse.json({ success: true, maskedEmail: masked }, { status: 200 });

    } catch (e: unknown) {
        const message = e instanceof Error ? e.message : 'Unknown error';
        console.log(`[otp-v2] Error: ${message}`);
        return NextResponse.json({ error: 'Internal error' }, { status: 500 });
    }
}
