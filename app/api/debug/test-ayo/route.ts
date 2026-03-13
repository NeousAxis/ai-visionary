/**
 * TEST ENDPOINT — /api/debug/test-ayo
 *
 * Appelle le VRAI pipeline AYO (même module que le webhook Stripe)
 * sans nécessiter de paiement Stripe.
 *
 * Usage: GET /api/debug/test-ayo?url=api-glossaries.com
 *        GET /api/debug/test-ayo?url=api-glossaries.com&email=test@test.com
 *
 * Ce endpoint:
 * 1. Lit les données d'analyse depuis Firestore (comme le webhook)
 * 2. Applique le MÊME sanitizer (sanitizeExtract from @/lib/ayo-generators)
 * 3. Appelle les MÊMES générateurs (from @/lib/ayo-generators)
 * 4. Retourne les fichiers JSON générés (sans envoyer d'email)
 *
 * IMPORTANT: Ce endpoint est UNIQUEMENT pour le test.
 * En production, c'est le webhook Stripe qui déclenche la génération.
 */

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { generateRealAsrJson } from '@/lib/ayo-crypto';
import { computeAioScore } from '@/lib/aio-score-engine';
import '@/lib/db';
import {
    sanitizeExtract, sanitizeBusinessType,
    generateManifestJson, generateFaqJson, generateGlossaryJson, generateExternalContextJsonLocal
} from '@/lib/ayo-generators';
import crypto from 'crypto';
import { getFirestore } from 'firebase-admin/firestore';

export async function GET(req: Request) {
    // Only allow in development/preview
    if (process.env.NODE_ENV === 'production' && !process.env.VERCEL_ENV?.includes('preview')) {
        return NextResponse.json({ error: 'Test endpoint disabled in production' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const analyzedUrl = searchParams.get('url') || '';
    const customerEmail = searchParams.get('email') || 'test@test.com';

    if (!analyzedUrl) {
        return NextResponse.json({ error: 'Missing ?url= parameter' }, { status: 400 });
    }

    try {
        // 1. RETRIEVE ANALYSIS DATA from Firestore — EXACT same logic as webhook
        const hasRealData = (doc: any) => doc && (doc.score > 0 || (doc.data?.fields && Object.keys(doc.data.fields).some((k: string) => doc.data.fields[k] && Object.keys(doc.data.fields[k]).length > 0)));

        let dbAnalysis = null;

        // Search by URL
        const byUrl = await db.getLatestAnalysisByUrl(analyzedUrl);
        if (hasRealData(byUrl)) {
            dbAnalysis = byUrl;
        }

        // Fallback: search by email
        if (!dbAnalysis && customerEmail !== 'test@test.com') {
            const byEmail = await db.getLatestAnalysisByEmail(customerEmail);
            if (hasRealData(byEmail)) {
                dbAnalysis = byEmail;
            }
        }

        // Fallback: scan_states
        if (!dbAnalysis) {
            try {
                const scanStateDocId = Buffer.from(analyzedUrl).toString('base64url').substring(0, 128);
                const scanStateDoc = await getFirestore().collection('scan_states').doc(scanStateDocId).get();
                if (scanStateDoc.exists) {
                    const scanState = scanStateDoc.data();
                    const fields: any = { identite: {}, offre: {}, processus_methodes: {}, engagements_conformite: {}, indicateurs: {}, contenus_pedagogiques: {}, structure_technique: {}, external_context: {}, contextual_signals: {}, recommandation: {} };
                    if (scanState?.detected) {
                        for (const [key, val] of Object.entries(scanState.detected)) {
                            const [bloc, field] = key.split('.');
                            if (bloc && field && fields[bloc]) {
                                const conf = scanState.confidence?.[key] || 0;
                                fields[bloc][field] = { value: val, q: conf >= 70 ? 1 : conf >= 40 ? 0.5 : 0, evidence: ["scan_state_fallback"] };
                            }
                        }
                    }
                    let recalcScore = 0;
                    try {
                        const fakeExtract = {
                            fields,
                            source: { scan: { is_reachable: true, has_jsonld: true, has_asr_file: false, is_aya_registered: false, has_faq_schema: false, has_faq_content: false } }
                        };
                        const scoreResult = computeAioScore(fakeExtract as any);
                        recalcScore = scoreResult.total;
                    } catch {}
                    dbAnalysis = {
                        url: analyzedUrl,
                        email: customerEmail,
                        score: recalcScore,
                        data: { fields },
                        extract: fields
                    };
                }
            } catch {}
        }

        if (!dbAnalysis) {
            return NextResponse.json({
                error: `No analysis data found for URL: ${analyzedUrl}`,
                hint: 'Run the AYO chat questionnaire first to generate analysis data'
            }, { status: 404 });
        }

        // 2. PREPARE ANALYSIS DATA — same as webhook
        const analysisData = {
            url: dbAnalysis.url || analyzedUrl,
            email: customerEmail,
            score: dbAnalysis.score || 0,
            extract: dbAnalysis.data?.fields || (dbAnalysis as any).extract || {},
            blocks: (dbAnalysis as any).blocks || {}
        };

        const ext = analysisData.extract as Record<string, any>;
        const entityName = ext.identite?.name?.value
            || ext.identite?.legal_name?.value
            || "Entreprise";

        // 3. SANITIZE — EXACT same function as webhook (imported from @/lib/ayo-generators)
        const { cleanedFields } = sanitizeExtract(ext);

        // 4. RECALCULATE SCORE after sanitization
        let finalScore = analysisData.score;
        let finalBlocks: Record<string, number> = analysisData.blocks;
        try {
            const scoreResult = computeAioScore({ fields: ext, source: { scan: { is_reachable: true } } } as any);
            finalScore = scoreResult.total;
            finalBlocks = {};
            for (const [k, v] of Object.entries(scoreResult.blocks)) {
                finalBlocks[k] = typeof v === 'number' ? v : (v as any).score ?? 0;
            }
        } catch {}

        // 5. GENERATE ALL 5 PACK FILES — EXACT same functions as webhook (imported from @/lib/ayo-generators)
        const asrId = `asr_test_${crypto.randomUUID().replace(/-/g, '').substring(0, 16)}`;
        const asr = await generateRealAsrJson(ext, finalScore, new Date().toISOString(), asrId, "PRO", analysisData.url);
        const manifest = generateManifestJson(ext, analysisData.url);
        const faq = generateFaqJson(ext, analysisData.url);
        const glossary = generateGlossaryJson(ext);
        const externalCtx = generateExternalContextJsonLocal(ext, analysisData.url);

        // 6. RETURN ALL FILES + metadata
        return NextResponse.json({
            _meta: {
                endpoint: '/api/debug/test-ayo',
                note: 'REAL AYO pipeline — same code as webhook (imported from @/lib/ayo-generators)',
                entity: entityName,
                url: analysisData.url,
                score: Math.round(finalScore),
                blocks: finalBlocks,
                sanitized_fields: cleanedFields,
                generated_at: new Date().toISOString()
            },
            files: {
                'ASR-Protocol.json': asr,
                'manifest.json': manifest,
                'faq.json': faq,
                'glossary.json': glossary,
                'external_context.json': externalCtx
            }
        }, { status: 200 });

    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        const stack = err instanceof Error ? err.stack?.substring(0, 500) : undefined;
        return NextResponse.json({ error: message, stack }, { status: 500 });
    }
}
