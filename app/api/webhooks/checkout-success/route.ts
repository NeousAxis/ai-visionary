import { NextResponse } from 'next/server';
import { Resend } from 'resend';
import Stripe from 'stripe';
import JSZip from 'jszip';
import crypto from 'crypto';

// Vercel function config — 60s max (native Next.js method, more reliable than vercel.json)
export const maxDuration = 60;

// Initialize Services
const resend = new Resend(process.env.RESEND_API_KEY || 're_build_placeholder');

import { db } from '@/lib/db';
import { generateRealAsrJson } from '@/lib/ayo-crypto';
import { createLogger } from '@/lib/logger';
import { getFirestore } from 'firebase-admin/firestore';
// Gemini AI generation disabled — deterministic generators are now quality-controlled
// import { generateSemanticAssets } from '@/lib/ayo-semantics';
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
    const name = cleanVal(data.identite?.name?.value) || "Entreprise";
    const businessType = sanitizeBusinessType(cleanVal(data.identite?.business_type?.value), "Organization");
    const services = cleanArray(data.offre?.services?.value);
    const certifications = cleanArray(data.engagements_conformite?.certifications?.value);
    const country = cleanVal(data.identite?.country?.value);

    // Association detection for manifest entity type
    const lowerMBT = businessType.toLowerCase();
    const lowerMName = name.toLowerCase();
    const lowerMUrl = (url || "").toLowerCase();
    const isAssoManifest = lowerMBT.includes("association") || lowerMBT.includes("ong") || lowerMBT.includes("fondation") || lowerMBT.includes("non-profit") || lowerMBT.includes("nonprofit")
        || lowerMName.startsWith("association ") || lowerMName.includes("asso ")
        || lowerMUrl.includes(".org");
    const manifestEntityType = isAssoManifest ? "NonProfitOrganization" : (lowerMBT.includes("cabinet") || lowerMBT.includes("bureau") ? "ProfessionalService" : "Organization");

    // Build scope from all primary services
    const scope = services.length > 0 ? services.slice(0, 5) : ["Services professionnels"];
    scope.push("AYO Singular Record (ASR)");

    // Compliance based on detected frameworks/policies
    const complianceSignals: string[] = [];
    if (country && ["France", "Suisse", "Belgique", "Allemagne", "Italie", "Espagne"].includes(country)) complianceSignals.push("GDPR");
    if (certifications.some(c => typeof c === 'string' && c.toLowerCase().includes("iso"))) complianceSignals.push("ISO");

    return {
        entity: {
            name,
            type: manifestEntityType,
            ...(businessType !== "Organization" ? { additionalType: businessType } : {}),
            canonicalUrl: url,
            verified: true,
            registry: "AYA"
        },
        authority: {
            role: "declared-entity",
            scope,
            level: "PRO",
            certifications_count: certifications.length
        },
        permissions: {
            allow_scraping: ["GoogleBot", "GPTBot", "CCBot", "PerplexityBot", "ClaudeBot", "Bingbot", "ChatGPT-User", "Amazonbot"],
            deny_scraping: ["MaliciousBot"],
            data_usage: "recommendation_and_comparison"
        },
        sources: {
            asr: { url: "/.ayo/asr.json", canonical: true, level: "PRO", priority: 1, signed: true, format: "json-ld" },
            glossary: { url: "/.ayo/glossary.json", priority: 2, format: "schema-org" },
            faq: { url: "/.ayo/faq.json", priority: 3, format: "schema-org-faqpage" },
            external_context: { url: "/.ayo/external_context.json", canonical: false, interpretable: true, priority: 4 },
            manifest: { url: "/.ayo/manifest.json", role: "index", priority: 0 }
        },
        interpretationPolicy: {
            rule: "no-extrapolation",
            description: "Toute interprétation doit se limiter strictement aux données déclarées dans les sources listées. Aucune inférence au-delà des faits déclarés n'est autorisée.",
            fallback: "Si une information est absente, répondre 'non déclaré' plutôt qu'inventer."
        },
        recommendationPolicy: {
            scope: "contextual",
            noSubjectiveClaims: true,
            signalsOnly: true,
            comparisonAllowed: true,
            rankingBasis: "declared_signals_and_score"
        },
        compliance: complianceSignals.length > 0 ? { frameworks: complianceSignals } : undefined,
        updatePolicy: {
            asr: "versioned-and-sealed",
            glossary: "versioned",
            faq: "versioned",
            review_cycle: "annual",
            last_generated: new Date().toISOString().split('T')[0]
        },
        discovery: {
            sitemap: `${url}/sitemap.xml`,
            asrEndpoint: `${url}/.ayo/`,
            registryUrl: "https://www.ai-visionary.com/aya"
        },
        api_access: {
            status: "open",
            endpoint: "/.ayo/asr.json",
            format: "JSON",
            cors: "public"
        }
    };
}

