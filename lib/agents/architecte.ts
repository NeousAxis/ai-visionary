/**
 * AGENT ARCHITECTE ASR
 *
 * Rôle : Générer les 5 fichiers PRO à partir de l'extract JSON.
 * Utilise 1 seul appel LLM (pour l'enrichissement sémantique).
 * Wraps lib/ayo-generators.ts + lib/ayo-crypto.ts
 *
 * VOCABULAIRE :
 * - ASR = AI Singular Record (l'acte de naissance numérique)
 * - ASR ≠ Automatic Speech Recognition (JAMAIS)
 */

import { generateManifestJson, generateFaqJson, generateGlossaryJson, generateExternalContextJsonLocal } from '../ayo-generators';
import { generateRealAsrJson } from '../ayo-crypto';
import { validateProPack, applyCorrections, type ProPackFiles, type QCResult } from './controle-qualite';
import type { AnalysteResult } from './analyste';

export interface ArchitecteInput {
    /** Données extraites du questionnaire + scan */
    extractData: any;
    /** URL du site analysé */
    url: string;
    /** Email du client */
    email: string;
    /** Mode de génération */
    mode: 'LIGHT' | 'PRO' | 'PLATEFORME';
    /** Score AIO total */
    score: number;
    /** Date ISO */
    date: string;
    /** ASR ID unique */
    asrId: string;
}

export interface ArchitecteOutput {
    files: ProPackFiles;
    qcResult: QCResult;
    /** true si les fichiers ont passé le QC (avec ou sans corrections) */
    delivered: boolean;
    /** Nombre de tentatives de correction */
    attempts: number;
}

/**
 * PROMPT SPÉCIALISÉ pour l'enrichissement sémantique.
 * L'Architecte sait que ASR = AI Singular Record.
 */
export const ARCHITECTE_EXTRACTION_RULES = `
RÈGLES DE FORMAT STRICTES POUR L'EXTRACTION :

1. target_audience : DOIT être des segments courts séparés par virgule.
   ✅ "Développeurs IA, data scientists, entreprises ESG"
   ❌ "Api-glossaries.com a été développé spécifiquement pour répondre aux demandes..."
   → Si la valeur est une phrase complète (>80 chars sans virgule), EXTRAIRE les segments clés.

2. products : DOIT être des noms complets avec parenthèses fermées.
   ✅ ["Glossaire CSRD (Corporate Sustainability Reporting Directive)"]
   ❌ ["Glossaire CSRD (Corporate Sustainability Reporting Dir"]
   → TOUJOURS fermer les parenthèses.

3. quality_assurance : DOIT être un array [], JAMAIS une string.
   ✅ ["Revue par les pairs", "Tests automatisés"]
   ❌ "Revue par les pairs, Tests automatisés"
   → Si vide, retourner [].

4. geographies_served : Si le client n'a pas de zone spécifique, utiliser le pays.
   ✅ "Suisse" ou "Global" ou "France, Belgique, Suisse"
   ❌ ""

5. discovery_keywords : Max 50 caractères par entrée. JAMAIS de descriptions longues.
   ✅ ["glossaire ESG", "API données durabilité", "CSRD terminologie"]
   ❌ ["Accès à des glossaires ESG spécialisés (CSRD, GHG Protocol, TCFD, Taxonomie EU, etc.)"]

6. intent_keywords : Max 80 caractères par entrée.
   ✅ ["Définir la CSRD", "Comprendre la taxonomie européenne"]
   ❌ [descriptions de 150 chars]

VOCABULAIRE :
- ASR = AI Singular Record (l'acte de naissance numérique d'une entité pour les IA)
- ASR ≠ Automatic Speech Recognition
- AIO = AI Optimization
- AYA = AI Verified Authority (registre certifié)
`;

/**
 * Génère les 5 fichiers PRO et les fait passer par le Contrôle Qualité.
 * Boucle de correction : max 2 tentatives.
 */
export async function generateProPack(input: ArchitecteInput): Promise<ArchitecteOutput> {
    const MAX_ATTEMPTS = 2;
    let attempts = 0;
    let currentFiles: ProPackFiles;
    let qcResult: QCResult;

    // Génération initiale
    const asrJson = await generateRealAsrJson(
        input.extractData, input.score, input.date, input.asrId, input.mode, input.url
    );
    const manifestJson = generateManifestJson(input.extractData, input.url);
    const faqJson = generateFaqJson(input.extractData, input.url);
    const glossaryJson = generateGlossaryJson(input.extractData);
    const externalContextJson = generateExternalContextJsonLocal(input.extractData, input.url);

    currentFiles = {
        asr: asrJson,
        faq: faqJson,
        glossary: glossaryJson,
        externalContext: externalContextJson,
        manifest: manifestJson,
    };

    // Boucle QC
    do {
        attempts++;
        qcResult = validateProPack(currentFiles);

        if (qcResult.passed) {
            // QC passé — appliquer les corrections automatiques si nécessaire
            if (qcResult.errors.some(e => e.severity === 'correctable')) {
                currentFiles = applyCorrections(currentFiles, qcResult.errors);
            }
            break;
        }

        if (attempts < MAX_ATTEMPTS) {
            // Appliquer les corrections automatiques et retester
            currentFiles = applyCorrections(currentFiles, qcResult.errors);
            console.warn(`[ARCHITECTE] QC échoué (tentative ${attempts}/${MAX_ATTEMPTS}), corrections appliquées. Erreurs bloquantes: ${qcResult.errors.filter(e => e.severity === 'blocking').length}`);
        } else {
            console.error(`[ARCHITECTE] QC échoué après ${MAX_ATTEMPTS} tentatives. Erreurs bloquantes:`,
                qcResult.errors.filter(e => e.severity === 'blocking').map(e => `${e.file}:${e.field} — ${e.message}`));
        }
    } while (attempts < MAX_ATTEMPTS);

    return {
        files: currentFiles,
        qcResult,
        delivered: qcResult.passed,
        attempts,
    };
}

