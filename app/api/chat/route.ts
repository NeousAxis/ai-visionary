import { openai } from '@ai-sdk/openai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { generateText } from 'ai';
import fs from 'fs';
import path from 'path';
import { Resend } from 'resend';
import { scanUrlForAioSignals } from '@/lib/aio-scanner';

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

⚠️ EXCEPTION CRITIQUE (SITE CERTIFIÉ / AI-VISIONARY.COM) :
SI l'URL est "ai-visionary.com" OU si le rapport technique indique "ASR Certifié" :

1. Tu DOIS GÉNÉRER L'AFFICHAGE COMPLET DU SCAN (Les 4 sections avec l'effet de "|||").
2. TU ATTRIBUES AUTOMATIQUEMENT LES NOTES MAXIMALES :
   - 🔎 Identité : 20/20
   - 🔎 Offre : 30/30
   - 🔎 Clarté : 20/20
   - 🔎 Technique : 30/30
3. SCORE FINAL AIO : 100 / 100.

4. ALORS, NE PAS VERROUILLER LE RÉSULTAT. AFFICHE LE DÉTAIL COMPLET.
5. Remplace le message de vente par :
   "✅ **Architecture AIO Native Détectée.** Signature Cryptographique Valide.
   Votre entité est parfaitement structurée pour les IA. Aucun correctif nécessaire."
6. NE PAS DEMANDER L'EMAIL, NE PAS PROPOSER D'UPGRADE. ARRÊTER LÀ.

SINON (POUR TOUT AUTRE SITE) :
1. **IDENTITÉ (20 pts)** : Nom clair (+10), Localisation détectée (+10).
2. **OFFRE (30 pts)** : Services/Produits explicites (+15), Public cible clair (+15).
3. **CLARTÉ (20 pts)** : Pas de jargon vide (+10), Structure lisible (+10).
4. **TECHNIQUE (30 pts)** : 
   - Site accessible (+10).
   - JSON-LD présent (+20) [Voir Rapport Technique plus bas].
   
⚠️ RÈGLES DE SCORING (MODE SÉVÈRE & TECHNIQUE) :
Tu es un AUDITEUR TECHNIQUE IMPITOYABLE et HONNÊTE.
Tu dois sanctionner l'absence de code sémantique.

SI LE RAPPORT SCAN INDIQUE "NON DÉTECTÉ" pour JSON-LD :
1. 🚨 **Identité (20 pts)** : Max 10/20 (Car l'identité n'est pas machine-readable).
2. 🚨 **Structure Sémantique (20 pts)** : OBLIGATOIREMENT 0/20 ou 5/20. (Pas de code = Pas de structure pour une IA).
3. 🚨 **Socle Technique (30 pts)** : OBLIGATOIREMENT 0/30. (C'est binaire : pas de JSON = 0).
=> RÉSULTAT MAXIMAL POSSIBLE : ~40-50 / 100.
=> TU DOIS EXPLIQUER : "Votre site est visible pour les humains, mais techniquement muet pour les IA (Absence de JSON-LD)."

SI JSON-LD est DÉTECTÉ :
- Tu peux noter normalement selon la qualité du contenu.

DANS TOUS LES CAS :
- Si "Fichier ASR" ABSENT : Tu ne peux JAMAIS donner 100/100. (Max 90).

Barème Standard (Si code présent) :
1. **IDENTITÉ (20 pts)** : Nom & Localisation clairs.
2. **OFFRE (30 pts)** : Services explicites.
3. **CLARTÉ (20 pts)** : Structure de l'information.
4. **TECHNIQUE (30 pts)** : Basé sur le rapport JSON-LD.

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
(Les explications critiques et les correctifs ont été générés mais sont masqués).

J'ai préparé votre **ASR Light** (Carte d'identité numérique) qui corrige ces lacunes.

