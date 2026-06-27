import { NextResponse } from 'next/server';
import { createLogger, generateCorrelationId } from '@/lib/logger';
import { detectAffiliateProgram } from '@/lib/outreach/affiliate-detector';
import {
    localPgGetPartnerScanCandidates,
    localPgUpsertPartnerCandidate,
    localPgQueuePartnerRecipient,
} from '@/lib/db-local-pg';
import { pickOutreachLang } from '@/lib/outreach/lang';

/**
 * CRON: Détection continue de programmes d'affiliation → partner_candidates.
 *
 * Pendant de l'outreach ASR : scanne chaque jour une fournée de domaines du
 * registre, détecte qui a un programme d'affiliation, persiste le candidat et
 * met en file (kind=partner) les qualifiés avec email. Sans cela, "trouver des
 * entreprises pour des offres" reste manuel. Lecture seule côté web (probe HTTP).
 *
 * Auth : Bearer CRON_SECRET (même schéma que /api/cron/outreach).
 */
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const DEFAULT_SECTORS = ['Technologie & SaaS', 'Finance & Banque', 'E-commerce & Retail'];

export async function GET(request: Request) {
    const correlationId = generateCorrelationId();
    const logger = createLogger(correlationId, 'cron');

    const cronSecret = process.env.CRON_SECRET;
    const authHeader = request.headers.get('authorization');
    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
        logger.warn('auth', 'Unauthorized detect-partners cron request');
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const campaign = process.env.PARTNER_CAMPAIGN || 'partners';
    const dailyLimit = Math.min(Math.max(Number(process.env.DETECT_DAILY_LIMIT ?? 150), 10), 600);
    const batchSize = 50;
    const excludeCountries = ['DE']; // UWG : pas de cold B2B en Allemagne

    logger.info('start', `detect-partners cron started (campaign=${campaign}, dailyLimit=${dailyLimit})`);

    let scanned = 0, affiliate = 0, queued = 0, rounds = 0;
    try {
        while (scanned < dailyLimit) {
            const remaining = dailyLimit - scanned;
            const candidates = await localPgGetPartnerScanCandidates({
                sectors: DEFAULT_SECTORS,
                excludeCountries,
                limit: Math.min(batchSize, remaining),
            });
            if (!candidates.length) break; // registre épuisé pour ces secteurs
            rounds++;

            const CONC = 5;
            for (let i = 0; i < candidates.length; i += CONC) {
                const chunk = candidates.slice(i, i + CONC);
                await Promise.all(chunk.map(async (c) => {
                    const r = await detectAffiliateProgram(c.domain, { timeoutMs: 6000, maxProbes: 3 });
                    scanned++;
                    await localPgUpsertPartnerCandidate({
                        domain: c.domain, entityId: c.entity_id, displayName: c.display_name,
                        sector: c.sector_macro, country: c.country_legal, email: c.contact_email,
                        asrScore: c.asr_score, hasAffiliate: r.has_affiliate,
                        affiliateUrl: r.affiliate_url, signals: r.signals,
                    });
                    if (r.has_affiliate) {
                        affiliate++;
                        if (c.contact_email) {
                            const ok = await localPgQueuePartnerRecipient({
                                domain: c.domain, entityId: c.entity_id, email: c.contact_email,
                                displayName: c.display_name, sector: c.sector_macro, country: c.country_legal,
                                lang: pickOutreachLang(c.country_legal), asrScore: c.asr_score, campaign,
                            });
                            if (ok) queued++;
                        }
                    }
                }));
            }
        }
        logger.info('done', `detect-partners cron done: scanned=${scanned} affiliate=${affiliate} queued=${queued} rounds=${rounds}`);
        return NextResponse.json({ success: true, campaign, scanned, affiliate_found: affiliate, queued, rounds });
    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        logger.critical('crash', `detect-partners cron crashed: ${msg}`);
        return NextResponse.json({ error: 'Internal error', message: msg, scanned, affiliate_found: affiliate, queued }, { status: 500 });
    }
}
