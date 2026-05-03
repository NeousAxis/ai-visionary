import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'AYO Diagnostic — Make your company readable by all AI',
  description: 'Analyze your website AI readability with 8 specialized agents. Get your AIO score and ASR files instantly.',
  openGraph: {
    title: 'AYO Diagnostic — Make your company readable by all AI',
    description: 'Analyze your website AI readability with 8 specialized agents.',
    type: 'website',
    url: 'https://ai-visionary.xyz/diagnostic',
    siteName: 'AI Visionary',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'AYO Diagnostic — Make your company readable by all AI',
    description: 'Analyze your website AI readability with 8 specialized agents.',
  },
};

export default function DiagnosticV2Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