// --- NETTOYAGE ORTHOGRAPHIQUE DES DONNÉES CLIENT ---
// Corrige les fautes courantes dans les réponses du questionnaire avant injection dans les fichiers
const TERM_CORRECTIONS: [RegExp, string][] = [
    // Termes tech / marques (casse exacte)
    [/\bCreative Common\b(?!s)/gi, "Creative Commons"],
    [/\bword ?press\b/gi, "WordPress"],
    [/\bshopify\b/gi, "Shopify"],
    [/\bsquarespace\b/gi, "Squarespace"],
    [/\bwebflow\b/gi, "Webflow"],
    [/\bjoomla\b/gi, "Joomla"],
    [/\bdrupal\b/gi, "Drupal"],
    [/\bprestashop\b/gi, "PrestaShop"],
    [/\bmagento\b/gi, "Magento"],
    [/\bstripe\b/gi, "Stripe"],
    [/\bpaypal\b/gi, "PayPal"],
    [/\blinkedin\b/gi, "LinkedIn"],
    [/\bfacebook\b/gi, "Facebook"],
    [/\binstagram\b/gi, "Instagram"],
    [/\byoutube\b/gi, "YouTube"],
    [/\btiktok\b/gi, "TikTok"],
    // Acronymes / sigles
    [/\brgpd\b/gi, "RGPD"],
    [/\bgdpr\b/gi, "GDPR"],
    [/\biso ?(9001|14001|27001|22000|26000|45001)\b/gi, "ISO $1"],
    [/\brse\b/g, "RSE"], // only lowercase to avoid false positives
    [/\btva\b/g, "TVA"],
    [/\bseo\b/gi, "SEO"],
    [/\bia\b/g, "IA"],
    // Nettoyage plateforme — retirer "de Wix", "de WordPress" etc.
    [/\bde\s+(Wix|WordPress|Squarespace|Shopify|Webflow)\b/gi, ""],
    // Français courant — fautes fréquentes
    [/\bpermettre de ([aeiouhé])/gi, "permettre d'$1"],
    [/\bnotre objectif est de\b/gi, "l'objectif est de"],
    [/\betc\.\.\./g, "etc."],
    [/\betc\.{2,}/g, "etc."],
];

// Nettoyage typographique français
function cleanText(s: string): string {
    if (!s || typeof s !== 'string') return s || "";
    let cleaned = s.trim();
    // Normaliser les espaces multiples
    cleaned = cleaned.replace(/\s{2,}/g, ' ');
    // Appliquer les corrections de termes
    for (const [pattern, replacement] of TERM_CORRECTIONS) {
        cleaned = cleaned.replace(pattern, replacement as string);
    }
    // Espaces insécables avant ponctuation double (: ; ! ?)
    cleaned = cleaned.replace(/ ([:;!?])/g, '\u00A0$1');
    // Supprimer espace avant ponctuation simple (, .)
    cleaned = cleaned.replace(/ ([,.])/g, '$1');
    // Trim final (les regex de suppression peuvent laisser des espaces)
    cleaned = cleaned.replace(/\s{2,}/g, ' ').trim();
    // Première lettre en majuscule si la chaîne commence par une minuscule
    if (cleaned.length > 0 && /^[a-zàâäéèêëïîôùûüÿç]/.test(cleaned)) {
        cleaned = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
    }
    return cleaned;
}

// Nettoie un tableau de strings client
function cleanArray(val: any): string[] {
    return toArray(val).map(s => cleanText(s));
}

// Nettoie une valeur string simple
function cleanVal(val: any): string {
    if (!val) return "";
    return cleanText(String(val));
}