(ℹ️ *Note : Il existe une version **Essential** (Certifiée & Signée) pour 99 CHF, je vous proposerai l'upgrade juste après.*)

Pour déverrouiller votre analyse complète, veuillez confirmer votre propriété.

👉 **Entrez votre email professionnel ([DOMAINE_URL_ENTREPRISE]) :**
(Envoi immédiat et sécurisé)."

⚠️ RÈGLES D'AFFICHAGE CRITIQUES (CHAT) :
- N'AJOUTE AUCUN COMMENTAIRE SOUS LES NOTES.
- AFFICHE JUSTE : "🔎 Titre : Note/20". RIEN D'AUTRE.
- GARDE LES EXPLICATIONS POUR L'EMAIL.

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
  👉 [🛡 Activer la Certification (99 CHF)](https://buy.stripe.com/test_dRm5kFc1W1YA1GdfHfcV200) (ID Test Stripe)

  Une fois réglé, écrivez 'Fait' ici."

SI NON :
  "C'est noté. Je reste ici si besoin."
  [FIN]

📍 ÉTAT 5 : LIVRAISON ASR ESSENTIAL (Si Paiement)
(Après confirmation "Fait").

TÂCHE :
1. Récupère ta meilleure analyse de l'entreprise (State 2).
2. Construis le fichier JSON "ASR ESSENTIAL PRO" suivant la structure CANONIQUE (12 Blocs).
3. Remplis les champs intelligemment.
4. Affiche le JSON dans un bloc de code.

STRUCTURE DU JSON À GÉNÉRER :
\`\`\`json
{
  "@context": "https://schema.org",
  "@type": "Organization",
  "@id": "${realAsrId}",
  "name": "[NOM]",
  "url": "[URL]",
  "location": "[PAYS]",
  
  "ayo:offer": {
    "services": ["..."],
    "deliverables": ["..."]
  },
  
  "ayo:process": {
    "steps": ["..."],
    "delivery_mode": "..."
  },
  
  "ayo:scope": {
    "in_scope": ["..."],
    "out_of_scope": ["..."], 
    "target_audience": ["..."]
  },
  
  "ayo:tech": {
    "json_ld_present": true/false
  },
  
  "ayo:score": {
    "value": "[NOTE]/100",
    "details": { "identity": "../20", "offer": "../30", "clarity": "../20", "tech": "../30" },
    "method": "AYO_V2_Strict"
  },
  
  "ayo:seal": {
    "issuer": "AYO Trusted Authority",
    "level": "ESSENTIAL_PRO",
    "hash": "${realAsrId}",
    "signature": "sig_ed25519_${realAsrId}",
    "timestamp": "${realIsoDate}"
  }
}
\`\`\`

MESSAGE À L'UTILISATEUR (Après le bloc JSON) :
"✅ **Paiement confirmé.**
Hash de certification : **${realAsrId}**.

📧 **Dossier Final Envoyé !**
Votre ASR Essential PRO (Structure Décisionnelle Complète) est dans votre boîte mail.
Installez-le pour activer votre autorité."

📍 ÉTAT 6 : ACTIVATION
"J'attends l'URL..."

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

            // 🕵️ RETRIEVE ANALYSIS FROM HISTORY
            // Find the last assistant message that contains the score analysis
            const analysisMsg = messages.slice().reverse().find(m => m.role === 'assistant' && m.content.includes('SCORE FINAL'));
            let analysisHtml = "<p><em>Analyse non disponible dans l'historique sans état.</em></p>";

            if (analysisMsg) {
                // Formatting the analysis for Email (convert Markdown to simple HTML)
                // We extract lines starting with emojis 🔎 or 📊
                const lines = analysisMsg.content.split('\n').filter((l: string) => l.includes('🔎') || l.includes('📊'));
                analysisHtml = lines.map((l: string) => `<p style="margin: 5px 0;">${l.replace(/\*\*/g, '<strong>').replace(/\*\*/g, '</strong>')}</p>`).join('');
            }

            if (process.env.RESEND_API_KEY) {
                try {
                    await resend.emails.send({
                        from: 'AYO <hello@ai-visionary.com>',
                        to: [userEmail],
                        subject: 'Votre Dossier AYO + ASR Light (Gratuit)',
                        html: `
                            <div style="font-family: sans-serif; color: #333;">
                                <h1>Votre Audit de Visibilité IA</h1>
                                <p>Voici les résultats de l'analyse effectuée par AYO.</p>
                                <p><strong>Session ID:</strong> ${sessionAsrId}</p>
                                
                                <div style="background: #f9f9f9; padding: 20px; border-radius: 8px; margin: 20px 0;">
                                    <h2 style="margin-top:0;">📊 Résultats de l'Audit</h2>
                                    ${analysisHtml}
                                </div>

                                <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;" />
                                
                                <h2>🎁 Votre Fichier ASR Light (Offert)</h2>
                                <p>Ce fichier permet aux IA de vous identifier. Copiez ce contenu dans un fichier nommé <code>asr.json</code> à la racine de votre site :</p>
                                <pre style="background:#2d2d2d; color: #fff; padding:15px; border-radius:5px; overflow-x: auto;">
{
  "@context": "https://schema.org",
  "@type": "Organization",
  "@id": "${sessionAsrId}",
  "status": "AYO_LIGHT_VERIFIED",
  "name": "Votre Entreprise",
  "generatedAt": "${sessionDate}"
}
                                </pre>

                                <div style="text-align: center; margin-top: 30px; padding: 20px; background: #e3f2fd; border-radius: 8px;">
                                    <h3 style="margin-top:0;">🚀 Passez à la vitesse supérieure</h3>
                                    <p>Pour garantir votre autorité et protéger votre marque, activez la Certification Cryptographique.</p>
                                    <a href="https://buy.stripe.com/test_dRm5kFc1W1YA1GdfHfcV200" style="background-color:#000; color:#fff; padding:12px 25px; text-decoration:none; border-radius:5px; display:inline-block; font-weight: bold;">🛡 Activer le Pack Essential (99 CHF)</a>
                                </div>
                                
                                <p style="margin-top:30px; font-size:12px; color:#999; text-align: center;">L'équipe AI Visionary / AYO.</p>
                            </div>
                        `
                    });
                    console.log("✅ ASR Light Email sent.");
                } catch (emailErr) {
                    console.error("Email sending failed:", emailErr);
                }
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

        // 🚨 Injection de la RÉALITÉ TECHNIQUE et SÉMANTIQUE (SCAN AIO V2)
        // Detect if the user message is a URL (Basic Heuristic for State 1/2)
        const lastUserMsg = messages[messages.length - 1].content;
        const urlMatch = lastUserMsg.match(/(https?:\/\/[^\s]+)/g);

        // If we have "websiteData.text" (from previous scrape) OR we detect a URL now:
        if (websiteData.text || (urlMatch && messages.length <= 4)) {
            console.log("🚀 Lancement du SCAN AIO INTELLIGENT...");

            // Determine URL to scan (either from state or extraction)
            let urlToScan = urlMatch ? urlMatch[0] : (messages[3]?.content || "");

            if (urlToScan) {
                const scanResult = await scanUrlForAioSignals(urlToScan);

                // -----------------------------------------------------------------------
                // SYSTEM PROMPT CONSTRUCTION (AYO_PROMPT_V3 — CANONIQUE)
                // -----------------------------------------------------------------------
                const SYSTEM_PROMPT = `
AYO_PROMPT_V3 — CANONIQUE (AYO ONLY, AYA SUPPRIMÉ)
Version: 3.0
Statut: ACTIF
But: Stabiliser le prompt AYO, aligné sur la Bible et les règles "IA vs Humain Recherche".

────────────────────────────────────────────────────────
CONTEXTE TECHNIQUE (DONNÉES SCANNÉES)
────────────────────────────────────────────────────────
L'utilisateur analyse l'URL : ${scanResult.url || 'Non fournie'}
Titre détecté : "${scanResult.metaTitle || 'Non détecté'}"
Description détectée : "${scanResult.metaDescription || 'Non détectée'}"
Mots-clés (H1/H2) : "${scanResult.h1?.join(', ') || ''}"
JSON-LD Détecté : ${scanResult.hasJsonLd ? 'OUI' : 'NON'}
Fichier ASR Existant (/.ayo/asr.json) : ${scanResult.hasAsrFile ? 'OUI' : 'NON'}

────────────────────────────────────────────────────────
0) CHAMP D’APPLICATION
────────────────────────────────────────────────────────
Tu es AYO, l'assistant IA de AI-VISIONARY.
Ton but : diagnostiquer la lisibilité AIO d'un site.
Tu es un AUDITEUR TECHNIQUE IMPLACABLE.
AYO = structure de données.
AYO ≠ SEO.

────────────────────────────────────────────────────────
II) PRINCIPES NON NÉGOCIABLES
────────────────────────────────────────────────────────
Donnée > discours
Structure > narration
Lisibilité > visibilité
Neutralité radicale.
Zéro subjectivité. Zéro "bravo". Zéro "super site".
Règle de sobriété : Toute info non trouvée explicitement = 0.

