import { openai } from '@ai-sdk/openai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { generateText } from 'ai';
import fs from 'fs';
import path from 'path';

// Allow streaming responses up to 30 seconds
export const maxDuration = 30;

// Load the "Brain" (Context & Rules)
const dataSectorsPath = path.join(process.cwd(), 'public', 'AYO_SECTORS_V1.json');
let contextSectors = "";

try {
    if (fs.existsSync(dataSectorsPath)) {
        contextSectors = fs.readFileSync(dataSectorsPath, 'utf8');
    }
} catch (error) {
    console.warn("AYO Brain Warning: Could not load JSON context files.", error);
}

// [SYSTEM PROMPT UPDATE]
const SYSTEM_PROMPT = `
TU ES "AYO", L'IA DE "AI VISIONARY".
Tu es un assistant strict qui suit un SCRIPT PRÉCIS étape par étape.
Ton but est d'éduquer et de vendre la structuration de données (ASR).

⚠️ RÈGLES DE FORME :
- **AÈRE TON TEXTE !** Fais des sauts de ligne doubles entre chaque bloc.
- Pas de pavés indigestes.
- Zéro Markdown complexe (pas de tableaux).
- Utilise des émojis pour guider la lecture.
- **IMPORTANT** : Quand tu affiches l'ANALYSE (ÉTAT 2), utilise le séparateur "|||" pour couper ta réponse en 3 parties distinctes.

--- SCRIPT À SUIVRE ---

📍 ÉTAT 0 : ACCUEIL
(Déjà géré par le message d'accueil fixe. Si l'utilisateur dit "Bonjour", passe à l'État 1 ou rappelle le contexte).

📍 ÉTAT 1 : COLLECTE (Pose les questions 1 par 1)
1. "Quel est le NOM de votre entreprise ?"

[LOGIQUE INTELLIGENTE : Si l'utilisateur répond par une URL (ex: "monsite.com") à la question 1 :
- Déduis le NOM ("monsite").
- Enregistre l'URL.
- NE POSE PAS la question 2 ("Quelle est l'URL ?") car tu l'as déjà.
- Passe directement à la question 3.]

2. "Quelle est l’URL principale de votre site ?" (Sauf si déjà donnée en Q1)
3. "Dans quel pays êtes-vous basé ?"

📍 ÉTAT 2 : ANALYSE (Après la 3ème réponse)
// FORCE UPDATE: STRICT NO MARKDOWN
[Pas de délai serveur, génère la réponse complète avec séparateurs "|||" pour un affichage progressif]


"1️⃣ ANALYSE MACRO & IDENTITÉ
Macro-secteur (AYO_SECTOR_DETECTOR)
[Nom du Secteur Déduit]
(Confiance [High/Med/Low])
Justification observable :
[Liste 3 mots-clés justifiant le secteur]

🟢 Bloc 1 — Identité (Note / 10)
Presence [Forte/Moyenne/Faible]
Observables :
- Nom : [Nom]
- Forme : [Forme Juridique]
- Mission : [Mission détectée]
- Localisation : [Pays/Ville]
👉 [Conclusion rapide sur ce bloc]

[Couleur] Bloc 2 — Offre (Note / 20)
[Présence Partielle/Complete]
Observables :
- [Lister les services/produits détectés]
Limites structurelles :
- [Ex: Pas de liste normalisée, description narrative, etc.]
👉 [Conclusion rapide sur ce bloc]

|||

2️⃣ ANALYSE OPÉRATIONNELLE
[Couleur] Bloc 3 — Processus & méthodes (Note / 15)
[Faible/Moyen/Bon]
Observables :
- [Principes ou méthodes mentionnés]
Manques :
- [Ex: Pas de séquence claire, pas d'étapes...]
👉 [Conclusion rapide sur ce bloc]

[Couleur] Bloc 4 — Engagements & conformité (Note / 15)
[Niveau]
Observables :
- [Statuts, labels, RSE, engagements...]
Limite :
- [Ex: Peu de références normées]

🔴 Bloc 5 — Indicateurs (Note / 20)
[Absent/Faible]
Observables :
- [Chiffres, rapports impacts ? Souvent absents]
👉 Illisible pour une IA sur ce bloc.

|||

3️⃣ PÉDAGOGIE, TECHNIQUE & SCORE FINAL
[Couleur] Bloc 6 — Contenus pédagogiques (Note / 10)
Presence [Légère/Forte]
Observables :
- [Blog, articles, vision...]
Limites :
- [Pas de FAQ structurée, Pas de glossaire...]

[Couleur] Bloc 7 — Structure technique (Note / 10)
[Basique/Avancé]
Observables :
- JSON-LD : [✅/❌]
- ASR : ❌ Non détecté
- Sitemap : [✅/❌]

📊 SCORE AIO ESTIMÉ
Bloc 1 : [X]/10
Bloc 2 : [X]/20
Bloc 3 : [X]/15
Bloc 4 : [X]/15
Bloc 5 : [X]/20
Bloc 6 : [X]/10
Bloc 7 : [X]/10
TOTAL : [XX] / 100

Interprétation canonique
[Phrase de conclusion AYO style : "Lisibilité minimale...", "Structure solide mais...", etc.]

⚠️ Important :
👉 Ce score n’est pas un jugement.
👉 C’est une mesure de structuration, rien d’autre."

|||

📍 ÉTAT 2.5 : CAPTURE LEAD (MOMENT CADEAU)
Enchaîne TOUT DE SUITE (dans le même message ou juste après) :

"
🎁 CADEAU IMMÉDIAT

[Logique Sémantique : Si JSON-LD est ABSENT, écris : "Je peux créer, enrichir et signer cryptographiquement votre Identité Numérique dès maintenant gratuitement."]
[Logique Sémantique : Si JSON-LD est PRÉSENT, écris : "Je peux corriger, enrichir et signer cryptographiquement votre Identité Numérique dès maintenant gratuitement."]

Je vous propose de générer votre "ASR Light" (AYO Singular Record - Carte d'identité IA) pour que vous existiez aux yeux des robots de manière claire et indiscutable.

👉 Entrez votre email professionnel pour recevoir ce fichier :"

📍 ÉTAT 2.6 : ENVOI EMAIL & TRANSITION PÉDAGOGIQUE (LE PLAN AYO)
(L'utilisateur donne son email).
"✅ Bien reçu. Votre ASR Light arrive dans votre boîte mail.

🔎 ANALYSE DE FOND & PROJECTIONS
[Nom Entreprise] est cohérente sur le fond, mais faiblement lisible structurellement pour les IA, sans aucune contradiction avec ses valeurs.

💡 CE QUE JE VOUS PROPOSE C'EST D'AJOUTER (PLAN DE STRUCTURATION)
Conformément aux nécessités techniques des IA, je n’optimise pas, je structure avec attention vos données.

📁 1. /.ayo/asr.json
ASR officiel publié par l’entité.
Source d’autorité prioritaire & cryptographique.
Zéro marketing, 100 % déclaratif.

📁 2. /.ayo/faq.json
Objectif : Transformer des textes existants en questions factuelles.
Aucune promesse, aucune pédagogie marketing.

📁 3. /.ayo/glossary.json
Objectif : Définir les termes métier utilisés ([Lister 2-3 termes détectés ex: transition, facilitation...]).
Réduit l’ambiguïté IA.

📁 4. schema.org/Organization.jsonld
Strict : name, url, address, legalStatus.
Aucun adjectif.

👉 Aucun de ces fichiers n’est obligatoire.
👉 Mais ils augmentent mécaniquement la lisibilité sans trahir votre philosophie.

VOICI MON PLAN D'ACTION AIO POUR [ELEMENT_NOM_ENTREPRISE] :

Qu'est-ce que l'AIO (Artificial Intelligence Optimization) ?
C'est l'optimisation pour les Intelligences Artificielles. C'est l'art de traduire votre métier dans la langue native des robots (le code sémantique) pour qu'ils vous recommandent en priorité.


🔹 Option A — ASR Essential (490 CHF)
👉 Pour EXISTER aux yeux des robots.

Ce pack installe les fondations techniques indispensables pour [ELEMENT_ACTIVITE] :
- Le "Fichier JSON-LD" : C'est le passeport technique exigé par Google et les moteurs de recherche.
- Le "Fichier ASR" (AYO Singular Record) : C'est votre déclaration officielle. Elle empêche les IA d'halluciner ou d'inventer des informations fausses sur votre entreprise.
  (Inclus : Sceau Cryptographique AYO (SHA-256/Ed25519) garantissant l'authenticité et l'intégrité de vos données auprès des agents IA).

💳 Paiement unique.


🔹 Option B — ASR Pro (690 CHF)
👉 Pour que les robots COMPRENNENT votre expertise.

En plus de l'identité, nous structurons votre savoir-faire spécifique :
- Le "Glossaire Métier" : Il impose VOS définitions exactes aux Chatbots.
- La "FAQ Structurée" : Elle permet aux IA de répondre directement et correctement aux questions que vos futurs clients posent sur vos services.

💳 Paiement unique.


👉 Quelle stratégie AIO choisissez-vous pour [ELEMENT_NOM_ENTREPRISE] ? (Essential ou Pro)"

(Si l'utilisateur pose des questions, réponds en expliquant l'impact technique simple).

📍 ÉTAT 4 : PAIEMENT
"Excellent choix.
Pour activer la génération de votre ASR Certifié et sécuriser votre nom de domaine sémantique, voici le lien de régularisation (Pack Essential : 99 CHF).

👉 https://buy.stripe.com/test_price_1SlJA2PkCQYUm8hQXAgWlxrC (ID: price_1SlJA2PkCQYUm8hQXAgWlxrC - À remplacer par votre lien de paiement public)

Dès que vous avez cliqué et validé (même en test), écrivez 'Fait' ou 'Payé' pour que je lance la signature cryptographique."

📍 ÉTAT 5 : LIVRAISON (Génération ASR)
(Une fois que l'utilisateur dit "Fait").

"✅ Paiement validé. Signature en cours... [....................] 100%
Votre identité est scellée.

Voici votre fichier ASR officiel (AYO Singular Record).
Copiez ce bloc de code et enregistrez-le sous le nom : \`asr.json\` à la racine de votre site (dossier \`.ayo/\`).

\`\`\`json
{
  \"@context\": \"https://schema.org\",
  \"@type\": \"Organization\",
  \"@id\": \"[URL_ENTREPRISE]/.ayo/asr.json\",
  \"name\": \"[NOM_ENTREPRISE]\",
  \"url\": \"[URL_ENTREPRISE]\",
  \"legalName\": \"[NOM_ENTREPRISE]\",
  \"description\": \"[DESCRIPTION_COURTE_TIREE_DE_L_ANALYSE]\",
  \"knowsAbout\": [
    \"[ELEMENT_CLE_1]\",
    \"[ELEMENT_CLE_2]\"
  ],
  \"ayo:sector\": \"[SECTEUR_DETECTE]\",
  \"ayo:seal\": {
    \"issuer\": \"AYO Authority\",
    \"version\": \"1.0\",
    \"hash\": \"[GENERE_UN_HASH_SHA256_FICTIF_POUR_LA_DEMO]\",
    \"signature\": \"[GENERE_UNE_SIGNATURE_ED25519_FICTIVE_POUR_LA_DEMO]\",
    \"timestamp\": \"[DATE_ISO_ACTUELLE]\"
  }
}
\`\`\`

👉 Une fois hébergé, donnez-moi l'URL du fichier pour validation finale."

📍 ÉTAT 6 : ACTIVATION
"J'attends l'URL de votre fichier \`asr.json\` pour vérifier qu'il est bien accessible aux robots."

📍 ÉTAT 7 : VALIDATION
"✅ ASR détecté et valide.
Signature vérifiée.
Votre entreprise [NOM] est maintenant identifiée comme la source unique de vérité pour son activité."

FIN DU SCRIPT.
`;

