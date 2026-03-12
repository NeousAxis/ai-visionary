#!/usr/bin/env npx tsx
/**
 * Script de test qualité pour les générateurs AYO
 * Vérifie : ASR, FAQ, Glossary, Manifest, External Context
 * Usage: npx tsx scripts/test-ayo-generators.ts
 */

// Force module scope to avoid TS duplicate declaration errors
export {};

// ============================================================
// UTILITAIRES (copiés de route.ts pour isolation de test)
// ============================================================

function toArray(val: any): string[] {
    if (!val) return [];
    if (Array.isArray(val)) return val;
    if (typeof val === 'string') return val.split(',').map(s => s.trim()).filter(Boolean);
    return [];
}

const TERM_CORRECTIONS: [RegExp, string][] = [
    [/\bCreative Common\b(?!s)/gi, "Creative Commons"],
    [/\bword ?press\b/gi, "WordPress"], [/\bshopify\b/gi, "Shopify"],
    [/\bsquarespace\b/gi, "Squarespace"], [/\bwebflow\b/gi, "Webflow"],
    [/\bjoomla\b/gi, "Joomla"], [/\bdrupal\b/gi, "Drupal"],
    [/\bprestashop\b/gi, "PrestaShop"], [/\bmagento\b/gi, "Magento"],
    [/\bstripe\b/gi, "Stripe"], [/\bpaypal\b/gi, "PayPal"],
    [/\blinkedin\b/gi, "LinkedIn"], [/\bfacebook\b/gi, "Facebook"],
    [/\binstagram\b/gi, "Instagram"], [/\byoutube\b/gi, "YouTube"],
    [/\btiktok\b/gi, "TikTok"],
    [/\brgpd\b/gi, "RGPD"], [/\bgdpr\b/gi, "GDPR"],
    [/\biso ?(9001|14001|27001|22000|26000|45001)\b/gi, "ISO $1"],
    [/\brse\b/g, "RSE"], [/\btva\b/g, "TVA"], [/\bseo\b/gi, "SEO"],
    [/\bia\b/g, "IA"],
    [/\bde\s+(Wix|WordPress|Squarespace|Shopify|Webflow)\b/gi, ""],
    [/\bpermettre de ([aeiouhé])/gi, "permettre d'$1"],
    [/\bnotre objectif est de\b/gi, "l'objectif est de"],
    [/\betc\.\.\./g, "etc."], [/\betc\.{2,}/g, "etc."],
];

function cleanText(s: string): string {
    if (!s || typeof s !== 'string') return s || "";
    let cleaned = s.trim().replace(/\s{2,}/g, ' ');
    for (const [pattern, replacement] of TERM_CORRECTIONS) {
        cleaned = cleaned.replace(pattern, replacement as string);
    }
    cleaned = cleaned.replace(/ ([:;!?])/g, '\u00A0$1');
    cleaned = cleaned.replace(/ ([,.])/g, '$1');
    cleaned = cleaned.replace(/\s{2,}/g, ' ').trim();
    if (cleaned.length > 0 && /^[a-zàâäéèêëïîôùûüÿç]/.test(cleaned)) {
        cleaned = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
    }
    return cleaned;
}

function cleanArray(val: any): string[] {
    return toArray(val).map(s => cleanText(s));
}

function cleanVal(val: any): string {
    if (!val) return "";
    return cleanText(String(val));
}

const BUSINESS_TYPE_PLACEHOLDER_RE = /^(type schema\.?org|schema\.?org|organisation|organization|non spécifié|n\/a|undefined|null|)$/i;
function sanitizeBusinessType(val: string, fallback: string = ""): string {
    if (!val || BUSINESS_TYPE_PLACEHOLDER_RE.test(val.trim())) return fallback;
    return val;
}

// ============================================================
// GÉNÉRATEURS (importés dynamiquement depuis route.ts via copy)
// On les copie ici pour pouvoir les tester en isolation
// ============================================================

function generateManifestJson(data: any, url: string): any {
    const name = cleanVal(data.identite?.name?.value) || "Entreprise";
    const businessType = sanitizeBusinessType(cleanVal(data.identite?.business_type?.value), "Organization");
    const services = cleanArray(data.offre?.services?.value);
    const certifications = cleanArray(data.engagements_conformite?.certifications?.value);
    const country = cleanVal(data.identite?.country?.value);

    const lowerMBT = businessType.toLowerCase();
    const lowerMName = name.toLowerCase();
    const lowerMUrl = (url || "").toLowerCase();
    const isAssoManifest = lowerMBT.includes("association") || lowerMBT.includes("ong") || lowerMBT.includes("fondation") || lowerMBT.includes("non-profit") || lowerMBT.includes("nonprofit")
        || lowerMName.startsWith("association ") || lowerMName.includes("asso ")
        || lowerMUrl.includes(".org");
    const manifestEntityType = isAssoManifest ? "NonProfitOrganization" : (lowerMBT.includes("cabinet") || lowerMBT.includes("bureau") ? "ProfessionalService" : "Organization");

    const scope = services.length > 0 ? services.slice(0, 5) : ["Services professionnels"];
    scope.push("AYO Singular Record (ASR)");

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
        authority: { role: "declared-entity", scope, level: "PRO", certifications_count: certifications.length },
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
        recommendationPolicy: { scope: "contextual", noSubjectiveClaims: true, signalsOnly: true, comparisonAllowed: true, rankingBasis: "declared_signals_and_score" },
        compliance: complianceSignals.length > 0 ? { frameworks: complianceSignals } : undefined,
        updatePolicy: { asr: "versioned-and-sealed", glossary: "versioned", faq: "versioned", review_cycle: "annual", last_generated: new Date().toISOString().split('T')[0] },
        discovery: { sitemap: `${url}/sitemap.xml`, asrEndpoint: `${url}/.ayo/`, registryUrl: "https://www.ai-visionary.com/aya" },
        api_access: { status: "open", endpoint: "/.ayo/asr.json", format: "JSON", cors: "public" }
    };
}

