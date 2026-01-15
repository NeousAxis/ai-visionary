import Link from 'next/link';
import Footer from '../components/Footer';

export default function MentionsPage() {
    return (
        <main>
            <nav className="container" style={{ padding: '2rem 1rem' }}>
                <Link href="/" className="btn btn-secondary">
                    ← Retour à l'accueil
                </Link>
            </nav>

            <section className="section">
                <div className="container">
                    <h1 className="section-title">Mentions Légales</h1>
                    <div className="card">
                        <p><strong>Éditeur du site :</strong><br />
                            AI Visionary<br />
                            Société spécialisée en solutions d'optimisation pour l'IA.</p>

                        <p style={{ marginTop: '20px' }}><strong>Contact :</strong><br />
                            hello@ai-visionary.com</p>

                        <p style={{ marginTop: '20px' }}><strong>Propriété intellectuelle :</strong><br />
                            L'ensemble de ce site relève de la législation suisse et internationale sur le droit d'auteur et la propriété intellectuelle. Tous les droits de reproduction sont réservés.</p>
                    </div>
                </div>
            </section>
            <Footer />
        </main>
    );
}
