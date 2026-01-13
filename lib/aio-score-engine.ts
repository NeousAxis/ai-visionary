
// lib/aio-score-engine.ts
export type Quality = 0 | 0.5 | 1;

type FieldNode<T> = { value: T; q: Quality; evidence: string[] };

export type AyoExtract = {
    version: "AYO-EXTRACT-3.0";
    source: {
        url: string;
        scan: {
            is_reachable: boolean | null;
            has_jsonld: boolean | null;
            jsonld_count: number | null;
            has_asr_file: boolean | null;
            has_faq_content: boolean | null;
            has_faq_schema: boolean | null;
        };
    };
    fields: {
        identite: {
            name: FieldNode<string>;
            legal_name: FieldNode<string>;
            business_type: FieldNode<string>; // ex: FitnessCenter
            city: FieldNode<string>;
            country: FieldNode<string>;
            contact_email: FieldNode<string>;
            contact_phone: FieldNode<string>;
        };
        offre: {
            services: FieldNode<string[]>;
            products: FieldNode<string[]>;
            use_cases: FieldNode<string[]>; // ex: "recherche salle sport"
            target_audience: FieldNode<string>;
            pricing_indication: FieldNode<string>;
        };
        processus_methodes: {
            process_steps: FieldNode<string[]>;
            delivery_mode: FieldNode<string>;
            geographies_served: FieldNode<string>; // areaServed
            quality_assurance: FieldNode<string>;
        };
        engagements_conformite: {
            policies: FieldNode<string[]>;
            frameworks: FieldNode<string[]>;
            certifications: FieldNode<string[]>;
            security_measures: FieldNode<string[]>;
        };
        indicateurs: {
            key_indicators: FieldNode<any[]>;
            last_review_date: FieldNode<string>;
        };
        contenus_pedagogiques: {
            has_faq: FieldNode<boolean>;
            has_glossary: FieldNode<boolean>;
            has_documentation: FieldNode<boolean>;
        };
        structure_technique: {
            has_asr: FieldNode<boolean>;
            has_jsonld: FieldNode<boolean>;
            has_sitemap: FieldNode<boolean | null>;
            mobile_optimized: FieldNode<boolean>;
        };
        // NEW MODULE: CONTEXTUAL SIGNALS (V3 Requirement D) 
        contextual_signals: {
            pricing_level: FieldNode<string>; // "premium", "standard", "budget"
            access_mode: FieldNode<string>;   // "public", "membersOnly", "subscription"
            service_mode: FieldNode<string[]>; // "onSite", "online", "hybrid"
            schedule_type: FieldNode<string[]>; // "24/7", "businessHours", "appointmentOnly"
        };
        // NEW MODULE: RECOMMENDATION CONTEXT (V3)
        recommandation: {
            contextual_relevance: FieldNode<{
                userIntent: string;
                queryExamples: string[];
                decisionCriteria: string[];
                status: "eligible" | "uncertain" | "excluded";
            }[]>;
            selection_conditions: FieldNode<{
                required: string[];
                exclusion: string[];
            }>;
            ai_simulation: FieldNode<{
                query: string;
                result: "✅" | "⚠️" | "❌";
                reason: string;
            }[]>;
        };
    };
};

const WEIGHTS = {
    identite: 10,
    offre: 20,
    processus_methodes: 15,
    engagements_conformite: 15,
    indicateurs: 20,
    contenus_pedagogiques: 10,
    structure_technique: 10,
} as const;

// Champs attendus par bloc (dénominateur stable) - V2 STRICT
const EXPECTED_FIELDS: Record<keyof typeof WEIGHTS, string[]> = {
    identite: ["name", "legal_name", "business_type", "city", "country", "contact_email", "contact_phone"],
    offre: ["services", "products", "target_audience", "use_cases", "pricing_indication"],
    processus_methodes: ["process_steps", "delivery_mode", "geographies_served", "quality_assurance"],
    engagements_conformite: ["policies", "frameworks", "certifications", "security_measures"],
    indicateurs: ["key_indicators", "last_review_date"],
    contenus_pedagogiques: ["has_faq", "has_glossary", "has_documentation"],
    structure_technique: ["has_asr", "has_jsonld", "has_sitemap", "mobile_optimized"],
};

function clamp(n: number, min: number, max: number) {
    return Math.max(min, Math.min(max, n));
}

function sum(arr: number[]) {
    return arr.reduce((a, b) => a + b, 0);
}

function qOf(node: { q: Quality } | undefined): Quality {
    return node?.q ?? 0;
}

