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

    // AYO Central Trigger Logic
    const centralAyoBtn = document.getElementById('open-ayo-chat-central');
    if (centralAyoBtn) {
        centralAyoBtn.addEventListener('click', (e) => {
            e.preventDefault();
            const ayoWindow = document.getElementById('ayo-chat-window');
            const ayoMessages = document.getElementById('ayo-messages');
            if (ayoWindow) {
                ayoWindow.classList.add('open');
                if (ayoMessages && ayoMessages.children.length === 0) {
                    // Trigger initial message if empty
                    // Note: We need to access the addBotMessage function which is scoped below.
                    // IMPORTANT: To fix scoping, we should move the chat logic UP or expose the function.
                    // EASIER FIX: Just trigger a click on the toggle button which already handles this!
                    const toggleBtn = document.getElementById('ayo-toggle');
                    if (toggleBtn) toggleBtn.click();
                    else ayoWindow.classList.add('open'); // Fallback
                } else {
                    // If already open or has messages, just ensure it's open
                    const toggleBtn = document.getElementById('ayo-toggle');
                    // If window is closed, click toggle to open and trigger logic
                    if (!ayoWindow.classList.contains('open') && toggleBtn) toggleBtn.click();
                    else ayoWindow.classList.add('open');
                }
            }
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

    // States: 0:Welcome, 1:Name, 2:URL, 3:Sector, 4:LiteAnalysis, 5:ResultsChoice, 6:Pricing
    let chatState = 0;
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
            if (ayoWindow.classList.contains('open') && ayoMessages.children.length === 0) {
                addBotMessage("Bonjour ! Je suis AYO. Je vais évaluer gratuitement la visibilité IA de votre entreprise. Prêt ? (Oui/Non)");
            }
        });

        ayoClose.addEventListener('click', () => {
            ayoWindow.classList.remove('open');
        });

        ayoFormChat.addEventListener('submit', async (e) => {
            e.preventDefault();
            const userText = ayoInput.value.trim();
            if (!userText) return;

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
        // Simple heuristic to ignore yes/no logic if we are deep in flow
        if (chatState === 0) {
            if (input.toLowerCase().includes('oui') || input.toLowerCase().includes('ok') || input.toLowerCase().includes('yes')) {
                addBotMessage("Super. Quel est le nom de votre entreprise ?");
                chatState = 1;
            } else {
                addBotMessage("Pas de problème. Je reste ici si besoin.");
            }
            return;
        }

        ayoTyping.style.display = 'block';
        await new Promise(r => setTimeout(r, 600));

        if (chatState === 1) {
            chatData.name = input;
            addBotMessage("Merci. Quelle est l'URL de votre site web ?");
            chatState = 2;
        } else if (chatState === 2) {
            chatData.url = input;
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
        import("https://esm.run/@google/generative-ai").then(async (module) => {
            const { GoogleGenerativeAI } = module;
            const API_KEY = "SECRET_API_KEY_PLACEHOLDER";

            if (API_KEY === "SECRET_API_KEY_PLACEHOLDER" || API_KEY === "") {
                addBotMessage("⚠️ Erreur API Key.");
                ayoTyping.style.display = 'none';
                return;
            }

            const genAI = new GoogleGenerativeAI(API_KEY);
            const model = genAI.getGenerativeModel({
                model: "gemini-1.5-flash",
                systemInstruction: `Tu es AYO. Tu réalises un pré-diagnostic pour une entreprise.
OBJECTIF : Déterminer si l'entreprise est "AYA-READY" (éligible au moteur de recherche) ou si elle a besoin d'optimisation.
CRITÈRES :
- AYA-READY (Score > 65) : Données structurées probables, secteur clair.
- AYA-POTENTIAL (Score 40-65) : Contenu intéressant mais mal structuré.
- NON (Score < 40) : Peu de contenu.

SORTIE attendue : JSON STRICT.
{
  "score_lite": (0-100),
  "status": "READY" | "POTENTIAL" | "NOT_READY",
  "reason": "Une phrase courte expliquant pourquoi."
}`
            });

            const prompt = `Entreprise: ${chatData.name}, URL: ${chatData.url}, Secteur: ${chatData.sector}. Analyse Lite.`;

            try {
                const result = await model.generateContent(prompt);
                const responseText = result.response.text().replace(/```json/g, '').replace(/```/g, '').trim();
                const data = JSON.parse(responseText);

                chatData.score = data.score_lite;
                chatData.eligibility = data.status;

                ayoTyping.style.display = 'none';

                // RESULT DISPLAY
                addBotMessage(`📊 <strong>Diagnostic Terminé</strong><br>Score AIO-Lite : ${data.score_lite}/100<br>Status : ${data.status}<br><small>${data.reason}</small>`, true);

                // BRANCHING LOGIC
                if (data.status === 'READY') {
                    addBotMessage("🎉 Excellente nouvelle ! Votre entreprise est <strong>AYA-Ready</strong>. Elle possède assez de données pour être indexée.");

                    addBotButtons([
                        { text: "🚀 S’installer dans AYA maintenant (Gratuit)", action: () => activateAyaProfile() },
                        { text: "🔍 Voir le détail (Audit Complet AYO)", action: () => showPricingOptions() }
                    ]);

                } else if (data.status === 'POTENTIAL') {
                    addBotMessage("Vous êtes <strong>AYA-Potential</strong>. Vos données sont intéressantes, mais manquent de structure pour une indexation parfaite.");

                    addBotButtons([
                        { text: "✨ Créer mon Profil AYA (Gratuit - liste d'attente)", action: () => activateAyaProfile(true) },
                        { text: "🛠️ Obtenir l'analyse complète AYO (Payant)", action: () => showPricingOptions() }
                    ]);

                } else {
                    addBotMessage("Votre visibilité IA est faible. Une restructuration est nécessaire pour apparaître dans les moteurs modernes.");
                    addBotButtons([
                        { text: "🛠️ Obtenir l'analyse complète AYO + Plan d'action", action: () => showPricingOptions() }
                    ]);
                }

            } catch (err) {
                console.error(err);
                addBotMessage("Erreur d'analyse. Réessayez.");
            }
        });
    }

    function activateAyaProfile(isPotential = false) {
        addBotMessage("✅ <strong>Profil activé !</strong>", true);
        if (isPotential) {
            addBotMessage("Votre entreprise a été ajoutée en file d'attente. Les IA pourront commencer à la repérer.");
        } else {
            addBotMessage("Votre profil AYA est désormais actif. Vous apparaitrez dans les recherches AIO compatibles.");
        }
        // UPSELL SOFT
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