/**
 * Génère uniquement le fichier ASR Light (pour le pack gratuit).
 */
export async function generateLightPack(
    extractData: any, score: number, date: string, asrId: string
): Promise<Record<string, unknown>> {
    return generateRealAsrJson(extractData, score, date, asrId, 'LIGHT');
}

// --- RECOMMANDATIONS STRUCTURELLES (PRÉ-VENTE) ---

export interface StructureRecommendation {
    /** Nom du fichier PRO concerné */
    file: 'ASR-Protocol.json' | 'manifest.json' | 'faq.json' | 'glossary.json' | 'external_context.json';
    /** Icône associée */
    icon: string;
    /** Ce que le fichier apporterait (personnalisé selon les lacunes) */
    benefit: string;
    /** Priorité (1 = critique, 2 = important, 3 = bonus) */
    priority: 1 | 2 | 3;
}

export interface StructureRecommendationsResult {
    /** Recommandations ordonnées par priorité */
    recommendations: StructureRecommendation[];
    /** Résumé texte pour le message AYO */
    summary: string;
    /** Estimation du gain de score potentiel */
    estimatedScoreGain: number;
}

/**
 * Analyse les données extraites + le score pour générer des recommandations
 * personnalisées sur les fichiers PRO qui seraient générés.
 *
 * Utilisé dans le flux chat APRÈS le scoring (FINAL_ANALYSIS) pour montrer
 * au client ce que le Pack PRO lui apporterait concrètement.
 *
 * 0 appel LLM — logique déterministe.
 */
