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
// Labels humains pour les blocs et champs (module-level pour éviter recréation)
const BLOCK_LABELS: Record<string, string> = {
    'identite': 'Identité & Ancrage',
    'offre': 'Clarté de l\'Offre',
    'processus_methodes': 'Processus & Méthodes',
    'engagements_conformite': 'Confiance & Conformité',
    'indicateurs': 'Preuve Sociale & Métriques',
    'contenus_pedagogiques': 'Pédagogie & Supports',
    'external_context': 'Contexte Externe',
};

const FIELD_LABELS: Record<string, string> = {
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
};

export const ENRICHMENT_TEMPLATES: Record<string, {text: string, options?: string[], inputType?: string, customLabel?: string, allowMultiple?: boolean}> = {
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
): string {
    const template = ENRICHMENT_TEMPLATES[fieldName];
    const blocLabel = BLOCK_LABELS[blockName] || blockName;

    // Fallback si le champ n'a pas de template
    const questionText = template?.text || `Pourriez-vous préciser l'information suivante : "${fieldName}" ?`;
    const hasOptions = template?.options && template.options.length > 0;
    const isTextInput = template?.inputType === 'text' || !hasOptions;

    const questionBlock = {
        type: "question_block",
        intro: `Passons à la section : **${blocLabel}**`,
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
): string {
    // Formater la valeur détectée
    let displayValue: string;
    if (Array.isArray(detectedValue)) {
        if (detectedValue.length <= 3) {
            displayValue = detectedValue.join(', ');
        } else {
            displayValue = detectedValue.slice(0, 3).join(', ') + ` et ${detectedValue.length - 3} autre(s)`;
        }
    } else {
        displayValue = detectedValue.length > 150
            ? detectedValue.substring(0, 147) + '...'
            : detectedValue;
    }

    const fieldLabel = FIELD_LABELS[fieldName] || `l'information suivante pour "${fieldName}"`;
    const blocLabel = BLOCK_LABELS[blockName.split('.')[0]] || blockName;

    const questionBlock = {
        type: "question_block",
        intro: `Passons à la section : **${blocLabel}**`,
        questions: [{
            id: `validation_${blockName.replace('.', '_')}_${fieldName}`,
            text: `Le scan a détecté ${fieldLabel} : ${displayValue}.\nEst-ce exact ?`,
            options: ["✅ Oui, c'est exact", "❌ Non, ce n'est pas exact"],
            allowCustom: true,
            allowMultiple: false,
            customLabel: "Préciser ou corriger"
        }]
    };

    return JSON.stringify(questionBlock);
}
