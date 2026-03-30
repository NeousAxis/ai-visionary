/**
 * AGENT GREFFIER
 *
 * Rôle : Questionner le client UNIQUEMENT sur ce que le Scanner n'a pas trouvé.
 * C'est un greffier — il remplit un formulaire, point.
 *
 * Utilise le LLM (Gemini) avec un prompt court et spécialisé (~800 tokens).
 *
 * CE QUE LE GREFFIER NE SAIT PAS :
 * - Ce qu'est un score AIO
 * - Ce qu'est un fichier ASR
 * - Ce qu'est un pack PRO ou AYA
 * - Le tunnel de vente
 * - Le mot "ASR" n'existe pas dans son vocabulaire
 */

// NOTE: QUESTIONNAIRE, buildQuestionQueue, GreffierContext,
// getGreffierPrompt, buildContinuePrompt, ContinuePromptParams, MULTI_SELECT_FIELDS,
// EVIDENCE_REQUIRED_FIELDS, fieldRequiresEvidence, getEvidenceQuestion
// were removed as dead code (replaced by static enrichment templates).

// --- TYPES (kept for ayo-router compatibility) ---

export type BlocName =
    | 'identite'
    | 'offre'
    | 'processus_methodes'
    | 'engagements_conformite'
    | 'indicateurs'
    | 'contenus_pedagogiques'
    | 'external_context';

export interface BlocQuestion {
    bloc: BlocName;
    fieldTargets: string[];
    question: string;
    relance: string;
}

/**
 * Génère une question de validation STATIQUE (sans LLM) pour les données scannées lowConfidence.
 * Format : "Le scan a détecté X. Est-ce exact ?" avec options Oui/Non.
 */
import type { Locale } from '../ayo-system-prompt';

// Labels humains pour les blocs et champs (module-level pour éviter recréation)
const BLOCK_LABELS: Record<string, Record<string, string>> = {
    fr: {
        'identite': 'Identité & Ancrage',
        'offre': 'Clarté de l\'Offre',
        'processus_methodes': 'Processus & Méthodes',
        'engagements_conformite': 'Confiance & Conformité',
        'indicateurs': 'Preuve Sociale & Métriques',
        'contenus_pedagogiques': 'Pédagogie & Supports',
        'external_context': 'Contexte Externe',
    },
    en: {
        'identite': 'Identity & Anchoring',
        'offre': 'Offer Clarity',
        'processus_methodes': 'Processes & Methods',
        'engagements_conformite': 'Trust & Compliance',
        'indicateurs': 'Social Proof & Metrics',
        'contenus_pedagogiques': 'Educational Content',
        'external_context': 'External Context',
    },
};

const FIELD_LABELS: Record<string, Record<string, string>> = {
    fr: {
        'services': 'les services suivants',
        'products': 'les produits suivants',
        'target_audience': 'le public cible suivant',
        'use_cases': 'le cas d\'usage suivant',
        'pricing_indication': 'la tarification suivante',
        'process_steps': 'les étapes suivantes',
        'delivery_mode': 'que votre service est principalement',
        'quality_assurance': 'que votre assurance qualité repose sur',
        'certifications': 'les certifications suivantes',
        'frameworks': 'les frameworks suivants',
        'policies': 'les politiques suivantes',
        'security_measures': 'les mesures de sécurité suivantes',
        'key_indicators': 'les indicateurs suivants',
        'has_faq': 'la présence d\'une FAQ',
        'has_glossary': 'la présence d\'un glossaire',
        'has_documentation': 'la présence de documentation',
        'keywords': 'les mots-clés suivants',
        'channels': 'les canaux suivants',
        'intents': 'les intentions utilisateurs suivantes',
        'city': 'que vous êtes basé à',
        'country': 'que votre pays est',
        'name': 'le nom',
        'legal_name': 'le nom légal',
        'business_type': 'le type d\'activité',
        'geographies_served': 'la zone géographique servie',
    },
    en: {
        'services': 'the following services',
        'products': 'the following products',
        'target_audience': 'the following target audience',
        'use_cases': 'the following use case',
        'pricing_indication': 'the following pricing',
        'process_steps': 'the following steps',
        'delivery_mode': 'that your service is primarily',
        'quality_assurance': 'that your quality assurance relies on',
        'certifications': 'the following certifications',
        'frameworks': 'the following frameworks',
        'policies': 'the following policies',
        'security_measures': 'the following security measures',
        'key_indicators': 'the following indicators',
        'has_faq': 'the presence of a FAQ',
        'has_glossary': 'the presence of a glossary',
        'has_documentation': 'the presence of documentation',
        'keywords': 'the following keywords',
        'channels': 'the following channels',
        'intents': 'the following user intents',
        'city': 'that you are based in',
        'country': 'that your country is',
        'name': 'the name',
        'legal_name': 'the legal name',
        'business_type': 'the business type',
        'geographies_served': 'the geographic area served',
    },
};