function generateFaqJson(data: any, url: string): any {
    const name = cleanVal(data.identite?.name?.value) || "Notre entreprise";
    const businessType = sanitizeBusinessType(cleanVal(data.identite?.business_type?.value));
    const services = cleanArray(data.offre?.services?.value);
    const products = cleanArray(data.offre?.products?.value);
    const audience = cleanVal(data.offre?.target_audience?.value);
    const useCases = cleanArray(data.offre?.use_cases?.value);
    const pricing = cleanVal(data.offre?.pricing_indication?.value);
    const email = data.identite?.contact_email?.value || "";
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

    const lowerBT = businessType.toLowerCase();
    const lowerName = name.toLowerCase();
    const lowerUrl = (url || "").toLowerCase();
    const isAssociation = lowerBT.includes("association") || lowerBT.includes("ong") || lowerBT.includes("fondation") || lowerBT.includes("non-profit") || lowerBT.includes("nonprofit")
        || lowerName.startsWith("association ") || lowerName.includes("asso ")
        || lowerUrl.includes(".org");
    const entityType = isAssociation ? "une association" : "une entreprise";
    const nameArticle = /^[aeiouhAEIOUHéÉàÀ]/.test(name) ? `d'${name}` : `de ${name}`;
    const locationStr = [city, country].filter(Boolean).join(", ");
    const eAccord = isAssociation ? "e" : "";

    const qna: { q: string; a: string; category: string }[] = [];

    qna.push({
        q: `Qui est ${name} ?`,
        a: `${name} est ${entityType}${businessType ? ` spécialisée dans ${businessType.toLowerCase().startsWith("bureau") || businessType.toLowerCase().startsWith("cabinet") ? `le ${businessType.toLowerCase()}` : businessType.toLowerCase()}` : ""}${locationStr ? `, basée à ${locationStr}` : ""}. ${legalName && legalName !== name ? `Raison sociale\u00A0: ${legalName}. ` : ""}${services.length > 0 ? `Son activité principale couvre\u00A0: ${services.slice(0, 3).join(", ")}.` : ""} ${audience ? `${name} s'adresse principalement aux ${audience.toLowerCase()}.` : ""}`.trim(),
        category: "Identité"
    });

    if (locationStr) {
        qna.push({
            q: `Où se situe ${name} ?`,
            a: `${name} est implanté${eAccord} à ${locationStr}.${geoServed ? ` Sa zone d'intervention couvre\u00A0: ${geoServed}.` : ` L'activité se concentre principalement dans la région de ${city || country}.`}`,
            category: "Identité"
        });
    }

    if (services.length > 0) {
        qna.push({
            q: `Quels services propose ${name} ?`,
            a: `${name} propose ${services.length > 1 ? "plusieurs services" : "un service principal"}\u00A0: ${services.join(", ")}.${products.length > 0 ? ` L'offre inclut également\u00A0: ${products.join(", ")}.` : ""}${audience ? ` Ces prestations s'adressent aux ${audience.toLowerCase()}.` : ""}`.trim(),
            category: "Offre"
        });
    }

    if (useCases.length > 0) {
        qna.push({
            q: `Dans quelles situations faire appel à ${name} ?`,
            a: `${name} intervient notamment dans les contextes suivants\u00A0: ${useCases.map((uc, i) => `${i + 1}) ${uc}`).join(" ; ")}.${audience ? ` Ces situations concernent principalement les ${audience.toLowerCase()}.` : ""}`.trim(),
            category: "Offre"
        });
    }

    if (audience) {
        qna.push({
            q: `À qui s'adresse ${name} ?`,
            a: `L'offre ${nameArticle} est conçue pour les ${audience.toLowerCase()}.${useCases.length > 0 ? ` Les contextes d'intervention typiques incluent\u00A0: ${useCases.slice(0, 3).join(", ")}.` : ""}`.trim(),
            category: "Offre"
        });
    }

    if (processSteps.length > 0) {
        qna.push({
            q: `Quelle est la méthodologie ${nameArticle} ?`,
            a: `L'approche ${nameArticle} repose sur un processus structuré\u00A0: ${processSteps.map((s, i) => `Étape ${i + 1} — ${s}`).join(". ")}.${deliveryMode ? ` Mode d'intervention\u00A0: ${deliveryMode}.` : ""}${qualityAssurance ? ` Engagement qualité\u00A0: ${qualityAssurance}.` : ""}`.trim(),
            category: "Processus"
        });
    }

    if (deliveryMode || geoServed) {
        qna.push({
            q: `Comment ${name} délivre ses prestations ?`,
            a: `${deliveryMode ? `Les prestations sont délivrées en mode ${deliveryMode}. ` : ""}${geoServed ? `Zone géographique couverte\u00A0: ${geoServed}. ` : ""}${qualityAssurance ? `Engagement qualité\u00A0: ${qualityAssurance}.` : ""}`.trim() || `Contactez ${name} pour en savoir plus sur les modalités d'intervention.`,
            category: "Processus"
        });
    }

    qna.push({
        q: isAssociation ? `Comment est financé${eAccord} ${name} ?` : `Quels sont les tarifs ${nameArticle} ?`,
        a: pricing
            ? (isAssociation
                ? `${name} est financé${eAccord} par\u00A0: ${pricing}. Pour en savoir plus, contactez l'équipe${email ? ` à ${email}` : ` via ${url}`}.`
                : `Informations tarifaires\u00A0: ${pricing}. Pour un devis personnalisé, contactez-nous${email ? ` à ${email}` : ` via ${url}`}.`)
            : (isAssociation
                ? `Les informations de financement ${nameArticle} sont disponibles sur demande. Contactez l'équipe${email ? ` à ${email}` : ` via ${url}`}.`
                : `Les tarifs sont établis sur mesure selon votre projet. Contactez ${name} pour une proposition personnalisée${email ? `\u00A0: ${email}` : ` via ${url}`}.`),
        category: isAssociation ? "Financement" : "Commercial"
    });

    if (certifications.length > 0) {
        qna.push({
            q: `Quelles certifications et labels ${name} détient-${isAssociation ? "elle" : "il"} ?`,
            a: `${name} détient les certifications suivantes\u00A0: ${certifications.join(", ")}.${frameworks.length > 0 ? ` Référentiels de conformité adoptés\u00A0: ${frameworks.join(", ")}.` : ""} Ces engagements attestent d'une démarche qualité structurée.`,
            category: "Conformité"
        });
    }

    if (policies.length > 0 || securityMeasures.length > 0) {
        qna.push({
            q: `Quelles garanties de conformité offre ${name} ?`,
            a: `${policies.length > 0 ? `Politiques en vigueur\u00A0: ${policies.join(", ")}. ` : ""}${securityMeasures.length > 0 ? `Mesures de sécurité déployées\u00A0: ${securityMeasures.join(", ")}. ` : ""}${frameworks.length > 0 ? `Référentiels suivis\u00A0: ${frameworks.join(", ")}.` : ""}`.trim(),
            category: "Conformité"
        });
    }

    if (keyIndicators.length > 0) {
        qna.push({
            q: `Quels sont les indicateurs d'impact ${nameArticle} ?`,
            a: `Les indicateurs clés ${nameArticle} incluent\u00A0: ${keyIndicators.join(", ")}. Ces métriques témoignent de l'impact concret et de la qualité des interventions.`,
            category: "Indicateurs"
        });
    }

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

    const contactParts: string[] = [];
    if (email) contactParts.push(`par email à ${email}`);
    if (phone) contactParts.push(`par téléphone au ${phone}`);
    contactParts.push(`via le site web ${url}`);

    qna.push({
        q: `Comment contacter ${name} ?`,
        a: `Vous pouvez joindre ${name} ${contactParts.join(", ")}.`,
        category: "Contact"
    });

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

    const nameArticleG = /^[aeiouhAEIOUHéÉàÀ]/.test(name) ? `d'${name}` : `de ${name}`;

    const terms: { term: string; def: string; category: string }[] = [];
    const seen = new Set<string>();
    const addTerm = (term: string, def: string, category: string) => {
        const key = term.toLowerCase().trim();
        if (key.length < 3 || seen.has(key)) return;
        const cleanTerm = term.replace(/Creative Common\b(?!s)/gi, "Creative Commons");
        // --- FIX: Tronquer les termes trop longs (>80 chars = probablement une phrase copiée) ---
        if (cleanTerm.length > 80) return; // Skip, c'est pas un terme de glossaire
        seen.add(key);
        terms.push({ term: cleanTerm, def, category });
    };

    addTerm(name, `${city ? `Organisation basée à ${city}` : "Organisation"}${country ? ` (${country})` : ""}${businessType !== "Organization" ? `, spécialisée dans ${businessType.toLowerCase()}` : ""}. Entité vérifiée et enregistrée dans le registre AYA avec un ASR signé cryptographiquement.`, "Identité");
    if (businessType !== "Organization") {
        addTerm(businessType, `Domaine d'activité principal ${nameArticleG}. Cette classification détermine le positionnement sectoriel et les critères de recommandation par les agents IA.`, "Identité");
    }

    const serviceDescTemplates = [
        (s: string) => `Prestation phare ${nameArticleG}${audience ? `, conçue pour les ${audience.toLowerCase()}` : ""}. Ce service constitue le cœur de l'offre déclarée dans l'ASR.`,
        (s: string) => `Service complémentaire proposé par ${name}${audience ? ` à destination des ${audience.toLowerCase()}` : ""}. Enrichit le périmètre d'intervention de l'entité.`,
        (s: string) => `Activité spécialisée ${nameArticleG}. Fait partie de l'offre vérifiable et documentée dans les actifs sémantiques.`,
    ];
    services.forEach((s, i) => {
        if (typeof s !== 'string') return;
        addTerm(s, serviceDescTemplates[i % serviceDescTemplates.length](s), "Services");
    });

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

    const processDescTemplates = [
        (step: string, i: number) => `Phase ${i + 1} de la méthodologie ${nameArticleG}. Étape structurante du parcours d'accompagnement.`,
        (step: string, i: number) => `${i + 1}${i === 0 ? "ère" : "ème"} étape du processus opérationnel. Élément clé du dispositif d'intervention ${nameArticleG}.`,
    ];
    processSteps.forEach((step, i) => {
        if (typeof step !== 'string') return;
        addTerm(step, processDescTemplates[i % processDescTemplates.length](step, i), "Processus");
    });

    certifications.forEach(c => {
        if (typeof c !== 'string') return;
        addTerm(c, `Certification ou label officiel détenu par ${name}. Signal de confiance évalué dans le scoring AIO (bloc Confiance & Conformité, pondéré à 15/100).`, "Conformité");
    });

    frameworks.forEach(f => {
        if (typeof f !== 'string') return;
        addTerm(f, `Référentiel de conformité adopté par ${name}. Témoigne d'une maturité organisationnelle évaluée dans le scoring AIO.`, "Conformité");
    });
    policies.forEach(p => {
        if (typeof p !== 'string') return;
        const cleanDef = `Politique de conformité ${nameArticleG} en matière de protection des données et de transparence.`;
        addTerm(p.replace(/\bde\s+(Wix|WordPress|Squarespace|Shopify|Webflow)\b/gi, "").trim(), cleanDef, "Conformité");
    });

    securityMeasures.forEach(sm => {
        if (typeof sm !== 'string') return;
        const cleanSm = sm.replace(/\bde\s+(Wix|WordPress|Squarespace|Shopify|Webflow)\b/gi, "").trim();
        addTerm(cleanSm, `Mesure de sécurité déployée par ${name} pour la protection des données et des systèmes. Signal de fiabilité technique.`, "Sécurité");
    });

    if (audience) {
        const segments = audience.split(',').map(s => s.trim()).filter(Boolean);
        if (segments.length > 1) {
            segments.forEach(seg => addTerm(seg, `Segment cible ${nameArticleG}. Ce public détermine les contextes de recommandation IA pertinents.`, "Audience"));
        } else {
            addTerm(audience, `Public cible principal ${nameArticleG}. Ce segment détermine les contextes de recommandation IA (recherche locale, matching expert, comparaison sectorielle).`, "Audience");
        }
    }

    addTerm("ASR (AYO Singular Record)", "Fichier JSON-LD structuré et signé cryptographiquement (Ed25519) qui constitue l'identité sémantique officielle d'une entité. L'ASR est le document de référence consulté par les agents IA pour recommander, comparer ou présenter une organisation de manière fiable.", "Écosystème AYO");
    addTerm("AIO (Artificial Intelligence Optimization)", "Score de 0 à 100 mesurant la lisibilité sémantique d'une entité par les IA génératives. Calculé sur 7 blocs pondérés\u00A0: Identité (10), Offre (20), Processus (15), Conformité (15), Indicateurs (20), Pédagogie (10), Technique (10).", "Écosystème AYO");
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

