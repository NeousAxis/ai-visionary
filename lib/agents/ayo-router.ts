/**
 * AYO ROUTEUR — Machine à états
 *
 * AYO est le chef d'orchestre. Il est le seul à parler au client.
 * Il dispatch vers les 6 agents spécialisés et gère l'état du dossier.
 *
 * AYO gère :
 * - L'état du dossier (où on en est dans le flow)
 * - La personnalité / le ton (discours pédagogique)
 * - Le routing ("scan fini → questions → score → vente")
 * - Les erreurs ("le Scanner a planté → message propre au client")
 *
 * AYO NE gère PAS :
 * - Quelles questions poser (→ GREFFIER)
 * - Le calcul du score (→ ANALYSTE)
 * - La génération de fichiers (→ ARCHITECTE)
 * - La validation des fichiers (→ CONTRÔLE QC)
 * - Les liens Stripe (→ VENDEUR)
 */

import type { ScannerResult } from './scanner';
import type { AnalysteResult } from './analyste';
import type { BlocQuestion } from './greffier';
import type { Locale } from '../ayo-system-prompt';

// --- ÉTATS ---

export enum AyoState {
    /** En attente de l'URL du client */
    ATTENTE_URL = 'ATTENTE_URL',
    /** Scan en cours */
    SCAN_EN_COURS = 'SCAN_EN_COURS',
    /** V4: Classification du type de site */
    CLASSIFICATION = 'CLASSIFICATION',
    /** Confirmation de propriété du site */
    OWNERSHIP = 'OWNERSHIP',
    /** Avertissement vérité / anti-bullshit */
    TRUTH_WARNING = 'TRUTH_WARNING',
    /** Calibration de l'activité (description libre) */
    CALIBRATION = 'CALIBRATION',
    /** Questionnaire en cours (blocs data) */
    QUESTIONNAIRE = 'QUESTIONNAIRE',
    /** Calcul du score final + affichage */
    SCORING = 'SCORING',
    /** Sélection du pack (AYA Sub / PRO) */
    PACK_SELECT = 'PACK_SELECT',
    /** Capture de l'email */
    CAPTURE_EMAIL = 'CAPTURE_EMAIL',
    /** Paiement en cours via Stripe */
    PAIEMENT_EN_COURS = 'PAIEMENT_EN_COURS',
    /** Client existant reconnu */
    EXISTING_CLIENT = 'EXISTING_CLIENT',
    /** Fichiers livrés */
    LIVRE = 'LIVRE',
}

// --- SESSION ---

export interface AyoSession {
    /** ID unique de la session */
    sessionId: string;
    /** État courant */
    state: AyoState;
    /** URL du client */
    url: string | null;
    /** Email du client */
    email: string | null;
    /** Résultat du scan */
    scanResult: ScannerResult | null;
    /** Score initial (avant questionnaire) */
    scoreInitial: AnalysteResult | null;
    /** Score enrichi (après questionnaire) */
    scoreEnrichi: AnalysteResult | null;
    /** File de questions restantes */
    questionQueue: BlocQuestion[];
    /** Index de la question courante */
    questionIndex: number;
    /** Réponses collectées */
    answers: Record<string, any>;
    /** Données extraites (pour génération fichiers) */
    extractData: any | null;
    /** Analysis ID Firestore */
    analysisId: string | null;
    /** Date de création */
    createdAt: string;
}

/**
 * Crée une nouvelle session AYO.
 */
export function createSession(sessionId: string): AyoSession {
    return {
        sessionId,
        state: AyoState.ATTENTE_URL,
        url: null,
        email: null,
        scanResult: null,
        scoreInitial: null,
        scoreEnrichi: null,
        questionQueue: [],
        questionIndex: 0,
        answers: {},
        extractData: null,
        analysisId: null,
        createdAt: new Date().toISOString(),
    };
}

// --- TRANSITIONS ---

export interface StateTransition {
    from: AyoState;
    to: AyoState;
    trigger: string;
}

/**
 * Transitions valides de la machine à états.
 */