interface EnrichmentTemplate {
    text: string;
    options?: string[];
    inputType?: string;
    customLabel?: string;
    allowMultiple?: boolean;
}

const ENRICHMENT_TEMPLATES_FR: Record<string, EnrichmentTemplate> = {
    // Identité
    'name': { text: "Quel est le nom commercial de votre entreprise ?", inputType: 'text', customLabel: "Nom commercial..." },
    'country': { text: "Dans quel pays votre entreprise est-elle basée ?", options: ["France", "Suisse", "Belgique", "Canada", "Luxembourg"], allowMultiple: false },
    'legal_name': { text: "Quel est le nom légal de votre entreprise (tel qu'il apparaît sur les documents officiels) ?", inputType: 'text', customLabel: "Nom légal..." },
    'business_type': { text: "Quelle est la forme juridique de votre entreprise ?", options: ["SARL", "SAS", "SA", "Auto-entrepreneur", "Association", "SCI"], allowMultiple: false },
    'city': { text: "Dans quelle ville êtes-vous principalement basé(e) ?", inputType: 'text', customLabel: "Ville..." },
    'contact_email': { text: "Quelle est l'adresse e-mail de contact principale pour votre entreprise ?", inputType: 'text', customLabel: "Saisissez votre email..." },
    'contact_phone': { text: "Quel est le numéro de téléphone de contact principal pour votre entreprise ?", inputType: 'text', customLabel: "Saisissez votre numéro..." },
    // Offre
    'target_audience': { text: "Qui sont vos clients cibles ? (ex: PME, particuliers, développeurs, collectivités...)", inputType: 'text', customLabel: "Décrivez votre cible..." },
    'services': { text: "Quels sont vos services principaux ? (listez 3 à 5 services)", inputType: 'text', customLabel: "Décrivez vos services..." },
    'products': { text: "Quels sont vos produits principaux ? (listez 3 à 5 produits)", inputType: 'text', customLabel: "Décrivez vos produits..." },
    'pricing_indication': { text: "Comment sont structurés vos tarifs ?", options: ["Abonnement mensuel", "Tarif horaire", "Forfait projet", "Sur devis", "Gratuit / Freemium"], allowMultiple: true },
    'use_cases': { text: "Donnez 2-3 exemples concrets de problèmes que vous résolvez pour vos clients.", inputType: 'text', customLabel: "Cas d'usage concrets..." },
    // Processus & Méthodes
    'process_steps': { text: "Pourriez-vous décrire les étapes principales de votre processus ou méthodologie ?", inputType: 'text', customLabel: "Décrivez votre processus..." },
    'delivery_mode': { text: "Comment livrez-vous vos services ?", options: ["100% en ligne", "Sur site uniquement", "Hybride (en ligne + sur site)", "Livraison physique"], allowMultiple: false },
    'geographies_served': { text: "Dans quelles zones géographiques proposez-vous vos services ?", inputType: 'text', customLabel: "Zones géographiques..." },
    'quality_assurance': { text: "Avez-vous un processus de contrôle qualité ?", options: ["Oui", "Non"], allowMultiple: false },
    // Confiance & Conformité
    'certifications': { text: "Possédez-vous des certifications spécifiques (ISO, RGPD, B Corp, etc.) ?", options: ["Oui", "Non"], allowMultiple: false },
    'frameworks': { text: "Êtes-vous conforme à des frameworks de conformité spécifiques ?", options: ["RGPD", "SOC 2", "PCI DSS", "Agile / Scrum", "ITIL", "Aucun"], allowMultiple: true },
    'security_measures': { text: "Quelles mesures de sécurité avez-vous mises en place pour protéger les données de vos clients ?", inputType: 'text', customLabel: "Mesures de sécurité..." },
    'policies': { text: "Quelles politiques avez-vous en place ?", options: ["Politique de confidentialité", "Mentions légales", "CGV", "Charte éthique", "Aucune"], allowMultiple: true },
    // Indicateurs
    'key_indicators': { text: "Quels sont vos indicateurs clés de performance (KPIs) ? (nombre de clients, taux de satisfaction, etc.)", inputType: 'text', customLabel: "Indicateurs clés..." },
    'last_review_date': { text: "À quelle date vos informations (site web, services, tarifs) ont-elles été mises à jour pour la dernière fois ?", options: ["Moins d'un mois", "1 à 3 mois", "3 à 6 mois", "Plus de 6 mois"] },
    'testimonials': { text: "Avez-vous des témoignages de clients satisfaits ?", options: ["Oui", "Non"], allowMultiple: false },
    'certifications_count': { text: "Combien de certifications professionnelles possédez-vous ?", options: ["Aucune", "1 à 2", "3 à 5", "Plus de 5"], allowMultiple: false },
    // Pédagogie & Supports
    'has_faq': { text: "Disposez-vous d'une section FAQ (Foire Aux Questions) sur votre site web ?", options: ["Oui", "Non"] },
    'has_glossary': { text: "Disposez-vous d'un glossaire ou lexique sur votre site web ?", options: ["Oui", "Non"] },
    'has_documentation': { text: "Proposez-vous de la documentation ou des guides pour vos clients ?", options: ["Oui", "Non"] },
    // Contexte externe
    'keywords': { text: "Quels sont les mots-clés qui décrivent le mieux votre entreprise et votre offre ?", inputType: 'text', customLabel: "Mots-clés..." },
    'channels': { text: "Sur quels canaux êtes-vous présent ?", options: ["Site web", "LinkedIn", "Instagram", "Google Business", "Annuaires professionnels"], allowMultiple: true },
    'intents': { text: "Quelles questions vos clients potentiels posent-ils aux IA pour trouver un service comme le vôtre ?", inputType: 'text', customLabel: "Questions types..." },
};

