import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
    const email = req.nextUrl.searchParams.get('email');
    if (!email) {
        return NextResponse.json({ error: 'email required' }, { status: 400 });
    }

    const entity = await db.getAyaEntityByContactEmail(email);
    if (!entity) {
        return NextResponse.json({ entity_id: null }, { status: 404 });
    }

    return NextResponse.json({ entity_id: entity.entity_id || entity.id });
}