export const VALID_TRANSITIONS: StateTransition[] = [
    // INIT → SCAN
    { from: AyoState.ATTENTE_URL, to: AyoState.SCAN_EN_COURS, trigger: 'url_received' },
    { from: AyoState.ATTENTE_URL, to: AyoState.EXISTING_CLIENT, trigger: 'existing_client_detected' },
    // SCAN → OWNERSHIP
    { from: AyoState.SCAN_EN_COURS, to: AyoState.OWNERSHIP, trigger: 'scan_complete' },
    // OWNERSHIP → TRUTH_WARNING or abort
    { from: AyoState.OWNERSHIP, to: AyoState.TRUTH_WARNING, trigger: 'ownership_confirmed' },
    { from: AyoState.OWNERSHIP, to: AyoState.ATTENTE_URL, trigger: 'ownership_denied' },
    // TRUTH_WARNING → CALIBRATION or abort
    { from: AyoState.TRUTH_WARNING, to: AyoState.CALIBRATION, trigger: 'truth_accepted' },
    { from: AyoState.TRUTH_WARNING, to: AyoState.ATTENTE_URL, trigger: 'truth_cancelled' },
    // CALIBRATION → QUESTIONNAIRE
    { from: AyoState.CALIBRATION, to: AyoState.QUESTIONNAIRE, trigger: 'calibration_done' },
    // QUESTIONNAIRE progression
    { from: AyoState.QUESTIONNAIRE, to: AyoState.QUESTIONNAIRE, trigger: 'answer_received' },
    { from: AyoState.QUESTIONNAIRE, to: AyoState.SCORING, trigger: 'questionnaire_complete' },
    // SCORING → PACK_SELECT
    { from: AyoState.SCORING, to: AyoState.PACK_SELECT, trigger: 'score_displayed' },
    // PACK_SELECT → EMAIL
    { from: AyoState.PACK_SELECT, to: AyoState.CAPTURE_EMAIL, trigger: 'pack_selected' },
    // EMAIL → STRIPE
    { from: AyoState.CAPTURE_EMAIL, to: AyoState.PAIEMENT_EN_COURS, trigger: 'email_captured' },
    // STRIPE → LIVRE
    { from: AyoState.PAIEMENT_EN_COURS, to: AyoState.LIVRE, trigger: 'payment_confirmed' },
    // EXISTING_CLIENT can restart scan (update profile)
    { from: AyoState.EXISTING_CLIENT, to: AyoState.SCAN_EN_COURS, trigger: 'update_profile' },
];

/**
 * Vérifie qu'une transition est valide.
 */
export function canTransition(from: AyoState, to: AyoState): boolean {
    return VALID_TRANSITIONS.some(t => t.from === from && t.to === to);
}

/**
 * Effectue une transition d'état.
 * @throws si la transition est invalide
 */
export function transition(session: AyoSession, to: AyoState, trigger: string): AyoSession {
    if (!canTransition(session.state, to)) {
        console.error(`[AYO-ROUTER] Transition invalide: ${session.state} → ${to} (trigger: ${trigger})`);
        return session; // Ne pas crasher, juste logger
    }

    return {
        ...session,
        state: to,
    };
}

// --- DÉTERMINATION DE L'ACTION ---

export type AyoAction =
    | { type: 'ASK_URL' }
    | { type: 'PERFORM_SCAN'; url: string }
    | { type: 'ASK_OWNERSHIP' }
    | { type: 'ASK_TRUTH_WARNING' }
    | { type: 'ASK_CALIBRATION' }
    | { type: 'SHOW_INITIAL_SCORE'; score: AnalysteResult; scan: ScannerResult }
    | { type: 'ASK_QUESTION'; question: BlocQuestion; questionNumber: number; totalQuestions: number }
    | { type: 'COMPUTE_FINAL_SCORE' }
    | { type: 'SHOW_ENRICHED_SCORE'; scoreBefore: AnalysteResult; scoreAfter: AnalysteResult }
    | { type: 'SHOW_PACKS' }
    | { type: 'ASK_EMAIL' }
    | { type: 'PROCESS_PAYMENT'; url: string; email: string }
    | { type: 'SHOW_EXISTING_CLIENT' }
    | { type: 'GENERATE_FILES' }
    | { type: 'DELIVERED' }
    | { type: 'ERROR'; message: string };

