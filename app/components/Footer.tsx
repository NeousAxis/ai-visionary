
import React from 'react';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import LanguageToggle from './LanguageToggle';

export default async function Footer() {
    const t = await getTranslations('nav');
    const tf = await getTranslations('footer');

    return (
        <footer className="footer">
            <div className="container">

                <div className="footer-links">
                    <Link href="/">{t('home')}</Link>
                    <Link href="/aya">{t('ayaRegistry')}</Link>
                    <Link href="/ai-et-votre-entreprise">{t('aiAndBusiness')}</Link>
                    <Link href="/developers">{t('apiDevelopers')}</Link>
                    <a href="mailto:hello@ai-visionary.com">{t('contact')}</a>
                    <Link href="/mentions">{t('legal')}</Link>
                    <Link href="/confidentialite">{t('privacy')}</Link>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px', marginTop: '8px' }}>
                    <p className="footer-copy" style={{ margin: 0 }}>{tf('copyright')}</p>
                    <LanguageToggle />
                </div>
            </div>
        </footer>
    );
}
