/**
 * AYO Pack PRO File Generators — SHARED MODULE
 *
 * Ce module contient les générateurs des 5 fichiers du Pack AYO PRO.
 * Il est utilisé par :
 *   - app/api/webhooks/checkout-success/route.ts (production, après paiement Stripe)
 *   - app/api/debug/test-ayo/route.ts (test, sans Stripe)
 *
 * Aucune copie de code : un seul module, deux consommateurs.
 */

// --- NETTOYAGE ORTHOGRAPHIQUE DES DONNÉES CLIENT ---
const TERM_CORRECTIONS: [RegExp, string][] = [
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
    [/\brgpd\b/gi, "RGPD"],
    [/\bgdpr\b/gi, "GDPR"],
    [/\biso ?(9001|14001|27001|22000|26000|45001)\b/gi, "ISO $1"],
    [/\brse\b/g, "RSE"],
    [/\btva\b/g, "TVA"],
    [/\bseo\b/gi, "SEO"],
    [/\bia\b/g, "IA"],
    [/\bde\s+(Wix|WordPress|Squarespace|Shopify|Webflow)\b/gi, ""],
    [/\bpermettre de ([aeiouhé])/gi, "permettre d'$1"],
    [/\bnotre objectif est de\b/gi, "l'objectif est de"],
    [/\betc\.\.\./g, "etc."],
    [/\betc\.{2,}/g, "etc."],
];

export function cleanText(s: string): string {
    if (!s || typeof s !== 'string') return s || "";
    let cleaned = s.trim();
    cleaned = cleaned.replace(/\s{2,}/g, ' ');
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

export function toArray(val: any): string[] {
    if (!val) return [];
    if (Array.isArray(val)) return val;
    if (typeof val === 'string') return val.split(',').map(s => s.trim()).filter(Boolean);
    return [];
}

export function cleanArray(val: any): string[] {
    return toArray(val).map(s => cleanText(s));
}

export function cleanVal(val: any): string {
    if (!val) return "";
    return cleanText(String(val));
}

const BUSINESS_TYPE_PLACEHOLDER_RE = /^(type schema\.?org|schema\.?org|organisation|organization|non spécifié|n\/a|undefined|null|)$/i;
export function sanitizeBusinessType(val: string, fallback: string = ""): string {
    if (!val || BUSINESS_TYPE_PLACEHOLDER_RE.test(val.trim())) return fallback;
    return val;
}

// --- SANITIZER: Remove ALL template/placeholder values AND confirmation phrases ---
const TEMPLATE_RE = /^(Ex:|type schema\.?org|schema\.?org|organisation|organization|premium\/standard\/undisclosed|public\/membersOnly|eligible\/uncertain|✅\/⚠️\/❌|gym near me|Centre en ville|Recherche Salle|No City Found|undisclosed|non spécifié|n\/a)$/i;
const TEMPLATE_PARTIAL_RE = /^Ex:|eligible\/uncertain|✅\/⚠️\/❌|premium\/standard|public\/members/i;

// Confirmation phrases that users say to acknowledge — NEVER valid field values
const CONFIRMATION_RE = /^(oui|ok|okay|d'accord|exact|exactement|c'est correct|oui c'est correct|oui c'est bon|c'est bon|c'est ça|parfait|tout est correct|validé|je confirme|je valide|bien reçu|noté|entendu|ça me va|ça marche|très bien|super|génial|nickel|impeccable|affirmatif|absolument|tout à fait|bien sûr|évidemment|effectivement|en effet|voilà|yep|yup|yes|yeah|sure|right|correct|confirmed|alright|got it|that's right|that's correct)[\s!.✅✓]*$/i;

export function isTemplate(val: any): boolean {
    if (typeof val !== 'string') return false;
    const trimmed = val.trim();
    if (TEMPLATE_RE.test(trimmed) || TEMPLATE_PARTIAL_RE.test(trimmed)) return true;
    // Confirmation phrases stored as field values = garbage data
    if (trimmed.length < 60 && CONFIRMATION_RE.test(trimmed)) return true;
    return false;
}

export function sanitizePayloadDeep(obj: any): any {
    if (typeof obj === 'string') return isTemplate(obj) ? '' : obj;
    if (Array.isArray(obj)) return obj.filter((item: any) => {
        if (typeof item === 'string') return !isTemplate(item);
        if (typeof item === 'object' && item !== null) {
            if (item.userIntent && isTemplate(item.userIntent)) return false;
            if (item.status && isTemplate(item.status)) return false;
            if (item.query && isTemplate(item.query)) return false;
            if (item.result && isTemplate(item.result)) return false;
        }
        return true;
    });
    if (typeof obj === 'object' && obj !== null) {
        const result: any = {};
        for (const [key, value] of Object.entries(obj)) {
            result[key] = sanitizePayloadDeep(value);
            if (key === 'value' && result[key] === '' && value !== '' && obj.q !== undefined) {
                result.q = 0;
            }
        }
        return result;
    }
    return obj;
}

/** Sanitize the full extract data — remove all template placeholders */
export function sanitizeExtract(ext: Record<string, any>): { cleaned: Record<string, any>; cleanedFields: string[] } {
    const cleanedFields: string[] = [];
    for (const blockName of Object.keys(ext)) {
        const block = ext[blockName];
        if (typeof block === 'object' && block !== null) {
            for (const fieldName of Object.keys(block)) {
                const field = block[fieldName];
                if (field && typeof field === 'object' && 'value' in field) {
                    const cleanedValue = sanitizePayloadDeep(field.value);
                    if (JSON.stringify(cleanedValue) !== JSON.stringify(field.value)) {
                        cleanedFields.push(`${blockName}.${fieldName}`);
                        field.value = cleanedValue;
                        if (cleanedValue === '' || (Array.isArray(cleanedValue) && cleanedValue.length === 0)) {
                            field.q = 0;
                        }
                    }
                }
            }
        }
    }
    return { cleaned: ext, cleanedFields };
}

// --- GENERATOR: manifest.json ---
export function generateManifestJson(data: any, url: string): any {
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

// --- GENERATOR: faq.json ---
export function generateFaqJson(data: any, url: string): any {
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

// --- GENERATOR: glossary.json ---
export function generateGlossaryJson(data: any): any {
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
        if (cleanTerm.length > 80) return;
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

// --- GENERATOR: external_context.json ---
export function generateExternalContextJsonLocal(data: any, url?: string): any {
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
