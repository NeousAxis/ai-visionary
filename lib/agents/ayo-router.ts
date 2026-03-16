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

// --- ÉTATS ---

export enum AyoState {
    /** En attente de l'URL du client */
    ATTENTE_URL = 'ATTENTE_URL',
    /** Scan en cours */
    SCAN_EN_COURS = 'SCAN_EN_COURS',
    /** Questionnaire en cours */
    QUESTIONNAIRE = 'QUESTIONNAIRE',
    /** Capture de l'email */
    CAPTURE_EMAIL = 'CAPTURE_EMAIL',
    /** Proposition des packs */
    PROPOSITION_PACKS = 'PROPOSITION_PACKS',
    /** Paiement en cours via Stripe */
    PAIEMENT_EN_COURS = 'PAIEMENT_EN_COURS',
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
    { from: AyoState.ATTENTE_URL, to: AyoState.SCAN_EN_COURS, trigger: 'url_received' },
    { from: AyoState.SCAN_EN_COURS, to: AyoState.QUESTIONNAIRE, trigger: 'scan_complete' },
    { from: AyoState.QUESTIONNAIRE, to: AyoState.QUESTIONNAIRE, trigger: 'answer_received' },
    { from: AyoState.QUESTIONNAIRE, to: AyoState.CAPTURE_EMAIL, trigger: 'questionnaire_complete' },
    { from: AyoState.CAPTURE_EMAIL, to: AyoState.PROPOSITION_PACKS, trigger: 'email_captured' },
    { from: AyoState.PROPOSITION_PACKS, to: AyoState.PAIEMENT_EN_COURS, trigger: 'pack_selected' },
    { from: AyoState.PAIEMENT_EN_COURS, to: AyoState.LIVRE, trigger: 'payment_confirmed' },
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
    | { type: 'SHOW_INITIAL_SCORE'; score: AnalysteResult; scan: ScannerResult }
    | { type: 'ASK_QUESTION'; question: BlocQuestion; questionNumber: number; totalQuestions: number }
    | { type: 'SHOW_ENRICHED_SCORE'; scoreBefore: AnalysteResult; scoreAfter: AnalysteResult }
    | { type: 'ASK_EMAIL' }
    | { type: 'SHOW_PACKS'; url: string; email: string }
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

        case AyoState.QUESTIONNAIRE:
            if (session.questionIndex >= session.questionQueue.length) {
                // Plus de questions → passage au score enrichi
                if (session.scoreInitial && session.scoreEnrichi) {
                    return {
                        type: 'SHOW_ENRICHED_SCORE',
                        scoreBefore: session.scoreInitial,
                        scoreAfter: session.scoreEnrichi,
                    };
                }
                return { type: 'ASK_EMAIL' };
            }
            const question = session.questionQueue[session.questionIndex];
            return {
                type: 'ASK_QUESTION',
                question,
                questionNumber: session.questionIndex + 1,
                totalQuestions: session.questionQueue.length,
            };

        case AyoState.CAPTURE_EMAIL:
            return { type: 'ASK_EMAIL' };

        case AyoState.PROPOSITION_PACKS:
            if (!session.url || !session.email) {
                return { type: 'ERROR', message: 'URL ou email manquant pour les packs' };
            }
            return { type: 'SHOW_PACKS', url: session.url, email: session.email };

        case AyoState.PAIEMENT_EN_COURS:
            return { type: 'GENERATE_FILES' };

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

/**
 * Message de demande d'email.
 */
export const EMAIL_REQUEST = `📧 Pour vous envoyer votre rapport détaillé, j'ai besoin de votre email professionnel.`;

/**
 * Génère le message de score initial avec transparence du cap.
 */
export function formatScoreMessage(result: AnalysteResult, phase: 'initial' | 'enrichi'): string {
    const lines: string[] = [];

    if (phase === 'initial') {
        lines.push(`📊 **SCORE INITIAL AIO : ${result.total} / 100**`);
    } else {
        lines.push(`📊 **SCORE FINAL AIO : ${result.total} / 100**`);
    }

    // Blocs détaillés
    const blockLabels: Record<string, string> = {
        identite: 'Identité & Ancrage',
        offre: 'Clarté de l\'Offre',
        processus_methodes: 'Processus & Méthodes',
        engagements_conformite: 'Confiance & Conformité',
        indicateurs: 'Preuve Sociale & Métriques',
        contenus_pedagogiques: 'Pédagogie & Supports',
        structure_technique: 'Socle Technique AIO',
    };

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

    // Transparence du cap
    if (result.capApplied && result.capReason) {
        lines.push('');
        lines.push(`📊 **SCORE BRUT : ${result.rawTotal} / 100**`);
        lines.push(`⚠️ **PLAFOND TECHNIQUE** : ${result.capReason}`);
        lines.push(`💡 Le Pack PRO installe les fichiers techniques qui lèvent ce plafond.`);
    }

    return lines.join('\n');
}

/**
 * Génère le message de delta (avant/après questionnaire).
 */
export function formatDeltaMessage(before: AnalysteResult, after: AnalysteResult): string {
    const delta = Math.round((after.total - before.total) * 10) / 10;
    const sign = delta >= 0 ? '+' : '';

    return `📊 **Score AIO : ${before.total} → ${after.total} (${sign}${delta})**

Vos réponses ont enrichi votre profil. Les données collectées permettent maintenant de générer des fichiers structurés pour les IA.`;
}
