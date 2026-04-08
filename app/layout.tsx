import type { Metadata } from "next";
import { Inter, Outfit } from "next/font/google";
import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getMessages, getTranslations } from 'next-intl/server';
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const outfit = Outfit({ subsets: ["latin"], variable: "--font-outfit" });

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('meta');
  const locale = await getLocale();
  return {
    metadataBase: new URL('https://ai-visionary.xyz'),
    title: {
      default: t('defaultTitle'),
      template: "%s | AI VISIONARY",
    },
    description: t('description'),
    keywords: t('keywords').split(', '),
    authors: [{ name: "AI Visionary" }],
    openGraph: {
      type: "website",
      locale: locale === 'fr' ? "fr_CH" : "en",
      url: "https://ai-visionary.xyz",
      siteName: "AI VISIONARY",
      title: t('ogTitle'),
      description: t('ogDescription'),
      images: [{ url: "/icon-v2.png", width: 512, height: 512, alt: "AI Visionary Logo" }],
    },
    twitter: {
      card: "summary",
      title: t('twitterTitle'),
      description: t('twitterDescription'),
      images: ["/icon-v2.png"],
    },
    robots: {
      index: true,
      follow: true,
    },
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getLocale();
  const messages = await getMessages();

  return (
    <html lang={locale}>
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
              "@context": ["https://schema.org", { "ayo": "https://www.ai-visionary.xyz/ns/ayo#" }],
              "@type": "Organization",
              "@id": "https://www.ai-visionary.xyz/#organization",
              "name": "AI-Visionary",
              "url": "https://www.ai-visionary.xyz/",
              "description": "Cabinet et service spécialisé dans la structuration de données et de contenus afin de rendre les entreprises lisibles, identifiables et sélectionnables par les intelligences artificielles (AIO).",
              "logo": "https://www.ai-visionary.xyz/icon-v2.png",
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
        <NextIntlClientProvider messages={messages}>
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