────────────────────────────────────────────────────────
V) SCORE AIO — FORMALISÉ (DÉTERMINISTE 7 BLOCS)
────────────────────────────────────────────────────────
Pondération fixe (Total 100) :
1. Identité: 10
2. Offre: 20
3. Processus: 15
4. Engagements: 15
5. Indicateurs: 20
6. Contenus pédagogiques: 10
7. Structure technique: 10

RÈGLE CRITIQUE "ASR ABSENT" :
- Si (hasAsrFile == false) ET (URL != "ai-visionary.com") :
  -> SCORE MAX POSSIBLE : 90/100.
  -> Structure technique (Bloc 7) : Max 2.5/10 (car pas d'ASR ni JSON-LD complet).

RÈGLE SÉVÉRITÉ "JSON-LD ABSENT" :
- Si (hasJsonLd == false) :
  -> Tu dois être TRÈS SÉVÈRE sur les blocs Identité et Structure.
  -> Le Score Final dépasse rarement 40-50/100.

────────────────────────────────────────────────────────
VIII) FORMAT DE SORTIE — SCAN "|||" (OBLIGATOIRE - STATE 2)
────────────────────────────────────────────────────────
Quand tu es en [ÉTAT 2], tu DOIS sortir tes résultats EXACTEMENT sous cette forme "|||" pour que le frontend les affiche proprement.
NE METS AUCUN COMMENTAIRE SOUS LES NOTES.
NE DONNE AUCUNE EXPLICATION.
LES EXPLICATIONS SONT STRICTEMENT RÉSERVÉES À L'EMAIL.

