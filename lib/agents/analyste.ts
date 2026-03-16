/**
 * AGENT ANALYSTE
 *
 * Rôle : Calculer le score AIO + valider la qualité sémantique des réponses.
 * Zéro LLM — formule déterministe + patterns regex.
 *
 * Wraps lib/aio-score-engine.ts + ajoute la validation sémantique.
 */

import { computeAioScore, type AyoExtract, type Quality } from '../aio-score-engine';

// --- VALIDATION SÉMANTIQUE ---
// Détecte les réponses qui ne méritent PAS q=1

const NEGATION = /^(non|aucun|rien|pas de|n'ai pas|ne sais pas|pas applicable|pas encore|jamais|néant|zéro|nul|aucune?|non applicable|n\/a|na)$/i;
const VAGUE = /^(oui|ok|possible|peut-être|on verra|un peu|quelques|certains|moyen|normal|standard|classique|basique|simple|bien|correct|pas mal)$/i;
const HOSTILE = /regarde pas|mêle pas|vie privée|confidentiel|secret|pas tes affaires|ça ne te|occupe.toi|ta gueule|connard|merde/i;
const CONFIRMATION_ONLY = /^(oui c'est correct|exact|c'est bon|parfait|je confirme|d'accord|ok merci|voilà|effectivement|tout à fait|absolument)$/i;
const EMPTY_EQUIVALENT = /^(aucun(e)?|rien|néant|pas de|non|nul|\/|\.|-|n\/a|na|none|nothing|no)$/i;

/**
 * Valide la qualité sémantique d'une valeur et retourne le q ajusté.
 */
export function validateSemanticQuality(value: unknown, currentQ: Quality): Quality {
    // Null / undefined / empty → q=0
    if (value === null || value === undefined) return 0;

    // Array vide → q=0
    if (Array.isArray(value)) {
        const filtered = value.filter(v => v !== null && v !== undefined && String(v).trim() !== '');
        if (filtered.length === 0) return 0;
        // Array avec un seul élément vide/négation
        if (filtered.length === 1 && EMPTY_EQUIVALENT.test(String(filtered[0]).trim())) return 0;
        return currentQ;
    }

    // Boolean → garder tel quel
    if (typeof value === 'boolean') return currentQ;

    // String
    const str = String(value).trim();

    // Vide ou trop court
    if (!str || str.length < 2) return 0;

    // Négation explicite
    if (NEGATION.test(str)) return 0;

    // Réponse hostile
    if (HOSTILE.test(str)) return 0;

    // Confirmation seule (pas d'info nouvelle)
    if (CONFIRMATION_ONLY.test(str)) return 0;

    // Équivalent vide
    if (EMPTY_EQUIVALENT.test(str)) return 0;

    // Réponse vague → max 0.5
    if (VAGUE.test(str)) return Math.min(currentQ, 0.5) as Quality;

    return currentQ;
}

/**
 * Applique la validation sémantique sur TOUS les champs d'un extract.
 * Modifie les q-values en place.
 */
export function validateExtractFields(extract: AyoExtract): AyoExtract {
    const validated = JSON.parse(JSON.stringify(extract)) as AyoExtract;

    // Parcourir tous les blocs et leurs champs
    const blocks = validated.fields;
    for (const blockKey of Object.keys(blocks) as (keyof typeof blocks)[]) {
        const block = blocks[blockKey];
        if (!block || typeof block !== 'object') continue;

        for (const fieldKey of Object.keys(block)) {
            const node = (block as any)[fieldKey];
            if (!node || typeof node !== 'object' || !('q' in node)) continue;

            // Appliquer la validation sémantique
            const adjustedQ = validateSemanticQuality(node.value, node.q);
            if (adjustedQ !== node.q) {
                node.q = adjustedQ;
                if (!node.evidence) node.evidence = [];
                node.evidence.push(`[ANALYSTE] q ajusté de ${node.q} → ${adjustedQ} (validation sémantique)`);
            }
        }
    }

    return validated;
}

// --- SCORE AIO ---

export interface AnalysteResult {
    /** Score total (après caps) */
    total: number;
    /** Score brut avant caps */
    rawTotal: number;
    /** Cap appliqué ? */
    capApplied: boolean;
    /** Raison du cap */
    capReason: string | null;
    /** Scores par bloc */
    blocks: Record<string, number>;
    /** Audit détaillé par bloc */
    audit: Record<string, {
        score: number;
        max: number;
        label: string;
        status: string;
        observation: string;
    }>;
    /** Scores contextuels */
    contextual: {
        local_search: number;
        premium_expert: number;
        brand_authority: number;
    };
    /** Métadonnées */
    meta: {
        has_jsonld: boolean | null;
        has_asr: boolean;
        reachable: boolean | null;
    };
}

/**
 * Calcule le score AIO complet avec validation sémantique préalable.
 *
 * 1. Valide les q-values (corrige les réponses poubelle)
 * 2. Calcule le score via le moteur déterministe
 * 3. Ajoute la transparence du hard cap
 */
export function analyseScore(extract: AyoExtract): AnalysteResult {
    // 1. Validation sémantique
    const validated = validateExtractFields(extract);

    // 2. Calcul du score via le moteur existant
    const raw = computeAioScore(validated);

    // 3. Détecter le cap appliqué
    const scanHasJsonLd = validated.source.scan.has_jsonld;
    const isAyaRegistered = validated.source.scan.is_aya_registered === true;
    const hasAsr = validated.source.scan.has_asr_file === true ||
        validated.fields?.structure_technique?.has_asr?.value === true ||
        isAyaRegistered;

    // Calculer le score brut (sans caps)
    const rawBlocks = Object.values(raw.blocks);
    const rawTotal = Math.round(rawBlocks.reduce((a, b) => a + b, 0) * 10) / 10;

    let capApplied = false;
    let capReason: string | null = null;

    if (scanHasJsonLd === false && !isAyaRegistered && rawTotal > 50) {
        capApplied = true;
        capReason = 'Pas de JSON-LD structuré détecté — score plafonné à 50/100';
    } else if (!hasAsr && rawTotal > 90) {
        capApplied = true;
        capReason = 'Pas de fichier ASR (AI Singular Record) — score plafonné à 90/100';
    }

    return {
        total: raw.total,
        rawTotal,
        capApplied,
        capReason,
        blocks: raw.blocks as Record<string, number>,
        audit: raw.audit as AnalysteResult['audit'],
        contextual: raw.contextual,
        meta: raw.meta as AnalysteResult['meta'],
    };
}
