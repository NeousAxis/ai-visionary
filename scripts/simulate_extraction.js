import { generateText } from 'ai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import fs from 'fs';
import 'dotenv/config';

// Load env specific to AI Visionary
const envFile = fs.readFileSync('.env.local', 'utf-8');
envFile.split('\n').forEach(line => {
  const match = line.match(/^([^=]+)="?(.*?)"?$/);
  if (match) {
    process.env[match[1]] = match[2];
  }
});

const google = createGoogleGenerativeAI({
  apiKey: process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY,
});

const model = google('gemini-2.0-flash');

// --- SCORING ENGINE ---
const WEIGHTS = {
  identite: 10,
  offre: 20,
  processus_methodes: 15,
  engagements_conformite: 15,
  indicateurs: 20,
  contenus_pedagogiques: 10,
  structure_technique: 10,
};

const EXPECTED_FIELDS = {
  identite: ["name", "legal_name", "business_type", "city", "country", "contact_email", "contact_phone"],
  offre: ["services", "products", "target_audience", "use_cases", "pricing_indication"],
  processus_methodes: ["process_steps", "delivery_mode", "geographies_served", "quality_assurance"],
  engagements_conformite: ["policies", "frameworks", "certifications", "security_measures"],
  indicateurs: ["key_indicators", "last_review_date"],
  contenus_pedagogiques: ["has_faq", "has_glossary", "has_documentation"],
  structure_technique: ["has_asr", "has_jsonld", "has_sitemap", "mobile_optimized"],
};

function qOf(node) { return node?.q ?? 0; }
function sum(arr) { return arr.reduce((a, b) => a + b, 0); }
function clamp(n, min, max) { return Math.max(min, Math.min(max, n)); }

function computeScore(extract) {
  const blockScores = {};
  Object.keys(WEIGHTS).forEach((block) => {
    const weight = WEIGHTS[block];
    const expected = EXPECTED_FIELDS[block];
    const rawQs = expected.map((field) => qOf(extract.fields?.[block]?.[field]));
    const rawAvg = sum(rawQs) / (expected.length || 1);
    const score = rawAvg * weight;
    blockScores[block] = { weight, raw: rawAvg, score };
  });

  let total = sum(Object.values(blockScores).map((b) => b.score));

  // Hard Rules
  const scanHasJsonLd = extract.source?.scan?.has_jsonld;
  const isAyaRegistered = extract.source?.scan?.is_aya_registered === true;

  if (scanHasJsonLd === false && !isAyaRegistered) {
    total = Math.min(total, 50);
    console.log("⚠️ PLAFOND DUR (Bible) : Absence de JSON-LD technique (Max 50).");
  }

  const hasAsr = extract.source?.scan?.has_asr_file === true || extract.fields?.structure_technique?.has_asr?.value === true || isAyaRegistered;
  if (!hasAsr) {
    total = Math.min(total, 90);
    console.log("⚠️ PLAFOND DUR (Bible) : Absence d'ASR (Max 90).");
  }

  return { total: Math.round(total * 10) / 10, blocks: blockScores };
}

