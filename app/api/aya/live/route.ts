
import { NextResponse } from 'next/server';
import { getLiveEntities } from '@/lib/aya/registry';

export const dynamic = 'force-dynamic'; // Prevent Vercel from caching the empty list

export async function GET() {
    try {
        console.log('📡 API AYA LIVE: Calling getLiveEntities...');
        const entities = await getLiveEntities();

        return NextResponse.json({
            success: true,
            data: entities
        });
    } catch (err) {
        console.error('❌ API AYA LIVE ERROR:', err);
        return NextResponse.json({
            success: false,
            error: 'Internal Server Error'
        }, { status: 500 });
    }
}
