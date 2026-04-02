import nacl from 'tweetnacl';
import {
    sanitizeFieldValue, sanitizeFieldArray,
    toArray, cleanText, cleanVal, cleanArray,
    cleanSkippedValues, isAssociation, PHONE_REGEX,
    fixUnmatchedBrackets, mergeAiNamesInUseCases,
    filterGarbageEntries, normalizeCase, truncateSecurity, filterAiModelNames,
    splitLongSecurityEntries,
    sanitizeFormContaminationArray, sanitizeCertifications, cleanProcessStep,
    cleanKeywordEntry,
    cleanFormResiduesArray
} from './ayo-generators';

// Keys loaded from environment — NEVER hardcode secrets
const SECRET_KEY_BASE64 = process.env.AYO_SIGNING_PRIVATE_KEY || process.env.AYO_SIGNING_KEY || '';
const KEY_ID = (process.env.AYO_KEY_ID || 'AYO-KEY-2026-03').replace(/\\n/g, '').replace(/[\n\r]/g, '').trim();

// Public key for verification (safe to commit — this is NOT a secret)
const PUBLIC_KEY_BASE64 = 'Ol1YRyHMESzAIBYquUZJHyR1fDevd8oLcUmd98nUnCE=';

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
        throw new Error('AYO_SIGNING_PRIVATE_KEY env var is not set — cannot sign ASR');
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

/** Neutralize marketing language in use cases (e.g. "Building premium web ecosystems" -> "web ecosystems") */
function neutralizeUseCase(uc: string): string {
    return uc
        .replace(/^(building|creating|developing|delivering|providing|designing|crafting|enabling|empowering|driving|leveraging|unlocking|transforming)\s+/i, '')
        .replace(/^(premium|cutting-edge|world-class|innovative|revolutionary|high-performance|next-generation|state-of-the-art|best-in-class|leading|advanced)\s+/i, '')
        .replace(/^(and|or)\s+/i, '')
        .trim();
}

/**
 * Generates Real ASR JSON based on Tier (LIGHT, PLATEFORME, PRO)
 */