function generateExternalContextJsonLocal(data: any, url?: string): any {
    const name = cleanVal(data.identite?.name?.value) || "Entreprise";
    const businessType = sanitizeBusinessType(cleanVal(data.identite?.business_type?.value), "Activité non spécifiée");
    const useCases = cleanArray(data.offre?.use_cases?.value);
    const services = cleanArray(data.offre?.services?.value);
    const products = cleanArray(data.offre?.products?.value);
    const audience = cleanVal(data.offre?.target_audience?.value);
    const city = cleanVal(data.identite?.city?.value);
    const country = cleanVal(data.identite?.country?.value);
    const email = data.identite?.contact_email?.value || "";
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

    const declaredKeywords = toArray(data.external_context?.keywords?.value);
    const declaredIntents = toArray(data.external_context?.intents?.value);

    const addUnique = (arr: string[], val: string) => {
        if (typeof val !== 'string' || val.length < 2) return;
        const lower = val.toLowerCase().trim();
        if (!arr.some(existing => existing.toLowerCase().trim() === lower)) arr.push(val.trim());
    };

    const discoveryKeywords: string[] = [];
    declaredKeywords.slice(0, 15).forEach(k => {
        if (typeof k !== 'string') return;
        if (k.includes(',')) {
            k.split(',').map(s => s.trim()).filter(Boolean).forEach(sub => addUnique(discoveryKeywords, sub));
        } else {
            addUnique(discoveryKeywords, k);
        }
    });
    services.slice(0, 8).forEach(s => addUnique(discoveryKeywords, s));
    products.slice(0, 5).forEach(p => addUnique(discoveryKeywords, p));
    if (audience) addUnique(discoveryKeywords, audience);
    if (city) addUnique(discoveryKeywords, city);

    const intentKeywords: string[] = [];
    declaredIntents.slice(0, 15).forEach(i => {
        if (typeof i !== 'string') return;
        if (i.includes(',')) {
            i.split(',').map(s => s.trim()).filter(Boolean).forEach(sub => addUnique(intentKeywords, sub));
        } else {
            addUnique(intentKeywords, i);
        }
    });
    useCases.slice(0, 10).forEach(uc => addUnique(intentKeywords, uc));

    const primaryChannels: string[] = ["Site web"];
    const secondaryChannels: string[] = [];
    if (email) secondaryChannels.push("Email");
    if (phone) secondaryChannels.push("Telephone");
    if (deliveryMode) {
        const dm = deliveryMode.toLowerCase();
        if (dm.includes("ligne") || dm.includes("remote") || dm.includes("digital") || dm.includes("visio") || dm.includes("web") || dm.includes("plateforme") || dm.includes("online")) primaryChannels.push("En ligne");
        if (dm.includes("site") || dm.includes("presen") || dm.includes("atelier")) primaryChannels.push("Sur site");
    }

    const reputationEnabled = certifications.length > 0 || !!qualityAssurance || keyIndicators.length > 0;
    const reputationSources: string[] = [];
    if (certifications.length > 0) reputationSources.push("certifications_declared");
    if (qualityAssurance) reputationSources.push("quality_assurance_declared");
    if (keyIndicators.length > 0) reputationSources.push("performance_indicators");
    if (policies.length > 0) reputationSources.push("compliance_policies");

    const geoContext: any = {};
    if (city || country) {
        geoContext.primary_market = `${city}${city && country ? ", " : ""}${country}`.trim();
    }
    if (geographies) geoContext.served_areas = geographies;

    return {
        meta: {
            layer: "external_context", version: "2.0", status: "active",
            generated_at: new Date().toISOString().split('T')[0],
            source: "ayo-chatbot", entity: name, canonical_url: url || ""
        },
        ecosystem_presence: {
            business_type: businessType,
            platform_types: frameworks.length > 0 ? frameworks : ["web"],
            geographic_context: geoContext,
            declared_by_client: true
        },
        reputation_signals: {
            enabled: reputationEnabled,
            trust_indicators: { certifications, quality_assurance: qualityAssurance || null, key_metrics: keyIndicators, compliance_frameworks: frameworks },
            sources: reputationSources,
            policy: "declared_metrics_only"
        },
        content_signals: {
            has_faq: !!hasFaq, has_glossary: !!hasGlossaryEC, has_documentation: !!hasDoc,
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
            primary: primaryChannels, secondary: secondaryChannels,
            delivery_modes: deliveryMode ? deliveryMode.split(/[,;\/]/).map((m: string) => m.trim()).filter(Boolean) : []
        },
        usage_permissions: {
            allow_listing: true, allow_comparison: true, allow_best_of: true,
            allow_intent_matching: true, allow_geographic_targeting: !!city || !!country,
            data_freshness: "quarterly_review"
        },
        sunset_policy: { removable: true, retention: "3_years_aya_registration", review_cycle: "annual" }
    };
}

