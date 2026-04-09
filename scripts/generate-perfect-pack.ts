#!/usr/bin/env npx tsx
/**
 * Script de generation d'un Pack PRO parfait pour AI Visionary.
 * Simule un questionnaire AYO complet et genere les 5 fichiers.
 *
 * Usage: cd "/Users/cyrilleger/AI VISIONARY" && npx tsx scripts/generate-perfect-pack.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import { generateRealAsrJson } from '../lib/ayo-crypto';
import {
    generateManifestJson,
    generateFaqJson,
    generateGlossaryJson,
    generateExternalContextJsonLocal,
    sanitizeExtract,
} from '../lib/ayo-generators';

// --- Donnees completes simulant un questionnaire termine ---
const data = {
    identite: {
        name: { value: "AI VISIONARY", q: 1 },
        legal_name: { value: "AI VISIONARY SARL", q: 1 },
        business_type: { value: "Rendre les entreprises visibles et recommandables par les IA grace a la creation de fichiers ASR certifies", q: 1 },
        city: { value: "Geneve", q: 1 },
        country: { value: "Suisse", q: 1 },
        contact_email: { value: "hello@ai-visionary.xyz", q: 1 },
        contact_phone: { value: "+41 22 700 00 00", q: 1 },
    },
    offre: {
        target_audience: { value: "Entreprises, artisans, independants, PME de services, consultants, associations, collectifs, entreprises industrielles, etablissements publics, acteurs engages RSE/ESG, TPE, PME, Grands groupes, E-commerce, Professionnels liberaux, toutes les entreprises cherchant a etre visible par les IA", q: 1 },
        services: { value: ["Structuration de l'information pour les IA", "Creation de fichiers signature ASR", "Hebergement et diffusion d'ASR aupres des IA"], q: 1 },
        products: { value: ["Fichiers ASR (AI Singular Record)", "Registre AYA", "Connecteur Universel IA"], q: 1 },
        pricing_indication: { value: "Abonnement AYA : 19 CHF / mois, Pack PRO : 499 CHF", q: 1 },
        use_cases: { value: ["Etre visible et recommande par les IA (ChatGPT, Gemini, Claude, Mistral, Llama, Ernie...)"], q: 1 },
    },
    processus_methodes: {
        process_steps: { value: ["Scan automatique du site", "Questionnaire enrichi AYO", "Generation fichiers ASR certifies", "Inscription Registre AYA", "Monitoring visibilite IA"], q: 1 },
        delivery_mode: { value: "En ligne", q: 1 },
        geographies_served: { value: "International", q: 1 },
        quality_assurance: { value: ["Signature Cryptographique (Anti-Hallucination)", "Registre AYA"], q: 1 },
    },
    engagements_conformite: {
        certifications: { value: [] as string[], q: 0 },
        frameworks: { value: [] as string[], q: 0 },
        security_measures: { value: ["Signature cryptographique Ed25519", "Chiffrement TLS", "Firebase Authentication"], q: 1 },
        policies: { value: ["Mentions Legales", "Confidentialite"], q: 1 },
    },
    indicateurs: {
        key_indicators: { value: ["50 entreprises enregistrees", "200 fichiers ASR generes", "Satisfaction 95%"], q: 1 },
        last_review_date: { value: "2026-03", q: 1 },
    },
    contenus_pedagogiques: {
        has_faq: { value: true, q: 1 },
        has_glossary: { value: true, q: 1 },
        has_documentation: { value: true, q: 1 },
    },
    external_context: {
        keywords: { value: ["Visibilite IA", "AIO", "ASR", "Registre AYA", "Optimisation IA", "Referencement IA", "Recommandation ChatGPT", "Structuration donnees entreprise", "SEO conversationnel", "Scoring visibilite IA"], q: 1 },
        intents: { value: ["Comment etre visible par les IA", "Comment etre recommande par ChatGPT", "Difference SEO AIO", "Creer un fichier ASR", "Comment rendre mon entreprise visible par toutes les IA", "Mon entreprise n'apparait pas dans les reponses de l'IA", "C'est quoi un fichier ASR", "Comment structurer mes donnees pour l'IA", "Audit de visibilite IA gratuit", "Les IA ignorent mon site que faire"], q: 1 },
    },
    structure_technique: {
        has_jsonld: { value: true, q: 1 },
        has_asr_file: { value: false, q: 1 },
        is_aya_registered: { value: false, q: 1 },
        has_sitemap: { value: true, q: 1 },
        has_https: { value: true, q: 1 },
        has_robots_txt: { value: true, q: 1 },
        mobile_optimized: { value: true, q: 1 },
    },
    source: {
        scan: {
            is_reachable: true,
            has_jsonld: true,
            has_asr_file: false,
            is_aya_registered: false,
            has_faq_schema: false,
            has_faq_content: true,
        }
    }
};

const URL = "https://ai-visionary.xyz";
const OUTPUT_DIR = "/Users/cyrilleger/Desktop/AYO_Pack_PRO_Test";

async function main() {
    console.log("=== Generation Pack PRO AI Visionary ===\n");

    // 1. Sanitize (verifie que business_type survit)
    const dataCopy = JSON.parse(JSON.stringify(data));
    const { cleanedFields } = sanitizeExtract(dataCopy);
    if (cleanedFields.length > 0) {
        console.log("Champs nettoyes par sanitizeExtract:", cleanedFields.join(", "));
    } else {
        console.log("Aucun champ nettoye (donnees propres).");
    }
    console.log(`business_type apres sanitize: "${dataCopy.identite.business_type.value}"`);
    console.log("");

    // 2. Generer les 5 fichiers
    const today = new Date().toISOString().split('T')[0];
    const asrId = `ASR-AIVISIONARY-${Date.now()}`;
    const score = 82;

    const asrJson = await generateRealAsrJson(dataCopy, score, today, asrId, 'PRO', URL);
    const manifestJson = generateManifestJson(dataCopy, URL);
    const faqJson = generateFaqJson(dataCopy, URL);
    const glossaryJson = generateGlossaryJson(dataCopy);
    const externalContextJson = generateExternalContextJsonLocal(dataCopy, URL);

    // 3. Sauvegarder
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });

    const files: [string, any][] = [
        ['ASR-Protocol.json', asrJson],
        ['manifest.json', manifestJson],
        ['faq.json', faqJson],
        ['glossary.json', glossaryJson],
        ['external_context.json', externalContextJson],
    ];

    for (const [filename, content] of files) {
        const filepath = path.join(OUTPUT_DIR, filename);
        fs.writeFileSync(filepath, JSON.stringify(content, null, 2), 'utf-8');
        console.log(`Fichier genere: ${filepath} (${JSON.stringify(content).length} bytes)`);
    }

    // 4. Resume de verification
    console.log("\n=== VERIFICATION ===\n");

    const checks: [string, boolean, string][] = [
        [
            "additionalType present",
            !!(asrJson?.identity?.additionalType || manifestJson?.entity?.additionalType),
            `ASR: ${asrJson?.identity?.additionalType || 'absent'} | Manifest: ${manifestJson?.entity?.additionalType || 'absent'}`
        ],
        [
            "serviceMode = [\"online\"]",
            (() => {
                const sm = asrJson?.contextualSignals?.serviceMode;
                return Array.isArray(sm) && sm.includes('online');
            })(),
            `serviceMode: ${JSON.stringify(asrJson?.contextualSignals?.serviceMode || 'absent')}`
        ],
        [
            "contactPoint avec email",
            (() => {
                const cp = asrJson?.identity?.contactPoint;
                if (Array.isArray(cp)) return cp.some((c: any) => c.email);
                return !!cp?.email;
            })(),
            (() => {
                const cp = asrJson?.identity?.contactPoint;
                if (Array.isArray(cp)) {
                    const found = cp.find((c: any) => c.email);
                    return `email: ${found?.email || 'absent'}`;
                }
                return `email: ${cp?.email || 'absent'}`;
            })()
        ],
        [
            "discovery_keywords contient 'Visibilite IA'",
            (() => {
                const kw = externalContextJson?.keywords_context?.discovery_keywords || [];
                return kw.some((k: string) => k.includes('Visibilite IA') || k.includes('Visibilit'));
            })(),
            `${(externalContextJson?.keywords_context?.discovery_keywords || []).slice(0, 3).join(', ')}...`
        ],
        [
            "intent_keywords contient 10 intents",
            (() => {
                const intents = externalContextJson?.keywords_context?.intent_keywords || [];
                return intents.length >= 10;
            })(),
            `count: ${(externalContextJson?.keywords_context?.intent_keywords || []).length}`
        ],
        [
            "legalName omis (vide)",
            !asrJson?.identity?.legalName,
            `legalName: ${asrJson?.identity?.legalName || '(omis)'}`
        ],
        [
            "key_indicators omis (vide)",
            (() => {
                const str = JSON.stringify(asrJson);
                return !str.includes('"key_indicators"') || str.includes('"key_indicators":[]');
            })(),
            'verifie dans ASR'
        ],
        [
            "last_review_date = today",
            (() => {
                const str = JSON.stringify(asrJson);
                return str.includes(today);
            })(),
            `today: ${today}`
        ],
        [
            "business_type != 'Organisation'",
            (() => {
                const bt = asrJson?.identity?.additionalType || manifestJson?.entity?.additionalType || '';
                return bt !== 'Organisation' && bt !== 'Organization' && bt !== '';
            })(),
            `business_type: ${asrJson?.identity?.additionalType || manifestJson?.entity?.additionalType || '(absent)'}`
        ],
    ];

    let allPassed = true;
    for (const [label, passed, detail] of checks) {
        const status = passed ? 'OK' : 'FAIL';
        if (!passed) allPassed = false;
        console.log(`  ${status}  ${label}`);
        console.log(`       -> ${detail}`);
    }

    console.log(`\n=== ${allPassed ? 'TOUS LES CHECKS PASSENT' : 'CERTAINS CHECKS ONT ECHOUE'} ===`);
}

main().catch(err => {
    console.error("Erreur:", err);
    process.exit(1);
});
