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

import type { AioScanResult } from '../aio-scanner';

// --- BLOC DEFINITIONS ---

export type BlocName =
    | 'identite'
    | 'offre'
    | 'processus_methodes'
    | 'engagements_conformite'
    | 'indicateurs'
    | 'contenus_pedagogiques'
    | 'external_context';
    // PAS de 'structure_technique' — 100% géré par le Scanner

export interface BlocQuestion {
    bloc: BlocName;
    fieldTargets: string[];
    question: string;
    relance: string;
    skipIfScanDetected?: (scan: AioScanResult) => boolean;
}

/**
 * Liste ordonnée des questions du questionnaire universel.
 * Bloc 7 (Socle Technique) est ABSENT — 100% scanner.
 */
export const QUESTIONNAIRE: BlocQuestion[] = [
    // BLOC 1 — Identité & Ancrage
    {
        bloc: 'identite',
        fieldTargets: ['name', 'legal_name', 'business_type'],
        question: "Quel est le nom commercial exact de votre entreprise et sa forme juridique (SA, SARL, auto-entrepreneur, association...) ?",
        relance: "Pour que les IA vous identifient correctement, j'ai besoin du nom officiel tel qu'il apparaît sur vos documents légaux.",
    },
    {
        bloc: 'identite',
        fieldTargets: ['city', 'country'],
        question: "Dans quelle ville et quel pays êtes-vous basé(e) ? Si vous avez plusieurs localisations, indiquez la principale.",
        relance: "La ville est essentielle pour la recherche locale par les IA.",
    },
    // BLOC 2 — Clarté de l'Offre
    {
        bloc: 'offre',
        fieldTargets: ['services', 'products'],
        question: "Décrivez vos services ou produits principaux (3 à 5 maximum). Pour chacun, donnez un nom clair et une courte description.",
        relance: "Les IA ont besoin d'au moins 2-3 offres distinctes pour vous recommander. Pouvez-vous détailler ?",
        skipIfScanDetected: (scan) => {
            // Skip si le scan a trouvé des services ET des produits dans le contenu
            return false; // On ne skip jamais cette question — trop importante
        },
    },
    {
        bloc: 'offre',
        fieldTargets: ['target_audience'],
        question: "Qui sont vos clients cibles ? (ex: PME de 10-50 salariés, particuliers 25-45 ans, développeurs, collectivités locales...)",
        relance: "Essayez d'être précis sur le profil : taille d'entreprise, secteur, ou tranche d'âge.",
    },
    {
        bloc: 'offre',
        fieldTargets: ['use_cases'],
        question: "Donnez 2-3 exemples concrets de problèmes que vous résolvez pour vos clients.",
        relance: "Pensez à des situations réelles et spécifiques, pas des descriptions génériques.",
    },
    {
        bloc: 'offre',
        fieldTargets: ['pricing_indication'],
        question: "Comment sont structurés vos tarifs ? (fourchette de prix, abonnement, tarif horaire, sur devis...)",
        relance: "'Sur devis' seul ne permet pas aux IA de vous positionner. Pouvez-vous donner une fourchette indicative ?",
    },
    // BLOC 3 — Processus & Méthodes
    {
        bloc: 'processus_methodes',
        fieldTargets: ['process_steps'],
        question: "Décrivez les étapes principales de votre processus de travail (au moins 3 étapes).",
        relance: "Les IA valorisent les processus structurés. Décomposez votre méthode en au moins 3 étapes.",
    },
    {
        bloc: 'processus_methodes',
        fieldTargets: ['delivery_mode', 'geographies_served'],
        question: "Comment livrez-vous vos services ? (en ligne, sur site, hybride) Et quelle zone géographique couvrez-vous ?",
        relance: "",
    },
    {
        bloc: 'processus_methodes',
        fieldTargets: ['quality_assurance'],
        question: "Avez-vous un processus de contrôle qualité ? (revue par les pairs, tests, satisfaction client mesurée, label qualité...)",
        relance: "",
    },
    // BLOC 4 — Confiance & Conformité
    {
        bloc: 'engagements_conformite',
        fieldTargets: ['certifications'],
        question: "Avez-vous des certifications ou labels reconnus ? (ISO, B Corp, RGE, HACCP, etc.) Si oui, lesquels exactement ?",
        relance: "",
    },
    {
        bloc: 'engagements_conformite',
        fieldTargets: ['frameworks'],
        question: "Quels frameworks ou méthodologies utilisez-vous ? (Agile, Lean, ITIL, etc.) Êtes-vous membre d'associations professionnelles ?",
        relance: "",
    },
    {
        bloc: 'engagements_conformite',
        fieldTargets: ['policies', 'security_measures'],
        question: "Avez-vous des politiques formelles en place ? (confidentialité, CGV, charte éthique, mesures de sécurité...)",
        relance: "",
        skipIfScanDetected: (scan) => {
            // Les politiques détectées par le scan (sitemap, robots.txt) ne comptent pas comme "politiques formelles"
            return false;
        },
    },
    // BLOC 5 — Preuve Sociale & Métriques
    {
        bloc: 'indicateurs',
        fieldTargets: ['key_indicators'],
        question: "Donnez-moi 3 à 5 indicateurs chiffrés de votre activité. Par exemple : nombre de clients, chiffre d'affaires, taux de satisfaction, projets réalisés...",
        relance: "Même approximatifs, des chiffres sont essentiels : '~200 clients', '15 ans d'expérience', '95% de satisfaction'.",
    },
    {
        bloc: 'indicateurs',
        fieldTargets: ['last_review_date'],
        question: "Quand avez-vous mis à jour vos informations pour la dernière fois ? (date approximative)",
        relance: "",
    },
    // BLOC 6 — Pédagogie & Supports
    {
        bloc: 'contenus_pedagogiques',
        fieldTargets: ['has_faq', 'has_glossary', 'has_documentation'],
        question: "Avez-vous sur votre site : une FAQ ? un glossaire ? de la documentation ou des guides ?",
        relance: "",
        skipIfScanDetected: (scan) => {
            // Skip si le scan a détecté FAQ + FAQ schema
            return scan.hasFaqContent && scan.hasFaqSchema;
        },
    },
    // BONUS — Contexte externe
    {
        bloc: 'external_context',
        fieldTargets: ['keywords'],
        question: "Quels mots-clés décrivent le mieux votre activité ? (5-10 mots que vos clients utiliseraient pour vous trouver)",
        relance: "",
    },
    {
        bloc: 'external_context',
        fieldTargets: ['channels'],
        question: "Sur quels canaux êtes-vous présent ? (site web, LinkedIn, Instagram, Google Business, annuaires...)",
        relance: "",
    },
    {
        bloc: 'external_context',
        fieldTargets: ['intents'],
        question: "Quelles sont les intentions utilisateurs que vous ciblez ? (ex: 'Définir la CSRD', 'Trouver un restaurant bio à Genève'...)",
        relance: "",
    },
];

