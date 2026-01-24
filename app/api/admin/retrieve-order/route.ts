import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const email = searchParams.get('email');
    const secret = searchParams.get('secret');

    // Admin Protection (Basic)
    if (secret !== process.env.STRIPE_WEBHOOK_SECRET) { // Using existing secret as makeshift admin key
        return new Response("Unauthorized", { status: 401 });
    }

    if (!email) {
        return NextResponse.json({ error: "Email required" });
    }

    try {
        const analysis = await db.getLatestAnalysisByEmail(email);

        if (!analysis) {
            return NextResponse.json({ found: false, message: "No analysis found for this email" });
        }

        return NextResponse.json({
            found: true,
            email: email,
            url: analysis.url,
            score: analysis.score,
            data: analysis.data // Contains extracted fields, ASR raw data
        });

    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
