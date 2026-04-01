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

// =====================================================================
// VALIDATION CONVERSATIONNELLE (Flux Chat)
// =====================================================================

/**
 * Regex canoniques pour la validation d'email et d'URL.
 * Exportées pour réutilisation cohérente dans tout le flux.
 */
export const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
export const EMAIL_STRICT_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const URL_REGEX = /[a-zA-Z0-9.-]+\.[a-zA-Z]{2,10}/gi;
export const EMAIL_CAPTURE_REGEX = /([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9._-]+)/;

/**
 * Valide un email (format).
 * Retourne l'email normalisé (lowercase) ou null si invalide.
 */
export function validateEmail(input: string): string | null {
    const match = input.match(EMAIL_REGEX);
    if (!match) return null;
    return match[0].toLowerCase();
}

/**
 * Vérifie si un texte est strictement un email (et pas un contenu mixte avec URL).
 */
export function isStrictEmail(input: string): boolean {
    return EMAIL_STRICT_REGEX.test(input.trim());
}

/**
 * Normalise une URL : ajoute https:// si absent.
 */
export function normalizeUrl(url: string): string {
    if (!url) return url;
    if (!url.startsWith('http')) return 'https://' + url;
    return url;
}

/**
 * Regex de confirmation — détecte les "oui", "ok", "c'est correct", etc.
 * Utilisée pour filtrer les réponses utilisateur qui ne sont PAS des données.
 */
export const CONFIRMATION_RE = /^(oui|ok|okay|d'accord|exact|exactement|c'est correct|oui c'est correct|oui c'est bon|c'est bon|c'est ça|parfait|tout est correct|validé|je confirme|je valide|bien reçu|noté|entendu|ça me va|ça marche|très bien|super|génial|nickel|impeccable|affirmatif|absolument|tout à fait|bien sûr|évidemment|effectivement|en effet|voilà|yep|yup|yes|yeah|sure|right|correct|confirmed|alright|got it|that's right|that's correct)[\s!.✅✓]*$/i;

/**
 * Détecte si un message utilisateur est une simple confirmation
 * (ne contient aucune donnée exploitable).
 */
export function isConfirmationOnly(content: string): boolean {
    if (!content || typeof content !== 'string') return false;
    const trimmed = content.trim();
    if (trimmed.length < 60 && CONFIRMATION_RE.test(trimmed)) return true;
    // Numbered confirmations like "1" "2" "3" (option selections)
    if (/^\d{1,2}[\s.!]*$/.test(trimmed)) return true;
    return false;
}

// =====================================================================
// SANITISATION POST-LLM (Template & Confirmation cleanup)
// =====================================================================

/** Patterns de templates/placeholders que le LLM copie depuis les exemples du prompt. */
const TEMPLATE_PATTERNS = /^(Ex:|type schema\.?org|schema\.?org|organisation|organization|premium\/standard\/undisclosed|public\/membersOnly|eligible\/uncertain|✅\/⚠️\/❌|gym near me|Centre en ville|Recherche Salle|No City Found|undisclosed)$/i;
const TEMPLATE_PARTIAL = /^Ex:|eligible\/uncertain|✅\/⚠️\/❌|premium\/standard|public\/members/i;

function isTemplatePlaceholder(val: any): boolean {
    if (typeof val === 'string') return TEMPLATE_PATTERNS.test(val.trim()) || TEMPLATE_PARTIAL.test(val.trim());
    return false;
}

function sanitizeFieldValue(val: any): any {
    if (typeof val === 'string') {
        return isTemplatePlaceholder(val) ? '' : val;
    }
    if (Array.isArray(val)) {
        return val.filter((item: any) => {
            if (typeof item === 'string') return !isTemplatePlaceholder(item);
            if (typeof item === 'object' && item !== null) {
                if (item.userIntent && isTemplatePlaceholder(item.userIntent)) return false;
                if (item.status && isTemplatePlaceholder(item.status)) return false;
                if (item.query && isTemplatePlaceholder(item.query)) return false;
                if (item.result && isTemplatePlaceholder(item.result)) return false;
                if (item.queryExamples) item.queryExamples = item.queryExamples.filter((e: any) => !isTemplatePlaceholder(e));
                if (item.decisionCriteria) item.decisionCriteria = item.decisionCriteria.filter((e: any) => !isTemplatePlaceholder(e));
            }
            return true;
        });
    }
    if (typeof val === 'object' && val !== null) {
        if (val.required) val.required = val.required.filter((v: any) => !isTemplatePlaceholder(v));
        if (val.exclusion) val.exclusion = val.exclusion.filter((v: any) => !isTemplatePlaceholder(v));
    }
    return val;
}

