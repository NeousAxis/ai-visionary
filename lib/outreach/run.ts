/**
 * lib/outreach/run.ts
 *
 * Orchestrateur d'envoi outreach : tire une fournee, construit l'email personnalise,
 * envoie via le sender dedie throttle, marque le statut, journalise.
 *
 * Garde-fous (cold B2B, [[project_outreach_engine]]) :
 *  - OUTREACH_ENABLED doit valoir "true" pour qu'un envoi REEL parte (sinon dryRun force).
 *  - Cap par execution (warmup) : OUTREACH_DAILY_CAP (defaut 80) — jamais de blast.
 *  - Throttle entre chaque envoi : OUTREACH_GAP_MS (defaut 1500 ms).
 *  - Suppression verifiee au niveau SQL (batch) ET avant chaque envoi.
 */

import {
    localPgGetOutreachBatch,
    localPgMarkOutreachSent,
    localPgMarkOutreachFailed,
    localPgInsertOutreachEvent,
    type OutreachRecipientRow,
} from '@/lib/db-local-pg';
import { buildOutreachEmail } from './templates';
import { buildPartnerEmail } from './templates-partner';
import { pickOutreachLang, type OutreachLang } from './lang';
import { sendOutreachEmail, isOutreachSenderConfigured } from './sender';

export interface RunOutreachOptions {
    campaign?: string;
    max?: number;       // plafond pour CETTE execution
    dryRun?: boolean;   // n'envoie rien, simule (toujours force si OUTREACH_ENABLED != true)
}

export interface RunOutreachSummary {
    campaign: string;
    attempted: number;
    sent: number;
    failed: number;
    skipped: number;
    dryRun: boolean;
    enabled: boolean;
    senderConfigured: boolean;
    details: Array<{ email: string; status: string; error?: string }>;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function baseUrl(): string {
    return (process.env.NEXT_PUBLIC_BASE_URL || 'https://ai-visionary.xyz').replace(/\/$/, '');
}

function registryUrlFor(rec: OutreachRecipientRow): string {
    const b = baseUrl();
    if (rec.entity_id) return `${b}/aya/e/${rec.entity_id}`;
    if (rec.domain) return `${b}/aya?q=${encodeURIComponent(rec.domain)}`;
    return `${b}/aya`;
}

export async function runOutreachBatch(opts: RunOutreachOptions = {}): Promise<RunOutreachSummary> {
    const campaign = opts.campaign || process.env.OUTREACH_CAMPAIGN || 'default';
    const enabled = process.env.OUTREACH_ENABLED === 'true';
    const senderConfigured = isOutreachSenderConfigured();
    // Envoi reel UNIQUEMENT si explicitement active + sender configure + pas demande en dryRun.
    const dryRun = opts.dryRun === true || !enabled || !senderConfigured;

    const dailyCap = Math.max(1, Number(process.env.OUTREACH_DAILY_CAP || '80'));
    const max = Math.min(opts.max ?? dailyCap, dailyCap);
    const gapMs = Math.max(0, Number(process.env.OUTREACH_GAP_MS || '1500'));

    const summary: RunOutreachSummary = {
        campaign, attempted: 0, sent: 0, failed: 0, skipped: 0,
        dryRun, enabled, senderConfigured, details: [],
    };

    const batch = await localPgGetOutreachBatch(campaign, max);
    const b = baseUrl();

    for (const rec of batch) {
        summary.attempted++;
        const lang: OutreachLang = (rec.lang === 'fr' || rec.lang === 'en')
            ? rec.lang
            : pickOutreachLang(rec.country_legal);

        const unsubscribeUrl = `${b}/api/outreach/unsubscribe?token=${encodeURIComponent(rec.unsubscribe_token)}`;
        const email = rec.kind === 'partner'
            ? buildPartnerEmail({
                lang,
                displayName: rec.display_name,
                domain: rec.domain,
                hasAffiliate: true, // on ne met en file que les candidats avec affiliation détectée
                pollenUrl: `${b}/pollen-agents`,
                unsubscribeUrl,
            })
            : buildOutreachEmail({
                lang,
                displayName: rec.display_name,
                domain: rec.domain,
                asrScore: rec.asr_score,
                diagnosticUrl: `${b}/diagnostic`,
                registryUrl: registryUrlFor(rec),
                unsubscribeUrl,
            });

        if (dryRun) {
            summary.skipped++;
            summary.details.push({ email: rec.email, status: 'dry-run' });
            continue;
        }

        const res = await sendOutreachEmail({
            to: rec.email,
            subject: email.subject,
            html: email.html,
            text: email.text,
            unsubscribeUrl,
            unsubscribeMailto: process.env.OUTREACH_SMTP_USER,
        });

        if (res.success) {
            await localPgMarkOutreachSent(rec.id, res.messageId);
            await localPgInsertOutreachEvent({ recipientId: rec.id, email: rec.email, type: 'sent', detail: { messageId: res.messageId } });
            summary.sent++;
            summary.details.push({ email: rec.email, status: 'sent' });
        } else if (res.skipped) {
            // sender non configure -> on n'altere pas le statut, on s'arrete proprement.
            summary.skipped++;
            summary.details.push({ email: rec.email, status: 'skipped', error: res.error });
            break;
        } else {
            await localPgMarkOutreachFailed(rec.id, res.error || 'send_failed');
            await localPgInsertOutreachEvent({ recipientId: rec.id, email: rec.email, type: 'error', detail: { error: res.error } });
            summary.failed++;
            summary.details.push({ email: rec.email, status: 'failed', error: res.error });
        }

        if (gapMs) await sleep(gapMs);
    }

    return summary;
}
