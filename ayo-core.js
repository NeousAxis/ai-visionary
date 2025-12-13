document.addEventListener('DOMContentLoaded', () => {
    // Intersection Observer for Fade-in Animations
    const sections = document.querySelectorAll('.section');

    const observerOptions = {
        root: null,
        rootMargin: '0px',
        threshold: 0.1
    };

    const observer = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
                // Optional: Stop observing once visible if you only want it to animate once
                // observer.unobserve(entry.target); 
            }
        });
    }, observerOptions);

    sections.forEach(section => {
        observer.observe(section);
    });

    // Smooth Scrolling for Anchor Links
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const targetId = this.getAttribute('href');
            if (targetId === '#') return;

            const targetElement = document.querySelector(targetId);
            if (targetElement) {
                targetElement.scrollIntoView({
                    behavior: 'smooth'
                });
            }
        });
    });

    // Parallax Effect for Hero Visual (Optional Enhancement)
    const heroVisual = document.querySelector('.abstract-network');
    if (heroVisual) {
        document.addEventListener('mousemove', (e) => {
            const x = (window.innerWidth - e.pageX) / 50;
            const y = (window.innerHeight - e.pageY) / 50;

            heroVisual.style.transform = `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))`;
        });
    }


    // AYO Chat Logic (v2.0 - Strategic Flow)
    console.log("AYO Bot v2.1 Ready");
    const ayoToggle = document.getElementById('ayo-toggle');
    const ayoWindow = document.getElementById('ayo-chat-window');
    const ayoClose = document.getElementById('ayo-close');
    const ayoMessages = document.getElementById('ayo-messages');
    const ayoFormChat = document.getElementById('ayo-chat-form');
    const ayoInput = document.getElementById('ayo-input');
    const ayoTyping = document.getElementById('ayo-typing');

    // States: 1:Name, 2:URL, 3:Sector, 4:LiteAnalysis, 5:ResultsChoice, 6:Pricing
    // State 0 is now skipped/merged into initial load
    let chatState = 1;
    let chatData = { name: '', url: '', sector: '', score: 0, eligibility: '' }; // eligibility: 'READY', 'POTENTIAL', 'NOT_READY'

    // Pricing Links (Placeholders)
    const LINKS = {
        AYO_PRODUCT: "#pricing",
        AYA_SUB: "#pricing",
        PACK_COMBO: "#pricing",
        ENTERPRISE: "#pricing"
    };

    if (ayoToggle) {
        ayoToggle.addEventListener('click', () => {
            ayoWindow.classList.toggle('open');
            // If opening for the first time
            if (ayoWindow.classList.contains('open') && ayoMessages.children.length === 0) {
                addBotMessage("Bonjour, Je suis AYO. Je vais évaluer gratuitement la visibilité IA de votre entreprise. Comment se nomme votre entreprise/organisation ?");
                chatState = 1;
            }
        });

        ayoClose.addEventListener('click', () => {
            ayoWindow.classList.remove('open');
        });

        // Central Trigger Logic (Placed here to access 'ayoWindow' and 'addBotMessage')
        const centralBtn = document.getElementById('open-ayo-chat-central');
        if (centralBtn) {
            centralBtn.addEventListener('click', (e) => {
                e.preventDefault();
                ayoWindow.classList.add('open');
                if (ayoMessages.children.length === 0) {
                    addBotMessage("Bonjour, je suis AYO. Je vais évaluer gratuitement la visibilité IA de votre entreprise. Comment se nomme votre entreprise/organisation ?");
                    chatState = 1;
                }
            });
        }

        ayoFormChat.addEventListener('submit', async (e) => {
            e.preventDefault();
            const userText = ayoInput.value.trim();
            if (!userText) return;

            if (userText.toLowerCase() === 'test' || userText.toLowerCase() === 'demo') {
                addUserMessage(userText);
                ayoInput.value = '';
                chatData = {
                    name: "Boulangerie Test",
                    url: "https://boulangerietest.com",
                    sector: "Alimentation"
                };
                addBotMessage("🕵️ <strong>Mode Test Activé</strong>. Données simulées : Boulangerie Test / Alimentation.");
                addBotMessage("Je lance le diagnostic gratuit...");
                chatState = 4;
                await runLiteAnalysis();
                return;
            }

            addUserMessage(userText);
            ayoInput.value = '';
            processChatStep(userText);
        });
    }

    function addUserMessage(text) {
        const msg = document.createElement('div');
        msg.className = 'message user';
        msg.textContent = text;
        ayoMessages.appendChild(msg);
        ayoMessages.scrollTop = ayoMessages.scrollHeight;
    }

    function addBotMessage(text, isHtml = false) {
        const msg = document.createElement('div');
        msg.className = 'message bot';
        if (isHtml) msg.innerHTML = text;
        else msg.textContent = text;
        ayoMessages.appendChild(msg);
        ayoMessages.scrollTop = ayoMessages.scrollHeight;
    }

    // Helper for buttons
    function addBotButtons(buttons) {
        const container = document.createElement('div');
        container.className = 'message bot';
        container.style.background = 'transparent';
        container.style.padding = '0';
        container.style.display = 'flex';
        container.style.flexDirection = 'column';
        container.style.gap = '8px';

        buttons.forEach(btn => {
            const button = document.createElement('button');
            button.className = 'btn btn-secondary'; // RE-USE Existing CSS Class or 'ayo-choice-btn' if needed
            button.style.fontSize = '0.85rem';
            button.style.padding = '8px 12px';
            button.style.textAlign = 'left';
            button.style.border = '1px solid rgba(139, 92, 246, 0.4)';
            button.innerText = btn.text;
            button.onclick = btn.action;
            container.appendChild(button);
        });

        ayoMessages.appendChild(container);
        ayoMessages.scrollTop = ayoMessages.scrollHeight;
    }

    async function processChatStep(input) {
        ayoTyping.style.display = 'block';
        await new Promise(r => setTimeout(r, 600));

        if (chatState === 1) {
            chatData.name = input;
            addBotMessage("Merci. Quelle est l'URL de votre site web ?");
            chatState = 2;
        } else if (chatState === 2) {
            // Handle various URL formats and normalize
            let cleanUrl = input.toLowerCase().trim();
            if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
                cleanUrl = 'https://' + cleanUrl;
            }
            chatData.url = cleanUrl;

            addBotMessage("C'est noté. Quel est votre secteur d'activité ?");
            chatState = 3;
        } else if (chatState === 3) {
            chatData.sector = input;
            addBotMessage("Je lance le diagnostic gratuit (Audit AIO-Lite + Éligibilité AYA). Patientez un instant...");
            chatState = 4;
            await runLiteAnalysis();
        }
        // State 5 & 6 are handled by buttons usually, but if user types, we can fallback

        ayoTyping.style.display = 'none';
        ayoMessages.scrollTop = ayoMessages.scrollHeight;
    }

    async function runLiteAnalysis() {
        // NEW STRATEGY: Read from global AYO_SETTINGS injected by separate file
        const ENV_OBJ = window.AYO_SETTINGS || window.AYO_ENV;
        const API_KEY = ENV_OBJ && ENV_OBJ.apiKey ? ENV_OBJ.apiKey : "API_KEY_NOT_FOUND_IN_SETTINGS";

        if (!API_KEY || API_KEY.length < 20 || API_KEY.includes("KEY_HOLDER_XYZ")) {
            const debugKey = API_KEY ? (API_KEY.substring(0, 4) + "...") : "NULL/EMPTY";
            const status = API_KEY === "KEY_HOLDER_XYZ" ? "NON REMPLACÉE (Placeholder intact)" : "REMPLACÉE";
            addBotMessage(`⚠️ Erreur : Clé API invalide.<br>Status: ${status}<br>Loch: ${API_KEY.length}<br>Aperçu: ${debugKey}<br>(Vérifiez AYO_SETTINGS)`, true);
            ayoTyping.style.display = 'none';
            return;
        }

        try {
            // Fetch the AYO Sectors definition
            const response = await fetch('AYO_SECTORS_V1.json');
            if (!response.ok) throw new Error("Impossible de charger les secteurs AYO.");
            const ayoSectors = await response.json();

            // OPENAI IMPLEMENTATION
            const systemPrompt = `
TU ES AYO, moteur d’analyse de “Lisibilité AIO”.

Ta mission est d’analyser n’importe quelle entreprise selon :
1) une STRUCTURE UNIVERSELLE,
2) un MACRO-SECTEUR issu du JSON AYO_SECTORS ci-dessous,
3) des RÈGLES D’INTERDICTION strictes.

[REFERENCE DATA: AYO_SECTORS_V1.json]
${JSON.stringify(ayoSectors)}
[END REFERENCE DATA]

────────────────────────
RÈGLES D'ANALYSE
────────────────────────
- Ne JAMAIS utiliser d’avis clients, notes ou témoignages.
- N’utiliser que des données objectives, vérifiables et déclaratives.

────────────────────────
STRUCTURE UNIVERSELLE (7 BLOCS)
────────────────────────
1. IDENTITÉ
2. OFFRE
3. PROCESSUS / MÉTHODES
4. ENGAGEMENTS / CONFORMITÉ
5. INDICATEURS
6. CONTENUS PÉDAGOGIQUES
7. STRUCTURE TECHNIQUE

────────────────────────
RÈGLE 5 — PREMIÈRE PARTIE GRATUITE (LITE)
────────────────────────
Ceci est une analyse préliminaire. Tu dois fournir :
1. Une brève analyse du Bloc IDENTITÉ.
2. Un MINI AUDIT AIO (Forces principales / Faiblesses critiques).
3. Une phrase de conclusion du type : « Vos données [sont/ne sont pas] suffisamment structurées... ».

────────────────────────
FORMAT DE SORTIE (JSON STRICT)
────────────────────────
Pour cette interaction, tu dois répondre UNIQUEMENT en JSON compatible avec l'interface :
{
  "text_response": "Le texte complet de ta réponse pour l'utilisateur (format HTML autorisé : <b>, <br>)",
  "score_lite": (note 0-100),
  "status": "READY" | "POTENTIAL" | "NOT_READY",
  "reason": "Phrase très courte pour le debug interne (pourquoi ce status)"
}

CRITÈRES STATUS :
- "READY" (Score > 65) : Données structurées, JSON-LD probable, secteur clair.
- "POTENTIAL" (Score 40-65) : Contenu intéressant mais mal structuré.
- "NOT_READY" (Score < 40) : Trop peu de contenu lisible.
`;

            const userPrompt = `Entreprise: ${chatData.name}, URL: ${chatData.url}, Secteur déclaré: ${chatData.sector}. Fais l'analyse Lite.`;

            const aiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${API_KEY}`
                },
                body: JSON.stringify({
                    model: "gpt-4o-mini", // Cost efficient and fast
                    messages: [
                        { role: "system", content: systemPrompt },
                        { role: "user", content: userPrompt }
                    ],
                    temperature: 0.7,
                    response_format: { type: "json_object" }
                })
            });

            if (!aiResponse.ok) {
                const errorData = await aiResponse.json();
                console.error("OpenAI Error Details:", errorData);
                throw new Error(`OpenAI API Error: ${errorData.error?.message || aiResponse.statusText}`);
            }

            const resultData = await aiResponse.json();
            const responseText = resultData.choices[0].message.content;
            const data = JSON.parse(responseText);

            chatData.score = data.score_lite;
            chatData.eligibility = data.status;

            ayoTyping.style.display = 'none';

            // RESULT DISPLAY
            addBotMessage(data.text_response, true);

            // Show Score Badge slightly after
            setTimeout(() => {
                addBotMessage(`📊 <strong>Score AIO-Lite : ${data.score_lite}/100</strong>`, true);
            }, 800);


            // BRANCHING LOGIC
            setTimeout(() => {
                const buttons = [];

                if (data.status === 'READY') {
                    buttons.push({
                        text: "🚀 S’installer dans AYA maintenant (Gratuit)",
                        action: () => activateAyaProfile(false, data)
                    });
                } else if (data.status === 'POTENTIAL') {
                    buttons.push({
                        text: "✨ Créer mon Profil AYA (Gratuit - liste d'attente)",
                        action: () => activateAyaProfile(true, data)
                    });
                } else {
                    buttons.push({ text: "🛠️ Obtenir l'analyse complète AYO", action: () => showPricingOptions() });
                }

                addBotButtons(buttons);
            }, 1500);

        } catch (err) {
            console.error("AYO Analysis Error:", err);
            ayoTyping.style.display = 'none';

            if (err.message.includes('API key') || err.message.includes('401')) {
                const keyLen = API_KEY ? API_KEY.length : 0;
                const keyStart = API_KEY ? API_KEY.substring(0, 4) : "NULL";
                addBotMessage(`⚠️ <strong>Accès refusé par OpenAI</strong>.<br>La clé API est bien configurée mais rejetée.<br><strong>Diagnostic Clé :</strong><br>- Longueur reçue : ${keyLen} (Doit être ~51)<br>- Début : ${keyStart}...<br><br>Si API OpenAI, doit commencer par sk-.`, true);
            } else {
                addBotMessage(`Une erreur inattendue est survenue.<br><small>${err.message}</small>`, true);
            }
        }
    }

    // FUNCTION TO TRIGGER ASR GENERATION (Internal Use)
    async function generateASR(chatData, analysisData) {
        ayoTyping.style.display = 'block';

        // Reuse the same key logic
        const ENV_OBJ = window.AYO_SETTINGS || window.AYO_ENV;
        const API_KEY = ENV_OBJ && ENV_OBJ.apiKey ? ENV_OBJ.apiKey : "";

        if (!API_KEY || API_KEY.length < 20 || API_KEY.includes("KEY_HOLDER_XYZ")) {
            addBotMessage("⚠️ Erreur : Clé API non disponible pour la génération ASR.");
            ayoTyping.style.display = 'none';
            return;
        }

        const systemPrompt = `
TU ES LE MODULE AYO_ASR_GENERATOR.
Ta mission : produire un ASR (AYO Singular Record) STRICTEMENT VALIDE (version ASR-1.0).

RÈGLES :
- Tu ne produis QUE du JSON.
- Tu respectes EXACTEMENT la structure ASR-1.0.
- Si une info n’est pas vérifiable : laisse "" ou null.
- Tu n’inventes RIEN.
- AUCUNE donnée subjective, aucun avis client, aucun élément marketing.
- Tu utilises le sector_macro_id issu de AYO_SECTORS_LIGHT.
- Le ASR doit être lisible, neutre, compressé et IA-compatible.

STRUCTURE OBLIGATOIRE (doit être complète) :
version, identity, aio_profile, operations, compliance,
indicators, technical_surface, ayo_consistency,
asr_anchor, signature.

CONTRAINTES IMPORTANTES :
- identity.sector_macro_id doit être EXACT.
- blocks_present doit refléter les blocs réellement détectés.
- value_proposition : 1 phrase neutre.
- processes_summary : 3 à 7 éléments.
- indicators.key_indicators : uniquement s'ils existent réellement.
- asr_anchor.semantic_root = true.
- asr_anchor.meaning_priority = 1.
- signature.generated_by = "AYO/ASR".
- signature.created_at : date ISO actuelle.
- signature.updated_at : même date.
- signature.content_hash : chaîne pseudo-hash courte.

SORTIE :
Un JSON unique, valide, sans texte avant ou après.
`;

        const userPrompt = `
        Données de base:
        Nom: ${chatData.name}
        Secteur: ${chatData.sector}
        URL: ${chatData.url}
        
        Analyse précédente (Lite):
        Score: ${analysisData.score_lite}
        Status: ${analysisData.status}
        Détails: ${analysisData.text_response}
        
        Génère le fichier ASR.json maintenant.
        `;

        try {
            const aiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${API_KEY}`
                },
                body: JSON.stringify({
                    model: "gpt-4o-mini",
                    messages: [
                        { role: "system", content: systemPrompt },
                        { role: "user", content: userPrompt }
                    ],
                    temperature: 0.2,
                    response_format: { type: "json_object" }
                })
            });

            if (!aiResponse.ok) {
                const errorData = await aiResponse.json();
                throw new Error(`OpenAI API Error: ${errorData.error?.message || aiResponse.statusText}`);
            }

            const resultData = await aiResponse.json();
            const jsonStr = resultData.choices[0].message.content;

            // Display as code block
            const downloadBlob = new Blob([jsonStr], { type: 'application/json' });
            const downloadUrl = URL.createObjectURL(downloadBlob);

            addBotMessage(`
                <strong>✅ ASR GÉNÉRÉ & INTÉGRÉ</strong><br>
                Pour finaliser votre installation dans l'index AYA, voici votre fichier d'autorité.<br>
                1. Téléchargez le fichier ASR.json<br>
                2. Placez-le à la racine de votre site (ou dossier /.ayo/)<br><br>
                <pre style="background:#111; padding:10px; border-radius:5px; font-size:0.75rem; overflow-x:auto; color:#a3e635;">${jsonStr.substring(0, 300)}... (tronqué)</pre>
                <a href="${downloadUrl}" download="ASR.json" class="btn btn-sm btn-primary" style="margin-top:10px; display:inline-block; text-decoration:none;">📥 Télécharger ASR.json</a>
            `, true);

            ayoTyping.style.display = 'none';

        } catch (error) {
            console.error("ASR Generation Error", error);
            addBotMessage("Erreur lors de la génération du fichier ASR.");
            ayoTyping.style.display = 'none';
        }
    }

    function activateAyaProfile(isPotential = false, analysisData = null) {
        addBotMessage("✅ <strong>Profil activé !</strong> Initialisation du protocole AYO...", true);

        if (isPotential) {
            addBotMessage("Vous êtes sur liste d'attente. Nous générons votre fichier ASR préliminaire pour préparer votre structure.");
        } else {
            addBotMessage("Votre entreprise est éligible. Génération immédiate de votre ASR (AYO Singular Record)...");
        }

        // Trigger Automatic ASR Generation
        if (analysisData) {
            generateASR(chatData, analysisData);
        }
        setTimeout(() => {
            addBotMessage("Pour garantir une indexation parfaite et obtenir votre ZIP de données, l'audit complet AYO reste disponible.");
            addBotButtons([
                { text: "Voir les offres AYO / AYA", action: () => showPricingOptions() }
            ]);
        }, 2000);
    }

    function showPricingOptions() {
        chatState = 6;
        addBotMessage("Voici les options pour obtenir votre <strong>Analyse Complète + Pack ZIP AIO-Ready</strong> :");

        addBotButtons([
            { text: "🟩 AYO (490-890 CHF) : Audit + Structuration + ZIP", action: () => window.location.href = LINKS.AYO_PRODUCT },
            { text: "🟦 AYA (190 CHF/an) : Abonnement Moteur", action: () => window.location.href = LINKS.AYA_SUB },
            { text: "🟧 PACK AYO + AYA (690 CHF) : Best-Seller", action: () => window.location.href = LINKS.PACK_COMBO },
            { text: "🟪 ENTERPRISE (Sur devis)", action: () => window.location.href = LINKS.ENTERPRISE }
        ]);
    }
});