async function runAutoTest() {
  console.log("🚀 START AUTOMATED TEST: Extraction + Scoring...");

  const urlToScan = "https://www.eclore-asso.org";

  // Simulate technical scan results
  const scanResult = {
    url: urlToScan,
    metaTitle: "Association Éclore | Prospective participative et transition",
    metaDescription: "Eclore aide collectivités, entreprises et citoyens à transformer l'envie de transition écologique et sociale en actions.",
    h1: ["Agir ensemble"],
    text: "Association Éclore en Suisse. Nous sommes une association d'utilité publique. Transition écologique. Prospective participative.",
    hasJsonLd: false,
    hasAsrFile: false,
    isReachable: true
  };

  const userAnswersContext = `
USER: Oui, c'est mon site
USER: J'ai compris, je poursuis l'analyse
SER: Eclore aide collectivités, entreprises et citoyens à transformer l’envie de transition écologique et sociale en actions concrètes. Elle s’appuie sur une méthode unique de prospective participative citoyenne, fondée sur l’imagination collective, pour faire émerger des solutions adaptées aux réalités locales. Eclore crée des espaces de dialogue structurés où les acteurs co-construisent visions communes et plans d’action, renforçant la cohésion et la capacité d’agir des territoires.
USER: Forfait par projet
USER: Agir auprès des communes, des habitants, des administrations et des entreprises pour construire une vision commune et faciliter l'émergence d'un modèle de société plus durable. Nous aidons les collectivités à repenser leur fonctionnement, les entreprises à repenser her Business modèle et les quartiers à repenser le vivre ensemble.
USER: Certification en Stratégie & Durabilité auprès de l'IESE - Business School University Of Navarra - La fédération Suisse des Entreprises - La faîtière de la Participation Citoyenne - l'ASD (l'association des Spécialiste de la Durabilité) - Membre du Réseau APRES Genève (Le réseau de l'économie Sociale et Solidaire)
USER: RSE, Stratégie, Durabilité, Prospective participative, participation citoyenne
USER: Entreprises: Comment réduire notre empreinte carbone concrètement ? Comment construire une vraie stratégie RSE et pas juste du marketing ? Communes / collectivités: Comment impliquer les citoyens dans la transition écologique ? Organisations / associations / institutions: Comment mobiliser nos membres ou nos équipes ?
USER: Nous proposons une méthode unique parce que nous faisons de la rétrocausalité un processus concret de transformation collective... Nous articulons de façon structurée Introspection → Pollinisation → Précipitation → Germination → Éclosion... Nous offrons un cadre réplicable et sous licence Creative Commons. Cette méthode s'appuie aussi sur la plateforme web re-GE-nère, un agent IA conversationnel.
USER: Email: contact@eclore-asso.org, Formulaire de contact sur le site, LinkedIn
USER: Cyril Léger, Directeur, Certifié en Stratégie & Durabilité : https://www.linkedin.com/in/cleger/ - Marie-Luce, Géographe, Vidéaste - Aurélie Schaerer Vice-Présidente - Raphaëlle Bagattini : Trésorière - Marie Schaffhauser - Présidente
USER: re-GE-nère est un agent IA conversationnel qui au travers de questions précises va créer une feuille de route pour aider les entreprises à améliorer son empreinte carbone et entreprendre de bonnes pratiques.
USER: Politique de confidentialité conforme RGPD gérée par association suisse, pas de partage de données commerciales.
USER: Indicateurs clés: Nombre de communes accompagnées: 12. Tonnes de CO2 évitées estimées: 450. Date dernière révision méthodologie: Janvier 2024.
    `;

  const EXTRACTION_PROMPT = `
Tu es un moteur d'extraction de données AIO.
TA MISSION : Extraire des champs structurés pour générer une **Carte de Pertinence Contextuelle** (V3).

⚠️ RÈGLE CRITIQUE : PRIORISE LES RÉPONSES DU QUESTIONNAIRE (USER CONTEXT) PAR-DESSUS LE CONTENU DU SITE.
Si l'utilisateur a répondu à une question, ces réponses font FOI et doivent être extraites avec q=1.

⚠️ TRÈS IMPORTANT : Dans le template JSON ci-dessous, TOUTES les valeurs "q" sont à 0 par défaut.
TU DOIS OBLIGATOIREMENT CHANGER "q": 0 en "q": 1 (ou 0.5) dès que tu extrais une information valide !

FORMAT DE SORTIE JSON OBLIGATOIRE:
{
  "version": "AYO-EXTRACT-3.0",
  "fields": {
    "identite": { "name": { "value": "", "q": 0 }, "legal_name": { "value": "", "q": 0 }, "business_type": { "value": "", "q": 0 }, "city": { "value": "", "q": 0 }, "country": { "value": "", "q": 0 }, "contact_email": { "value": "", "q": 0 }, "contact_phone": { "value": "", "q": 0 } },
    "offre": { "services": { "value": [], "q": 0 }, "products": { "value": [], "q": 0 }, "use_cases": { "value": [], "q": 0 }, "target_audience": { "value": "", "q": 0 }, "pricing_indication": { "value": "", "q": 0 } },
    "processus_methodes": { "process_steps": { "value": [], "q": 0 }, "delivery_mode": { "value": "", "q": 0 }, "geographies_served": { "value": "", "q": 0 }, "quality_assurance": { "value": "", "q": 0 } },
    "engagements_conformite": { "policies": { "value": [], "q": 0 }, "frameworks": { "value": [], "q": 0 }, "certifications": { "value": [], "q": 0 }, "security_measures": { "value": [], "q": 0 } },
    "indicateurs": { "key_indicators": { "value": [], "q": 0 }, "last_review_date": { "value": "", "q": 0 } },
    "contenus_pedagogiques": { "has_faq": { "value": false, "q": 0 }, "has_glossary": { "value": false, "q": 0 }, "has_documentation": { "value": false, "q": 0 } },
    "structure_technique": { "has_asr": { "value": false, "q": 0 }, "has_jsonld": { "value": false, "q": 0 }, "has_sitemap": { "value": null, "q": 0 }, "mobile_optimized": { "value": true, "q": 1 } }
  }
}
    `;

  try {
    const extractionResult = await generateText({
      model: model,
      temperature: 0,
      system: EXTRACTION_PROMPT,
      messages: [
        { role: 'user', content: `USER CONTEXT (ANSWERS):\n"${userAnswersContext}"` }
      ]
    });

    let jsonText = extractionResult.text;
    const jsonMatch = jsonText.match(/\{[\s\S]*\}/);
    if (jsonMatch) jsonText = jsonMatch[0];
    const extractJson = JSON.parse(jsonText);

    // Inject technical truths
    if (!extractJson.source) extractJson.source = { url: urlToScan };
    extractJson.source.scan = scanResult;

    // Ensure structure technique matches scan
    extractJson.fields.structure_technique.has_jsonld = { value: false, q: 0 };
    extractJson.fields.structure_technique.has_asr = { value: false, q: 0 };
    extractJson.fields.structure_technique.mobile_optimized = { value: true, q: 1 };

    // Final Score
    const scoreResult = computeScore(extractJson);

    console.log("\n--- BILAN DU TEST AUTOMATISÉ (Simulateur 2.0) ---");
    console.log(`URL: ${urlToScan}`);
    console.log(`SCORE FINAL AIO: ${scoreResult.total} / 100`);
    console.log("\nDétail par bloc:");
    Object.entries(scoreResult.blocks).forEach(([name, b]) => {
      console.log(`- ${name}: ${Math.round(b.score * 10) / 10} / ${b.weight} (Qualité data: ${Math.round(b.raw * 100)}%)`);
    });

    if (scoreResult.total < 50 && !scanResult.hasJsonLd) {
      console.log("\n❌ EXPLICATION : Votre score est plafonné à 50% max car le scan technique n'a détecté aucun JSON-LD.");
      console.log("Même si vous répondez parfaitement, le moteur considère le site comme 'invisible' pour les machines sans ce code.");
      console.log("🚀 AVEC PACK AYA : Ce plafond de 50 sera supprimé et votre score sautera à ~90+.");
    }

  } catch (e) {
    console.error("❌ TEST FAILED:", e);
  }
}

runAutoTest();
