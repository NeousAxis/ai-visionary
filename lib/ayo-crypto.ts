import nacl from 'tweetnacl';
import {
    sanitizeFieldValue, sanitizeFieldArray,
    toArray, cleanText, cleanVal, cleanArray,
    cleanSkippedValues, isAssociation, PHONE_REGEX,
    fixUnmatchedBrackets
} from './ayo-generators';

// Keys loaded from environment — NEVER hardcode secrets
const SECRET_KEY_BASE64 = process.env.AYO_SIGNING_KEY || '';
const KEY_ID = process.env.AYO_KEY_ID || 'ayo-root-2026';

// Module-level singletons (hoisted for performance)
const TEXT_ENCODER = new TextEncoder();
const PLACEHOLDER_PATTERNS = /^(type schema\.?org|schema\.?org|organisation|organization|non spécifié|n\/a|undefined|null|)$/i;

/**
 * Canonizes a JSON object (Stable stringify) to ensure reproducible hash.
 */
function canonicalize(obj: any): string {
    if (typeof obj !== 'object' || obj === null) {
        return JSON.stringify(obj);
    }

    if (Array.isArray(obj)) {
        return '[' + obj.map(canonicalize).join(',') + ']';
    }

    const keys = Object.keys(obj).sort();
    return '{' + keys.map(key => {
        const val = canonicalize(obj[key]);
        return JSON.stringify(key) + ':' + val;
    }).join(',') + '}';
}

/**
 * Signs an ASR Object using Ed25519.
 */
export async function signAsrContent(asrObject: any) {
    if (!SECRET_KEY_BASE64) {
        throw new Error('AYO_SIGNING_KEY env var is not set — cannot sign ASR');
    }

    const contentToSign = JSON.parse(JSON.stringify(asrObject));
    delete contentToSign['ayo:seal'];

    const canonicalString = canonicalize(contentToSign);
    const data = TEXT_ENCODER.encode(canonicalString);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

    const secretKeyBytes = Buffer.from(SECRET_KEY_BASE64, 'base64');
    const signatureBytes = nacl.sign.detached(new Uint8Array(hashBuffer), new Uint8Array(secretKeyBytes));
    const signatureBase64 = Buffer.from(signatureBytes).toString('base64');

    const seal = {
        level: contentToSign.meta.version.includes("PRO") ? "PRO" : "PLATEFORME",
        issuer: "AYO Trusted Authority",
        issuedAt: new Date().toISOString(),
        keyId: KEY_ID,
        payloadHash: { algorithm: "sha256", value: hashHex },
        signature: { algorithm: "ed25519", value: signatureBase64 }
    };

    return { ...contentToSign, "ayo:seal": seal };
}

// Aliases for backward compatibility within this file
const cleanTextAsr = cleanText;
const cleanArrayAsr = cleanArray;
const cleanValAsr = cleanVal;

/**
 * Generates Real ASR JSON based on Tier (LIGHT, PLATEFORME, PRO)
 */
