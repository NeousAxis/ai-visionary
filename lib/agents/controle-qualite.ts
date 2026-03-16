/**
 * AGENT CONTRÔLE QUALITÉ
 *
 * Rôle : Valider les 5 fichiers PRO AVANT livraison au client.
 * Zéro LLM — règles déterministes uniquement.
 *
 * Si un fichier échoue, retourne la liste d'erreurs pour correction par l'ARCHITECTE.
 */

export interface QCError {
    file: string;
    field: string;
    message: string;
    severity: 'blocking' | 'correctable';
    correctedValue?: unknown;
}

export interface QCResult {
    passed: boolean;
    errors: QCError[];
    corrected: boolean; // true si des corrections automatiques ont été appliquées
}

// --- Règles de validation ---

function validateAsr(asr: Record<string, unknown>): QCError[] {
    const errors: QCError[] = [];

    // 1. Audience ne doit pas être une phrase complète
    const audience = String((asr as any)?.offer?.audience || '');
    if (audience.length > 100 && !audience.includes(',')) {
        errors.push({
            file: 'ASR-Protocol.json',
            field: 'offer.audience',
            message: `Audience est une phrase complète (${audience.length} chars), devrait être des segments courts`,
            severity: 'blocking',
        });
    }
    // Audience ne doit pas contenir d'URL
    if (/[a-zA-Z0-9-]+\.[a-z]{2,}/i.test(audience) && audience.length > 50) {
        errors.push({
            file: 'ASR-Protocol.json',
            field: 'offer.audience',
            message: 'Audience contient une URL',
            severity: 'blocking',
        });
    }

    // 2. Products doivent avoir des parenthèses fermées
    const products: string[] = (asr as any)?.offer?.products || [];
    if (Array.isArray(products)) {
        for (const p of products) {
            const opens = (p.match(/\(/g) || []).length;
            const closes = (p.match(/\)/g) || []).length;
            if (opens > closes) {
                errors.push({
                    file: 'ASR-Protocol.json',
                    field: 'offer.products',
                    message: `Produit tronqué (parenthèse non fermée): "${p}"`,
                    severity: 'blocking',
                });
            }
        }
    }

    // 3. quality_assurance DOIT être un array
    const qa = (asr as any)?.processus?.quality_assurance;
    if (qa !== undefined && !Array.isArray(qa)) {
        errors.push({
            file: 'ASR-Protocol.json',
            field: 'processus.quality_assurance',
            message: `quality_assurance est "${typeof qa}" au lieu d'un array`,
            severity: 'correctable',
            correctedValue: typeof qa === 'string' && qa ? qa.split(',').map((s: string) => s.trim()).filter(Boolean) : [],
        });
    }

    // 4. geographies_served ne doit pas être vide
    const geo = (asr as any)?.processus?.geographies_served;
    if (!geo || (typeof geo === 'string' && geo.trim() === '')) {
        errors.push({
            file: 'ASR-Protocol.json',
            field: 'processus.geographies_served',
            message: 'geographies_served est vide',
            severity: 'correctable',
            correctedValue: (asr as any)?.identity?.location || 'Non spécifié',
        });
    }

    // 5. Pas de "Entreprise Inconnue" ou "Non spécifié" dans les champs critiques
    const name = String((asr as any)?.identity?.name || '');
    if (!name || name === 'Entreprise Inconnue' || name === 'Unknown Entity') {
        errors.push({
            file: 'ASR-Protocol.json',
            field: 'identity.name',
            message: 'Nom manquant ou générique',
            severity: 'blocking',
        });
    }

    // 6. URL en minuscule
    const url = String((asr as any)?.identity?.url || '');
    if (url !== url.toLowerCase()) {
        errors.push({
            file: 'ASR-Protocol.json',
            field: 'identity.url',
            message: 'URL contient des majuscules',
            severity: 'correctable',
            correctedValue: url.toLowerCase(),
        });
    }

    return errors;
}

function validateFaq(faq: Record<string, unknown>): QCError[] {
    const errors: QCError[] = [];

    const items: any[] = (faq as any)?.faq_items || (faq as any)?.items || [];
    if (!Array.isArray(items) || items.length === 0) {
        errors.push({
            file: 'faq.json',
            field: 'faq_items',
            message: 'Aucun item FAQ',
            severity: 'blocking',
        });
        return errors;
    }

    for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const answer = String(item?.answer || item?.acceptedAnswer?.text || '');
        if (answer.length < 20) {
            errors.push({
                file: 'faq.json',
                field: `faq_items[${i}].answer`,
                message: `Réponse trop courte (${answer.length} chars): "${answer.substring(0, 50)}"`,
                severity: 'blocking',
            });
        }
    }

    // Audience dans FAQ ne doit pas être une phrase
    const audience = String((faq as any)?.metadata?.target_audience || '');
    if (audience.length > 100 && !audience.includes(',')) {
        errors.push({
            file: 'faq.json',
            field: 'metadata.target_audience',
            message: 'Audience est une phrase complète',
            severity: 'blocking',
        });
    }

    return errors;
}

function validateGlossary(glossary: Record<string, unknown>): QCError[] {
    const errors: QCError[] = [];

    const terms: any[] = (glossary as any)?.terms || [];
    if (!Array.isArray(terms) || terms.length === 0) {
        errors.push({
            file: 'glossary.json',
            field: 'terms',
            message: 'Aucun terme dans le glossaire',
            severity: 'blocking',
        });
        return errors;
    }

    // Vérifier que les définitions ne sont pas génériques
    const GENERIC_DEFS = [
        'protection des données',
        'politique de conformité',
    ];
    for (let i = 0; i < terms.length; i++) {
        const def = String(terms[i]?.definition || '').toLowerCase();
        for (const generic of GENERIC_DEFS) {
            if (def.startsWith(generic) && def.length < 60) {
                errors.push({
                    file: 'glossary.json',
                    field: `terms[${i}].definition`,
                    message: `Définition trop générique pour "${terms[i]?.term}": "${def.substring(0, 60)}"`,
                    severity: 'blocking',
                });
            }
        }
    }

    return errors;
}

