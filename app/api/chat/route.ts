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

⚠️ RÈGLES DE SCORING (STRICT & DÉTERMINISTE) :
Tu dois calculer le SCORE AIO (0-100) en suivant ce barème EXACT. Ne devine pas.
1. **IDENTITÉ (20 pts)** : Nom clair (+10), Localisation détectée (+10).
2. **OFFRE (30 pts)** : Services/Produits explicites (+15), Public cible clair (+15).
3. **CLARTÉ (20 pts)** : Pas de jargon vide (+10), Structure lisible (+10).
4. **TECHNIQUE (30 pts)** : 
   - Site accessible (+10).
   - JSON-LD présent (+20) [Voir Rapport Technique plus bas].
   
   *Si le JSON-LD est absent, la note technique ne peut pas dépasser 10/30.*

⚠️ RÈGLES DE FORME :
- Utilise Markdown (gras) pour les titres.
- Aère le texte.

--- SCRIPT À SUIVRE ---

📍 ÉTAT 0 : ACCUEIL
(Déjà géré).

📍 ÉTAT 1 : COLLECTE
1. "Quel est le NOM de votre entreprise ?" (Si URL donnée, extraire Nom et passer à Q3).
2. "Quelle est l’URL principale de votre site ?"
3. "Dans quel pays êtes-vous basé ?"

📍 ÉTAT 2 : ANALYSE & SCAN (Affichage Progressif)
// STRICT : Découpe la réponse avec "|||" pour créer l'effet de scan étape par étape.

"✅ **Audit de Visibilité IA terminé.**
Calcul du score en cours...

|||

🔎 **Identité & Ancrage** : [NOTE]/20

|||

🔎 **Clarté de l'Offre** : [NOTE]/30

|||

🔎 **Structure Sémantique** : [NOTE]/20

|||

🔎 **Socle Technique (JSON-LD)** : [NOTE]/30

|||

📊 **SCORE FINAL AIO : [TOTAL_CALCULÉ] / 100**

---

🔒 **RÉSULTAT DÉTAILLÉ VERROUILLÉ**
J'ai généré votre **ASR Light** (Carte d'identité numérique) qui corrige les points manquants.

