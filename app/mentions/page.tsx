import Link from 'next/link';
import Footer from '../components/Footer';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

export async function generateMetadata(): Promise<Metadata> {
    const t = await getTranslations('legal');
    return {
        title: t('metaTitleLegal'),
        description: t('metaDescLegal'),
        openGraph: {
            title: t('metaOgTitleLegal'),
            description: t('metaOgDescLegal'),
            url: 'https://ai-visionary.com/mentions',
            siteName: 'AI Visionary',
            type: 'website',
        },
    };
}

const h2Style = { fontSize: '1.2rem', marginTop: '30px', marginBottom: '10px', color: 'var(--text-main)' };
const ulStyle = { paddingLeft: '20px', marginTop: '10px' };

export default async function MentionsPage() {
    const tLegal = await getTranslations('legal');
    const t = await getTranslations('mentions');

    return (
        <main>
            <nav className="container" style={{ padding: '2rem 1rem' }}>
                <Link href="/" className="btn btn-secondary">
                    {tLegal('backHome')}
                </Link>
            </nav>

            <section className="section">
                <div className="container" style={{ maxWidth: '800px' }}>
                    <h1 className="section-title">{tLegal('legalTitle')}</h1>
                    <div className="card" style={{ lineHeight: '1.8' }}>

                        {/* 1. Editeur */}
                        <h2 style={{ ...h2Style, marginTop: '0' }}>{t('s1Title')}</h2>
                        <p>
                            <strong>{t('s1Body')}</strong><br />
                            {t('s1FoundedBy')}<br />
                            {t('s1Specialty')}<br />
                            {t('s1Location')}<br />
                            {t('s1Email')} <a href="mailto:hello@ai-visionary.com" style={{ color: 'var(--primary-color)' }}>hello@ai-visionary.com</a><br />
                            {t('s1Site')} <a href="https://ai-visionary.com" style={{ color: 'var(--primary-color)' }}>ai-visionary.com</a>
                        </p>
                        <p style={{ marginTop: '10px' }}>
                            {t('s1Director')}
                        </p>

                        {/* 2. Hebergement */}
                        <h2 style={h2Style}>{t('s2Title')}</h2>
                        <p>{t('s2Intro')}</p>
                        <p style={{ marginTop: '10px' }}>
                            <strong>{t('s2Vercel')}</strong><br />
                            {t('s2VercelAddr')}<br />
                            <a href="https://vercel.com" style={{ color: 'var(--primary-color)' }} target="_blank" rel="noopener noreferrer">vercel.com</a>
                        </p>
                        <p style={{ marginTop: '10px' }}>{t('s2Supabase')}</p>

                        {/* 3. Propriete intellectuelle */}
                        <h2 style={h2Style}>{t('s3Title')}</h2>
                        <p>{t('s3p1')}</p>
                        <p style={{ marginTop: '10px' }}>{t('s3p2')}</p>
                        <ul style={ulStyle}>
                            <li><strong>{t('s3l1')}</strong></li>
                            <li><strong>{t('s3l2')}</strong></li>
                            <li><strong>{t('s3l3')}</strong></li>
                            <li><strong>{t('s3l4')}</strong></li>
                        </ul>
                        <p style={{ marginTop: '10px' }}>{t('s3p3')}</p>
                        <p style={{ marginTop: '10px' }}>{t('s3p4')}</p>

                        {/* 4. Donnees du Registre AYA */}
                        <h2 style={h2Style}>{t('s4Title')}</h2>
                        <p>{t('s4p1')}</p>
                        <p style={{ marginTop: '10px' }}>{t('s4p2')}</p>

                        {/* 5. Limitation de responsabilite */}
                        <h2 style={h2Style}>{t('s5Title')}</h2>
                        <p>{t('s5p1')}</p>
                        <p style={{ marginTop: '10px' }}>{t('s5p2')}</p>
                        <ul style={ulStyle}>
                            <li>{t('s5l1')}</li>
                            <li>{t('s5l2')}</li>
                            <li>{t('s5l3')}</li>
                            <li>{t('s5l4')}</li>
                            <li>{t('s5l5')}</li>
                        </ul>
                        <p style={{ marginTop: '10px' }}>{t('s5p3')}</p>

                        {/* 6. Liens hypertextes */}
                        <h2 style={h2Style}>{t('s6Title')}</h2>
                        <p>{t('s6p1')}</p>
                        <p style={{ marginTop: '10px' }}>{t('s6p2')}</p>

                        {/* 7. Disponibilite */}
                        <h2 style={h2Style}>{t('s7Title')}</h2>
                        <p>{t('s7p1')}</p>

                        {/* 8. Droit applicable */}
                        <h2 style={h2Style}>{t('s8Title')}</h2>
                        <p>{t('s8p1')}</p>
                        <p style={{ marginTop: '10px' }}>{t('s8p2')}</p>

                        {/* 9. Credits */}
                        <h2 style={h2Style}>{t('s9Title')}</h2>
                        <ul style={ulStyle}>
                            <li>{t('s9l1')}</li>
                            <li>{t('s9l2')}</li>
                            <li>{t('s9l3')}</li>
                            <li>{t('s9l4')}</li>
                        </ul>

                        {/* 10. Contact */}
                        <h2 style={h2Style}>{t('s10Title')}</h2>
                        <p>{t('s10Intro')}</p>
                        <p style={{ marginTop: '10px' }}>
                            <strong>AI Visionary</strong><br />
                            Cyril Leger<br />
                            Geneva, Switzerland<br />
                            {t('s1Email')} <a href="mailto:hello@ai-visionary.com" style={{ color: 'var(--primary-color)' }}>hello@ai-visionary.com</a>
                        </p>

                        <p style={{ marginTop: '30px', fontSize: '0.85rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                            {t('lastUpdated')}
                        </p>
                    </div>
                </div>
            </section>
            <Footer />
        </main>
    );
}