// ASR generator (simplified - no crypto signing for test)
function generateTestAsrJson(data: any, score: number, url: string): any {
    const PLACEHOLDER_PATTERNS = /^(type schema\.?org|schema\.?org|organisation|organization|non spécifié|n\/a|undefined|null|)$/i;
    const rawBusinessType = cleanVal(data.identite?.business_type?.value);
    const businessType = (rawBusinessType && !PLACEHOLDER_PATTERNS.test(rawBusinessType.trim())) ? rawBusinessType : "Organization";

    const lowerBT = businessType.toLowerCase();
    const lowerEntityName = (data.identite?.name?.value || "").toLowerCase();
    const lowerEntityUrl = (url || "").toLowerCase();
    const isAssociationType = lowerBT.includes("association") || lowerBT.includes("ong") || lowerBT.includes("fondation") || lowerBT.includes("non-profit") || lowerBT.includes("nonprofit")
        || lowerEntityName.startsWith("association ") || lowerEntityName.includes("asso ")
        || lowerEntityUrl.includes(".org");
    const schemaType = isAssociationType ? "NonProfitOrganization" : (lowerBT.includes("cabinet") || lowerBT.includes("bureau") ? "ProfessionalService" : "Organization");

    const entityName = cleanVal(data.identite?.name?.value) || "Entreprise Inconnue";
    const entityDescription = cleanVal(data.identite?.description?.value) || cleanVal(data.offre?.description?.value);

    const identity: any = { "@type": schemaType, "name": entityName };
    if (businessType !== "Organization") {
        identity.additionalType = businessType;
    }
    if (url) identity.url = url;
    if (entityDescription) identity.description = entityDescription;
    if (businessType !== "Organization") identity.industry = businessType;

    // pricingLevel logic
    const pricingRaw = cleanVal(data.offre?.pricing_indication?.value);
    const rawPricingLevel = (data.contextual_signals?.pricing_level?.value || "").toString().trim();
    const isValidPricingLevel = rawPricingLevel
        && !rawPricingLevel.toLowerCase().includes("undisclosed")
        && !rawPricingLevel.includes("/")
        && !PLACEHOLDER_PATTERNS.test(rawPricingLevel)
        && rawPricingLevel.length < 40;
    const pricingLevel = isValidPricingLevel
        ? rawPricingLevel
        : (pricingRaw ? (isAssociationType ? "subventioned_and_services" : "disclosed") : "on_request");

    // access logic
    const rawAccess = (data.contextual_signals?.access_mode?.value || "").toString().trim();
    const validAccessValues = ["public", "private", "membersOnly", "restricted", "freemium"];
    const access = validAccessValues.includes(rawAccess) ? rawAccess : "public";

    // contextualRelevance filter
    const rawCtxRelevance = Array.isArray(data.recommandation?.contextual_relevance?.value)
        ? data.recommandation.contextual_relevance.value
        : [];
    const contextualRelevance = rawCtxRelevance
        .filter((cr: any) => {
            if (!cr || typeof cr !== 'object') return false;
            const intent = (cr.userIntent || "").toLowerCase();
            const status = (cr.status || "").toLowerCase();
            if (intent.includes("ex:") || intent.includes("exemple") || intent.includes("recherche salle sport")) return false;
            if (status.includes("/") || status === "eligible/uncertain") return false;
            if (!cr.userIntent || cr.userIntent.length < 5) return false;
            return true;
        })
        .map((cr: any) => ({
            ...cr,
            status: (cr.status && !cr.status.includes("/")) ? cr.status : "eligible"
        }));

    return {
        "@context": "https://ai-visionary.com/contexts/aio-v3.jsonld",
        "type": "AYO_Singular_Record",
        "meta": { "aio_score": Math.round(score), "version": "3.0-PRO", "tier": "PRO" },
        "identity": identity,
        "offer": {
            services: cleanArray(data.offre?.services?.value),
            products: cleanArray(data.offre?.products?.value),
            use_cases: cleanArray(data.offre?.use_cases?.value),
            audience: cleanVal(data.offre?.target_audience?.value) || "Général",
            pricingIndication: cleanVal(data.offre?.pricing_indication?.value)
        },
        "contextualSignals": { pricingLevel, access },
        "contextualRelevance": contextualRelevance
    };
}