export function buildStructureRecommendations(
    extractData: any,
    scoreResult: AnalysteResult,
): StructureRecommendationsResult {
    const recommendations: StructureRecommendation[] = [];
    const fields = extractData?.fields || {};
    let estimatedGain = 0;

    // 1. ASR-Protocol — Toujours prioritaire si pas de fichier ASR
    const hasAsr = fields.structure_technique?.has_asr?.value === true;
    if (!hasAsr) {
        const techScore = scoreResult.blocks.structure_technique ?? 0;
        const techMax = 10;
        const potentialGain = techMax - techScore;
        estimatedGain += Math.min(potentialGain, 8); // ASR débloque le cap technique
        recommendations.push({
            file: 'ASR-Protocol.json',
            icon: '👑',
            benefit: scoreResult.capApplied
                ? `Lève le plafond technique (score brut ${scoreResult.rawTotal} → potentiel réel). Ce fichier est la carte d'identité IA de votre entreprise.`
                : `Permet aux IA de vous identifier avec certitude. Actuellement, aucun fichier ASR n'est détecté sur votre site.`,
            priority: 1,
        });
    } else {
        recommendations.push({
            file: 'ASR-Protocol.json',
            icon: '👑',
            benefit: `Mise à jour de votre ASR existant avec les données enrichies du questionnaire (version signée).`,
            priority: 2,
        });
    }

    // 2. manifest.json — Politique de recommandation
    const identiteScore = scoreResult.blocks.identite ?? 0;
    const offreScore = scoreResult.blocks.offre ?? 0;
    if (identiteScore < 8 || offreScore < 15) {
        estimatedGain += 3;
        recommendations.push({
            file: 'manifest.json',
            icon: '⚙️',
            benefit: `Définit les conditions de recommandation : quand et comment les IA doivent vous citer. ${identiteScore < 5 ? 'Votre identité est incomplète — le manifest comblera les lacunes.' : 'Optimise la précision des recommandations IA.'}`,
            priority: identiteScore < 5 ? 1 : 2,
        });
    } else {
        recommendations.push({
            file: 'manifest.json',
            icon: '⚙️',
            benefit: `Politique de recommandation stricte pour contrôler comment les IA vous présentent.`,
            priority: 3,
        });
    }

    // 3. faq.json — Réponses contextuelles LLM
    const hasFaq = fields.contenus_pedagogiques?.has_faq?.value === true;
    const hasFaqSchema = fields.contenus_pedagogiques?.has_faq?.q === 1;
    if (!hasFaq || !hasFaqSchema) {
        estimatedGain += 4;
        recommendations.push({
            file: 'faq.json',
            icon: '💬',
            benefit: `Génère des réponses contextuelles que les IA (ChatGPT, Gemini, Claude) pourront utiliser directement. ${!hasFaq ? 'Aucune FAQ détectée actuellement.' : 'Votre FAQ existe mais n\'est pas structurée pour les LLMs.'}`,
            priority: !hasFaq ? 1 : 2,
        });
    } else {
        recommendations.push({
            file: 'faq.json',
            icon: '💬',
            benefit: `FAQ enrichie et structurée au format LLM-native à partir de vos données.`,
            priority: 3,
        });
    }

    // 4. glossary.json — Vocabulaire métier
    const hasGlossary = fields.contenus_pedagogiques?.has_glossary?.value === true;
    if (!hasGlossary) {
        estimatedGain += 3;
        recommendations.push({
            file: 'glossary.json',
            icon: '📖',
            benefit: `Vocabulaire métier précis pour éviter les hallucinations. Sans glossaire, les IA inventent leur propre terminologie pour vous décrire.`,
            priority: 2,
        });
    } else {
        recommendations.push({
            file: 'glossary.json',
            icon: '📖',
            benefit: `Glossaire enrichi et normalisé à partir de votre vocabulaire métier existant.`,
            priority: 3,
        });
    }

    // 5. external_context.json — Signaux externes
    const externalScore = scoreResult.contextual?.brand_authority ?? 0;
    const hasKeywords = (fields.external_context?.keywords?.value?.length ?? 0) > 0;
    if (externalScore < 0.5 || !hasKeywords) {
        estimatedGain += 3;
        recommendations.push({
            file: 'external_context.json',
            icon: '🌐',
            benefit: `Encapsule vos avis, signaux de réputation et mots-clés dans un format lisible par les IA. ${!hasKeywords ? 'Aucun mot-clé de découverte détecté.' : 'Renforce votre autorité de marque.'}`,
            priority: 2,
        });
    } else {
        recommendations.push({
            file: 'external_context.json',
            icon: '🌐',
            benefit: `Signaux externes et mots-clés de découverte consolidés et signés.`,
            priority: 3,
        });
    }

    // Trier par priorité
    recommendations.sort((a, b) => a.priority - b.priority);

    // Cap le gain estimé
    estimatedGain = Math.min(estimatedGain, 100 - scoreResult.total);
    estimatedGain = Math.max(estimatedGain, 5); // minimum 5 points de gain annoncé

    // Construire le résumé
    const criticalCount = recommendations.filter(r => r.priority === 1).length;
    const currentScore = scoreResult.total;

    let summary: string;
    if (currentScore < 30) {
        summary = `Votre visibilité IA est très faible (${currentScore}/100). ${criticalCount} fichier(s) critique(s) manquent pour que les IA puissent vous identifier et vous recommander. Le Pack PRO pourrait augmenter votre score de +${estimatedGain} points.`;
    } else if (currentScore < 60) {
        summary = `Votre base existe (${currentScore}/100) mais les IA ne peuvent pas encore vous recommander de manière fiable. Les 5 fichiers PRO structurent vos données pour un gain estimé de +${estimatedGain} points.`;
    } else {
        summary = `Bonne base (${currentScore}/100). Les fichiers PRO verrouillent votre visibilité et empêchent les hallucinations. Gain estimé : +${estimatedGain} points.`;
    }

    return { recommendations, summary, estimatedScoreGain: estimatedGain };
}

/**
 * Formate les recommandations de l'Architecte en texte Markdown pour le message AYO.
 * Utilisé dans la réponse FINAL_ANALYSIS pour personnaliser le pitch PRO.
 */
export function formatRecommendationsForChat(result: StructureRecommendationsResult): string {
    const lines: string[] = [];

    lines.push(`💡 **ANALYSE STRUCTURELLE — AGENT ARCHITECTE**`);
    lines.push('');
    lines.push(result.summary);
    lines.push('');
    lines.push(`**Vos 5 fichiers PRO personnalisés :**`);

    for (const rec of result.recommendations) {
        const priorityTag = rec.priority === 1 ? ' ⚡' : '';
        lines.push(`${rec.icon} **${rec.file}**${priorityTag} → ${rec.benefit}`);
    }

    if (result.estimatedScoreGain > 0) {
        lines.push('');
        lines.push(`📈 **Gain estimé : +${result.estimatedScoreGain} points** sur votre score AIO.`);
    }

    return lines.join('\n');
}

/**
 * Retourne les règles d'extraction de l'Architecte formatées pour injection
 * dans le prompt d'extraction LLM de route.ts.
 *
 * Centralise les règles de format qui étaient dupliquées inline.
 */
export function getExtractionRulesForPrompt(): string {
    return ARCHITECTE_EXTRACTION_RULES;
}
