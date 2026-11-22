"use client";

import React from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import LanguageToggle from './LanguageToggle';

// Lien Pollen Agents masqué le 22.11.2026 avec la section de l'accueil (app/page.tsx, SHOW_POLLEN).
const SHOW_POLLEN = false;

export default function Footer() {
    const t = useTranslations('nav');
    const tf = useTranslations('footer');
    return (
        <footer className="footer">
            <div className="container">

                <div className="footer-links">
                    <Link href="/">{t('home')}</Link>
                    <Link href="/aya">{t('ayaRegistry')}</Link>
                    {SHOW_POLLEN && <Link href="/pollen-agents">{t('pollenAgents')}</Link>}
                    <Link href="/for-agents">{t('forAgents')}</Link>
                    <Link href="/ai-et-votre-entreprise">{t('aiAndBusiness')}</Link>
                    <Link href="/developers">{t('apiDevelopers')}</Link>
                    <a href="mailto:hello@ai-visionary.xyz">{t('contact')}</a>
                    <Link href="/faq">{t('faq')}</Link>
                    <Link href="/glossaire">{t('glossary')}</Link>
                    <Link href="/cgv">{t('cgv')}</Link>
                    <Link href="/mentions">{t('legal')}</Link>
                    <Link href="/confidentialite">{t('privacy')}</Link>
                    <LanguageToggle />
                </div>
                <p className="footer-copy">{tf('copyright')}</p>
            </div>
        </footer>
    );
}
