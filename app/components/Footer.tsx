
import React from 'react';
import Link from 'next/link';

export default function Footer() {
    return (
        <footer className="footer">
            <div className="container">

                <div className="footer-links">
                    <Link href="/">Accueil</Link>
                    <Link href="/aya">Registre AYA</Link>
                    <Link href="/ai-et-votre-entreprise">IA & votre entreprise</Link>
                    <Link href="/developers">API &amp; D&eacute;veloppeurs</Link>
                    <a href="mailto:hello@ai-visionary.com">Contact</a>
                    <Link href="/mentions">Mentions</Link>
                    <Link href="/confidentialite">Confidentialit&eacute;</Link>
                </div>
                <p className="footer-copy">© 2026 AI VISIONARY. Tous droits réservés. 🇨🇭 Basée à Genève</p>
            </div>
        </footer>
    );
}
