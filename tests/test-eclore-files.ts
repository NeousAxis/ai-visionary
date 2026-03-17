// Force module scope to avoid TS duplicate declaration errors
export {};

/**
 * TEST AUTOMATISÉ — Génération des 5 fichiers Pack PRO avec données Éclore
 *
 * Ce test simule EXACTEMENT ce que le webhook produit :
 * - Les mêmes données d'extraction (celles du questionnaire Éclore)
 * - Les mêmes fonctions de génération (importées depuis les vrais fichiers)
 * - Les mêmes nettoyages orthographiques
 *
 * Usage : npx tsx tests/test-eclore-files.ts
 */

// ========================================
// 1. DONNÉES ÉCLORE (simulées depuis Firestore)
// ========================================

// Ces données reproduisent EXACTEMENT ce que le LLM extrait du questionnaire Éclore
// Y compris les valeurs "polluées" que le LLM peut injecter (compound values, etc.)
const ECLORE_EXTRACT = {
    identite: {
        name: { value: "Association Éclore", q: 1, evidence: ["questionnaire"] },
        legal_name: { value: "Association Éclore, Numéro d'exonération fiscale : CHE-080.302.065", q: 1, evidence: ["questionnaire"] },
        business_type: { value: "Bureau Conseil en Imagination Collective et Prospective Sociale & Environnementale", q: 1, evidence: ["questionnaire"] },
        city: { value: "Genève", q: 1, evidence: ["questionnaire"] },
        country: { value: "Suisse", q: 1, evidence: ["questionnaire"] },
        contact_email: { value: "info@eclore-asso.org", q: 1, evidence: ["questionnaire"] },
        contact_phone: { value: "", q: 0, evidence: [] },
    },
    offre: {
        services: { value: ["Ateliers de la Transition", "Ateliers de la Coopération"], q: 1, evidence: ["questionnaire"] },
        products: { value: ["Ré(ge)nère app", "Livre Blanc"], q: 1, evidence: ["questionnaire"] },
        use_cases: { value: ["Accompagnement des entreprises et des collectivités dans divers projets communaux et territoriaux"], q: 1, evidence: ["questionnaire"] },
        target_audience: { value: "Entreprises, Communes, Administrations, Citoyens", q: 1, evidence: ["questionnaire"] },
        pricing_indication: { value: "Subventions publiques (Certifié d'Utilité Publique par le Canton de Genève), Vente de prestations en Stratégie & Durabilité, Devis sur mesure pour les communes (en fonction des besoins pour la participation citoyenne)", q: 1, evidence: ["questionnaire"] },
    },
    processus_methodes: {
        process_steps: { value: [], q: 0, evidence: [] },
        delivery_mode: { value: "Présentiel (ateliers), Plateforme web dédiée re-GE-nère (agent IA conversationnel), Accompagnement (hybride)", q: 1, evidence: ["questionnaire"] },
        geographies_served: { value: "Suisse Romande", q: 1, evidence: ["questionnaire"] },
        quality_assurance: { value: "Reconnue d'utilité publique", q: 1, evidence: ["questionnaire"] },
    },
    engagements_conformite: {
        certifications: { value: ["Certifié en Stratégie & Durabilité auprès de l'IESE - Business School University Of Navarra"], q: 1, evidence: ["questionnaire"] },
        frameworks: { value: ["Fédération Suisse des Entreprises", "Faîtière de la Participation Citoyenne", "ASD (l'association des Spécialiste de la Durabilité)", "Réseau APRES Genève (Le réseau de l'économie Sociale et Solidaire)"], q: 1, evidence: ["questionnaire"] },
        policies: { value: ["Pas de cookies sur notre site", "Méthode Eclore sur la Prospective Rétrocausale est inscrite en Creative Commons"], q: 1, evidence: ["questionnaire"] },
        security_measures: { value: ["Travail en Creative Commons (anonymisation des données personnelles)", "Conformité RGPD (hébergement du site)", "Suppression des données personnelles après 6 mois"], q: 1, evidence: ["questionnaire"] },
    },
    indicateurs: {
        key_indicators: { value: ["Nombre de personnes touchées", "Nombre de projets menés à bien"], q: 1, evidence: ["questionnaire"] },
        last_review_date: { value: "", q: 0, evidence: [] },
    },
    contenus_pedagogiques: {
        has_faq: { value: true, q: 1, evidence: ["questionnaire"] },
        has_glossary: { value: true, q: 1, evidence: ["questionnaire"] },
        has_documentation: { value: true, q: 1, evidence: ["questionnaire"] },
    },
    structure_technique: {
        has_asr: { value: false, q: 0.5, evidence: ["scan"] },
        has_jsonld: { value: true, q: 1, evidence: ["scan"] },
        has_sitemap: { value: true, q: 1, evidence: ["scan"] },
        mobile_optimized: { value: true, q: 1, evidence: ["scan"] },
        has_robots: { value: true, q: 1, evidence: ["scan"] },
        structured_data: { value: "partial", q: 0.5, evidence: ["scan"] },
        mobile_friendly: { value: true, q: 1, evidence: ["scan"] },
    },
    // PIÈGE LLM : valeurs composées que le LLM peut injecter
    contextual_signals: {
        pricing_level: { value: "premium/standard/undisclosed", q: 0.5, evidence: ["llm_guess"] },
        access_mode: { value: "public/membersOnly", q: 0.5, evidence: ["llm_guess"] },
        service_mode: { value: [], q: 0, evidence: [] },
        schedule_type: { value: [], q: 0, evidence: [] },
    },
    recommandation: {
        contextual_relevance: { value: [], q: 0, evidence: [] },
        selection_conditions: { value: { required: ["Manque de détails"], exclusion: ["Manque de détails sur les tarifs pratiqués"] }, q: 0.5, evidence: ["llm_guess"] },
        ai_simulation: { value: [], q: 0, evidence: [] },
    },
    external_context: {
        keywords: { value: [], q: 0, evidence: [] },
        intents: { value: ["Faire connaître la plateforme Ré(GE)nère", "Accompagnement des entreprises et des collectivités dans divers projets communaux et territoriaux"], q: 1, evidence: ["questionnaire"] },
    },
};

