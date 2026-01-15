
import React from 'react';
import Link from 'next/link';

export default function Footer() {
    return (
        <footer className="footer">
            <div className="container">

                <div className="footer-links">
                    <Link href="/">Accueil</Link>
                    <Link href="/ai-et-votre-entreprise">IA & votre entreprise</Link>

                    <a href="mailto:hello@ai-visionary.com">Contact</a>
                    <Link href="/mentions">Mentions</Link>
                    <Link href="/confidentialite">Confidentialité</Link>
                </div>
                <p className="footer-copy">© 2025 AI VISIONARY. Tous droits réservés.</p>
            </div>
        </footer>
    );
}
