import Link from 'next/link';
import Footer from '../components/Footer';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

export async function generateMetadata(): Promise<Metadata> {
    const t = await getTranslations('legal');
    return {
        title: t('metaTitlePrivacy'),
        description: t('metaDescPrivacy'),
        openGraph: {
            title: t('metaOgTitlePrivacy'),
            description: t('metaOgDescPrivacy'),
            url: 'https://ai-visionary.xyz/confidentialite',
            siteName: 'AI Visionary',
            type: 'website',
        },
    };
}

const h2Style = { fontSize: '1.2rem', marginTop: '30px', marginBottom: '10px', color: 'var(--text-main)' };
const h3Style = { fontSize: '1.05rem', marginTop: '20px', marginBottom: '8px', color: 'var(--text-main)' };
const ulStyle = { paddingLeft: '20px', marginTop: '10px' };
const tableStyle: React.CSSProperties = { width: '100%', borderCollapse: 'collapse', marginTop: '10px', fontSize: '0.95rem' };
const thStyle: React.CSSProperties = { textAlign: 'left', padding: '8px 12px', borderBottom: '2px solid var(--primary-color)', color: 'var(--text-main)', fontWeight: 600 };
const tdStyle: React.CSSProperties = { padding: '8px 12px', borderBottom: '1px solid #e5e7eb', verticalAlign: 'top' };

