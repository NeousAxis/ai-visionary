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

    // AIO Demo Logic
    const aioForm = document.getElementById('aio-form');
    if (aioForm) {
        // Load Google GenAI SDK dynamically
        import("https://esm.run/@google/generative-ai").then(async (module) => {
            const { GoogleGenerativeAI } = module;
            const API_KEY = "SECRET_API_KEY_PLACEHOLDER";

            aioForm.addEventListener('submit', async (e) => {
                e.preventDefault(); // STOP PAGE RELOAD

                const btn = document.getElementById('aio-submit-btn');
                const loader = btn.querySelector('.loader');
                const btnText = btn.querySelector('.btn-text-content');
                const resultsContainer = document.getElementById('aio-results');

                // Check API Key at runtime
                if (API_KEY === "SECRET_API_KEY_PLACEHOLDER" || API_KEY === "") {
                    alert("⚠️ Erreur : La clé API n'est pas active. Le déploiement GitHub n'a peut-être pas encore injecté le secret.");
                    return;
                }

                // UI State: Loading
                btn.disabled = true;
                loader.style.display = 'inline-block';
                btnText.style.display = 'none';
                resultsContainer.style.display = 'none';

                const company = document.getElementById('companyName').value;
                const url = document.getElementById('companyUrl').value;
                const sector = document.getElementById('companySector').value;

                const genAI = new GoogleGenerativeAI(API_KEY);
                const model = genAI.getGenerativeModel({
                    model: "gemini-1.5-flash",
                    systemInstruction: `Tu es AYO Bot (Artificial Intelligence Optimization Bot).
Ta mission est d'analyser une entreprise pour la rendre parfaitement lisible, compréhensible et crédible aux yeux des IA (Gemini, ChatGPT, Perplexity).

Tu dois générer un rapport AUDIT + CONTENU OPTIMISÉ au format JSON STRICT.

TES MODULES D'ANALYSE :
1. ANALYSE DU SITE : Structure, métadonnées, clarté.
2. VERIFICATION DONNÉES : Cohérence avec les standards du web.
3. SCORE AIO (0-100) basés sur 3 piliers :
   - Lisibilité IA (/40)
   - Crédibilité IA (/30)
   - Autorité IA (/30)

TES MODULES DE GÉNÉRATION :
1. Plan d'action priorisé.
2. JSON-LD complet (Organization, LocalBusiness, etc.).
3. FAQ structurée (Questions/Réponses claires).
4. Glossaire métier (Définitions simples).
5. Descriptions optimisées IA (Courte, Standard, Longue).

Format de réponse attendu : JSON UNIQUEMENT.`
                });

                const prompt = `
                    Analyse l'entreprise suivante :
                    Nom : ${company}
                    URL : ${url}
                    Secteur : ${sector}

                    Produis le JSON suivant (sans aucun texte avant ou après, pas de markdown) :
                    {
                      "scores": {
                        "readability": (note/40),
                        "credibility": (note/30),
                        "authority": (note/30),
                        "total": (somme/100)
                      },
                      "actionPlan": [
                        {
                          "id": 1,
                          "title": "Action",
                          "priority": "Critical/High/Medium/Low",
                          "impact": "High/Medium/Low",
                          "description": "Pourquoi c'est important pour l'IA"
                        },
                        ... (4 actions clés)
                      ],
                      "content": {
                        "jsonLd": (Objet JSON-LD valide),
                        "faq": [
                          { "q": "Question", "a": "Réponse" }, ... (5 Q/R)
                        ],
                        "glossary": [
                          { "term": "Terme", "def": "Définition" }, ... (5 termes)
                        ],
                        "descriptions": {
                          "short": "150 chars max",
                          "standard": "300 chars max",
                          "long": "800 chars max"
                        }
                      }
                    }
                `;

                try {
                    const result = await model.generateContent(prompt);
                    const response = await result.response;
                    let text = response.text();
                    text = text.replace(/```json/g, '').replace(/```/g, '').trim();
                    const data = JSON.parse(text);

                    // Render Results
                    document.getElementById('score-total').textContent = data.scores.total;

                    // Render Action Plan
                    const actionList = document.getElementById('action-plan-list');
                    actionList.innerHTML = data.actionPlan.map(action => `
                        <div class="action-item priority-${action.priority}">
                            <span class="action-title">${action.title} <small>(${action.priority})</small></span>
                            <span class="action-desc">${action.description}</span>
                        </div>
                    `).join('');

                    // Render JSON-LD
                    const jsonCode = document.getElementById('json-code');
                    const jsonString = typeof data.content.jsonLd === 'string' ? data.content.jsonLd : JSON.stringify(data.content.jsonLd, null, 2);
                    jsonCode.textContent = jsonString;

                    // Render Content (FAQ + Glossary)
                    const faqList = document.getElementById('faq-list');
                    faqList.innerHTML = data.content.faq.map(item => `
                        <div class="qa-item">
                            <span class="qa-q">Q: ${item.q}</span>
                            <span class="qa-a">R: ${item.a}</span>
                        </div>
                    `).join('');

                    const glossaryList = document.getElementById('glossary-list');
                    glossaryList.innerHTML = data.content.glossary.map(item => `
                        <div class="glossary-item">
                            <span class="term">${item.term} :</span>
                            <span class="def">${item.def}</span>
                        </div>
                    `).join('');

                    resultsContainer.style.display = 'block';
                    // Scroll to results
                    resultsContainer.scrollIntoView({ behavior: 'smooth' });

                } catch (error) {
                    console.error("AIO Error:", error);
                    alert("Une erreur est survenue lors de l'analyse (Erreur API ou JSON invalide).");
                } finally {
                    btn.disabled = false;
                    loader.style.display = 'none';
                    btnText.style.display = 'inline';
                }
            });

            // Tabs Logic
            const tabs = document.querySelectorAll('.tab-btn');
            const contents = document.querySelectorAll('.tab-content');

            tabs.forEach(tab => {
                tab.addEventListener('click', () => {
                    tabs.forEach(t => t.classList.remove('active'));
                    contents.forEach(c => c.classList.remove('active'));

                    tab.classList.add('active');
                    document.getElementById(`tab-${tab.dataset.tab}`).classList.add('active');
                });
            });

            // Copy JSON Logic
            document.getElementById('copy-json').addEventListener('click', () => {
                const range = document.createRange();
                range.selectNode(document.getElementById('json-code'));
                window.getSelection().removeAllRanges();
                window.getSelection().addRange(range);
                document.execCommand('copy');
                window.getSelection().removeAllRanges();
                alert('JSON-LD copié !');
            });

        }).catch(err => {
            console.error("Failed to load Google GenAI SDK", err);
        });
    }
    // AYO Chat Logic
    const ayoToggle = document.getElementById('ayo-toggle');
    const ayoWindow = document.getElementById('ayo-chat-window');
    const ayoClose = document.getElementById('ayo-close');
    const ayoMessages = document.getElementById('ayo-messages');
    const ayoFormChat = document.getElementById('ayo-chat-form');
    const ayoInput = document.getElementById('ayo-input');
    const ayoTyping = document.getElementById('ayo-typing');

    let chatState = 0; // 0: Start, 1: Name, 2: URL, 3: Sector, 4: Analyzing
    let chatData = { name: '', url: '', sector: '' };

    if (ayoToggle) {
        ayoToggle.addEventListener('click', () => {
            ayoWindow.classList.toggle('open');
            if (ayoWindow.classList.contains('open') && ayoMessages.children.length === 0) {
                addBotMessage("Bonjour ! Je suis AYO, votre assistant d'optimisation IA. Voulez-vous scanner votre entreprise ? (Oui/Non)");
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

    function addBotMessage(text) {
        const msg = document.createElement('div');
        msg.className = 'message bot';
        msg.textContent = text;
        ayoMessages.appendChild(msg);
        ayoMessages.scrollTop = ayoMessages.scrollHeight;
    }

    async function processChatStep(input) {
        ayoTyping.style.display = 'block';

        // Fake latency for natural feel
        await new Promise(r => setTimeout(r, 600));

        if (chatState === 0) {
            if (input.toLowerCase().includes('oui') || input.toLowerCase().includes('ok') || input.toLowerCase().includes('yes')) {
                addBotMessage("Parfait ! Quel est le nom de votre entreprise ?");
                chatState = 1;
            } else {
                addBotMessage("D'accord. N'hésitez pas à me solliciter si besoin !");
            }
        } else if (chatState === 1) {
            chatData.name = input;
            addBotMessage(`Merci. Quelle est l'adresse de votre site web (URL) ?`);
            chatState = 2;
        } else if (chatState === 2) {
            chatData.url = input;
            addBotMessage("Noté. Et quel est votre secteur d'activité ?");
            chatState = 3;
        } else if (chatState === 3) {
            chatData.sector = input;
            addBotMessage("C'est parti ! Je lance l'analyse AYO. Cela peut prendre quelques secondes...");
            chatState = 4;
            await runAyoAnalysisInChat();
        }

        ayoTyping.style.display = 'none';
        ayoMessages.scrollTop = ayoMessages.scrollHeight;
    }

    async function runAyoAnalysisInChat() {
        import("https://esm.run/@google/generative-ai").then(async (module) => {
            const { GoogleGenerativeAI } = module;
            const API_KEY = "SECRET_API_KEY_PLACEHOLDER";

            if (API_KEY === "SECRET_API_KEY_PLACEHOLDER" || API_KEY === "") {
                addBotMessage("⚠️ Erreur : Clé API non configurée.");
                return;
            }

            const genAI = new GoogleGenerativeAI(API_KEY);
            const model = genAI.getGenerativeModel({
                model: "gemini-1.5-flash",
                systemInstruction: "Tu es AYO Bot. Analyse l'entreprise fournie et donne un score AIO sur 100 et 3 conseils clés. Sois bref (max 500 caractères)." // Version courte pour le chat
            });

            const prompt = `Entreprise: ${chatData.name}, URL: ${chatData.url}, Secteur: ${chatData.sector}. Donne un résumé du score AIO.`;

            try {
                const result = await model.generateContent(prompt);
                const response = result.response.text();
                addBotMessage(response);
                addBotMessage("💡 Pour voir le rapport détaillé (JSON-LD, FAQ, Audit complet), utilisez le formulaire complet sur la page.");
            } catch (err) {
                addBotMessage("Oups, une erreur est survenue pendant l'analyse.");
                console.error(err);
            }
            chatState = 0; // Reset
        });
    }

});