/**
 * Détermine la prochaine action à effectuer en fonction de l'état de la session.
 */
export function getNextAction(session: AyoSession): AyoAction {
    switch (session.state) {
        case AyoState.ATTENTE_URL:
            return { type: 'ASK_URL' };

        case AyoState.SCAN_EN_COURS:
            if (!session.url) return { type: 'ERROR', message: 'URL manquante' };
            return { type: 'PERFORM_SCAN', url: session.url };

        case AyoState.OWNERSHIP:
            return { type: 'ASK_OWNERSHIP' };

        case AyoState.TRUTH_WARNING:
            return { type: 'ASK_TRUTH_WARNING' };

        case AyoState.CALIBRATION:
            return { type: 'ASK_CALIBRATION' };

        case AyoState.QUESTIONNAIRE:
            if (session.questionIndex >= session.questionQueue.length) {
                // Plus de questions → scoring
                return { type: 'COMPUTE_FINAL_SCORE' };
            }
            const question = session.questionQueue[session.questionIndex];
            return {
                type: 'ASK_QUESTION',
                question,
                questionNumber: session.questionIndex + 1,
                totalQuestions: session.questionQueue.length,
            };

        case AyoState.SCORING:
            if (session.scoreInitial && session.scoreEnrichi) {
                return {
                    type: 'SHOW_ENRICHED_SCORE',
                    scoreBefore: session.scoreInitial,
                    scoreAfter: session.scoreEnrichi,
                };
            }
            return { type: 'COMPUTE_FINAL_SCORE' };

        case AyoState.PACK_SELECT:
            return { type: 'SHOW_PACKS' };

        case AyoState.CAPTURE_EMAIL:
            return { type: 'ASK_EMAIL' };

        case AyoState.PAIEMENT_EN_COURS:
            if (!session.url || !session.email) {
                return { type: 'ERROR', message: 'URL ou email manquant pour le paiement' };
            }
            return { type: 'PROCESS_PAYMENT', url: session.url, email: session.email };

        case AyoState.EXISTING_CLIENT:
            return { type: 'SHOW_EXISTING_CLIENT' };

        case AyoState.LIVRE:
            return { type: 'DELIVERED' };

        default:
            return { type: 'ERROR', message: `État inconnu: ${session.state}` };
    }
}

// --- MESSAGE TEMPLATES ---

/**
 * Message d'accueil AYO.
 */
export const WELCOME_MESSAGE = `👋 Bonjour, ici AYO. Initialisation du protocole AIO Light. Je vais établir votre Diagnostic de Visibilité IA (Gratuit). Pour cela, indiquez-moi simplement l'URL principale de votre site web.`;

export const WELCOME_MESSAGE_EN = `👋 Hello, this is AYO. Initializing the AIO Light protocol. I will run your AI Visibility Diagnostic (Free). Simply provide me with your main website URL.`;

export function getWelcomeMessage(locale: Locale = 'en'): string {
    return locale === 'en' ? WELCOME_MESSAGE_EN : WELCOME_MESSAGE;
}

/**
 * Message de demande d'email.
 */
export const EMAIL_REQUEST = `📧 Pour vous envoyer votre rapport détaillé, j'ai besoin de votre email professionnel.`;
export const EMAIL_REQUEST_EN = `📧 To send you your detailed report, I need your professional email.`;

export function getEmailRequest(locale: Locale = 'en'): string {
    return locale === 'en' ? EMAIL_REQUEST_EN : EMAIL_REQUEST;
}

/**
 * Génère le message de score initial avec transparence du cap.
 */
