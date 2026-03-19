import Link from 'next/link';
import Footer from '../components/Footer';

export const metadata = {
    title: "Mentions Légales",
};

export default function MentionsPage() {
    return (
        <main>
            <nav className="container" style={{ padding: '2rem 1rem' }}>
                <Link href="/" className="btn btn-secondary">
                    ← Retour à l&apos;accueil
                </Link>
            </nav>

            <section className="section">
                <div className="container" style={{ maxWidth: '800px' }}>
                    <h1 className="section-title">Mentions Légales</h1>
                    <div className="card" style={{ lineHeight: '1.8' }}>

                        <h2 style={{ fontSize: '1.2rem', marginBottom: '10px', color: 'var(--text-main)' }}>1. Éditeur du site</h2>
                        <p>
                            <strong>AI Visionary</strong><br />
                            Service spécialisé en structuration de données pour l&apos;intelligence artificielle (AIO).<br />
                            Basée à Genève, Suisse.<br />
                            Contact : <a href="mailto:hello@ai-visionary.com" style={{ color: 'var(--primary-color)' }}>hello@ai-visionary.com</a>
                        </p>

                        <h2 style={{ fontSize: '1.2rem', marginTop: '30px', marginBottom: '10px', color: 'var(--text-main)' }}>2. Hébergement</h2>
                        <p>
                            Le site est hébergé par <strong>Vercel Inc.</strong>, 440 N Baxter St, Covina, CA 91723, États-Unis.<br />
                            Les données applicatives sont stockées via <strong>Google Cloud (Firebase)</strong> dans la région Europe (europe-west).
                        </p>

                        <h2 style={{ fontSize: '1.2rem', marginTop: '30px', marginBottom: '10px', color: 'var(--text-main)' }}>3. Propriété intellectuelle</h2>
                        <p>
                            L&apos;ensemble du contenu de ce site (textes, images, code, protocoles ASR, scoring AIO) est protégé par le droit d&apos;auteur
                            et relève de la législation suisse et internationale sur la propriété intellectuelle.
                            Toute reproduction, même partielle, est soumise à autorisation préalable.
                        </p>

                        <h2 style={{ fontSize: '1.2rem', marginTop: '30px', marginBottom: '10px', color: 'var(--text-main)' }}>4. Responsabilité</h2>
                        <p>
                            AI Visionary s&apos;efforce de fournir des informations exactes et à jour. Toutefois, aucune garantie n&apos;est donnée
                            quant à l&apos;exhaustivité ou l&apos;exactitude des contenus. L&apos;utilisation des services se fait sous la responsabilité de l&apos;utilisateur.
                        </p>

                        <h2 style={{ fontSize: '1.2rem', marginTop: '30px', marginBottom: '10px', color: 'var(--text-main)' }}>5. Droit applicable</h2>
                        <p>
                            Les présentes mentions sont soumises au droit suisse. Tout litige sera porté devant les tribunaux compétents du canton de Genève.
                        </p>

                        <p style={{ marginTop: '30px', fontSize: '0.85rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                            Dernière mise à jour : mars 2026
                        </p>
                    </div>
                </div>
            </section>
            <Footer />
        </main>
    );
}
