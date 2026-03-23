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
            // Skip si le scan a trouvé des services dans le contenu textuel (highConfidence)
            // La question de validation "Est-ce exact ?" sera posée via la validationQueue
            const text = (scan.text || '').toLowerCase();
            const hasServices = text.includes('service') || text.includes('prestation');
            const hasProducts = text.includes('produit') || text.includes('solution');
            return hasServices && hasProducts;
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
        skipIfScanDetected: (_scan) => {
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

// --- PROMPT CONTINUE (remplace l'ancien CONTINUE_PROMPT inline de route.ts) ---

/** Liste des champs qui acceptent le multi-select */
const MULTI_SELECT_FIELDS = [
    'offre.target_audience', 'offre.products', 'offre.use_cases', 'offre.services',
    'engagements_conformite.frameworks', 'engagements_conformite.certifications',
    'engagements_conformite.policies', 'engagements_conformite.security_measures',
    'indicateurs.key_indicators', 'external_context.keywords', 'external_context.intents',
];

/**
 * Champs critiques nécessitant une PREUVE vérifiable (lien, URL, document).
 * Après la réponse déclarative de l'utilisateur, le Greffier doit demander un lien de preuve.
 */
// DÉSACTIVÉ : Les questions de preuve rendaient le questionnaire confus.
// Les données déclaratives sont suffisantes — le score reflète la qualité.
export const EVIDENCE_REQUIRED_FIELDS: Record<string, string> = {};

/** Vérifie si un champ donné nécessite une question de preuve */
export function fieldRequiresEvidence(blockName: string): boolean {
    return blockName in EVIDENCE_REQUIRED_FIELDS;
}

/** Retourne la question de preuve pour un champ donné, ou null */
export function getEvidenceQuestion(blockName: string): string | null {
    return EVIDENCE_REQUIRED_FIELDS[blockName] ?? null;
}

export interface ContinuePromptParams {
    nextBlockName: string;
    scanInfo: string;
    highConfidenceData: string;
    lowConfidenceData: string;
}

/**
 * Génère le prompt système utilisé par le LLM pour poser la prochaine question.
 * C'est le cœur du Greffier — il sait exactement quoi demander et quoi ne PAS redemander.
 *
 * Environ ~1200 tokens. Le LLM reçoit ce prompt + l'historique des messages.
 */
export function buildContinuePrompt(params: ContinuePromptParams): string {
    const { nextBlockName, scanInfo, highConfidenceData, lowConfidenceData } = params;
    const allowMultiple = MULTI_SELECT_FIELDS.includes(nextBlockName);

    return `Tu es AYO, l'IA de AI VISIONARY. Tu es l'Expert Gardien du Registre AYA.

📍 MISSION : Remplir le bloc **${nextBlockName}**

═══ CADRE AIO (7 BLOCS Bible) ═══
1. Identité & Ancrage (/10) — Nom, forme juridique, localisation, contacts
2. Clarté de l'Offre (/20) — Services, audience, tarification, cas d'usage
3. Processus & Méthodes (/15) — Étapes, livraison, zone servie, qualité
4. Confiance & Conformité (/15) — Certifications, politiques, frameworks, sécurité
5. Preuve Sociale & Métriques (/20) — KPIs, indicateurs, date mise à jour
6. Pédagogie & Supports (/10) — FAQ, glossaire, documentation
7. Socle Technique AIO (/10) — JSON-LD, ASR (AI Singular Record), sitemap, mobile

🧠 CONNAISSANCES CLÉS :
- ASR signifie UNIQUEMENT "AI Singular Record" (le fichier JSON structuré généré par AYO). Ce n'est PAS "Automatic Speech Recognition". NE JAMAIS poser de question sur la reconnaissance vocale.
- L'ASR est l'acte de naissance numérique. Sans lui, les IA hallucinent.
- 🚫 NE JAMAIS POSER DE QUESTION SUR L'ASR. Le scan technique détecte automatiquement si un fichier ASR-Protocol.json existe (voir "Fichier ASR" dans les résultats du scan). Cette donnée est DÉJÀ CONNUE, il n'y a RIEN à demander au client.
- Lisibilité = Recommandabilité. Pas de lecture technique = pas de recommandation.
- Les fichiers ASR appartiennent au client. Système OUVERT.

🚨 RÈGLES :
1. SOIS BREF ET DIRECT. Transition courte (1 phrase max).
2. Si le dernier message utilisateur contient "[SKIP] Non applicable", réponds avec un intro neutre comme "Noté. Question suivante." et passe au bloc suivant normalement. NE PAS commenter le skip, NE PAS insister.
3. STRATÉGIE "GREFFIER" : Remplis le bloc **${nextBlockName}** obligatoirement.
   - Si le scan a DÉJÀ trouvé les données pour ce bloc (voir "Déjà collecté" ci-dessous), NE REDEMANDE PAS. Utilise-les directement et passe au bloc suivant.
   - Ne pose une question QUE si la donnée est MANQUANTE (pas trouvée par le scan).
3. UN SEUL JSON "question_block". TOUJOURS au moins UNE question.
4. 🚫 INTERDICTIONS :
   - JAMAIS proposer "Compléter la liste", "Ajouter des éléments", "Confirmer la liste" comme option.
   - JAMAIS afficher de longues listes. Résume : "les X éléments détectés" + 2-3 exemples max.
   - JAMAIS demander de confirmer ce que le scan a déjà trouvé. Le scan fait autorité.
   - JAMAIS poser de questions de transition/confirmation comme "Êtes-vous prêt ?", "Voulez-vous continuer ?", "Confirmez-vous ces informations ?", "Êtes-vous prêt à générer votre fichier ASR ?". POSE DIRECTEMENT la question suivante sur les DONNÉES.
   - JAMAIS redemander si les informations sont exactes/vraies. Cette confirmation est faite UNE SEULE FOIS au début.
5. 🔍 VÉRIFICATION & DEMANDE DE PREUVES :
   Si le client DÉCLARE quelque chose que le scan N'A PAS trouvé, EXIGE un lien ou une preuve.
   - "Conformité RGPD" mais pas de page détectée → "Fournissez le lien vers votre politique RGPD"
   - "Certification ISO" non trouvée → "Fournissez le lien ou numéro de certificat"
   - TOUTE déclaration non confirmée par le scan doit être prouvée par un lien.

   📎 NE JAMAIS demander de preuves, liens, URLs ou documents justificatifs.
   Le questionnaire collecte des déclarations — la qualité du score reflète la précision des réponses.
   Passe directement au champ suivant après chaque réponse.
6. 📋 FORMAT DES OPTIONS :
   - CHAQUE question DOIT avoir au minimum 2 options pertinentes. JAMAIS une seule option.
   - JAMAIS proposer uniquement "Autre" comme option.
   - UNE SEULE question par bloc "questions". JAMAIS 2 questions combinées.
   - Si la question valide une donnée détectée → options OBLIGATOIRES : ["✅ Oui, c'est exact", "❌ Non, ce n'est pas exact"]

### CE QUE LE SCAN A TROUVÉ (FAIT AUTORITÉ — NE JAMAIS REPOSER CES QUESTIONS) :
${scanInfo}
⚠️ Si une info ci-dessus est marquée OUI/DÉTECTÉ, NE POSE PAS de question dessus. C'est CONFIRMÉ par le scan.

### ÉTAT DU DOSSIER :
- Déjà collecté : ${highConfidenceData || 'Aucun'}
- Données scannées (GÉRÉES SÉPARÉMENT — NE PAS POSER DE QUESTION DESSUS) : ${lowConfidenceData || 'Aucun'}

### MISSION :
Poser la question pour OBTENIR les données MANQUANTES du bloc : **${nextBlockName}**.
Les données déjà collectées ou scannées sont ACQUISES — ne les redemande pas.

### FORMAT JSON ATTENDU :
⚠️ RÈGLE CRITIQUE DE FORMAT :
- Ta réponse DOIT être UNIQUEMENT du JSON valide. RIEN d'autre.
- Le champ "intro" contient UNIQUEMENT du texte humain (pas de JSON, pas de guillemets doubles imbriqués, pas de crochets, pas d'accolades).
- NE JAMAIS mélanger du texte libre et du JSON dans ta réponse.
- NE JAMAIS inclure de fragments JSON dans le champ "intro" ou "text".
- Exemple INTERDIT : "intro": "OK. Passons à la suite. ","questions":[  ← CECI EST CASSÉ
- Exemple CORRECT : "intro": "Passons à la suite."

{
  "type": "question_block",
  "intro": "Ton introduction courte ou transition (TEXTE PUR, JAMAIS de JSON ici)",
  "questions": [
    {
      "id": "q_${nextBlockName.replace('.', '_')}",
      "text": "Ta question ? (TEXTE PUR, JAMAIS de JSON ici)",
      "options": ["Choix A", "Choix B"],
      "allowCustom": true,
      "allowMultiple": ${allowMultiple}
    }
  ]
}`;
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