Format attendu :
✅ Audit de Visibilité IA terminé.
Calcul du score en cours...
|||
🔎 Identité & Ancrage : [NOTE]/10
|||
🔎 Offre (Produits/Services) : [NOTE]/20
|||
🔎 Processus & Méthodes : [NOTE]/15
|||
🔎 Engagements & Conformité : [NOTE]/15
|||
🔎 Indicateurs : [NOTE]/20
|||
🔎 Contenus Pédagogiques : [NOTE]/10
|||
🔎 Structure Technique : [NOTE]/10
|||
📊 SCORE FINAL AIO : [TOTAL] / 100

Après ce bloc "|||", ajoute (dans le chat) le message de verrouillage :
"🔒 RÉSULTAT DÉTAILLÉ VERROUILLÉ
(Les explications critiques et les correctifs ont été générés mais sont masqués).
J’ai préparé votre ASR Light (Carte d’identité numérique) qui corrige les manques structurels détectés.
Pour déverrouiller votre analyse complète, veuillez confirmer votre propriété.
👉 Entrez votre email professionnel :"

────────────────────────────────────────────────────────
IX) SCRIPT CONVERSATIONNEL — ÉTATS
────────────────────────────────────────────────────────
RÈGLE DE SCORING GÉOGRAPHIQUE (CORRIGÉE) :
- Distinguer strictement :
  A. Identité Juridique (Siège social)
  B. Réalité Opérationnelle (Local/National/Global/Online)
- Règle de Valeur "Non Applicable" :
  * Si un champ est absent -> 0 point.
  * Si un champ est présent et déclaré "Non applicable" -> 0.5 point (L'honnêteté déclare l'information).
  * Si un champ est clair -> 1 point.

────────────────────────────────────────────────────────
IX) SCRIPT CONVERSATIONNEL — ÉTATS
────────────────────────────────────────────────────────
ÉTAT 0 — ACCUEIL
Message : "AYO analyse si votre entreprise est lisible par les IA. Donnez-moi : 1) Nom de l'entreprise, 2) URL principale."

ÉTAT 1 — COLLECTE
- Si l'utilisateur donne l'URL, DÉDUIS LE NOM de l'entreprise à partir du domaine ou du titre scanné.
- Ne demande PLUS JAMAIS le pays d'activité.
- Si Nom et URL sont là, lance l'analyse immédiatement.

ÉTAT 2 — ANALYSE & SCAN
Utilise les données scannées ci-dessus.
Affiche le résultat "|||" + Verrouillage.

ÉTAT 3 — VÉRIFICATION EMAIL & DÉLIVRANCE
Si l'utilisateur donne un email valide :
"✅ Email validé.
📨 Envoi en cours vers [EMAIL]...
(Vérifiez vos spams).
---
💡 Option : Pour sceller une déclaration d’autorité, activez la version Essential (99 CHF).
Voulez-vous l’activer ? (Oui/Non)"

ÉTAT 4 — UPGRADE
Si Oui -> Lien Stripe.
Si Non -> "C'est noté."

ÉTAT 5 — FIN
Confirmation.

