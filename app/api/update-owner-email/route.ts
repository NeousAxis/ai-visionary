import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { createLogger, generateCorrelationId } from '@/lib/logger';
import { checkRateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { verifyUpdateToken } from '@/lib/update-token';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
    const rateLimited = checkRateLimit(req, 'update-owner', RATE_LIMITS.otp);
    if (rateLimited) return rateLimited;

    const logger = createLogger(generateCorrelationId(), 'update-owner');

    try {
        const { entityId, newOwnerEmail, token } = await req.json();

        if (!entityId || !newOwnerEmail || !token) {
            return NextResponse.json({ error: 'Parametres manquants.' }, { status: 400 });
        }

        // Validate token
        if (!verifyUpdateToken(token, entityId)) {
            logger.warn('OWNER_INVALID_TOKEN', `Invalid token for entity ${entityId}`);
            return NextResponse.json({ error: 'Token invalide ou expire.' }, { status: 401 });
        }

        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(newOwnerEmail.trim())) {
            return NextResponse.json({ error: 'Format email invalide.' }, { status: 400 });
        }

        // Verify entity exists and is a paying customer
        const entity = await db.getAyaEntityById(entityId);
        if (!entity || !entity.payment_completed) {
            logger.warn('OWNER_ENTITY_NOT_FOUND', `Entity not found or not paid: ${entityId}`);
            return NextResponse.json({ error: 'Entite introuvable.' }, { status: 404 });
        }

        const success = await db.updateOwnerEmail(entityId, newOwnerEmail.trim());
        if (!success) {
            logger.error('OWNER_UPDATE_FAIL', `Failed to update owner_email for ${entityId}`);
            return NextResponse.json({ error: 'Erreur lors de la mise a jour.' }, { status: 500 });
        }

        logger.info('OWNER_UPDATED', `owner_email updated for entity ${entityId}`);
        return NextResponse.json({ success: true });

    } catch (e: unknown) {
        const message = e instanceof Error ? e.message : 'Unknown error';
        logger.error('OWNER_UPDATE_ERROR', message);
        return NextResponse.json({ error: 'Erreur interne.' }, { status: 500 });
    }
}
