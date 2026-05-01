"use client";
import Link from 'next/link';
import { Suspense } from 'react';
import { useTranslations } from 'next-intl';
import Footer from './components/Footer';
import StatsBar from './components/StatsBar';
// AyoChat widget REMOVED from Home Page.
import PaymentSuccessModal from './components/PaymentSuccessModal';
import LanguageToggle from './components/LanguageToggle';

export default function Home() {
  const t = useTranslations('home');
  return (
    <main>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Organization",
            "name": "AI Visionary",
            "alternateName": "AYA Registry",
            "url": "https://ai-visionary.xyz",
            "logo": "https://ai-visionary.xyz/logo-v2.png",
            "description": "AYA is a public registry of 30000+ organizations rated for AI readability. Connected to ChatGPT, Claude, Gemini, Mistral, Grok, Perplexity, DeepSeek, Qwen, Llama.",
            "address": {
              "@type": "PostalAddress",
              "addressLocality": "Genève",
              "addressCountry": "CH"
            },
            "sameAs": [
              "https://github.com/NeousAxis/ai-visionary"
            ],
            "potentialAction": {
              "@type": "SearchAction",
              "target": "https://ai-visionary.xyz/api/aya/search?q={query}",
              "query-input": "required name=query"
            }
          })
        }}
      />
      <Suspense fallback={null}>
        <PaymentSuccessModal />
      </Suspense>
      {/* Language Toggle */}
      <div style={{ position: 'absolute', top: '16px', right: '24px', zIndex: 50 }}>
        <LanguageToggle />
      </div>
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
          <h1 className="headline">{t('hero.headline')}</h1>
          <div className="subheadline">
            <p>{t('hero.sub1')}</p>
            <p className="tagline">{t('hero.tagline')}</p>
          </div>
          <div className="cta-group" style={{ display: 'flex', gap: '15px', justifyContent: 'center', flexWrap: 'wrap', marginTop: '30px' }}>
            <Link href="/diagnostic" className="btn btn-primary" style={{ boxShadow: '0 4px 14px rgba(0,0,0,0.1)' }}>
              {t('hero.ctaDiagnostic')}
            </Link>
            <Link href="/aya" className="btn" style={{ background: 'transparent', border: '2px solid #e2e8f0', color: '#334155', fontWeight: '600', padding: '12px 24px', borderRadius: '8px', transition: 'all 0.2s' }}>
              {t('hero.ctaRegistry')}
            </Link>
          </div>
        </div>
        <div className="hero-visual">
          <div className="abstract-network"></div>
        </div>
      </section>

      {/* STATS BANNER */}
      <section style={{
        background: 'linear-gradient(135deg, var(--text-main) 0%, var(--primary-color) 100%)',
        padding: '40px 20px',
        textAlign: 'center',
      }}>
        <div className="container" style={{ display: 'flex', justifyContent: 'center', gap: '60px', flexWrap: 'wrap' }}>
          <StatsBar />
        </div>
      </section>

      {/* SECTION 2 — Le problème */}
      <section id="problem" className="section problem-section">
        <div className="container">
          <div className="grid-2" style={{ alignItems: 'start' }}>

            {/* Left Column: Context */}
            <div className="problem-intro">
              <h2 className="section-title" style={{ textAlign: 'left', marginBottom: '20px' }}>{t('problem.title')}</h2>
              <p style={{ fontSize: '1.25rem', color: 'var(--primary-color)', fontWeight: 'bold', marginBottom: '20px', lineHeight: '1.4' }}>
                {t('problem.quote')}
              </p>
              <p style={{ fontSize: '1.1rem', color: 'var(--text-body)', lineHeight: '1.6' }}>
                {t('problem.body')} <br />
                <span style={{ fontWeight: '600' }}>{t('problem.ayo')}</span>
              </p>
            </div>

            {/* Right Column: Key Pain Points (Cards) */}
            <div className="problem-cards" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div className="card" style={{ padding: '20px', borderLeft: '4px solid var(--accent-color)' }}>
                <h4 style={{ color: 'var(--text-main)', marginBottom: '5px' }}>{t('problem.card1Title')}</h4>
                <p style={{ color: 'var(--text-muted)' }}>{t('problem.card1Body')}</p>
              </div>

              <div className="card" style={{ padding: '20px', borderLeft: '4px solid var(--accent-secondary)' }}>
                <h4 style={{ color: 'var(--text-main)', marginBottom: '5px' }}>{t('problem.card2Title')}</h4>
                <p style={{ color: 'var(--text-muted)' }}>{t('problem.card2Body')}</p>
              </div>

              <div className="card" style={{ padding: '20px', borderLeft: '4px solid var(--text-muted)' }}>
                <h4 style={{ color: 'var(--text-main)', marginBottom: '5px' }}>{t('problem.card3Title')}</h4>
                <p style={{ color: 'var(--text-muted)' }}>{t('problem.card3Body')}</p>
              </div>
            </div>

          </div>

          {/* Bottom Hook */}
          <div style={{ marginTop: '50px', textAlign: 'center', maxWidth: '800px', margin: '50px auto 0' }}>
            <p className="final-hook" style={{ fontSize: '1.2rem', fontWeight: '500' }}>
              {t('problem.hook1')} <br /> {t('problem.hook2')} <br />
              <strong style={{ color: 'var(--text-main)' }}>{t('problem.hook3')}</strong>
            </p>
          </div>
        </div>
      </section>

      {/* SECTION 2.5 — Comparatif */}
      <section id="comparison" className="section comparison-section" style={{ background: 'var(--bg-subtle)' }}>
        <div className="container">
          <h2 className="section-title" style={{ textAlign: 'center' }}>{t('comparison.title')} <br /><span style={{ display: 'block', fontSize: '1.5rem', color: 'var(--text-muted)', fontWeight: '400', marginTop: '10px' }}>{t('comparison.subtitle')}</span></h2>

          <div className="comparison-grid" style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
            gap: '2rem',
            marginTop: '3rem',
            marginBottom: '3rem'
          }}>
            {/* Avant */}
            <div className="col-avant" style={{ opacity: 0.8 }}>
              <h3 style={{ borderBottom: '1px solid var(--border-light)', paddingBottom: '10px', marginBottom: '20px' }}>{t('comparison.before')} <span style={{ fontSize: '0.8em', fontWeight: 'normal' }}>{t('comparison.beforeSub')}</span></h3>
              <ul style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <li style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>{t('comparison.b1')} <span style={{ color: 'var(--text-muted)' }}>&rarr;</span></li>
                <li style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>{t('comparison.b2')} <span style={{ color: 'var(--text-muted)' }}>&rarr;</span></li>
                <li style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>{t('comparison.b3')} <span style={{ color: 'var(--text-muted)' }}>&rarr;</span></li>
                <li style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>{t('comparison.b4')} <span style={{ color: 'var(--text-muted)' }}>&rarr;</span></li>
              </ul>
            </div>

            {/* Maintenant */}
            <div className="col-maintenant">
              <h3 style={{ borderBottom: '1px solid var(--primary-color)', paddingBottom: '10px', marginBottom: '20px', color: 'var(--primary-color)' }}>{t('comparison.now')} <span style={{ fontSize: '0.8em', fontWeight: 'normal', color: 'var(--text-muted)' }}>{t('comparison.nowSub')}</span></h3>
              <ul style={{ display: 'flex', flexDirection: 'column', gap: '20px', fontWeight: 'bold' }}>
                <li style={{ color: 'var(--text-main)' }}>{t('comparison.n1')}</li>
                <li style={{ color: 'var(--text-main)' }}>{t('comparison.n2')}</li>
                <li style={{ color: '#ef4444' }}>{t('comparison.n3')}</li>
                <li style={{ color: 'var(--accent-color)' }}>{t('comparison.n4')}</li>
              </ul>
            </div>
          </div>

          <div style={{ textAlign: 'center', marginTop: '40px' }}>
            <p style={{ fontSize: '1.3rem', fontWeight: 'bold', color: 'var(--text-main)' }}>{t('comparison.conclusion')}</p>
          </div>
        </div>
      </section>

      {/* TRIGGER (Moved Up) */}
      <section id="ayo-trigger" className="section ayo-trigger-section" style={{ textAlign: "center", padding: "60px 20px" }}>
        <div className="container">
          <h2 className="section-title">{t('trigger.title')}</h2>
          <p className="section-subtitle">{t('trigger.sub')}</p>
          <Link href="/diagnostic" className="btn btn-primary" style={{ fontSize: "1.2rem", padding: "15px 30px" }}>
            {t('trigger.cta')}
          </Link>
        </div>
      </section>

      {/* SECTION 3 — Solution */}
      <section id="solution" className="section solution-section">
        <div className="container">
          <h2 className="section-title" style={{ textAlign: 'center', fontSize: '1.5rem', lineHeight: '1.4', maxWidth: '900px', margin: '0 auto 40px auto' }}>{t('solution.title')}</h2>
          <div className="grid-2" style={{ display: 'flex', justifyContent: 'center' }}>
            {/* Bloc AIO Unique */}
            <div className="card solution-card aio-card" style={{ maxWidth: '800px', width: '100%' }}>
              <h3>{t('solution.cardTitle')} <span className="subtitle">{t('solution.cardSubtitle')}</span></h3>
              <p>{t('solution.cardBody')}</p>

              <div style={{ margin: '30px 0', padding: '20px', background: 'rgba(37, 99, 235, 0.05)', borderRadius: '12px', border: '1px solid rgba(37, 99, 235, 0.1)' }}>
                <p style={{ fontSize: '1.1rem', fontWeight: 'bold', marginBottom: '10px', color: 'var(--text-main)' }}>
                  {t('solution.aioLabel')}
                </p>
                <p style={{ fontStyle: 'italic', color: 'var(--text-muted)' }}>
                  {t('solution.asrQuote')}
                </p>
              </div>
              <div style={{ marginTop: '20px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                <div>
                  <h4 style={{ marginBottom: '10px', color: 'var(--primary-color)' }}>{t('solution.step1Title')}</h4>
                  <p style={{ fontSize: '0.95rem', color: 'var(--text-muted)' }}>{t('solution.step1Body')}</p>
                </div>
                <div>
                  <h4 style={{ marginBottom: '10px', color: 'var(--accent-color)' }}>{t('solution.step2Title')}</h4>
                  <p style={{ fontSize: '0.95rem', color: 'var(--text-muted)' }}>{t('solution.step2Body')}</p>
                </div>
              </div>
              <p className="highlight" style={{ textAlign: 'center', marginTop: '30px', borderTop: '1px solid var(--border-light)', paddingTop: '20px' }}>
                {t('solution.result')}
              </p>
            </div>
          </div>
          <div style={{ textAlign: "center", marginTop: "40px", maxWidth: "800px", margin: "40px auto 0" }}>
            <p style={{ fontSize: "1.4rem", fontWeight: "bold", lineHeight: "1.4", color: 'var(--text-main)' }}>
              {t('solution.quote')}
            </p>
          </div>

          {/* GEO vs ASR */}
          <div style={{ maxWidth: '900px', margin: '60px auto 0', padding: '40px', background: '#F1F5F9', borderRadius: '20px' }}>
            <h3 style={{ fontSize: '1.6rem', color: 'var(--text-main)', marginBottom: '32px', textAlign: 'center' }}>
              {t('solution.geoTitle')}
            </h3>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '32px' }}>
              {/* GEO column — fond blanc, accents orange */}
              <div style={{ padding: '28px', background: 'white', borderRadius: '16px', borderTop: '4px solid #F97316' }}>
                <div style={{ display: 'inline-block', padding: '6px 16px', background: '#F97316', color: 'white', borderRadius: '20px', fontSize: '0.85rem', fontWeight: 'bold', marginBottom: '16px' }}>GEO</div>
                <p style={{ fontSize: '1.05rem', color: '#1E293B', lineHeight: '1.7', marginBottom: '16px' }}>
                  {t('solution.geoIntro')}
                </p>
                <p style={{ fontSize: '1rem', color: '#475569', lineHeight: '1.7', marginBottom: '20px' }}>
                  {t('solution.geoPoint')}
                </p>
                <div style={{ padding: '16px', background: '#FFF7ED', borderRadius: '10px', borderLeft: '3px solid #F97316', marginBottom: '12px' }}>
                  <p style={{ fontSize: '0.95rem', color: '#9A3412', fontWeight: '600' }}>{t('solution.diffGeo')}</p>
                </div>
                <div style={{ padding: '16px', background: '#FFF7ED', borderRadius: '10px', borderLeft: '3px solid #F97316' }}>
                  <p style={{ fontSize: '0.95rem', color: '#9A3412' }}>{t('solution.concreteGeo')}</p>
                </div>
              </div>

              {/* ASR column — fond blanc, accents teal */}
              <div style={{ padding: '28px', background: 'white', borderRadius: '16px', borderTop: '4px solid #0D9488' }}>
                <div style={{ display: 'inline-block', padding: '6px 16px', background: '#0D9488', color: 'white', borderRadius: '20px', fontSize: '0.85rem', fontWeight: 'bold', marginBottom: '16px' }}>ASR</div>
                <p style={{ fontSize: '1.1rem', fontWeight: 'bold', color: '#0F766E', lineHeight: '1.7', marginBottom: '16px' }}>
                  {t('solution.asrIntro')}
                </p>
                <p style={{ fontSize: '1rem', color: '#475569', lineHeight: '1.7', marginBottom: '20px' }}>
                  {t('solution.asrPoint1')}<br />
                  {t('solution.asrPoint2')}
                </p>
                <div style={{ padding: '16px', background: '#F0FDFA', borderRadius: '10px', borderLeft: '3px solid #0D9488', marginBottom: '12px' }}>
                  <p style={{ fontSize: '0.95rem', fontWeight: '600', color: '#0F766E' }}>{t('solution.diffAsr')}</p>
                </div>
                <div style={{ padding: '16px', background: '#F0FDFA', borderRadius: '10px', borderLeft: '3px solid #0D9488' }}>
                  <p style={{ fontSize: '0.95rem', fontWeight: '600', color: '#0F766E' }}>{t('solution.concreteAsr')}</p>
                </div>
              </div>
            </div>

            <div style={{ textAlign: 'center', padding: '28px', background: 'white', borderRadius: '16px', marginBottom: '20px' }}>
              <h4 style={{ color: 'var(--text-main)', marginBottom: '12px', fontSize: '1.15rem' }}>{t('solution.whyTitle')}</h4>
              <p style={{ fontSize: '1.05rem', fontWeight: 'bold', color: 'var(--text-main)', marginBottom: '16px' }}>{t('solution.whyBody')}</p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <p style={{ fontSize: '1rem', color: '#9A3412', padding: '14px', background: '#FFF7ED', borderRadius: '8px', borderLeft: '3px solid #F97316' }}>{t('solution.whyNoAsr')}</p>
                <p style={{ fontSize: '1rem', fontWeight: 'bold', color: '#0F766E', padding: '14px', background: '#F0FDFA', borderRadius: '8px', borderLeft: '3px solid #0D9488' }}>{t('solution.whyWithAsr')}</p>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', textAlign: 'center' }}>
              <p style={{ fontSize: '1rem', color: '#9A3412', padding: '14px', background: 'white', borderRadius: '10px', borderTop: '3px solid #F97316' }}>
                {t('solution.summaryGeo')}
              </p>
              <p style={{ fontSize: '1rem', fontWeight: 'bold', color: '#0F766E', padding: '14px', background: 'white', borderRadius: '10px', borderTop: '3px solid #0D9488' }}>
                {t('solution.summaryAsr')}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* TARGET */}
      <section id="target" className="section target-section" style={{ textAlign: "center" }}>
        <div className="container">
          <h2 className="section-title">{t('target.title')}</h2>
          <div className="target-grid">
            <span className="target-badge">{t('target.badge1')}</span>
            <span className="target-badge">{t('target.badge2')}</span>
            <span className="target-badge">{t('target.badge3')}</span>
            <span className="target-badge">{t('target.badge4')}</span>
            <span className="target-badge">{t('target.badge5')}</span>
            <span className="target-badge">{t('target.badge6')}</span>
            <span className="target-badge">{t('target.badge7')}</span>
            <span className="target-badge">{t('target.badge8')}</span>
          </div>
          <p className="target-text" style={{ fontSize: '1.2rem', marginTop: '30px', lineHeight: '1.6' }}>
            {t('target.quote')}
          </p>
        </div>
      </section>

      {/* AYA PRESENTATION (NEW) */}
      <section className="section aya-presentation-section" style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e3a8a 100%)', color: 'white', padding: '80px 0' }}>
        <div className="container">
          <div style={{ textAlign: 'center', marginBottom: '60px' }}>
            <span className="badge" style={{ background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8', border: '1px solid #0ea5e9', padding: '6px 18px', borderRadius: '20px', fontSize: '0.85rem', letterSpacing: '1.2px', fontWeight: 'bold', textTransform: 'uppercase' }}>
              {t('aya.badge')}
            </span>
            <h2 style={{ fontSize: '3.5rem', fontWeight: '800', marginTop: '25px', marginBottom: '20px', color: '#ffffff', textShadow: '0 4px 15px rgba(0,0,0,0.5)', lineHeight: 1.1 }}>
              {t('aya.title')}
            </h2>
            <p style={{ fontSize: '1.3rem', color: '#e2e8f0', maxWidth: '750px', margin: '0 auto', lineHeight: '1.6', fontWeight: '500' }}>
              {t('aya.sub')}
            </p>
          </div>

          <div className="process-grid grid-3">
            <div className="process-step" style={{ background: 'rgba(255,255,255,0.05)', backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.1)', padding: '30px', borderRadius: '16px' }}>
              <div style={{ fontSize: '2.5rem', marginBottom: '20px' }}>&#x1F310;</div>
              <h3 style={{ color: 'white', fontSize: '1.2rem', marginBottom: '10px' }}>{t('aya.step1Title')}</h3>
              <p style={{ color: '#94a3b8', fontSize: '0.95rem', lineHeight: '1.6' }}>
                {t('aya.step1Body')}
              </p>
            </div>

            <div className="process-step" style={{ background: 'rgba(255,255,255,0.05)', backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.1)', padding: '30px', borderRadius: '16px' }}>
              <div style={{ fontSize: '2.5rem', marginBottom: '20px' }}>&#x1F512;</div>
              <h3 style={{ color: 'white', fontSize: '1.2rem', marginBottom: '10px' }}>{t('aya.step2Title')}</h3>
              <p style={{ color: '#94a3b8', fontSize: '0.95rem' }}>
                {t('aya.step2Body')}
              </p>
            </div>

            <div className="process-step" style={{ background: 'rgba(255,255,255,0.05)', backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.1)', padding: '30px', borderRadius: '16px' }}>
              <div style={{ fontSize: '2.5rem', marginBottom: '20px' }}>&#x26A1;</div>
              <h3 style={{ color: 'white', fontSize: '1.2rem', marginBottom: '10px' }}>{t('aya.step3Title')}</h3>
              <p style={{ color: '#94a3b8', fontSize: '0.95rem', lineHeight: '1.6' }}>
                {t('aya.step3Body')}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* PRICING */}
      <section id="pricing" className="section pricing-section">
        <div className="container" style={{ textAlign: "center" }}>
          <h2 className="section-title" style={{ fontSize: "2.5rem" }}>{t('pricing.title')}</h2>
          <div className="grid-2 pricing-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '30px', maxWidth: '900px', margin: '0 auto' }}>

            {/* OPTION 1 : ABONNEMENT (LOCATION VISIBILITÉ) */}
            <div className="card pricing-card featured" style={{ border: '2px solid var(--primary-color)' }}>
              <div style={{ background: 'var(--primary-color)', color: 'white', padding: '5px 10px', borderRadius: '4px', fontSize: '0.8rem', fontWeight: 'bold', display: 'inline-block', marginBottom: '10px' }}>
                {t('pricing.recommended')}
              </div>
              <h3>{t('pricing.plan1Title')} <br /><span className="card-subtitle">{t('pricing.plan1Sub')}</span></h3>
              <div className="price">{t('pricing.plan1Price')} <span style={{ fontSize: '1rem', fontWeight: 'normal' }}>{t('pricing.plan1Period')}</span></div>
              <p className="price-details">{t('pricing.plan1Desc')}</p>
              <ul style={{ textAlign: 'left', marginTop: '20px', fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                <li>&#x2705; <strong>{t('pricing.plan1f1')}</strong></li>
                <li>&#x2705; {t('pricing.plan1f2')}</li>
                <li>&#x2705; {t('pricing.plan1f3')}</li>
                <li>&#x2705; {t('pricing.plan1f4')}</li>
                <li>&#x2705; {t('pricing.plan1f5')}</li>
              </ul>
              <div style={{ marginTop: 'auto', paddingTop: '20px' }}>
                <Link href="/diagnostic?pack=aya-sub" className="btn btn-primary w-full" style={{ width: '100%' }}>
                  {t('pricing.plan1cta')}
                </Link>
              </div>
            </div>

            {/* OPTION 2 : ACHAT (INVESTISSEMENT PATRIMONIAL) */}
            <div className="card pricing-card">
              <h3>{t('pricing.plan2Title')} <br /><span className="card-subtitle">{t('pricing.plan2Sub')}</span></h3>

              <div className="price" style={{ marginBottom: 0 }}>{t('pricing.plan2Price')} <span style={{ fontSize: '1rem', fontWeight: 'normal' }}>{t('pricing.plan2Period')}</span></div>
              <div style={{ fontSize: '0.8rem', color: '#4A919E', fontWeight: 600, marginTop: '-4px', marginBottom: '8px' }}>{t('pricing.plan2f5')}</div>
              <p className="price-details">{t('pricing.plan2Desc')}<br /><strong>{t('pricing.plan2Own')}</strong></p>
              <ul style={{ textAlign: 'left', marginTop: '20px', fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                <li>&#x2705; <strong>{t('pricing.plan2f1')}</strong></li>
                <li>&#x2705; {t('pricing.plan2f2')}</li>
                <li>&#x2705; {t('pricing.plan2f3')}</li>
                <li>&#x2705; {t('pricing.plan2f4')}</li>
              </ul>
              <div style={{ marginTop: 'auto', paddingTop: '20px' }}>
                <Link href="/diagnostic?pack=pro" className="btn btn-secondary w-full" style={{ width: '100%' }}>
                  {t('pricing.plan2cta')}
                </Link>
              </div>
            </div>

          </div>

        </div>
      </section>


      {/* CTA Final */}
      <section id="cta-final" className="section cta-final-section" style={{ textAlign: "center" }}>
        <div className="container">
          <h2 className="section-title" style={{ fontSize: "2rem" }}>{t('ctaFinal.title')}</h2>
          <div className="cta-group" style={{ display: 'flex', justifyContent: 'center', marginBottom: '20px' }}>
            <Link href="/diagnostic" className="btn btn-primary">
              {t('ctaFinal.cta')}
            </Link>
          </div>
          <p className="final-phrase">{t('ctaFinal.phrase')}</p>
        </div>
      </section>

      <Footer />
    </main >
  );
}