export default async function ConfidentialitePage() {
    const tLegal = await getTranslations('legal');
    const t = await getTranslations('privacy');

    return (
        <main>
            <nav className="container" style={{ padding: '2rem 1rem' }}>
                <Link href="/" className="btn btn-secondary">
                    {tLegal('backHome')}
                </Link>
            </nav>

            <section className="section">
                <div className="container" style={{ maxWidth: '800px' }}>
                    <h1 className="section-title">{tLegal('privacyTitle')}</h1>
                    <div className="card" style={{ lineHeight: '1.8' }}>

                        <p style={{ marginBottom: '20px', color: 'var(--text-muted)' }}>
                            {t('intro')}
                        </p>

                        {/* 1. Responsable du traitement */}
                        <h2 style={{ ...h2Style, marginTop: '10px' }}>{t('s1Title')}</h2>
                        <p>
                            <strong>{t('s1Body')}</strong><br />
                            {t('s1FoundedBy')}<br />
                            {t('s1Location')}<br />
                            {t('s1Email')} <a href="mailto:hello@ai-visionary.xyz" style={{ color: 'var(--primary-color)' }}>hello@ai-visionary.xyz</a><br />
                            {t('s1Site')} <a href="https://ai-visionary.xyz" style={{ color: 'var(--primary-color)' }}>ai-visionary.xyz</a>
                        </p>
                        <p style={{ marginTop: '10px' }}>
                            {t('s1Legal')}
                        </p>

                        {/* 2. Donnees collectees */}
                        <h2 style={h2Style}>{t('s2Title')}</h2>
                        <p>{t('s2Intro')}</p>

                        <h3 style={h3Style}>{t('s2_1Title')}</h3>
                        <ul style={ulStyle}>
                            <li><strong>{t('s2_1l1')}</strong></li>
                            <li><strong>{t('s2_1l2')}</strong></li>
                            <li><strong>{t('s2_1l3')}</strong></li>
                            <li><strong>{t('s2_1l4')}</strong></li>
                        </ul>

                        <h3 style={h3Style}>{t('s2_2Title')}</h3>
                        <ul style={ulStyle}>
                            <li><strong>{t('s2_2l1')}</strong></li>
                            <li><strong>{t('s2_2l2')}</strong></li>
                        </ul>

                        <h3 style={h3Style}>{t('s2_3Title')}</h3>
                        <ul style={ulStyle}>
                            <li><strong>{t('s2_3l1')}</strong></li>
                            <li>{t('s2_3l2')}</li>
                        </ul>

                        <h3 style={h3Style}>{t('s2_4Title')}</h3>
                        <ul style={ulStyle}>
                            <li>{t('s2_4l1')}</li>
                            <li>{t('s2_4l2')}</li>
                        </ul>

                        <h3 style={h3Style}>{t('s2_5Title')}</h3>
                        <ul style={ulStyle}>
                            <li><strong>{t('s2_5l1')}</strong></li>
                            <li><strong>{t('s2_5l2')}</strong></li>
                        </ul>

                        {/* 3. Bases legales */}
                        <h2 style={h2Style}>{t('s3Title')}</h2>
                        <p>{t('s3Intro')}</p>
                        <table style={tableStyle}>
                            <thead>
                                <tr>
                                    <th style={thStyle}>{t('s3ThPurpose')}</th>
                                    <th style={thStyle}>{t('s3ThBasis')}</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr><td style={tdStyle}>{t('s3r1p')}</td><td style={tdStyle}>{t('s3r1b')}</td></tr>
                                <tr><td style={tdStyle}>{t('s3r2p')}</td><td style={tdStyle}>{t('s3r2b')}</td></tr>
                                <tr><td style={tdStyle}>{t('s3r3p')}</td><td style={tdStyle}>{t('s3r3b')}</td></tr>
                                <tr><td style={tdStyle}>{t('s3r4p')}</td><td style={tdStyle}>{t('s3r4b')}</td></tr>
                                <tr><td style={tdStyle}>{t('s3r5p')}</td><td style={tdStyle}>{t('s3r5b')}</td></tr>
                                <tr><td style={tdStyle}>{t('s3r6p')}</td><td style={tdStyle}>{t('s3r6b')}</td></tr>
                                <tr><td style={tdStyle}>{t('s3r7p')}</td><td style={tdStyle}>{t('s3r7b')}</td></tr>
                            </tbody>
                        </table>

                        {/* 4. Sous-traitants */}
                        <h2 style={h2Style}>{t('s4Title')}</h2>
                        <p>{t('s4Intro')}</p>
                        <div style={{ overflowX: 'auto' }}>
                            <table style={tableStyle}>
                                <thead>
                                    <tr>
                                        <th style={thStyle}>{t('s4ThSub')}</th>
                                        <th style={thStyle}>{t('s4ThPurpose')}</th>
                                        <th style={thStyle}>{t('s4ThLocation')}</th>
                                        <th style={thStyle}>{t('s4ThGuarantees')}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr>
                                        <td style={tdStyle}><strong>{t('s4r1s')}</strong></td>
                                        <td style={tdStyle}>{t('s4r1p')}</td>
                                        <td style={tdStyle}>{t('s4r1l')}</td>
                                        <td style={tdStyle}>{t('s4r1g')}</td>
                                    </tr>
                                    <tr>
                                        <td style={tdStyle}><strong>{t('s4r2s')}</strong></td>
                                        <td style={tdStyle}>{t('s4r2p')}</td>
                                        <td style={tdStyle}>{t('s4r2l')}</td>
                                        <td style={tdStyle}>{t('s4r2g')}</td>
                                    </tr>
                                    <tr>
                                        <td style={tdStyle}><strong>{t('s4r3s')}</strong></td>
                                        <td style={tdStyle}>{t('s4r3p')}</td>
                                        <td style={tdStyle}>{t('s4r3l')}</td>
                                        <td style={tdStyle}>{t('s4r3g')}</td>
                                    </tr>
                                    <tr>
                                        <td style={tdStyle}><strong>{t('s4r4s')}</strong></td>
                                        <td style={tdStyle}>{t('s4r4p')}</td>
                                        <td style={tdStyle}>{t('s4r4l')}</td>
                                        <td style={tdStyle}>{t('s4r4g')}</td>
                                    </tr>
                                    <tr>
                                        <td style={tdStyle}><strong>{t('s4r5s')}</strong></td>
                                        <td style={tdStyle}>{t('s4r5p')}</td>
                                        <td style={tdStyle}>{t('s4r5l')}</td>
                                        <td style={tdStyle}>{t('s4r5g')}</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                        <p style={{ marginTop: '15px' }}>{t('s4Transfer')}</p>
                        <p style={{ marginTop: '10px' }}><strong>{t('s4NoSell')}</strong></p>

                        {/* 5. Cookies */}
                        <h2 style={h2Style}>{t('s5Title')}</h2>
                        <p>{t('s5Intro')}</p>
                        <ul style={ulStyle}>
                            <li><strong>{t('s5l1')}</strong></li>
                            <li><strong>{t('s5l2')}</strong></li>
                        </ul>
                        <p style={{ marginTop: '10px' }}><strong>{t('s5NoTracking')}</strong></p>

                        {/* 6. Duree de conservation */}
                        <h2 style={h2Style}>{t('s6Title')}</h2>
                        <table style={tableStyle}>
                            <thead>
                                <tr>
                                    <th style={thStyle}>{t('s6ThType')}</th>
                                    <th style={thStyle}>{t('s6ThDuration')}</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr><td style={tdStyle}>{t('s6r1t')}</td><td style={tdStyle}>{t('s6r1d')}</td></tr>
                                <tr><td style={tdStyle}>{t('s6r2t')}</td><td style={tdStyle}>{t('s6r2d')}</td></tr>
                                <tr><td style={tdStyle}>{t('s6r3t')}</td><td style={tdStyle}>{t('s6r3d')}</td></tr>
                                <tr><td style={tdStyle}>{t('s6r4t')}</td><td style={tdStyle}>{t('s6r4d')}</td></tr>
                                <tr><td style={tdStyle}>{t('s6r5t')}</td><td style={tdStyle}>{t('s6r5d')}</td></tr>
                                <tr><td style={tdStyle}>{t('s6r6t')}</td><td style={tdStyle}>{t('s6r6d')}</td></tr>
                                <tr><td style={tdStyle}>{t('s6r7t')}</td><td style={tdStyle}>{t('s6r7d')}</td></tr>
                            </tbody>
                        </table>
                        <p style={{ marginTop: '10px' }}>{t('s6Expiry')}</p>

                        {/* 7. Securite */}
                        <h2 style={h2Style}>{t('s7Title')}</h2>
                        <p>{t('s7Intro')}</p>
                        <ul style={ulStyle}>
                            <li>{t('s7l1')}</li>
                            <li>{t('s7l2')}</li>
                            <li>{t('s7l3')}</li>
                            <li>{t('s7l4')}</li>
                            <li>{t('s7l5')}</li>
                            <li>{t('s7l6')}</li>
                            <li>{t('s7l7')}</li>
                        </ul>

                        {/* 8. Vos droits */}
                        <h2 style={h2Style}>{t('s8Title')}</h2>
                        <p>{t('s8Intro')}</p>
                        <ul style={ulStyle}>
                            <li><strong>{t('s8l1')}</strong></li>
                            <li><strong>{t('s8l2')}</strong></li>
                            <li><strong>{t('s8l3')}</strong></li>
                            <li><strong>{t('s8l4')}</strong></li>
                            <li><strong>{t('s8l5')}</strong></li>
                            <li><strong>{t('s8l6')}</strong></li>
                            <li><strong>{t('s8l7')}</strong></li>
                        </ul>

                        <h3 style={h3Style}>{t('s8ExerciseTitle')}</h3>
                        <p>{t('s8Exercise')}</p>

                        <h3 style={h3Style}>{t('s8ComplaintTitle')}</h3>
                        <p>{t('s8ComplaintIntro')}</p>
                        <ul style={ulStyle}>
                            <li><strong>{t('s8ComplaintCH')}</strong> <a href="https://www.edoeb.admin.ch" style={{ color: 'var(--primary-color)' }} target="_blank" rel="noopener noreferrer">edoeb.admin.ch</a></li>
                            <li><strong>{t('s8ComplaintEU')}</strong></li>
                        </ul>

                        {/* 9. Bot AYA */}
                        <h2 style={h2Style}>{t('s9Title')}</h2>
                        <p>{t('s9p1')}</p>
                        <p style={{ marginTop: '10px' }}>{t('s9p2')}</p>

                        {/* 10. Mineurs */}
                        <h2 style={h2Style}>{t('s10Title')}</h2>
                        <p>{t('s10p1')}</p>

                        {/* 11. Modifications */}
                        <h2 style={h2Style}>{t('s11Title')}</h2>
                        <p>{t('s11p1')}</p>

                        {/* 12. Droit applicable */}
                        <h2 style={h2Style}>{t('s12Title')}</h2>
                        <p>{t('s12p1')}</p>
                        <p style={{ marginTop: '10px' }}>{t('s12p2')}</p>
                        <p style={{ marginTop: '10px' }}>{t('s12p3')}</p>

                        {/* 13. Contact */}
                        <h2 style={h2Style}>{t('s13Title')}</h2>
                        <p>{t('s13Intro')}</p>
                        <p style={{ marginTop: '10px' }}>
                            <strong>{t('s13Name')}</strong><br />
                            Cyril Leger<br />
                            {t('s1Location')}<br />
                            {t('s1Email')} <a href="mailto:hello@ai-visionary.xyz" style={{ color: 'var(--primary-color)' }}>hello@ai-visionary.xyz</a>
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