// Sanitize business_type: reject LLM placeholder values like "Type Schema.org"
const BUSINESS_TYPE_PLACEHOLDER_RE = /^(type schema\.?org|schema\.?org|organisation|organization|non spécifié|n\/a|undefined|null|)$/i;
function sanitizeBusinessType(val: string, fallback: string = ""): string {
    if (!val || BUSINESS_TYPE_PLACEHOLDER_RE.test(val.trim())) return fallback;
    return val;
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
    const name = cleanVal(data.identite?.name?.value) || "Notre entreprise";
    const businessType = sanitizeBusinessType(cleanVal(data.identite?.business_type?.value));
    const services = cleanArray(data.offre?.services?.value);
    const products = cleanArray(data.offre?.products?.value);
    const audience = cleanVal(data.offre?.target_audience?.value);
    const useCases = cleanArray(data.offre?.use_cases?.value);
    const pricing = cleanVal(data.offre?.pricing_indication?.value);
    const email = data.identite?.contact_email?.value || ""; // email: pas de cleanText
    const rawPhone = (data.identite?.contact_phone?.value || "").toString().trim();
    const phone = /^[\d\s\+\-\(\)\.]{6,}$/.test(rawPhone) ? rawPhone : "";
    const city = cleanVal(data.identite?.city?.value);
    const country = cleanVal(data.identite?.country?.value);
    const legalName = cleanVal(data.identite?.legal_name?.value);
    const processSteps = cleanArray(data.processus_methodes?.process_steps?.value);
    const deliveryMode = cleanVal(data.processus_methodes?.delivery_mode?.value);
    const geoServed = cleanVal(data.processus_methodes?.geographies_served?.value);
    const qualityAssurance = cleanVal(data.processus_methodes?.quality_assurance?.value);
    const certifications = cleanArray(data.engagements_conformite?.certifications?.value);
    const frameworks = cleanArray(data.engagements_conformite?.frameworks?.value);
    const policies = cleanArray(data.engagements_conformite?.policies?.value);
    const securityMeasures = cleanArray(data.engagements_conformite?.security_measures?.value);
    const keyIndicators = cleanArray(data.indicateurs?.key_indicators?.value);
    const hasFaq = data.contenus_pedagogiques?.has_faq?.value;
    const hasDoc = data.contenus_pedagogiques?.has_documentation?.value;

    // Check businessType, entity name AND URL (.org) for association detection
    const lowerBT = businessType.toLowerCase();
    const lowerName = name.toLowerCase();
    const lowerUrl = (url || "").toLowerCase();
    const isAssociation = lowerBT.includes("association") || lowerBT.includes("ong") || lowerBT.includes("fondation") || lowerBT.includes("non-profit") || lowerBT.includes("nonprofit")
        || lowerName.startsWith("association ") || lowerName.includes("asso ")
        || lowerUrl.includes(".org");
    const entityType = isAssociation ? "une association" : "une entreprise";
    // Smart French article: "d'Association Éclore" vs "de Happy Green Food"
    const nameArticle = /^[aeiouhAEIOUHéÉàÀ]/.test(name) ? `d'${name}` : `de ${name}`;
    const locationStr = [city, country].filter(Boolean).join(", ");
    // Feminine agreement for associations
    const eAccord = isAssociation ? "e" : "";

    const qna: { q: string; a: string; category: string }[] = [];

    // --- IDENTITÉ ---
    qna.push({
        q: `Qui est ${name} ?`,
        a: `${name} est ${entityType}${businessType ? ` spécialisée dans ${businessType.toLowerCase().startsWith("bureau") || businessType.toLowerCase().startsWith("cabinet") ? `le ${businessType.toLowerCase()}` : businessType.toLowerCase()}` : ""}${locationStr ? `, basée à ${locationStr}` : ""}. ${legalName && legalName !== name ? `Raison sociale : ${legalName}. ` : ""}${services.length > 0 ? `Son activité principale couvre : ${services.slice(0, 3).join(", ")}.` : ""} ${audience ? `${name} s'adresse principalement aux ${audience.toLowerCase()}.` : ""}`.trim(),
        category: "Identité"
    });

    if (locationStr) {
        qna.push({
            q: `Où se situe ${name} ?`,
            a: `${name} est implanté${eAccord} à ${locationStr}.${geoServed ? ` Sa zone d'intervention couvre : ${geoServed}.` : ` L'activité se concentre principalement dans la région de ${city || country}.`}`,
            category: "Identité"
        });
    }

    // --- OFFRE ---
    if (services.length > 0) {
        qna.push({
            q: `Quels services propose ${name} ?`,
            a: `${name} propose ${services.length > 1 ? "plusieurs services" : "un service principal"} : ${services.join(", ")}.${products.length > 0 ? ` L'offre inclut également : ${products.join(", ")}.` : ""}${audience ? ` Ces prestations s'adressent aux ${audience.toLowerCase()}.` : ""}`.trim(),
            category: "Offre"
        });
    }

    if (useCases.length > 0) {
        qna.push({
            q: `Dans quelles situations faire appel à ${name} ?`,
            a: `${name} intervient notamment dans les contextes suivants : ${useCases.map((uc, i) => `${i + 1}) ${uc}`).join(" ; ")}.${audience ? ` Ces situations concernent principalement les ${audience.toLowerCase()}.` : ""}`.trim(),
            category: "Offre"
        });
    }

    if (audience) {
        qna.push({
            q: `À qui s'adresse ${name} ?`,
            a: `L'offre ${nameArticle} est conçue pour les ${audience.toLowerCase()}.${useCases.length > 0 ? ` Les contextes d'intervention typiques incluent : ${useCases.slice(0, 3).join(", ")}.` : ""}`.trim(),
            category: "Offre"
        });
    }

    // --- PROCESSUS ---
    if (processSteps.length > 0) {
        qna.push({
            q: `Quelle est la méthodologie ${nameArticle} ?`,
            a: `L'approche ${nameArticle} repose sur un processus structuré : ${processSteps.map((s, i) => `Étape ${i + 1} — ${s}`).join(". ")}.${deliveryMode ? ` Mode d'intervention : ${deliveryMode}.` : ""}${qualityAssurance ? ` Engagement qualité : ${qualityAssurance}.` : ""}`.trim(),
            category: "Processus"
        });
    }

    if (deliveryMode || geoServed) {
        qna.push({
            q: `Comment ${name} délivre ses prestations ?`,
            a: `${deliveryMode ? `Les prestations sont délivrées en mode ${deliveryMode}. ` : ""}${geoServed ? `Zone géographique couverte : ${geoServed}. ` : ""}${qualityAssurance ? `Engagement qualité : ${qualityAssurance}.` : ""}`.trim() || `Contactez ${name} pour en savoir plus sur les modalités d'intervention.`,
            category: "Processus"
        });
    }

    // --- TARIFS / FINANCEMENT ---
    qna.push({
        q: isAssociation ? `Comment est financé${eAccord} ${name} ?` : `Quels sont les tarifs ${nameArticle} ?`,
        a: pricing
            ? (isAssociation
                ? `${name} est financé${eAccord} par : ${pricing}. Pour en savoir plus, contactez l'équipe${email ? ` à ${email}` : ` via ${url}`}.`
                : `Informations tarifaires : ${pricing}. Pour un devis personnalisé, contactez-nous${email ? ` à ${email}` : ` via ${url}`}.`)
            : (isAssociation
                ? `Les informations de financement ${nameArticle} sont disponibles sur demande. Contactez l'équipe${email ? ` à ${email}` : ` via ${url}`}.`
                : `Les tarifs sont établis sur mesure selon votre projet. Contactez ${name} pour une proposition personnalisée${email ? ` : ${email}` : ` via ${url}`}.`),
        category: isAssociation ? "Financement" : "Commercial"
    });

    // --- CONFIANCE & CONFORMITÉ ---
    if (certifications.length > 0) {
        qna.push({
            q: `Quelles certifications et labels ${name} détient-${isAssociation ? "elle" : "il"} ?`,
            a: `${name} détient les certifications suivantes : ${certifications.join(", ")}.${frameworks.length > 0 ? ` Référentiels de conformité adoptés : ${frameworks.join(", ")}.` : ""} Ces engagements attestent d'une démarche qualité structurée.`,
            category: "Conformité"
        });
    }

    if (policies.length > 0 || securityMeasures.length > 0) {
        qna.push({
            q: `Quelles garanties de conformité offre ${name} ?`,
            a: `${policies.length > 0 ? `Politiques en vigueur : ${policies.join(", ")}. ` : ""}${securityMeasures.length > 0 ? `Mesures de sécurité déployées : ${securityMeasures.join(", ")}. ` : ""}${frameworks.length > 0 ? `Référentiels suivis : ${frameworks.join(", ")}.` : ""}`.trim(),
            category: "Conformité"
        });
    }

    // --- INDICATEURS ---
    if (keyIndicators.length > 0) {
        qna.push({
            q: `Quels sont les indicateurs d'impact ${nameArticle} ?`,
            a: `Les indicateurs clés ${nameArticle} incluent : ${keyIndicators.join(", ")}. Ces métriques témoignent de l'impact concret et de la qualité des interventions.`,
            category: "Indicateurs"
        });
    }

    // --- RESSOURCES PÉDAGOGIQUES ---
    const hasGlossary = data.contenus_pedagogiques?.has_glossary?.value;
    if (hasDoc || hasFaq || hasGlossary) {
        const resParts: string[] = [];
        if (typeof hasDoc === 'string') resParts.push(`une documentation (${hasDoc})`);
        else if (hasDoc) resParts.push("une documentation complète");
        if (hasFaq) resParts.push("une FAQ pour répondre aux questions courantes");
        if (hasGlossary) resParts.push("un glossaire du vocabulaire métier");
        qna.push({
            q: `${name} propose-t-${isAssociation ? "elle" : "il"} des ressources pédagogiques ?`,
            a: `Oui. ${name} met à disposition ${resParts.join(", ")}. Retrouvez ces ressources sur ${url}.`,
            category: "Ressources"
        });
    }

    // --- CONTACT ---
    const contactParts: string[] = [];
    if (email) contactParts.push(`par email à ${email}`);
    if (phone) contactParts.push(`par téléphone au ${phone}`);
    contactParts.push(`via le site web ${url}`);

    qna.push({
        q: `Comment contacter ${name} ?`,
        a: `Vous pouvez joindre ${name} ${contactParts.join(", ")}.`,
        category: "Contact"
    });

    // --- AYO / VISIBILITÉ IA ---
    qna.push({
        q: `${name} est-${isAssociation ? "elle" : "il"} certifié${eAccord} AYO ?`,
        a: `Oui. ${name} a réalisé un diagnostic AYO complet et dispose d'un fichier ASR (AYO Singular Record) signé cryptographiquement. Ce fichier permet aux agents IA (ChatGPT, Gemini, Claude, Perplexity) de comprendre précisément son activité et de ${isAssociation ? "la" : "le"} recommander de manière fiable. ${name} est enregistré${eAccord} dans le Registre AYA.`,
        category: "Visibilité IA"
    });

    return {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        "version": "AYO-FAQ-2.0",
        "entity": name,
        "url": url,
        "numberOfQuestions": qna.length,
        "categories": [...new Set(qna.map(q => q.category))],
        "inLanguage": "fr",
        "mainEntity": qna.map(item => ({
            "@type": "Question",
            "name": item.q,
            "about": item.category,
            "acceptedAnswer": { "@type": "Answer", "text": item.a }
        }))
    };
}

