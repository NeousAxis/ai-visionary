/**
 * lib/outreach/templates.ts
 *
 * Templates d'email d'outreach AI Visionary, bilingues FR/EN.
 *
 * Angle canonique ([[strategy_open_standard]]) : "les IA ne vous voient pas
 * correctement -> rendez-vous lisible via un STANDARD OUVERT suisse, sans devenir
 * client d'OpenAI/Google". Court, personnel, factuel, anti-spam.
 *
 * Conformite (cold B2B) : identite postale de l'expediteur + lien de desinscription
 * en clair + en-tete List-Unsubscribe (gere par le sender).
 */

import type { OutreachLang } from './lang';

export interface OutreachTemplateInput {
    lang: OutreachLang;
    displayName?: string | null;   // nom de l'entreprise (personnalisation)
    domain?: string | null;        // domaine bare
    asrScore?: number | null;      // score AIO actuel (accroche)
    diagnosticUrl: string;         // lien vers /diagnostic
    registryUrl: string;           // lien vers la fiche AYA de l'entite (ce que les IA voient)
    unsubscribeUrl: string;        // lien de desinscription one-click
}

export interface OutreachTemplate {
    subject: string;
    html: string;
    text: string;
}

// Identite postale de l'expediteur (obligatoire sur tout email commercial).
const SENDER_IDENTITY_FR = 'AI Visionary · Genève, Suisse · ai-visionary.xyz';
const SENDER_IDENTITY_EN = 'AI Visionary · Geneva, Switzerland · ai-visionary.xyz';

