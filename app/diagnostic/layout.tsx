import type { Metadata } from 'next';

export const metadata: Metadata = {
    title: 'Diagnostic AIO gratuit — Testez votre visibilite IA',
    description:
        'Analysez gratuitement la lisibilite IA de votre site web. Score AIO de 0 a 100, recommandations personnalisees et fichiers ASR pour etre recommande par ChatGPT, Gemini, Claude.',
    openGraph: {
        title: 'Diagnostic AIO gratuit — AI Visionary',
        description:
            'Testez gratuitement si votre entreprise est visible par les IA. Score AIO immediat, sans engagement.',
        url: 'https://ai-visionary.com/diagnostic',
        siteName: 'AI Visionary',
        type: 'website',
    },
};

export default function DiagnosticLayout({ children }: { children: React.ReactNode }) {
    return <>{children}</>;
}