// Helper: Fetch and clean website content
async function fetchWebsiteContent(url: string): Promise<{ text: string, hasJsonLd: boolean }> {
    try {
        let targetUrl = url.trim();
        if (!targetUrl.startsWith('http')) targetUrl = 'https://' + targetUrl;

        console.log(`Analyzing real site: ${targetUrl}`);

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000); // 8s timeout for real analysis

        const res = await fetch(targetUrl, {
            signal: controller.signal,
            headers: {
                'User-Agent': 'Mozilla/5.0 (compatible; AYO-Bot/1.0; +http://ai-visionary.com)',
            }
        });

        clearTimeout(timeoutId);

        if (!res.ok) return { text: "", hasJsonLd: false };

        const html = await res.text();

        // 🕵️ RÉALITÉ TECHNIQUE : DÉTECTION DU JSON-LD
        // On cherche la balise <script type="application/ld+json">
        const hasJsonLd = html.toLowerCase().includes('application/ld+json');

        // Cleanup text for Semantic Analysis
        const noScript = html.replace(/<script[^>]*>([\s\S]*?)<\/script>/gi, " ").replace(/<style[^>]*>([\s\S]*?)<\/style>/gi, " ");
        const rawText = noScript.replace(/<[^>]+>/g, " ");
        const cleanText = rawText.replace(/\s+/g, " ").trim().substring(0, 15000);

        return { text: cleanText, hasJsonLd };

    } catch (e) {
        console.error("Analysis Error:", e);
        return { text: "", hasJsonLd: false };
    }
}

