
import React from 'react';
import Link from 'next/link';

export default function Footer() {
    return (
        <footer className="footer">
            <div className="container">
                <div style={{ marginBottom: '30px', opacity: 0.8 }}>
                    <img src="/logo-ai-visionary.png" alt="AI VISIONARY" style={{ height: '40px', width: 'auto' }} />
                </div>
                <div className="footer-links">
                    <Link href="/">Accueil</Link>
                    <Link href="/ai-et-votre-entreprise">IA & votre entreprise</Link>
                    <a href="#">À propos</a>
                    <a href="#">Vision</a>
                    <a href="#">Contact</a>
                    <a href="#">Partenaires</a>
                    <a href="#">Mentions</a>
                    <a href="#">Confidentialité</a>
                    <a href="#" className="disabled">API (à venir)</a>
                </div>
                <p className="footer-copy">© 2025 AI VISIONARY. Tous droits réservés.</p>
            </div>
        </footer>
    );
}
