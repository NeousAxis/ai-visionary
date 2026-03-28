
import React from 'react';
import Link from 'next/link';
import Footer from '../components/Footer';
import FAQ from '../components/FAQ';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

export async function generateMetadata(): Promise<Metadata> {
    const t = await getTranslations('aiAndBusiness');
    return {
        title: t('metaTitle'),
        description: t('metaDesc'),
        openGraph: {
            title: t('metaOgTitle'),
            description: t('metaOgDesc'),
            url: 'https://ai-visionary.com/ai-et-votre-entreprise',
            siteName: 'AI Visionary',
            type: 'website',
        },
    };
}

export default async function ComprendrePage() {
    const t = await getTranslations('aiAndBusiness');

    return (
        <main>
            {/* Header / Nav */}
            <nav className="container" style={{ padding: '2rem 1rem' }}>
                <Link href="/" className="btn btn-secondary">
                    {t('backHome')}
                </Link>
            </nav>

            {/* Hero Section */}
            <section className="section" style={{ paddingTop: '1rem', paddingBottom: '1rem' }}>
                <div className="container hero-content">
                    <h1 className="headline" style={{ fontSize: '3rem' }}>
                        {t('heroTitle')}
                    </h1>
                    <div className="subheadline">
                        <p className="highlight">
                            {t('heroHighlight')}
                        </p>
                        <p>
                            {t('heroBody')}
                        </p>
                    </div>
                </div>
            </section>

            {/* 1. Avant ASR */}
            <section className="section">
                <div className="container">
                    <div className="card" style={{ borderColor: 'rgba(239, 68, 68, 0.3)' }}>
                        <h2 style={{ marginBottom: '1rem', color: '#ef4444' }}>{t('s1Title')}</h2>
                        <p style={{ marginBottom: '1rem' }}>{t('s1p1')}</p>
                        <p style={{ marginBottom: '1rem' }}><strong>{t('s1p2')}</strong></p>
                        <ul className="clean-list" style={{ marginBottom: '1rem' }}>
                            <li>{t('s1l1')}</li>
                            <li>{t('s1l2')}</li>
                            <li>{t('s1l3')}</li>
                        </ul>
                        <p className="highlight" style={{ color: '#ef4444' }}>{t('s1highlight')}</p>
                    </div>
                </div>
            </section>

            {/* 2. Apres ASR */}
            <section className="section">
                <div className="container">
                    <div className="card" style={{ borderColor: 'rgba(16, 185, 129, 0.3)', background: 'rgba(16, 185, 129, 0.05)' }}>
                        <h2 style={{ marginBottom: '1rem', color: '#10b981' }}>{t('s2Title')}</h2>
                        <p style={{ marginBottom: '1rem' }}>{t('s2p1')}</p>
                        <ul className="clean-list" style={{ marginBottom: '1rem' }}>
                            <li>{t('s2l1')}</li>
                            <li>{t('s2l2')}</li>
                            <li>{t('s2l3')}</li>
                        </ul>
                        <p className="highlight" style={{ color: '#10b981' }}>{t('s2highlight')}</p>
                    </div>
                </div>
            </section>

            {/* 3. Cas concrets */}
            <section className="section">
                <div className="container">
                    <h2 className="section-title">{t('s3Title')}</h2>

                    <div className="process-steps">
                        {/* Cas 1 */}
                        <div className="step">
                            <span className="step-number" style={{ fontSize: '1.5rem', opacity: 0.7 }}>{t('case1Label')}</span>
                            <h4>{t('case1Title')}</h4>
                            <p style={{ fontStyle: 'italic', marginBottom: '0.5rem' }}>{t('case1Question')}</p>
                            <ul className="clean-list" style={{ fontSize: '0.9rem' }}>
                                <li style={{ color: '#ef4444' }}><strong>{t('case1Without')}</strong></li>
                                <li style={{ color: '#10b981' }}><strong>{t('case1With')}</strong></li>
                            </ul>
                        </div>

                        {/* Cas 2 */}
                        <div className="step">
                            <span className="step-number" style={{ fontSize: '1.5rem', opacity: 0.7 }}>{t('case2Label')}</span>
                            <h4>{t('case2Title')}</h4>
                            <p style={{ fontStyle: 'italic', marginBottom: '0.5rem' }}>{t('case2Question')}</p>
                            <p style={{ fontSize: '0.9rem', marginBottom: '0.5rem' }}>{t('case2Body')}</p>
                            <ul className="clean-list" style={{ fontSize: '0.9rem' }}>
                                <li>{t('case2l1')}</li>
                                <li>{t('case2l2')}</li>
                            </ul>
                            <p className="highlight" style={{ fontSize: '0.9rem', marginTop: '0.5rem', color: '#10b981' }}>{t('case2highlight')}</p>
                        </div>

                        {/* Cas 3 */}
                        <div className="step">
                            <span className="step-number" style={{ fontSize: '1.5rem', opacity: 0.7 }}>{t('case3Label')}</span>
                            <h4>{t('case3Title')}</h4>
                            <p style={{ fontStyle: 'italic', marginBottom: '0.5rem' }}>{t('case3Question')}</p>
                            <ul className="clean-list" style={{ fontSize: '0.9rem' }}>
                                <li style={{ color: '#ef4444' }}><strong>{t('case3Without')}</strong></li>
                                <li style={{ color: '#10b981' }}><strong>{t('case3With')}</strong></li>
                            </ul>
                        </div>
                    </div>
                </div>
            </section>

            {/* 4. Pourquoi l'IA n'hallucine plus */}
            <section className="section">
                <div className="container">
                    <div className="grid-2">
                        <div className="card">
                            <h3>{t('s4Title')}</h3>
                            <p style={{ marginTop: '1rem' }}>{t('s4p1')}</p>
                            <ul className="clean-list">
                                <li>{t('s4l1')}</li>
                                <li>{t('s4l2')}</li>
                                <li>{t('s4l3')}</li>
                            </ul>
                            <p style={{ marginTop: '1rem' }}><strong>{t('s4p2')}</strong></p>
                            <ul className="clean-list">
                                <li>{t('s4l4')}</li>
                                <li>{t('s4l5')}</li>
                                <li>{t('s4l6')}</li>
                            </ul>
                            <p className="highlight" style={{ marginTop: '1rem' }}>{t('s4highlight')}</p>
                        </div>

                        <div className="card">
                            <h3>{t('s5Title')}</h3>
                            <p style={{ marginTop: '1rem', color: '#ef4444', textDecoration: 'line-through' }}>{t('s5not')}</p>
                            <p style={{ marginTop: '1rem', fontWeight: 'bold' }}>{t('s5but')}</p>
                            <ul className="clean-list">
                                <li><strong>{t('s5l1')}</strong></li>
                                <li><strong>{t('s5l2')}</strong></li>
                                <li><strong>{t('s5l3')}</strong></li>
                            </ul>
                            <p className="highlight" style={{ marginTop: '1rem' }}>{t('s5highlight')}</p>
                        </div>
                    </div>
                </div>
            </section>

            {/* Conclusion */}
            <section className="section cta-final-section">
                <div className="container">
                    <h2 className="section-title">{t('conclusionTitle')}</h2>
                    <p className="final-phrase" style={{ fontSize: '1.5rem', fontStyle: 'italic', maxWidth: '800px', margin: '0 auto' }}>
                        {t('conclusionQuote')}
                    </p>
                    <p style={{ marginTop: '2rem', color: 'var(--text-muted)' }}>
                        {t('conclusionBody')}
                    </p>
                    <div style={{ marginTop: '3rem' }}>
                        <Link href="/" className="btn btn-primary">
                            {t('conclusionCta')}
                        </Link>
                    </div>
                </div>
            </section>

            {/* FAQ */}
            <FAQ />

            {/* Footer */}
            <Footer />
        </main>
    );
}
