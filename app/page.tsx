"use client";
import Link from 'next/link';
import Footer from './components/Footer';
import AyoChat from './components/AyoChat';

export default function Home() {
  return (
    <main>
      {/* SECTION 1 — Hero (AYO Only) */}
      <section id="hero" className="hero-section">
        <div className="container hero-content">
          <h1 className="headline">RENDEZ VOTRE ENTREPRISE VISIBLE AUX INTELLIGENCES ARTIFICIELLES</h1>
          <div className="subheadline">
            <p><strong>AYO</strong> crée la carte d'identité numérique de votre entreprise pour qu'elle soit comprise, citée et recommandée par les assistants IA (ChatGPT, Gemini, Claude).</p>
            <p className="tagline">Ne laissez pas les robots deviner qui vous êtes. Dites-le leur.</p>
          </div>
          <div className="cta-group">
            <button
              onClick={() => {
                const chatBtn = document.getElementById('ayo-toggle');
                if (chatBtn) chatBtn.click();
              }}
              className="btn btn-primary"
            >
              → Lancer mon audit IA gratuit
            </button>
          </div>
        </div>
        <div className="hero-visual">
          <div className="abstract-network"></div>
        </div>
      </section>

      {/* SECTION 2 — Le problème (Context IA) */}
      <section id="problem" className="section problem-section">
        <div className="container">
          <h2 className="section-title">Pourquoi votre site web ne suffit plus.</h2>
          <div className="text-content">
            <p>Aujourd'hui, vos futurs clients ne cherchent plus sur Google, ils posent des questions à des IA. Mais ces intelligences artificielles ne "lisent" pas votre site comme un humain : elles cherchent des données structurées.</p>
            <ul className="problem-list">
              <li>Si vos données sont floues, l'IA vous ignore par prudence.</li>
              <li>Si vos informations sont mal structurées, l'IA peut "halluciner" ou se tromper sur vos services.</li>
              <li>La majorité des entreprises sont aujourd'hui invisibles pour les assistants conversationnels.</li>
            </ul>
            <p className="final-hook">Pour être recommandé, vous ne devez plus seulement séduire les humains, vous devez convaincre les algorithmes.</p>
          </div>
        </div>
      </section>

      {/* SECTION 3 — Solution : AYO */}
      <section id="solution" className="section solution-section">
        <div className="container">
          <h2 className="section-title">AYO : La traduction technique de votre excellence.</h2>
          <div className="grid-2" style={{ display: 'flex', justifyContent: 'center' }}>
            {/* Bloc AIO Unique */}
            <div className="card solution-card aio-card" style={{ maxWidth: '800px', width: '100%' }}>
              <h3>AIO <span className="subtitle">Artificial Intelligence Optimization</span></h3>
              <p>AYO ne refait pas votre site. Il lui ajoute la couche d'intelligence nécessaire pour dialoguer avec les machines.</p>
              <div style={{ marginTop: '20px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                <div>
                  <h4 style={{ marginBottom: '10px', color: 'var(--primary-color)' }}>1. Structuration</h4>
                  <p style={{ fontSize: '0.95rem', color: 'var(--text-muted)' }}>Nous transformons vos textes (Services, Tarifs, RSE) en code sémantique (JSON-LD, ASR) que les robots consomment instantanément.</p>
                </div>
                <div>
                  <h4 style={{ marginBottom: '10px', color: 'var(--accent-color)' }}>2. Autorité</h4>
                  <p style={{ fontSize: '0.95rem', color: 'var(--text-muted)' }}>Nous créons un "Fichier Signature" unique qui prouve à l'IA que vous êtes la source officielle et fiable de l'information.</p>
                </div>
              </div>
              <p className="highlight" style={{ textAlign: 'center', marginTop: '30px', borderTop: '1px solid var(--glass-border)', paddingTop: '20px' }}>
                Résultat : Vous devenez la réponse de référence.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 4 — Comment ça marche (AYO Process) */}
      <section id="how-it-works" className="section process-section">
        <div className="container">
          <h2 className="section-title">Votre passage à l'ère artificielle en 3 étapes.</h2>
          <div className="process-steps">
            <div className="step">
              <span className="step-number">01</span>
              <h4>Diagnostic Gratuit</h4>
              <p>Notre IA (AYO Bot) scanne votre présence actuelle et simule comment ChatGPT ou Gemini vous perçoivent aujourd'hui.</p>
            </div>
            <div className="step">
              <span className="step-number">02</span>
              <h4>Structuration AIO</h4>
              <p>Nous générons les fichiers de conformité (ASR, FAQ sémantique) qui manquent à votre site.</p>
            </div>
            <div className="step">
              <span className="step-number">03</span>
              <h4>Publication & Veille</h4>
              <p>Une fois les fichiers en ligne, votre entreprise devient "IA-Ready". Nous surveillons votre lisibilité.</p>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 5 — Why Sustainable? (Adapted) */}
      <section id="sustainability" className="section sustainability-section">
        <div className="container">
          <h2 className="section-title">Moins de bruit, plus de sens.</h2>
          <div className="grid-4">
            <div className="feature-block">
              <h4>Précision</h4>
              <p>Une donnée structurée ne laisse pas de place à l'interprétation hasardeuse des robots.</p>
            </div>
            <div className="feature-block">
              <h4>Économie</h4>
              <p>Plus besoin de générer des centaines d'articles de blog pour le SEO. L'information pure suffit.</p>
            </div>
            <div className="feature-block">
              <h4>Contrôle</h4>
              <p>C'est vous qui dictez à l'IA ce qu'elle doit dire de vous, pas l'inverse.</p>
            </div>
            <div className="feature-block">
              <h4>Pérennité</h4>
              <p>Les standards sémantiques (Schema.org) sont le langage universel du web de demain.</p>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 6 — Pour qui ? */}
      <section id="target" className="section target-section">
        <div className="container">
          <h2 className="section-title">Pour les organisations qui veulent être comprises.</h2>
          <div className="target-grid">
            <span className="target-badge">Artisans & commerces locaux</span>
            <span className="target-badge">PME de services</span>
            <span className="target-badge">Indépendants & consultants</span>
            <span className="target-badge">Associations & collectifs</span>
            <span className="target-badge">Entreprises industrielles</span>
            <span className="target-badge">Acteurs engagés RSE / ESG</span>
            <span className="target-badge">Établissements publics</span>
          </div>
          <p className="target-text">L'IA ne juge pas la taille de votre budget, elle juge la qualité de vos données.</p>
        </div>
      </section>

      {/* PRICING - AYO Only */}
      <section id="pricing" className="section pricing-section">
        <div className="container">
          <h2 className="section-title">Investissez dans votre infrastructure sémantique.</h2>
          <div className="grid-3 pricing-grid" style={{}}>

            <div className="card pricing-card">
              <h3>Audit AYO <br /><span className="card-subtitle">Diagnostic de visibilité</span></h3>
              <div className="price">Gratuit</div>
              <p className="price-details">Testez comment les IA vous voient aujourd'hui. Rapport immédiat via notre Chatbot.</p>
              <div style={{ marginTop: 'auto', paddingTop: '20px' }}>
                <button
                  onClick={() => {
                    const chatBtn = document.getElementById('ayo-toggle');
                    if (chatBtn) chatBtn.click();
                  }}
                  className="btn btn-secondary"
                  style={{ width: '100%' }}
                >Lancer l'audit</button>
              </div>
            </div>

            <div className="card pricing-card featured">
              <h3>Pack AIO Essential <br /><span className="card-subtitle">Mise aux normes IA</span></h3>
              <div className="price">99 CHF</div>
              <p className="price-details">Génération de votre ASR (Carte d'identité IA) + JSON-LD complet. <br />Signature cryptographique incluse.</p>
              <div style={{ marginTop: 'auto', paddingTop: '20px' }}>
                <button
                  onClick={() => {
                    const chatBtn = document.getElementById('ayo-toggle');
                    if (chatBtn) chatBtn.click();
                  }}
                  className="btn btn-primary"
                  style={{ width: '100%' }}
                >Vérifier mon éligibilité</button>
              </div>
            </div>

            <div className="card pricing-card">
              <h3>Pack AIO Pro <br /><span className="card-subtitle">Expertise & Sémantique</span></h3>
              <div className="price">Sur devis</div>
              <p className="price-details">Pour les sites complexes : Glossaire métier, FAQ structurée, Architecture de données avancée.</p>
              <div style={{ marginTop: 'auto', paddingTop: '20px' }}>
                <a href="mailto:contact@ai-visionary.com" className="btn btn-secondary" style={{ width: '100%', display: 'inline-block' }}>Nous contacter</a>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* AYO TRIGGER */}
      <section id="ayo-trigger" className="section ayo-trigger-section" style={{ textAlign: "center", padding: "60px 20px" }}>
        <div className="container">
          <h2 className="section-title">Testez votre lisibilité IA maintenant.</h2>
          <p className="section-subtitle">C'est gratuit, immédiat et sans engagement.</p>
          <button id="open-ayo-chat-central" className="btn btn-primary" style={{ fontSize: "1.2rem", padding: "15px 30px" }}>
            → Démarrer l'audit AYO
          </button>
        </div>
      </section>

      {/* DEMO - Modified slightly to reflect "Business Ready for AI" */}
      <section id="demo" className="section demo-section">
        <div className="container">
          <h2 className="section-title"> Exemple : Ce que l'IA verra de vous après AYO</h2>
          <div className="grid-3">
            {/* Boulangerie */}
            <div className="card demo-card">
              <h4>🍞 Commerce Local</h4>
              <div className="subtitle">La boulangerie de demain</div>
              <ul className="readable-list">
                <li><strong>Avant</strong> "Une bonne baguette traditionnelle..." (Texte)</li>
                <li><strong>Après AYO</strong> productID: "Baguette", price: "1.20", currency: "EUR" (Donnée)</li>
                <li><strong>Résultat</strong> Siri/Google peut répondre "Où acheter une baguette à 1.20€ ?"</li>
              </ul>
            </div>
            {/* Consultant */}
            <div className="card demo-card">
              <h4>🧭 Consultant</h4>
              <div className="subtitle">L'expert identifiable</div>
              <ul className="readable-list">
                <li><strong>Avant</strong> "J'aide les entreprises à changer..." (Vague)</li>
                <li><strong>Après AYO</strong> serviceType: "ChangeManagement", areaServed: "Remote"</li>
                <li><strong>Résultat</strong> ChatGPT cite votre nom pour "Expert conduite du changement à distance"</li>
              </ul>
            </div>
            {/* Industrie */}
            <div className="card demo-card">
              <h4>🏭 Industrie</h4>
              <div className="subtitle">La technicité précise</div>
              <ul className="readable-list">
                <li><strong>Avant</strong> PDF techniques illisibles par les bots.</li>
                <li><strong>Après AYO</strong> TechSpec en JSON-LD, Certifications validées.</li>
                <li><strong>Résultat</strong> Les IA d'ingénierie intègrent vos produits dans leurs recommandations.</li>
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

      {/* CTA Final */}
      <section id="cta-final" className="section cta-final-section">
        <div className="container">
          <h2 className="section-title">Entrez dans la base de connaissance des IA.</h2>
          <div className="cta-group">
            <button
              onClick={() => {
                const chatBtn = document.getElementById('ayo-toggle');
                if (chatBtn) chatBtn.click();
              }}
              className="btn btn-primary"
            >→ Optimiser mon entreprise</button>
          </div>
          <p className="final-phrase">Ne soyez plus une simple URL. Devenez une Entité Nommée.</p>
        </div>
      </section>

      <Footer />
      <AyoChat />
    </main>
  );
}