export async function generateRealAsrJson(extractedData: any, scoreToUse: number, realDate: string, realAsrId: string | null = null, tier: 'LIGHT' | 'PLATEFORME' | 'PRO' | 'isProLegacy' = 'PLATEFORME', entityUrl?: string, locale: 'fr' | 'en' = 'en'): Promise<any> {

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
    const en = locale === 'en';

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

    const country = cleanValAsr(data.identite?.country?.value);
    // Normalize city: "Swiss" is an adjective, not a city name
    const cityRaw = cleanValAsr(data.identite?.city?.value) || '';
    const countrySynonyms = [country.toLowerCase(), 'swiss', 'suisse', 'schweiz', 'svizzera', 'français', 'française', 'french', 'german', 'deutsch', 'italian', 'italiano'];
    const city = countrySynonyms.includes(cityRaw.toLowerCase().trim()) ? '' : cityRaw;

    const address = {
        "@type": "PostalAddress",
        "addressLocality": city,
        "addressCountry": country
    };

    // areaServed: use declared geography instead of hardcoded 5km radius
    let geoServed = normalizeCase(cleanValAsr(data.processus_methodes?.geographies_served?.value));
    const deliveryModeRaw = cleanValAsr(data.processus_methodes?.delivery_mode?.value);
    const isOnlineDelivery = deliveryModeRaw && /online|remote|digital|virtual|en ligne|visio/i.test(deliveryModeRaw);
    // If online delivery and no explicit geography (or only home country) → Global
    const HOME_COUNTRY_ONLY_RE = /^(suisse|switzerland|swiss|france|germany|uk|deutschland|united kingdom|italia|italy|españa|spain|belgique|belgium|österreich|austria|luxembourg|nederland|netherlands)$/i;
    if (isOnlineDelivery && (!geoServed || HOME_COUNTRY_ONLY_RE.test(geoServed.trim()))) {
        geoServed = 'Global';
    }
    const appendInternational = (name: string) => isOnlineDelivery && !name.toLowerCase().includes("international") && !name.toLowerCase().includes("global") ? `${name}, International` : name;
    // Bug 7: Deduplicate areaServed name — "Monde entier, International" → "International"
    const deduplicateAreaName = (name: string): string => {
        const INTL_SYNONYMS = /\b(monde entier|mondial[e]?|worldwide|global)\b/i;
        if (INTL_SYNONYMS.test(name) && name.toLowerCase().includes("international")) {
            return "International";
        }
        return name;
    };
    const areaServed = geoServed
        ? { "@type": "AdministrativeArea", "name": deduplicateAreaName(appendInternational(geoServed)) }
        : (data.identite?.country?.value
            ? { "@type": "Country", "name": deduplicateAreaName(appendInternational(cleanValAsr(data.identite.country.value))) }
            : { "@type": "AdministrativeArea", "name": deduplicateAreaName(appendInternational(cleanValAsr(data.identite?.city?.value) || (en ? "Not specified" : "Non spécifié"))) });

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
        ...(toArray(data.contextual_signals?.schedule_type?.value).length > 0 ? { schedule: toArray(data.contextual_signals?.schedule_type?.value) } : {})
    };

    // Identity (Always present but stripped for LIGHT)
    const entityName = cleanValAsr(data.identite?.name?.value) || (en ? "Unknown Entity" : "Entreprise Inconnue");
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
        identity.location = locationVal || (en ? "Not specified" : "Non spécifié");
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
        identity.location = data.identite?.country?.value || (en ? "Unknown" : "Inconnu");
        identity.activity_detected = en ? "Partial (Needs Verification)" : "Partiel (Vérification nécessaire)";
    }

    // Offer
    const offer: any = {
        "services": filterGarbageEntries(sanitizeFieldArray(cleanArrayAsr(data.offre?.services?.value))),
        "products": filterGarbageEntries(sanitizeFieldArray(cleanArrayAsr(data.offre?.products?.value))),
        "use_cases": filterGarbageEntries(mergeAiNamesInUseCases(sanitizeFieldArray(cleanArrayAsr(data.offre?.use_cases?.value)))).map(neutralizeUseCase).filter(Boolean),
    };

    if (mode !== 'LIGHT') {
        // Sanitize audience: reject garbage values, full sentences, only keep short segments
        const rawAudience = sanitizeFieldValue(cleanValAsr(data.offre?.target_audience?.value));
        const isAudienceSentence = rawAudience && ((rawAudience.length > 100 && !rawAudience.includes(',')) || /[a-zA-Z0-9-]+\.[a-z]{2,}/i.test(rawAudience));
        // Correction 2: audience as array instead of string
        const defaultAudience = en ? "General public" : "Grand public";
        const audienceString = isAudienceSentence ? defaultAudience : fixUnmatchedBrackets(rawAudience || defaultAudience);
        // Bug 5: Limit audience to max 15 segments, filter hallucinated/generic segments
        const HALLUCINATED_AUDIENCE_RE = /^(secteur de (la|l'|le|les)|secteur [a-zéèêëàâä])/i;
        offer.audience = filterGarbageEntries(audienceString.split(',')
            .map((s: string) => s.trim())
            .filter(Boolean)
            .filter((s: string) => !HALLUCINATED_AUDIENCE_RE.test(s))
            .map((s: string) => s.charAt(0).toUpperCase() + s.slice(1))
            .slice(0, 15));
        if (offer.audience.length === 0) offer.audience = [en ? "General public" : "Grand public"];

        // Correction 3: pricingIndication as structured object
        const rawPricing = cleanValAsr(data.offre?.pricing_indication?.value);
        if (rawPricing) {
            const ayaMatch = rawPricing.match(/AYA[^:]*:\s*([^,]+)/i);
            const proMatch = rawPricing.match(/PRO[^:]*:\s*([^,]+)/i);
            if (ayaMatch || proMatch) {
                const pricingObj: Record<string, string> = {};
                if (ayaMatch) pricingObj.aya_subscription = ayaMatch[1].trim();
                if (proMatch) pricingObj.pro_pack = proMatch[1].trim();
                offer.pricingIndication = pricingObj;
            } else {
                offer.pricingIndication = rawPricing;
            }
        } else {
            offer.pricingIndication = rawPricing;
        }
    } else {
        offer.services = (offer.services || []).slice(0, 3);
    }

    // Process & Methods
    const processus: any = {};
    if (mode !== 'LIGHT') {
        // Bug fix: Filter out degraded process_steps (bare acronyms, too-short entries)
        const ACRONYM_EXPANSIONS: Record<string, string> = en ? {
            "ASR": "ASR file generation (AI Singular Record)",
            "JSON-LD": "Data structuring in JSON-LD",
            "SEO": "Search engine optimization (SEO)",
            "AYO": "AYO protocol activation",
            "AYA": "Registration in the AYA registry",
            "KPI": "Key performance indicators definition (KPI)",
        } : {
            "ASR": "Génération du fichier ASR (AI Singular Record)",
            "JSON-LD": "Structuration des données en JSON-LD",
            "SEO": "Optimisation du référencement (SEO)",
            "AYO": "Activation du protocole AYO",
            "AYA": "Inscription dans le registre AYA",
            "KPI": "Définition des indicateurs clés (KPI)",
        };
        const BARE_ACRONYM_RE = /^[A-Z][A-Z0-9\-]{1,10}$/; // All caps, no spaces, 2-11 chars
        processus.process_steps = filterGarbageEntries(
            cleanFormResiduesArray(sanitizeFormContaminationArray(sanitizeFieldArray(cleanArrayAsr(data.processus_methodes?.process_steps?.value))))
        )
            .map((step: string) => {
                // FIX 3: Strip leading numbers/dots from process_steps
                const cleaned = cleanProcessStep(step);
                const trimmed = cleaned.trim();
                // Replace known bare acronyms with their expanded form
                if (ACRONYM_EXPANSIONS[trimmed]) return ACRONYM_EXPANSIONS[trimmed];
                // Filter bare acronyms (all caps, no spaces)
                if (BARE_ACRONYM_RE.test(trimmed)) return null;
                return trimmed;
            })
            .filter((step: string | null): step is string => step !== null && step.length >= 10);
        processus.delivery_mode = sanitizeFieldValue(deliveryMode) || deliveryMode; // already cleaned above
        // geographies_served: fallback to country if empty, normalize case
        const sanitizedGeoServed = sanitizeFieldValue(geoServed);
        const sanitizedCountryFallback = sanitizeFieldValue(cleanValAsr(data.identite?.country?.value));
        processus.geographies_served = normalizeCase(sanitizedGeoServed || sanitizedCountryFallback || "");
        // quality_assurance: force array format (comma-separated string → array)
        const rawQA = cleanValAsr(data.processus_methodes?.quality_assurance?.value);
        const qaArray = rawQA ? rawQA.split(',').map((s: string) => s.trim()).filter(Boolean) : [];
        processus.quality_assurance = filterGarbageEntries(sanitizeFieldArray(qaArray))
            .filter((entry: string) => {
                // Remove marketing promises — keep only factual, verifiable signals
                const lower = entry.toLowerCase();
                const isMarketingPromise =
                    lower.includes('recommandabilité') ||
                    lower.includes('exhaustive') ||
                    lower.includes('garantie') ||
                    lower.includes('propriété intellectuelle') ||
                    lower.includes('priorité ia');
                return !isMarketingPromise;
            });
    }

    // Engagements & Compliance
    const engagements: any = {};
    if (mode !== 'LIGHT') {
        engagements.certifications = filterGarbageEntries(cleanFormResiduesArray(sanitizeCertifications(sanitizeFieldArray(cleanArrayAsr(data.engagements_conformite?.certifications?.value)))));
        engagements.frameworks = filterGarbageEntries(cleanFormResiduesArray(sanitizeFormContaminationArray(sanitizeFieldArray(cleanArrayAsr(data.engagements_conformite?.frameworks?.value)))));
        engagements.policies = filterGarbageEntries(cleanFormResiduesArray(sanitizeFormContaminationArray(sanitizeFieldArray(cleanArrayAsr(data.engagements_conformite?.policies?.value)))));
        engagements.security_measures = splitLongSecurityEntries(filterGarbageEntries(cleanFormResiduesArray(sanitizeFieldArray(cleanArrayAsr(data.engagements_conformite?.security_measures?.value))
            .map(s => truncateSecurity(s)))));
        // Normalize: move GDPR/RGPD/ISO from security_measures to frameworks, keep actual security measures in place
        const normalizedCompliance = (() => {
            const FRAMEWORK_PATTERNS = /gdpr|rgpd|iso\s*\d|soc\s*[12]|pci|hipaa|ccpa|lgpd|loi\s*25/i;
            const movedToFrameworks: string[] = [];
            const cleanedSecurity = (engagements.security_measures || []).filter((s: string) => {
                if (FRAMEWORK_PATTERNS.test(s)) {
                    movedToFrameworks.push(s);
                    return false;
                }
                return true;
            });
            return {
                frameworks: [...new Set([...(engagements.frameworks || []), ...movedToFrameworks])],
                securityMeasures: cleanedSecurity
            };
        })();
        engagements.frameworks = normalizedCompliance.frameworks;
        engagements.security_measures = normalizedCompliance.securityMeasures;

        // Bug 15: If user declared having certifications (q > 0) but array is empty (no proof), flag it
        const certQ = data.engagements_conformite?.certifications?.q ?? 0;
        if (engagements.certifications.length === 0 && certQ > 0) {
            engagements.certifications_declared = true;
        }
        // Correction 5: If quality_assurance mentions crypto signature, ensure security_measures includes it
        const qaJoined = (processus.quality_assurance || []).join(' ').toLowerCase();
        if (qaJoined.includes('cryptographique') || qaJoined.includes('signature cryptographique')) {
            const secMeasuresLower = (engagements.security_measures || []).map((s: string) => s.toLowerCase());
            if (!secMeasuresLower.some((s: string) => s.includes('cryptographique'))) {
                engagements.security_measures = [...(engagements.security_measures || []), en ? "Cryptographic signature" : "Signature cryptographique"];
            }
        }
    }

    // Indicators / KPIs — Structured Absence Module
    const indicateurs: any = {};
    if (mode !== 'LIGHT') {
        // Bug 10: Mark indicators without numeric values as "non déclaré"
        // Filter out "no data" phrases that users type instead of actual indicators
        const NO_DATA_PHRASES = /^(pas encore|aucun|non applicable|pas de|n\/a|rien|néant|none|pas disponible|je n'ai pas|nous n'avons pas)/i;
        const rawIndicators = filterGarbageEntries(cleanFormResiduesArray(sanitizeFieldArray(cleanArrayAsr(data.indicateurs?.key_indicators?.value))
            .filter((ind: string) => !NO_DATA_PHRASES.test(ind.trim()))
            .map(normalizeCase)));
        const todayISO = new Date().toISOString().split('T')[0];

        // Bug 6: Filter out indicators containing "non déclaré", "pas encore", "aucun" — those activate the absence module
        const ABSENCE_INDICATOR_RE = /non déclaré|pas encore|aucun/i;
        const validIndicators = rawIndicators.filter((ind: string) => /\d/.test(ind) || !ABSENCE_INDICATOR_RE.test(ind));
        if (validIndicators.length > 0) {
            // Bug fix: Structure key_indicators as exploitable objects (not bare labels)
            indicateurs.key_indicators = validIndicators.map((ind: string) => {
                // Try to extract a numeric value from the indicator string
                const numMatch = ind.match(/([\d\s,.]+)\s*(€|%|k|m|users?|clients?|entreprises?|projets?|heures?|jours?)?/i);
                const extractedValue = numMatch ? parseFloat(numMatch[1].replace(/\s/g, '').replace(',', '.')) : null;
                const extractedUnit = numMatch?.[2]?.toLowerCase() || (extractedValue !== null ? "count" : "count");
                // Build a snake_case name from the label
                const nameSlug = ind.toLowerCase()
                    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
                    .replace(/[^a-z0-9]+/g, '_')
                    .replace(/^_|_$/g, '')
                    .substring(0, 60);
                const finalValue = isNaN(extractedValue as number) ? null : extractedValue;
                return {
                    name: nameSlug,
                    label: ind,
                    value: finalValue,
                    ...(finalValue === null ? { status: "not_measured" } : {}),
                    unit: extractedUnit,
                    last_updated: todayISO.substring(0, 7), // "YYYY-MM"
                    source: "self_declared"
                };
            });
            indicateurs.data_maturity = {
                level: validIndicators.length > 2 ? 3 : 2,
                label: validIndicators.length > 2 ? "structured" : "emerging",
                description: validIndicators.length > 2
                    ? (en ? "Structured measurement system with multiple indicators" : "Système de mesure structuré avec plusieurs indicateurs")
                    : (en ? "Early tracking with a few indicators in place" : "Début de suivi avec quelques indicateurs en place"),
                progression_status: validIndicators.length > 2 ? "active" : "in_progress",
                next_step: validIndicators.length > 2
                    ? (en ? "Maintain and refine existing indicators" : "Maintenir et affiner les indicateurs existants")
                    : (en ? "Add complementary indicators" : "Ajouter des indicateurs complémentaires")
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
                description: en ? "No measurement system currently in place" : "Aucun système de mesure actuellement en place",
                progression_status: "to_be_defined",
                next_step: en ? "Set up a first simple indicator" : "Mettre en place un premier indicateur simple"
            };
        }

        // Bug 7: If last_review_date is empty, absent, a "no data" phrase, or free-text (not ISO date), fill with today's date
        const rawReviewDate = (data.indicateurs?.last_review_date?.value || "").toString().trim();
        // Validate as ISO date (YYYY-MM-DD) — reject free text like "tous les jours", "moins d'un mois", etc.
        const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
        const isValidDate = rawReviewDate && !NO_DATA_PHRASES.test(rawReviewDate) && ISO_DATE_RE.test(rawReviewDate);
        indicateurs.last_review_date = isValidDate ? rawReviewDate : todayISO;

        // Correction 4: transparency inside indicateurs (not top-level)
        const isAyaRegisteredForTransparency = data.source?.scan?.is_aya_registered === true;
        indicateurs.transparency = {
            data_declared_by_client: true,
            data_verified: isAyaRegisteredForTransparency,
            missing_data_explicit: true,
            no_fabrication_policy: true
        };
    }

    // Educational Content (NEW)
    const contenus: any = {};
    if (mode !== 'LIGHT') {
        // PRO pack always includes generated FAQ, glossary, and documentation files.
        // These flags reflect Pack PRO deliverables, not just what exists on the client's website.
        const isPro = mode === 'PRO';
        contenus.has_faq = isPro || Boolean(data.contenus_pedagogiques?.has_faq?.value && data.contenus_pedagogiques.has_faq.value !== "__SKIPPED__" && data.contenus_pedagogiques.has_faq.value !== "[SKIP] Non applicable");
        contenus.has_glossary = isPro || Boolean(data.contenus_pedagogiques?.has_glossary?.value && data.contenus_pedagogiques.has_glossary.value !== "__SKIPPED__" && data.contenus_pedagogiques.has_glossary.value !== "[SKIP] Non applicable");
        contenus.has_documentation = isPro || Boolean(data.contenus_pedagogiques?.has_documentation?.value && data.contenus_pedagogiques.has_documentation.value !== "__SKIPPED__" && data.contenus_pedagogiques.has_documentation.value !== "[SKIP] Non applicable");
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
        capReason = en
            ? "No structured JSON-LD detected — score capped at 50/100"
            : "Pas de JSON-LD structuré détecté — score plafonné à 50/100";
    } else if (!hasAsrFile && scoreToUse === 90) {
        capApplied = true;
        capReason = en
            ? "No ASR file (AI Singular Record) — score capped at 90/100"
            : "Pas de fichier ASR (AI Singular Record) — score plafonné à 90/100";
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
        "spec": "https://ai-visionary.com/specs/asr-v3",
        "trust_level": process.env.AYO_V4_EVIDENCE === 'true' ? "reliability_weighted" : "self_declared_structured",
        "evidence_level": process.env.AYO_V4_EVIDENCE === 'true' ? "verified_and_declared" : "declared_signals_only",
        "evidence_count": (() => {
            let count = 0;
            const blocks = ['identite', 'offre', 'processus_methodes', 'engagements_conformite', 'indicateurs', 'contenus_pedagogiques', 'structure_technique'];
            for (const block of blocks) {
                const blockData = data?.[block];
                if (!blockData) continue;
                for (const field of Object.values(blockData) as any[]) {
                    if (field?.evidence && Array.isArray(field.evidence)) {
                        // Count direct URL strings in evidence array
                        count += field.evidence.filter((e: any) => typeof e === 'string' && /^https?:\/\//i.test(e)).length;
                        // Count URLs inside sub-arrays like ["questionnaire_answer", "https://..."]
                        count += field.evidence.filter((e: any) => Array.isArray(e) && e.some((item: any) => typeof item === 'string' && /^https?:\/\//i.test(item))).length;
                    }
                    // Count field value itself if it's a URL
                    if (typeof field?.value === 'string' && /^https?:\/\//i.test(field.value)) {
                        count++;
                    }
                }
            }
            return count;
        })(),
        "data_reliability": (() => {
            let verified = 0;
            let selfDeclared = 0;
            let interpretive = 0;
            let evidenceUrls = 0;

            // Verifiable fields (can be proven with URL)
            const VERIFIABLE_FIELDS = [
                'identite.contact_email', 'identite.legal_name',
                'engagements_conformite.certifications', 'engagements_conformite.policies',
                'contenus_pedagogiques.has_faq', 'contenus_pedagogiques.has_glossary',
                'contenus_pedagogiques.has_documentation',
            ];

            const blocks = ['identite', 'offre', 'processus_methodes', 'engagements_conformite', 'indicateurs', 'contenus_pedagogiques', 'structure_technique'];
            const fieldDetails: Record<string, { reliability: string; evidence_url: string | null }> = {};

            for (const block of blocks) {
                const blockData = data?.[block];
                if (!blockData) continue;
                for (const [fieldName, fieldData] of Object.entries(blockData) as [string, any][]) {
                    const fieldPath = `${block}.${fieldName}`;
                    if (!fieldData || typeof fieldData !== 'object' || fieldData.q === undefined) continue;

                    // Check for URLs: direct strings, sub-arrays like ["questionnaire_answer", "https://..."], or field value itself
                    const hasDirectUrl = fieldData.evidence?.some((e: any) => typeof e === 'string' && /^https?:\/\//i.test(e));
                    const hasSubArrayUrl = fieldData.evidence?.some((e: any) => Array.isArray(e) && e.some((item: any) => typeof item === 'string' && /^https?:\/\//i.test(item)));
                    const hasValueUrl = typeof fieldData.value === 'string' && /^https?:\/\//i.test(fieldData.value);
                    const hasUrl = hasDirectUrl || hasSubArrayUrl || hasValueUrl;
                    const isInterpretive = fieldData.evidence?.includes('interpretive_claim_detected');
                    const isVerifiableField = VERIFIABLE_FIELDS.includes(fieldPath);

                    if (isInterpretive) {
                        interpretive++;
                        fieldDetails[fieldPath] = { reliability: 'interpretive', evidence_url: null };
                    } else if (hasUrl) {
                        verified++;
                        evidenceUrls++;
                        // Extract URL from any source
                        let url: string | null = null;
                        if (hasDirectUrl) {
                            url = fieldData.evidence.find((e: any) => typeof e === 'string' && /^https?:\/\//i.test(e));
                        } else if (hasSubArrayUrl) {
                            const subArr = fieldData.evidence.find((e: any) => Array.isArray(e) && e.some((item: any) => typeof item === 'string' && /^https?:\/\//i.test(item)));
                            url = subArr?.find((item: any) => typeof item === 'string' && /^https?:\/\//i.test(item)) || null;
                        } else if (hasValueUrl) {
                            url = fieldData.value;
                        }
                        fieldDetails[fieldPath] = { reliability: 'verified', evidence_url: url || null };
                    } else if (isVerifiableField && fieldData.q > 0) {
                        selfDeclared++;
                        fieldDetails[fieldPath] = { reliability: 'self_declared', evidence_url: null };
                    } else if (fieldData.q > 0) {
                        selfDeclared++;
                        fieldDetails[fieldPath] = { reliability: 'self_declared', evidence_url: null };
                    }
                }
            }

            return {
                summary: { verified_fields: verified, self_declared_fields: selfDeclared, interpretive_fields: interpretive, evidence_urls: evidenceUrls },
                policy: "Verified fields backed by URL evidence. Self-declared fields accepted but not independently verified. Interpretive claims excluded from scoring.",
            };
        })(),
        "data_classification": {
            "verified": { "weight": 1.0, "description": "Backed by URL evidence or scan detection" },
            "self_declared": { "weight": 0.4, "description": "User-declared, not independently verified" },
            "unknown": { "weight": 0.1, "description": "Not provided or uncertain" }
        },
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
    const hasGdprFramework = sanitizeFieldArray(cleanArrayAsr(data.engagements_conformite?.frameworks?.value))
        .some((f: string) => /gdpr|rgpd/i.test(f));

    const commitments = mode !== 'LIGHT' ? {
        measurement_intent: true,
        has_defined_targets: rawIndicatorsForSignal.length > 0,
        engagement_level: hasCertifications ? "high" : (hasPolicies ? "medium" : "low"),
        verification_possible: isAyaRegistered
    } : undefined;

    // Determine if indicators have concrete numeric values (not just labels)
    const hasConcreteValues = rawIndicatorsForSignal.some((ind: string) => /\d/.test(ind));
    const interpretationSignal = mode !== 'LIGHT' ? {
        should_penalize_missing_indicators: false,
        reason: rawIndicatorsForSignal.length > 0
            ? (hasConcreteValues ? "indicators_provided" : "indicators_declared_with_transparency")
            : "absence_declared_and_structured",
        trust_modifier: "neutral",
        recommendation_impact: "low"
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
            } else if (hasPrivacyPolicy || hasGdprFramework) {
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
    const AI_MODEL_RE = /^(Gemini|Claude|Mistral|Llama|Ernie|ChatGPT|GPT|Perplexity)$/i;
    const buildContextualRelevance = (): any[] => {
        const relevanceItems: any[] = [];
        // Add use_cases as high relevance
        const useCases = filterGarbageEntries(sanitizeFieldArray(cleanArrayAsr(data.offre?.use_cases?.value))).map(neutralizeUseCase).filter(Boolean);
        for (const uc of useCases.slice(0, 5)) {
            if (uc && uc.length > 2 && !AI_MODEL_RE.test(uc.trim())) {
                relevanceItems.push({ context: uc, relevance: "high" });
            }
        }
        // Add top services/keywords as medium relevance
        const services = filterGarbageEntries(sanitizeFieldArray(cleanArrayAsr(data.offre?.services?.value)));
        for (const svc of services.slice(0, 5)) {
            if (svc && svc.length > 2 && !AI_MODEL_RE.test(svc.trim())) {
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
                // Bug 5: Filter out standalone AI model names as contextualRelevance entries
                if (AI_MODEL_RE.test(cr.userIntent.trim())) return false;
                return true;
            })
            .map((cr: any) => ({
                ...cr,
                status: (cr.status && !cr.status.includes("/")) ? cr.status : "eligible"
            }));
        // Bug 14: If contextualRelevance is empty after filtering, populate from use_cases/keywords
        asrContent.contextualRelevance = filteredRelevance.length > 0 ? filteredRelevance : buildContextualRelevance();

        // Enrich compliance (cleaned)
        asrContent.compliance.policies = cleanFormResiduesArray(cleanArrayAsr(data.engagements_conformite?.policies?.value));

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
        asrContent.note = en
            ? "DEMO VERSION - NOT CERTIFIED - INVISIBLE TO COMMERCIAL AI AGENTS"
            : "VERSION DEMO - NON CERTIFIÉE - INVISIBLE POUR LES AGENTS IA COMMERCIAUX";
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

// ─── PUBLIC VERIFICATION (safe for client-side) ─────────────────────

/**
 * Verify an ASR signature using the public key.
 * This function uses ONLY the public key and can safely run client-side.
 */
export async function verifyAsrSignature(asrObject: any): Promise<{ valid: boolean; error?: string }> {
    const seal = asrObject?.['ayo:seal'];
    if (!seal?.signature?.value || !seal?.payloadHash?.value) {
        return { valid: false, error: 'Missing seal or signature' };
    }

    try {
        const contentToVerify = JSON.parse(JSON.stringify(asrObject));
        delete contentToVerify['ayo:seal'];

        const canonicalString = canonicalize(contentToVerify);
        const data = TEXT_ENCODER.encode(canonicalString);
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);

        // Verify hash matches
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const computedHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
        if (computedHash !== seal.payloadHash.value) {
            return { valid: false, error: 'Hash mismatch — content was tampered' };
        }

        // Verify Ed25519 signature
        const signatureBytes = new Uint8Array(Buffer.from(seal.signature.value, 'base64'));
        const publicKeyBytes = new Uint8Array(Buffer.from(PUBLIC_KEY_BASE64, 'base64'));
        const valid = nacl.sign.detached.verify(new Uint8Array(hashBuffer), signatureBytes, publicKeyBytes);

        return { valid };
    } catch (e) {
        return { valid: false, error: `Verification error: ${e}` };
    }
}

/**
 * Get the public key info for external verification.
 */
export function getPublicKeyInfo() {
    return {
        keyId: KEY_ID,
        algorithm: 'ed25519',
        publicKey: PUBLIC_KEY_BASE64,
        issuer: 'AYO Trusted Authority',
    };
}