const ENRICHMENT_TEMPLATES_EN: Record<string, EnrichmentTemplate> = {
    // Identity
    'name': { text: "What is the commercial name of your business?", inputType: 'text', customLabel: "Business name..." },
    'country': { text: "In which country is your business based?", options: ["France", "Switzerland", "Belgium", "Canada", "Luxembourg", "United States", "United Kingdom", "Germany"], allowMultiple: false },
    'legal_name': { text: "What is the legal name of your company (as it appears on official documents)?", inputType: 'text', customLabel: "Legal name..." },
    'business_type': { text: "What is the legal form of your company?", options: ["LLC", "Corporation", "Sole Proprietorship", "Partnership", "Non-Profit", "Other"], allowMultiple: false },
    'city': { text: "In which city are you primarily based?", inputType: 'text', customLabel: "City..." },
    'contact_email': { text: "What is the main contact email address for your company?", inputType: 'text', customLabel: "Enter your email..." },
    'contact_phone': { text: "What is the main contact phone number for your company?", inputType: 'text', customLabel: "Enter your number..." },
    // Offer
    'target_audience': { text: "Who are your target clients? (e.g.: SMBs, individuals, developers, agencies...)", inputType: 'text', customLabel: "Describe your target..." },
    'services': { text: "What are your main services? (list 3 to 5 services)", inputType: 'text', customLabel: "Describe your services..." },
    'products': { text: "What are your main products? (list 3 to 5 products)", inputType: 'text', customLabel: "Describe your products..." },
    'pricing_indication': { text: "How are your prices structured?", options: ["Monthly subscription", "Hourly rate", "Project-based", "Custom quote", "Free / Freemium"], allowMultiple: true },
    'use_cases': { text: "Give 2-3 concrete examples of problems you solve for your clients.", inputType: 'text', customLabel: "Concrete use cases..." },
    // Processes & Methods
    'process_steps': { text: "Could you describe the main steps of your process or methodology?", inputType: 'text', customLabel: "Describe your process..." },
    'delivery_mode': { text: "How do you deliver your services?", options: ["100% online", "On-site only", "Hybrid (online + on-site)", "Physical delivery"], allowMultiple: false },
    'geographies_served': { text: "In which geographic areas do you offer your services?", inputType: 'text', customLabel: "Geographic areas..." },
    'quality_assurance': { text: "Do you have a quality control process?", options: ["Yes", "No"], allowMultiple: false },
    // Trust & Compliance
    'certifications': { text: "Do you hold any specific certifications (ISO, GDPR, B Corp, etc.)?", options: ["Yes", "No"], allowMultiple: false },
    'frameworks': { text: "Are you compliant with any specific compliance frameworks?", options: ["GDPR", "SOC 2", "PCI DSS", "Agile / Scrum", "ITIL", "None"], allowMultiple: true },
    'security_measures': { text: "What security measures have you implemented to protect your clients' data?", inputType: 'text', customLabel: "Security measures..." },
    'policies': { text: "What policies do you have in place?", options: ["Privacy Policy", "Legal Notice", "Terms of Service", "Code of Ethics", "None"], allowMultiple: true },
    // Indicators
    'key_indicators': { text: "What are your key performance indicators (KPIs)? (number of clients, satisfaction rate, etc.)", inputType: 'text', customLabel: "Key indicators..." },
    'last_review_date': { text: "When was the last time your information (website, services, pricing) was updated?", options: ["Less than a month", "1 to 3 months", "3 to 6 months", "More than 6 months"] },
    'testimonials': { text: "Do you have satisfied client testimonials?", options: ["Yes", "No"], allowMultiple: false },
    'certifications_count': { text: "How many professional certifications do you hold?", options: ["None", "1 to 2", "3 to 5", "More than 5"], allowMultiple: false },
    // Educational Content
    'has_faq': { text: "Do you have a FAQ section on your website?", options: ["Yes", "No"] },
    'has_glossary': { text: "Do you have a glossary or lexicon on your website?", options: ["Yes", "No"] },
    'has_documentation': { text: "Do you offer documentation or guides for your clients?", options: ["Yes", "No"] },
    // External Context
    'keywords': { text: "What keywords best describe your company and offering?", inputType: 'text', customLabel: "Keywords..." },
    'channels': { text: "On which channels are you present?", options: ["Website", "LinkedIn", "Instagram", "Google Business", "Professional Directories"], allowMultiple: true },
    'intents': { text: "What questions do your potential clients ask AIs to find a service like yours?", inputType: 'text', customLabel: "Typical questions..." },
};

