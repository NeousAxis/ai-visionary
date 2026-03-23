/**
 * Multi-Agents AYO — Barrel Export
 *
 * 7 agents, chacun avec 1 seul rôle :
 *
 * AYO (Routeur)     — Orchestre, parle au client       — 0 LLM
 * SCANNER            — Crawl technique                  — 0 LLM
 * GREFFIER           — Questions ciblées                — LLM (~800 tok/question)
 * ANALYSTE           — Score + validation sémantique    — 0 LLM
 * VENDEUR            — Tunnel Stripe                    — 0 LLM
 * ARCHITECTE         — Génère 5 fichiers PRO            — 1 appel LLM
 * CONTRÔLE QUALITÉ   — Valide avant livraison           — 0 LLM
 */

// AYO Routeur (machine à états)
export {
    AyoState,
    createSession,
    transition,
    canTransition,
    getNextAction,
    formatScoreMessage,
    formatDeltaMessage,
    WELCOME_MESSAGE,
    EMAIL_REQUEST,
    type AyoSession,
    type AyoAction,
} from './ayo-router';

// Scanner
export {
    performScan,
    loadScanState,
    formatScanForGreffier,
    classifyScanConfidence,
    normalizeScanStateUrl,
    scanStateDocId,
    type ScannerResult,
} from './scanner';

// Greffier
export {
    QUESTIONNAIRE,
    buildQuestionQueue,
    buildContinuePrompt,
    buildEnrichmentQuestion,
    getGreffierPrompt,
    type BlocName,
    type BlocQuestion,
    type GreffierContext,
    type ContinuePromptParams,
} from './greffier';

// Analyste
export {
    analyseScore,
    validateSemanticQuality,
    validateExtractFields,
    type AnalysteResult,
} from './analyste';

// Vendeur
export {
    buildPackPresentation,
    buildStripeLinks,
    detectPackFromPriceId,
    detectPackFromMode,
    encodeClientReference,
    decodeClientReference,
    STRIPE_PRICES,
    type PackType,
} from './vendeur';

// Architecte
export {
    generateProPack,
    generateLightPack,
    buildStructureRecommendations,
    formatRecommendationsForChat,
    getExtractionRulesForPrompt,
    ARCHITECTE_EXTRACTION_RULES,
    type ArchitecteInput,
    type ArchitecteOutput,
    type StructureRecommendation,
    type StructureRecommendationsResult,
} from './architecte';

// Contrôle Qualité
export {
    validateProPack,
    applyCorrections,
    type ProPackFiles,
    type QCResult,
    type QCError,
} from './controle-qualite';
