"use client";
import Link from 'next/link';
import { Suspense } from 'react';
import Footer from './components/Footer';
// AyoChat widget REMOVED from Home Page.
import PaymentSuccessModal from './components/PaymentSuccessModal';

export default function Home() {
  return (
    <main>
      <Suspense fallback={null}>
        <PaymentSuccessModal />
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
          <h1 className="headline">Devenez l&apos;entreprise que l&apos;IA recommande en priorité.</h1>
          <div className="subheadline">
            <p>Rendez votre entreprise visible pour les millions d&apos;utilisateurs qui posent des questions à l&apos;IA chaque jour (ChatGPT, Gemini, Claude, Mistral, Llama, Ernie...).</p>
            <p className="tagline">Ne laissez pas les IA deviner qui vous êtes. Prenez le contrôle de votre recommandation.</p>
          </div>
          <div className="cta-group" style={{ display: 'flex', gap: '15px', justifyContent: 'center', flexWrap: 'wrap', marginTop: '30px' }}>
            <Link href="/diagnostic" className="btn btn-primary" style={{ boxShadow: '0 4px 14px rgba(0,0,0,0.1)' }}>
              → Vérifier si mon site est correctement documenté
            </Link>
            <Link href="/aya" className="btn" style={{ background: 'transparent', border: '2px solid #e2e8f0', color: '#334155', fontWeight: '600', padding: '12px 24px', borderRadius: '8px', transition: 'all 0.2s' }}>
              🔍 Explorer le Registre AYA
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
                &quot;Les IA cherchent des professionnels à la place des moteurs de recherche.&quot;
              </p>
              <p style={{ fontSize: '1.1rem', color: 'var(--text-body)', lineHeight: '1.6' }}>
                Elles ne montrent que les entreprises qu&apos;elles peuvent identifier sans ambiguïté. <br />
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
                <h4 style={{ color: 'var(--text-main)', marginBottom: '5px' }}>Risque d&apos;Hallucination</h4>
                <p style={{ color: 'var(--text-muted)' }}>Mal documentés, vos services peuvent être mal interprétés par les modèles.</p>
              </div>

              <div className="card" style={{ padding: '20px', borderLeft: '4px solid var(--text-muted)' }}>
                <h4 style={{ color: 'var(--text-main)', marginBottom: '5px' }}>Invisibilité Totale</h4>
                <p style={{ color: 'var(--text-muted)' }}>La majorité des entreprises sont aujourd&apos;hui invisibles pour les assistants conversationnels.</p>
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
            <p style={{ fontSize: '1.3rem', fontWeight: 'bold', color: 'var(--text-main)' }}>👉 Les mots clés ne vous rendront pas plus visible, désormais c&apos;est la structure de vos informations qui vous rend &quot;appréciable&quot; pour les IA.</p>
          </div>
        </div>
      </section>

      {/* TRIGGER (Moved Up) */}
      <section id="ayo-trigger" className="section ayo-trigger-section" style={{ textAlign: "center", padding: "60px 20px" }}>
        <div className="container">
          <h2 className="section-title">Testez votre lisibilité IA maintenant.</h2>
          <p className="section-subtitle">C&apos;est gratuit, immédiat et sans engagement.</p>
          <Link href="/diagnostic" className="btn btn-primary" style={{ fontSize: "1.2rem", padding: "15px 30px" }}>
            → Démarrer l&apos;audit AYO
          </Link>
        </div>
      </section>

      {/* SECTION 3 — Solution */}
      <section id="solution" className="section solution-section">
        <div className="container">
          <h2 className="section-title" style={{ textAlign: 'center', fontSize: '1.5rem', lineHeight: '1.4', maxWidth: '900px', margin: '0 auto 40px auto' }}>AYO structure les informations essentielles de votre activité pour qu&apos;elles soient exploitables par les IA.</h2>
          <div className="grid-2" style={{ display: 'flex', justifyContent: 'center' }}>
            {/* Bloc AIO Unique */}
            <div className="card solution-card aio-card" style={{ maxWidth: '800px', width: '100%' }}>
              <h3>AIO / ASR <span className="subtitle">L&apos;infrastructure de visibilité</span></h3>
              <p>AYO n&apos;ajoute pas du marketing. Il ajoute les informations manquantes pour que les IA puissent vous recommander.</p>

              <div style={{ margin: '30px 0', padding: '20px', background: 'rgba(37, 99, 235, 0.05)', borderRadius: '12px', border: '1px solid rgba(37, 99, 235, 0.1)' }}>
                <p style={{ fontSize: '1.1rem', fontWeight: 'bold', marginBottom: '10px', color: 'var(--text-main)' }}>
                  AIO (Artificial Intelligence Optimization) : L&apos;art de structurer l&apos;information.
                </p>
                <p style={{ fontStyle: 'italic', color: 'var(--text-muted)' }}>
                  &quot;Un ASR (AI Singular Record) est une déclaration canonique, unique et structurée d&apos;une entité, destinée à être lue, interprétée et utilisée par des IA sans ambiguïté ni extrapolation.&quot;
                </p>
              </div>
              <div style={{ marginTop: '20px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                <div>
                  <h4 style={{ marginBottom: '10px', color: 'var(--primary-color)' }}>1. Structuration</h4>
                  <p style={{ fontSize: '0.95rem', color: 'var(--text-muted)' }}>Nous transformons vos textes (Services, Tarifs, RSE) en code sémantique (JSON-LD, ASR) que les robots consultent instantanément.</p>
                </div>
                <div>
                  <h4 style={{ marginBottom: '10px', color: 'var(--accent-color)' }}>2. Autorité</h4>
                  <p style={{ fontSize: '0.95rem', color: 'var(--text-muted)' }}>Nous créons un &quot;Fichier Signature&quot; unique qui prouve à l&apos;IA que vous êtes la source officielle et fiable de l&apos;information.</p>
                </div>
              </div>
              <p className="highlight" style={{ textAlign: 'center', marginTop: '30px', borderTop: '1px solid var(--border-light)', paddingTop: '20px' }}>
                Résultat : votre activité peut être prise en compte et recommandée par les IA.
              </p>
            </div>
          </div>
          <div style={{ textAlign: "center", marginTop: "40px", maxWidth: "800px", margin: "40px auto 0" }}>
            <p style={{ fontSize: "1.4rem", fontWeight: "bold", lineHeight: "1.4", color: 'var(--text-main)' }}>
              &quot;Si une IA ne dispose pas d&apos;informations suffisantes sur votre activité, <br />
              elle vous écarte sans vous comparer. <br />
              AYO corrige ça.&quot;
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
            &quot;Aujourd&apos;hui, la visibilité ne dépend plus du référencement, mais de la capacité des IA à vous identifier.<br />
            <strong>AYO prépare votre entreprise à ce nouveau filtre.</strong>&quot;
          </p>
        </div>
      </section>

      {/* AYA PRESENTATION (NEW) */}
      <section className="section aya-presentation-section" style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e3a8a 100%)', color: 'white', padding: '80px 0' }}>
        <div className="container">
          <div style={{ textAlign: 'center', marginBottom: '60px' }}>
            <span className="badge" style={{ background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8', border: '1px solid #0ea5e9', padding: '6px 18px', borderRadius: '20px', fontSize: '0.85rem', letterSpacing: '1.2px', fontWeight: 'bold', textTransform: 'uppercase' }}>
              INFRASTRUCTURE
            </span>
            <h2 style={{ fontSize: '3.5rem', fontWeight: '800', marginTop: '25px', marginBottom: '20px', color: '#ffffff', textShadow: '0 4px 15px rgba(0,0,0,0.5)', lineHeight: 1.1 }}>
              Devenez l&apos;entreprise que l&apos;IA recommande en priorité.
            </h2>
            <p style={{ fontSize: '1.3rem', color: '#e2e8f0', maxWidth: '750px', margin: '0 auto', lineHeight: '1.6', fontWeight: '500' }}>
              Rendez votre entreprise visible pour les millions d&apos;utilisateurs qui posent des questions à l&apos;IA chaque jour (ChatGPT, Gemini, Claude, Mistral, Llama, Ernie...).
            </p>
          </div>

          <div className="process-grid grid-3">
            <div className="process-step" style={{ background: 'rgba(255,255,255,0.05)', backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.1)', padding: '30px', borderRadius: '16px' }}>
              <div style={{ fontSize: '2.5rem', marginBottom: '20px' }}>🌐</div>
              <h3 style={{ color: 'white', fontSize: '1.2rem', marginBottom: '10px' }}>Connecteur Universel</h3>
              <p style={{ color: '#94a3b8', fontSize: '0.95rem', lineHeight: '1.6' }}>
                AYA <strong>héberge et diffuse</strong> votre <strong>ASR</strong> (généré par AYO) directement auprès des IAs, garantissant qu&apos;elles accèdent à votre vérité officielle en temps réel.
              </p>
            </div>

            <div className="process-step" style={{ background: 'rgba(255,255,255,0.05)', backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.1)', padding: '30px', borderRadius: '16px' }}>
              <div style={{ fontSize: '2.5rem', marginBottom: '20px' }}>🔒</div>
              <h3 style={{ color: 'white', fontSize: '1.2rem', marginBottom: '10px' }}>Signature Cryptographique</h3>
              <p style={{ color: '#94a3b8', fontSize: '0.95rem' }}>
                Chaque entité dans AYA reçoit une signature inviolable. Les IAs savent immédiatement que votre information est <strong>authentique et vérifiée</strong> (Anti-Hallucination).
              </p>
            </div>

            <div className="process-step" style={{ background: 'rgba(255,255,255,0.05)', backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.1)', padding: '30px', borderRadius: '16px' }}>
              <div style={{ fontSize: '2.5rem', marginBottom: '20px' }}>⚡️</div>
              <h3 style={{ color: 'white', fontSize: '1.2rem', marginBottom: '10px' }}>Priorité de Réponse</h3>
              <p style={{ color: '#94a3b8', fontSize: '0.95rem', lineHeight: '1.6' }}>
                Quand un utilisateur demande <em>&quot;Plombier urgence Lyon&quot;</em>, les IAs privilégient les entités structurées (horaires, localisation précise) du registre AYA plutôt que les annuaires obsolètes.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* PRICING */}
      <section id="pricing" className="section pricing-section">
        <div className="container" style={{ textAlign: "center" }}>
          <h2 className="section-title" style={{ fontSize: "2.5rem" }}>Investissez dans votre infrastructure sémantique.</h2>
          <div className="grid-2 pricing-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '30px', maxWidth: '900px', margin: '0 auto' }}>

            {/* OPTION 1 : ABONNEMENT (LOCATION VISIBILITÉ) */}
            <div className="card pricing-card featured" style={{ border: '2px solid var(--primary-color)' }}>
              <div style={{ background: 'var(--primary-color)', color: 'white', padding: '5px 10px', borderRadius: '4px', fontSize: '0.8rem', fontWeight: 'bold', display: 'inline-block', marginBottom: '10px' }}>
                RECOMMANDÉ POUR DÉMARRER
              </div>
              <h3>Abonnement AYA <br /><span className="card-subtitle">Visibilité IA-Native</span></h3>
              <div className="price">19 CHF <span style={{ fontSize: '1rem', fontWeight: 'normal' }}>/ mois</span></div>
              <p className="price-details">Activation de votre présence dans le registre AYA. Sans toucher à votre site.</p>
              <ul style={{ textAlign: 'left', marginTop: '20px', fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                <li>✅ <strong>Registre AYA Actif</strong> (Priorité IA)</li>
                <li>✅ Données hébergées par AYA</li>
                <li>✅ Recommandabilité officielle</li>
                <li>✅ Mises à jour incluses</li>
                <li>✅ Signature cryptographique</li>
              </ul>
              <div style={{ marginTop: 'auto', paddingTop: '20px' }}>
                <Link href="/diagnostic?pack=aya-sub" className="btn btn-primary w-full" style={{ width: '100%' }}>
                  S&apos;abonner (Sans engagement)
                </Link>
              </div>
            </div>

            {/* OPTION 2 : ACHAT (INVESTISSEMENT PATRIMONIAL) */}
            <div className="card pricing-card">
              <h3>Pack PRO Propriété <br /><span className="card-subtitle">Actifs Sémantiques</span></h3>

              <div className="price">499 CHF <span style={{ fontSize: '1rem', fontWeight: 'normal' }}>one-shot</span></div>
              <p className="price-details">Achat définitif de vos fichiers sources sémantiques (ASR, FAQ, Manifeste). Vous possédez votre identité digitale.</p>
              <ul style={{ textAlign: 'left', marginTop: '20px', fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                <li>✅ <strong>3 ANS de Registre AYA offerts</strong></li>
                <li>✅ Fichiers Sources complets (JSON-LD, ASR)</li>
                <li>✅ Indépendance technique totale</li>
                <li>✅ Propriété intellectuelle garantie</li>
                <li>✅ Analyse AYO exhaustive</li>
              </ul>
              <div style={{ marginTop: 'auto', paddingTop: '20px' }}>
                <Link href="/diagnostic?pack=pro" className="btn btn-secondary w-full" style={{ width: '100%' }}>
                  Acheter mes fichiers propriétaires
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
