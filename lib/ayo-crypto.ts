import nacl from 'tweetnacl';

// Keys loaded from environment — NEVER hardcode secrets
const SECRET_KEY_BASE64 = process.env.AYO_SIGNING_KEY || '';
const KEY_ID = process.env.AYO_KEY_ID || 'ayo-root-2026';

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
    const encoder = new TextEncoder();
    const data = encoder.encode(canonicalString);
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

// Safely convert any value to an array (handles strings, arrays, nullish)
function toArray(val: any): string[] {
    if (!val) return [];
    if (Array.isArray(val)) return val;
    if (typeof val === 'string') return val.split(',').map(s => s.trim()).filter(Boolean);
    return [];
}

// --- NETTOYAGE ORTHOGRAPHIQUE (miroir de route.ts) ---
const ASR_TERM_CORRECTIONS: [RegExp, string][] = [
    [/\bCreative Common\b(?!s)/gi, "Creative Commons"],
    [/\bword ?press\b/gi, "WordPress"], [/\bshopify\b/gi, "Shopify"],
    [/\bsquarespace\b/gi, "Squarespace"], [/\bwebflow\b/gi, "Webflow"],
    [/\brgpd\b/gi, "RGPD"], [/\bgdpr\b/gi, "GDPR"],
    [/\biso ?(9001|14001|27001|22000|26000|45001)\b/gi, "ISO $1"],
    [/\brse\b/g, "RSE"], [/\btva\b/g, "TVA"], [/\bseo\b/gi, "SEO"],
    [/\blinkedin\b/gi, "LinkedIn"], [/\bpaypal\b/gi, "PayPal"],
    [/\betc\.\.\./g, "etc."], [/\betc\.{2,}/g, "etc."],
    // Nettoyage plateforme — retirer "de Wix", "de WordPress" etc. des mesures de sécurité
    [/\bde\s+(Wix|WordPress|Squarespace|Shopify|Webflow)\b/gi, ""],
];

function cleanTextAsr(s: string): string {
    if (!s || typeof s !== 'string') return s || "";
    let cleaned = s.trim().replace(/\s{2,}/g, ' ');
    for (const [pattern, replacement] of ASR_TERM_CORRECTIONS) {
        cleaned = cleaned.replace(pattern, replacement as string);
    }
    // Trim final (suppression de "de Wix" peut laisser des espaces)
    cleaned = cleaned.replace(/\s{2,}/g, ' ').trim();
    if (cleaned.length > 0 && /^[a-zàâäéèêëïîôùûüÿç]/.test(cleaned)) {
        cleaned = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
    }
    return cleaned;
}

function cleanArrayAsr(val: any): string[] {
    return toArray(val).map(s => cleanTextAsr(s));
}

