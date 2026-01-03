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
            <p><strong>AYO</strong> crée la carte d'identité numérique de votre entreprise pour qu'elle soit recommandée par les assistants IA (ChatGPT, Gemini, Claude).</p>
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
            <p style={{ fontSize: '1.15rem', marginBottom: '1.5rem' }}>
              "Les IA répondent de plus en plus aux clients à la place des moteurs de recherche.<br />
              Elles ne montrent que les entreprises qu’elles peuvent identifier sans ambiguïté.<br />
              <strong style={{ color: 'var(--primary-color)' }}>AYO structure votre entreprise pour qu’elle reste visible dans ce nouveau monde.</strong>"
            </p>
            <ul className="problem-list">
              <li>Si vos données sont floues, l'IA vous ignore par prudence.</li>
              <li>Si vos informations sont mal structurées, l'IA peut "halluciner" ou se tromper sur vos services.</li>
              <li>La majorité des entreprises sont aujourd'hui invisibles pour les assistants conversationnels.</li>
            </ul>
            <p className="final-hook">Pour être recommandé, vous ne devez plus seulement séduire les humains, vous devez convaincre les algorithmes. <br /><strong>AYO crée une surface d’identification IA-native.</strong></p>
          </div>
        </div>
      </section>

      {/* SECTION 2.5 — Comparatif SEO vs IA */}
      <section id="comparison" className="section comparison-section" style={{ background: 'rgba(255,255,255,0.02)' }}>
        <div className="container">
          <h2 className="section-title" style={{ fontSize: '2rem' }}>CE QUI A CHANGÉ AVEC LES IA <br /><span style={{ fontSize: '1.2rem', color: 'var(--text-muted)' }}>(ET QUE LE SEO NE COUVRE PAS)</span></h2>

          <div className="comparison-grid" style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
            gap: '2rem',
            marginTop: '3rem',
            marginBottom: '3rem'
          }}>
            {/* Avant */}
            <div className="col-avant" style={{ opacity: 0.7 }}>
              <h3 style={{ borderBottom: '1px solid var(--text-muted)', paddingBottom: '10px', marginBottom: '20px' }}>AVANT <span style={{ fontSize: '0.8em', fontWeight: 'normal' }}>(Web Traditionnel)</span></h3>
              <ul style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <li style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>Google indexe des pages <span style={{ color: 'var(--text-muted)' }}>→</span></li>
                <li style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>Le texte suffisait <span style={{ color: 'var(--text-muted)' }}>→</span></li>
                <li style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>Le marketing aidait <span style={{ color: 'var(--text-muted)' }}>→</span></li>
                <li style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>Être trouvé <span style={{ color: 'var(--text-muted)' }}>→</span></li>
              </ul>
            </div>

            {/* Maintenant */}
            <div className="col-maintenant">
              <h3 style={{ borderBottom: '1px solid var(--primary-color)', paddingBottom: '10px', marginBottom: '20px', color: 'var(--primary-color)' }}>MAINTENANT <span style={{ fontSize: '0.8em', fontWeight: 'normal', color: 'white' }}>(Web IA)</span></h3>
              <ul style={{ display: 'flex', flexDirection: 'column', gap: '20px', fontWeight: 'bold' }}>
                <li style={{ color: 'var(--text-main)' }}>Les IA sélectionnent des entités</li>
                <li style={{ color: 'var(--text-main)' }}>La structure devient obligatoire</li>
                <li style={{ color: '#ef4444' }}>Le marketing brouille</li>
                <li style={{ color: 'var(--accent-color)' }}>Être retenu</li>
              </ul>
            </div>
          </div>

          <div style={{ textAlign: 'center', marginTop: '40px' }}>
            <p style={{ fontSize: '1.3rem', fontWeight: 'bold', color: 'var(--text-main)' }}>👉 La visibilité n’est plus une question d’accès, <br />mais de lisibilité.</p>
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

              <div style={{ margin: '30px 0', padding: '20px', background: 'rgba(139, 92, 246, 0.1)', borderRadius: '12px', border: '1px solid rgba(139, 92, 246, 0.2)' }}>
                <p style={{ fontSize: '1.1rem', fontWeight: 'bold', marginBottom: '10px', color: 'var(--text-main)' }}>
                  Concrètement, AYO crée une surface d’identification IA-native : l'ASR (AYO Singular Record).
                </p>
                <p style={{ fontStyle: 'italic', color: 'var(--text-muted)' }}>
                  "Un ASR est une déclaration canonique, unique et structurée d’une entité, destinée à être lue, interprétée et utilisée par des IA sans ambiguïté ni extrapolation."
                </p>
              </div>
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
          <div style={{ textAlign: "center", marginTop: "40px", maxWidth: "800px", margin: "40px auto 0" }}>
            <p style={{ fontSize: "1.4rem", fontWeight: "bold", lineHeight: "1.4" }}>
              "Si une IA ne peut pas comprendre votre entreprise, <br />
              <span style={{ color: "#ef4444" }}>elle vous écarte sans vous comparer.</span> <br />
              <span style={{ color: "var(--primary-color)" }}>AYO corrige ça.</span>"
            </p>
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
          <h2 className="section-title">Mieux structuré, plus visible.</h2>
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
          <h2 className="section-title">Pour toutes les entreprises qui veulent être comprises.</h2>
          <div className="target-grid">
            <span className="target-badge">Artisans & commerces locaux</span>
            <span className="target-badge">PME de services</span>
            <span className="target-badge">Indépendants & consultants</span>
            <span className="target-badge">Associations & collectifs</span>
            <span className="target-badge">Entreprises industrielles</span>
            <span className="target-badge">Acteurs engagés RSE / ESG</span>
            <span className="target-badge">Établissements publics</span>
          </div>
          <p className="target-text" style={{ fontSize: '1.2rem', marginTop: '30px', lineHeight: '1.6' }}>
            "Aujourd’hui, la visibilité ne dépend plus du référencement, mais de la capacité des IA à vous identifier.<br />
            <strong>AYO prépare votre entreprise à ce nouveau filtre.</strong>"
          </p>
        </div>
      </section>

      {/* PRICING - AYO Only */}
      <section id="pricing" className="section pricing-section">
        <div className="container">
          <h2 className="section-title">Investissez dans votre infrastructure sémantique.</h2>
          <div className="grid-3 pricing-grid" style={{}}>

            <div className="card pricing-card">
              <h3>AYO Light <br /><span className="card-subtitle">Diagnostic de visibilité</span></h3>
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
          <button
            id="open-ayo-chat-central"
            onClick={() => {
              const chatBtn = document.getElementById('ayo-toggle');
              if (chatBtn) chatBtn.click();
            }}
            className="btn btn-primary"
            style={{ fontSize: "1.2rem", padding: "15px 30px" }}
          >
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
                <li><strong>Avant</strong> "Notre baguette tradition est la meilleure..." (Promesse subjective)</li>
                <li><strong>Après AYO</strong> award: "Médaille d'Or", material: "Blé Local", process: "Levain Naturel"</li>
                <li><strong>Résultat</strong> L'IA valide vos preuves et vous cite pour la requête "Où trouver la meilleure baguette ?"</li>
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
