import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import {
    localPgImportOutreachRecipients,
    localPgOutreachStats,
    localPgAddOutreachSuppression,
    localPgPreviewOutreachTargets,
} from '@/lib/db-local-pg';
import { runOutreachBatch } from '@/lib/outreach/run';
import { buildOutreachEmail } from '@/lib/outreach/templates';
import { pickOutreachLang } from '@/lib/outreach/lang';
import { sendOutreachEmail, isOutreachSenderConfigured, verifyOutreachTransport, outreachFrom } from '@/lib/outreach/sender';

// Admin outreach — pilotage du moteur d'envoi cold B2B.
// Auth : ?secret=ADMIN_SECRET ou Authorization: Bearer.
// Actions POST : import | send | test | suppress | verify.
export const maxDuration = 120;
export const dynamic = 'force-dynamic';

// Verticale pilote par defaut : digital / SaaS / crypto / fintech / e-commerce.
const DEFAULT_SECTORS = ['Technologie & SaaS', 'Finance & Banque', 'E-commerce & Retail'];

// ── GET : etat de la file + config ───────────────────────────────────────────
export async function GET(req: NextRequest) {
    const auth = requireAdmin(req);
    if (!auth.authorized) return auth.response!;

    const url = new URL(req.url);
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
        const email = buildOutreachEmail({
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

    return NextResponse.json({ error: 'unknown_action', actions: ['preview', 'import', 'send', 'test', 'suppress', 'verify'] }, { status: 400 });
}