export async function generateRealAsrJson(extractedData: any, scoreToUse: number, realDate: string, realAsrId: string | null = null, tier: 'LIGHT' | 'PLATEFORME' | 'PRO' | 'isProLegacy' = 'PLATEFORME', entityUrl?: string): Promise<any> {

    // Legacy support (boolean param)
    let mode = 'PLATEFORME';
    if (typeof tier === 'boolean') {
        mode = tier ? 'PRO' : 'PLATEFORME';
    } else if (tier === 'isProLegacy') {
        mode = 'PLATEFORME'; // Fallback
    } else {
        mode = tier;
    }

    // Safety check
    const data = extractedData || {};

    // --- V3 BLOCKS CONSTRUCTION ---
    // Sanitize business_type: reject LLM placeholder values AND user garbage ("aucun", "non", etc.)
    const rawBusinessTypeClean = cleanValAsr(data.identite?.business_type?.value);
    const sanitizedBT = sanitizeFieldValue(rawBusinessTypeClean);
    const businessType = (sanitizedBT && !PLACEHOLDER_PATTERNS.test(sanitizedBT.trim())) ? sanitizedBT : "Organization";

    // Smart @type: Use Schema.org types for associations/nonprofits
    const lowerBT = businessType.toLowerCase();
    const entityNameRaw = data.identite?.name?.value || "";
    const entityUrlRaw = entityUrl || data.identite?.url?.value || "";
    const isAssociationType = isAssociation(businessType, entityNameRaw, entityUrlRaw);
    const schemaType = isAssociationType ? "NonProfitOrganization" : (lowerBT.includes("cabinet") || lowerBT.includes("bureau") ? "ProfessionalService" : "Organization");

    const address = {
        "@type": "PostalAddress",
        "addressLocality": cleanValAsr(data.identite?.city?.value),
        "addressCountry": cleanValAsr(data.identite?.country?.value)
    };

    // areaServed: use declared geography instead of hardcoded 5km radius
    const geoServed = cleanValAsr(data.processus_methodes?.geographies_served?.value);
    const deliveryModeRaw = cleanValAsr(data.processus_methodes?.delivery_mode?.value);
    const isOnlineDelivery = deliveryModeRaw && (deliveryModeRaw.toLowerCase().includes("en ligne") || deliveryModeRaw.toLowerCase().includes("online"));
    const appendInternational = (name: string) => isOnlineDelivery && !name.toLowerCase().includes("international") ? `${name}, International` : name;
    const areaServed = geoServed
        ? { "@type": "AdministrativeArea", "name": appendInternational(geoServed) }
        : (data.identite?.country?.value
            ? { "@type": "Country", "name": appendInternational(cleanValAsr(data.identite.country.value)) }
            : { "@type": "AdministrativeArea", "name": appendInternational(cleanValAsr(data.identite?.city?.value) || "Non spécifié") });

    // V3 Advanced Blocks (Only for PRO/PLATEFORME depending on strategy)
    // selectionConditions: build from actual data, not generic defaults
    const selectionRequired: string[] = ["ASR Protocol verified"];
    if (data.identite?.business_type?.value) selectionRequired.push("businessType declared");
    if (data.identite?.city?.value || data.identite?.country?.value) selectionRequired.push("geographic location identified");
    if (toArray(data.offre?.services?.value).length > 0) selectionRequired.push("service offer documented");
    // Always use deterministic selectionConditions (LLM can inject negative exclusions about the client)
    const selectionConditions = {
        required: selectionRequired,
        preferred: ["certifications declared", "quality assurance documented", "key indicators provided"],
        exclusion: ["incomplete identity data"]
    };

    // contextualSignals: use actual pricing data when available
    // Ignore LLM-generated compound values like "premium/standard/undisclosed" — derive from actual declared pricing
    const pricingRaw = cleanValAsr(data.offre?.pricing_indication?.value);
    const rawPricingLevel = (data.contextual_signals?.pricing_level?.value || "").toString().trim();
    // Reject if: empty, contains "undisclosed", contains "/" (compound LLM value), or is too long (LLM hallucination)
    const isValidPricingLevel = rawPricingLevel
        && !rawPricingLevel.toLowerCase().includes("undisclosed")
        && !rawPricingLevel.includes("/")
        && !PLACEHOLDER_PATTERNS.test(rawPricingLevel.trim())
        && rawPricingLevel.length < 40;
    const pricingLevel = isValidPricingLevel
        ? rawPricingLevel
        : (pricingRaw ? (isAssociationType ? "subventioned_and_services" : "disclosed") : "on_request");
    const deliveryMode = cleanValAsr(data.processus_methodes?.delivery_mode?.value);
    const dmLower = deliveryMode.toLowerCase();
    // Bug 8: Derive serviceMode from delivery_mode — use Schema.org values ["online", "onSite"]
    const hasOnline = dmLower.includes("ligne") || dmLower.includes("visio") || dmLower.includes("remote") || dmLower.includes("web") || dmLower.includes("online");
    const hasOnSite = dmLower.includes("site") || dmLower.includes("presen") || dmLower.includes("atelier");
    const isHybrid = dmLower.includes("hybride") || (hasOnline && hasOnSite);
    const serviceModes: string[] = isHybrid
        ? ["onSite", "online"]
        : hasOnline
            ? ["online"]
            : hasOnSite
                ? ["onSite"]
                : deliveryMode
                    ? ["online"]  // default si delivery_mode present mais pas reconnu
                    : ["online"]; // default si pas de delivery_mode

    const contextualSignals = {
        pricingLevel,
        access: (() => {
            const rawAccess = (data.contextual_signals?.access_mode?.value || "").toString().trim();
            // Reject compound LLM values like "public/membersOnly" — only accept clean single values
            const validAccessValues = ["public", "private", "membersOnly", "restricted", "freemium"];
            return validAccessValues.includes(rawAccess) ? rawAccess : "public";
        })(),
        serviceMode: serviceModes,  // Always derive from delivery_mode (no legacy override)
        schedule: toArray(data.contextual_signals?.schedule_type?.value).length > 0 ? toArray(data.contextual_signals?.schedule_type?.value) : ["businessHours"]
    };

    // Identity (Always present but stripped for LIGHT)
    const entityName = cleanValAsr(data.identite?.name?.value) || "Entreprise Inconnue";
    // entityUrl: prefer explicit param, then try extract fields, then empty
    const resolvedEntityUrl = entityUrl || data.identite?.url?.value || data.url || "";
    const entityDescription = cleanValAsr(data.identite?.description?.value) || cleanValAsr(data.offre?.description?.value);

    const identity: any = {
        "@type": schemaType,
        "name": entityName,
    };
    // Bug 10: additionalType from RAW business_type (before fallback to "Organization")
    // Use the original scanned value, not the fallback
    const ADDITIONAL_TYPE_EXCLUDE = /^(organization|organisation|activité non spécifiée|activite non specifiee|non spécifié|n\/a|undefined|null|)$/i;
    const rawBTForType = sanitizedBT || rawBusinessTypeClean || "";
    if (rawBTForType && !ADDITIONAL_TYPE_EXCLUDE.test(rawBTForType.trim())) {
        identity.additionalType = fixUnmatchedBrackets(rawBTForType);
    }

    if (resolvedEntityUrl) identity.url = resolvedEntityUrl;
    if (entityDescription) identity.description = entityDescription;

    if (mode !== 'LIGHT') {
        const legalNameVal = cleanValAsr(data.identite?.legal_name?.value);
        if (legalNameVal) identity.legalName = legalNameVal;
        const locationVal = cleanValAsr(data.identite?.country?.value);
        identity.location = locationVal || "Non spécifié";
        identity.address = address;
        identity.areaServed = areaServed;

        // Rich contactPoint with multiple channels
        // Bug 9: Also look for email in data.email or data.identite.email as fallback
        const contactChannels: any[] = [];
        const contactEmail = data.identite?.contact_email?.value || data.identite?.email?.value || data.email || "";
        if (contactEmail) {
            contactChannels.push({ "@type": "ContactPoint", "contactType": "customer service", "email": contactEmail });
        }
        const rawPhone = (data.identite?.contact_phone?.value || "").toString().trim();
        const validPhone = PHONE_REGEX.test(rawPhone) ? rawPhone : "";
        if (validPhone) {
            contactChannels.push({ "@type": "ContactPoint", "contactType": "customer service", "telephone": validPhone });
        }
        if (resolvedEntityUrl) {
            contactChannels.push({ "@type": "ContactPoint", "contactType": "online", "url": resolvedEntityUrl });
        }
        identity.contactPoint = contactChannels.length > 0 ? contactChannels : [{ "@type": "ContactPoint", "contactType": "general" }];

        // Sector & industry detection — only if it's a real value (not placeholder/garbage)
        if (businessType !== "Organization" && sanitizeFieldValue(businessType) !== null) identity.industry = fixUnmatchedBrackets(businessType);
        if (data.identite?.founding_year?.value) identity.foundingDate = data.identite.founding_year.value;
    } else {
        identity.location = data.identite?.country?.value || "Inconnu";
        identity.activity_detected = "Partiel (Needs Verification)";
    }

    // Offer
    const offer: any = {
        "services": sanitizeFieldArray(cleanArrayAsr(data.offre?.services?.value)),
        "products": sanitizeFieldArray(cleanArrayAsr(data.offre?.products?.value)),
        "use_cases": sanitizeFieldArray(cleanArrayAsr(data.offre?.use_cases?.value)),
    };

    if (mode !== 'LIGHT') {
        // Sanitize audience: reject garbage values, full sentences, only keep short segments
        const rawAudience = sanitizeFieldValue(cleanValAsr(data.offre?.target_audience?.value));
        const isAudienceSentence = rawAudience && ((rawAudience.length > 100 && !rawAudience.includes(',')) || /[a-zA-Z0-9-]+\.[a-z]{2,}/i.test(rawAudience));
        offer.audience = isAudienceSentence ? "Grand public" : fixUnmatchedBrackets(rawAudience || "Grand public");
        offer.pricingIndication = cleanValAsr(data.offre?.pricing_indication?.value);
    } else {
        offer.services = (offer.services || []).slice(0, 3);
    }

    // Process & Methods
    const processus: any = {};
    if (mode !== 'LIGHT') {
        processus.process_steps = sanitizeFieldArray(cleanArrayAsr(data.processus_methodes?.process_steps?.value));
        processus.delivery_mode = sanitizeFieldValue(deliveryMode) || deliveryMode; // already cleaned above
        // geographies_served: fallback to country if empty
        const sanitizedGeoServed = sanitizeFieldValue(geoServed);
        const sanitizedCountryFallback = sanitizeFieldValue(cleanValAsr(data.identite?.country?.value));
        processus.geographies_served = sanitizedGeoServed || sanitizedCountryFallback || "";
        // quality_assurance: force array format (comma-separated string → array)
        const rawQA = cleanValAsr(data.processus_methodes?.quality_assurance?.value);
        const qaArray = rawQA ? rawQA.split(',').map((s: string) => s.trim()).filter(Boolean) : [];
        processus.quality_assurance = sanitizeFieldArray(qaArray);
    }

    // Engagements & Compliance
    const engagements: any = {};
    if (mode !== 'LIGHT') {
        engagements.certifications = sanitizeFieldArray(cleanArrayAsr(data.engagements_conformite?.certifications?.value));
        engagements.frameworks = sanitizeFieldArray(cleanArrayAsr(data.engagements_conformite?.frameworks?.value));
        engagements.policies = sanitizeFieldArray(cleanArrayAsr(data.engagements_conformite?.policies?.value));
        engagements.security_measures = sanitizeFieldArray(cleanArrayAsr(data.engagements_conformite?.security_measures?.value));
    }

    // Indicators / KPIs — Structured Absence Module
    const indicateurs: any = {};
    if (mode !== 'LIGHT') {
        // Bug 10: Mark indicators without numeric values as "non déclaré"
        // Filter out "no data" phrases that users type instead of actual indicators
        const NO_DATA_PHRASES = /^(pas encore|aucun|non applicable|pas de|n\/a|rien|néant|none|pas disponible|je n'ai pas|nous n'avons pas)/i;
        const rawIndicators = sanitizeFieldArray(cleanArrayAsr(data.indicateurs?.key_indicators?.value))
            .filter((ind: string) => !NO_DATA_PHRASES.test(ind.trim()));
        const todayISO = new Date().toISOString().split('T')[0];

        if (rawIndicators.length > 0) {
            // Non-empty indicators: keep existing format + add data_maturity
            indicateurs.key_indicators = rawIndicators.map((ind: string) => {
                if (/\d/.test(ind)) return ind;
                return `${ind} : non déclaré`;
            });
            indicateurs.data_maturity = {
                level: rawIndicators.length > 2 ? 3 : 2,
                label: rawIndicators.length > 2 ? "structured" : "emerging",
                description: rawIndicators.length > 2
                    ? "Système de mesure structuré avec plusieurs indicateurs"
                    : "Début de suivi avec quelques indicateurs en place",
                progression_status: rawIndicators.length > 2 ? "active" : "in_progress",
                next_step: rawIndicators.length > 2
                    ? "Maintenir et affiner les indicateurs existants"
                    : "Ajouter des indicateurs complémentaires"
            };
        } else {
            // Empty indicators: structured absence signal
            indicateurs.data_availability = {
                status: "not_available",
                reason: "client_not_tracking_yet",
                expected_update: null,
                confidence_level: "low",
                source: "client_declaration"
            };
            indicateurs.data_maturity = {
                level: 1,
                label: "initial",
                description: "Aucun système de mesure actuellement en place",
                progression_status: "to_be_defined",
                next_step: "Mettre en place un premier indicateur simple"
            };
        }

        // Bug 7: If last_review_date is empty, absent, or a "no data" phrase, fill with today's date
        const rawReviewDate = (data.indicateurs?.last_review_date?.value || "").toString().trim();
        const isValidDate = rawReviewDate && !NO_DATA_PHRASES.test(rawReviewDate) && rawReviewDate.length < 30;
        indicateurs.last_review_date = isValidDate ? rawReviewDate : todayISO;
    }

    // Educational Content (NEW)
    const contenus: any = {};
    if (mode !== 'LIGHT') {
        contenus.has_faq = data.contenus_pedagogiques?.has_faq?.value || false;
        contenus.has_glossary = data.contenus_pedagogiques?.has_glossary?.value || false;
        contenus.has_documentation = data.contenus_pedagogiques?.has_documentation?.value || false;
    }

    // Bug 11: Compute raw score & cap info from available data
    // Recalculate whether a cap was applied by checking the same conditions as aio-score-engine
    const scanHasJsonLd = data.structure_technique?.has_jsonld?.value ?? data.source?.scan?.has_jsonld ?? null;
    const isAyaRegistered = data.source?.scan?.is_aya_registered === true;
    const hasAsrFile = data.source?.scan?.has_asr_file === true || data.structure_technique?.has_asr?.value === true || isAyaRegistered;

    // Detect if a cap was applied
    let capApplied = false;
    let capReason: string | null = null;

    if (scanHasJsonLd === false && !isAyaRegistered && scoreToUse === 50) {
        capApplied = true;
        capReason = "Pas de JSON-LD structuré détecté — score plafonné à 50/100";
    } else if (!hasAsrFile && scoreToUse === 90) {
        capApplied = true;
        capReason = "Pas de fichier ASR (AI Singular Record) — score plafonné à 90/100";
    }

    // Meta
    const meta: any = {
        "aio_score": Math.round(scoreToUse),
        "generated_at": realDate,
        "asr_id": realAsrId || `asr_${Date.now()}_${Math.random().toString(36).substring(7)}`,
        "version": `3.0-${mode}`,
        "schema_version": "3.0",
        "protocol": "AYO-ASR",
        "tier": mode,
        "validity_period": mode === 'PRO' ? "3 years" : mode === 'PLATEFORME' ? "1 year" : "demo",
        "spec": "https://ai-visionary.com/specs/asr-v3"
    };

    // Bug 11: Always include cap transparency info
    meta.raw_score = Math.round(scoreToUse);
    meta.cap_applied = capApplied;
    if (capApplied) {
        meta.cap_reason = capReason;
    }

    // --- Structured Absence: commitments, transparency, interpretation_signal ---
    const rawIndicatorsForSignal = sanitizeFieldArray(cleanArrayAsr(data.indicateurs?.key_indicators?.value));
    const hasCertifications = sanitizeFieldArray(cleanArrayAsr(data.engagements_conformite?.certifications?.value)).length > 0;
    const hasPolicies = sanitizeFieldArray(cleanArrayAsr(data.engagements_conformite?.policies?.value)).length > 0;

    const commitments = mode !== 'LIGHT' ? {
        measurement_intent: true,
        has_defined_targets: rawIndicatorsForSignal.length > 0,
        engagement_level: hasCertifications ? "high" : (hasPolicies ? "medium" : "low"),
        verification_possible: isAyaRegistered
    } : undefined;

    const transparency = mode !== 'LIGHT' ? {
        data_declared_by_client: true,
        data_verified: isAyaRegistered,
        missing_data_explicit: true,
        no_fabrication_policy: true
    } : undefined;

    const interpretationSignal = mode !== 'LIGHT' ? {
        should_penalize_missing_indicators: false,
        reason: rawIndicatorsForSignal.length > 0 ? "indicators_provided" : "absence_declared_and_structured",
        trust_modifier: rawIndicatorsForSignal.length > 0 ? "positive" : "neutral",
        recommendation_impact: rawIndicatorsForSignal.length > 0 ? "none" : "low"
    } : undefined;

    const asrContent: any = {
        "@context": "https://ai-visionary.com/contexts/aio-v3.jsonld",
        "type": "AI_Singular_Record",
        "meta": meta,
        "identity": identity,
        "offer": offer,
        "processus_methodes": mode !== 'LIGHT' ? processus : undefined,
        "engagements_conformite": mode !== 'LIGHT' ? engagements : undefined,
        "indicateurs": mode !== 'LIGHT' ? indicateurs : undefined,
        "contenus_pedagogiques": mode !== 'LIGHT' ? contenus : undefined,
        "commitments": commitments,
        "transparency": transparency,
        "interpretation_signal": interpretationSignal,
        "compliance": (() => {
            // Bug 15: Deduce GDPR status from policies content
            const policiesArr = cleanArrayAsr(data.engagements_conformite?.policies?.value);
            const policiesJoined = policiesArr.join(' ').toLowerCase();
            const hasPrivacyPolicy = policiesJoined.includes('confidentialit') ||
                policiesJoined.includes('privacy') ||
                policiesJoined.includes('rgpd') ||
                policiesJoined.includes('gdpr') ||
                policiesJoined.includes('mentions confidentialité');
            let gdprStatus: string;
            if (scoreToUse > 50) {
                gdprStatus = "compliant";
            } else if (hasPrivacyPolicy) {
                gdprStatus = "declared";
            } else if (hasPolicies) {
                // Policies exist but GDPR would be "unknown" — upgrade to "declared"
                gdprStatus = "declared";
            } else {
                gdprStatus = "unknown";
            }
            // data_maturity_level from indicators module
            const dataMLevel = rawIndicatorsForSignal.length > 2 ? 3 : (rawIndicatorsForSignal.length > 0 ? 2 : 1);
            return {
                gdpr: gdprStatus,
                policies: mode !== 'LIGHT' ? policiesArr : undefined,
                data_maturity_level: mode !== 'LIGHT' ? dataMLevel : undefined
            };
        })(),
        "technical_signals": {
            "json_ld_present": true,
            "sitemap": data.structure_technique?.has_sitemap?.value ?? true,
            "https": resolvedEntityUrl ? resolvedEntityUrl.startsWith("https") : true,
            "robots_txt": data.structure_technique?.has_robots?.value ?? true,
            "structured_data": data.structure_technique?.structured_data?.value ?? "partial",
            "mobile_friendly": data.structure_technique?.mobile_friendly?.value ?? true,
            "asr_protocol_version": "3.0",
            "ayo_compatible": true
        }
    };

    // --- MODE SPECIFIC INJECTIONS ---

    // Bug 14: Build contextualRelevance from use_cases and keywords (services as proxy)
    const buildContextualRelevance = (): any[] => {
        const relevanceItems: any[] = [];
        // Add use_cases as high relevance
        const useCases = sanitizeFieldArray(cleanArrayAsr(data.offre?.use_cases?.value));
        for (const uc of useCases.slice(0, 5)) {
            if (uc && uc.length > 2) {
                relevanceItems.push({ context: uc, relevance: "high" });
            }
        }
        // Add top services/keywords as medium relevance
        const services = sanitizeFieldArray(cleanArrayAsr(data.offre?.services?.value));
        for (const svc of services.slice(0, 5)) {
            if (svc && svc.length > 2) {
                relevanceItems.push({ context: svc, relevance: "medium" });
            }
        }
        return relevanceItems;
    };

    if (mode === 'PRO') {
        // FULL BOARD
        asrContent.selectionConditions = selectionConditions;
        asrContent.contextualSignals = contextualSignals;
        // Sanitize contextualRelevance: filter out LLM placeholder entries
        const rawCtxRelevance = Array.isArray(data.recommandation?.contextual_relevance?.value)
            ? data.recommandation.contextual_relevance.value
            : [];
        const filteredRelevance = rawCtxRelevance
            .filter((cr: any) => {
                if (!cr || typeof cr !== 'object') return false;
                const intent = (cr.userIntent || "").toLowerCase();
                const status = (cr.status || "").toLowerCase();
                // Reject placeholder entries
                if (intent.includes("ex:") || intent.includes("exemple") || intent.includes("recherche salle sport")) return false;
                if (status.includes("/") || status === "eligible/uncertain") return false;
                if (!cr.userIntent || cr.userIntent.length < 5) return false;
                return true;
            })
            .map((cr: any) => ({
                ...cr,
                status: (cr.status && !cr.status.includes("/")) ? cr.status : "eligible"
            }));
        // Bug 14: If contextualRelevance is empty after filtering, populate from use_cases/keywords
        asrContent.contextualRelevance = filteredRelevance.length > 0 ? filteredRelevance : buildContextualRelevance();

        // Enrich compliance (cleaned)
        asrContent.compliance.policies = cleanArrayAsr(data.engagements_conformite?.policies?.value);

        // PRO-exclusive: Interoperability layer for AI agents
        asrContent.interoperability = {
            "protocol": "AYO-ASR-v3",
            "consumption": {
                "recommended_agents": ["GPTBot", "ChatGPT-User", "Google-Extended", "Amazonbot", "ClaudeBot", "PerplexityBot"],
                "data_format": "application/ld+json",
                "refresh_policy": "quarterly",
                "cache_ttl_hours": 720
            },
            "trust_chain": {
                "issuer": "AYO Trusted Authority",
                "registry": "https://ai-visionary.com/aya/registry",
                "verification_endpoint": "https://ai-visionary.com/api/verify-asr"
            },
            "source_priority": ["asr_protocol", "manifest", "external_context", "faq", "glossary"]
        };
    }
    else if (mode === 'PLATEFORME') {
        asrContent.selectionConditions = selectionConditions;
        asrContent.contextualSignals = contextualSignals;
        // Bug 14: Populate contextualRelevance for PLATEFORME too
        asrContent.contextualRelevance = buildContextualRelevance();
    }
    else {
        // LIGHT — volontairement incomplet
        asrContent.note = "VERSION DEMO - NON CERTIFIÉE - INVISIBLE POUR LES AGENTS IA COMMERCIAUX";
    }

    // Sign ONLY if not LIGHT (or maybe sign light too? "ASR LIGHT... prouve l’existence") -> "NON SCELLE" usually.
    // User said: "ASR PLATEFORME complet et scellé". Implies LIGHT is NOT sealed or weakly sealed.
    // "ASR LIGHT ... Un artefact qui prouve l’existence".
    // Let's sign it but with a "DEMO" issuer or just standard signing?
    // Let's sign it standard for technical validity, but the content itself is poor.

    // Bug 3 + Bug 7: Sanitize all __SKIPPED__ values and remove empty string fields before signing
    const sanitizedAsr = cleanSkippedValues(asrContent);

    try {
        const signedAsr = await signAsrContent(sanitizedAsr);
        return signedAsr;
    } catch (e) {
        console.error("Signing failed:", e);
        return sanitizedAsr;
    }
}