/** Get the enrichment templates for a locale */
export function getEnrichmentTemplates(locale: Locale = 'en'): Record<string, EnrichmentTemplate> {
    return locale === 'en' ? ENRICHMENT_TEMPLATES_EN : ENRICHMENT_TEMPLATES_FR;
}

/** Default export for backward compatibility — always French */
export const ENRICHMENT_TEMPLATES = ENRICHMENT_TEMPLATES_FR;

/** Field names that use text input (derived from ENRICHMENT_TEMPLATES) */
export const TEXT_INPUT_FIELD_NAMES = Object.entries(ENRICHMENT_TEMPLATES)
    .filter(([, t]) => t.inputType === 'text')
    .map(([k]) => k);

/** Field names that are simple Oui/Non booleans (derived from ENRICHMENT_TEMPLATES) */
export const BOOLEAN_FIELD_NAMES = Object.entries(ENRICHMENT_TEMPLATES)
    .filter(([, t]) => t.options?.length === 2 && t.options.includes('Oui') && t.options.includes('Non') && !t.allowMultiple)
    .map(([k]) => k);

/**
 * Génère une question d'enrichissement STATIQUE (sans LLM) pour les données manquantes.
 * Remplace l'ancien appel LLM via buildContinuePrompt + Gemini.
 */
