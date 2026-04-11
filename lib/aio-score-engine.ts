
// lib/aio-score-engine.ts
export type Quality = 0 | 0.5 | 1;

type FieldNode<T> = { value: T; q: Quality; evidence: string[]; na?: boolean };

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
            is_aya_registered?: boolean;
            industry_keywords?: string[];
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

        const rawQs: number[] = [];
        expected.forEach((field) => {
            const blockObj = extract.fields?.[block as keyof typeof extract.fields];
            if (!blockObj) { rawQs.push(0); return; }

            // @ts-expect-error index dynamic but safe by design
            const node = blockObj[field];
            // N/A declared: exclude from both numerator AND denominator (neutral, not a penalty)
            if (node?.na === true) return;
            rawQs.push(qOf(node));
        });

        const rawAvg = rawQs.length > 0 ? sum(rawQs) / rawQs.length : 0; // 0..1
        const score = rawAvg * weight;

        blockScores[block] = { weight, raw: rawAvg, score };
    });

    // 2) Apply per-block caps based on data quality
    const certNode = extract.fields?.engagements_conformite?.certifications;
    const certArr = certNode?.value;
    // V4: certifications with URL evidence or na:true are NOT considered empty
    const certHasUrlEvidence = certNode?.evidence?.some((e: any) => typeof e === 'string' && /^https?:\/\//i.test(e));
    const certIsNa = certNode?.na === true;
    const certEmpty = !certIsNa && !certHasUrlEvidence && (!certArr || (Array.isArray(certArr) && certArr.length === 0) || (typeof certArr === 'string' && certArr === ''));
    if (certEmpty && blockScores.engagements_conformite) {
        blockScores.engagements_conformite.score = Math.min(blockScores.engagements_conformite.score, 8);
    }

    // b) key_indicators — V4: structured_absence or na:true = no cap
    const indNode = extract.fields?.indicateurs?.key_indicators;
    const indArr = indNode?.value;
    const indIsNa = indNode?.na === true;
    const indIsStructuredAbsence = indNode?.evidence?.includes('structured_absence');
    const indHasUrlEvidence = indNode?.evidence?.some((e: any) => typeof e === 'string' && /^https?:\/\//i.test(e));
    const hasConcreteNumbers = Array.isArray(indArr) && indArr.some((v: any) => /\d/.test(String(v)));
    // Skip cap if: na (user said N/A), structured absence (neutral), URL evidence, or has numbers
    if (!hasConcreteNumbers && !indIsNa && !indIsStructuredAbsence && !indHasUrlEvidence && blockScores.indicateurs) {
        blockScores.indicateurs.score = Math.min(blockScores.indicateurs.score, 8);
    }

    // c) No testimonials — V4: skip cap if na or structured absence
    const reviewNode = extract.fields?.indicateurs?.last_review_date;
    const reviewIsNa = reviewNode?.na === true;
    const reviewIsStructuredAbsence = reviewNode?.evidence?.includes('structured_absence');
    const noTestimonials = !reviewNode?.value || reviewNode.q === 0;
    if (noTestimonials && !reviewIsNa && !reviewIsStructuredAbsence &&
        (!indArr || (Array.isArray(indArr) && indArr.length === 0)) && !indIsNa && !indIsStructuredAbsence &&
        blockScores.indicateurs) {
        blockScores.indicateurs.score = Math.min(blockScores.indicateurs.score, 10);
    }

    // 2b) Total (base)
    let total = sum(Object.values(blockScores).map((b) => b.score));

    // 3) Règles strictes (Bible + réalité technique)
    // a) Absence de JSON-LD détectée => plafond dur (site "muet")
    const scanHasJsonLd = extract.source.scan.has_jsonld;
    const isAyaRegistered = extract.source.scan.is_aya_registered === true;

    if (scanHasJsonLd === false && !isAyaRegistered) {
        total = Math.min(total, 50);
    }

    // b) Si ASR absent : jamais 100 (max 90)
    const hasAsr = extract.source.scan.has_asr_file === true || extract.fields?.structure_technique?.has_asr?.value === true || isAyaRegistered;
    if (!hasAsr) {
        total = Math.min(total, 90);
    }

    // c) No external proof/evidence → cap total at 78 (FIX 1)
    // V4: URL evidence counts as external proof
    const hasAnyUrlEvidence = Object.values(extract.fields || {}).some((block: any) => {
        if (typeof block !== 'object' || block === null) return false;
        return Object.values(block).some((field: any) =>
            field?.evidence?.some((e: any) => typeof e === 'string' && /^https?:\/\//i.test(e))
        );
    });
    const hasExternalProof = !certEmpty || hasConcreteNumbers || hasAnyUrlEvidence ||
        (extract.source.scan.has_asr_file === true) ||
        isAyaRegistered;
    if (!hasExternalProof) {
        total = Math.min(total, 78);
    }

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

    // 5) AUDIT BLOCKS GENERATION (RICH TEXT)
    // We generate specific observations based on what pulled the score down.
    const auditBlocks: Record<string, any> = {};

    (Object.keys(WEIGHTS) as (keyof typeof WEIGHTS)[]).forEach((block) => {
        const { score } = blockScores[block];
        const max = WEIGHTS[block];
        const ratio = score / max; // 0..1

        let status = 'success';
        if (ratio < 0.5) status = 'error';
        else if (ratio < 0.8) status = 'warning';

        // Generate Observation
        const issues: string[] = [];
        const expected = EXPECTED_FIELDS[block];

        expected.forEach(field => {
            const blockObj = extract.fields?.[block];
            // @ts-expect-error dynamic access
            const node = blockObj?.[field];
            if (!node || node.q === 0) {
                // Determine Legal Name Label based on Country
                const detectedCountry = (extract.fields?.identite?.country?.value || "").toLowerCase();
                let legalLabel = "Nom légal (Registre Officiel)";
                if (detectedCountry.includes('france')) legalLabel = "Nom légal (Kbis)";
                else if (detectedCountry.includes('suisse') || detectedCountry.includes('switzerland')) legalLabel = "Nom légal (IDE / RC)";
                else if (detectedCountry.includes('belgique') || detectedCountry.includes('belgium')) legalLabel = "Nom légal (BCE)";

                // Human readable field names
                const fieldLabels: Record<string, string> = {
                    name: "Nom commercial", legal_name: legalLabel, business_type: "Type d'activité",
                    city: "Ville", country: "Pays", contact_email: "Email public", contact_phone: "Téléphone",
                    services: "Liste des services", products: "Liste des produits", use_cases: "Cas d'usage",
                    target_audience: "Public cible", pricing_indication: "Indikation tarifaire",
                    process_steps: "Étapes du processus", delivery_mode: "Mode de livraison",
                    geographies_served: "Zone d'intervention", quality_assurance: "Garanties qualité",
                    policies: "Politiques (CGV/Confidentialité)", frameworks: "Cadres de travail",
                    certifications: "Certifications", security_measures: "Mesures de sécurité",
                    key_indicators: "Chiffres clés", last_review_date: "Date de mise à jour",
                    has_faq: "FAQ structurée", has_glossary: "Glossaire sémantique",
                    has_documentation: "Documentation technique",
                    has_asr: "Fichiers ASR", has_jsonld: "Balisage Schema.org",
                    has_sitemap: "Plan du site (Sitemap)", mobile_optimized: "Optimisation Mobile"
                };
                issues.push(fieldLabels[field] || field);
            }
        });

        let observation = "";
        if (ratio >= 0.9) {
            observation = "✅ Section parfaitement optimisée pour les IA.";
        } else if (issues.length > 0) {
            const missingStr = issues.slice(0, 3).join(", "); // List max 3
            const count = issues.length;
            observation = `Manque : ${missingStr}${count > 3 ? ` et ${count - 3} autres` : ''}. Ces éléments sont critiques pour la compréhension par les LLM.`;
        } else {
            observation = "⚠️ Les données sont présentes mais jugées de faible qualité sémantique par l'IA.";
        }

        // Labels
        const blockLabels: Record<string, string> = {
            identite: "Identité & Ancrage",
            offre: "Clarté de l'Offre",
            processus_methodes: "Processus & Méthodes",
            engagements_conformite: "Confiance & Conformité",
            indicateurs: "Preuve Sociale & Métriques",
            contenus_pedagogiques: "Pédagogie & Supports",
            structure_technique: "Socle Technique AIO"
        };

        auditBlocks[block] = {
            score: Math.round(score * 10) / 10,
            max: max,
            label: blockLabels[block] || block,
            status: status,
            observation: observation
        };
    });

    return {
        total: Math.round(total * 10) / 10,
        blocks: Object.fromEntries(
            Object.entries(blockScores).map(([k, v]) => [k, Math.round(v.score * 10) / 10])
        ),
        audit: auditBlocks, // <--- EXPORT RICH AUDIT
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
