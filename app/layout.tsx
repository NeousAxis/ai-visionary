import type { Metadata } from "next";
import { Inter, Outfit } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const outfit = Outfit({ subsets: ["latin"], variable: "--font-outfit" });

export const metadata: Metadata = {
  title: "AI VISIONARY",
  description: "Un Internet lisible. Une visibilité durable. AYA et AIO structurent et rendent lisible le web pour l'IA.",
  icons: {
    icon: '/logo.png', // Fallback manuel si Next.js n'a pas fini de générer
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr">
      <body className={`${inter.variable} ${outfit.variable}`}>{children}</body>
    </html>
  );
}