function esc(s: string): string {
    return s.replace(/[<>&"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c] || c));
}

export function buildOutreachEmail(input: OutreachTemplateInput): OutreachTemplate {
    const name = (input.displayName || input.domain || '').toString().trim();
    const hasScore = typeof input.asrScore === 'number' && input.asrScore >= 0;
    return input.lang === 'fr'
        ? buildFr(input, name, hasScore)
        : buildEn(input, name, hasScore);
}

// ── FR ────────────────────────────────────────────────────────────────────────
function buildFr(input: OutreachTemplateInput, name: string, hasScore: boolean): OutreachTemplate {
    const greeting = name ? `Bonjour ${name},` : 'Bonjour,';
    const scoreLine = hasScore
        ? `Aujourd'hui, la lisibilité de votre site pour les IA est notée <strong>${Math.round(input.asrScore as number)}/100</strong>. La plupart des entreprises plafonnent faute de données structurées — pas par manque de qualité.`
        : `La plupart des sites sont mal lus par les IA non par manque de qualité, mais parce que leurs informations ne sont pas structurées pour être comprises par une machine.`;

    const subject = name
        ? `${name} : comment les IA voient votre entreprise`
        : `Comment les IA voient votre entreprise`;

    const text = [
        greeting,
        '',
        'Quand quelqu\'un demande à ChatGPT, Claude ou Gemini « qui peut faire X ? », ces IA répondent à partir de ce qu\'elles arrivent à lire. Si vos informations ne sont pas structurées, vous êtes invisible — ou mal représenté.',
        '',
        stripTags(scoreLine),
        '',
        'AI Visionary est un STANDARD OUVERT suisse pour rendre une entreprise lisible par les IA. Vous publiez vos propres données signées, vous en gardez la propriété, et vous n\'avez à devenir client d\'aucun fournisseur d\'IA américain.',
        '',
        `Voir ce que les IA voient de vous aujourd'hui : ${input.registryUrl}`,
        `Diagnostic gratuit (et fichiers offerts pour l'instant) : ${input.diagnosticUrl}`,
        '',
        'Si le sujet ne vous concerne pas, ignorez simplement ce message.',
        '',
        'Cyril Léger',
        'Fondateur, AI Visionary',
        SENDER_IDENTITY_FR,
        '',
        `Se désinscrire : ${input.unsubscribeUrl}`,
    ].join('\n');

    const html = wrapHtml(`
        <p>${esc(greeting)}</p>
        <p>Quand quelqu'un demande à ChatGPT, Claude ou Gemini « <em>qui peut faire X&nbsp;?</em> », ces IA répondent à partir de ce qu'elles arrivent à lire sur le web. Si vos informations ne sont pas structurées, vous êtes <strong>invisible — ou mal représenté</strong>.</p>
        <p>${scoreLine}</p>
        <p><strong>AI Visionary</strong> est un <strong>standard ouvert suisse</strong> pour rendre une entreprise lisible par les IA. Vous publiez vos propres données signées, vous en gardez la propriété, et vous n'avez à devenir client d'aucun fournisseur d'IA américain.</p>
        <p>
            👉 <a href="${esc(input.registryUrl)}">Voir ce que les IA voient de vous aujourd'hui</a><br/>
            👉 <a href="${esc(input.diagnosticUrl)}">Diagnostic gratuit</a> — les fichiers sont offerts pour l'instant
        </p>
        <p style="color:#666">Si le sujet ne vous concerne pas, ignorez simplement ce message.</p>
        <p>Cyril Léger<br/>Fondateur, AI Visionary</p>
    `, SENDER_IDENTITY_FR, input.unsubscribeUrl, 'Se désinscrire');

    return { subject, html, text };
}

// ── EN ────────────────────────────────────────────────────────────────────────
function buildEn(input: OutreachTemplateInput, name: string, hasScore: boolean): OutreachTemplate {
    const greeting = name ? `Hi ${name},` : 'Hello,';
    const scoreLine = hasScore
        ? `Right now, your website's AI readability scores <strong>${Math.round(input.asrScore as number)}/100</strong>. Most companies are capped not because of quality, but because their data isn't structured for machines to read.`
        : `Most websites are poorly read by AIs not because of quality, but because their information isn't structured to be understood by a machine.`;

    const subject = name
        ? `${name}: how AIs see your business`
        : `How AIs see your business`;

    const text = [
        greeting,
        '',
        'When someone asks ChatGPT, Claude or Gemini "who can do X?", these AIs answer from what they can actually read. If your information isn\'t structured, you\'re invisible — or misrepresented.',
        '',
        stripTags(scoreLine),
        '',
        'AI Visionary is a Swiss OPEN STANDARD to make a business readable by AIs. You publish your own signed data, you keep ownership of it, and you don\'t have to become a customer of any US AI provider.',
        '',
        `See what AIs see of you today: ${input.registryUrl}`,
        `Free diagnostic (files are free for now): ${input.diagnosticUrl}`,
        '',
        'If this isn\'t relevant to you, simply ignore this message.',
        '',
        'Cyril Léger',
        'Founder, AI Visionary',
        SENDER_IDENTITY_EN,
        '',
        `Unsubscribe: ${input.unsubscribeUrl}`,
    ].join('\n');

    const html = wrapHtml(`
        <p>${esc(greeting)}</p>
        <p>When someone asks ChatGPT, Claude or Gemini "<em>who can do X?</em>", these AIs answer from what they can actually read on the web. If your information isn't structured, you're <strong>invisible — or misrepresented</strong>.</p>
        <p>${scoreLine}</p>
        <p><strong>AI Visionary</strong> is a <strong>Swiss open standard</strong> to make a business readable by AIs. You publish your own signed data, you keep ownership of it, and you don't have to become a customer of any US AI provider.</p>
        <p>
            👉 <a href="${esc(input.registryUrl)}">See what AIs see of you today</a><br/>
            👉 <a href="${esc(input.diagnosticUrl)}">Free diagnostic</a> — files are free for now
        </p>
        <p style="color:#666">If this isn't relevant to you, simply ignore this message.</p>
        <p>Cyril Léger<br/>Founder, AI Visionary</p>
    `, SENDER_IDENTITY_EN, input.unsubscribeUrl, 'Unsubscribe');

    return { subject, html, text };
}

// ── Shared HTML shell ──────────────────────────────────────────────────────────
function wrapHtml(body: string, identity: string, unsubscribeUrl: string, unsubLabel: string): string {
    return `<!doctype html><html><body style="margin:0;padding:0;background:#f6f7f9">
<div style="max-width:560px;margin:0 auto;padding:24px;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;font-size:15px;line-height:1.55;color:#1a1a1a">
${body}
<hr style="border:none;border-top:1px solid #e2e4e8;margin:24px 0"/>
<p style="font-size:12px;color:#8a8f98;margin:0">${esc(identity)}</p>
<p style="font-size:12px;color:#8a8f98;margin:6px 0 0"><a href="${esc(unsubscribeUrl)}" style="color:#8a8f98">${esc(unsubLabel)}</a></p>
</div></body></html>`;
}

function stripTags(s: string): string {
    return s.replace(/<[^>]+>/g, '');
}
