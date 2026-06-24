/**
 * lib/outreach/templates-partner.ts
 *
 * Template d'outreach PARTENAIRE CASHBACK (pitch deal Pollen), bilingue FR/EN.
 * Cible = entreprises digital/SaaS/fintech/crypto/e-commerce, idéalement avec un
 * programme d'affiliation existant (elles acceptent déjà le CPA).
 *
 * Angle : "les agents IA = un nouveau canal de distribution ; payez UNIQUEMENT sur
 * transaction réelle ; commission à plat, neutre ; on étend votre logique d'affiliation
 * aux agents." Réf : VISION-POLLEN-AGENTS.md §8 + POLLEN-DEAL-KIT.md.
 */

export interface PartnerTemplateInput {
    lang: 'fr' | 'en';
    displayName?: string | null;
    domain?: string | null;
    hasAffiliate?: boolean;     // si on a détecté un programme d'affiliation existant
    pollenUrl: string;          // lien vers /pollen-agents
    unsubscribeUrl: string;
}

export interface PartnerTemplate { subject: string; html: string; text: string; }

const ID_FR = 'AI Visionary · Genève, Suisse · ai-visionary.xyz';
const ID_EN = 'AI Visionary · Geneva, Switzerland · ai-visionary.xyz';

function esc(s: string): string {
    return s.replace(/[<>&"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c] || c));
}
function shell(body: string, identity: string, unsubscribeUrl: string, unsubLabel: string): string {
    return `<!doctype html><html><body style="margin:0;padding:0;background:#f6f7f9">
<div style="max-width:560px;margin:0 auto;padding:24px;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;font-size:15px;line-height:1.55;color:#1a1a1a">
${body}
<hr style="border:none;border-top:1px solid #e2e4e8;margin:24px 0"/>
<p style="font-size:12px;color:#8a8f98;margin:0">${esc(identity)}</p>
<p style="font-size:12px;color:#8a8f98;margin:6px 0 0"><a href="${esc(unsubscribeUrl)}" style="color:#8a8f98">${esc(unsubLabel)}</a></p>
</div></body></html>`;
}

export function buildPartnerEmail(input: PartnerTemplateInput): PartnerTemplate {
    const name = (input.displayName || input.domain || '').toString().trim();
    return input.lang === 'fr' ? fr(input, name) : en(input, name);
}

function fr(input: PartnerTemplateInput, name: string): PartnerTemplate {
    const greeting = name ? `Bonjour ${name},` : 'Bonjour,';
    const affLine = input.hasAffiliate
        ? `Vous avez déjà un programme d'affiliation — donc vous acceptez déjà de payer à la performance. On l'étend simplement à un nouveau canal : les agents IA.`
        : `Le principe est celui de l'affiliation : vous ne payez qu'à la performance, sur un nouveau canal — les agents IA.`;
    const subject = name ? `${name} : les agents IA comme nouveau canal d'acquisition` : `Les agents IA comme nouveau canal d'acquisition`;

    const text = [
        greeting, '',
        'Les gens demandent de plus en plus à un agent IA (ChatGPT, Claude, Gemini) de trouver — et bientôt d\'acheter — un service pour eux. AI Visionary opère AYA, le registre suisse ouvert où ces agents interrogent et comparent des services vérifiés.',
        '',
        affLine,
        '',
        'Le modèle, en clair :',
        '- Un agent vous amène un client réel → vous payez une commission UNIQUEMENT sur la transaction consommée (CPA). Zéro budget d\'avance.',
        '- Commission à plat, non-distordante : on ne touche jamais plus d\'un partenaire que d\'un autre → l\'agent reste neutre.',
        '- Une partie finance un cashback pour l\'utilisateur final → une raison concrète de passer par un agent qui vous propose.',
        '',
        `En savoir plus : ${input.pollenUrl}`,
        'Intéressé ? Répondez simplement à cet email, on cale un appel de 15 min.',
        '',
        'Cyril Léger', 'Fondateur, AI Visionary', ID_FR,
        '', `Se désinscrire : ${input.unsubscribeUrl}`,
    ].join('\n');

    const html = shell(`
        <p>${esc(greeting)}</p>
        <p>Les gens demandent de plus en plus à un agent IA (ChatGPT, Claude, Gemini) de trouver — et bientôt d'<strong>acheter</strong> — un service pour eux. AI Visionary opère <strong>AYA</strong>, le registre suisse ouvert où ces agents interrogent et comparent des services vérifiés.</p>
        <p>${esc(affLine)}</p>
        <p><strong>Le modèle, en clair :</strong></p>
        <ul>
          <li>Un agent vous amène un client réel → vous payez <strong>uniquement sur la transaction consommée</strong> (CPA). Zéro budget d'avance.</li>
          <li>Commission <strong>à plat, non-distordante</strong> → l'agent reste neutre (pas de pay-for-placement).</li>
          <li>Une part finance un <strong>cashback utilisateur</strong> → une raison concrète de passer par un agent qui vous propose.</li>
        </ul>
        <p>👉 <a href="${esc(input.pollenUrl)}">En savoir plus</a> — ou répondez simplement à cet email, on cale un appel de 15 min.</p>
        <p>Cyril Léger<br/>Fondateur, AI Visionary</p>
    `, ID_FR, input.unsubscribeUrl, 'Se désinscrire');

    return { subject, html, text };
}

function en(input: PartnerTemplateInput, name: string): PartnerTemplate {
    const greeting = name ? `Hi ${name},` : 'Hello,';
    const affLine = input.hasAffiliate
        ? `You already run an affiliate program — so you already pay on performance. We simply extend it to a new channel: AI agents.`
        : `It works like affiliate marketing: you only pay on performance, on a new channel — AI agents.`;
    const subject = name ? `${name}: AI agents as a new acquisition channel` : `AI agents as a new acquisition channel`;

    const text = [
        greeting, '',
        'People increasingly ask an AI agent (ChatGPT, Claude, Gemini) to find — and soon buy — a service for them. AI Visionary runs AYA, the Swiss open registry where these agents query and compare verified services.',
        '',
        affLine,
        '',
        'The model, plainly:',
        '- An agent brings you a real customer → you pay a commission ONLY on the consumed transaction (CPA). No upfront budget.',
        '- Flat, non-distorting commission: we never earn more from one partner than another → the agent stays neutral.',
        '- Part of it funds a cashback for the end user → a concrete reason to go through an agent that proposes you.',
        '',
        `Learn more: ${input.pollenUrl}`,
        'Interested? Just reply to this email and we\'ll set up a 15-min call.',
        '',
        'Cyril Léger', 'Founder, AI Visionary', ID_EN,
        '', `Unsubscribe: ${input.unsubscribeUrl}`,
    ].join('\n');

    const html = shell(`
        <p>${esc(greeting)}</p>
        <p>People increasingly ask an AI agent (ChatGPT, Claude, Gemini) to find — and soon <strong>buy</strong> — a service for them. AI Visionary runs <strong>AYA</strong>, the Swiss open registry where these agents query and compare verified services.</p>
        <p>${esc(affLine)}</p>
        <p><strong>The model, plainly:</strong></p>
        <ul>
          <li>An agent brings you a real customer → you pay <strong>only on the consumed transaction</strong> (CPA). No upfront budget.</li>
          <li><strong>Flat, non-distorting</strong> commission → the agent stays neutral (no pay-for-placement).</li>
          <li>Part of it funds a <strong>user cashback</strong> → a concrete reason to go through an agent that proposes you.</li>
        </ul>
        <p>👉 <a href="${esc(input.pollenUrl)}">Learn more</a> — or just reply to this email and we'll set up a 15-min call.</p>
        <p>Cyril Léger<br/>Founder, AI Visionary</p>
    `, ID_EN, input.unsubscribeUrl, 'Unsubscribe');

    return { subject, html, text };
}
