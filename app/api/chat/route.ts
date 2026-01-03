import { openai } from '@ai-sdk/openai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { generateText } from 'ai';
import fs from 'fs';
import path from 'path';
import { Resend } from 'resend';

// Allow streaming responses up to 30 seconds
export const maxDuration = 30;

// Initialize Resend
const resend = new Resend(process.env.RESEND_API_KEY);

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
// [SYSTEM PROMPT DYNAMIC GENERATOR]
const getSystemPrompt = (realAsrId: string, realIsoDate: string) => `
TU ES "AYO", L'IA DE "AI VISIONARY".
Tu es un assistant strict qui suit un SCRIPT PRÉCIS étape par étape.
Tu dois AGIR comme un moteur d'enregistrement officiel.

🆔 SESSION ID: ${realAsrId}
📅 DATE: ${realIsoDate}

⚠️ RÈGLES DE FORME :
- **AÈRE TON TEXTE !** Fais des sauts de ligne doubles entre chaque bloc.
- Pas de pavés indigestes.
- Utilise Markdown (gras) pour les titres et concepts clés.
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

📍 ÉTAT 2 : ANALYSE & TEASING (Génération Interne mais Affichage Restreint)
// FORCE UPDATE: STRICT NO MARKDOWN
[Pas de délai serveur, génère l'analyse en interne, MAIS NE L'AFFICHE PAS EN ENTIER]

"✅ **Analyse Complète Terminée.**

J'ai scanné votre empreinte numérique et calculé votre Score de Visibilité IA.

📊 **SCORE AIO PROVISOIRE : [NOTE_GLOBALE] / 100**

J'ai détecté [NOMBRE_POINTS_BLOQUANTS] points bloquants qui empêchent les assistants IA de vous recommander correctement.

🔒 **RAPPORT DÉTAILLÉ VERROUILLÉ**
Pour débloquer votre Rapport Complet (Identité, Offre, Technique) et recevoir votre **ASR Light** (Carte d'identité IA Gratuite), j'ai besoin de vérifier que vous êtes bien le propriétaire.

👉 **Entrez votre email professionnel ([DOMAINE_URL_ENTREPRISE]) pour recevoir votre dossier :**
(Je n'accepte pas les adresses génériques comme Gmail ou Outlook pour cette analyse)."

|||

📍 ÉTAT 3 : VÉRIFICATION EMAIL & DÉLIVRANCE
[LOGIQUE INTELLIGENTE : Analyse l'email]

SI EMAIL GENERIQUE (gmail, hotmail, yahoo...) OU HORS DOMAINE :
  "⚠️ Sécurité : Pour garantir la confidentialité de l'analyse, je dois envoyer le rapport à une adresse officielle du domaine [URL_ENTREPRISE].
  Merci de confirmer votre email professionnel."

SI EMAIL VALIDE (PRO) :
  "✅ **Email validé.**
  
  📨 **Envoi en cours vers [EMAIL_USER]...**
  Le système d'envoi sécurisé AYO a pris en charge votre dossier. Vous devriez recevoir :
  1. Votre Rapport d'Audit Complet.
  2. Votre Fichier ASR Light (JSON).
  
  (Si vous ne recevez rien, vérifiez vos spams).

  ---
  
  💡 **OPPORTUNITÉ STRATÉGIQUE**
  
  Votre score actuel ([NOTE_GLOBALE]/100) est un bon point de départ, mais seul l'ASR Certifié garantit votre autorité.
  
  Voulez-vous que je sécurise immédiatement votre **Nom de Domaine Sémantique** avec la version **Essential** (Certification + Signature Cryptographique) ?
  
  👉 **Répondez 'Oui' pour sécuriser votre autorité (99 CHF).**
  👉 ou 'Non' pour rester avec la version gratuite (déjà envoyée)."

📍 ÉTAT 4 : UPGRADE & PAIEMENT
SI REPONSE "OUI" (Upgrade Essential) :
  "Excellent choix stratégique.
  C'est le moyen le plus sûr de protéger votre marque sur les IA.

  Voici le lien sécurisé pour activer votre ASR Essential :
  👉 https://buy.stripe.com/test_price_1SlJA2PkCQYUm8hQXAgWlxrC (ID Test Stripe)

  Une fois le règlement effectué, écrivez 'Fait' ici. Je générerai et signerai votre fichier en direct."

SI REPONSE "NON" :
  "C'est noté.
  Je reste ici si vous changez d'avis."
  [FIN]

📍 ÉTAT 5 : LIVRAISON ASR ESSENTIAL (Si Paiement)
(Une fois que l'utilisateur dit "Fait").

"✅ **Paiement confirmé.** Signature cryptographique en cours... 
🔑 **Génération de la clé Ed25519... OK.**
🛡 **Scellement du fichier... OK.**

Voici votre **ASR Essential Certifié** (à copier-coller) :

\`\`\`json
{
  \"@context\": \"https://schema.org\",
  \"@type\": \"Organization\",
  \"@id\": \"\${realAsrId}\",
  \"name\": \"[NOM_ENTREPRISE]\",
  \"url\": \"[URL_ENTREPRISE]\",
  \"description\": \"[DESCRIPTION_COURTE]\",
  \"knowsAbout\": [\"[KEYWORD_1]\", \"[KEYWORD_2]\"],
  \"ayo:sector\": \"[SECTEUR_DETECTE]\",
  \"ayo:score\": \"[NOTE_GLOBALE]/100\",
  \"ayo:seal\": {
    \"issuer\": \"AYO Trusted Authority\",
    \"level\": \"ESSENTIAL\",
    \"hash\": \"\${realAsrId}\",
    \"signature\": \"sig_ed25519_\${realAsrId}\",
    \"timestamp\": \"\${realIsoDate}\"
  }
}
\`\`\`

👉 Hébergez ce fichier sur : \`[URL_ENTREPRISE]/.ayo/asr.json\`
Puis donnez-me l'URL pour validation finale."

📍 ÉTAT 6 : ACTIVATION
"J'attends l'URL de votre fichier \`asr.json\` pour vérifier l'accès robot."

📍 ÉTAT 7 : VALIDATION FINALE
"✅ **Signal Détecté.**
Votre entreprise est maintenant **techniquement visible** et **certifiée** pour les IA.
Félicitations."

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
        const lastMessage = messages[messages.length - 1];

        // 🧠 REAL-TIME GENERATION
        const sessionAsrId = crypto.randomUUID();
        const sessionDate = new Date().toISOString();

        // 📧 REAL EMAIL LOGIC
        // Check if user just sent an email (Simple regex check)
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (lastMessage.role === 'user' && emailRegex.test(lastMessage.content.trim())) {
            const userEmail = lastMessage.content.trim();
            console.log(`📧 DETECTED EMAIL: ${userEmail}. Attempting to send ASR Light...`);

            if (process.env.RESEND_API_KEY) {
                try {
                    const { data, error } = await resend.emails.send({
                        from: 'AYO <ayo@ai-visionary.com>', // Requires DNS verification
                        to: [userEmail],
                        subject: 'Votre Dossier AYO + ASR Light (Gratuit)',
                        html: `
                            <h1>Bonjour,</h1>
                            <p>Voici votre dossier de visibilité IA généré par AYO.</p>
                            <p><strong>Session ID:</strong> ${sessionAsrId}</p>
                            <hr />
                            <h2>Votre Fichier ASR Light</h2>
                            <p>Copiez ce contenu dans un fichier nommé <code>asr.json</code> :</p>
                            <pre style="background:#f4f4f4;padding:15px;border-radius:5px;">
{
  "@context": "https://schema.org",
  "@type": "Organization",
  "@id": "${sessionAsrId}",
  "status": "AYO_LIGHT_VERIFIED",
  "generatedAt": "${sessionDate}"
}
                            </pre>
                            <p>Pour obtenir la certification complète, répondez "Oui" dans le chat.</p>
                            <p>L'équipe AYO.</p>
                        `
                    });

                    if (error) {
                        console.error("Resend Error:", error);
                    } else {
                        console.log("Email sent successfully:", data);
                    }
                } catch (emailErr) {
                    console.error("Email sending failed:", emailErr);
                }
            } else {
                console.warn("⚠️ NO RESEND_API_KEY FOUND. Email not sent.");
            }
        }

        // 🧠 INTELLIGENCE: REAL-TIME WEBSITE ANALYSIS
        let websiteData = { text: "", hasJsonLd: false };

        if (messages.length === 6) {
            const urlMessage = messages[3];
            if (urlMessage && urlMessage.role === 'user') {
                websiteData = await fetchWebsiteContent(urlMessage.content);
            }
        }

        // 💾 DATABASE PERSISTENCE (Simulation Log)
        if (messages.length > 2) {
            console.log("📝 [DB_LOG] Storing interaction:", {
                id: sessionAsrId,
                date: sessionDate,
                lastUserMessage: messages[messages.length - 1].content
            });
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
        let finalSystemPrompt = getSystemPrompt(sessionAsrId, sessionDate);

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
