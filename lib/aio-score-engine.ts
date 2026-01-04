
// lib/aio-score-engine.ts
export type Quality = 0 | 0.5 | 1;

type FieldNode<T> = { value: T; q: Quality; evidence: string[] };

export type AyoExtract = {
    version: "AYO-EXTRACT-1.0";
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
            legal_country: FieldNode<string>;
        };
        offre: {
            services: FieldNode<string[]>;
            products: FieldNode<string[]>;
            target_audience: FieldNode<string>;
        };
        processus_methodes: {
            process_steps: FieldNode<string[]>;
            delivery_mode: FieldNode<string>;
            geographies_served: FieldNode<string>;
        };
        engagements_conformite: {
            policies: FieldNode<string[]>;
            frameworks: FieldNode<string[]>;
            certifications: FieldNode<string[]>;
        };
        indicateurs: {
            key_indicators: FieldNode<any[]>;
        };
        contenus_pedagogiques: {
            has_faq: FieldNode<boolean>;
            has_glossary: FieldNode<boolean>;
        };
        structure_technique: {
            has_asr: FieldNode<boolean>;
            has_jsonld: FieldNode<boolean>;
            has_sitemap: FieldNode<boolean | null>;
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

// Champs attendus par bloc (dénominateur stable)
const EXPECTED_FIELDS: Record<keyof typeof WEIGHTS, string[]> = {
    identite: ["name", "legal_country"],
    offre: ["services", "products", "target_audience"],
    processus_methodes: ["process_steps", "delivery_mode", "geographies_served"],
    engagements_conformite: ["policies", "frameworks", "certifications"],
    indicateurs: ["key_indicators"],
    contenus_pedagogiques: ["has_faq", "has_glossary"],
    structure_technique: ["has_asr", "has_jsonld", "has_sitemap"],
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
            // @ts-expect-error index dynamic but safe by design
            const node = extract.fields[block][field];
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
    const hasAsr = extract.source.scan.has_asr_file === true || extract.fields.structure_technique.has_asr.value === true;
    if (!hasAsr) {
        total = Math.min(total, 90);
    }

    // c) Accessibilité : si site inaccessible => technique pénalisée implicitement (optionnel)
    // Ici on ne change pas les champs, on laisse la qualité q faire le job.

    // Exception AI-VISIONARY (Hardcoded pour la démo si besoin, mais le moteur préfère la pureté)
    // On laisse l'appelant gérer les exceptions business (ex: ai-visionary.com = 100) AVANT ou APRÈS.
    // Ce moteur est PUR.

    total = clamp(total, 0, 100);

    return {
        total: Math.round(total * 10) / 10, // 1 décimale stable
        blocks: Object.fromEntries(
            Object.entries(blockScores).map(([k, v]) => [k, Math.round(v.score * 10) / 10])
        ),
        meta: {
            has_jsonld: extract.source.scan.has_jsonld,
            has_asr: hasAsr,
            reachable: extract.source.scan.is_reachable,
        },
        method: "AYO_V1_BIBLE_WEIGHTS_PURE",
    };
}
