import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';
import { createLogger, generateCorrelationId } from '@/lib/logger';
import { checkRateLimit, RATE_LIMITS } from '@/lib/rate-limit';

const PLACEHOLDER_RE = /^(type schema\.?org|schema\.?org|organisation|organization|non spécifié|n\/a|undefined|null|general)$/i;

export async function POST(req: NextRequest) {
    // Auth via ADMIN_SECRET (env var, not hardcoded)
    const auth = requireAdmin(req);
    if (!auth.authorized) return auth.response!;

    // Rate limit
    const rateLimited = checkRateLimit(req, 'admin-fix', RATE_LIMITS.debug);
    if (rateLimited) return rateLimited;

    const _logger = createLogger(generateCorrelationId(), 'admin');

    try {
        // Use getAyaEntities with a large limit to get all entities
        const entities = await db.getAyaEntities(1000);
        const results: { id: string; name: string; old: string; new: string }[] = [];

        for (const entity of entities) {
            const name = entity.display_name || entity.legal_name || entity.entity_id || 'unknown';
            const currentSector = entity.sector_macro || '';

            if (PLACEHOLDER_RE.test(currentSector.trim())) {
                const ext = entity.asr_payload?.data;
                const businessType = ext?.identite?.business_type?.value;
                const firstService = Array.isArray(ext?.offre?.services?.value)
                    ? ext.offre.services.value[0]
                    : null;

                let newSector: string | null = null;
                if (businessType && !PLACEHOLDER_RE.test(businessType.trim())) {
                    newSector = businessType;
                } else if (firstService) {
                    newSector = firstService;
                }

                if (newSector && entity.entity_id) {
                    await db.updateEntityRecommendability(entity.entity_id, {
                        sector_macro: newSector
                    });
                    results.push({ id: entity.entity_id, name, old: currentSector, new: newSector });
                }
            }
        }

        return NextResponse.json({
            success: true,
            total_entities: entities.length,
            fixed: results.length,
            details: results
        });
    } catch (err: unknown) {
        return NextResponse.json({ error: String(err) }, { status: 500 });
    }
}
