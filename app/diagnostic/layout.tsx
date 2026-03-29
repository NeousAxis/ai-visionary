import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

export async function generateMetadata(): Promise<Metadata> {
    const t = await getTranslations('diagnostic');
    return {
        title: t('metaTitle'),
        description: t('metaDescription'),
        openGraph: {
            title: t('metaOgTitle'),
            description: t('metaOgDescription'),
            url: 'https://ai-visionary.com/diagnostic',
            siteName: 'AI Visionary',
            type: 'website',
        },
    };
}

export default function DiagnosticLayout({ children }: { children: React.ReactNode }) {
    return <>{children}</>;
}
