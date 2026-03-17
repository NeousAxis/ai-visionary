import type { Metadata } from "next";
import { Inter, Outfit } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const outfit = Outfit({ subsets: ["latin"], variable: "--font-outfit" });

export const metadata: Metadata = {
  metadataBase: new URL('https://ai-visionary.com'),
  title: {
    default: "AI VISIONARY — Rendez votre entreprise visible par l'IA",
    template: "%s | AI VISIONARY",
  },
  description: "Rendez votre entreprise lisible, visible et recommandable par les IA (ChatGPT, Gemini, Claude). Diagnostic gratuit, fichiers ASR certifiés, Registre AYA.",
  keywords: ["AIO", "visibilité IA", "ChatGPT", "Gemini", "Claude", "ASR", "AYA", "référencement IA", "AI Visionary", "Genève"],
  authors: [{ name: "AI Visionary" }],
  openGraph: {
    type: "website",
    locale: "fr_CH",
    url: "https://ai-visionary.com",
    siteName: "AI VISIONARY",
    title: "AI VISIONARY — Rendez votre entreprise visible par l'IA",
    description: "Diagnostic gratuit de visibilité IA. Fichiers ASR certifiés pour être recommandé par ChatGPT, Gemini, Claude et tous les agents IA.",
    images: [{ url: "/icon-v2.png", width: 512, height: 512, alt: "AI Visionary Logo" }],
  },
  twitter: {
    card: "summary",
    title: "AI VISIONARY — Visibilité IA pour votre entreprise",
    description: "Rendez votre entreprise lisible et recommandable par les IA.",
    images: ["/icon-v2.png"],
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr">
      <head>
        <link rel="icon" href="/icon-v2.png" sizes="any" />
        <link rel="apple-touch-icon" href="/icon-v2.png" />
      </head>
      <body className={`${inter.variable} ${outfit.variable}`}>
        {/* AYO ASR Injection for AI Readability */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": ["https://schema.org", { "ayo": "https://www.ai-visionary.com/ns/ayo#" }],
              "@type": "Organization",
              "@id": "https://www.ai-visionary.com/#organization",
              "name": "AI-Visionary",
              "url": "https://www.ai-visionary.com/",
              "description": "Cabinet et service spécialisé dans la structuration de données et de contenus afin de rendre les entreprises lisibles, identifiables et sélectionnables par les intelligences artificielles (AIO).",
              "logo": "https://www.ai-visionary.com/icon-v2.png",
              "areaServed": ["CH", "FR", "BE"],
              "ayo:sector": {
                "primary": "Artificial Intelligence Services",
                "secondary": ["Artificial Intelligence Optimization (AIO)", "Data Structuring", "Digital Knowledge Representation"]
              },
              "ayo:offer": {
                "services": ["AI-readiness audit", "Information structuring for IA", "AIO score evaluation", "ASR (AI Singular Record) generation"]
              }
            })
          }}
        />
        {children}
      </body>
    </html>
  );
}
