import Link from 'next/link';
import Footer from '../components/Footer';
import AyoChat from '../components/AyoChat';

export default function Home() {
    return (
        <main>
            {/* SECTION 1 — Hero (Accueil) */}
            <section id="hero" className="hero-section">
                <div className="container hero-content">
                    <h1 className="headline">AUJOURD'HUI, C'EST L'IA QUI VA TROUVER ET RECOMMANDER VOTRE ENTREPRISE</h1>
                    <div className="subheadline">
                        <p><strong>AYA</strong> est le premier moteur de recherche centré sur la typologie de vos données.</p>
                        <p><strong>AYO</strong> organise et structure les informations des entreprises pour les rendre compréhensibles par l’IA.</p>
                        <p className="tagline">Moins de bruit, plus de clarté.</p>
                    </div>
                    <div className="cta-group">
                        <a href="#pricing" className="btn btn-primary">→ Structurer mon entreprise avec AYO</a>
                    </div>
                </div>
                <div className="hero-visual">
                    <div className="abstract-network"></div>
                </div>
            </section>

            {/* SECTION 2 — Le problème */}
            <section id="problem" className="section problem-section">
                <div className="container">
                    <h2 className="section-title">Le Web est saturé. Les entreprises disparaissent dans le bruit.</h2>
                    <div className="text-content">
                        <p>Le web se remplit chaque jour de contenus vides. L’IA amplifie largement ce bruit en générant des millions de contenus fantômes privés d'âme humaine. Résultat : une information moins fiable, un web moins lisible, une empreinte numérique qui s’alourdit et une connaissance qui s'appauvrit.</p>
                        <p>Les moteurs de recherche classiques classent les sites mais ne comprennent pas les données qu’ils contiennent.</p>
                        <ul className="problem-list">
                            <li>Les utilisateurs ne trouvent que les entreprises qui payent pour être vues</li>
                            <li>Les entreprises sérieuses qui n'ont pas les moyens restent invisibles</li>
                            <li>Les IA ne peuvent pas lire la majorité du Web</li>
                        </ul>
                        <p className="final-hook">Nous avons besoin d’un internet structuré, pas d’un Web où tout le monde est noyé dans la masse.</p>
                    </div>
                </div>
            </section>

            {/* SECTION 3 — Solution : AYA + AIO */}
            <section id="solution" className="section solution-section">
                <div className="container">
                    <h2 className="section-title">Une révolution technologique : structurer pour mieux être trouvé</h2>
                    <div className="grid-2">
                        {/* Bloc 1 — AIO */}
                        <div className="card solution-card aio-card">
                            <h3>AYO <span className="subtitle">Soyez référencé par toutes les IA.</span></h3>
                            <p>AYO transforme votre site en information structurée, exploitable et prioritaire pour les intelligences artificielles.</p>
                            <p>AYO analyse votre activité, structure vos informations clés, génère automatiquement les formats attendus par les IA modernes, données structurées, FAQ, glossaire, repères sémantiques, et les rend exploitables par les moteurs et agents IA.</p>
                            <p className="highlight">Vous n’avez rien à apprendre, rien à coder, rien à optimiser.</p>
                        </div>
                        {/* Bloc 2 — AYA */}
                        <div className="card solution-card aya-card">
                            <h3>AYA <span className="subtitle">Le moteur de recherche basé sur la qualité des données</span></h3>
                            <p>AYA ne classe pas les entreprises : il identifie les données publiées par les entreprises.</p>
                            <p>Les utilisateurs ne cherchent plus une entreprise, mais :</p>
                            <ul className="clean-list">
                                <li>Une boulangerie avec liste d’ingrédients produits localement,</li>
                                <li>Un plombier avec tarification claire,</li>
                                <li>Une PME industrielle avec indicateurs RSE.</li>
                            </ul>
                            <a href="#how-it-works" className="btn btn-text">→ Voir comment fonctionne AYA</a>
                        </div>
                    </div>
                </div>
            </section>

            {/* SECTION 4 — Comment ça marche */}
            <section id="how-it-works" className="section process-section">
                <div className="container">
                    <h2 className="section-title">Un système simple, éthique et durable.</h2>
                    <div className="process-steps">
                        <div className="step">
                            <span className="step-number">01</span>
                            <h4>Scan du Web</h4>
                            <p>AYA repère les entreprises qui disposent déjà de données lisibles.</p>
                        </div>
                        <div className="step">
                            <span className="step-number">02</span>
                            <h4>Analyse AYO</h4>
                            <p>AYO (AIO - Artificial Intelligence Optimization) cartographie les types de données : produits, tarifs, FAQ, glossaire, RSE, JSON-LD…</p>
                        </div>
                        <div className="step">
                            <span className="step-number">03</span>
                            <h4>Index AYA</h4>
                            <p>L’entreprise ne reçoit aucun classement. Seulement un profil documentaire : données présentes / données manquantes.</p>
                        </div>
                        <div className="step">
                            <span className="step-number">04</span>
                            <h4>Recherche par type</h4>
                            <p>L’utilisateur filtre par typologie de données, jamais par “meilleur”.</p>
                        </div>
                        <div className="step">
                            <span className="step-number">05</span>
                            <h4>Équité totale</h4>
                            <p>Si plusieurs entreprises ont une qualité identique → la 1ère place est aléatoire.</p>
                        </div>
                        <div className="step">
                            <span className="step-number">06</span>
                            <h4>Amélioration AIO</h4>
                            <p>Les entreprises moins structurées peuvent faire appel à AYO pour devenir lisibles.</p>
                        </div>
                    </div>
                </div>
            </section>

            {/* SECTION 5 — Pourquoi c'est durable ? */}
            <section id="sustainability" className="section sustainability-section">
                <div className="container">
                    <h2 className="section-title">Un Web plus clair, moins énergivore, plus juste.</h2>
                    <div className="grid-4">
                        <div className="feature-block">
                            <h4>Moins de bruit</h4>
                            <p>AYA et AYO (AIO) réduisent la création inutile de contenu. Ils mettent en valeur l’existant, structuré proprement.</p>
                        </div>
                        <div className="feature-block">
                            <h4>Plus de lisibilité</h4>
                            <p>Les IA savent mieux lire les données bien structurées et les humains comprennent mieux les données des entreprises.</p>
                        </div>
                        <div className="feature-block">
                            <h4>Équité systémique</h4>
                            <p>À qualité égale, chaque entreprise a la même probabilité d’apparaître.</p>
                        </div>
                        <div className="feature-block">
                            <h4>Durabilité numérique</h4>
                            <p>Moins d’indexation lourde. Moins de calcul superflu. Moins de duplication.</p>
                        </div>
                    </div>
                </div>
            </section>

            {/* SECTION 6 — Pour qui ? */}
            <section id="target" className="section target-section">
                <div className="container">
                    <h2 className="section-title">Pour les organisations qui veulent être visible et comprises.</h2>
                    <div className="target-grid">
                        <span className="target-badge">Artisans & commerces locaux</span>
                        <span className="target-badge">PME de services</span>
                        <span className="target-badge">Indépendants & consultants</span>
                        <span className="target-badge">Associations & collectifs</span>
                        <span className="target-badge">Entreprises industrielles</span>
                        <span className="target-badge">Acteurs engagés RSE / ESG</span>
                        <span className="target-badge">Établissements publics</span>
                    </div>
                    <p className="target-text">AYA et AYO (AIO) ne favorisent pas les grandes entreprises : le critère de visibilité est la qualité de vos données, pas la taille de votre budget.</p>
                </div>
            </section>

            {/* SECTION 7 — Tarification */}
            <section id="pricing" className="section pricing-section">
                <div className="container">
                    <h2 className="section-title">Accessible, équitable, sans engagement.</h2>
                    <div className="grid-3 pricing-grid">
                        {/* Bloc AIO */}
                        <div className="card pricing-card featured">
                            <h3>AIO <br /><span className="card-subtitle">Structuration IA-Ready</span></h3>
                            <div className="price">À partir de 99 CHF</div>
                            <p className="price-details">Par page essentielle : Accueil, Services, Produits, À propos, Contact, RSE.</p>
                        </div>
                        {/* Bloc AYA */}
                        <div className="card pricing-card">
                            <h3>AYA <br /><span className="card-subtitle">Indexation gratuite</span></h3>
                            <div className="price">Gratuit</div>
                            <p className="price-details">Votre entreprise est ajoutée automatiquement dès que vos données sont lisibles.</p>
                        </div>
                        {/* AYA Enterprise */}
                        <div className="card pricing-card">
                            <h3>AYA Enterprise <br /><span className="card-subtitle">Solutions avancées</span></h3>
                            <div className="price">490 CHF / an</div>
                            <p className="price-details">Pour les organisations qui veulent des mises à jour automatiques, API, synchro CRM, etc.</p>
                        </div>
                    </div>
                </div>
            </section>

            {/* SECTION AYO TRIGGER */}
            <section id="ayo-trigger" className="section ayo-trigger-section" style={{ textAlign: "center", padding: "60px 20px" }}>
                <div className="container">
                    <h2 className="section-title">Passez à l'action immédiate.</h2>
                    <p className="section-subtitle">Analysez votre entreprise gratuitement et obtenez votre plan d'action.</p>
                    <button id="open-ayo-chat-central" className="btn btn-primary" style={{ fontSize: "1.2rem", padding: "15px 30px" }}>
                        → Analyser mon entreprise avec AYO
                    </button>
                </div>
            </section>

            {/* SECTION 8 — Démo / Exemple */}
            <section id="demo" className="section demo-section">
                <div className="container">
                    <h2 className="section-title">À quoi ressemble une entreprise lisible ?</h2>
                    <div className="grid-3">
                        {/* Boulangerie */}
                        <div className="card demo-card">
                            <h4>🍞 Boulangerie Locale</h4>
                            <div className="subtitle">Commerce de proximité</div>
                            <ul className="readable-list">
                                <li><strong>Identité</strong> Nom, horaires, localisation, contact</li>
                                <li><strong>Offre</strong> Fiches produits (Ingrédients, Allergènes, Prix)</li>
                                <li><strong>Preuves</strong> Engagements (Bio/Local), Process de fabrication</li>
                                <li><strong>Confiance</strong> Traçabilité, Sourcing, Conformité Hygiène</li>
                                <li><strong>Technique</strong> JSON-LD (LocalBusiness), Photos structurées</li>
                            </ul>
                        </div>
                        {/* Consultant */}
                        <div className="card demo-card">
                            <h4>🧭 Consultant RSE</h4>
                            <div className="subtitle">Service B2B / Intellectuel</div>
                            <ul className="readable-list">
                                <li><strong>Identité</strong> Expertises, CV, Vision, Positionnement</li>
                                <li><strong>Offre</strong> Méthodologies, Livrables détaillés, Tarifs</li>
                                <li><strong>Confiance</strong> Méthodes documentées, Engagements formels</li>
                                <li><strong>Contenu</strong> Glossaire métier, FAQ Stratégique</li>
                                <li><strong>Technique</strong> JSON-LD (ProfessionalService)</li>
                            </ul>
                        </div>
                        {/* Industrie */}
                        <div className="card demo-card">
                            <h4>🏭 Industrie / PME</h4>
                            <div className="subtitle">Complexité technique</div>
                            <ul className="readable-list">
                                <li><strong>Identité</strong> Chaîne de valeur, Chiffres clés</li>
                                <li><strong>Produits</strong> Specs techniques, Cycle de vie, Traçabilité</li>
                                <li><strong>Indicateurs</strong> CO2, Énergie, Sécurité, Production</li>
                                <li><strong>Confiance</strong> Certifications ISO, Indicateurs vérifiables</li>
                                <li><strong>Technique</strong> JSON-LD (Product + TechSpec), Sitemaps</li>
                            </ul>
                        </div>
                    </div>
                    <div style={{ textAlign: "center", marginTop: "40px" }}>
                        <p style={{ color: "var(--text-muted)", maxWidth: "700px", margin: "0 auto", fontStyle: "italic" }}>
                            "Une entreprise lisible expose des données structurées, interconnectées et vérifiables. C'est la seule façon d'être recommandé par une IA."
                        </p>
                    </div>
                </div>
            </section>

            {/* SECTION 9 — Call to Action final */}
            <section id="cta-final" className="section cta-final-section">
                <div className="container">
                    <h2 className="section-title">Rendre Internet plus clair commence par vous.</h2>
                    <div className="cta-group">
                        <a href="#pricing" className="btn btn-primary">→ Structurer mon entreprise avec AYO</a>
                        <a href="#hero" className="btn btn-secondary">→ Explorer AYA (bêta)</a>
                    </div>
                    <p className="final-phrase">Un Web durable n’est pas un Web plus rempli. C’est un Web plus lisible.</p>
                </div>
            </section>

            {/* SECTION 10 — Footer */}
            <Footer />


            {/* THE CHATBOT WIDGET */}
            <AyoChat />

        </main >
    );
}
