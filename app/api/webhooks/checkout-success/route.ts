import { NextResponse } from 'next/server';
import { sendEmail } from '@/lib/mailer';
import Stripe from 'stripe';
import JSZip from 'jszip';
import crypto from 'crypto';

// Vercel function config — 60s max (native Next.js method, more reliable than vercel.json)
export const maxDuration = 60;

import { db } from '@/lib/db';
// generateRealAsrJson available from '@/lib/ayo-crypto' if needed
import { createLogger } from '@/lib/logger';
import { computeAioScore } from '@/lib/aio-score-engine';
import {
    sanitizeBusinessType, sanitizeExtract,
} from '@/lib/ayo-generators';
// 🤖 Agent Architecte — génération + QC des fichiers PRO
import { generateProPack, type ArchitecteInput } from '@/lib/agents/architecte';

// --- HELPERS ---

// Pack detection by Stripe price_id (env vars) — replaces fragile price threshold
function detectPackType(session: Stripe.Checkout.Session): string {
    const ayaSubPriceId = process.env.STRIPE_PRICE_AYA || process.env.STRIPE_PRICE_AYA_SUB;
    const proPriceId = process.env.STRIPE_PRICE_PRO;

    // Method 1: Match by price_id from line_items metadata
    const lineItemPriceId = (session as any).line_items?.data?.[0]?.price?.id;
    if (lineItemPriceId) {
        if (ayaSubPriceId && lineItemPriceId === ayaSubPriceId) return "AYA_SUB";
        if (proPriceId && lineItemPriceId === proPriceId) return "PRO";
    }

    // Method 2: Fallback to session.mode (reliable for subscription vs one-time)
    if (session.mode === 'subscription') return "AYA_SUB";
    if (session.mode === 'payment') return "PRO";

    return "UNKNOWN";
}


// --- GENERATORS (generateManifestJson, generateFaqJson, generateGlossaryJson, generateExternalContextJsonLocal) ---
// Now imported from @/lib/ayo-generators — SINGLE SOURCE OF TRUTH
// Both the webhook and test endpoint use the same module.

/**
 * Build HTML email for AYA subscription activation
 */
function buildAyaSubEmailHtml(params: {
    name: string;
    url: string;
    score: number;
    ayaId: string;
    blocks: Record<string, number>;
    locale?: 'fr' | 'en';
}): string {
    const { name, url, score, ayaId, blocks, locale = 'en' } = params;
    const ayaLink = `https://ai-visionary.xyz/aya/e/${ayaId}`;
    const en = locale === 'en';

    const blockLabelsI18n: Record<string, { fr: string; en: string; max: number }> = {
        identite: { fr: "Identit&eacute; &amp; Ancrage", en: "Identity &amp; Anchoring", max: 10 },
        offre: { fr: "Clart&eacute; de l&rsquo;Offre", en: "Offer Clarity", max: 20 },
        processus_methodes: { fr: "Processus &amp; M&eacute;thodes", en: "Process &amp; Methods", max: 15 },
        engagements_conformite: { fr: "Confiance &amp; Conformit&eacute;", en: "Trust &amp; Compliance", max: 15 },
        indicateurs: { fr: "Preuve Sociale &amp; M&eacute;triques", en: "Social Proof &amp; Metrics", max: 20 },
        contenus_pedagogiques: { fr: "P&eacute;dagogie &amp; Supports", en: "Educational Content", max: 10 },
        structure_technique: { fr: "Socle Technique AIO", en: "AIO Technical Foundation", max: 10 }
    };

    const scoreRows = Object.entries(blockLabelsI18n).map(([key, bl]) => {
        const val = blocks?.[key] ?? 0;
        const pct = Math.round((val / bl.max) * 100);
        const color = pct >= 70 ? '#166534' : pct >= 40 ? '#854d0e' : '#991b1b';
        const bg = pct >= 70 ? '#dcfce7' : pct >= 40 ? '#fef9c3' : '#fee2e2';
        const icon = pct >= 70 ? '&#9989;' : pct >= 40 ? '&#9888;&#65039;' : '&#10060;';
        const label = en ? bl.en : bl.fr;
        return `<div style="background:${bg}; border-left:4px solid ${color}; padding:10px; margin-bottom:8px; border-radius:4px;">
            <div style="display:flex; justify-content:space-between; align-items:center;">
                <strong style="color:${color}; font-size:14px;">${icon} ${label}</strong>
                <span style="font-size:12px; background:#fff; padding:2px 8px; border-radius:10px; border:1px solid ${color}; color:${color}; font-weight:bold;">${val}/${bl.max}</span>
            </div>
        </div>`;
    }).join('');

    const t = {
        headerTitle: en
            ? '&#127760; Your AYA subscription is active!'
            : '&#127760; Votre abonnement AYA est activ&eacute; !',
        headerSubtitle: en
            ? 'Your entity is now visible to AI systems'
            : 'Votre entit&eacute; est maintenant visible par les IA',
        greeting: en ? 'Hello,' : 'Bonjour,',
        confirmed: en
            ? `Your AYA subscription is confirmed for <strong>${name}</strong> (<a href="${url}" style="color:#4A919E;">${url}</a>).`
            : `Votre abonnement AYA est confirm&eacute; pour <strong>${name}</strong> (<a href="${url}" style="color:#4A919E;">${url}</a>).`,
        scoreLabel: en ? 'AIO Score' : 'Score AIO',
        blockDetailTitle: en ? '&#128202; Score breakdown' : '&#128202; D&eacute;tail par bloc',
        certTitle: en ? '&#127760; Your AYA Certificate is active' : '&#127760; Votre Certificat AYA est actif',
        certDesc: en
            ? 'Your entity is registered in the <strong>AYA Registry</strong> &mdash; accessible to all AI systems.'
            : 'Votre entit&eacute; est enregistr&eacute;e dans le <strong>Registre AYA</strong> &mdash; consultable par toutes les IA.',
        certCta: en ? 'View my AYA certificate' : 'Voir mon certificat AYA',
        includesTitle: en ? '&#10003; Your subscription includes' : '&#10003; Ce que comprend votre abonnement',
        includes: en ? [
            '&#9989; Registration in the AYA Registry (visible to ChatGPT, Claude, Gemini...)',
            '&#9989; ASR hosted on ai-visionary.xyz',
            '&#9989; Updates included',
            '&#9989; Priority in AI recommendations',
        ] : [
            '&#9989; Inscription dans le Registre AYA (visible par ChatGPT, Claude, Gemini...)',
            '&#9989; ASR h&eacute;berg&eacute; sur ai-visionary.xyz',
            '&#9989; Mises &agrave; jour incluses',
            '&#9989; Priorit&eacute; dans les recommandations IA',
        ],
        questionTitle: en ? '&#128172; Any questions?' : '&#128172; Une question ?',
        contactUs: en
            ? 'Contact us: <a href="mailto:hello@ai-visionary.xyz" style="color: #e65100;">hello@ai-visionary.xyz</a>'
            : 'Contactez-nous : <a href="mailto:hello@ai-visionary.xyz" style="color: #e65100;">hello@ai-visionary.xyz</a>',
        footer: en
            ? 'AI Visionary &mdash; Make your business visible to AI'
            : 'AI Visionary &mdash; Rendez votre entreprise visible par les IA',
    };

    return `<div style="font-family: 'Helvetica Neue', Arial, sans-serif; color: #333; max-width: 640px; margin: 0 auto;">
    <meta charset="utf-8">

    <div style="background: linear-gradient(135deg, #212E53 0%, #4A919E 100%); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
        <h1 style="color: #fff; margin: 0; font-size: 24px;">${t.headerTitle}</h1>
        <p style="color: #BED3C3; margin: 10px 0 0; font-size: 14px;">${t.headerSubtitle}</p>
    </div>

    <div style="background: #fff; padding: 25px; border: 1px solid #e5e7eb;">
        <p>${t.greeting}</p>
        <p>${t.confirmed}</p>

        <div style="background: #f0fdf4; padding: 20px; border-radius: 8px; margin: 20px 0; text-align: center; border: 2px solid #86efac;">
            <p style="margin:0; font-size: 14px; color: #666;">${t.scoreLabel}</p>
            <p style="margin: 5px 0; font-size: 42px; font-weight: bold; color: ${score >= 60 ? '#166534' : score >= 40 ? '#854d0e' : '#991b1b'};">${Math.round(score)} / 100</p>
        </div>

        <h3 style="color:#212E53; margin-top:25px;">${t.blockDetailTitle}</h3>
        ${scoreRows}

        <div style="background: #eff6ff; padding: 20px; border-radius: 8px; margin: 25px 0; border: 1px solid #bfdbfe;">
            <h3 style="margin-top:0; color: #1e40af;">${t.certTitle}</h3>
            <p style="font-size: 14px;">${t.certDesc}</p>
            <p style="text-align: center; margin: 15px 0;">
                <a href="${ayaLink}" style="background: #4A919E; color: #fff; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: bold; display: inline-block;">${t.certCta}</a>
            </p>
            <p style="font-size: 12px; color: #666; text-align: center;">
                <a href="${ayaLink}" style="color: #4A919E;">${ayaLink}</a>
            </p>
        </div>

        <div style="background: #f0fdf4; padding: 15px; border-radius: 8px; border: 1px solid #86efac; margin: 20px 0;">
            <h4 style="margin-top:0; color: #166534;">${t.includesTitle}</h4>
            <ul style="list-style: none; padding: 0; margin: 0; font-size: 14px; line-height: 2;">
                ${t.includes.map(item => `<li>${item}</li>`).join('\n                ')}
            </ul>
        </div>

        <div style="background: #fff3e0; padding: 15px; border-radius: 5px; margin: 20px 0; border: 1px solid #ffe0b2;">
            <h4 style="margin-top:0; color: #e65100;">${t.questionTitle}</h4>
            <p style="font-size: 13px; margin-bottom: 0; font-weight: bold;">${t.contactUs}</p>
        </div>
    </div>

    <div style="background: #f9fafb; padding: 20px; border-radius: 0 0 12px 12px; text-align: center; border: 1px solid #e5e7eb; border-top: 0;">
        <p style="font-size: 12px; color: #9ca3af; margin: 0;">
            <a href="https://ai-visionary.xyz" style="color: #4A919E; text-decoration: none;">${t.footer}</a>
        </p>
    </div>
</div>`;
}