// ============================================================
// JEUX DE DONNÉES DE TEST
// ============================================================

const TEST_DATASETS: { name: string; data: any; url: string }[] = [
    {
        name: "Global Workflow (dev apps, minimal)",
        url: "https://www.globalworkflow.ch",
        data: {
            identite: {
                name: { value: "Global Workflow" },
                business_type: { value: "Développement d'applications mobiles innovantes" },
                city: { value: "Genève" },
                country: { value: "Suisse" },
                contact_email: { value: "info@globalworkflow.ch" },
                url: { value: "https://www.globalworkflow.ch" }
            },
            offre: {
                services: { value: ["Développement d'apps iOS/Android", "Consulting digital"] },
                products: { value: ["Applications mobiles sur mesure"] },
                target_audience: { value: "PME, startups, grandes entreprises" },
                use_cases: { value: ["Digitalisation de processus métier", "Création d'applications B2B"] },
                pricing_indication: { value: "" }
            },
            processus_methodes: {
                delivery_mode: { value: "En ligne et sur site" },
                geographies_served: { value: "Suisse Romande, France" }
            },
            engagements_conformite: {
                certifications: { value: [] },
                frameworks: { value: [] },
                policies: { value: [] },
                security_measures: { value: [] }
            },
            indicateurs: { key_indicators: { value: [] } },
            contenus_pedagogiques: { has_faq: { value: false }, has_glossary: { value: false }, has_documentation: { value: false } },
            // Simulate LLM garbage in contextual signals
            contextual_signals: {
                pricing_level: { value: "premium/standard/undisclosed" },
                access_mode: { value: "public/membersOnly" }
            },
            recommandation: {
                contextual_relevance: {
                    value: [
                        { userIntent: "Ex: recherche salle sport Genève", status: "eligible/uncertain" },
                        { userIntent: "Besoin d'une app mobile pour mon entreprise", status: "eligible" },
                        { userIntent: "", status: "eligible" }
                    ]
                }
            }
        }
    },
    {
        name: "Happy Green Food (restauration collective)",
        url: "https://www.happygreenfood.ch",
        data: {
            identite: {
                name: { value: "Happy Green Food" },
                business_type: { value: "Restauration collective durable" },
                city: { value: "Genève" },
                country: { value: "Suisse" },
                legal_name: { value: "Happy Green Food Sàrl" },
                contact_email: { value: "contact@happygreenfood.ch" },
                contact_phone: { value: "+41 22 345 67 89" },
                founding_year: { value: "2019" }
            },
            offre: {
                services: { value: ["Restauration collective bio", "Traiteur événementiel", "Conseil en alimentation durable"] },
                products: { value: ["Menus collectifs bio", "Paniers repas entreprise", "Formations nutrition"] },
                target_audience: { value: "Entreprises, collectivités, écoles, crèches" },
                use_cases: { value: ["Restauration collective pour entreprises", "Repas scolaires bio et locaux", "Événements d'entreprise écoresponsables"] },
                pricing_indication: { value: "Forfait repas à partir de 15 CHF/personne, devis sur mesure pour collectivités" }
            },
            processus_methodes: {
                process_steps: { value: ["Audit des besoins nutritionnels", "Sélection des producteurs locaux", "Élaboration des menus saisonniers", "Préparation quotidienne", "Livraison et service", "Suivi qualité et satisfaction"] },
                delivery_mode: { value: "Sur site client, livraison" },
                geographies_served: { value: "Canton de Genève et Vaud" },
                quality_assurance: { value: "Bio Suisse certifié, contrôles HACCP" }
            },
            engagements_conformite: {
                certifications: { value: ["Bio Suisse", "ISO 22000", "Fourchette Verte"] },
                frameworks: { value: ["HACCP", "Charte développement durable"] },
                policies: { value: ["Zéro déchet alimentaire", "Approvisionnement 80% local et saisonnier"] },
                security_measures: { value: ["Traçabilité complète des ingrédients", "Conformité RGPD"] }
            },
            indicateurs: { key_indicators: { value: ["98% de satisfaction client", "12 000 repas/mois", "80% fournisseurs locaux", "50 tonnes de CO2 évitées/an"] } },
            contenus_pedagogiques: { has_faq: { value: true }, has_glossary: { value: true }, has_documentation: { value: "Guide alimentation durable en collectivité" } }
        }
    },
    {
        name: "Association Éclore (association)",
        url: "https://www.eclore-asso.org",
        data: {
            identite: {
                name: { value: "Association Éclore" },
                business_type: { value: "Bureau conseil en imagination collective et prospective sociale & environnementale" },
                city: { value: "Genève" },
                country: { value: "Suisse" },
                legal_name: { value: "Association Éclore" },
                contact_email: { value: "info@eclore-asso.org" }
            },
            offre: {
                services: { value: ["Ateliers de la Transition", "Ateliers de la Coopération"] },
                products: { value: ["Ré(ge)nère app", "Livre Blanc"] },
                target_audience: { value: "Entreprises, Communes, Administrations, Citoyens" },
                use_cases: { value: ["Accompagnement des entreprises et des collectivités dans divers projets communaux et territoriaux"] },
                pricing_indication: { value: "Subventions publiques, Vente de prestations en Stratégie & Durabilité, Devis sur mesure pour les communes" }
            },
            processus_methodes: {
                delivery_mode: { value: "Présentiel (ateliers), Plateforme web dédiée re-GE-nère, Accompagnement hybride" },
                geographies_served: { value: "Suisse Romande" },
                quality_assurance: { value: "Reconnue d'utilité publique" }
            },
            engagements_conformite: {
                certifications: { value: ["Certifié en Stratégie & Durabilité auprès de l'IESE - Business School University Of Navarra"] },
                frameworks: { value: ["Fédération Suisse des Entreprises", "Faîtière de la Participation Citoyenne", "ASD (l'association des Spécialiste de la Durabilité)", "Réseau APRES Genève (Le réseau de l'économie Sociale et Solidaire)"] },
                policies: { value: ["Pas de cookies sur notre site", "Méthode Eclore sur la Prospective Rétrocausale est inscrite en Creative Commons"] },
                security_measures: { value: ["Travail en Creative Commons (anonymisation des données personnelles)", "Conformité RGPD (hébergement du site)", "Suppression des données personnelles après 6 mois"] }
            },
            indicateurs: { key_indicators: { value: ["Nombre de personnes touchées", "Nombre de projets menés à bien"] } },
            contenus_pedagogiques: { has_faq: { value: true }, has_glossary: { value: true }, has_documentation: { value: true } }
        }
    },
    {
        name: "Cas minimal (presque rien)",
        url: "https://www.example.com",
        data: {
            identite: {
                name: { value: "MonEntreprise" },
                business_type: { value: "Type Schema.org" }, // LLM placeholder!
                city: { value: "" },
                country: { value: "" }
            },
            offre: { services: { value: [] }, products: { value: [] } },
            processus_methodes: {},
            engagements_conformite: { certifications: { value: [] }, frameworks: { value: [] }, policies: { value: [] }, security_measures: { value: [] } },
            indicateurs: {},
            contenus_pedagogiques: {},
            contextual_signals: {
                pricing_level: { value: "Type Schema.org" },
                access_mode: { value: "Type Schema.org" }
            }
        }
    }
];