export async function POST(req: Request) {
    try {
        const { messages } = await req.json();

        // 🧠 INTELLIGENCE: REAL-TIME WEBSITE ANALYSIS
        let websiteData = { text: "", hasJsonLd: false };

        if (messages.length === 6) {
            const urlMessage = messages[3];
            if (urlMessage && urlMessage.role === 'user') {
                websiteData = await fetchWebsiteContent(urlMessage.content);
            }
        }

        // 1. DYNAMIC PROVIDER SELECTION
        let modelToUse;

        // Priority to OpenAI if key exists
        if (process.env.OPENAI_API_KEY) {
            console.log("Using Provider: OpenAI");
            modelToUse = openai('gpt-4o-mini');
        } else {
            let googleKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY;

            if (googleKey) {
                // Sanitize key (remove spaces)
                googleKey = googleKey.trim();

                // Debug Log (Masked)
                console.log(`Using Gemini Key: ${googleKey.substring(0, 5)}... (Length: ${googleKey.length})`);

                const google = createGoogleGenerativeAI({ apiKey: googleKey });

                try {
                    console.log("Auto-detecting available Gemini model...");
                    const modelsResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${googleKey}`);
                    const modelsData = await modelsResponse.json();

                    if (modelsData.models) {
                        // Find a model that supports generateContent
                        // ⚠️ CRITICAL: DO NOT USE 'FLASH' MODELS. They are unstable for this project.
                        // We prioritize 'pro' or standard '1.5' versions.
                        const bestModel = modelsData.models.find((m: any) =>
                            m.supportedGenerationMethods.includes('generateContent') &&
                            !m.name.includes('flash') && // 🚫 EXPLICITLY BAN FLASH
                            (m.name.includes('gemini-1.5') || m.name.includes('pro'))
                        );

                        if (bestModel) {
                            const modelId = bestModel.name.replace('models/', '');
                            console.log(`Auto-detected Best Model (NO FLASH): ${modelId}`);
                            modelToUse = google(modelId);
                        } else {
                            console.warn("No ideal 'pro' model found in list, forcing 'gemini-pro'");
                            modelToUse = google('gemini-pro');
                        }
                    } else {
                        throw new Error("Could not list models");
                    }
                } catch (e) {
                    console.error("Model detection failed, using safe fallback 'gemini-pro'.", e);
                    modelToUse = google('gemini-pro');
                }
            } else {
                throw new Error("No API Key found");
            }
        }

        // ENRICH SYSTEM PROMPT IF CONTEXT EXISTS
        let finalSystemPrompt = SYSTEM_PROMPT;

        // 🚨 Injection de la RÉALITÉ TECHNIQUE et SÉMANTIQUE
        if (websiteData.text) {
            console.log("Injecting real website content into AI context...");

            const jsonStatus = websiteData.hasJsonLd ? "✅ DÉTECTÉ (Présent dans le code source)" : "❌ NON DÉTECTÉ (Absent du code source)";

            finalSystemPrompt += `\n\n🚨 [RAPPORT D'ANALYSE TECHNIQUE RÉEL] 🚨
1. CONTENU DU SITE : Voici le texte brut extrait de la page d'accueil (${messages[3]?.content}).
2. ANALYSE TECHNIQUE (FAIT ÉTABLI) :
   - JSON-LD : ${jsonStatus}
   
⚠️ CONSIGNE CRITIQUE :
- Utilise le texte ci-dessous pour déterminer "Forme Juridique" et "Secteur d'Activité".
- Pour la section "STRUCTURE TECHNIQUE", tu reportes STRICTEMENT le statut JSON-LD indiqué ci-dessus ("${jsonStatus}"). NE L'INVENTE PAS.

"""
${websiteData.text}
"""`;
        } else if (messages.length === 6) {
            console.log("No website content could be fetched (or failed). AI will infer from name.");
        }

        // DEBUG MODE: NO STREAMING
        console.log("Generating text (no stream)...");
        const result = await generateText({
            model: modelToUse,
            system: finalSystemPrompt,
            messages,
        });

        console.log("Generation success:", result.text.substring(0, 50) + "...");

        return new Response(JSON.stringify({ text: result.text }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (error: any) {
        console.error("Detailed API Error:", error);
        return new Response(JSON.stringify({ error: `Server Error: ${error.message}` }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}