/**
 * Build a professional HTML email for PRO pack delivery
 */
function buildProEmailHtml(params: {
    name: string;
    url: string;
    score: number;
    ayaId: string;
    blocks: Record<string, number>;
    locale?: 'fr' | 'en';
}): string {
    const { name, url, score, ayaId, blocks, locale = 'en' } = params;
    const ayaLink = `https://ai-visionary.xyz/aya/e/${ayaId}`;
    const en = locale === 'en';

    const blockLabelsI18n: Record<string, { fr: string; en: string; max: number }> = {
        identite: { fr: "Identit&eacute; &amp; Ancrage", en: "Identity &amp; Anchoring", max: 10 },
        offre: { fr: "Clart&eacute; de l&rsquo;Offre", en: "Offer Clarity", max: 20 },
        processus_methodes: { fr: "Processus &amp; M&eacute;thodes", en: "Process &amp; Methods", max: 15 },
        engagements_conformite: { fr: "Confiance &amp; Conformit&eacute;", en: "Trust &amp; Compliance", max: 15 },
        indicateurs: { fr: "Preuve Sociale &amp; M&eacute;triques", en: "Social Proof &amp; Metrics", max: 20 },
        contenus_pedagogiques: { fr: "P&eacute;dagogie &amp; Supports", en: "Educational Content", max: 10 },
        structure_technique: { fr: "Socle Technique AIO", en: "AIO Technical Foundation", max: 10 }
    };

    const scoreRows = Object.entries(blockLabelsI18n).map(([key, bl]) => {
        const val = blocks?.[key] ?? 0;
        const pct = Math.round((val / bl.max) * 100);
        const color = pct >= 70 ? '#166534' : pct >= 40 ? '#854d0e' : '#991b1b';
        const bg = pct >= 70 ? '#dcfce7' : pct >= 40 ? '#fef9c3' : '#fee2e2';
        const icon = pct >= 70 ? '&#9989;' : pct >= 40 ? '&#9888;&#65039;' : '&#10060;';
        const label = en ? bl.en : bl.fr;
        return `<div style="background:${bg}; border-left:4px solid ${color}; padding:10px; margin-bottom:8px; border-radius:4px;">
            <div style="display:flex; justify-content:space-between; align-items:center;">
                <strong style="color:${color}; font-size:14px;">${icon} ${label}</strong>
                <span style="font-size:12px; background:#fff; padding:2px 8px; border-radius:10px; border:1px solid ${color}; color:${color}; font-weight:bold;">${val}/${bl.max}</span>
            </div>
        </div>`;
    }).join('');

    const t = {
        headerTitle: en
            ? '&#128640; Your AYO PRO Pack is ready!'
            : '&#128640; Votre Pack AYO PRO est pr&ecirc;t !',
        headerSubtitle: en
            ? 'Full ownership of your AI semantic assets'
            : 'Propri&eacute;t&eacute; totale de vos actifs s&eacute;mantiques IA',
        greeting: en ? 'Hello,' : 'Bonjour,',
        intro: en
            ? `Thank you for your trust! Here is your AYO PRO Pack for <strong>${name}</strong> (<a href="${url}" style="color:#4A919E;">${url}</a>).`
            : `Merci pour votre confiance ! Voici votre Pack AYO PRO pour <strong>${name}</strong> (<a href="${url}" style="color:#4A919E;">${url}</a>).`,
        scoreLabel: en ? 'Final AIO Score' : 'Score AIO Final',
        blockDetailTitle: en ? '&#128202; Score breakdown' : '&#128202; D&eacute;tail par bloc',
        certTitle: en ? '&#127760; Your AYA Certificate is active' : '&#127760; Votre Certificat AYA est actif',
        certDesc: en
            ? 'Your entity is now registered in the <strong>AYA Registry</strong> (3 years included).'
            : 'Votre entit&eacute; est d&eacute;sormais enregistr&eacute;e dans le <strong>Registre AYA</strong> (3 ans inclus).',
        certCta: en ? 'View my AYA certificate' : 'Voir mon certificat AYA',
        packTitle: en ? '&#128230; Your PRO Pack contents' : '&#128230; Contenu de votre Pack PRO',
        packItems: en ? [
            '&#128081; <strong>ASR-Protocol.json</strong> &mdash; Your complete semantic identity (signed)',
            '&#9881;&#65039; <strong>manifest.json</strong> &mdash; AI recommendation policy',
            '&#128172; <strong>faq.json</strong> &mdash; Structured FAQ for AI agents',
            '&#128214; <strong>glossary.json</strong> &mdash; Official business vocabulary',
            '&#127760; <strong>external_context.json</strong> &mdash; External signals and context',
        ] : [
            '&#128081; <strong>ASR-Protocol.json</strong> &mdash; Votre identit&eacute; s&eacute;mantique compl&egrave;te (sign&eacute;)',
            '&#9881;&#65039; <strong>manifest.json</strong> &mdash; Politique de recommandation IA',
            '&#128172; <strong>faq.json</strong> &mdash; FAQ structur&eacute;e pour agents IA',
            '&#128214; <strong>glossary.json</strong> &mdash; Vocabulaire m&eacute;tier officiel',
            '&#127760; <strong>external_context.json</strong> &mdash; Signaux et contexte externe',
        ],
        installTitle: en ? '&#128736; Installation guide' : '&#128736; Guide d&rsquo;installation',
        installHow: en ? 'How to install your ASR files?' : 'Comment installer vos fichiers ASR ?',
        method1Title: en ? 'METHOD 1: Simple (Recommended)' : 'M&Eacute;THODE 1 : Simple (Recommand&eacute;e)',
        method1Desc: en
            ? 'Copy the contents of <code>ASR-Protocol.json</code> into your site&rsquo;s header:'
            : 'Copiez le contenu de <code>ASR-Protocol.json</code> dans l&rsquo;en-t&ecirc;te de votre site :',
        method1Code: en
            ? '... PASTE THE CONTENTS OF ASR-Protocol.json HERE ...'
            : '... COLLEZ LE CONTENU DE ASR-Protocol.json ...',
        method2Title: en ? 'METHOD 2: Expert' : 'M&Eacute;THODE 2 : Expert',
        method2Desc: en
            ? 'Unzip the ZIP file and place all files in a <code>.ayo/</code> folder at your site&rsquo;s root.'
            : 'D&eacute;compressez le ZIP et placez tous les fichiers dans un dossier <code>.ayo/</code> &agrave; la racine de votre site.',
        helpTitle: en ? '&#127384; Need help?' : '&#127384; Besoin d&rsquo;aide ?',
        helpDesc: en
            ? 'Our team is available to assist you with the installation.'
            : 'Notre &eacute;quipe est disponible pour vous accompagner dans l&rsquo;installation.',
        contactUs: en
            ? 'Contact us: <a href="mailto:hello@ai-visionary.xyz" style="color: #e65100;">hello@ai-visionary.xyz</a>'
            : 'Contactez-nous : <a href="mailto:hello@ai-visionary.xyz" style="color: #e65100;">hello@ai-visionary.xyz</a>',
        footer: en
            ? 'AI Visionary &mdash; Make your business visible to AI'
            : 'AI Visionary &mdash; Rendez votre entreprise visible par les IA',
    };

    return `<div style="font-family: 'Helvetica Neue', Arial, sans-serif; color: #333; max-width: 640px; margin: 0 auto;">
    <meta charset="utf-8">

    <div style="background: linear-gradient(135deg, #212E53 0%, #4A919E 100%); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
        <h1 style="color: #fff; margin: 0; font-size: 24px;">${t.headerTitle}</h1>
        <p style="color: #BED3C3; margin: 10px 0 0; font-size: 14px;">${t.headerSubtitle}</p>
    </div>

    <div style="background: #fff; padding: 25px; border: 1px solid #e5e7eb;">
        <p>${t.greeting}</p>
        <p>${t.intro}</p>

        <div style="background: #f0fdf4; padding: 20px; border-radius: 8px; margin: 20px 0; text-align: center; border: 2px solid #86efac;">
            <p style="margin:0; font-size: 14px; color: #666;">${t.scoreLabel}</p>
            <p style="margin: 5px 0; font-size: 42px; font-weight: bold; color: ${score >= 60 ? '#166534' : score >= 40 ? '#854d0e' : '#991b1b'};">${Math.round(score)} / 100</p>
        </div>

        <h3 style="color:#212E53; margin-top:25px;">${t.blockDetailTitle}</h3>
        ${scoreRows}

        <div style="background: #eff6ff; padding: 20px; border-radius: 8px; margin: 25px 0; border: 1px solid #bfdbfe;">
            <h3 style="margin-top:0; color: #1e40af;">${t.certTitle}</h3>
            <p style="font-size: 14px;">${t.certDesc}</p>
            <p style="text-align: center; margin: 15px 0;">
                <a href="${ayaLink}" style="background: #4A919E; color: #fff; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: bold; display: inline-block;">${t.certCta}</a>
            </p>
            <p style="font-size: 12px; color: #666; text-align: center;">
                <a href="${ayaLink}" style="color: #4A919E;">${ayaLink}</a>
            </p>
        </div>

        <h3 style="color:#212E53;">${t.packTitle}</h3>
        <div style="background: #f9fafb; padding: 15px; border-radius: 8px; border: 1px solid #e5e7eb;">
            <ul style="list-style: none; padding: 0; margin: 0; font-size: 14px; line-height: 2;">
                ${t.packItems.map(item => `<li>${item}</li>`).join('\n                ')}
            </ul>
        </div>

        <div style="background: #e3f2fd; padding: 20px; border-radius: 8px; margin: 25px 0; border: 1px solid #bbdefb;">
            <h3 style="margin-top:0; color: #0d47a1;">${t.installTitle}</h3>
            <p style="font-size: 14px; font-weight: bold;">${t.installHow}</p>

            <div style="background: #fff; padding: 12px; border-radius: 5px; margin-bottom: 10px; border: 1px solid #bbdefb;">
                <h4 style="margin: 0 0 8px; color: #0277bd;">${t.method1Title}</h4>
                <p style="margin: 0; font-size: 13px;">${t.method1Desc}</p>
                <div style="background: #f5f5f5; padding: 8px; margin-top: 8px; font-family: monospace; font-size: 11px; border: 1px dashed #ccc; color: #555;">
                    &lt;script type="application/ld+json"&gt;<br>
                    ${t.method1Code}<br>
                    &lt;/script&gt;
                </div>
            </div>

            <div style="background: #fff; padding: 12px; border-radius: 5px; border: 1px solid #bbdefb;">
                <h4 style="margin: 0 0 8px; color: #0277bd;">${t.method2Title}</h4>
                <p style="margin: 0; font-size: 13px;">${t.method2Desc}</p>
            </div>
        </div>

        <div style="background: #fff3e0; padding: 15px; border-radius: 5px; margin: 20px 0; border: 1px solid #ffe0b2;">
            <h4 style="margin-top:0; color: #e65100;">${t.helpTitle}</h4>
            <p style="font-size: 13px; margin-bottom: 0;">${t.helpDesc}</p>
            <p style="font-size: 13px; font-weight: bold; margin-top: 5px;">${t.contactUs}</p>
        </div>
    </div>

    <div style="background: #f9fafb; padding: 20px; border-radius: 0 0 12px 12px; text-align: center; border: 1px solid #e5e7eb; border-top: 0;">
        <p style="font-size: 12px; color: #9ca3af; margin: 0;">
            <a href="https://ai-visionary.xyz" style="color: #4A919E; text-decoration: none;">${t.footer}</a>
        </p>
    </div>
</div>`;
}