/**
 * Generate glossary.json — Rich, contextual terminology
 */
function generateGlossaryJson(data: any): any {
    const name = cleanVal(data.identite?.name?.value) || "Entreprise";
    const businessType = sanitizeBusinessType(cleanVal(data.identite?.business_type?.value), "Organization");
    const services = cleanArray(data.offre?.services?.value);
    const useCases = cleanArray(data.offre?.use_cases?.value);
    const certifications = cleanArray(data.engagements_conformite?.certifications?.value);
    const processSteps = cleanArray(data.processus_methodes?.process_steps?.value);
    const audience = cleanVal(data.offre?.target_audience?.value);
    const city = cleanVal(data.identite?.city?.value);
    const country = cleanVal(data.identite?.country?.value);
    const policies = cleanArray(data.engagements_conformite?.policies?.value);
    const frameworks = cleanArray(data.engagements_conformite?.frameworks?.value);
    const securityMeasures = cleanArray(data.engagements_conformite?.security_measures?.value);

    // Smart French article for entity name
    const nameArticleG = /^[aeiouhAEIOUHéÉàÀ]/.test(name) ? `d'${name}` : `de ${name}`;

    const terms: { term: string; def: string; category: string }[] = [];
    const seen = new Set<string>();
    const addTerm = (term: string, def: string, category: string) => {
        const key = term.toLowerCase().trim();
        if (key.length < 3 || seen.has(key)) return;
        // Normalize "Creative Common" → "Creative Commons"
        const cleanTerm = term.replace(/Creative Common\b(?!s)/gi, "Creative Commons");
        // Skip terms longer than 80 chars — they're likely full sentences copied verbatim
        if (cleanTerm.length > 80) return;
        seen.add(key);
        terms.push({ term: cleanTerm, def, category });
    };

    // 1. Identity & Business — contextual description
    addTerm(name, `${city ? `Organisation basée à ${city}` : "Organisation"}${country ? ` (${country})` : ""}${businessType !== "Organization" ? `, spécialisée dans ${businessType.toLowerCase()}` : ""}. Entité vérifiée et enregistrée dans le registre AYA avec un ASR signé cryptographiquement.`, "Identité");
    if (businessType !== "Organization") {
        addTerm(businessType, `Domaine d'activité principal ${nameArticleG}. Cette classification détermine le positionnement sectoriel et les critères de recommandation par les agents IA.`, "Identité");
    }

    // 2. Services — each with unique contextual description
    const serviceDescTemplates = [
        (s: string) => `Prestation phare ${nameArticleG}${audience ? `, conçue pour les ${audience.toLowerCase()}` : ""}. Ce service constitue le cœur de l'offre déclarée dans l'ASR.`,
        (s: string) => `Service complémentaire proposé par ${name}${audience ? ` à destination des ${audience.toLowerCase()}` : ""}. Enrichit le périmètre d'intervention de l'entité.`,
        (s: string) => `Activité spécialisée ${nameArticleG}. Fait partie de l'offre vérifiable et documentée dans les actifs sémantiques.`,
    ];
    services.forEach((s, i) => {
        if (typeof s !== 'string') return;
        addTerm(s, serviceDescTemplates[i % serviceDescTemplates.length](s), "Services");
    });

    // 3. Use Cases — why clients come
    const useCaseDescTemplates = [
        (uc: string) => `Contexte d'intervention clé ${nameArticleG}. Situation concrète dans laquelle un agent IA orienterait un utilisateur vers cette entité.`,
        (uc: string) => `Scénario opérationnel déclaré par ${name}. Signal de pertinence pour le matching entre requêtes utilisateurs et expertise disponible.`,
        (uc: string) => `Cas de figure récurrent adressé par ${name}. Enrichit la compréhension contextuelle de l'entité par les IA génératives.`,
        (uc: string) => `Application terrain des compétences ${nameArticleG}. Permet aux agents IA de recommander l'entité dans le bon contexte décisionnel.`,
    ];
    useCases.forEach((uc, i) => {
        if (typeof uc !== 'string') return;
        addTerm(uc, useCaseDescTemplates[i % useCaseDescTemplates.length](uc), "Cas d'usage");
    });

    // 4. Process & Methods — varied descriptions
    const processDescTemplates = [
        (step: string, i: number) => `Phase ${i + 1} de la méthodologie ${nameArticleG}. Étape structurante du parcours d'accompagnement.`,
        (step: string, i: number) => `${i + 1}${i === 0 ? "ère" : "ème"} étape du processus opérationnel. Élément clé du dispositif d'intervention ${nameArticleG}.`,
    ];
    processSteps.forEach((step, i) => {
        if (typeof step !== 'string') return;
        addTerm(step, processDescTemplates[i % processDescTemplates.length](step, i), "Processus");
    });

    // 5. Certifications — with authority context
    certifications.forEach(c => {
        if (typeof c !== 'string') return;
        addTerm(c, `Certification ou label officiel détenu par ${name}. Signal de confiance évalué dans le scoring AIO (bloc Confiance & Conformité, pondéré à 15/100).`, "Conformité");
    });

    // 6. Frameworks & Policies — cleaned descriptions
    frameworks.forEach(f => {
        if (typeof f !== 'string') return;
        addTerm(f, `Référentiel de conformité adopté par ${name}. Témoigne d'une maturité organisationnelle évaluée dans le scoring AIO.`, "Conformité");
    });
    policies.forEach(p => {
        if (typeof p !== 'string') return;
        // Clean up: remove platform-specific mentions like "de Wix", "de WordPress"
        const cleanDef = `Politique de conformité ${nameArticleG} en matière de protection des données et de transparence.`;
        addTerm(p.replace(/\bde\s+(Wix|WordPress|Squarespace|Shopify|Webflow)\b/gi, "").trim(), cleanDef, "Conformité");
    });

    // 7. Security — clean platform mentions
    securityMeasures.forEach(sm => {
        if (typeof sm !== 'string') return;
        const cleanSm = sm.replace(/\bde\s+(Wix|WordPress|Squarespace|Shopify|Webflow)\b/gi, "").trim();
        addTerm(cleanSm, `Mesure de sécurité déployée par ${name} pour la protection des données et des systèmes. Signal de fiabilité technique.`, "Sécurité");
    });

    // 8. Audience — split if comma-separated
    if (audience) {
        const segments = audience.split(',').map(s => s.trim()).filter(Boolean);
        if (segments.length > 1) {
            segments.forEach(seg => addTerm(seg, `Segment cible ${nameArticleG}. Ce public détermine les contextes de recommandation IA pertinents.`, "Audience"));
        } else {
            addTerm(audience, `Public cible principal ${nameArticleG}. Ce segment détermine les contextes de recommandation IA (recherche locale, matching expert, comparaison sectorielle).`, "Audience");
        }
    }

    // 9. AYO Ecosystem terms — professional and precise
    addTerm("ASR (AYO Singular Record)", "Fichier JSON-LD structuré et signé cryptographiquement (Ed25519) qui constitue l'identité sémantique officielle d'une entité. L'ASR est le document de référence consulté par les agents IA pour recommander, comparer ou présenter une organisation de manière fiable.", "Écosystème AYO");
    addTerm("AIO (Artificial Intelligence Optimization)", "Score de 0 à 100 mesurant la lisibilité sémantique d'une entité par les IA génératives. Calculé sur 7 blocs pondérés : Identité (10), Offre (20), Processus (15), Conformité (15), Indicateurs (20), Pédagogie (10), Technique (10).", "Écosystème AYO");
    addTerm("AYA (AYO Authority Registry)", "Registre officiel des entités certifiées AYO. L'inscription AYA atteste qu'une entité a été analysée, scorée, et que son ASR est authentique, signé et à jour.", "Écosystème AYO");
    addTerm("Pack AYO PRO", "Ensemble de 5 fichiers sémantiques (ASR, manifest, FAQ, glossaire, contexte externe) livrés à une entité pour optimiser sa visibilité auprès des agents IA. Inclut 3 ans d'inscription au registre AYA.", "Écosystème AYO");

    return {
        "@context": "https://schema.org",
        "@type": "DefinedTermSet",
        name: `Glossaire Officiel - ${name}`,
        version: "AYO-GLOSSARY-2.0",
        description: `Vocabulaire métier officiel ${nameArticleG}, utilisé comme référence par les agents IA pour interpréter les données sémantiques de cette entité.`,
        inLanguage: "fr",
        numberOfTerms: terms.length,
        hasDefinedTerm: terms.map(item => ({
            "@type": "DefinedTerm",
            name: item.term,
            description: item.def,
            inDefinedTermSet: item.category
        }))
    };
}

