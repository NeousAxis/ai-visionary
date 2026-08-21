import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { deliverProPackFree } from '@/lib/pro-delivery';
import { createLogger, generateCorrelationId } from '@/lib/logger';
import { checkRateLimit, RATE_LIMITS } from '@/lib/rate-limit';

// Livraison GRATUITE des 5 fichiers PRO + publication AYA, déclenchée par OTP (pas Stripe).
// SÉCURITÉ : seul un email ayant prouvé sa possession (code OTP valide) peut déclencher
// la génération + l'email + la publication. L'email vérifié devient l'owner/admin unique.
export const maxDuration = 60;
export const dynamic = 'force-dynamic';

const hasRealData = (doc: any) =>
  doc &&
  (doc.score > 0 ||
    (doc.data?.fields &&
      Object.keys(doc.data.fields).some(
        (k: string) => doc.data.fields[k] && Object.keys(doc.data.fields[k]).length > 0,
      )));

export async function POST(req: NextRequest) {
  // Brute-force protection (same limit as OTP verification)
  const rateLimited = checkRateLimit(req, 'generate-free', RATE_LIMITS.otp);
  if (rateLimited) return rateLimited;

  const logger = createLogger(generateCorrelationId(), 'generate-free');

  try {
    const body = await req.json();
    const email = (body?.email || '').toString().trim().toLowerCase();
    const code = (body?.code || '').toString().trim();
    const analysisId = (body?.analysisId || '').toString().trim();
    const url = (body?.url || '').toString().trim();
    const locale: 'fr' | 'en' = body?.locale === 'en' ? 'en' : 'fr';

    // DRY-RUN (test uniquement) : génère les fichiers sans OTP/écriture/email.
    // Strictement désactivé en production.
    const dry = body?.dry === true || body?.dry === '1' || body?.dry === 1;
    if (dry && process.env.NODE_ENV === 'production') {
      return NextResponse.json({ error: 'dry-run disabled in production' }, { status: 403 });
    }

    if (!dry) {
      if (!email || !code) {
        return NextResponse.json({ error: 'Email et code requis.' }, { status: 400 });
      }
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
        return NextResponse.json({ error: 'Email invalide.' }, { status: 400 });
      }
      // SECURITY: the code proves the requester controls this email (single-use OTP).
      const otpOk = await db.verifyOTP(email, code);
      if (!otpOk) {
        logger.warn('FREE_OTP_INVALID', `Invalid OTP for ${email}`);
        return NextResponse.json({ error: 'Code invalide ou expiré.' }, { status: 401 });
      }
    } else if (!url && !analysisId) {
      return NextResponse.json({ error: 'dry-run needs url or analysisId' }, { status: 400 });
    }

    // Retrieve the analysis (by id → url → email), same fallbacks as the webhook.
    let dbAnalysis: any = null;
    if (analysisId) {
      const d = await db.getAnalysis(analysisId);
      if (hasRealData(d)) dbAnalysis = d;
    }
    if (!dbAnalysis && url) {
      const d = await db.getLatestAnalysisByUrl(url);
      if (hasRealData(d)) dbAnalysis = d;
    }
    if (!dbAnalysis) {
      const d = await db.getLatestAnalysisByEmail(email);
      if (hasRealData(d)) dbAnalysis = d;
    }
    if (!dbAnalysis) {
      logger.warn('FREE_NO_ANALYSIS', `No analysis for ${email} / ${url} / ${analysisId}`);
      return NextResponse.json(
        { error: 'Analyse introuvable. Relance le diagnostic.' },
        { status: 404 },
      );
    }

    // Build analysisData (mirror of the webhook), applying the PRO score lift.
    let score = dbAnalysis.score || 0;
    let blocks: Record<string, number> = dbAnalysis.data?.blocks || {};
    if (dbAnalysis.data?.proScore && dbAnalysis.data.proScore > score) {
      score = dbAnalysis.data.proScore;
      if (dbAnalysis.data.proBlocks) {
        blocks = {};
        for (const [k, v] of Object.entries(dbAnalysis.data.proBlocks)) {
          blocks[k] = typeof v === 'number' ? v : (v as any)?.score ?? 0;
        }
      }
    }

    const analysisData = {
      score,
      extract: (dbAnalysis.data?.fields || {}) as Record<string, any>,
      url: dbAnalysis.url || url || '',
      blocks,
    };

    const result = await deliverProPackFree({
      analysisData,
      email: email || 'dry-run@test.local',
      locale,
      dryRun: dry,
    });
    logger.info('FREE_DELIVERED', `dry=${dry} ayaId=${result.ayaId} emailSent=${result.emailSent}`);

    return NextResponse.json({
      success: true,
      dryRun: dry,
      ayaId: result.ayaId,
      entityName: result.entityName,
      emailSent: result.emailSent,
      files: dry ? result.files : undefined,
    });
  } catch (e: any) {
    logger.critical('FREE_FATAL', e?.message || 'unknown', {
      stack: e?.stack?.substring(0, 500),
    });
    return NextResponse.json(
      { success: false, error: 'Erreur lors de la génération.' },
      { status: 500 },
    );
  }
}