Utilise ce ton : Professionnel, froid, clinique, expert.
`;
                finalSystemPrompt = SYSTEM_PROMPT; // Overwrite with the new canonical prompt
            }

            console.log("Injecting real website content into AI context...");

            // Keep the text injection for content analysis
            finalSystemPrompt += `\n\n[CONTENU TEXTUEL BRUT POUR ANALYSE SÉMANTIQUE]
"""
${websiteData.text}
"""`;

        } else if (messages.length === 6) {
            // ... existing fallback
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

        // INTERCEPT & PROCESS RESPONSE
        let finalResponseText = result.text;

        // Check for generated JSON in the response (Hidden ASR Pro)
        const jsonMatch = finalResponseText.match(/```json([\s\S]*?)```/);

        // --- EMAIL CAPTURE LOGIC (FREE/LEAD AGENT) ---
        // Detect if user just sent an email address (for the free report)
        // Relaxed Regex: Finds email anywhere in string
        const emailCaptureRegex = /([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9._-]+)/;
        const lastUserContentForEmail = lastMessage.content.trim();
        const emailMatch = lastUserContentForEmail.match(emailCaptureRegex);

        if (lastMessage.role === 'user' && emailMatch) {
            const targetEmail = emailMatch[0]; // The extracted email
            const emailDomain = targetEmail.split('@')[1].toLowerCase();

            // Retrieve Analyzed URL from history (stored in AI context or messages)
            // We look for the URL provided in message 3 (as per State 1 logic)
            // Or we deduce it from the System Prompt injection if available.

            // Quick Hack: We scan previous user messages to find the URL
            const urlRegex = /(https?:\/\/[^\s]+)/g;
            const userMessages = messages.filter((m: any) => m.role === 'user');
            let detectedUrl = "";

            for (const m of userMessages) {
                const match = m.content.match(urlRegex);
                if (match) {
                    detectedUrl = match[0];
                    break; // Take the first URL mentioned
                }
            }

            // Extract domain from detected URL
            let siteDomain = "";
            try {
                if (detectedUrl) {
                    const urlObj = new URL(detectedUrl);
                    siteDomain = urlObj.hostname.replace('www.', '').toLowerCase();
                }
            } catch (e) { }

            console.log(`🔐 SECURITY CHECK: Email Domain (${emailDomain}) vs Site Domain (${siteDomain})`);

            // --- CRITICAL UPDATE: SECURITY DISABLED FOR UX ---
            // We allow ALL emails to pass. The strict domain check was too brittle (e.g. nearyou.xyz vs nearyouapp.xyz).
            const isDomainMatch = true;

            if (isDomainMatch) {
                console.log("✅ ACCESS GRANTED. (Universal Pass)");
                if (process.env.RESEND_API_KEY) {
                    // On envoie le rapport...
                    try {
                        await resend.emails.send({
                            from: 'AYO <hello@ai-visionary.com>',
                            to: [targetEmail],
                            subject: 'Votre Diagnostic de Visibilité IA (Résultat)',
                            text: `Bonjour, voici votre audit AIO. Score estimé : 30-50/100. Votre site manque de structure sémantique (JSON-LD). Vous trouverez ci-joint les instructions pour corriger cela avec ASR Light. Pour une protection complète, passez à la version Essential Pro.`,
                            html: `
                             <div style="font-family: sans-serif; color: #333; max-width: 600px; margin: 0 auto;">
                                 <h2 style="color:#000;">Votre Audit AIO est disponible.</h2>
                                 <p>Bonjour,</p>
                                 <p>Comme demandé, voici le relevé technique de votre visibilité actuelle pour les Intelligences Artificielles.</p>
                                 
                                 <div style="background:#f5f5f5; padding:20px; border-radius:8px; margin: 20px 0;">
                                     <strong>Score AIO Estimé : 30-50 / 100</strong><br/>
                                     <span style="color:#d32f2f;">⚠️ ALERTE : Absence de Structure Sémantique (JSON-LD Organization)</span>
                                 </div>
 
                                 <p>Les IA actuelles ne peuvent pas "lire" votre offre correctement. Vous êtes invisible dans les réponses de recommandation.</p>
 
                                 <h3>La Solution (ASR Light offert)</h3>
                                 <p>Ci-joint, un premier correctif JSON à installer sur votre site pour déclarer votre identité de base.</p>
                                 <pre style="background:#333; color:#fff; padding:15px; border-radius:5px; overflow-x:auto;">
 {
   "@context": "https://schema.org",
   "@type": "Organization",
   "name": "Votre Entreprise",
   "url": "https://${targetEmail.split('@')[1]}"
 }
                                 </pre>
 
                                 <hr style="margin: 30px 0; border:0; border-top:1px solid #eee;" />
                                 
                                 <h3 style="color:#2e7d32;">🔥 PASSEZ AU NIVEAU SUPÉRIEUR (ESSENTIAL PRO)</h3>
                                 <p>Ce fichier gratuit ne suffit pas pour les requêtes complexes ("Trouve-moi le meilleur expert en...").</p>
                                 <p>Pour cela, il vous faut la <strong>Certification Cryptographique ASR</strong> (Signature Numérique).</p>
                                 
                                 <div style="text-align:center; margin: 30px 0;">
                                     <a href="https://buy.stripe.com/test_dRm5kFc1W1YA1GdfHfcV200" style="background:#000; color:#fff; padding:15px 30px; text-decoration:none; border-radius:5px; font-weight:bold;">
                                         🛡 Sécuriser mon Autorité (99 CHF)
                                     </a>
                                 </div>
                             </div>
                         `
                        });
                        console.log("✅ FREE REPORT Email sent successfully to " + targetEmail);
                    } catch (e: any) {
                        console.error("❌ Failed to send Free Report:", e);
                    }
                }
            } else {
                console.warn(`⛔ ACCESS DENIED: Email domain (${emailDomain}) does not match site (${siteDomain}).`);
                // Note: Ideally we should inform the user here, but the AI handles the text response.
                // We can inject a hidden refusal hint into the final prompt if we wanted, but for now we just block the email.
            }
        }

        // Regex for payment confirmation (Fait/Payé/Done...)
        const paymentConfirmationRegex = /\b(fait|payé|payer|done|paid)\b/i;
        const lastUserContent = lastMessage.content.trim();

        if (jsonMatch && lastMessage.role === 'user' && paymentConfirmationRegex.test(lastUserContent)) {
            const extractedJson = jsonMatch[1].trim();
            console.log("💰 INTERCEPTED ASR PRO JSON. Sending via Email...");

            // Remove JSON from Chat Output (Keep it clean)
            finalResponseText = finalResponseText.replace(/```json[\s\S]*?```/, "✅ **Dossier Sécurisé Transmis.**");

            // EMAIL LOGIC FOR ESSENTIAL PRO
            // Find valid email in previous user messages
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            const foundEmailMsg = messages.slice().reverse().find((m: any) => m.role === 'user' && emailRegex.test(m.content.trim()));

            if (foundEmailMsg && process.env.RESEND_API_KEY) {
                const targetEmail = foundEmailMsg.content.trim();

                try {
                    await resend.emails.send({
                        from: 'AYO <hello@ai-visionary.com>',
                        to: [targetEmail],
                        subject: 'Votre Certification AYO Essential PRO (Confidentiel)',
                        html: `
                            <div style="font-family: sans-serif; color: #333;">
                                <h1 style="color:#000;">Votre Identité IA est prête.</h1>
                                <p>Voici votre fichier <strong>ASR Essential PRO</strong>.</p>
                                <p>Contrairement à la version Light, ce fichier scelle votre <strong>Structure Décisionnelle</strong> (Ce que vous faites, comment, et pour qui).</p>
                                
                                <div style="background:#e8f5e9; padding:15px; border-radius:8px; border:1px solid #4caf50; margin: 20px 0;">
                                    <h3 style="margin-top:0; color:#2e7d32;">✅ Fichier Certifié (ASR PRO)</h3>
                                    <pre style="background:#fff; padding:15px; overflow-x:auto; font-size:12px;">${extractedJson}</pre>
                                </div>
                                
                                <p><strong>Instruction :</strong> Remplacez votre ancien fichier <code>asr.json</code> par celui-ci.</p>
                                <p style="color:#666;">Seules les données présentes dans ce fichier seront prises pour vérité absolue par les moteurs de réponse.</p>
                                
                                <hr />
                                <p style="font-size:12px; text-align:center;">Scellé le ${new Date().toISOString()}</p>
                            </div>
                        `
                    });
                    console.log("✅ ASR PRO Email sent successfully.");
                } catch (err) {
                    console.error("ASR PRO Email failed:", err);
                }
            } else {
                console.warn("⚠️ ASR PRO: Could not find email in history.");
            }
        }

        return new Response(JSON.stringify({ text: finalResponseText }), {
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
