import { NextResponse } from 'next/server';
import { Resend } from 'resend';
import Stripe from 'stripe';
import JSZip from 'jszip';

// Initialize Services
const resend = new Resend(process.env.RESEND_API_KEY || 're_build_placeholder');

import { db } from '@/lib/db';
import { generateRealAsrJson } from '@/lib/ayo-crypto';
import { createLogger } from '@/lib/logger';
import { getFirestore } from 'firebase-admin/firestore';
import { generateSemanticAssets } from '@/lib/ayo-semantics';
import { computeAioScore } from '@/lib/aio-score-engine';
import '@/lib/db'; // Ensure Firebase Admin is initialized

// --- HELPERS ---

// Pack detection by Stripe price_id (env vars) — replaces fragile price threshold
function detectPackType(session: Stripe.Checkout.Session): string {
    const ayaSubPriceId = process.env.STRIPE_PRICE_AYA_SUB;
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

/**
 * Generate manifest.json for the .ayo folder
 */
function generateManifestJson(data: any, url: string): any {
    const name = data.identite?.name?.value || "Entreprise";
    return {
        entity: {
            name,
            type: data.identite?.business_type?.value || "Organization",
            canonicalUrl: url
        },
        authority: {
            role: "declared-entity",
            scope: [
                toArray(data.offre?.services?.value)[0] || "Services professionnels",
                "AYO Singular Record (ASR)"
            ]
        },
        permissions: {
            allow_scraping: ["GoogleBot", "GPTBot", "CCBot", "PerplexityBot", "ClaudeBot", "Bingbot"],
            deny_scraping: ["MaliciousBot"]
        },
        sources: {
            asr: { url: "/.ayo/asr.json", canonical: true, level: "PRO", priority: 1 },
            glossary: { url: "/.ayo/glossary.json", priority: 2 },
            faq: { url: "/.ayo/faq.json", priority: 3 },
            external_context: { url: "/.ayo/external_context.json", canonical: false, interpretable: true }
        },
        interpretationPolicy: {
            rule: "no-extrapolation",
            description: "Toute interprétation doit se limiter strictement aux donnees declarees dans les sources listees."
        },
        recommendationPolicy: {
            scope: "contextual",
            noSubjectiveClaims: true,
            signalsOnly: true
        },
        updatePolicy: {
            asr: "versioned-and-sealed",
            glossary: "versioned",
            faq: "versioned"
        },
        discovery: {
            sitemap: `${url}/sitemap.xml`,
            asrEndpoint: `${url}/.ayo/`
        },
        api_access: { status: "open", endpoint: "/.ayo/asr.json" }
    };
}

// Safely convert any value to an array (handles strings, arrays, nullish)
function toArray(val: any): string[] {
    if (!val) return [];
    if (Array.isArray(val)) return val;
    if (typeof val === 'string') return val.split(',').map(s => s.trim()).filter(Boolean);
    return [];
}

/**
 * Generate faq.json from extracted data
 */
function generateFaqJson(data: any, url: string): any {
    const name = data.identite?.name?.value || "Notre entreprise";
    const services = toArray(data.offre?.services?.value);
    const audience = data.offre?.target_audience?.value || "les professionnels";
    const useCases = toArray(data.offre?.use_cases?.value);
    const pricing = data.offre?.pricing_indication?.value || "";
    const email = data.identite?.contact_email?.value || "";
    const city = data.identite?.city?.value || "";
    const country = data.identite?.country?.value || "";
    const processSteps = toArray(data.processus_methodes?.process_steps?.value);
    const certifications = toArray(data.engagements_conformite?.certifications?.value);

    const qna: { q: string; a: string }[] = [];

    // Q1: Who are you?
    qna.push({
        q: `Qui est ${name} ?`,
        a: `${name} est ${data.identite?.business_type?.value === "Association" ? "une association" : "une entreprise"} ${city ? `basee a ${city}` : ""} ${country ? `(${country})` : ""}. ${services.length > 0 ? `Nous proposons : ${services.slice(0, 3).join(", ")}.` : ""}`
    });

    // Q2: Services
    if (services.length > 0) {
        qna.push({
            q: `Quels services proposez-vous ?`,
            a: `Nos services incluent : ${services.join(", ")}. ${audience ? `Nous nous adressons a ${audience}.` : ""}`
        });
    }

    // Q3: How it works
    if (processSteps.length > 0) {
        qna.push({
            q: `Comment fonctionne votre methode ?`,
            a: `Notre approche se deroule en plusieurs etapes : ${processSteps.slice(0, 5).join(" → ")}.`
        });
    }

    // Q4: Pricing
    qna.push({
        q: `Combien coutent vos services ?`,
        a: pricing ? `Nos tarifs : ${pricing}.` : `Nos tarifs sont communiques sur demande. Contactez-nous pour un devis personnalise.`
    });

    // Q5: Certifications
    if (certifications.length > 0) {
        qna.push({
            q: `Quelles sont vos certifications ?`,
            a: `Nous disposons des certifications suivantes : ${certifications.join(", ")}.`
        });
    }

    // Q6: Use cases
    if (useCases.length > 0) {
        qna.push({
            q: `Dans quels cas faire appel a ${name} ?`,
            a: `Nos cas d'usage principaux : ${useCases.slice(0, 5).join(", ")}.`
        });
    }

    // Q7: Contact
    qna.push({
        q: `Comment contacter ${name} ?`,
        a: email ? `Vous pouvez nous contacter par email a ${email} ou via notre site web ${url}.` : `Rendez-vous sur notre site web : ${url}`
    });

    return {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        version: "AYO-FAQ-1.0",
        entity: name,
        mainEntity: qna.map(item => ({
            "@type": "Question",
            name: item.q,
            acceptedAnswer: { "@type": "Answer", text: item.a }
        }))
    };
}

/**
 * Generate glossary.json from extracted data
 */
function generateGlossaryJson(data: any): any {
    const name = data.identite?.name?.value || "Entreprise";
    const businessType = data.identite?.business_type?.value || "Organization";
    const services = toArray(data.offre?.services?.value);
    const certifications = toArray(data.engagements_conformite?.certifications?.value);

    const terms: { term: string; def: string }[] = [];

    // Business type
    terms.push({
        term: businessType,
        def: `Type d'entite juridique de ${name} selon la classification Schema.org.`
    });

    // Services as terms
    if (services.length > 0) {
        for (const s of services.slice(0, 5)) {
            if (typeof s === 'string' && s.length > 3) {
                terms.push({
                    term: s,
                    def: `Service propose par ${name} dans le cadre de son activite.`
                });
            }
        }
    }

    // Certifications
    if (certifications.length > 0) {
        for (const c of certifications.slice(0, 3)) {
            if (typeof c === 'string' && c.length > 3) {
                terms.push({
                    term: c,
                    def: `Certification ou label detenu par ${name}.`
                });
            }
        }
    }

    // AIO/ASR terms
    terms.push({
        term: "ASR (AYO Singular Record)",
        def: "Fichier de donnees structure permettant aux IA de comprendre et recommander une entite de maniere fiable."
    });
    terms.push({
        term: "AIO (Artificial Intelligence Optimization)",
        def: "Score de visibilite IA mesurant la capacite d'une entite a etre correctement recommandee par les IA generatives."
    });

    return {
        "@context": "https://schema.org",
        "@type": "DefinedTermSet",
        name: `Glossaire Officiel - ${name}`,
        hasDefinedTerm: terms.map(item => ({
            "@type": "DefinedTerm",
            name: item.term,
            description: item.def
        }))
    };
}

/**
 * Generate external_context.json
 */
function generateExternalContextJsonLocal(data: any): any {
    const useCases = toArray(data.offre?.use_cases?.value);
    const services = toArray(data.offre?.services?.value);
    const audience = data.offre?.target_audience?.value || "";
    const frameworks = toArray(data.engagements_conformite?.frameworks?.value);

    // Extract intent keywords from use_cases and services
    const intentKeywords: string[] = [];
    intentKeywords.push(...useCases.slice(0, 10));

    const discoveryKeywords: string[] = [];
    if (Array.isArray(services)) {
        discoveryKeywords.push(...services.slice(0, 5));
    }
    if (audience) discoveryKeywords.push(audience);

    return {
        meta: {
            layer: "external_context",
            status: "active",
            generated_at: new Date().toISOString().split('T')[0],
            source: "ayo-chatbot"
        },
        ecosystem_presence: {
            platform_types: frameworks.length > 0 ? frameworks : [],
            declared_by_client: true
        },
        reputation_signals: {
            enabled: false,
            sources: [],
            policy: "metrics_only"
        },
        keywords_context: {
            discovery_keywords: discoveryKeywords,
            intent_keywords: intentKeywords,
            source: "declared + ecosystem"
        },
        access_channels: {
            primary: ["Site web"],
            secondary: []
        },
        usage_permissions: {
            allow_listing: true,
            allow_comparison: true,
            allow_best_of: true,
            allow_intent_matching: true
        },
        sunset_policy: {
            removable: true,
            reason: "external_noise_dependency",
            future_state: "ignored"
        }
    };
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
}): string {
    const { name, url, score, ayaId, blocks } = params;
    const ayaLink = `https://www.ai-visionary.com/aya/e/${ayaId}`;

    const blockLabels: Record<string, { label: string; max: number }> = {
        identite: { label: "Identite & Ancrage", max: 10 },
        offre: { label: "Clarte de l'Offre", max: 20 },
        processus_methodes: { label: "Processus & Methodes", max: 15 },
        engagements_conformite: { label: "Confiance & Conformite", max: 15 },
        indicateurs: { label: "Preuve Sociale & Metriques", max: 20 },
        contenus_pedagogiques: { label: "Pedagogie & Supports", max: 10 },
        structure_technique: { label: "Socle Technique AIO", max: 10 }
    };

    const scoreRows = Object.entries(blockLabels).map(([key, { label, max }]) => {
        const val = blocks?.[key] ?? 0;
        const pct = Math.round((val / max) * 100);
        const color = pct >= 70 ? '#166534' : pct >= 40 ? '#854d0e' : '#991b1b';
        const bg = pct >= 70 ? '#dcfce7' : pct >= 40 ? '#fef9c3' : '#fee2e2';
        const icon = pct >= 70 ? '&#9989;' : pct >= 40 ? '&#9888;&#65039;' : '&#10060;';
        return `<div style="background:${bg}; border-left:4px solid ${color}; padding:10px; margin-bottom:8px; border-radius:4px;">
            <div style="display:flex; justify-content:space-between; align-items:center;">
                <strong style="color:${color}; font-size:14px;">${icon} ${label}</strong>
                <span style="font-size:12px; background:#fff; padding:2px 8px; border-radius:10px; border:1px solid ${color}; color:${color}; font-weight:bold;">${val}/${max}</span>
            </div>
        </div>`;
    }).join('');

    return `<div style="font-family: 'Helvetica Neue', Arial, sans-serif; color: #333; max-width: 640px; margin: 0 auto;">
    <meta charset="utf-8">

    <div style="background: linear-gradient(135deg, #212E53 0%, #4A919E 100%); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
        <h1 style="color: #fff; margin: 0; font-size: 24px;">&#128640; Votre Pack AYO PRO est pret !</h1>
        <p style="color: #BED3C3; margin: 10px 0 0; font-size: 14px;">Propriete totale de vos actifs semantiques IA</p>
    </div>

    <div style="background: #fff; padding: 25px; border: 1px solid #e5e7eb;">
        <p>Bonjour,</p>
        <p>Merci pour votre confiance ! Voici votre Pack AYO PRO pour <strong>${name}</strong> (<a href="${url}" style="color:#4A919E;">${url}</a>).</p>

        <div style="background: #f0fdf4; padding: 20px; border-radius: 8px; margin: 20px 0; text-align: center; border: 2px solid #86efac;">
            <p style="margin:0; font-size: 14px; color: #666;">Score AIO Final</p>
            <p style="margin: 5px 0; font-size: 42px; font-weight: bold; color: ${score >= 60 ? '#166534' : score >= 40 ? '#854d0e' : '#991b1b'};">${Math.round(score)} / 100</p>
        </div>

        <h3 style="color:#212E53; margin-top:25px;">&#128202; Detail par bloc</h3>
        ${scoreRows}

        <div style="background: #eff6ff; padding: 20px; border-radius: 8px; margin: 25px 0; border: 1px solid #bfdbfe;">
            <h3 style="margin-top:0; color: #1e40af;">&#127760; Votre Certificat AYA est actif</h3>
            <p style="font-size: 14px;">Votre entite est desormais enregistree dans le <strong>Registre AYA</strong> (3 ans inclus).</p>
            <p style="text-align: center; margin: 15px 0;">
                <a href="${ayaLink}" style="background: #4A919E; color: #fff; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: bold; display: inline-block;">Voir mon certificat AYA</a>
            </p>
            <p style="font-size: 12px; color: #666; text-align: center;">
                <a href="${ayaLink}" style="color: #4A919E;">${ayaLink}</a>
            </p>
        </div>

        <h3 style="color:#212E53;">&#128230; Contenu de votre Pack PRO</h3>
        <div style="background: #f9fafb; padding: 15px; border-radius: 8px; border: 1px solid #e5e7eb;">
            <ul style="list-style: none; padding: 0; margin: 0; font-size: 14px; line-height: 2;">
                <li>&#128081; <strong>ASR-Protocol.json</strong> — Votre identite semantique complete (signe)</li>
                <li>&#9881;&#65039; <strong>manifest.json</strong> — Politique de recommandation IA</li>
                <li>&#128172; <strong>faq.json</strong> — FAQ structuree pour agents IA</li>
                <li>&#128214; <strong>glossary.json</strong> — Vocabulaire metier officiel</li>
                <li>&#127760; <strong>external_context.json</strong> — Signaux et contexte externe</li>
            </ul>
        </div>

        <div style="background: #e3f2fd; padding: 20px; border-radius: 8px; margin: 25px 0; border: 1px solid #bbdefb;">
            <h3 style="margin-top:0; color: #0d47a1;">&#128736; Guide d'installation</h3>
            <p style="font-size: 14px; font-weight: bold;">Comment installer vos fichiers ASR ?</p>

            <div style="background: #fff; padding: 12px; border-radius: 5px; margin-bottom: 10px; border: 1px solid #bbdefb;">
                <h4 style="margin: 0 0 8px; color: #0277bd;">METHODE 1 : Simple (Recommandee)</h4>
                <p style="margin: 0; font-size: 13px;">Copiez le contenu de <code>ASR-Protocol.json</code> dans l'en-tete de votre site :</p>
                <div style="background: #f5f5f5; padding: 8px; margin-top: 8px; font-family: monospace; font-size: 11px; border: 1px dashed #ccc; color: #555;">
                    &lt;script type="application/ld+json"&gt;<br>
                    ... COLLEZ LE CONTENU DE ASR-Protocol.json ...<br>
                    &lt;/script&gt;
                </div>
            </div>

            <div style="background: #fff; padding: 12px; border-radius: 5px; border: 1px solid #bbdefb;">
                <h4 style="margin: 0 0 8px; color: #0277bd;">METHODE 2 : Expert</h4>
                <p style="margin: 0; font-size: 13px;">Decompressez le ZIP et placez tous les fichiers dans un dossier <code>.ayo/</code> a la racine de votre site.</p>
            </div>
        </div>

        <div style="background: #fff3e0; padding: 15px; border-radius: 5px; margin: 20px 0; border: 1px solid #ffe0b2;">
            <h4 style="margin-top:0; color: #e65100;">&#127384; Besoin d'aide ?</h4>
            <p style="font-size: 13px; margin-bottom: 0;">Notre equipe est disponible pour vous accompagner dans l'installation.</p>
            <p style="font-size: 13px; font-weight: bold; margin-top: 5px;">Contactez-nous : <a href="mailto:hello@ai-visionary.com" style="color: #e65100;">hello@ai-visionary.com</a></p>
        </div>
    </div>

    <div style="background: #f9fafb; padding: 20px; border-radius: 0 0 12px 12px; text-align: center; border: 1px solid #e5e7eb; border-top: 0;">
        <p style="font-size: 12px; color: #9ca3af; margin: 0;">
            <a href="https://ai-visionary.com" style="color: #4A919E; text-decoration: none;">AI Visionary</a> — Rendez votre entreprise visible par les IA
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

        if (session.client_reference_id) {
            try {
                const payload = JSON.parse(Buffer.from(session.client_reference_id, 'base64').toString('utf-8'));
                if (payload.e) customerEmail = payload.e;
                if (payload.u) analyzedUrl = payload.u;
                if (payload.aid) analysisId = payload.aid;
                logger.info('WEBHOOK_PAYLOAD_DECODED', `Decoded client_reference_id`, payload);
            } catch { /* Invalid base64 — not critical */ }
        }

        if (!analyzedUrl && session.metadata?.analyzed_url) analyzedUrl = session.metadata.analyzed_url;
        if (!customerEmail && session.metadata?.customer_email) customerEmail = session.metadata.customer_email;

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

        // 3b. FALLBACK: Read from scan_states collection if analysis not found
        if (!dbAnalysis && analyzedUrl) {
            try {
                const scanStateDocId = Buffer.from(analyzedUrl).toString('base64url').substring(0, 128);
                const scanStateDoc = await getFirestore().collection('scan_states').doc(scanStateDocId).get();
                if (scanStateDoc.exists) {
                    const scanState = scanStateDoc.data();
                    logger.info('WEBHOOK_SCANSTATE_FALLBACK', `Found scan_state for ${analyzedUrl}`, { url: analyzedUrl });
                    // Reconstruct a minimal analysis from scan_state detected values
                    const fields: any = { identite: {}, offre: {}, processus_methodes: {}, engagements_conformite: {}, indicateurs: {}, contenus_pedagogiques: {}, structure_technique: {} };
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
                            recalcBlocks[k] = (v as any).score;
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

        let analysisData: { score: number; extract: Record<string, unknown>; url: string; blocks?: Record<string, number> };

        if (dbAnalysis) {
            analysisData = {
                score: dbAnalysis.score || 0,
                extract: dbAnalysis.data?.fields || {},
                url: dbAnalysis.url || analyzedUrl || "",
                blocks: dbAnalysis.data?.blocks
            };
            logger.info('WEBHOOK_DATA_FOUND', `Analysis found, score=${analysisData.score}`, { score: analysisData.score, aid: analysisId });
        } else {
            // CRITICAL: Data not found even after all fallbacks
            logger.critical('WEBHOOK_DATA_NOT_FOUND', `No analysis data in Firestore for session ${session_id}. Customer paid but data is missing.`, {
                session_id, analyzedUrl, analysisId, customerEmail
            });
            analysisData = {
                score: 0,
                extract: {},
                url: analyzedUrl || ""
            };
        }

        // Resolve entity name (multiple fallbacks to avoid "Entity" or "Entreprise Inconnue")
        const ext = analysisData.extract as Record<string, any>;
        const entityName = ext.identite?.name?.value
            || ext.identite?.legal_name?.value
            || "Entreprise";

        // 4. REGISTRY AYA
        let ayaId = "pending";
        try {
            const { registerOrUpdateEntity } = await import('@/lib/aya/registry');
            ayaId = await registerOrUpdateEntity({
                legal_name: entityName,
                display_name: entityName,
                website: analysisData.url,
                asr_score: Math.round(analysisData.score || 0),
                asr_payload: { data: analysisData.extract } as any
            }, packType === 'AYA_SUB' ? 'subscription' : 'purchase');
            logger.info('WEBHOOK_AYA_OK', `AYA registered: ${ayaId} (${entityName})`, { ayaId, entityName });
        } catch (e: unknown) {
            const message = e instanceof Error ? e.message : 'Unknown error';
            logger.error('WEBHOOK_AYA_ERROR', message, { session_id });
        }

        // 5. DELIVERY
        if (packType === 'AYA_SUB') {
            const ayaLink = `https://www.ai-visionary.com/aya/e/${ayaId}`;
            await resend.emails.send({
                from: 'AYO Registry <registry@ai-visionary.com>',
                to: [customerEmail],
                subject: `✅ Activation AYA — ${entityName}`,
                html: buildProEmailHtml({
                    name: entityName,
                    url: analysisData.url,
                    score: analysisData.score,
                    ayaId,
                    blocks: analysisData.blocks || {}
                })
            });
            logger.info('WEBHOOK_EMAIL_SUB', `Sub email sent to ${customerEmail}`);

        } else if (packType === 'PRO') {
            // Generate ALL 5 pack files
            const zip = new JSZip();

            // 1. ASR-Protocol.json (main ASR — always deterministic)
            const asr = await generateRealAsrJson(analysisData.extract, analysisData.score, new Date().toISOString(), session_id, "PRO");
            zip.file("ASR-Protocol.json", JSON.stringify(asr, null, 2));

            // 2-5. Semantic assets (Gemini AI-generated with deterministic fallback)
            let manifest: any, faq: any, glossary: any, externalCtx: any;

            try {
                // Try AI-powered generation (rich, contextual content)
                const semanticTimeout = new Promise((_, reject) =>
                    setTimeout(() => reject(new Error("SEMANTIC_TIMEOUT")), 25000)
                );
                const semanticPromise = generateSemanticAssets(analysisData.extract as any);
                const assets = await Promise.race([semanticPromise, semanticTimeout]) as any;

                manifest = generateManifestJson(ext, analysisData.url); // manifest is structural, always deterministic
                faq = assets.faq && Object.keys(assets.faq).length > 0 ? assets.faq : generateFaqJson(ext, analysisData.url);
                glossary = assets.glossary && Object.keys(assets.glossary).length > 0 ? assets.glossary : generateGlossaryJson(ext);
                externalCtx = assets.external_context && Object.keys(assets.external_context).length > 0
                    ? { meta: { layer: "external_context", status: "active", generated_at: new Date().toISOString().split('T')[0], source: "ayo-chatbot" }, ...assets.external_context }
                    : generateExternalContextJsonLocal(ext);

                logger.info('WEBHOOK_SEMANTIC_OK', `AI-generated semantic assets for ${entityName}`);
            } catch (semErr) {
                // Fallback to deterministic generation
                logger.warn('WEBHOOK_SEMANTIC_FALLBACK', `Gemini unavailable, using deterministic generation: ${semErr}`);
                manifest = generateManifestJson(ext, analysisData.url);
                faq = generateFaqJson(ext, analysisData.url);
                glossary = generateGlossaryJson(ext);
                externalCtx = generateExternalContextJsonLocal(ext);
            }

            zip.file("manifest.json", JSON.stringify(manifest, null, 2));
            zip.file("faq.json", JSON.stringify(faq, null, 2));
            zip.file("glossary.json", JSON.stringify(glossary, null, 2));
            zip.file("external_context.json", JSON.stringify(externalCtx, null, 2));

            const zipBuffer = await zip.generateAsync({ type: "nodebuffer" });
            logger.info('WEBHOOK_ZIP_BUILT', `ZIP built with 5 files for ${entityName}`, { files: 5 });

            await resend.emails.send({
                from: 'AYO Delivery <delivery@ai-visionary.com>',
                to: [customerEmail],
                subject: `📥 Votre Pack AYO PRO — ${entityName}`,
                attachments: [{ filename: 'AYO_Pack_PRO.zip', content: zipBuffer }],
                html: buildProEmailHtml({
                    name: entityName,
                    url: analysisData.url,
                    score: analysisData.score,
                    ayaId,
                    blocks: analysisData.blocks || {}
                })
            });
            logger.info('WEBHOOK_EMAIL_PRO', `PRO email sent to ${customerEmail} with 5 files`);
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