export function computeAioScore(extract: AyoExtract) {
    // 1) Scores par bloc (purs)
    const blockScores: Record<string, { weight: number; raw: number; score: number }> = {};

    (Object.keys(WEIGHTS) as (keyof typeof WEIGHTS)[]).forEach((block) => {
        const weight = WEIGHTS[block];
        const expected = EXPECTED_FIELDS[block];

        const rawQs = expected.map((field) => {
            const blockObj = extract.fields?.[block as keyof typeof extract.fields];
            if (!blockObj) return 0;

            // @ts-expect-error index dynamic but safe by design
            const node = blockObj[field];
            return qOf(node);
        });

        const rawAvg = sum(rawQs) / expected.length; // 0..1
        const score = rawAvg * weight;

        blockScores[block] = { weight, raw: rawAvg, score };
    });

    // 2) Total (base)
    let total = sum(Object.values(blockScores).map((b) => b.score));

    // 3) Règles strictes (Bible + réalité technique)
    // a) Absence de JSON-LD détectée => plafond dur (site "muet")
    // On vérifie le scan technique (vérité terrain) ET l'extraction (vérité perçue)
    const scanHasJsonLd = extract.source.scan.has_jsonld;
    if (scanHasJsonLd === false) {
        // Site techniquement muet : on force un plafond défendable
        total = Math.min(total, 50);
    }

    // b) Si ASR absent : jamais 100 (max 90)
    const hasAsr = extract.source.scan.has_asr_file === true || extract.fields?.structure_technique?.has_asr?.value === true;
    if (!hasAsr) {
        total = Math.min(total, 90);
    }

    // c) Accessibilité : si site inaccessible => technique pénalisée implicitement (optionnel)
    // Ici on ne change pas les champs, on laisse la qualité q faire le job.

    // Exception AI-VISIONARY (Hardcoded pour la démo si besoin, mais le moteur préfère la pureté)
    // On laisse l'appelant gérer les exceptions business (ex: ai-visionary.com = 100) AVANT ou APRÈS.
    // Ce moteur est PUR.

    total = clamp(total, 0, 100);

    // 4) CONTEXTUAL SCORES CALCULATION (Deterministic Logic)
    // Definition: Contextual scores are derived from specific combinations of fields relevant to a context.

    // Context A: Local Search (Target: 80+)
    // Needs: City, Country, BusinessType, Phone, GeographiesServed, MobileOptimized
    const rawLocal = (
        (qOf(extract.fields.identite.city) * 2) + // Critical
        (qOf(extract.fields.identite.country) * 1) +
        (qOf(extract.fields.identite.business_type) * 2) + // Critical
        (qOf(extract.fields.identite.contact_phone) * 1) +
        (qOf(extract.fields.processus_methodes.geographies_served) * 2) +
        (qOf(extract.fields.structure_technique.mobile_optimized) * 1)
    ); // Max potential: 2+1+2+1+2+1 = 9
    const scoreLocal = Math.min(100, (rawLocal / 9) * 100);

    // Context B: Premium/Expert Recommendation (Target: 70+)
    // Needs: Pricing, Certifications, QualityAssurance, UseCases, Frameworks
    const rawPremium = (
        (qOf(extract.fields.offre.pricing_indication) * 2) +
        (qOf(extract.fields.engagements_conformite.certifications) * 2) +
        (qOf(extract.fields.processus_methodes.quality_assurance) * 2) +
        (qOf(extract.fields.offre.use_cases) * 1) +
        (qOf(extract.fields.engagements_conformite.frameworks) * 1)
    ); // Max potential: 2+2+2+1+1 = 8
    const scorePremium = Math.min(100, (rawPremium / 8) * 100);

    // Context C: Trust & Authority (Target: 90+)
    // Needs: Name, Legal Name, Policies, Contact Email, Documentation
    const rawAuthority = (
        (qOf(extract.fields.identite.name) * 1) +
        (qOf(extract.fields.identite.legal_name) * 2) + // Critical for authority
        (qOf(extract.fields.engagements_conformite.policies) * 2) +
        (qOf(extract.fields.identite.contact_email) * 1) +
        (qOf(extract.fields.contenus_pedagogiques.has_documentation) * 1)
    ); // Max potential: 1+2+2+1+1 = 7
    const scoreAuthority = Math.min(100, (rawAuthority / 7) * 100);

    return {
        total: Math.round(total * 10) / 10, // 1 décimale stable
        blocks: Object.fromEntries(
            Object.entries(blockScores).map(([k, v]) => [k, Math.round(v.score * 10) / 10])
        ),
        // NEW: Contextual Scores
        contextual: {
            local_search: Math.round(scoreLocal),
            premium_expert: Math.round(scorePremium),
            brand_authority: Math.round(scoreAuthority)
        },
        meta: {
            has_jsonld: extract.source.scan.has_jsonld,
            has_asr: hasAsr,
            reachable: extract.source.scan.is_reachable,
        },
        method: "AYO_V3_CONTEXTUAL_BIBLE",
    };
}
