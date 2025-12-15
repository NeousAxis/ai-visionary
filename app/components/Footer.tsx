
import React from 'react';
import Link from 'next/link';

export default function Footer() {
    return (
        <footer className="footer">
            <div className="container">
                <div className="footer-links">
                    <Link href="/">Accueil</Link>
                    <Link href="/ai-et-votre-entreprise">IA & votre entreprise</Link>
                    <a href="#">À propos</a>
                    <a href="#">Vision</a>
                    <a href="#">Contact</a>
                    <a href="#">Mentions</a>
                </div>
                <p className="footer-copy">© 2025 AI VISIONARY. Tous droits réservés.</p>
            </div>
        </footer>
    );
}