// --- QUEUE DE QUESTIONS ---

export interface GreffierContext {
    scan: AioScanResult;
    /** Clés déjà remplies avec haute confiance (q=1) depuis le scan */
    highConfidenceKeys: string[];
    /** Clés à basse confiance (q=0.5) */
    lowConfidenceKeys: string[];
    /** Clés inconnues (q=0) */
    unknownKeys: string[];
}

/**
 * Construit la file de questions à poser, en filtrant celles déjà résolues par le scan.
 */
export function buildQuestionQueue(ctx: GreffierContext): BlocQuestion[] {
    return QUESTIONNAIRE.filter(q => {
        // Skip si la question a un skipIfScanDetected qui retourne true
        if (q.skipIfScanDetected && q.skipIfScanDetected(ctx.scan)) {
            return false;
        }

        // Garder la question si au moins un de ses champs cibles est unknown ou low confidence
        return q.fieldTargets.some(field =>
            ctx.unknownKeys.includes(field) ||
            ctx.lowConfidenceKeys.includes(field) ||
            // Le champ n'est dans aucune liste → unknown
            (!ctx.highConfidenceKeys.includes(field) && !ctx.lowConfidenceKeys.includes(field) && !ctx.unknownKeys.includes(field))
        );
    });
}

// --- PROMPT GREFFIER ---

/**
 * Génère le prompt système pour le Greffier.
 * Ce prompt est COURT et SPÉCIALISÉ — le Greffier ne sait rien du scoring, de l'ASR, ni des packs.
 */
export function getGreffierPrompt(
    nextQuestion: BlocQuestion,
    scanInfo: string,
    alreadyCollected: string,
): string {
    return `Tu es un greffier professionnel. Tu remplis un formulaire structuré pour une entreprise.

RÈGLES ABSOLUES :
1. Tu poses UNE question à la fois, celle fournie ci-dessous.
2. Tu es BREF et DIRECT. Transition courte (1 phrase max) avant la question.
3. Si le client répond "aucun", "non", "rien" → accepte et passe au suivant.
4. Si le client est vague → relance UNE SEULE FOIS avec la relance fournie.
5. Tu ne fais JAMAIS de calcul, de score, de pitch commercial.
6. Tu ne parles JAMAIS de "ASR", "AI Singular Record", "pack", "certification", "AYA", "AIO".
7. Tu ne proposes JAMAIS "Compléter la liste", "Ajouter des éléments", "Confirmer la liste".
8. Tu ne demandes JAMAIS de confirmer ce que le scan a déjà trouvé.

CE QUE LE SCAN A TROUVÉ (NE JAMAIS REPOSER) :
${scanInfo}

DONNÉES DÉJÀ COLLECTÉES :
${alreadyCollected}

QUESTION À POSER MAINTENANT :
Bloc : ${nextQuestion.bloc}
Champs cibles : ${nextQuestion.fieldTargets.join(', ')}
Question : "${nextQuestion.question}"
Relance (si réponse vague) : "${nextQuestion.relance}"

FORMAT DE SORTIE OBLIGATOIRE : JSON "question_block" avec la question et les options de réponse.`;
}
