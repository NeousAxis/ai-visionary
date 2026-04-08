import Footer from '../components/Footer';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

export async function generateMetadata(): Promise<Metadata> {
    const t = await getTranslations('faqPage');
    return {
        title: t('metaTitle'),
        description: t('metaDesc'),
        openGraph: {
            title: t('metaTitle'),
            description: t('metaDesc'),
            url: 'https://ai-visionary.xyz/faq',
            siteName: 'AI Visionary',
            type: 'website',
        },
    };
}

const h2Style = { fontSize: '1.2rem', marginTop: '30px', marginBottom: '10px', color: 'var(--text-main)' };

export default async function FaqPage() {
    const t = await getTranslations('faqPage');
    return (
        <>
            <main className="legal-page" style={{ maxWidth: '800px', margin: '0 auto', padding: '60px 20px 40px' }}>
                <h1 style={{ fontSize: '1.8rem', marginBottom: '30px', color: 'var(--text-main)' }}>{t('title')}</h1>

                <h2 style={h2Style}>{t('q1')}</h2>
                <p>{t('a1')}</p>

                <h2 style={h2Style}>{t('q2')}</h2>
                <p>{t('a2')}</p>

                <h2 style={h2Style}>{t('q3')}</h2>
                <p>{t('a3')}</p>

                <h2 style={h2Style}>{t('q4')}</h2>
                <p>{t('a4')}</p>

                <h2 style={h2Style}>{t('q5')}</h2>
                <p>{t('a5')}</p>

                <h2 style={h2Style}>{t('q6')}</h2>
                <p>{t('a6')}</p>

                <h2 style={h2Style}>{t('q7')}</h2>
                <p>{t('a7')}</p>

                <h2 style={h2Style}>{t('q8')}</h2>
                <p>{t('a8')}</p>

                <h2 style={h2Style}>{t('q9')}</h2>
                <p>{t('a9')}</p>

                <h2 style={h2Style}>{t('q10')}</h2>
                <p>{t('a10')}</p>
            </main>
            <Footer />
        </>
    );
}
