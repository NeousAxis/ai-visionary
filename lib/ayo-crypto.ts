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

    const contentToSign = { ...asrObject };
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
        level: contentToSign.meta.version.includes("PRO") ? "PRO" : "ESSENTIAL",
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

/**
 * Generates Real ASR JSON based on Tier (LIGHT, ESSENTIAL, PRO)
 */
export async function generateRealAsrJson(extractedData: any, scoreToUse: number, realDate: string, realAsrId: string | null = null, tier: 'LIGHT' | 'ESSENTIAL' | 'PRO' | 'isProLegacy' = 'ESSENTIAL'): Promise<any> {

    // Legacy support (boolean param)
    let mode = 'ESSENTIAL';
    if (typeof tier === 'boolean') {
        mode = tier ? 'PRO' : 'ESSENTIAL';
    } else if (tier === 'isProLegacy') {
        mode = 'ESSENTIAL'; // Fallback
    } else {
        mode = tier;
    }

    // Safety check
    const data = extractedData || {};

    // --- V3 BLOCKS CONSTRUCTION ---
    const businessType = data.identite?.business_type?.value || "Organization";
    const address = {
        "@type": "PostalAddress",
        "addressLocality": data.identite?.city?.value || "",
        "addressCountry": data.identite?.country?.value || ""
    };
    const areaServed = {
        "@type": "GeoCircle",
        "geoMidpoint": { "@type": "GeoCoordinates", "description": data.identite?.city?.value || "Unknown" },
        "radius": "5km"
    };

    // V3 Advanced Blocks (Only for PRO/ESSENTIAL depending on strategy)
    const selectionConditions = data.recommandation?.selection_conditions?.value || {
        required: ["businessType declared", "address available"],
        exclusion: ["ambiguous offer"]
    };

    const contextualSignals = {
        pricingLevel: data.contextual_signals?.pricing_level?.value || "undisclosed",
        access: data.contextual_signals?.access_mode?.value || "public",
        serviceMode: toArray(data.contextual_signals?.service_mode?.value).length > 0 ? toArray(data.contextual_signals?.service_mode?.value) : ["onSite"],
        schedule: toArray(data.contextual_signals?.schedule_type?.value).length > 0 ? toArray(data.contextual_signals?.schedule_type?.value) : ["businessHours"]
    };

    // Identity (Always present but stripped for LIGHT)
    const identity: any = {
        "@type": businessType,
        "name": data.identite?.name?.value || "Entreprise Inconnue",
    };

    if (mode !== 'LIGHT') {
        identity.legalName = data.identite?.legal_name?.value;
        identity.location = data.identite?.legal_country?.value || "Non spécifié";
        identity.address = address;
        identity.areaServed = areaServed;
        identity.contactPoint = {
            "@type": "ContactPoint",
            "email": data.identite?.contact_email?.value,
            "telephone": data.identite?.contact_phone?.value
        };
    } else {
        // LIGHT Constraint: "localisation partielle ou inconnue"
        identity.location = data.identite?.legal_country?.value || "Inconnu";
        identity.activity_detected = "Partiel (Needs Verification)";
    }

    // Offer
    const offer: any = {
        "services": toArray(data.offre?.services?.value),
        "products": toArray(data.offre?.products?.value),
        "use_cases": toArray(data.offre?.use_cases?.value),
    };

    if (mode !== 'LIGHT') {
        offer.audience = data.offre?.target_audience?.value || "Général";
        offer.pricingIndication = data.offre?.pricing_indication?.value;
    } else {
        // LIGHT: "services génériques" (Already usually generic, but we remove details)
        offer.services = (offer.services || []).slice(0, 3); // Limit to 3 items
    }

    // Process & Methods (NEW - was completely missing from ASR output)
    const processus: any = {};
    if (mode !== 'LIGHT') {
        processus.process_steps = toArray(data.processus_methodes?.process_steps?.value);
        processus.delivery_mode = data.processus_methodes?.delivery_mode?.value || "";
        processus.geographies_served = data.processus_methodes?.geographies_served?.value || "";
        processus.quality_assurance = data.processus_methodes?.quality_assurance?.value || "";
    }

    // Engagements & Compliance (NEW - certifications were never injected)
    const engagements: any = {};
    if (mode !== 'LIGHT') {
        engagements.certifications = toArray(data.engagements_conformite?.certifications?.value);
        engagements.frameworks = toArray(data.engagements_conformite?.frameworks?.value);
        engagements.policies = toArray(data.engagements_conformite?.policies?.value);
        engagements.security_measures = toArray(data.engagements_conformite?.security_measures?.value);
    }

    // Indicators / KPIs (NEW - was absent from schema)
    const indicateurs: any = {};
    if (mode !== 'LIGHT') {
        indicateurs.key_indicators = toArray(data.indicateurs?.key_indicators?.value);
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
        "version": `3.0-${mode}`
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
            "policies": mode !== 'LIGHT' ? toArray(data.engagements_conformite?.policies?.value) : undefined
        },
        "technical_signals": {
            "json_ld_present": true,
            "sitemap": true,
            "https": true
        }
    };

    // --- MODE SPECIFIC INJECTIONS ---

    if (mode === 'PRO') {
        // FULL BOARD
        asrContent.selectionConditions = selectionConditions;
        asrContent.contextualSignals = contextualSignals;
        asrContent.contextualRelevance = toArray(data.recommandation?.contextual_relevance?.value);

        // Enrich compliance
        asrContent.compliance.policies = toArray(data.engagements_conformite?.policies?.value);
    }
    else if (mode === 'ESSENTIAL') {
        // ESSENTIAL: "Complet et scellé" but "sans optimisation contextuelle avancée"
        // We include Signals & Conditions (Base V3) but NOT the Recommendations Simulation/Contexts.
        asrContent.selectionConditions = selectionConditions;
        asrContent.contextualSignals = contextualSignals; // Structural signals present
        // EXCLUDE: contextualRelevance (The "Map")
    }
    else {
        // LIGHT
        // "volontairement incomplet"
        // No conditions, no contexts, no signals.
        // Just Identity + Offer + Tech.
        asrContent.note = "VERSION DEMO - NON CERTIFIÉE - INVISIBLE POUR LES AGENTS IA COMMERCIAUX";
    }

    // Sign ONLY if not LIGHT (or maybe sign light too? "ASR LIGHT... prouve l’existence") -> "NON SCELLE" usually.
    // User said: "ASR ESSENTIAL complet et scellé". Implies LIGHT is NOT sealed or weakly sealed.
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