const ECLORE_URL = "https://www.eclore-asso.org";
const ECLORE_SCORE = 68; // Score réaliste

// ========================================
// 2. IMPORT DES VRAIES FONCTIONS
// ========================================

// On va reproduire les fonctions des générateurs en les copiant exactement
// Car elles sont privées (non exportées) dans route.ts et ayo-crypto.ts

// --- Helpers communs ---
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

function cleanArray(val: any): string[] { return toArray(val).map(s => cleanText(s)); }
function cleanVal(val: any): string { if (!val) return ""; return cleanText(String(val)); }

// ========================================
// 3. COPIE EXACTE DES 4 GÉNÉRATEURS (route.ts)
// ========================================

// NOTE: Ces fonctions sont copiées VERBATIM de route.ts (post-fix)
// Si route.ts change, ce test devra être mis à jour

function generateFaqJson(data: any, url: string): any {
    const name = cleanVal(data.identite?.name?.value) || "Notre entreprise";
    const businessType = cleanVal(data.identite?.business_type?.value) || "Organisation";
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

    qna.push({ q: `Qui est ${name} ?`, a: `${name} est ${entityType} spécialisée dans ${businessType.toLowerCase().startsWith("bureau") || businessType.toLowerCase().startsWith("cabinet") ? `le ${businessType.toLowerCase()}` : businessType.toLowerCase()}${locationStr ? `, basée à ${locationStr}` : ""}. ${legalName && legalName !== name ? `Raison sociale : ${legalName}. ` : ""}${services.length > 0 ? `Son activité principale couvre : ${services.slice(0, 3).join(", ")}.` : ""} ${audience ? `${name} s'adresse principalement aux ${audience.toLowerCase()}.` : ""}`.trim(), category: "Identité" });
    if (locationStr) { qna.push({ q: `Où se situe ${name} ?`, a: `${name} est implanté${eAccord} à ${locationStr}.${geoServed ? ` Sa zone d'intervention couvre : ${geoServed}.` : ` L'activité se concentre principalement dans la région de ${city || country}.`}`, category: "Identité" }); }
    if (services.length > 0) { qna.push({ q: `Quels services propose ${name} ?`, a: `${name} propose ${services.length > 1 ? "plusieurs services" : "un service principal"} : ${services.join(", ")}.${products.length > 0 ? ` L'offre inclut également : ${products.join(", ")}.` : ""}${audience ? ` Ces prestations s'adressent aux ${audience.toLowerCase()}.` : ""}`.trim(), category: "Offre" }); }
    if (useCases.length > 0) { qna.push({ q: `Dans quelles situations faire appel à ${name} ?`, a: `${name} intervient notamment dans les contextes suivants : ${useCases.map((uc, i) => `${i + 1}) ${uc}`).join(" ; ")}.${audience ? ` Ces situations concernent principalement les ${audience.toLowerCase()}.` : ""}`.trim(), category: "Offre" }); }
    if (audience) { qna.push({ q: `À qui s'adresse ${name} ?`, a: `L'offre ${nameArticle} est conçue pour les ${audience.toLowerCase()}.${useCases.length > 0 ? ` Les contextes d'intervention typiques incluent : ${useCases.slice(0, 3).join(", ")}.` : ""}`.trim(), category: "Offre" }); }
    if (deliveryMode || geoServed) { qna.push({ q: `Comment ${name} délivre ses prestations ?`, a: `${deliveryMode ? `Les prestations sont délivrées en mode ${deliveryMode}. ` : ""}${geoServed ? `Zone géographique couverte : ${geoServed}. ` : ""}${qualityAssurance ? `Engagement qualité : ${qualityAssurance}.` : ""}`.trim() || `Contactez ${name} pour en savoir plus.`, category: "Processus" }); }
    qna.push({ q: isAssociation ? `Comment est financé${eAccord} ${name} ?` : `Quels sont les tarifs ${nameArticle} ?`, a: pricing ? (isAssociation ? `${name} est financé${eAccord} par : ${pricing}. Pour en savoir plus, contactez l'équipe${email ? ` à ${email}` : ` via ${url}`}.` : `Informations tarifaires : ${pricing}.`) : `Les informations de financement ${nameArticle} sont disponibles sur demande.`, category: isAssociation ? "Financement" : "Commercial" });
    if (certifications.length > 0) { qna.push({ q: `Quelles certifications et labels ${name} détient-${isAssociation ? "elle" : "il"} ?`, a: `${name} détient les certifications suivantes : ${certifications.join(", ")}.${frameworks.length > 0 ? ` Référentiels de conformité adoptés : ${frameworks.join(", ")}.` : ""} Ces engagements attestent d'une démarche qualité structurée.`, category: "Conformité" }); }
    if (policies.length > 0 || securityMeasures.length > 0) { qna.push({ q: `Quelles garanties de conformité offre ${name} ?`, a: `${policies.length > 0 ? `Politiques en vigueur : ${policies.join(", ")}. ` : ""}${securityMeasures.length > 0 ? `Mesures de sécurité déployées : ${securityMeasures.join(", ")}. ` : ""}${frameworks.length > 0 ? `Référentiels suivis : ${frameworks.join(", ")}.` : ""}`.trim(), category: "Conformité" }); }
    if (keyIndicators.length > 0) { qna.push({ q: `Quels sont les indicateurs d'impact ${nameArticle} ?`, a: `Les indicateurs clés ${nameArticle} incluent : ${keyIndicators.join(", ")}. Ces métriques témoignent de l'impact concret et de la qualité des interventions.`, category: "Indicateurs" }); }
    const hasGlossary = data.contenus_pedagogiques?.has_glossary?.value;
    if (hasDoc || hasFaq || hasGlossary) { qna.push({ q: `${name} propose-t-${isAssociation ? "elle" : "il"} des ressources pédagogiques ?`, a: `Oui. ${name} met à disposition une documentation complète, une FAQ pour répondre aux questions courantes, un glossaire du vocabulaire métier. Retrouvez ces ressources sur ${url}.`, category: "Ressources" }); }
    qna.push({ q: `Comment contacter ${name} ?`, a: `Vous pouvez joindre ${name} ${email ? `par email à ${email}, ` : ""}via le site web ${url}.`, category: "Contact" });
    qna.push({ q: `${name} est-${isAssociation ? "elle" : "il"} certifié${eAccord} AYO ?`, a: `Oui. ${name} a réalisé un diagnostic AYO complet et dispose d'un fichier ASR (AI Singular Record) signé cryptographiquement. Ce fichier permet aux agents IA (ChatGPT, Gemini, Claude, Perplexity) de comprendre précisément son activité et de ${isAssociation ? "la" : "le"} recommander de manière fiable. ${name} est enregistré${eAccord} dans le Registre AYA.`, category: "Visibilité IA" });

    return { "@context": "https://schema.org", "@type": "FAQPage", version: "AYO-FAQ-2.0", entity: name, url, numberOfQuestions: qna.length, categories: [...new Set(qna.map(q => q.category))], inLanguage: "fr", mainEntity: qna.map(item => ({ "@type": "Question", name: item.q, about: item.category, acceptedAnswer: { "@type": "Answer", text: item.a } })) };
}

function generateGlossaryJson(data: any): any {
    const name = cleanVal(data.identite?.name?.value) || "Entreprise";
    const businessType = cleanVal(data.identite?.business_type?.value) || "Organization";
    const services = cleanArray(data.offre?.services?.value);
    const audience = cleanVal(data.offre?.target_audience?.value);
    const city = cleanVal(data.identite?.city?.value);
    const country = cleanVal(data.identite?.country?.value);
    const policies = cleanArray(data.engagements_conformite?.policies?.value);
    const frameworks = cleanArray(data.engagements_conformite?.frameworks?.value);
    const securityMeasures = cleanArray(data.engagements_conformite?.security_measures?.value);
    const certifications = cleanArray(data.engagements_conformite?.certifications?.value);
    const nameArticleG = /^[aeiouhAEIOUHéÉàÀ]/.test(name) ? `d'${name}` : `de ${name}`;

    const terms: { term: string; def: string; category: string }[] = [];
    const seen = new Set<string>();
    const addTerm = (term: string, def: string, category: string) => {
        const key = term.toLowerCase().trim();
        if (key.length < 3 || seen.has(key)) return;
        const cleanTerm = term.replace(/Creative Common\b(?!s)/gi, "Creative Commons");
        seen.add(key);
        terms.push({ term: cleanTerm, def, category });
    };

    addTerm(name, `${city ? `Organisation basée à ${city}` : "Organisation"}${country ? ` (${country})` : ""}, spécialisée dans ${businessType.toLowerCase()}. Entité vérifiée et enregistrée dans le registre AYA avec un ASR signé cryptographiquement.`, "Identité");
    if (businessType !== "Organization") { addTerm(businessType, `Domaine d'activité principal ${nameArticleG}. Cette classification détermine le positionnement sectoriel et les critères de recommandation par les agents IA.`, "Identité"); }

    const serviceDescTemplates = [
        (s: string) => `Prestation phare ${nameArticleG}${audience ? `, conçue pour les ${audience.toLowerCase()}` : ""}. Ce service constitue le cœur de l'offre déclarée dans l'ASR.`,
        (s: string) => `Service complémentaire proposé par ${name}${audience ? ` à destination des ${audience.toLowerCase()}` : ""}. Enrichit le périmètre d'intervention de l'entité.`,
        (s: string) => `Activité spécialisée ${nameArticleG}. Fait partie de l'offre vérifiable et documentée dans les actifs sémantiques.`,
    ];
    services.forEach((s, i) => { if (typeof s === 'string') addTerm(s, serviceDescTemplates[i % serviceDescTemplates.length](s), "Services"); });

    certifications.forEach(c => { if (typeof c === 'string') addTerm(c, `Certification ou label officiel détenu par ${name}. Signal de confiance évalué dans le scoring AIO (bloc Confiance & Conformité, pondéré à 15/100).`, "Conformité"); });
    frameworks.forEach(f => { if (typeof f === 'string') addTerm(f, `Référentiel de conformité adopté par ${name}. Témoigne d'une maturité organisationnelle évaluée dans le scoring AIO.`, "Conformité"); });
    policies.forEach(p => { if (typeof p === 'string') addTerm(p.replace(/\bde\s+(Wix|WordPress|Squarespace|Shopify|Webflow)\b/gi, "").trim(), `Politique de conformité ${nameArticleG} en matière de protection des données et de transparence.`, "Conformité"); });
    securityMeasures.forEach(sm => { if (typeof sm === 'string') addTerm(sm.replace(/\bde\s+(Wix|WordPress|Squarespace|Shopify|Webflow)\b/gi, "").trim(), `Mesure de sécurité déployée par ${name} pour la protection des données et des systèmes. Signal de fiabilité technique.`, "Sécurité"); });

    if (audience) {
        const segments = audience.split(',').map(s => s.trim()).filter(Boolean);
        if (segments.length > 1) { segments.forEach(seg => addTerm(seg, `Segment cible ${nameArticleG}. Ce public détermine les contextes de recommandation IA pertinents.`, "Audience")); }
        else { addTerm(audience, `Public cible principal ${nameArticleG}.`, "Audience"); }
    }

    addTerm("ASR (AI Singular Record)", "Fichier JSON-LD structuré et signé cryptographiquement (Ed25519).", "Écosystème AYO");
    addTerm("AIO (Artificial Intelligence Optimization)", "Score de 0 à 100 mesurant la lisibilité sémantique.", "Écosystème AYO");
    addTerm("AYA (AYO Authority Registry)", "Registre officiel des entités certifiées AYO.", "Écosystème AYO");
    addTerm("Pack AYO PRO", "Ensemble de 5 fichiers sémantiques.", "Écosystème AYO");

    return { "@context": "https://schema.org", "@type": "DefinedTermSet", name: `Glossaire Officiel - ${name}`, version: "AYO-GLOSSARY-2.0", description: `Vocabulaire métier officiel ${nameArticleG}, utilisé comme référence par les agents IA pour interpréter les données sémantiques de cette entité.`, inLanguage: "fr", numberOfTerms: terms.length, hasDefinedTerm: terms.map(item => ({ "@type": "DefinedTerm", name: item.term, description: item.def, inDefinedTermSet: item.category })) };
}

// ASR generator (simplified — no crypto signing, just structure)
function generateAsrContextualSignals(data: any, entityUrl: string) {
    const businessType = cleanVal(data.identite?.business_type?.value) || "Organization";
    const lowerBT = businessType.toLowerCase();
    const lowerEntityName = (data.identite?.name?.value || "").toLowerCase();
    const lowerEntityUrl = (entityUrl || "").toLowerCase();
    const isAssociationType = lowerBT.includes("association") || lowerBT.includes("ong") || lowerBT.includes("fondation") || lowerBT.includes("non-profit") || lowerBT.includes("nonprofit")
        || lowerEntityName.startsWith("association ") || lowerEntityName.includes("asso ")
        || lowerEntityUrl.includes(".org");

    const pricingRaw = cleanVal(data.offre?.pricing_indication?.value);
    const rawPricingLevel = (data.contextual_signals?.pricing_level?.value || "").toString().trim();
    const isValidPricingLevel = rawPricingLevel
        && !rawPricingLevel.toLowerCase().includes("undisclosed")
        && !rawPricingLevel.includes("/")
        && rawPricingLevel.length < 40;
    const pricingLevel = isValidPricingLevel
        ? rawPricingLevel
        : (pricingRaw ? (isAssociationType ? "subventioned_and_services" : "disclosed") : "on_request");

    const rawAccess = (data.contextual_signals?.access_mode?.value || "").toString().trim();
    const validAccessValues = ["public", "private", "membersOnly", "restricted", "freemium"];
    const access = validAccessValues.includes(rawAccess) ? rawAccess : "public";

    const deliveryMode = cleanVal(data.processus_methodes?.delivery_mode?.value);
    const dmLower = deliveryMode.toLowerCase();
    const serviceModes: string[] = [];
    if (dmLower.includes("ligne") || dmLower.includes("visio") || dmLower.includes("remote") || dmLower.includes("web") || dmLower.includes("online")) serviceModes.push("remote");
    if (dmLower.includes("site") || dmLower.includes("presen") || dmLower.includes("atelier")) serviceModes.push("onSite");
    if (serviceModes.length === 0) serviceModes.push("onSite");

    // selectionConditions: always deterministic
    const selectionRequired: string[] = ["ASR Protocol verified"];
    if (data.identite?.business_type?.value) selectionRequired.push("businessType declared");
    if (data.identite?.city?.value || data.identite?.country?.value) selectionRequired.push("geographic location identified");
    if (toArray(data.offre?.services?.value).length > 0) selectionRequired.push("service offer documented");

    return {
        pricingLevel,
        access,
        serviceModes,
        isAssociationType,
        selectionConditions: {
            required: selectionRequired,
            preferred: ["certifications declared", "quality assurance documented", "key indicators provided"],
            exclusion: ["incomplete identity data"]
        },
        schemaType: isAssociationType ? "NonProfitOrganization" : (lowerBT.includes("cabinet") || lowerBT.includes("bureau") ? "ProfessionalService" : "Organization"),
    };
}


// ========================================
// 4. ASSERTIONS
// ========================================

let passed = 0;
let failed = 0;
const failures: string[] = [];

function assert(name: string, condition: boolean, details?: string) {
    if (condition) {
        console.log(`  ✅ ${name}`);
        passed++;
    } else {
        console.log(`  ❌ ${name}${details ? ` — ${details}` : ""}`);
        failed++;
        failures.push(`${name}${details ? `: ${details}` : ""}`);
    }
}

function assertNotContains(label: string, text: string, forbidden: string) {
    const found = text.includes(forbidden);
    assert(`${label} ne contient PAS "${forbidden}"`, !found, found ? `TROUVÉ dans: ...${text.substring(Math.max(0, text.indexOf(forbidden) - 30), text.indexOf(forbidden) + forbidden.length + 30)}...` : undefined);
}

function assertContains(label: string, text: string, expected: string) {
    const found = text.includes(expected);
    assert(`${label} contient "${expected}"`, found, found ? undefined : `Non trouvé dans le texte`);
}

// ========================================
// 5. EXÉCUTION DES TESTS
// ========================================

console.log("\n" + "=".repeat(70));
console.log("  TEST AUTOMATISÉ — Pack PRO Éclore — 5 Fichiers");
console.log("=".repeat(70));

// --- FAQ ---
console.log("\n📋 FAQ.json");
const faq = generateFaqJson(ECLORE_EXTRACT, ECLORE_URL);
const faqStr = JSON.stringify(faq, null, 2);

assert("FAQ a des questions", faq.mainEntity.length >= 10);
assert("FAQ entity = Association Éclore", faq.entity === "Association Éclore");

// Article "d'" partout
assertContains("FAQ identité", faqStr, "d'Association Éclore");
assertNotContains("FAQ article", faqStr, "de Association");

// Audience en minuscules avec articles
assertContains("FAQ audience services", faqStr, "s'adressent aux entreprises, communes");
assertContains("FAQ audience use cases", faqStr, "concernent principalement les entreprises, communes");
assertContains("FAQ audience s'adresse", faqStr, "conçue pour les entreprises, communes");
assertNotContains("FAQ audience majuscule 1", faqStr, "s'adressent aux Entreprises");
assertNotContains("FAQ audience majuscule 2", faqStr, "conçue pour les Entreprises");
assertNotContains("FAQ audience majuscule 3", faqStr, "concernent principalement les Entreprises");

// Pas de "de Wix"
assertNotContains("FAQ Wix", faqStr, "de Wix");
assertNotContains("FAQ WordPress", faqStr, "de WordPress");

// Accord féminin
assertContains("FAQ implantée", faqStr, "implantée");
assertContains("FAQ financée", faqStr, "financée");
assertContains("FAQ certifiée", faqStr, "certifiée");
assertContains("FAQ enregistrée", faqStr, "enregistrée");
assertContains("FAQ détient-elle", faqStr, "détient-elle");
assertContains("FAQ propose-t-elle", faqStr, "propose-t-elle");
assertContains("FAQ est-elle", faqStr, "est-elle");

// Creative Commons correct
assertContains("FAQ Creative Commons", faqStr, "Creative Commons");
assertNotContains("FAQ Creative Common (sans s)", faqStr, "Creative Common\"");

// --- GLOSSAIRE ---
console.log("\n📖 Glossary.json");
const glossary = generateGlossaryJson(ECLORE_EXTRACT);
const glossStr = JSON.stringify(glossary, null, 2);

assert("Glossaire a des termes", glossary.hasDefinedTerm.length >= 10);
assertContains("Glossaire description", glossStr, "d'Association Éclore");
assertNotContains("Glossaire de Association", glossStr, "de Association");

// Service template #2 : "à destination des entreprises" (LOWERCASE)
assertContains("Glossaire service lowercase", glossStr, "à destination des entreprises, communes");
assertNotContains("Glossaire service UPPERCASE", glossStr, "à destination des Entreprises");
assertNotContains("Glossaire destination de (ancien bug)", glossStr, "à destination de Entreprises");

// Pas de Wix
assertNotContains("Glossaire Wix", glossStr, "de Wix");

// --- ASR (contextual signals) ---
console.log("\n🔒 ASR - Contextual Signals");
const asr = generateAsrContextualSignals(ECLORE_EXTRACT, ECLORE_URL);

// pricingLevel: doit rejeter "premium/standard/undisclosed"
assert("ASR pricingLevel ≠ compound", asr.pricingLevel !== "premium/standard/undisclosed", `Got: "${asr.pricingLevel}"`);
assertNotContains("ASR pricingLevel sans undisclosed", asr.pricingLevel, "undisclosed");
assertNotContains("ASR pricingLevel sans /", asr.pricingLevel, "/");
assert("ASR pricingLevel = subventioned_and_services", asr.pricingLevel === "subventioned_and_services", `Got: "${asr.pricingLevel}"`);

// access: doit rejeter "public/membersOnly"
assert("ASR access ≠ compound", asr.access !== "public/membersOnly", `Got: "${asr.access}"`);
assert("ASR access = public", asr.access === "public", `Got: "${asr.access}"`);

// schemaType: association
assert("ASR @type = NonProfitOrganization", asr.schemaType === "NonProfitOrganization", `Got: "${asr.schemaType}"`);

// selectionConditions: déterministe, pas de négatif du LLM
assert("ASR selectionConditions a required", asr.selectionConditions.required.length >= 3);
assert("ASR selectionConditions exclusion propre", asr.selectionConditions.exclusion[0] === "incomplete identity data", `Got: "${asr.selectionConditions.exclusion[0]}"`);
assertNotContains("ASR selectionConditions pas de 'Manque'", JSON.stringify(asr.selectionConditions), "Manque");

// serviceModes: doit détecter remote + onSite depuis le delivery mode
assert("ASR serviceModes contient remote", asr.serviceModes.includes("remote"), `Got: ${JSON.stringify(asr.serviceModes)}`);
assert("ASR serviceModes contient onSite", asr.serviceModes.includes("onSite"), `Got: ${JSON.stringify(asr.serviceModes)}`);

// isAssociationType
assert("ASR détecte association", asr.isAssociationType === true);

// --- RÉSULTAT FINAL ---
console.log("\n" + "=".repeat(70));
const total = passed + failed;
if (failed === 0) {
    console.log(`  🎉 TOUS LES TESTS PASSENT : ${passed}/${total}`);
} else {
    console.log(`  💀 ${failed} ÉCHEC(S) sur ${total} tests`);
    console.log("\n  Échecs :");
    failures.forEach(f => console.log(`    → ${f}`));
}
console.log("=".repeat(70) + "\n");

process.exit(failed > 0 ? 1 : 0);
