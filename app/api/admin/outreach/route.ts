import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import {
    localPgImportOutreachRecipients,
    localPgOutreachStats,
    localPgAddOutreachSuppression,
    localPgPreviewOutreachTargets,
    localPgGetPartnerScanCandidates,
    localPgUpsertPartnerCandidate,
    localPgQueuePartnerRecipient,
    localPgListPartnerCandidates,
} from '@/lib/db-local-pg';
import { runOutreachBatch } from '@/lib/outreach/run';
import { buildOutreachEmail } from '@/lib/outreach/templates';
import { buildPartnerEmail } from '@/lib/outreach/templates-partner';
import { pickOutreachLang } from '@/lib/outreach/lang';
import { detectAffiliateProgram } from '@/lib/outreach/affiliate-detector';
import { sendOutreachEmail, isOutreachSenderConfigured, verifyOutreachTransport, outreachFrom } from '@/lib/outreach/sender';

// Admin outreach — pilotage du moteur d'envoi cold B2B.
// Auth : ?secret=ADMIN_SECRET ou Authorization: Bearer.
// Actions POST : import | send | test | suppress | verify.
export const maxDuration = 300;
export const dynamic = 'force-dynamic';

// Verticale pilote par defaut : digital / SaaS / crypto / fintech / e-commerce.
const DEFAULT_SECTORS = ['Technologie & SaaS', 'Finance & Banque', 'E-commerce & Retail'];

// ── GET : etat de la file + config ───────────────────────────────────────────
export async function GET(req: NextRequest) {
    const auth = requireAdmin(req);
    if (!auth.authorized) return auth.response!;

    const url = new URL(req.url);

    // Vue shortlist BD : partenaires cashback détectés (affiliation).
    if (url.searchParams.get('view') === 'partners') {
        const onlyAffiliate = url.searchParams.get('all') !== 'true';
        const list = await localPgListPartnerCandidates({ onlyAffiliate, limit: 500 });
        return NextResponse.json({ ok: true, only_affiliate: onlyAffiliate, ...list });
    }

    const campaign = url.searchParams.get('campaign') || undefined;
    const stats = await localPgOutreachStats(campaign);
    return NextResponse.json({
        config: {
            enabled: process.env.OUTREACH_ENABLED === 'true',
            sender_configured: isOutreachSenderConfigured(),
            from: isOutreachSenderConfigured() ? outreachFrom() : null,
            daily_cap: Number(process.env.OUTREACH_DAILY_CAP || '80'),
            gap_ms: Number(process.env.OUTREACH_GAP_MS || '1500'),
            default_sectors: DEFAULT_SECTORS,
        },
        stats,
    });
}