// ============================================================
// MOTEUR DE VÉRIFICATION
// ============================================================

interface TestError {
    dataset: string;
    file: string;
    field: string;
    issue: string;
    value: string;
}

const FORBIDDEN_PATTERNS = [
    /type schema\.?org/i,
    /premium\/standard\/undisclosed/i,
    /public\/membersOnly/i,
    /\bEx\s*:/,
    /eligible\/uncertain/i,
];

// These are only forbidden in specific fields (additionalType, industry, business_type)
// NOT in @type or entity.type where "Organization" is a valid Schema.org fallback
const FORBIDDEN_AS_ADDITIONAL_TYPE = [
    /^Organisation$/i,
    /^Organization$/i,
    /^Type Schema\.?org$/i,
];

const FORBIDDEN_STRINGS = [
    "Type Schema.org",
    "type schema.org",
    "premium/standard/undisclosed",
    "public/membersOnly",
    "eligible/uncertain",
    "Ex:",
    "recherche salle sport",
];

function checkValue(val: any, field: string, file: string, dataset: string, errors: TestError[]) {
    if (val === null || val === undefined) return;
    const str = typeof val === 'string' ? val : JSON.stringify(val);

    for (const pattern of FORBIDDEN_PATTERNS) {
        if (pattern.test(str)) {
            errors.push({ dataset, file, field, issue: `Contient un placeholder interdit: ${pattern}`, value: str.substring(0, 120) });
        }
    }
    for (const forbidden of FORBIDDEN_STRINGS) {
        if (str.includes(forbidden)) {
            errors.push({ dataset, file, field, issue: `Contient la chaîne interdite "${forbidden}"`, value: str.substring(0, 120) });
        }
    }
}

