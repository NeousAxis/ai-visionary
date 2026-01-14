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
      <body className={`${inter.variable} ${outfit.variable}`}>{children}</body>
    </html>
  );
}