export interface SanitizeLog {
    field: string;
    reason: string;
    originalValue?: any;
}

/**
 * Nettoie les valeurs de champs LLM en supprimant les placeholders de template
 * et les phrases de confirmation copiées comme valeurs.
 * Mutate `fields` in-place, retourne la liste des modifications effectuées.
 */
export function sanitizeLlmFields(fields: Record<string, any>): SanitizeLog[] {
    const logs: SanitizeLog[] = [];

    // Pass 1: Remove template placeholders
    for (const blockName of Object.keys(fields)) {
        const block = fields[blockName];
        if (typeof block !== 'object' || block === null) continue;
        for (const fieldName of Object.keys(block)) {
            const field = block[fieldName];
            if (field && typeof field === 'object' && 'value' in field) {
                const originalVal = field.value;
                field.value = sanitizeFieldValue(field.value);
                const isEmpty = field.value === '' || (Array.isArray(field.value) && field.value.length === 0);
                if (isEmpty && originalVal !== field.value) {
                    field.q = 0;
                    logs.push({ field: `${blockName}.${fieldName}`, reason: 'template_placeholder', originalValue: originalVal });
                }
            }
        }
    }

    // Pass 2: Remove confirmation phrases stored as field values
    for (const blockName of Object.keys(fields)) {
        const block = fields[blockName];
        if (typeof block !== 'object' || block === null) continue;
        for (const fieldName of Object.keys(block)) {
            const field = block[fieldName];
            if (field && typeof field === 'object' && 'value' in field && typeof field.value === 'string') {
                if (field.value.trim().length < 60 && CONFIRMATION_RE.test(field.value.trim())) {
                    logs.push({ field: `${blockName}.${fieldName}`, reason: 'confirmation_phrase', originalValue: field.value });
                    field.value = '';
                    field.q = 0;
                }
            }
        }
    }

    // Pass 3: Special fields with known placeholder patterns
    if (fields.identite?.business_type?.value) {
        const bt = String(fields.identite.business_type.value).trim();
        if (/^(type schema\.?org|schema\.?org|organisation|organization)$/i.test(bt)) {
            logs.push({ field: 'identite.business_type', reason: 'template_placeholder', originalValue: bt });
            fields.identite.business_type.value = '';
            fields.identite.business_type.q = 0;
        }
    }
    if (fields.contextual_signals?.pricing_level?.value) {
        const pl = String(fields.contextual_signals.pricing_level.value).trim();
        if (/premium\/standard|undisclosed/i.test(pl)) {
            logs.push({ field: 'contextual_signals.pricing_level', reason: 'template_placeholder', originalValue: pl });
            fields.contextual_signals.pricing_level.value = '';
            fields.contextual_signals.pricing_level.q = 0;
        }
    }
    if (fields.contextual_signals?.access_mode?.value) {
        const am = String(fields.contextual_signals.access_mode.value).trim();
        if (/public\/membersOnly/i.test(am)) {
            logs.push({ field: 'contextual_signals.access_mode', reason: 'template_placeholder', originalValue: am });
            fields.contextual_signals.access_mode.value = '';
            fields.contextual_signals.access_mode.q = 0;
        }
    }

    // Pass 4: Remove question text that leaked into data fields
    // When [SKIP] or question text appears as a value, it's contamination
    const QUESTION_LEAK_RE = /^(what|which|do you|are you|have you|how|is your|quels?|quel(?:le)?s?|avez|possédez|décrivez|combien|cite|list)\s/i;
    const SKIP_ANSWER_RE = /\[SKIP\]|non applicable|not applicable|n\/a/i;
    // Mixed question+answer patterns: "Question text : answer" or "Question text ... answer"
    const MIXED_QA_RE = /^(standards|certifications?|policies|frameworks|compliance|qualit[yé]|process|do you|what|which|how|avez|quels?).*?:\s/i;
    for (const blockName of Object.keys(fields)) {
        const block = fields[blockName];
        if (typeof block !== 'object' || block === null) continue;
        for (const fieldName of Object.keys(block)) {
            const field = block[fieldName];
            if (!field || typeof field !== 'object' || !('value' in field)) continue;
            if (typeof field.value === 'string') {
                const trimVal = field.value.trim();
                if (QUESTION_LEAK_RE.test(trimVal) || SKIP_ANSWER_RE.test(trimVal)) {
                    logs.push({ field: `${blockName}.${fieldName}`, reason: 'question_text_leaked', originalValue: field.value });
                    field.value = '';
                    field.q = 0;
                }
                // Mixed question:answer → extract only the answer part after ":"
                else if (MIXED_QA_RE.test(trimVal)) {
                    const colonIdx = trimVal.indexOf(':');
                    if (colonIdx > 0) {
                        const answerPart = trimVal.substring(colonIdx + 1).trim();
                        if (answerPart && answerPart.length > 2 && !SKIP_ANSWER_RE.test(answerPart)) {
                            logs.push({ field: `${blockName}.${fieldName}`, reason: 'mixed_qa_cleaned', originalValue: field.value });
                            field.value = answerPart;
                        } else {
                            logs.push({ field: `${blockName}.${fieldName}`, reason: 'mixed_qa_empty_answer', originalValue: field.value });
                            field.value = '';
                            field.q = 0;
                        }
                    }
                }
                // URL stored as KPI name (URL is not a metric)
                else if (fieldName === 'key_indicators' && /^https?:\/\/|^https?_/i.test(trimVal)) {
                    logs.push({ field: `${blockName}.${fieldName}`, reason: 'url_as_kpi', originalValue: field.value });
                    field.value = '';
                    field.q = 0;
                }
            }
            if (Array.isArray(field.value)) {
                const cleaned = field.value
                    .map((item: any) => {
                        if (typeof item !== 'string') return item;
                        const t = item.trim();
                        // Remove question leaks and skip tokens
                        if (QUESTION_LEAK_RE.test(t) || SKIP_ANSWER_RE.test(t)) return null;
                        // Clean mixed question:answer → keep answer only
                        if (MIXED_QA_RE.test(t)) {
                            const ci = t.indexOf(':');
                            if (ci > 0) {
                                const ans = t.substring(ci + 1).trim();
                                return (ans && ans.length > 2 && !SKIP_ANSWER_RE.test(ans)) ? ans : null;
                            }
                        }
                        // URL as KPI
                        if (fieldName === 'key_indicators' && /^https?:\/\/|^https?_/i.test(t)) return null;
                        return item;
                    })
                    .filter((item: any) => item !== null);
                const originalLen = field.value.length;
                if (cleaned.length < originalLen) {
                    logs.push({ field: `${blockName}.${fieldName}`, reason: 'question_text_leaked_in_array' });
                    field.value = cleaned;
                    if (cleaned.length === 0) field.q = 0;
                }
            }
        }
    }

    // Pass 5: Validate policies — copyright notices are NOT policies
    if (fields.engagements_conformite?.policies) {
        const pol = fields.engagements_conformite.policies;
        if (Array.isArray(pol.value)) {
            const validPolicies = pol.value.filter((item: any) => {
                if (typeof item !== 'string') return true;
                const lower = item.toLowerCase();
                // Reject copyright-only text
                if (/^©|^copyright|^all rights reserved/i.test(item.trim())) return false;
                // Reject very short text without policy keywords
                if (item.length < 20 && !/privacy|policy|terms|conditions|gdpr|rgpd|confidential/i.test(lower)) return false;
                return true;
            });
            if (validPolicies.length < pol.value.length) {
                logs.push({ field: 'engagements_conformite.policies', reason: 'copyright_not_policy', originalValue: pol.value });
                pol.value = validPolicies;
                if (validPolicies.length === 0) pol.q = 0;
            }
        } else if (typeof pol.value === 'string') {
            const lower = pol.value.toLowerCase();
            if (/^©|^copyright|^all rights reserved/i.test(pol.value.trim())) {
                logs.push({ field: 'engagements_conformite.policies', reason: 'copyright_not_policy', originalValue: pol.value });
                pol.value = '';
                pol.q = 0;
            }
        }
    }

    return logs;
}