function deepCheck(obj: any, path: string, file: string, dataset: string, errors: TestError[]) {
    if (!obj || typeof obj !== 'object') {
        checkValue(obj, path, file, dataset, errors);
        return;
    }
    if (Array.isArray(obj)) {
        obj.forEach((item, i) => deepCheck(item, `${path}[${i}]`, file, dataset, errors));
        return;
    }
    for (const key of Object.keys(obj)) {
        deepCheck(obj[key], `${path}.${key}`, file, dataset, errors);
    }
}

function validateAsr(asr: any, dataset: string, errors: TestError[]) {
    const file = "ASR";

    // identity.additionalType ne doit JAMAIS être "Type Schema.org" ou "Organization"
    if (asr.identity?.additionalType) {
        const at = asr.identity.additionalType;
        if (/^(Type Schema\.?org|Organization|Organisation)$/i.test(at)) {
            errors.push({ dataset, file, field: "identity.additionalType", issue: `Valeur interdite: "${at}"`, value: at });
        }
    }

    // identity.industry ne doit JAMAIS être "Type Schema.org"
    if (asr.identity?.industry) {
        if (/type schema\.?org/i.test(asr.identity.industry)) {
            errors.push({ dataset, file, field: "identity.industry", issue: "Contient 'Type Schema.org'", value: asr.identity.industry });
        }
    }

    // pricingLevel doit être UNE valeur
    if (asr.contextualSignals?.pricingLevel) {
        const pl = asr.contextualSignals.pricingLevel;
        if (pl.includes("/")) {
            errors.push({ dataset, file, field: "contextualSignals.pricingLevel", issue: `Valeur composée avec '/': "${pl}"`, value: pl });
        }
        if (/undisclosed/i.test(pl)) {
            errors.push({ dataset, file, field: "contextualSignals.pricingLevel", issue: `Contient "undisclosed"`, value: pl });
        }
    }

    // access doit être UNE valeur
    if (asr.contextualSignals?.access) {
        const ac = asr.contextualSignals.access;
        if (ac.includes("/")) {
            errors.push({ dataset, file, field: "contextualSignals.access", issue: `Valeur composée avec '/': "${ac}"`, value: ac });
        }
    }

    // contextualRelevance ne doit pas contenir de templates
    if (Array.isArray(asr.contextualRelevance)) {
        asr.contextualRelevance.forEach((cr: any, i: number) => {
            if (cr?.userIntent) {
                if (/\bEx\s*:/i.test(cr.userIntent) || /recherche salle sport/i.test(cr.userIntent)) {
                    errors.push({ dataset, file, field: `contextualRelevance[${i}].userIntent`, issue: "Contient un exemple template", value: cr.userIntent });
                }
            }
            if (cr?.status && cr.status.includes("/")) {
                errors.push({ dataset, file, field: `contextualRelevance[${i}].status`, issue: `Status composé: "${cr.status}"`, value: cr.status });
            }
        });
    }

    // Deep check for any remaining forbidden patterns
    deepCheck(asr, "asr", file, dataset, errors);
}

function validateFaq(faq: any, dataset: string, errors: TestError[]) {
    const file = "FAQ";

    if (!faq.mainEntity || !Array.isArray(faq.mainEntity)) {
        errors.push({ dataset, file, field: "mainEntity", issue: "mainEntity manquant ou pas un tableau", value: "" });
        return;
    }

    faq.mainEntity.forEach((q: any, i: number) => {
        const answer = q.acceptedAnswer?.text;
        if (!answer || answer === "..." || answer.length < 10) {
            errors.push({ dataset, file, field: `mainEntity[${i}].acceptedAnswer.text`, issue: "Réponse vide ou trop courte", value: answer || "(vide)" });
        }

        // Vérifier les phrases cassées comme "spécialisée dans organization"
        if (answer && /spécialisée dans\s+organization/i.test(answer)) {
            errors.push({ dataset, file, field: `mainEntity[${i}].acceptedAnswer.text`, issue: "Phrase cassée avec 'organization'", value: answer.substring(0, 100) });
        }

        checkValue(answer, `mainEntity[${i}].acceptedAnswer.text`, file, dataset, errors);
        checkValue(q.name, `mainEntity[${i}].name`, file, dataset, errors);
    });
}

function validateGlossary(glossary: any, dataset: string, errors: TestError[]) {
    const file = "Glossary";

    if (!glossary.hasDefinedTerm || !Array.isArray(glossary.hasDefinedTerm)) {
        errors.push({ dataset, file, field: "hasDefinedTerm", issue: "hasDefinedTerm manquant ou pas un tableau", value: "" });
        return;
    }

    glossary.hasDefinedTerm.forEach((term: any, i: number) => {
        // Termes de plus de 80 caractères = suspects
        if (term.name && term.name.length > 80) {
            errors.push({ dataset, file, field: `hasDefinedTerm[${i}].name`, issue: `Terme trop long (${term.name.length} chars) — probablement une phrase copiée`, value: term.name.substring(0, 100) });
        }

        // Terme = "Type Schema.org" ou "Terme 1"
        if (/^(Type Schema\.?org|Terme \d+)$/i.test(term.name || "")) {
            errors.push({ dataset, file, field: `hasDefinedTerm[${i}].name`, issue: `Terme placeholder: "${term.name}"`, value: term.name });
        }

        checkValue(term.name, `hasDefinedTerm[${i}].name`, file, dataset, errors);
        checkValue(term.description, `hasDefinedTerm[${i}].description`, file, dataset, errors);
    });
}

