import Footer from '../components/Footer';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

export async function generateMetadata(): Promise<Metadata> {
    const t = await getTranslations('cgvPage');
    return {
        title: t('metaTitle'),
        description: t('metaDesc'),
        openGraph: {
            title: t('metaTitle'),
            description: t('metaDesc'),
            url: 'https://ai-visionary.xyz/cgv',
            siteName: 'AI Visionary',
            type: 'website',
        },
    };
}

const h2Style = { fontSize: '1.2rem', marginTop: '30px', marginBottom: '10px', color: 'var(--text-main)' };

export default async function CgvPage() {
    const t = await getTranslations('cgvPage');
    return (
        <>
            <main className="legal-page" style={{ maxWidth: '800px', margin: '0 auto', padding: '60px 20px 40px' }}>
                <h1 style={{ fontSize: '1.8rem', marginBottom: '30px', color: 'var(--text-main)' }}>{t('title')}</h1>
                <p style={{ marginBottom: '20px', color: 'var(--text-muted)', fontStyle: 'italic' }}>{t('lastUpdate')}</p>

                <h2 style={h2Style}>{t('s1Title')}</h2>
                <p>{t('s1')}</p>

                <h2 style={h2Style}>{t('s2Title')}</h2>
                <p>{t('s2')}</p>

                <h2 style={h2Style}>{t('s3Title')}</h2>
                <p>{t('s3')}</p>

                <h2 style={h2Style}>{t('s4Title')}</h2>
                <p>{t('s4')}</p>

                <h2 style={h2Style}>{t('s5Title')}</h2>
                <p>{t('s5')}</p>

                <h2 style={h2Style}>{t('s6Title')}</h2>
                <p>{t('s6')}</p>

                <h2 style={h2Style}>{t('s7Title')}</h2>
                <p>{t('s7')}</p>

                <h2 style={h2Style}>{t('s8Title')}</h2>
                <p>{t('s8')}</p>

                <h2 style={h2Style}>{t('s9Title')}</h2>
                <p>{t('s9')}</p>

                <h2 style={h2Style}>{t('s10Title')}</h2>
                <p>{t('s10')}</p>
            </main>
            <Footer />
        </>
    );
}