export function formatScoreMessage(result: AnalysteResult, phase: 'initial' | 'enrichi', locale: Locale = 'en'): string {
    const lines: string[] = [];

    if (locale === 'en') {
        if (phase === 'initial') {
            lines.push(`📊 **INITIAL AIO SCORE: ${result.total} / 100**`);
        } else {
            lines.push(`📊 **FINAL AIO SCORE: ${result.total} / 100**`);
        }
    } else {
        if (phase === 'initial') {
            lines.push(`📊 **SCORE INITIAL AIO : ${result.total} / 100**`);
        } else {
            lines.push(`📊 **SCORE FINAL AIO : ${result.total} / 100**`);
        }
    }

    // Detailed blocks
    const blockLabelsFr: Record<string, string> = {
        identite: 'Identité & Ancrage',
        offre: 'Clarté de l\'Offre',
        processus_methodes: 'Processus & Méthodes',
        engagements_conformite: 'Confiance & Conformité',
        indicateurs: 'Preuve Sociale & Métriques',
        contenus_pedagogiques: 'Pédagogie & Supports',
        structure_technique: 'Socle Technique AIO',
    };

    const blockLabelsEn: Record<string, string> = {
        identite: 'Identity & Anchoring',
        offre: 'Offer Clarity',
        processus_methodes: 'Processes & Methods',
        engagements_conformite: 'Trust & Compliance',
        indicateurs: 'Social Proof & Metrics',
        contenus_pedagogiques: 'Educational Content',
        structure_technique: 'AIO Technical Foundation',
    };

    const blockLabels = locale === 'en' ? blockLabelsEn : blockLabelsFr;

    const blockWeights: Record<string, number> = {
        identite: 10, offre: 20, processus_methodes: 15,
        engagements_conformite: 15, indicateurs: 20,
        contenus_pedagogiques: 10, structure_technique: 10,
    };

    for (const [key, label] of Object.entries(blockLabels)) {
        const score = result.blocks[key] ?? 0;
        const max = blockWeights[key] ?? 10;
        lines.push(`🔎 ${label} : ${score}/${max}`);
    }

    // Cap transparency
    if (result.capApplied && result.capReason) {
        // Translate cap reason from FR (engine always returns FR) to EN if needed
        const capReasonDisplay = locale === 'en'
            ? (result.capReason || '')
                .replace('Pas de JSON-LD structuré détecté', 'No structured JSON-LD detected')
                .replace('score plafonné à', 'score capped at')
                .replace('Pas de fichier ASR détecté', 'No ASR file detected')
                .replace('Pas de preuve externe', 'No external proof')
            : result.capReason;
        lines.push('');
        if (locale === 'en') {
            lines.push(`📊 **RAW SCORE: ${result.rawTotal} / 100**`);
            lines.push(`⚠️ **TECHNICAL CAP**: ${capReasonDisplay}`);
            lines.push(`💡 The PRO Pack installs the technical files that lift this cap.`);
        } else {
            lines.push(`📊 **SCORE BRUT : ${result.rawTotal} / 100**`);
            lines.push(`⚠️ **PLAFOND TECHNIQUE** : ${capReasonDisplay}`);
            lines.push(`💡 Le Pack PRO installe les fichiers techniques qui lèvent ce plafond.`);
        }
    }

    return lines.join('\n');
}

/**
 * Génère le message de delta (avant/après questionnaire).
 */
export function formatDeltaMessage(before: AnalysteResult, after: AnalysteResult, locale: Locale = 'en'): string {
    const delta = Math.round((after.total - before.total) * 10) / 10;
    const sign = delta >= 0 ? '+' : '';

    if (locale === 'en') {
        return `📊 **AIO Score: ${before.total} → ${after.total} (${sign}${delta})**

Your answers have enriched your profile. The collected data now allows generating structured files for AIs.`;
    }

    return `📊 **Score AIO : ${before.total} → ${after.total} (${sign}${delta})**

Vos réponses ont enrichi votre profil. Les données collectées permettent maintenant de générer des fichiers structurés pour les IA.`;
}

// --- DÉRIVATION D'ÉTAT DEPUIS L'HISTORIQUE (STATELESS) ---

/**
 * Contexte d'historique de conversation pour dériver l'état.
 * Route.ts est stateless (serverless), on ne peut pas persister AyoSession.
 * On reconstruit l'état à partir des signaux dans l'historique.
 */