export async function POST(req: Request) {
    const stripeKey = process.env.STRIPE_SECRET_KEY;
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    let stripe: Stripe | null = null;

    if (stripeKey) stripe = new Stripe(stripeKey);

    const logger = createLogger('webhook', 'stripe');
    let session_id_tracking = "unknown";

    try {
        const rawBody = await req.text();
        const signature = req.headers.get('stripe-signature');

        // SECURITY: Stripe webhook signature verification is MANDATORY
        if (!webhookSecret || !signature || !stripe) {
            logger.error('WEBHOOK_CONFIG_MISSING', 'Missing Stripe config');
            return NextResponse.json({ error: 'Webhook not configured' }, { status: 500 });
        }

        let event: Stripe.Event;
        try {
            event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Unknown signature error';
            logger.error('WEBHOOK_SIG_FAIL', message);
            return NextResponse.json({ error: 'Signature invalide' }, { status: 400 });
        }

        if (event.type !== 'checkout.session.completed') {
            return NextResponse.json({ received: true });
        }

        const session = (event.data.object as Stripe.Checkout.Session);
        const session_id = session.id;
        session_id_tracking = session_id;

        logger.info('WEBHOOK_START', `Checkout completed`, { mode: session.mode, amount: session.amount_total, session_id });

        // 1. EXTRACT CUSTOMER DATA from client_reference_id and metadata
        let customerEmail = session.customer_details?.email || session.customer_email || "";
        let analyzedUrl = "";
        let analysisId = "";
        let locale: 'fr' | 'en' = 'en';

        if (session.client_reference_id) {
            try {
                const payload = JSON.parse(Buffer.from(session.client_reference_id, 'base64').toString('utf-8'));
                if (payload.e) customerEmail = payload.e;
                if (payload.u) analyzedUrl = payload.u;
                if (payload.aid) analysisId = payload.aid;
                if (payload.l === 'fr') locale = 'fr';
                else if (payload.l === 'en') locale = 'en';
                logger.info('WEBHOOK_PAYLOAD_DECODED', `Decoded client_reference_id`, payload);
            } catch { /* Invalid base64 — not critical */ }
        }

        if (!analyzedUrl && session.metadata?.analyzed_url) analyzedUrl = session.metadata.analyzed_url;
        if (!customerEmail && session.metadata?.customer_email) customerEmail = session.metadata.customer_email;
        if (!analysisId && session.metadata?.analysis_id) analysisId = session.metadata.analysis_id;

        logger.info('WEBHOOK_IDENTIFIED', `Customer identified`, { email: customerEmail, url: analyzedUrl, aid: analysisId });

        if (!customerEmail) {
            logger.critical('WEBHOOK_NO_EMAIL', `No customer email found for session ${session_id}`, { session_id });
            return NextResponse.json({ error: 'Webhook processing error' }, { status: 500 });
        }

        // 2. PACK TYPE DETECTION (by price_id, fallback to session.mode)
        const packType = detectPackType(session);
        logger.info('WEBHOOK_PACK', `Pack: ${packType}`, { packType, amount: session.amount_total });

        // 3. RETRIEVE ANALYSIS DATA from Firestore (saved during chat)
        // CRITICAL: A document may exist with just {email, url, timestamp} (no score/data).
        // We must verify the document has ACTUAL analysis data before accepting it.
        const hasRealData = (doc: any) => doc && (doc.score > 0 || (doc.data?.fields && Object.keys(doc.data.fields).some((k: string) => doc.data.fields[k] && Object.keys(doc.data.fields[k]).length > 0)));

        let dbAnalysis = null;
        if (analysisId) {
            const directLookup = await db.getAnalysis(analysisId);
            if (hasRealData(directLookup)) {
                dbAnalysis = directLookup;
                logger.info('WEBHOOK_ANALYSIS_BY_ID', `Found COMPLETE analysis by ID: ${analysisId}`, { score: directLookup?.score });
            } else {
                logger.warn('WEBHOOK_ANALYSIS_PARTIAL', `Analysis ${analysisId} found but has no score/data — searching by URL/email`, { keys: directLookup ? Object.keys(directLookup) : [] });
            }
        }
        if (!dbAnalysis && analyzedUrl) {
            const byUrl = await db.getLatestAnalysisByUrl(analyzedUrl);
            if (hasRealData(byUrl)) {
                dbAnalysis = byUrl;
                logger.info('WEBHOOK_ANALYSIS_BY_URL', `Found COMPLETE analysis by URL: ${analyzedUrl}`, { score: byUrl?.score });
            }
        }
        if (!dbAnalysis && customerEmail) {
            const byEmail = await db.getLatestAnalysisByEmail(customerEmail);
            if (hasRealData(byEmail)) {
                dbAnalysis = byEmail;
                logger.info('WEBHOOK_ANALYSIS_BY_EMAIL', `Found COMPLETE analysis by email: ${customerEmail}`, { score: byEmail?.score });
            }
        }

        // 3b. RENEW FLOW FALLBACK by contact_email: always available from Stripe, independent of client_reference_id
        if (!dbAnalysis && customerEmail) {
            try {
                const ayaByEmail = await db.getAyaEntityByContactEmail(customerEmail);
                if (ayaByEmail && (ayaByEmail.asr_payload || ayaByEmail.asr_score)) {
                    const payload = ayaByEmail.asr_payload as any;
                    const fields = payload?.data?.fields || payload?.fields || payload?.data || {};
                    dbAnalysis = {
                        score: ayaByEmail.asr_score || 0,
                        url: ayaByEmail.website || analyzedUrl,
                        data: { fields, blocks: payload?.blocks || {} }
                    } as any;
                    if (!analyzedUrl) analyzedUrl = ayaByEmail.website || '';
                    logger.info('WEBHOOK_AYA_EMAIL_FALLBACK', `Found entity in aya_registry by contact_email: ${customerEmail}`, { score: ayaByEmail.asr_score, entityId: ayaByEmail.entity_id });
                }
            } catch (e) {
                logger.warn('WEBHOOK_AYA_EMAIL_ERROR', `Failed to look up aya_registry by contact_email: ${e}`);
            }
        }

        // 3c. RENEW FLOW FALLBACK: aid = AYA entity_id (not an analysis id)
        if (!dbAnalysis && analysisId) {
            try {
                const ayaEntity = await db.getAyaEntityById(analysisId);
                if (ayaEntity && (ayaEntity.asr_payload || ayaEntity.asr_score)) {
                    const payload = ayaEntity.asr_payload as any;
                    // Support both storage shapes: { data: { fields } } or { fields }
                    const fields = payload?.data?.fields || payload?.fields || payload?.data || {};
                    dbAnalysis = {
                        score: ayaEntity.asr_score || 0,
                        url: ayaEntity.website || analyzedUrl,
                        data: { fields, blocks: payload?.blocks || {} }
                    } as any;
                    logger.info('WEBHOOK_AYA_ENTITY_FALLBACK', `Found entity in aya_registry: ${analysisId}`, { score: ayaEntity.asr_score });
                }
            } catch (e) {
                logger.warn('WEBHOOK_AYA_ENTITY_ERROR', `Failed to look up aya_registry by id: ${e}`);
            }
        }

        // 3c. FALLBACK: Read from scan_states collection if analysis not found
        if (!dbAnalysis && analyzedUrl) {
            try {
                const scanState = await db.getScanState(analyzedUrl);
                if (scanState) {
                    logger.info('WEBHOOK_SCANSTATE_FALLBACK', `Found scan_state for ${analyzedUrl}`, { url: analyzedUrl });
                    // Reconstruct a minimal analysis from scan_state detected values
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
                    // Recalculate score from reconstructed fields using the Bible engine
                    let recalcScore = 0;
                    let recalcBlocks: Record<string, number> = {};
                    try {
                        const fakeExtract = {
                            fields,
                            source: { scan: { is_reachable: true, has_jsonld: true, has_asr_file: false, is_aya_registered: false, has_faq_schema: false, has_faq_content: false } }
                        };
                        const scoreResult = computeAioScore(fakeExtract as any);
                        recalcScore = scoreResult.total;
                        recalcBlocks = {};
                        for (const [k, v] of Object.entries(scoreResult.blocks)) {
                            recalcBlocks[k] = typeof v === 'number' ? v : (v as any).score ?? 0;
                        }
                        logger.info('WEBHOOK_SCANSTATE_SCORE', `Recalculated score from scan_state: ${recalcScore}`, { recalcScore, recalcBlocks });
                    } catch (scoreErr) {
                        logger.warn('WEBHOOK_SCANSTATE_SCORE_ERROR', `Failed to recalculate: ${scoreErr}`);
                    }

                    dbAnalysis = {
                        score: recalcScore,
                        url: analyzedUrl,
                        data: { fields, blocks: recalcBlocks }
                    } as any;
                }
            } catch (e) {
                logger.warn('WEBHOOK_SCANSTATE_ERROR', `Failed to read scan_state: ${e}`);
            }
        }

        // Extract existing AYA entity ID if saved during renew flow (page.tsx embeds it)
        const existingAyaEntityId: string = (dbAnalysis as any)?.data?.aya_entity_id || '';

        let analysisData: { score: number; extract: Record<string, unknown>; url: string; blocks?: Record<string, number> };

        if (dbAnalysis) {
            const extractFields = dbAnalysis.data?.fields || {};
            let blocks = dbAnalysis.data?.blocks;
            // Recalculate blocks if missing or empty (renew flow stores fields but not blocks)
            if (!blocks || Object.keys(blocks).length === 0) {
                try {
                    const scoreResult = computeAioScore({ fields: extractFields, source: { scan: { is_reachable: true } } } as any);
                    blocks = {};
                    for (const [k, v] of Object.entries(scoreResult.blocks)) {
                        blocks[k] = typeof v === 'number' ? v : (v as any).score ?? 0;
                    }
                    logger.info('WEBHOOK_BLOCKS_RECALC', `Blocks recalculated from fields`, { total: scoreResult.total });
                } catch { /* keep blocks empty */ }
            }
            analysisData = {
                score: dbAnalysis.score || 0,
                extract: extractFields,
                url: dbAnalysis.url || analyzedUrl || "",
                blocks
            };
            logger.info('WEBHOOK_DATA_FOUND', `Analysis found, score=${analysisData.score}`, { score: analysisData.score, aid: analysisId });
        } else {
            // CRITICAL: Data not found even after all fallbacks — DO NOT generate empty files
            logger.critical('WEBHOOK_DATA_NOT_FOUND', `No analysis data in Firestore for session ${session_id}. Customer paid but data is missing. Sending error notification.`, {
                session_id, analyzedUrl, analysisId, customerEmail
            });

            // Send an apology email to the customer instead of empty files
            try {
                const apologySubject = locale === 'en'
                    ? `⚠️ Your AYO order is being processed`
                    : `⚠️ Votre commande AYO est en cours de traitement`;
                const apologyHtml = locale === 'en'
                    ? `<div style="font-family: 'Helvetica Neue', Arial, sans-serif; color: #333; max-width: 640px; margin: 0 auto;">
                        <div style="background: linear-gradient(135deg, #212E53 0%, #4A919E 100%); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
                            <h1 style="color: #fff; margin: 0; font-size: 22px;">Your payment has been received</h1>
                        </div>
                        <div style="background: #fff; padding: 25px; border: 1px solid #e5e7eb;">
                            <p>Hello,</p>
                            <p>Thank you for your purchase! Your payment has been successfully confirmed.</p>
                            <p>Our systems are finalizing the generation of your files. You will receive them by email within the next few minutes.</p>
                            <p>If you don't receive anything within an hour, please contact us:</p>
                            <p style="text-align: center; margin: 20px 0;">
                                <a href="mailto:hello@ai-visionary.xyz" style="background: #4A919E; color: #fff; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: bold;">Contact support</a>
                            </p>
                        </div>
                        <div style="background: #f9fafb; padding: 15px; border-radius: 0 0 12px 12px; text-align: center; border: 1px solid #e5e7eb; border-top: 0;">
                            <p style="font-size: 12px; color: #9ca3af; margin: 0;">AI Visionary — Ref: ${session_id.substring(0, 20)}</p>
                        </div>
                    </div>`
                    : `<div style="font-family: 'Helvetica Neue', Arial, sans-serif; color: #333; max-width: 640px; margin: 0 auto;">
                        <div style="background: linear-gradient(135deg, #212E53 0%, #4A919E 100%); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
                            <h1 style="color: #fff; margin: 0; font-size: 22px;">Votre paiement a bien été reçu</h1>
                        </div>
                        <div style="background: #fff; padding: 25px; border: 1px solid #e5e7eb;">
                            <p>Bonjour,</p>
                            <p>Merci pour votre achat ! Votre paiement a été confirmé avec succès.</p>
                            <p>Nos systèmes sont en train de finaliser la génération de vos fichiers. Vous les recevrez par email dans les prochaines minutes.</p>
                            <p>Si vous ne recevez rien dans l'heure, contactez-nous :</p>
                            <p style="text-align: center; margin: 20px 0;">
                                <a href="mailto:hello@ai-visionary.xyz" style="background: #4A919E; color: #fff; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: bold;">Contacter le support</a>
                            </p>
                        </div>
                        <div style="background: #f9fafb; padding: 15px; border-radius: 0 0 12px 12px; text-align: center; border: 1px solid #e5e7eb; border-top: 0;">
                            <p style="font-size: 12px; color: #9ca3af; margin: 0;">AI Visionary — Ref: ${session_id.substring(0, 20)}</p>
                        </div>
                    </div>`;
                await sendEmail({
                    from: 'AYO Support <hello@ai-visionary.xyz>',
                    to: [customerEmail],
                    subject: apologySubject,
                    html: apologyHtml
                });
                logger.info('WEBHOOK_ERROR_EMAIL_SENT', `Error notification sent to ${customerEmail}`);
            } catch (emailErr) {
                logger.error('WEBHOOK_ERROR_EMAIL_FAILED', `Failed to send error notification: ${emailErr}`);
            }

            // Return 200 so Stripe doesn't retry (which would send the apology email again)
            return NextResponse.json({ received: true, warning: 'Analysis data not found', session_id }, { status: 200 });
        }

        // Resolve entity name (multiple fallbacks to avoid "Entity" or "Entreprise Inconnue")
        // Priority: user-confirmed legal name (from Stripe metadata) > scan-detected name
        const ext = analysisData.extract as Record<string, any>;
        const userLegalName = session.metadata?.legal_name || '';
        const entityName = userLegalName
            || ext.identite?.name?.value
            || ext.identite?.legal_name?.value
            || (locale === 'fr' ? "Entreprise" : "Entity");
        // If user provided a legal name, also inject it into the extract for file generation
        if (userLegalName && ext.identite) {
            ext.identite.legal_name = { value: userLegalName, q: 1, evidence: ['user_confirmed'] };
            // Keep display name (from scan) separate from legal name
            if (!ext.identite.name?.value) ext.identite.name = { value: userLegalName, q: 1, evidence: ['user_confirmed'] };
        }

        // 4. REGISTRY AYA
        // Extract entity metadata from analysis data (instead of defaulting to CH/company/General)
        const entityBusinessType = ext.identite?.business_type?.value || "";
        const entityCountry = ext.identite?.country?.value || "";
        const lowerEBT = entityBusinessType.toLowerCase();
        const lowerEName = entityName.toLowerCase();
        const lowerEUrl = (analysisData.url || "").toLowerCase();
        const isAssociationType = lowerEBT.includes("association") || lowerEBT.includes("ong") || lowerEBT.includes("fondation") || lowerEBT.includes("non-profit") || lowerEBT.includes("nonprofit")
            || lowerEName.startsWith("association ") || lowerEName.includes("asso ")
            || lowerEUrl.includes(".org");
        const resolvedEntityType = isAssociationType ? 'association' as const : 'company' as const;
        // Map country name to ISO code
        const countryIsoMap: Record<string, string> = {
            'france': 'FR', 'suisse': 'CH', 'switzerland': 'CH', 'belgique': 'BE', 'belgium': 'BE',
            'allemagne': 'DE', 'germany': 'DE', 'italie': 'IT', 'italy': 'IT', 'espagne': 'ES', 'spain': 'ES',
            'luxembourg': 'LU', 'canada': 'CA', 'états-unis': 'US', 'united states': 'US', 'usa': 'US',
            'royaume-uni': 'GB', 'united kingdom': 'GB', 'uk': 'GB', 'maroc': 'MA', 'tunisie': 'TN',
            'sénégal': 'SN', 'côte d\'ivoire': 'CI', 'cameroun': 'CM'
        };
        const resolvedCountryLegal = (entityCountry.length === 2 ? entityCountry.toUpperCase() : countryIsoMap[entityCountry.toLowerCase()] || entityCountry.toUpperCase().slice(0, 2)) || 'XX';
        const resolvedSector = sanitizeBusinessType(entityBusinessType) || ext.offre?.services?.value?.[0] || 'General';

        let ayaId = "pending";
        try {
            const { registerOrUpdateEntity } = await import('@/lib/aya/registry');
            ayaId = await registerOrUpdateEntity({
                ...(existingAyaEntityId ? { aya_entity_id: existingAyaEntityId } : {}),
                legal_name: entityName,
                display_name: entityName,
                entity_type: resolvedEntityType,
                country_legal: resolvedCountryLegal,
                sector_macro: resolvedSector,
                website: analysisData.url,
                asr_score: Math.round(analysisData.score || 0),
                contact_email: customerEmail,
                asr_payload: { data: analysisData.extract } as any
            }, packType === 'AYA_SUB' ? 'subscription' : 'purchase');
            logger.info('WEBHOOK_AYA_OK', `AYA registered: ${ayaId} (${entityName})`, { ayaId, entityName, existingAyaEntityId });

            // Generate faithful bilingual descriptions for certified entity (retry x2)
            try {
                const { generateCertifiedTranslations } = await import('@/lib/ayo-semantics');
                const extract = analysisData.extract || {};
                const fields = (extract.fields || extract) as Record<string, any>;
                const enrichArgs = [
                    entityName,
                    fields.identite?.business_type?.value || '',
                    Array.isArray(fields.offre?.services?.value) ? fields.offre.services.value : [],
                    typeof fields.offre?.target_audience?.value === 'string' ? fields.offre.target_audience.value : '',
                    resolvedCountryLegal || 'CH',
                    locale as 'fr' | 'en',
                ] as const;
                let translations = await generateCertifiedTranslations(...enrichArgs);
                // Retry once if Gemini returned empty
                if (!translations.gemini_description) {
                    logger.warn('WEBHOOK_TRANSLATIONS_RETRY', `First enrichment attempt empty for ${entityName}, retrying...`);
                    await new Promise(r => setTimeout(r, 1500));
                    translations = await generateCertifiedTranslations(...enrichArgs);
                }
                if (translations.gemini_description && ayaId) {
                    const existingEntity = await db.getAyaEntityById(ayaId);
                    if (existingEntity) {
                        const payload = { ...existingEntity.asr_payload };
                        if (!payload.enrichment) payload.enrichment = {};
                        payload.enrichment.gemini_description = translations.gemini_description;
                        payload.enrichment.gemini_description_fr = translations.gemini_description_fr;
                        payload.enrichment.gemini_keywords = translations.gemini_keywords;
                        payload.enrichment.gemini_keywords_fr = translations.gemini_keywords_fr;
                        payload.enrichment.enriched_at = new Date().toISOString();
                        await db.updateEntityData(ayaId, { asr_payload: payload });
                        logger.info('WEBHOOK_TRANSLATIONS_OK', `Bilingual descriptions generated for ${entityName}`);
                    }
                } else {
                    logger.warn('WEBHOOK_TRANSLATIONS_EMPTY', `Enrichment returned empty after retry for ${entityName} — use /api/admin/enrich to fix`);
                }
            } catch (translationErr) {
                // Non-blocking — entity is registered, use /api/admin/enrich to fix later
                logger.warn('WEBHOOK_TRANSLATIONS_FAIL', `Translation generation failed for ${entityName}: ${translationErr instanceof Error ? translationErr.message : 'unknown'}`);
            }

        } catch (e: unknown) {
            const message = e instanceof Error ? e.message : 'Unknown error';
            logger.error('WEBHOOK_AYA_ERROR', message, { session_id });
            // Retry once — registration is critical for the certificate link in the email
            try {
                const { registerOrUpdateEntity } = await import('@/lib/aya/registry');
                ayaId = await registerOrUpdateEntity({
                    ...(existingAyaEntityId ? { aya_entity_id: existingAyaEntityId } : {}),
                    legal_name: entityName,
                    display_name: entityName,
                    entity_type: resolvedEntityType,
                    country_legal: resolvedCountryLegal,
                    sector_macro: resolvedSector,
                    website: analysisData.url,
                    asr_score: Math.round(analysisData.score || 0),
                    contact_email: customerEmail,
                    asr_payload: { data: analysisData.extract } as any
                }, packType === 'AYA_SUB' ? 'subscription' : 'purchase');
                logger.info('WEBHOOK_AYA_RETRY_OK', `AYA retry success: ${ayaId}`, { ayaId });
            } catch (retryErr) {
                logger.error('WEBHOOK_AYA_RETRY_FAIL', 'AYA registration failed after retry', { session_id });
            }
        }

        // 5. SCORE LIFT for both packs — AYA_SUB and PRO both deliver ASR + AYA registration
        // Use pre-calculated proScore from V2 scan if available
        const savedProScore = dbAnalysis?.data?.proScore;
        const savedProBlocks = dbAnalysis?.data?.proBlocks;
        if (savedProScore && savedProScore > analysisData.score) {
            const previousScore = analysisData.score;
            analysisData.score = savedProScore;
            if (savedProBlocks) {
                analysisData.blocks = {};
                for (const [k, v] of Object.entries(savedProBlocks)) {
                    analysisData.blocks[k] = typeof v === 'number' ? v : (v as any).score ?? 0;
                }
            }
            logger.info('WEBHOOK_SCORE_LIFT', `Score lifted from ${previousScore} to ${savedProScore} (proScore from V2 scan)`);
            // Update AYA registry with lifted score
            if (ayaId && ayaId !== 'pending') {
                try {
                    await db.updateEntityData(ayaId, { asr_score: Math.round(analysisData.score) });
                } catch { /* non-blocking */ }
            }
        }

        // 5b. DELIVERY
        if (packType === 'AYA_SUB') {
            const ayaSubject = locale === 'en'
                ? `✅ AYA subscription activated — ${entityName}`
                : `✅ Abonnement AYA activé — ${entityName}`;
            await sendEmail({
                from: 'AYO Registry <security@ai-visionary.xyz>',
                to: [customerEmail],
                subject: ayaSubject,
                html: buildAyaSubEmailHtml({
                    name: entityName,
                    url: analysisData.url,
                    score: analysisData.score,
                    ayaId,
                    blocks: analysisData.blocks || {},
                    locale
                })
            });
            logger.info('WEBHOOK_EMAIL_SUB', `Sub email sent to ${customerEmail}`);

        } else if (packType === 'PRO') {
            // Score lift already applied above (section 5) for both packs

            // SANITIZE DATA BEFORE GENERATION — uses shared sanitizer from @/lib/ayo-generators
            if (ext) {
                const { cleanedFields } = sanitizeExtract(ext);
                for (const field of cleanedFields) {
                    logger.info('WEBHOOK_SANITIZE', `Cleaned template value from ${field}`);
                }
            }

            // 🤖 AGENT ARCHITECTE — Génère les 5 fichiers PRO + Contrôle Qualité
            const asrId = `asr_${ayaId || crypto.randomUUID().replace(/-/g, '').substring(0, 16)}`;
            const architecteInput: ArchitecteInput = {
                extractData: ext,
                url: analysisData.url,
                email: customerEmail,
                mode: 'PRO',
                score: analysisData.score,
                date: new Date().toISOString(),
                asrId,
                locale,
            };

            const architecteResult = await generateProPack(architecteInput);
            logger.info('ARCHITECTE_RESULT', `Architecte: delivered=${architecteResult.delivered}, attempts=${architecteResult.attempts}, errors=${architecteResult.qcResult.errors.length}`, {
                delivered: architecteResult.delivered,
                attempts: architecteResult.attempts,
                totalErrors: architecteResult.qcResult.errors.length,
                blockingErrors: architecteResult.qcResult.errors.filter(e => e.severity === 'blocking').length,
                correctableErrors: architecteResult.qcResult.errors.filter(e => e.severity === 'correctable').length,
            });

            if (!architecteResult.delivered) {
                const blockingErrors = architecteResult.qcResult.errors
                    .filter(e => e.severity === 'blocking')
                    .map(e => `${e.file}:${e.field} — ${e.message}`);
                logger.critical('ARCHITECTE_QC_FAILED', `QC échoué après ${architecteResult.attempts} tentatives pour ${entityName}`, {
                    blockingErrors,
                });
                // On continue quand même la livraison — les fichiers sont générés, juste pas parfaits.
                // Le client reçoit ses fichiers + on log pour monitoring.
            }

            const zip = new JSZip();
            zip.file("ASR-Protocol.json", JSON.stringify(architecteResult.files.asr, null, 2));
            zip.file("manifest.json", JSON.stringify(architecteResult.files.manifest, null, 2));
            zip.file("faq.json", JSON.stringify(architecteResult.files.faq, null, 2));
            zip.file("glossary.json", JSON.stringify(architecteResult.files.glossary, null, 2));
            zip.file("external_context.json", JSON.stringify(architecteResult.files.externalContext, null, 2));

            const zipBuffer = await zip.generateAsync({ type: "nodebuffer" });
            logger.info('WEBHOOK_ZIP_BUILT', `ZIP built with 5 files for ${entityName} (QC: ${architecteResult.delivered ? 'PASS' : 'WARN'})`, { files: 5 });

            // Build email HTML first (to catch errors before SMTP call)
            let emailHtml: string;
            try {
                emailHtml = buildProEmailHtml({
                    name: entityName,
                    url: analysisData.url,
                    score: analysisData.score,
                    ayaId,
                    blocks: analysisData.blocks || {},
                    locale
                });
                logger.info('WEBHOOK_HTML_BUILT', `Email HTML built (${emailHtml.length} chars)`, { zipSize: zipBuffer.length });
            } catch (htmlErr: any) {
                logger.critical('WEBHOOK_HTML_CRASH', `buildProEmailHtml crashed: ${htmlErr.message}`, { stack: htmlErr.stack?.substring(0, 500) });
                throw htmlErr;
            }

            try {
                const proSubject = locale === 'en'
                    ? `📥 Your AYO PRO Pack — ${entityName}`
                    : `📥 Votre Pack AYO PRO — ${entityName}`;
                const emailResult = await sendEmail({
                    from: 'AYO Delivery <security@ai-visionary.xyz>',
                    to: [customerEmail],
                    subject: proSubject,
                    attachments: [{ filename: 'AYO_Pack_PRO.zip', content: zipBuffer }],
                    html: emailHtml
                });
                if (!emailResult.success) {
                    throw new Error(emailResult.error || 'Email sending failed');
                }
                logger.info('WEBHOOK_EMAIL_PRO', `PRO email sent to ${customerEmail} with 5 files`);
            } catch (emailErr: any) {
                logger.critical('WEBHOOK_EMAIL_CRASH', `SMTP send failed: ${emailErr.message}`, { stack: emailErr.stack?.substring(0, 500) });
                throw emailErr;
            }
        } else {
            logger.warn('WEBHOOK_NO_DELIVERY', `Unknown pack type: ${packType}`, { packType, session_id });
        }

        return NextResponse.json({ received: true });

    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        const stack = err instanceof Error ? err.stack : undefined;
        logger.critical('WEBHOOK_FATAL', message, { session_id: session_id_tracking, stack });
        return NextResponse.json({ error: 'Webhook processing error' }, { status: 500 });
    }
}
