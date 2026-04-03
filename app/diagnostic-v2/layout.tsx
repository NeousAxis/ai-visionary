import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'AYO Diagnostic V2 — AI Readability Analysis',
  description: 'Analyze your website AI readability with 7 specialized micro-agents. Get your AIO score and ASR files instantly.',
  openGraph: {
    title: 'AYO Diagnostic V2 — AI Readability Analysis',
    description: 'Analyze your website AI readability with 7 specialized micro-agents.',
  },
};

export default function DiagnosticV2Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
