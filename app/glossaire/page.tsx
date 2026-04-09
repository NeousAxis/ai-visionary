import Footer from '../components/Footer';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

export async function generateMetadata(): Promise<Metadata> {
    const t = await getTranslations('glossaryPage');
    return {
        title: t('metaTitle'),
        description: t('metaDesc'),
        openGraph: {
            title: t('metaTitle'),
            description: t('metaDesc'),
            url: 'https://ai-visionary.xyz/glossaire',
            siteName: 'AI Visionary',
            type: 'website',
        },
    };
}

const termStyle: React.CSSProperties = { fontSize: '1.05rem', fontWeight: 600, marginTop: '20px', marginBottom: '4px', color: 'var(--primary-color)' };
const defStyle: React.CSSProperties = { marginBottom: '12px', color: 'var(--text-muted)' };

export default async function GlossairePage() {
    const t = await getTranslations('glossaryPage');
    const terms = ['aio', 'asr', 'aya', 'ayo', 'jsonld', 'llm', 'semanticFile', 'aioScore', 'registry', 'indexedEntity', 'certifiedEntity', 'ed25519', 'sitemap'] as const;
    return (
        <>
            <main className="legal-page" style={{ maxWidth: '800px', margin: '0 auto', padding: '60px 20px 40px' }}>
                <h1 style={{ fontSize: '1.8rem', marginBottom: '30px', color: 'var(--text-main)' }}>{t('title')}</h1>
                <p style={{ marginBottom: '30px', color: 'var(--text-muted)' }}>{t('intro')}</p>
                {terms.map((key) => (
                    <div key={key}>
                        <p style={termStyle}>{t(`terms.${key}.term`)}</p>
                        <p style={defStyle}>{t(`terms.${key}.def`)}</p>
                    </div>
                ))}
            </main>
            <Footer />
        </>
    );
}