// ── POST : import | send | test | suppress | verify ──────────────────────────
export async function POST(req: NextRequest) {
    const auth = requireAdmin(req);
    if (!auth.authorized) return auth.response!;

    let body: any = {};
    try { body = await req.json(); } catch { /* */ }
    const action = (body.action ?? '').toString();

    // 0) PREVIEW — apercu lecture seule des cibles (BD / validation ciblage). N'ecrit rien.
    if (action === 'preview') {
        const sectors: string[] = Array.isArray(body.sectors) && body.sectors.length ? body.sectors : DEFAULT_SECTORS;
        const result = await localPgPreviewOutreachTargets({
            sectors,
            excludeCountries: Array.isArray(body.exclude_countries) ? body.exclude_countries : ['DE'],
            minScore: body.min_score != null ? Number(body.min_score) : null,
            limit: body.limit != null ? Number(body.limit) : 100,
        });
        return NextResponse.json({ ok: true, sectors, ...result });
    }

    // 0bis) DETECT-PARTNERS — scanne des domaines, détecte un programme d'affiliation,
    //       persiste dans partner_candidates, met en file (kind=partner) les qualifiés.
    if (action === 'detect-partners') {
        const sectors: string[] = Array.isArray(body.sectors) && body.sectors.length ? body.sectors : DEFAULT_SECTORS;
        const limit = Math.min(Math.max(Number(body.limit ?? 12), 1), 60);
        const campaign = (body.campaign ?? 'partners').toString();
        const exclude = Array.isArray(body.exclude_countries) ? body.exclude_countries : ['DE'];
        const candidates = await localPgGetPartnerScanCandidates({ sectors, excludeCountries: exclude, limit });

        let scanned = 0, affiliate = 0, queued = 0;
        const found: any[] = [];
        const CONC = 5;
        for (let i = 0; i < candidates.length; i += CONC) {
            const chunk = candidates.slice(i, i + CONC);
            await Promise.all(chunk.map(async (c) => {
                const r = await detectAffiliateProgram(c.domain, { timeoutMs: 6000, maxProbes: 3 });
                scanned++;
                await localPgUpsertPartnerCandidate({
                    domain: c.domain, entityId: c.entity_id, displayName: c.display_name, sector: c.sector_macro,
                    country: c.country_legal, email: c.contact_email, asrScore: c.asr_score,
                    hasAffiliate: r.has_affiliate, affiliateUrl: r.affiliate_url, signals: r.signals,
                });
                if (r.has_affiliate) {
                    affiliate++;
                    if (c.contact_email) {
                        const ok = await localPgQueuePartnerRecipient({
                            domain: c.domain, entityId: c.entity_id, email: c.contact_email, displayName: c.display_name,
                            sector: c.sector_macro, country: c.country_legal, lang: pickOutreachLang(c.country_legal),
                            asrScore: c.asr_score, campaign,
                        });
                        if (ok) queued++;
                    }
                    found.push({ domain: c.domain, name: c.display_name, sector: c.sector_macro, country: c.country_legal, email: c.contact_email, affiliate_url: r.affiliate_url });
                }
            }));
        }
        return NextResponse.json({ ok: true, scanned, affiliate_found: affiliate, queued, campaign, found });
    }

    // 1) IMPORT — peuple la file depuis le registre.
    if (action === 'import') {
        const sectors: string[] = Array.isArray(body.sectors) && body.sectors.length ? body.sectors : DEFAULT_SECTORS;
        const result = await localPgImportOutreachRecipients({
            sectors,
            campaign: (body.campaign ?? 'default').toString(),
            excludeCountries: Array.isArray(body.exclude_countries) ? body.exclude_countries : ['DE'], // DE: UWG interdit le cold B2B
            minScore: body.min_score != null ? Number(body.min_score) : null,
            limit: body.limit != null ? Number(body.limit) : 5000,
        });
        return NextResponse.json({ ok: !result.error, ...result, sectors });
    }

    // 2) SEND — envoie une fournee (dry-run force tant que OUTREACH_ENABLED != true).
    if (action === 'send') {
        const summary = await runOutreachBatch({
            campaign: (body.campaign ?? 'default').toString(),
            max: body.max != null ? Number(body.max) : undefined,
            dryRun: body.dry_run === true,
        });
        return NextResponse.json({ ok: true, summary });
    }

    // 3) TEST — envoie UN email reel a une adresse de controle (prouve le pipeline).
    if (action === 'test') {
        const to = (body.to ?? '').toString().trim();
        if (!to || !to.includes('@')) {
            return NextResponse.json({ error: 'invalid_to' }, { status: 400 });
        }
        if (!isOutreachSenderConfigured()) {
            return NextResponse.json({ ok: false, skipped: true, error: 'OUTREACH_SMTP not configured' });
        }
        const lang = body.lang === 'fr' || body.lang === 'en' ? body.lang : pickOutreachLang(body.country ?? null);
        const base = (process.env.NEXT_PUBLIC_BASE_URL || 'https://ai-visionary.xyz').replace(/\/$/, '');
        const token = 'test-' + Date.now();
        const unsubscribeUrl = `${base}/api/outreach/unsubscribe?token=${token}`;
        const email = body.kind === 'partner'
            ? buildPartnerEmail({
                lang,
                displayName: body.display_name ?? 'Votre entreprise',
                domain: body.domain ?? 'exemple.com',
                hasAffiliate: body.has_affiliate !== false,
                pollenUrl: `${base}/pollen-agents`,
                unsubscribeUrl,
            })
            : buildOutreachEmail({
                lang,
                displayName: body.display_name ?? 'Votre entreprise',
                domain: body.domain ?? 'exemple.com',
                asrScore: body.asr_score != null ? Number(body.asr_score) : 41,
                diagnosticUrl: `${base}/diagnostic`,
                registryUrl: `${base}/aya`,
                unsubscribeUrl,
            });
        const res = await sendOutreachEmail({
            to, subject: `[TEST] ${email.subject}`, html: email.html, text: email.text,
            unsubscribeUrl, unsubscribeMailto: process.env.OUTREACH_SMTP_USER,
        });
        return NextResponse.json({ ok: res.success, ...res, lang, to });
    }

    // 4) SUPPRESS — ajoute une adresse a la liste do-not-contact.
    if (action === 'suppress') {
        const email = (body.email ?? '').toString().trim();
        if (!email || !email.includes('@')) return NextResponse.json({ error: 'invalid_email' }, { status: 400 });
        const ok = await localPgAddOutreachSuppression(email, body.reason ?? 'manual', 'admin');
        return NextResponse.json({ ok });
    }

    // 5) VERIFY — teste la connexion SMTP de l'identite dediee.
    if (action === 'verify') {
        const res = await verifyOutreachTransport();
        return NextResponse.json(res);
    }

    return NextResponse.json({ error: 'unknown_action', actions: ['preview', 'detect-partners', 'import', 'send', 'test', 'suppress', 'verify'] }, { status: 400 });
}
