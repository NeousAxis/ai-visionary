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
            // The API Key will be injected securely by GitHub Actions during deployment.
            // It is NOT stored in the repository.
            const API_KEY = "SECRET_API_KEY_PLACEHOLDER";

            let apiKeyToUse = API_KEY;

            if (API_KEY === "SECRET_API_KEY_PLACEHOLDER" || API_KEY === "") {
                console.warn("API Key not found in deployment.");
                const manualKey = prompt("⚠️ Configuration incomplète sur GitHub.\n\nPour tester AIO maintenant, entrez votre clé API Gemini ici (elle ne sera pas sauvegardée) :");
                if (manualKey) {
                    apiKeyToUse = manualKey;
                } else {
                    alert("Impossible de lancer l'analyse sans clé API.");
                    return;
                }
            }

            const genAI = new GoogleGenerativeAI(apiKeyToUse);
            const model = genAI.getGenerativeModel({
                model: "gemini-1.5-flash",
                systemInstruction: "Tu es un expert mondial en AIO (Artificial Intelligence Optimization) et en Sémantique Web. Ton objectif est d'analyser les entreprises et de structurer leurs données pour les rendre parfaitement lisibles et compréhensibles par les Agents IA (LLMs, Search Generative Experience). Tu dois être critique, précis et constructif."
            });

            aioForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const btn = document.getElementById('aio-submit-btn');
                const loader = btn.querySelector('.loader');
                const btnText = btn.querySelector('.btn-text-content');
                const resultsContainer = document.getElementById('aio-results');

                // UI State: Loading
                btn.disabled = true;
                loader.style.display = 'inline-block';
                btnText.style.display = 'none';
                resultsContainer.style.display = 'none';

                const company = document.getElementById('companyName').value;
                const url = document.getElementById('companyUrl').value;
                const sector = document.getElementById('companySector').value;

                const prompt = `
                    Analyse l'entreprise suivante :
                    Nom : ${company}
                    URL : ${url}
                    Secteur : ${sector}

                    Génère un rapport d'audit et d'optimisation AIO complet au format JSON STRICT.
                    Ne reponds QUE par du JSON valide, sans markdown, sans balises \`\`\`.

                    Structure JSON attendue :
                    {
                      "scores": {
                        "readability": (note sur 40, capacité d'une IA à lire le contenu),
                        "credibility": (note sur 30, fiabilité des sources et preuves),
                        "authority": (note sur 30, expertise perçue dans le secteur),
                        "total": (somme des 3 notes)
                      },
                      "actionPlan": [
                        {
                          "id": 1,
                          "title": "Titre de l'action (ex: Implémenter Schema.org)",
                          "priority": "Critical" | "High" | "Medium" | "Low",
                          "impact": "High" | "Medium" | "Low",
                          "description": "Explication courte de pourquoi c'est vital pour l'IA."
                        },
                        ... (Génère 4 actions pertinentes)
                      ],
                      "content": {
                        "jsonLd": (Un objet JSON-LD complet et valide pour cette entreprise - type Organization ou LocalBusiness),
                        "faq": [
                          { "q": "Question pertinente sur l'entreprise", "a": "Réponse optimisée pour la Featured Snippet (claire, concise)" },
                          ... (3 questions/réponses)
                        ],
                        "glossary": [
                          { "term": "Terme métier clé", "def": "Définition simple et sans ambiguïté pour une IA" },
                          ... (3 termes)
                        ]
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

                } catch (error) {
                    console.error("AIO Error:", error);
                    alert("Une erreur est survenue lors de l'analyse. Vérifiez la console ou réessayez.");
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
});