export function buildEnrichmentQuestion(
    blockName: string,
    fieldName: string,
    locale: Locale = 'en',
): string {
    const templates = getEnrichmentTemplates(locale);
    const template = templates[fieldName];
    const blocLabels = BLOCK_LABELS[locale] || BLOCK_LABELS.fr;
    const blocLabel = blocLabels[blockName] || blockName;

    // Fallback if the field has no template
    const fallbackText = locale === 'en'
        ? `Could you provide the following information: "${fieldName}"?`
        : `Pourriez-vous préciser l'information suivante : "${fieldName}" ?`;
    const questionText = template?.text || fallbackText;
    const hasOptions = template?.options && template.options.length > 0;
    const isTextInput = template?.inputType === 'text' || !hasOptions;

    const introText = locale === 'en'
        ? `Let's move to the section: **${blocLabel}**`
        : `Passons à la section : **${blocLabel}**`;

    const questionBlock = {
        type: "question_block",
        intro: introText,
        questions: [{
            id: `q_${blockName}_${fieldName}`,
            text: questionText,
            options: hasOptions ? template!.options : [],
            allowCustom: true,
            allowMultiple: template?.allowMultiple ?? false,
            ...(isTextInput ? { inputType: 'text' } : {}),
            ...(template?.customLabel ? { customLabel: template.customLabel } : {}),
        }]
    };

    return JSON.stringify(questionBlock);
}

export function buildValidationQuestion(
    blockName: string,
    fieldName: string,
    detectedValue: string | string[],
    locale: Locale = 'en',
): string {
    // Format the detected value
    let displayValue: string;
    if (Array.isArray(detectedValue)) {
        if (detectedValue.length <= 3) {
            displayValue = detectedValue.join(', ');
        } else {
            const moreText = locale === 'en'
                ? `and ${detectedValue.length - 3} more`
                : `et ${detectedValue.length - 3} autre(s)`;
            displayValue = detectedValue.slice(0, 3).join(', ') + ` ${moreText}`;
        }
    } else {
        displayValue = detectedValue.length > 150
            ? detectedValue.substring(0, 147) + '...'
            : detectedValue;
    }

    const fieldLabels = FIELD_LABELS[locale] || FIELD_LABELS.fr;
    const blocLabels = BLOCK_LABELS[locale] || BLOCK_LABELS.fr;
    const fieldLabel = fieldLabels[fieldName] || (locale === 'en' ? `the following information for "${fieldName}"` : `l'information suivante pour "${fieldName}"`);
    const blocLabel = blocLabels[blockName.split('.')[0]] || blockName;

    const introText = locale === 'en'
        ? `Let's move to the section: **${blocLabel}**`
        : `Passons à la section : **${blocLabel}**`;

    const questionText = locale === 'en'
        ? `The scan detected ${fieldLabel}: ${displayValue}.\nIs this correct?`
        : `Le scan a détecté ${fieldLabel} : ${displayValue}.\nEst-ce exact ?`;

    const optionYes = locale === 'en' ? "✅ Yes, that's correct" : "✅ Oui, c'est exact";
    const optionNo = locale === 'en' ? "❌ No, that's not correct" : "❌ Non, ce n'est pas exact";
    const customLbl = locale === 'en' ? "Specify or correct" : "Préciser ou corriger";

    const questionBlock = {
        type: "question_block",
        intro: introText,
        questions: [{
            id: `validation_${blockName.replace('.', '_')}_${fieldName}`,
            text: questionText,
            options: [optionYes, optionNo],
            allowCustom: true,
            allowMultiple: false,
            customLabel: customLbl
        }]
    };

    return JSON.stringify(questionBlock);
}