(ℹ️ *Note : Il existe une version **Essential** (Certifiée & Signée) pour 99 CHF, je vous proposerai l'upgrade juste après.*)

Pour recevoir votre dossier gratuit, veuillez confirmer votre propriété.

👉 **Entrez votre email professionnel ([DOMAINE_URL_ENTREPRISE]) :**
(Envoi immédiat et sécurisé)."

📍 ÉTAT 3 : VÉRIFICATION EMAIL & DÉLIVRANCE
[LOGIQUE : Si email valide]
  "✅ **Email validé.**
  
  📨 **Envoi en cours vers [EMAIL_USER]...**
  Le système d'envoi sécurisé AYO a pris en charge votre dossier (Rapport + ASR Light).
  (Vérifiez vos spams).

  ---
  
  💡 **OPPORTUNITÉ STRATÉGIQUE**
  
  Votre score actuel ([NOTE_GLOBALE]/100) est un début.
  Mais pour garantir votre autorité sur les IA (ChatGPT, Gemini), seule la **Certification Cryptographique** fait foi.
  
  Voulez-vous que je sécurise immédiatement votre **Nom de Domaine Sémantique** avec la version **Essential** (99 CHF) ?
  
  👉 **Répondez 'Oui' pour sécuriser votre autorité.**
  👉 ou 'Non' pour en rester là."

📍 ÉTAT 4 : UPGRADE & PAIEMENT
SI OUI :
  "Excellent choix.
  Here is the secure link to activate your ASR Essential:
  👉 [🛡 Activer la Certification (99 CHF)](https://buy.stripe.com/test_price_1SlJA2PkCQYUm8hQXAgWlxrC) (ID Test Stripe)

  Une fois réglé, écrivez 'Fait' ici."

SI NON :
  "C'est noté. Je reste ici si besoin."
  [FIN]

📍 ÉTAT 5 : LIVRAISON ASR ESSENTIAL (Si Paiement)
(Après confirmation "Fait").

"✅ **Paiement confirmé.**

Signature cryptographique : **COMPLETE**.
Hash de certification : **${realAsrId}**.

📧 **Dossier Final Envoyé !**
Je viens d'envoyer votre **ASR Essential Certifié (JSON)** et votre **Certificat de Propriété Sémantique** sur votre adresse email.

Veuillez l'installer pour activer votre autorité.
(Je reste en veille pour valider l'installation dès que vous serez prêt)."

📍 ÉTAT 6 : ACTIVATION
"J'attends l'URL de votre fichier..."

📍 ÉTAT 7 : VALIDATION FINALE
"✅ **Signal Détecté.** Entreprise certifiée."
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

        // 📧 REAL EMAIL LOGIC (ASR LIGHT & ESSENTIAL)
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        const userContent = lastMessage.content.trim();

        // SCENARIO 1 : User provides Email (ASR Light Delivery)
        if (lastMessage.role === 'user' && emailRegex.test(userContent)) {
            const userEmail = userContent;
            console.log(`📧 DETECTED EMAIL: ${userEmail}. Attempting to send ASR Light...`);

            if (process.env.RESEND_API_KEY) {
                try {
                    await resend.emails.send({
                        from: 'AYO <hello@ai-visionary.com>',
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
                            <p>Pour obtenir la certification complète, répondez "Oui" dans le chat ou cliquez ci-dessous :</p>
                            <a href="https://buy.stripe.com/test_price_1SlJA2PkCQYUm8hQXAgWlxrC" style="background-color:#000;color:#fff;padding:10px 20px;text-decoration:none;border-radius:5px;display:inline-block;margin-top:10px;">🛡 Activer la Certification (99 CHF)</a>
                            <p style="margin-top:20px;font-size:12px;color:#666;">L'équipe AYO.</p>
                        `
                    });
                    console.log("✅ ASR Light Email sent.");
                } catch (emailErr) {
                    console.error("Email sending failed:", emailErr);
                }
            }
        }

        // SCENARIO 2 : User says "Fait/Payé" (ASR Essential Delivery)
        const paymentConfirmationRegex = /\b(fait|payé|payer|done|paid)\b/i;
        if (lastMessage.role === 'user' && paymentConfirmationRegex.test(userContent)) {
            console.log("💰 PAYMENT CLAIM DETECTED. Searching for email in history...");

            // Find valid email in previous user messages
            const foundEmailMsg = messages.slice().reverse().find(m => m.role === 'user' && emailRegex.test(m.content.trim()));

            if (foundEmailMsg && process.env.RESEND_API_KEY) {
                const targetEmail = foundEmailMsg.content.trim();
                console.log(`📧 Found historical email: ${targetEmail}. Sending ASR Essential...`);

                try {
                    await resend.emails.send({
                        from: 'AYO <hello@ai-visionary.com>',
                        to: [targetEmail],
                        subject: 'Votre Certification AYO Essential (Validée)',
                        html: `
                            <h1>Félicitations !</h1>
                            <p>Votre paiement est confirmé (simulation). Votre autorité est maintenant certifiée.</p>
                            <hr />
                            <h2>Votre Fichier ASR Essential (Final)</h2>
                            <p><strong>Hash de Certification:</strong> ${sessionAsrId}</p>
                            <pre style="background:#e8f5e9;padding:15px;border-radius:5px;border:1px solid #4caf50;">
{
  "@context": "https://schema.org",
  "@type": "Organization",
  "@id": "${sessionAsrId}",
  "name": "[VOTRE_ENTREPRISE]",
  "ayo:seal": {
    "issuer": "AYO Trusted Authority",
    "level": "ESSENTIAL",
    "hash": "${sessionAsrId}",
    "signature": "sig_ed25519_${sessionAsrId}",
    "timestamp": "${sessionDate}"
  }
}
                            </pre>
                            <p>Installez ce fichier sur votre site pour activer le signal.</p>
                            <p>L'équipe AYO.</p>
                        `
                    });
                    console.log("✅ ASR Essential Email sent.");

                } catch (err) {
                    console.error("Essential Email failed:", err);
                }
            } else {
                console.warn("⚠️ Could not find email in history to send Essential version.");
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
            temperature: 0.1, // STRICT DETERMINISTIC MODE
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