/**
 * Downgrade les q-values des champs LLM quand les règles métier ne sont pas respectées.
 * Mutate `fields` in-place, retourne la liste des downgrades effectués.
 */
export function downgradeFieldQuality(fields: Record<string, any>): SanitizeLog[] {
    const logs: SanitizeLog[] = [];

    // INDICATEURS: key_indicators — q=1 only if concrete numbers exist
    if (fields.indicateurs?.key_indicators) {
        const ki = fields.indicateurs.key_indicators;
        if (ki.q === 1 && Array.isArray(ki.value)) {
            const hasConcreteNumber = ki.value.some((item: any) => {
                const str = typeof item === 'string' ? item : JSON.stringify(item);
                return /\d/.test(str) && !/satisfaction|bouche.?à.?oreille|qualité|confiance/i.test(str);
            });
            if (!hasConcreteNumber) {
                ki.q = 0.5;
                logs.push({ field: 'indicateurs.key_indicators', reason: 'no_concrete_numbers' });
            }
        }
    }

    // INDICATEURS: last_review_date — q=1 only if explicit date
    if (fields.indicateurs?.last_review_date) {
        const lr = fields.indicateurs.last_review_date;
        if (lr.q === 1) {
            const val = String(lr.value || '');
            const hasDate = /\d{4}[-/]\d{2}|jan|fév|mar|avr|mai|juin|juil|aoû|sep|oct|nov|déc/i.test(val);
            if (!hasDate) {
                lr.q = 0;
                logs.push({ field: 'indicateurs.last_review_date', reason: 'no_explicit_date' });
            }
        }
    }

    // ENGAGEMENTS: certifications — q=1 only for named recognized certs
    if (fields.engagements_conformite?.certifications) {
        const cert = fields.engagements_conformite.certifications;
        if (cert.q === 1 && Array.isArray(cert.value)) {
            const knownCerts = /iso|ohsas|haccp|b.?corp|fair.?trade|leed|ce\b|nf\b|afnor|tuv|ul\b|fda|gmp|gdpr|rgpd|soc.?[12]|pci|hipaa|fedramp/i;
            const hasRealCert = cert.value.some((c: any) => knownCerts.test(String(c)));
            if (!hasRealCert) {
                cert.q = 0.5;
                logs.push({ field: 'engagements_conformite.certifications', reason: 'no_recognized_certification' });
            }
        }
    }

    // ENGAGEMENTS: policies — q=1 only if policy IS active (not "en cours")
    if (fields.engagements_conformite?.policies) {
        const pol = fields.engagements_conformite.policies;
        if (pol.q === 1 && Array.isArray(pol.value)) {
            const inProgress = /en cours|en phase|prochainement|bientôt|prévu|planifié/i;
            const allInProgress = pol.value.every((p: any) => inProgress.test(String(p)));
            if (allInProgress && pol.value.length > 0) {
                pol.q = 0.5;
                logs.push({ field: 'engagements_conformite.policies', reason: 'all_policies_in_progress' });
            }
        }
    }

    // CONTENUS PEDAGOGIQUES: has_glossary, has_documentation — q=0 if explicitly "non"
    ['has_glossary', 'has_documentation', 'has_faq'].forEach(field => {
        const node = fields.contenus_pedagogiques?.[field] as any;
        if (node && node.q >= 0.5 && node.value === false) {
            node.q = 0;
            logs.push({ field: `contenus_pedagogiques.${field}`, reason: 'value_explicitly_false' });
        }
    });

    // OFFRE: pricing_indication — "sur devis" = 0.5 max
    if (fields.offre?.pricing_indication) {
        const pi = fields.offre.pricing_indication;
        if (pi.q === 1) {
            const val = String(pi.value || '').toLowerCase();
            if (/sur devis|à définir|variable|selon|dépend/i.test(val) && !/\d/.test(val)) {
                pi.q = 0.5;
                logs.push({ field: 'offre.pricing_indication', reason: 'vague_pricing' });
            }
        }
    }

    // PROCESSUS: process_steps — q=1 only if 3+ concrete steps
    if (fields.processus_methodes?.process_steps) {
        const ps = fields.processus_methodes.process_steps;
        if (ps.q === 1 && Array.isArray(ps.value) && ps.value.length < 3) {
            ps.q = 0.5;
            logs.push({ field: 'processus_methodes.process_steps', reason: `only_${ps.value.length}_steps` });
        }
    }

    // OFFRE: services/products — q=1 only if 2+ items
    ['services', 'products'].forEach(field => {
        const node = fields.offre?.[field] as any;
        if (node && node.q === 1 && Array.isArray(node.value) && node.value.length < 2) {
            node.q = 0.5;
            logs.push({ field: `offre.${field}`, reason: `only_${node.value.length}_item` });
        }
    });

    // V4: Detect interpretive/subjective claims and penalize
    const INTERPRETIVE_CLAIMS_RE = /\b(leader|meilleur|best|top\s|innovant|innovative|world.?class|cutting.?edge|unmatched|unrivaled|number\s*one|#1|premier|supérieur|superior|unique|révolutionnaire|revolutionary|disruptive|game.?changer|first.?of.?its.?kind)\b/i;

    const textFieldsToCheck = [
        'offre.services', 'offre.products', 'offre.use_cases',
        'processus_methodes.quality_assurance',
        'engagements_conformite.certifications',
    ];

    for (const fieldPath of textFieldsToCheck) {
        const [block, field] = fieldPath.split('.');
        if (!fields[block]?.[field]) continue;
        const val = fields[block][field].value;
        const textToCheck = Array.isArray(val) ? val.join(' ') : (typeof val === 'string' ? val : '');
        if (INTERPRETIVE_CLAIMS_RE.test(textToCheck) && fields[block][field].q > 0) {
            fields[block][field].q = 0;
            fields[block][field].evidence = [...(fields[block][field].evidence || []), 'interpretive_claim_detected'];
            console.log(`⚠️ INTERPRETIVE CLAIM detected in ${fieldPath}: "${textToCheck.substring(0, 60)}" → q=0`);
        }
    }

    // V4: RELIABILITY-BASED Q-VALUE CAPPING
    // 3 categories:
    // 1. SCAN-OBSERVED: data detected from the public website → verifiable, keep q=1
    // 2. QUESTIONNAIRE ANSWER WITH URL: user provided proof → keep q=1
    // 3. QUESTIONNAIRE ANSWER WITHOUT URL: user declared, no proof → cap q=0.5
    // 4. INTERPRETIVE: marketing claims → q=0 (handled above)
    //
    // How to distinguish: check the evidence array.
    // - Scan data has evidence like "scan_state", "high_confidence_scan", or no "questionnaire_answer"
    // - Questionnaire answers have evidence "questionnaire_answer"
    // - URL-backed answers have evidence "questionnaire_answer" + an https:// URL
    const V4_EVIDENCE_MODE = process.env.AYO_V4_EVIDENCE === 'true';
    if (V4_EVIDENCE_MODE) {
        for (const blockName of Object.keys(fields)) {
            const block = fields[blockName];
            if (typeof block !== 'object' || block === null) continue;
            for (const fieldName of Object.keys(block)) {
                const fieldPath = `${blockName}.${fieldName}`;
                const field = block[fieldName];
                if (!field || typeof field !== 'object' || !('q' in field) || field.q <= 0.5) continue;

                const evidence = field.evidence || [];
                const isFromQuestionnaire = evidence.includes('questionnaire_answer');
                const hasUrlProof = evidence.some((e: string) => typeof e === 'string' && /^https?:\/\//i.test(e));

                // Scan-observed data (not from questionnaire) → keep q=1, it's on the public website
                if (!isFromQuestionnaire) continue;

                // Questionnaire answer with URL proof → keep q=1
                if (hasUrlProof) continue;

                // Questionnaire answer without URL → self_declared, cap to q=0.5
                logs.push({ field: fieldPath, reason: 'self_declared_capped_to_0.5' });
                field.q = 0.5;
            }
        }
    }

    return logs;
}

// --- API PUBLIQUE (ProPack) ---

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

// --- V4 Evidence Validation ---

/**
 * Validates an evidence URL by performing a HEAD request.
 * Returns reachability status. 3-second timeout.
 */
export async function validateEvidenceUrl(url: string): Promise<{
    reachable: boolean;
    statusCode: number | null;
}> {
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000);
        const response = await fetch(url, {
            method: 'HEAD',
            signal: controller.signal,
            redirect: 'follow',
            headers: { 'User-Agent': 'AYO-Bot/1.0 (AI Visionary Evidence Check)' },
        });
        clearTimeout(timeoutId);
        return { reachable: response.ok, statusCode: response.status };
    } catch {
        return { reachable: false, statusCode: null };
    }
}

/**
 * Checks if an answer contains concrete evidence (not just a vague declaration).
 * Used to decide between q=1 (concrete) and q=0.5 (vague).
 */
export function isConcreteEvidence(answer: string, fieldType: string): boolean {
    const trimmed = answer.trim();
    if (!trimmed) return false;

    // URL is always concrete evidence
    if (/https?:\/\/[^\s]+/i.test(trimmed)) return true;

    // Concrete numbers (dates, quantities, percentages)
    if (/\d+/.test(trimmed) && trimmed.length > 5) return true;

    // Named certifications (ISO, SOC, GDPR with specifics)
    if (/\b(ISO\s*\d{4,5}|SOC\s*[12]|PCI.DSS|HIPAA|GDPR|RGPD|CE\s*mark)/i.test(trimmed)) return true;

    // Substantial text (multiple items or detailed description)
    if (trimmed.includes(',') && trimmed.length > 15) return true;
    if (trimmed.length > 50) return true;

    return false;
}