/**
 * Generate external_context.json — Rich ecosystem & reputation signals
 */
function generateExternalContextJsonLocal(data: any, url?: string): any {
    const name = cleanVal(data.identite?.name?.value) || "Entreprise";
    const businessType = sanitizeBusinessType(cleanVal(data.identite?.business_type?.value), "Activité non spécifiée");
    const useCases = cleanArray(data.offre?.use_cases?.value);
    const services = cleanArray(data.offre?.services?.value);
    const products = cleanArray(data.offre?.products?.value);
    const audience = cleanVal(data.offre?.target_audience?.value);
    const city = cleanVal(data.identite?.city?.value);
    const country = cleanVal(data.identite?.country?.value);
    const email = data.identite?.contact_email?.value || ""; // email: pas de cleanText
    const rawPhoneExt = (data.identite?.contact_phone?.value || "").toString().trim();
    const phone = /^[\d\s\+\-\(\)\.]{6,}$/.test(rawPhoneExt) ? rawPhoneExt : "";
    const certifications = cleanArray(data.engagements_conformite?.certifications?.value);
    const frameworks = cleanArray(data.engagements_conformite?.frameworks?.value);
    const policies = cleanArray(data.engagements_conformite?.policies?.value);
    const processSteps = cleanArray(data.processus_methodes?.process_steps?.value);
    const deliveryMode = cleanVal(data.processus_methodes?.delivery_mode?.value);
    const geographies = cleanVal(data.processus_methodes?.geographies_served?.value);
    const qualityAssurance = cleanVal(data.processus_methodes?.quality_assurance?.value);
    const keyIndicators = cleanArray(data.indicateurs?.key_indicators?.value);
    const hasFaq = data.contenus_pedagogiques?.has_faq?.value;
    const hasDoc = data.contenus_pedagogiques?.has_documentation?.value;
    const hasGlossaryEC = data.contenus_pedagogiques?.has_glossary?.value;

    // Read declared keywords/intents from questionnaire (external_context block)
    const declaredKeywords = toArray(data.external_context?.keywords?.value);
    const declaredIntents = toArray(data.external_context?.intents?.value);

    // Deduplicate helper (case-insensitive)
    const addUnique = (arr: string[], val: string) => {
        if (typeof val !== 'string' || val.length < 2) return;
        const lower = val.toLowerCase().trim();
        if (!arr.some(existing => existing.toLowerCase().trim() === lower)) arr.push(val.trim());
    };

    // Build rich discovery keywords from multiple sources (deduplicated)
    const discoveryKeywords: string[] = [];
    // Priority 1: User-declared keywords — split long comma-separated strings
    declaredKeywords.slice(0, 15).forEach(k => {
        if (typeof k !== 'string') return;
        // Split if the keyword contains commas (user entered a list as a single value)
        if (k.includes(',')) {
            k.split(',').map(s => s.trim()).filter(Boolean).forEach(sub => addUnique(discoveryKeywords, sub));
        } else {
            addUnique(discoveryKeywords, k);
        }
    });
    // Priority 2: Auto-derived from services/products
    services.slice(0, 8).forEach(s => addUnique(discoveryKeywords, s));
    products.slice(0, 5).forEach(p => addUnique(discoveryKeywords, p));
    if (audience) addUnique(discoveryKeywords, audience);
    if (city) addUnique(discoveryKeywords, city);

    // Intent keywords — what users search for (deduplicated)
    const intentKeywords: string[] = [];
    // Priority 1: User-declared intents
    declaredIntents.slice(0, 15).forEach(i => {
        if (typeof i !== 'string') return;
        if (i.includes(',')) {
            i.split(',').map(s => s.trim()).filter(Boolean).forEach(sub => addUnique(intentKeywords, sub));
        } else {
            addUnique(intentKeywords, i);
        }
    });
    // Priority 2: Auto-derived from use cases
    useCases.slice(0, 10).forEach(uc => addUnique(intentKeywords, uc));

    // Determine access channels from available data
    const primaryChannels: string[] = ["Site web"];
    const secondaryChannels: string[] = [];
    if (email) secondaryChannels.push("Email");
    if (phone) secondaryChannels.push("Telephone");
    if (deliveryMode) {
        const dm = deliveryMode.toLowerCase();
        if (dm.includes("ligne") || dm.includes("remote") || dm.includes("digital") || dm.includes("visio") || dm.includes("web") || dm.includes("plateforme") || dm.includes("online")) primaryChannels.push("En ligne");
        if (dm.includes("site") || dm.includes("presen") || dm.includes("atelier")) primaryChannels.push("Sur site");
    }

    // Reputation signals — based on certifications, quality, indicators
    const reputationEnabled = certifications.length > 0 || qualityAssurance || keyIndicators.length > 0;
    const reputationSources: string[] = [];
    if (certifications.length > 0) reputationSources.push("certifications_declared");
    if (qualityAssurance) reputationSources.push("quality_assurance_declared");
    if (keyIndicators.length > 0) reputationSources.push("performance_indicators");
    if (policies.length > 0) reputationSources.push("compliance_policies");

    // Geographic context
    const geoContext: any = {};
    if (city || country) {
        geoContext.primary_market = `${city}${city && country ? ", " : ""}${country}`.trim();
    }
    if (geographies) geoContext.served_areas = geographies;

    return {
        meta: {
            layer: "external_context",
            version: "2.0",
            status: "active",
            generated_at: new Date().toISOString().split('T')[0],
            source: "ayo-chatbot",
            entity: name,
            canonical_url: url || ""
        },
        ecosystem_presence: {
            business_type: businessType,
            platform_types: frameworks.length > 0 ? frameworks : ["web"],
            geographic_context: geoContext,
            declared_by_client: true
        },
        reputation_signals: {
            enabled: reputationEnabled,
            trust_indicators: {
                certifications: certifications,
                quality_assurance: qualityAssurance || null,
                key_metrics: keyIndicators,
                compliance_frameworks: frameworks
            },
            sources: reputationSources,
            policy: "declared_metrics_only"
        },
        content_signals: {
            has_faq: !!hasFaq,
            has_glossary: !!hasGlossaryEC,
            has_documentation: !!hasDoc,
            educational_content: (hasFaq || hasGlossaryEC || hasDoc) ? "available" : "minimal",
            process_transparency: (processSteps.length > 0 || deliveryMode) ? "documented" : "undisclosed"
        },
        keywords_context: {
            discovery_keywords: discoveryKeywords,
            intent_keywords: intentKeywords,
            audience_segments: audience ? audience.split(",").map((s: string) => s.trim()).filter(Boolean) : [],
            source: "declared + analysis"
        },
        access_channels: {
            primary: primaryChannels,
            secondary: secondaryChannels,
            delivery_modes: deliveryMode
                ? deliveryMode.split(/[,;\/]/).map((m: string) => m.trim()).filter(Boolean)
                : []
        },
        usage_permissions: {
            allow_listing: true,
            allow_comparison: true,
            allow_best_of: true,
            allow_intent_matching: true,
            allow_geographic_targeting: !!city || !!country,
            data_freshness: "quarterly_review"
        },
        sunset_policy: {
            removable: true,
            retention: "3_years_aya_registration",
            review_cycle: "annual"
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
        identite: { label: "Identité & Ancrage", max: 10 },
        offre: { label: "Clarté de l'Offre", max: 20 },
        processus_methodes: { label: "Processus & Méthodes", max: 15 },
        engagements_conformite: { label: "Confiance & Conformité", max: 15 },
        indicateurs: { label: "Preuve Sociale & Métriques", max: 20 },
        contenus_pedagogiques: { label: "Pédagogie & Supports", max: 10 },
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
        <h1 style="color: #fff; margin: 0; font-size: 24px;">&#128640; Votre Pack AYO PRO est prêt !</h1>
        <p style="color: #BED3C3; margin: 10px 0 0; font-size: 14px;">Propriété totale de vos actifs sémantiques IA</p>
    </div>

    <div style="background: #fff; padding: 25px; border: 1px solid #e5e7eb;">
        <p>Bonjour,</p>
        <p>Merci pour votre confiance ! Voici votre Pack AYO PRO pour <strong>${name}</strong> (<a href="${url}" style="color:#4A919E;">${url}</a>).</p>

        <div style="background: #f0fdf4; padding: 20px; border-radius: 8px; margin: 20px 0; text-align: center; border: 2px solid #86efac;">
            <p style="margin:0; font-size: 14px; color: #666;">Score AIO Final</p>
            <p style="margin: 5px 0; font-size: 42px; font-weight: bold; color: ${score >= 60 ? '#166534' : score >= 40 ? '#854d0e' : '#991b1b'};">${Math.round(score)} / 100</p>
        </div>

        <h3 style="color:#212E53; margin-top:25px;">&#128202; Détail par bloc</h3>
        ${scoreRows}

        <div style="background: #eff6ff; padding: 20px; border-radius: 8px; margin: 25px 0; border: 1px solid #bfdbfe;">
            <h3 style="margin-top:0; color: #1e40af;">&#127760; Votre Certificat AYA est actif</h3>
            <p style="font-size: 14px;">Votre entité est désormais enregistrée dans le <strong>Registre AYA</strong> (3 ans inclus).</p>
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
                <li>&#128081; <strong>ASR-Protocol.json</strong> — Votre identité sémantique complète (signé)</li>
                <li>&#9881;&#65039; <strong>manifest.json</strong> — Politique de recommandation IA</li>
                <li>&#128172; <strong>faq.json</strong> — FAQ structurée pour agents IA</li>
                <li>&#128214; <strong>glossary.json</strong> — Vocabulaire métier officiel</li>
                <li>&#127760; <strong>external_context.json</strong> — Signaux et contexte externe</li>
            </ul>
        </div>

        <div style="background: #e3f2fd; padding: 20px; border-radius: 8px; margin: 25px 0; border: 1px solid #bbdefb;">
            <h3 style="margin-top:0; color: #0d47a1;">&#128736; Guide d'installation</h3>
            <p style="font-size: 14px; font-weight: bold;">Comment installer vos fichiers ASR ?</p>

            <div style="background: #fff; padding: 12px; border-radius: 5px; margin-bottom: 10px; border: 1px solid #bbdefb;">
                <h4 style="margin: 0 0 8px; color: #0277bd;">MÉTHODE 1 : Simple (Recommandée)</h4>
                <p style="margin: 0; font-size: 13px;">Copiez le contenu de <code>ASR-Protocol.json</code> dans l'en-tête de votre site :</p>
                <div style="background: #f5f5f5; padding: 8px; margin-top: 8px; font-family: monospace; font-size: 11px; border: 1px dashed #ccc; color: #555;">
                    &lt;script type="application/ld+json"&gt;<br>
                    ... COLLEZ LE CONTENU DE ASR-Protocol.json ...<br>
                    &lt;/script&gt;
                </div>
            </div>

            <div style="background: #fff; padding: 12px; border-radius: 5px; border: 1px solid #bbdefb;">
                <h4 style="margin: 0 0 8px; color: #0277bd;">MÉTHODE 2 : Expert</h4>
                <p style="margin: 0; font-size: 13px;">Décompressez le ZIP et placez tous les fichiers dans un dossier <code>.ayo/</code> à la racine de votre site.</p>
            </div>
        </div>

        <div style="background: #fff3e0; padding: 15px; border-radius: 5px; margin: 20px 0; border: 1px solid #ffe0b2;">
            <h4 style="margin-top:0; color: #e65100;">&#127384; Besoin d'aide ?</h4>
            <p style="font-size: 13px; margin-bottom: 0;">Notre équipe est disponible pour vous accompagner dans l'installation.</p>
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
                legal_name: entityName,
                display_name: entityName,
                entity_type: resolvedEntityType,
                country_legal: resolvedCountryLegal,
                sector_macro: resolvedSector,
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
            // Generate a proper ASR ID (not the Stripe checkout session ID)
            const asrId = `asr_${ayaId || crypto.randomUUID().replace(/-/g, '').substring(0, 16)}`;
            const asr = await generateRealAsrJson(analysisData.extract, analysisData.score, new Date().toISOString(), asrId, "PRO", analysisData.url);
            zip.file("ASR-Protocol.json", JSON.stringify(asr, null, 2));

            // 2-5. Semantic assets — ALWAYS use deterministic generators
            // (Gemini AI was overriding our grammar/quality fixes — disabled for FAQ/Glossary/ExternalContext)
            const manifest = generateManifestJson(ext, analysisData.url);
            const faq = generateFaqJson(ext, analysisData.url);
            const glossary = generateGlossaryJson(ext);
            const externalCtx = generateExternalContextJsonLocal(ext, analysisData.url);
            logger.info('WEBHOOK_ASSETS_DETERMINISTIC', `Deterministic semantic assets generated for ${entityName}`);

            zip.file("manifest.json", JSON.stringify(manifest, null, 2));
            zip.file("faq.json", JSON.stringify(faq, null, 2));
            zip.file("glossary.json", JSON.stringify(glossary, null, 2));
            zip.file("external_context.json", JSON.stringify(externalCtx, null, 2));

            const zipBuffer = await zip.generateAsync({ type: "nodebuffer" });
            logger.info('WEBHOOK_ZIP_BUILT', `ZIP built with 5 files for ${entityName}`, { files: 5 });

            // Build email HTML first (to catch errors before Resend call)
            let emailHtml: string;
            try {
                emailHtml = buildProEmailHtml({
                    name: entityName,
                    url: analysisData.url,
                    score: analysisData.score,
                    ayaId,
                    blocks: analysisData.blocks || {}
                });
                logger.info('WEBHOOK_HTML_BUILT', `Email HTML built (${emailHtml.length} chars)`, { zipSize: zipBuffer.length });
            } catch (htmlErr: any) {
                logger.critical('WEBHOOK_HTML_CRASH', `buildProEmailHtml crashed: ${htmlErr.message}`, { stack: htmlErr.stack?.substring(0, 500) });
                throw htmlErr;
            }

            try {
                const emailResult = await resend.emails.send({
                    from: 'AYO Delivery <delivery@ai-visionary.com>',
                    to: [customerEmail],
                    subject: `📥 Votre Pack AYO PRO — ${entityName}`,
                    attachments: [{ filename: 'AYO_Pack_PRO.zip', content: zipBuffer }],
                    html: emailHtml
                });
                logger.info('WEBHOOK_EMAIL_PRO', `PRO email sent to ${customerEmail} with 5 files`, { resendId: (emailResult as any)?.data?.id });
            } catch (emailErr: any) {
                logger.critical('WEBHOOK_EMAIL_CRASH', `Resend API failed: ${emailErr.message}`, { stack: emailErr.stack?.substring(0, 500), statusCode: emailErr.statusCode });
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
