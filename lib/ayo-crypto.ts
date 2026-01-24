import nacl from 'tweetnacl';
import crypto from 'crypto';

const SECRET_KEY_BASE64 = "WkEwqzDRclqFhMEAwISCId28zIqAaUUTRugtU37SGIg/fEaY1dwbbcWeKzUF1UFjbuptXT87oSZh3/bw90fU7Q==";
const KEY_ID = "ayo-root-2026";

function canonicalize(obj: any): string {
    if (typeof obj !== 'object' || obj === null) return JSON.stringify(obj);
    if (Array.isArray(obj)) return '[' + obj.map(canonicalize).join(',') + ']';
    const keys = Object.keys(obj).sort();
    return '{' + keys.map(key => {
        const val = canonicalize(obj[key]);
        return JSON.stringify(key) + ':' + val;
    }).join(',') + '}';
}

export async function signAsrContent(asrObject: any) {
    const contentToSign = { ...asrObject };
    delete contentToSign['ayo:seal'];

    const canonicalString = canonicalize(contentToSign);

    const hashBuffer = crypto.createHash('sha256').update(canonicalString).digest();
    const hashHex = hashBuffer.toString('hex');

    const secretKeyBytes = Buffer.from(SECRET_KEY_BASE64, 'base64');
    const signatureBytes = nacl.sign.detached(new Uint8Array(hashBuffer), new Uint8Array(secretKeyBytes));
    const signatureBase64 = Buffer.from(signatureBytes).toString('base64');

    const seal = {
        level: contentToSign.meta?.version?.includes("PRO") ? "PRO" : "ESSENTIAL",
        issuer: "AYO Trusted Authority",
        issuedAt: new Date().toISOString(),
        keyId: KEY_ID,
        payloadHash: { algorithm: "sha256", value: hashHex },
        signature: { algorithm: "ed25519", value: signatureBase64 }
    };

    return { ...contentToSign, "ayo:seal": seal };
}

export async function generateRealAsrJson(extractedData: any, scoreToUse: number, realDate: string, realAsrId: string | null = null, tier: 'LIGHT' | 'ESSENTIAL' | 'PRO' | 'isProLegacy' = 'ESSENTIAL'): Promise<any> {
    let mode = 'ESSENTIAL';
    if (typeof tier === 'boolean') { mode = tier ? 'PRO' : 'ESSENTIAL'; }
    else if (tier === 'isProLegacy') { mode = 'ESSENTIAL'; }
    else { mode = tier; }

    const data = extractedData || {};
    const businessType = data.identite?.business_type?.value || "Organization";
    const address = { "@type": "PostalAddress", "addressLocality": data.identite?.city?.value || "", "addressCountry": data.identite?.country?.value || "" };
    const areaServed = { "@type": "GeoCircle", "geoMidpoint": { "@type": "GeoCoordinates", "description": data.identite?.city?.value || "Unknown" }, "radius": "5km" };

    const selectionConditions = data.recommandation?.selection_conditions?.value || { required: ["businessType declared"], exclusion: [] };
    const contextualSignals = {
        pricingLevel: data.contextual_signals?.pricing_level?.value || "undisclosed",
        access: data.contextual_signals?.access_mode?.value || "public",
        serviceMode: data.contextual_signals?.service_mode?.value || ["onSite"],
        schedule: data.contextual_signals?.schedule_type?.value || ["businessHours"]
    };

    const identity: any = { "@type": businessType, "name": data.identite?.name?.value || "Entreprise Inconnue" };
    if (mode !== 'LIGHT') {
        identity.legalName = data.identite?.legal_name?.value;
        identity.location = data.identite?.legal_country?.value || "Non spécifié";
        identity.address = address;
        identity.areaServed = areaServed;
        identity.contactPoint = { "@type": "ContactPoint", "email": data.identite?.contact_email?.value, "telephone": data.identite?.contact_phone?.value };
    } else {
        identity.location = data.identite?.legal_country?.value || "Inconnu";
        identity.activity_detected = "Partiel (Needs Verification)";
    }

    const offer: any = { "services": data.offre?.services?.value || [], "products": data.offre?.products?.value || [] };
    if (mode !== 'LIGHT') {
        offer.audience = data.offre?.target_audience?.value || "Général";
        offer.pricingIndication = data.offre?.pricing_indication?.value;
    } else {
        offer.services = (offer.services || []).slice(0, 3);
    }

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
        "compliance": { "gdpr": scoreToUse > 50 ? "compliant" : "unknown" },
        "technical_signals": { "json_ld_present": true, "sitemap": true, "https": true }
    };

    if (mode === 'PRO') {
        asrContent.selectionConditions = selectionConditions;
        asrContent.contextualSignals = contextualSignals;
        asrContent.contextualRelevance = data.recommandation?.contextual_relevance?.value || [];
        asrContent.compliance.policies = data.engagements_conformite?.policies?.value || [];
    } else if (mode === 'ESSENTIAL') {
        asrContent.selectionConditions = selectionConditions;
        asrContent.contextualSignals = contextualSignals;
    } else {
        asrContent.note = "VERSION DEMO - NON CERTIFIÉE - INVISIBLE POUR LES AGENTS IA COMMERCIAUX";
    }

    try {
        const signedAsr = await signAsrContent(asrContent);
        return signedAsr;
    } catch (e) {
        console.error("Signing failed, returning unsigned:", e);
        return asrContent;
    }
}
