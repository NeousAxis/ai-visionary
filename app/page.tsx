"use client";
import Link from 'next/link';
import { Suspense } from 'react';
import Footer from './components/Footer';
import AyoChat from './components/AyoChat';
import PaymentHandler from './components/PaymentHandler';

export default function Home() {
  return (
    <main>
      <Suspense fallback={null}>
        <PaymentHandler />
      </Suspense>
      {/* SECTION 1 — Hero (AYO Only) */}
      <section id="hero" className="hero-section">
        <div className="container hero-content">
          <div className="logo-container" style={{ marginBottom: '40px', textAlign: 'center' }}>
            <img src="/logo.png" alt="AI VISIONARY" style={{ height: '180px', width: 'auto', margin: '0 auto' }} />
          </div>
          <h1 className="headline">Aujourd’hui, vos clients passent par des IA pour chercher des professionnels.</h1>
          <div className="subheadline">
            <p>Si votre site n’est pas correctement documenté pour les IA, vous n’êtes pas recommandé par ChatGPT, Gemini, Claude, etc.</p>
            <p className="tagline">Ne laissez pas les IA deviner à partir d’informations incomplètes. Optimisez votre site pour les IA.</p>
          </div>
          <div className="cta-group">
            <button
              onClick={() => {
                const chatBtn = document.getElementById('ayo-toggle');
                if (chatBtn) chatBtn.click();
              }}
              className="btn btn-primary"
            >
              → Vérifier si mon site est correctement documenté
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
              "Les IA cherchent de plus en plus des professionnels à la place des moteurs de recherche.<br />
              Elles ne montrent que les entreprises qu’elles peuvent identifier sans ambiguïté.<br />
              <strong style={{ color: 'var(--primary-color)' }}>AYO structure votre entreprise pour qu’elle reste visible dans ce nouveau monde.</strong>"
            </p>
            <ul className="problem-list">
              <li>Si les informations de votre site sont incomplètes ou dispersées, les IA évitent de vous recommander.</li>
              <li>Si elles sont mal documentées, elles peuvent se tromper sur vos services.</li>
              <li>La majorité des entreprises sont aujourd'hui invisibles pour les assistants conversationnels.</li>
            </ul>
            <p className="final-hook">Pour être recommandé, vous ne devez plus seulement séduire les humains, vous devez convaincre les algorithmes. <br /><strong>AYO crée les fichiers nécessaires pour que votre activité soit clairement identifiée par les IA.</strong></p>
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
            <p style={{ fontSize: '1.3rem', fontWeight: 'bold', color: 'var(--text-main)' }}>👉 Les mots clés ne vous rendront pas plus visible, désormais c'est la structure de vos informations qui vous rend "appréciable" pour les IA.</p>
          </div>
        </div>
      </section>

      {/* SECTION 3 — Solution : AYO */}
      <section id="solution" className="section solution-section">
        <div className="container">
          <h2 className="section-title">AYO structure les informations essentielles de votre activité pour qu’elles soient exploitables par les IA.</h2>
          <div className="grid-2" style={{ display: 'flex', justifyContent: 'center' }}>
            {/* Bloc AIO Unique */}
            <div className="card solution-card aio-card" style={{ maxWidth: '800px', width: '100%' }}>
              <h3>AIO / ASR <span className="subtitle">L'infrastructure de visibilité</span></h3>
              <p>AYO n’ajoute pas du marketing. Il ajoute les informations manquantes pour que les IA puissent vous recommander.</p>

              <div style={{ margin: '30px 0', padding: '20px', background: 'rgba(139, 92, 246, 0.1)', borderRadius: '12px', border: '1px solid rgba(139, 92, 246, 0.2)' }}>
                <p style={{ fontSize: '1.1rem', fontWeight: 'bold', marginBottom: '10px', color: 'var(--text-main)' }}>
                  AIO (Artificial Intelligence Optimization) : L'art de structurer l'information.
                </p>
                <p style={{ fontStyle: 'italic', color: 'var(--text-muted)' }}>
                  "Un ASR (AYO Singular Record) est une déclaration canonique, unique et structurée d’une entité, destinée à être lue, interprétée et utilisée par des IA sans ambiguïté ni extrapolation."
                </p>
              </div>
              <div style={{ marginTop: '20px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                <div>
                  <h4 style={{ marginBottom: '10px', color: 'var(--primary-color)' }}>1. Structuration</h4>
                  <p style={{ fontSize: '0.95rem', color: 'var(--text-muted)' }}>Nous transformons vos textes (Services, Tarifs, RSE) en code sémantique (JSON-LD, ASR) que les robots consultent instantanément.</p>
                </div>
                <div>
                  <h4 style={{ marginBottom: '10px', color: 'var(--accent-color)' }}>2. Autorité</h4>
                  <p style={{ fontSize: '0.95rem', color: 'var(--text-muted)' }}>Nous créons un "Fichier Signature" unique qui prouve à l'IA que vous êtes la source officielle et fiable de l'information.</p>
                </div>
              </div>
              <p className="highlight" style={{ textAlign: 'center', marginTop: '30px', borderTop: '1px solid var(--glass-border)', paddingTop: '20px' }}>
                Résultat : votre activité peut être prise en compte et recommandée par les IA.
              </p>
            </div>
          </div>
          <div style={{ textAlign: "center", marginTop: "40px", maxWidth: "800px", margin: "40px auto 0" }}>
            <p style={{ fontSize: "1.4rem", fontWeight: "bold", lineHeight: "1.4" }}>
              "Si une IA ne dispose pas d’informations suffisantes sur votre activité, <br />
              <span style={{ color: "#ef4444" }}>elle vous écarte sans vous comparer.</span> <br />
              <span style={{ color: "#ef4444" }}>AYO corrige ça.</span>"
            </p>
          </div>
        </div>
      </section>

      {/* ... (How it works stays same) ... */}

      {/* ... (Sustainability stays same) ... */}

      {/* SECTION 6 — Pour qui ? */}
      <section id="target" className="section target-section">
        <div className="container">
          <h2 className="section-title">Pour les entreprises, artisans et indépendants qui ne veulent pas être écartés par les IA.</h2>
          <div className="target-grid">
            {/* ... (Badges stay same) ... */}
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
                >Analyser mon site</button>
              </div>
            </div>

            <div className="card pricing-card">
              <h3>Pack AIO Pro <br /><span className="card-subtitle">Expertise & Sémantique</span></h3>
              <div className="price">499 CHF</div>
              <p className="price-details">La couche de confiance totale pour les IA. Glossaire, FAQ Structurée, Architecture & Manifest.</p>
              <div style={{ marginTop: 'auto', paddingTop: '20px' }}>
                <button
                  onClick={() => {
                    const chatBtn = document.getElementById('ayo-toggle');
                    if (chatBtn) chatBtn.click();
                  }}
                  className="btn btn-secondary"
                  style={{ width: '100%' }}
                >Analyser mon site</button>
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
          <p className="final-phrase">Ne soyez plus une simple URL. Devenez visible par les IA.</p>
        </div>
      </section>

      <Footer />
      <AyoChat />
    </main >
  );
}