function validateExternalContext(ctx: Record<string, unknown>): QCError[] {
    const errors: QCError[] = [];

    // discovery_keywords : chaque entrée <= 50 chars
    const dk: string[] = (ctx as any)?.discovery_keywords || [];
    if (Array.isArray(dk)) {
        const longEntries = dk.filter((k: string) => typeof k === 'string' && k.length > 50);
        if (longEntries.length > 0) {
            errors.push({
                file: 'external_context.json',
                field: 'discovery_keywords',
                message: `${longEntries.length} keywords dépassent 50 chars`,
                severity: 'correctable',
                correctedValue: dk.filter((k: string) => typeof k === 'string' && k.length <= 50),
            });
        }
    }

    // intent_keywords : chaque entrée <= 80 chars
    const ik: string[] = (ctx as any)?.intent_keywords || [];
    if (Array.isArray(ik)) {
        const longIntents = ik.filter((k: string) => typeof k === 'string' && k.length > 80);
        if (longIntents.length > 0) {
            errors.push({
                file: 'external_context.json',
                field: 'intent_keywords',
                message: `${longIntents.length} intents dépassent 80 chars`,
                severity: 'correctable',
                correctedValue: ik.filter((k: string) => typeof k === 'string' && k.length <= 80),
            });
        }
    }

    // audience_segments ne doit pas contenir de phrases
    const segments: string[] = (ctx as any)?.audience_segments || [];
    if (Array.isArray(segments)) {
        for (let i = 0; i < segments.length; i++) {
            if (typeof segments[i] === 'string' && segments[i].length > 80) {
                errors.push({
                    file: 'external_context.json',
                    field: `audience_segments[${i}]`,
                    message: `Segment d'audience trop long (${segments[i].length} chars)`,
                    severity: 'blocking',
                });
            }
        }
    }

    return errors;
}

function validateManifest(manifest: Record<string, unknown>): QCError[] {
    const errors: QCError[] = [];

    // URL en minuscule
    const url = String((manifest as any)?.entity?.url || '');
    if (url !== url.toLowerCase()) {
        errors.push({
            file: 'manifest.json',
            field: 'entity.url',
            message: 'URL contient des majuscules',
            severity: 'correctable',
            correctedValue: url.toLowerCase(),
        });
    }

    // Nom présent
    const name = String((manifest as any)?.entity?.name || '');
    if (!name || name === 'Entreprise Inconnue') {
        errors.push({
            file: 'manifest.json',
            field: 'entity.name',
            message: 'Nom manquant ou générique',
            severity: 'blocking',
        });
    }

    return errors;
}

// --- API PUBLIQUE ---

export interface ProPackFiles {
    asr: Record<string, unknown>;
    faq: Record<string, unknown>;
    glossary: Record<string, unknown>;
    externalContext: Record<string, unknown>;
    manifest: Record<string, unknown>;
}

/**
 * Valide les 5 fichiers PRO.
 * Retourne le résultat QC avec erreurs et corrections automatiques.
 */
export function validateProPack(files: ProPackFiles): QCResult {
    const allErrors: QCError[] = [
        ...validateAsr(files.asr),
        ...validateFaq(files.faq),
        ...validateGlossary(files.glossary),
        ...validateExternalContext(files.externalContext),
        ...validateManifest(files.manifest),
    ];

    // Vérifier que tous les fichiers sont des JSON valides (non vides)
    for (const [key, value] of Object.entries(files)) {
        if (!value || typeof value !== 'object' || Object.keys(value).length < 2) {
            allErrors.push({
                file: `${key}`,
                field: '*',
                message: `Fichier ${key} est vide ou invalide`,
                severity: 'blocking',
            });
        }
    }

    const hasBlocking = allErrors.some(e => e.severity === 'blocking');
    const hasCorrectable = allErrors.some(e => e.severity === 'correctable');

    return {
        passed: !hasBlocking,
        errors: allErrors,
        corrected: hasCorrectable && !hasBlocking,
    };
}

/**
 * Applique les corrections automatiques sur les fichiers.
 * Ne corrige que les erreurs "correctable", pas les "blocking".
 */
export function applyCorrections(files: ProPackFiles, errors: QCError[]): ProPackFiles {
    const corrected = JSON.parse(JSON.stringify(files)); // deep clone

    for (const error of errors) {
        if (error.severity !== 'correctable' || error.correctedValue === undefined) continue;

        const path = error.field.split('.');
        let target: any;

        switch (error.file) {
            case 'ASR-Protocol.json': target = corrected.asr; break;
            case 'faq.json': target = corrected.faq; break;
            case 'glossary.json': target = corrected.glossary; break;
            case 'external_context.json': target = corrected.externalContext; break;
            case 'manifest.json': target = corrected.manifest; break;
            default: continue;
        }

        // Navigate to parent and set value
        for (let i = 0; i < path.length - 1; i++) {
            if (target && typeof target === 'object') {
                target = target[path[i]];
            }
        }
        if (target && typeof target === 'object') {
            target[path[path.length - 1]] = error.correctedValue;
        }
    }

    return corrected;
}
