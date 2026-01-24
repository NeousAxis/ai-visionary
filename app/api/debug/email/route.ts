import { NextResponse } from 'next/server';
import { Resend } from 'resend';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const targetEmail = searchParams.get('email');

    if (!targetEmail) {
        return NextResponse.json({
            error: "Please provide an email query param. Example: /api/debug/email?email=votre@email.com",
            env_check: {
                RESEND_API_KEY_CONFIGURED: !!process.env.RESEND_API_KEY,
                KEY_LENGTH: process.env.RESEND_API_KEY ? process.env.RESEND_API_KEY.length : 0
            }
        });
    }

    const resend = new Resend(process.env.RESEND_API_KEY);

    try {
        const data = await resend.emails.send({
            from: 'AI Visionary Debug <hello@ai-visionary.com>',
            to: [targetEmail],
            subject: 'Test de Configuration Email AYO',
            html: `<h1>Ceci est un test technique.</h1><p>Si vous recevez ceci, la configuration Email (Resend) fonctionne sur Vercel.</p>`
        });

        return NextResponse.json({
            success: true,
            data,
            message: `Email sent to ${targetEmail}`
        });
    } catch (error: any) {
        return NextResponse.json({
            success: false,
            error: error.message,
            stack: error.stack,
            env_check: {
                RESEND_API_KEY_CONFIGURED: !!process.env.RESEND_API_KEY
            }
        }, { status: 500 });
    }
}