function cleanValAsr(val: any): string {
    if (!val) return "";
    return cleanTextAsr(String(val));
}

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
    // Sanitize business_type: reject LLM placeholder values
    const PLACEHOLDER_PATTERNS = /^(type schema\.?org|schema\.?org|organisation|organization|non spécifié|n\/a|undefined|null|)$/i;
    const rawBusinessType = cleanValAsr(data.identite?.business_type?.value);
    const businessType = (rawBusinessType && !PLACEHOLDER_PATTERNS.test(rawBusinessType.trim())) ? rawBusinessType : "Organization";

    // Smart @type: Use Schema.org types for associations/nonprofits
    const lowerBT = businessType.toLowerCase();
    const lowerEntityName = (data.identite?.name?.value || "").toLowerCase();
    const lowerEntityUrl = (entityUrl || data.identite?.url?.value || "").toLowerCase();
    const isAssociationType = lowerBT.includes("association") || lowerBT.includes("ong") || lowerBT.includes("fondation") || lowerBT.includes("non-profit") || lowerBT.includes("nonprofit")
        || lowerEntityName.startsWith("association ") || lowerEntityName.includes("asso ")
        || lowerEntityUrl.includes(".org");
    const schemaType = isAssociationType ? "NonProfitOrganization" : (lowerBT.includes("cabinet") || lowerBT.includes("bureau") ? "ProfessionalService" : "Organization");

    const address = {
        "@type": "PostalAddress",
        "addressLocality": cleanValAsr(data.identite?.city?.value),
        "addressCountry": cleanValAsr(data.identite?.country?.value)
    };

    // areaServed: use declared geography instead of hardcoded 5km radius
    const geoServed = cleanValAsr(data.processus_methodes?.geographies_served?.value);
    const areaServed = geoServed
        ? { "@type": "AdministrativeArea", "name": geoServed }
        : (data.identite?.country?.value
            ? { "@type": "Country", "name": cleanValAsr(data.identite.country.value) }
            : { "@type": "AdministrativeArea", "name": cleanValAsr(data.identite?.city?.value) || "Non spécifié" });

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
    const serviceModes: string[] = [];
    if (dmLower.includes("ligne") || dmLower.includes("visio") || dmLower.includes("remote") || dmLower.includes("web") || dmLower.includes("online")) serviceModes.push("remote");
    if (dmLower.includes("site") || dmLower.includes("presen") || dmLower.includes("atelier")) serviceModes.push("onSite");
    if (serviceModes.length === 0) serviceModes.push("onSite");

    const contextualSignals = {
        pricingLevel,
        access: (() => {
            const rawAccess = (data.contextual_signals?.access_mode?.value || "").toString().trim();
            // Reject compound LLM values like "public/membersOnly" — only accept clean single values
            const validAccessValues = ["public", "private", "membersOnly", "restricted", "freemium"];
            return validAccessValues.includes(rawAccess) ? rawAccess : "public";
        })(),
        serviceMode: toArray(data.contextual_signals?.service_mode?.value).length > 0 ? toArray(data.contextual_signals?.service_mode?.value) : serviceModes,
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
    // Only include additionalType if it's a real value (not the default "Organization")
    if (businessType !== "Organization") {
        identity.additionalType = businessType;
    }

    if (resolvedEntityUrl) identity.url = resolvedEntityUrl;
    if (entityDescription) identity.description = entityDescription;

    if (mode !== 'LIGHT') {
        identity.legalName = cleanValAsr(data.identite?.legal_name?.value);
        identity.location = cleanValAsr(data.identite?.country?.value) || "Non spécifié";
        identity.address = address;
        identity.areaServed = areaServed;

        // Rich contactPoint with multiple channels
        const contactChannels: any[] = [];
        if (data.identite?.contact_email?.value) {
            contactChannels.push({ "@type": "ContactPoint", "contactType": "customer service", "email": data.identite.contact_email.value });
        }
        const rawPhone = (data.identite?.contact_phone?.value || "").toString().trim();
        const validPhone = /^[\d\s\+\-\(\)\.]{6,}$/.test(rawPhone) ? rawPhone : "";
        if (validPhone) {
            contactChannels.push({ "@type": "ContactPoint", "contactType": "customer service", "telephone": validPhone });
        }
        if (resolvedEntityUrl) {
            contactChannels.push({ "@type": "ContactPoint", "contactType": "online", "url": resolvedEntityUrl });
        }
        identity.contactPoint = contactChannels.length > 0 ? contactChannels : [{ "@type": "ContactPoint", "contactType": "general" }];

        // Sector & industry detection — only if it's a real value (not placeholder)
        if (businessType !== "Organization") identity.industry = businessType;
        if (data.identite?.founding_year?.value) identity.foundingDate = data.identite.founding_year.value;
    } else {
        identity.location = data.identite?.country?.value || "Inconnu";
        identity.activity_detected = "Partiel (Needs Verification)";
    }

    // Offer
    const offer: any = {
        "services": cleanArrayAsr(data.offre?.services?.value),
        "products": cleanArrayAsr(data.offre?.products?.value),
        "use_cases": cleanArrayAsr(data.offre?.use_cases?.value),
    };

    if (mode !== 'LIGHT') {
        offer.audience = cleanValAsr(data.offre?.target_audience?.value) || "Général";
        offer.pricingIndication = cleanValAsr(data.offre?.pricing_indication?.value);
    } else {
        offer.services = (offer.services || []).slice(0, 3);
    }

    // Process & Methods
    const processus: any = {};
    if (mode !== 'LIGHT') {
        processus.process_steps = cleanArrayAsr(data.processus_methodes?.process_steps?.value);
        processus.delivery_mode = deliveryMode; // already cleaned above
        processus.geographies_served = geoServed; // already cleaned above
        processus.quality_assurance = cleanValAsr(data.processus_methodes?.quality_assurance?.value);
    }

    // Engagements & Compliance
    const engagements: any = {};
    if (mode !== 'LIGHT') {
        engagements.certifications = cleanArrayAsr(data.engagements_conformite?.certifications?.value);
        engagements.frameworks = cleanArrayAsr(data.engagements_conformite?.frameworks?.value);
        engagements.policies = cleanArrayAsr(data.engagements_conformite?.policies?.value);
        engagements.security_measures = cleanArrayAsr(data.engagements_conformite?.security_measures?.value);
    }

    // Indicators / KPIs
    const indicateurs: any = {};
    if (mode !== 'LIGHT') {
        indicateurs.key_indicators = cleanArrayAsr(data.indicateurs?.key_indicators?.value);
        indicateurs.last_review_date = data.indicateurs?.last_review_date?.value || "";
    }

    // Educational Content (NEW)
    const contenus: any = {};
    if (mode !== 'LIGHT') {
        contenus.has_faq = data.contenus_pedagogiques?.has_faq?.value || false;
        contenus.has_glossary = data.contenus_pedagogiques?.has_glossary?.value || false;
        contenus.has_documentation = data.contenus_pedagogiques?.has_documentation?.value || false;
    }

    // Meta
    const meta = {
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

    const asrContent: any = {
        "@context": "https://ai-visionary.com/contexts/aio-v3.jsonld",
        "type": "AYO_Singular_Record",
        "meta": meta,
        "identity": identity,
        "offer": offer,
        "processus_methodes": mode !== 'LIGHT' ? processus : undefined,
        "engagements_conformite": mode !== 'LIGHT' ? engagements : undefined,
        "indicateurs": mode !== 'LIGHT' ? indicateurs : undefined,
        "contenus_pedagogiques": mode !== 'LIGHT' ? contenus : undefined,
        "compliance": {
            // Basic only for LIGHT
            "gdpr": scoreToUse > 50 ? "compliant" : "unknown",
            "policies": mode !== 'LIGHT' ? cleanArrayAsr(data.engagements_conformite?.policies?.value) : undefined
        },
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

    if (mode === 'PRO') {
        // FULL BOARD
        asrContent.selectionConditions = selectionConditions;
        asrContent.contextualSignals = contextualSignals;
        // Sanitize contextualRelevance: filter out LLM placeholder entries
        const rawCtxRelevance = Array.isArray(data.recommandation?.contextual_relevance?.value)
            ? data.recommandation.contextual_relevance.value
            : [];
        asrContent.contextualRelevance = rawCtxRelevance
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

    try {
        const signedAsr = await signAsrContent(asrContent);
        return signedAsr;
    } catch (e) {
        console.error("Signing failed:", e);
        return asrContent;
    }
}
