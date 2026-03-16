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
