"use client";
import Link from 'next/link';
import { Suspense } from 'react';
import Footer from './components/Footer';
// AyoChat widget REMOVED from Home Page.
import PaymentHandler from './components/PaymentHandler';

export default function Home() {
  return (
    <main>
      <Suspense fallback={null}>
        <PaymentHandler />
      </Suspense>
      {/* SECTION 1 — Hero */}
      <section id="hero" className="hero-section">
        <div className="container hero-content">
          <div className="logo-container" style={{ marginBottom: '40px', textAlign: 'center' }}>
            <img
              src="/logo-v2.png"
              alt="AI VISIONARY"
              className="logo-tinted"
              style={{ height: '180px', width: 'auto', margin: '0 auto' }}
            />
          </div>
          <h1 className="headline">Aujourd’hui, vos clients passent par des IA pour chercher des professionnels.</h1>
          <div className="subheadline">
            <p>Si votre site n’est pas correctement documenté pour les IA, vous n’êtes pas recommandé par ChatGPT, Gemini, Claude, etc.</p>
            <p className="tagline">Ne laissez pas les IA deviner à partir d’informations incomplètes. Optimisez votre site pour les IA.</p>
          </div>
          <div className="cta-group">
            <Link href="/diagnostic" className="btn btn-primary">
              → Vérifier si mon site est correctement documenté
            </Link>
          </div>
        </div>
        <div className="hero-visual">
          <div className="abstract-network"></div>
        </div>
      </section>

      {/* SECTION 2 — Le problème */}
      <section id="problem" className="section problem-section">
        <div className="container">
          <div className="grid-2" style={{ alignItems: 'start' }}>

            {/* Left Column: Context */}
            <div className="problem-intro">
              <h2 className="section-title" style={{ textAlign: 'left', marginBottom: '20px' }}>Pourquoi votre site web ne suffit plus.</h2>
              <p style={{ fontSize: '1.25rem', color: 'var(--primary-color)', fontWeight: 'bold', marginBottom: '20px', lineHeight: '1.4' }}>
                "Les IA cherchent des professionnels à la place des moteurs de recherche."
              </p>
              <p style={{ fontSize: '1.1rem', color: 'var(--text-body)', lineHeight: '1.6' }}>
                Elles ne montrent que les entreprises qu’elles peuvent identifier sans ambiguïté. <br />
                <span style={{ fontWeight: '600' }}>AYO permet à votre entreprise de rester visible dans ce nouveau monde.</span>
              </p>
            </div>

            {/* Right Column: Key Pain Points (Cards) */}
            <div className="problem-cards" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div className="card" style={{ padding: '20px', borderLeft: '4px solid var(--accent-color)' }}>
                <h4 style={{ color: 'var(--text-main)', marginBottom: '5px' }}>Information Incomplète</h4>
                <p style={{ color: 'var(--text-muted)' }}>Si les informations de votre site sont dispersées, les IA évitent de vous recommander.</p>
              </div>

              <div className="card" style={{ padding: '20px', borderLeft: '4px solid var(--accent-secondary)' }}>
                <h4 style={{ color: 'var(--text-main)', marginBottom: '5px' }}>Risque d'Hallucination</h4>
                <p style={{ color: 'var(--text-muted)' }}>Mal documentés, vos services peuvent être mal interprétés par les modèles.</p>
              </div>

              <div className="card" style={{ padding: '20px', borderLeft: '4px solid var(--text-muted)' }}>
                <h4 style={{ color: 'var(--text-main)', marginBottom: '5px' }}>Invisibilité Totale</h4>
                <p style={{ color: 'var(--text-muted)' }}>La majorité des entreprises sont aujourd'hui invisibles pour les assistants conversationnels.</p>
              </div>
            </div>

          </div>

          {/* Bottom Hook */}
          <div style={{ marginTop: '50px', textAlign: 'center', maxWidth: '800px', margin: '50px auto 0' }}>
            <p className="final-hook" style={{ fontSize: '1.2rem', fontWeight: '500' }}>
              Pour être recommandé, vous ne devez plus seulement séduire les humains, <br /> vous devez convaincre les algorithmes. <br />
              <strong style={{ color: 'var(--text-main)' }}>AYO crée pour vous les fichiers nécessaires pour que votre activité <br /> soit clairement identifiée par les IA.</strong>
            </p>
          </div>
        </div>
      </section>

      {/* SECTION 2.5 — Comparatif */}
      <section id="comparison" className="section comparison-section" style={{ background: 'var(--bg-subtle)' }}>
        <div className="container">
          <h2 className="section-title" style={{ textAlign: 'center' }}>CE QUI A CHANGÉ AVEC LES IA <br /><span style={{ display: 'block', fontSize: '1.5rem', color: 'var(--text-muted)', fontWeight: '400', marginTop: '10px' }}>(ET QUE LE SEO NE COUVRE PAS)</span></h2>

          <div className="comparison-grid" style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
            gap: '2rem',
            marginTop: '3rem',
            marginBottom: '3rem'
          }}>
            {/* Avant */}
            <div className="col-avant" style={{ opacity: 0.8 }}>
              <h3 style={{ borderBottom: '1px solid var(--border-light)', paddingBottom: '10px', marginBottom: '20px' }}>AVANT <span style={{ fontSize: '0.8em', fontWeight: 'normal' }}>(Web Traditionnel)</span></h3>
              <ul style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <li style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>Google indexe des pages <span style={{ color: 'var(--text-muted)' }}>→</span></li>
                <li style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>Le texte suffisait <span style={{ color: 'var(--text-muted)' }}>→</span></li>
                <li style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>Le marketing aidait <span style={{ color: 'var(--text-muted)' }}>→</span></li>
                <li style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>Être trouvé <span style={{ color: 'var(--text-muted)' }}>→</span></li>
              </ul>
            </div>

            {/* Maintenant */}
            <div className="col-maintenant">
              <h3 style={{ borderBottom: '1px solid var(--primary-color)', paddingBottom: '10px', marginBottom: '20px', color: 'var(--primary-color)' }}>MAINTENANT <span style={{ fontSize: '0.8em', fontWeight: 'normal', color: 'var(--text-muted)' }}>(Web IA)</span></h3>
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

      {/* TRIGGER (Moved Up) */}
      <section id="ayo-trigger" className="section ayo-trigger-section" style={{ textAlign: "center", padding: "60px 20px" }}>
        <div className="container">
          <h2 className="section-title">Testez votre lisibilité IA maintenant.</h2>
          <p className="section-subtitle">C'est gratuit, immédiat et sans engagement.</p>
          <Link href="/diagnostic" className="btn btn-primary" style={{ fontSize: "1.2rem", padding: "15px 30px" }}>
            → Démarrer l'audit AYO
          </Link>
        </div>
      </section>

      {/* SECTION 3 — Solution */}
      <section id="solution" className="section solution-section">
        <div className="container">
          <h2 className="section-title" style={{ textAlign: 'center', fontSize: '1.5rem', lineHeight: '1.4', maxWidth: '900px', margin: '0 auto 40px auto' }}>AYO structure les informations essentielles de votre activité pour qu’elles soient exploitables par les IA.</h2>
          <div className="grid-2" style={{ display: 'flex', justifyContent: 'center' }}>
            {/* Bloc AIO Unique */}
            <div className="card solution-card aio-card" style={{ maxWidth: '800px', width: '100%' }}>
              <h3>AIO / ASR <span className="subtitle">L'infrastructure de visibilité</span></h3>
              <p>AYO n’ajoute pas du marketing. Il ajoute les informations manquantes pour que les IA puissent vous recommander.</p>

              <div style={{ margin: '30px 0', padding: '20px', background: 'rgba(37, 99, 235, 0.05)', borderRadius: '12px', border: '1px solid rgba(37, 99, 235, 0.1)' }}>
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
              <p className="highlight" style={{ textAlign: 'center', marginTop: '30px', borderTop: '1px solid var(--border-light)', paddingTop: '20px' }}>
                Résultat : votre activité peut être prise en compte et recommandée par les IA.
              </p>
            </div>
          </div>
          <div style={{ textAlign: "center", marginTop: "40px", maxWidth: "800px", margin: "40px auto 0" }}>
            <p style={{ fontSize: "1.4rem", fontWeight: "bold", lineHeight: "1.4", color: 'var(--text-main)' }}>
              "Si une IA ne dispose pas d’informations suffisantes sur votre activité, <br />
              elle vous écarte sans vous comparer. <br />
              AYO corrige ça."
            </p>
          </div>
        </div>
      </section>

      {/* TARGET */}
      <section id="target" className="section target-section" style={{ textAlign: "center" }}>
        <div className="container">
          <h2 className="section-title">Pour les entreprises, artisans et indépendants qui ne veulent pas être écartés par les IA.</h2>
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

      {/* PRICING */}
      <section id="pricing" className="section pricing-section">
        <div className="container" style={{ textAlign: "center" }}>
          <h2 className="section-title" style={{ fontSize: "2.5rem" }}>Investissez dans votre infrastructure sémantique.</h2>
          <div className="grid-3 pricing-grid">

            <div className="card pricing-card">
              <h3>AIO Light <br /><span className="card-subtitle">Diagnostic de visibilité</span></h3>
              <div className="price">Gratuit</div>
              <p className="price-details">Analyse détaillée + Génération de votre ASR (Carte d'identité IA)</p>
              <div style={{ marginTop: 'auto', paddingTop: '20px' }}>
                <Link href="/diagnostic?pack=light" className="btn btn-secondary w-full" style={{ width: '100%' }}>
                  Lancer l'audit
                </Link>
              </div>
            </div>

            <div className="card pricing-card featured">
              <h3>Pack AIO Essential <br /><span className="card-subtitle">Mise aux normes IA</span></h3>
              <div className="price">99 CHF</div>
              <p className="price-details">Génération de votre ASR (Carte d'identité IA) + JSON-LD complet. <br />Signature cryptographique incluse.</p>
              <div style={{ marginTop: 'auto', paddingTop: '20px' }}>
                <Link href="/diagnostic?pack=essential" className="btn btn-primary w-full" style={{ width: '100%' }}>
                  Analyser mon site
                </Link>
              </div>
            </div>

            <div className="card pricing-card">
              <h3>Pack AIO Pro <br /><span className="card-subtitle">Expertise & Sémantique</span></h3>

              <div className="price">499 CHF</div>
              <p className="price-details">Génération de votre ASR (Carte d'identité IA) + JSON-LD complet. Signature cryptographique incluse. <br /><br /><strong>+ La couche de confiance totale pour les IA. Glossaire, FAQ Structurée, Architecture & Manifest.</strong></p>
              <div style={{ marginTop: 'auto', paddingTop: '20px' }}>
                <Link href="/diagnostic?pack=pro" className="btn btn-secondary w-full" style={{ width: '100%' }}>
                  Analyser mon site
                </Link>
              </div>
            </div>
          </div>

        </div>
      </section>


      {/* CTA Final */}
      <section id="cta-final" className="section cta-final-section" style={{ textAlign: "center" }}>
        <div className="container">
          <h2 className="section-title" style={{ fontSize: "2rem" }}>Entrez dans la base de connaissance des IA.</h2>
          <div className="cta-group" style={{ display: 'flex', justifyContent: 'center', marginBottom: '20px' }}>
            <Link href="/diagnostic" className="btn btn-primary">
              → Optimiser mon entreprise
            </Link>
          </div>
          <p className="final-phrase">Ne soyez plus une simple URL. Devenez visible par les IA.</p>
        </div>
      </section>

      <Footer />
    </main >
  );
}
