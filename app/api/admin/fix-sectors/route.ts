import { NextRequest, NextResponse } from 'next/server';
import { getFirestore } from 'firebase-admin/firestore';
import '@/lib/db'; // Ensure Firebase Admin is initialized
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
        const firestore = getFirestore();
        const snapshot = await firestore.collection('aya_registry').get();
        const results: { id: string; name: string; old: string; new: string }[] = [];

        for (const doc of snapshot.docs) {
            const data = doc.data();
            const name = data.display_name || data.legal_name || doc.id;
            const currentSector = data.sector_macro || '';

            if (PLACEHOLDER_RE.test(currentSector.trim())) {
                const ext = data.asr_payload?.data;
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

                if (newSector) {
                    await firestore.collection('aya_registry').doc(doc.id).update({
                        sector_macro: newSector
                    });
                    results.push({ id: doc.id, name, old: currentSector, new: newSector });
                }
            }
        }

        return NextResponse.json({
            success: true,
            total_entities: snapshot.size,
            fixed: results.length,
            details: results
        });
    } catch (err: unknown) {
        return NextResponse.json({ error: String(err) }, { status: 500 });
    }
}