export interface ConversationSignals {
    /** URL détectée dans le dernier message user */
    hasUrlInLastMessage: boolean;
    /** URL trouvée dans l'historique */
    hasUrlInHistory: boolean;
    /** Le scan a déjà été fait (assistant a envoyé "SCAN TERMINÉ" ou "ownership_confirm") */
    hasScanInHistory: boolean;
    /** Le score final a été affiché */
    hasFinalScore: boolean;
    /** Nombre de question_blocks envoyés par l'assistant */
    questionsAskedCount: number;
    /** Nombre de steps (réponses utilisateur significatives après URL) */
    stepsCompleted: number;
    /** Client existant reconnu dans le registre AYA */
    isExistingClient: boolean;
    /** Dernier message assistant contient ownership_confirm */
    lastAssistantHasOwnership: boolean;
    /** Dernier message assistant contient truth_confirmation */
    lastAssistantHasTruth: boolean;
    /** Message est un email */
    isEmail: boolean;
    /** Message est un choix sales (abonnement, pack pro, etc.) */
    isSalesIntent: boolean;
    /** Message est un update_profile action */
    isUpdateProfile: boolean;
    /** Nombre total de blocs dans la queue combinée */
    totalQueueBlocks: number;
    /** Index du bloc suivant dans la queue */
    queueIndex: number;
    /** Locale for i18n (default 'fr') */
    locale: Locale;
}

/**
 * Dérive l'AyoState actuel depuis les signaux de la conversation.
 *
 * C'est la SEULE source de vérité pour le routage dans route.ts.
 * Remplace la logique `triggerMode` ad-hoc.
 */
export function deriveState(signals: ConversationSignals): AyoState {
    const {
        hasUrlInLastMessage, hasUrlInHistory, hasScanInHistory, hasFinalScore,
        questionsAskedCount, isExistingClient, lastAssistantHasOwnership,
        lastAssistantHasTruth, isEmail, isSalesIntent, isUpdateProfile,
        totalQueueBlocks, queueIndex, stepsCompleted,
    } = signals;

    // 1. Client existant reconnu (sauf si update profile)
    if (isExistingClient && !isUpdateProfile) {
        return AyoState.EXISTING_CLIENT;
    }

    // 2. Update profile = rescan
    if (isUpdateProfile) {
        return AyoState.SCAN_EN_COURS;
    }

    // 3. URL reçue, pas encore de scan → SCAN
    if (hasUrlInLastMessage && !hasScanInHistory && !hasFinalScore) {
        return AyoState.SCAN_EN_COURS;
    }

    // 4. Score final déjà affiché → sales funnel
    if (hasFinalScore) {
        if (isSalesIntent) return AyoState.PACK_SELECT;
        if (isEmail) return AyoState.CAPTURE_EMAIL;
        return AyoState.PACK_SELECT;
    }

    // 5. Post-scan, questionnaire en cours
    if (hasScanInHistory && hasUrlInHistory && !hasFinalScore) {
        // Ownership step (question_block #1)
        if (lastAssistantHasOwnership && stepsCompleted <= 1) {
            return AyoState.OWNERSHIP;
        }

        // Truth warning step (question_block #2)
        if (lastAssistantHasTruth) {
            return AyoState.TRUTH_WARNING;
        }

        // Calibration step (question_block #3)
        if (questionsAskedCount < 3 && stepsCompleted <= 2) {
            return AyoState.CALIBRATION;
        }

        // All queue items covered → SCORING
        if (queueIndex >= totalQueueBlocks && totalQueueBlocks > 0) {
            return AyoState.SCORING;
        }

        // Otherwise still in questionnaire
        return AyoState.QUESTIONNAIRE;
    }

    // 6. URL in history but no scan yet and URL not in last message → continue from wherever we are
    if (hasUrlInHistory && !hasScanInHistory) {
        return AyoState.SCAN_EN_COURS;
    }

    // 7. Default → attente URL
    return AyoState.ATTENTE_URL;
}