function validateManifest(manifest: any, dataset: string, errors: TestError[]) {
    const file = "Manifest";

    // entity.additionalType ne doit pas être "Organization" ou "Type Schema.org"
    if (manifest.entity?.additionalType) {
        const at = manifest.entity.additionalType;
        if (/^(Organization|Organisation|Type Schema\.?org)$/i.test(at)) {
            errors.push({ dataset, file, field: "entity.additionalType", issue: `Valeur interdite: "${at}"`, value: at });
        }
    }

    // entity.name ne doit pas être vide ou "Entreprise" quand on a un vrai nom
    if (!manifest.entity?.name || manifest.entity.name === "AI Manifest Entreprise") {
        errors.push({ dataset, file, field: "entity.name", issue: "Nom d'entité générique ou manquant", value: manifest.entity?.name || "(vide)" });
    }

    deepCheck(manifest, "manifest", file, dataset, errors);
}

function validateExternalContext(ec: any, dataset: string, errors: TestError[]) {
    const file = "External Context";

    // business_type ne doit pas être "Type Schema.org"
    if (ec.ecosystem_presence?.business_type) {
        const bt = ec.ecosystem_presence.business_type;
        if (/^(Type Schema\.?org|Organization|Organisation)$/i.test(bt)) {
            errors.push({ dataset, file, field: "ecosystem_presence.business_type", issue: `Valeur interdite: "${bt}"`, value: bt });
        }
    }

    deepCheck(ec, "external_context", file, dataset, errors);
}

// ============================================================
// EXÉCUTION
// ============================================================

function runTests() {
    console.log("=".repeat(70));
    console.log("  TEST QUALITÉ GÉNÉRATEURS AYO");
    console.log("=".repeat(70));
    console.log("");

    const allErrors: TestError[] = [];
    let totalFiles = 0;

    for (const { name: dsName, data, url } of TEST_DATASETS) {
        console.log(`\n--- Dataset: ${dsName} ---`);

        // Generate all 5 files
        const asr = generateTestAsrJson(data, 65, url);
        const faq = generateFaqJson(data, url);
        const glossary = generateGlossaryJson(data);
        const manifest = generateManifestJson(data, url);
        const externalContext = generateExternalContextJsonLocal(data, url);

        totalFiles += 5;

        // Validate JSON structure
        for (const [fname, obj] of [["ASR", asr], ["FAQ", faq], ["Glossary", glossary], ["Manifest", manifest], ["ExternalContext", externalContext]] as const) {
            try {
                JSON.parse(JSON.stringify(obj));
                console.log(`  [OK] ${fname} - JSON valide`);
            } catch (e) {
                allErrors.push({ dataset: dsName, file: fname, field: "(root)", issue: "JSON invalide", value: String(e) });
                console.log(`  [FAIL] ${fname} - JSON invalide`);
            }
        }

        // Run specific validations
        const dsErrors: TestError[] = [];
        validateAsr(asr, dsName, dsErrors);
        validateFaq(faq, dsName, dsErrors);
        validateGlossary(glossary, dsName, dsErrors);
        validateManifest(manifest, dsName, dsErrors);
        validateExternalContext(externalContext, dsName, dsErrors);

        if (dsErrors.length > 0) {
            console.log(`  [FAIL] ${dsErrors.length} erreur(s) trouvée(s):`);
            dsErrors.forEach(e => {
                console.log(`    - [${e.file}] ${e.field}: ${e.issue}`);
                console.log(`      Valeur: "${e.value}"`);
            });
        } else {
            console.log(`  [PASS] Aucune erreur !`);
        }

        allErrors.push(...dsErrors);
    }

    // Cross-file consistency check
    console.log("\n--- Vérification de cohérence inter-fichiers ---");
    for (const { name: dsName, data, url } of TEST_DATASETS) {
        const faq = generateFaqJson(data, url);
        const manifest = generateManifestJson(data, url);
        const ec = generateExternalContextJsonLocal(data, url);
        const entityName = cleanVal(data.identite?.name?.value) || "Entreprise";

        // Check entity name consistency
        const faqEntity = faq.entity;
        const manifestEntity = manifest.entity?.name;
        const ecEntity = ec.meta?.entity;

        if (faqEntity !== entityName || manifestEntity !== entityName || ecEntity !== entityName) {
            allErrors.push({
                dataset: dsName,
                file: "Cross-check",
                field: "entity.name",
                issue: `Incohérence de nom: FAQ="${faqEntity}", Manifest="${manifestEntity}", EC="${ecEntity}", attendu="${entityName}"`,
                value: ""
            });
            console.log(`  [FAIL] ${dsName}: Incohérence de nom d'entité`);
        } else {
            console.log(`  [OK] ${dsName}: Nom d'entité cohérent partout`);
        }
    }

    // RÉSUMÉ
    console.log("\n" + "=".repeat(70));
    console.log(`  RÉSUMÉ: ${totalFiles} fichiers générés, ${allErrors.length} erreur(s)`);
    console.log("=".repeat(70));

    if (allErrors.length > 0) {
        console.log("\nERREURS DÉTAILLÉES:");
        allErrors.forEach((e, i) => {
            console.log(`  ${i + 1}. [${e.dataset}] [${e.file}] ${e.field}`);
            console.log(`     ${e.issue}`);
            if (e.value) console.log(`     Valeur: "${e.value}"`);
        });
        process.exit(1);
    } else {
        console.log("\nTous les tests passent !");
        process.exit(0);
    }
}

runTests();
