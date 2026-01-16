import type { Metadata } from "next";
import { Inter, Outfit } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const outfit = Outfit({ subsets: ["latin"], variable: "--font-outfit" });

export const metadata: Metadata = {
  title: "AI VISIONARY",
  description: "Un Internet lisible. Une visibilité durable. AYA et AIO structurent et rendent lisible le web pour l'IA.",

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
                "services": ["AI-readiness audit", "Information structuring for IA", "AIO score evaluation", "ASR (AYO Singular Record) generation"]
              }
            })
          }}
        />
        {children}
      </body>
    </html>
  );
}
