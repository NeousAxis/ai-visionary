import Link from 'next/link';
import Footer from '../components/Footer';

export default function ConfidentialitePage() {
    return (
        <main>
            <nav className="container" style={{ padding: '2rem 1rem' }}>
                <Link href="/" className="btn btn-secondary">
                    ← Retour à l'accueil
                </Link>
            </nav>

            <section className="section">
                <div className="container">
                    <h1 className="section-title">Politique de Confidentialité</h1>
                    <div className="card">
                        <p><strong>Collecte des données :</strong><br />
                            AI Visionary s'engage à ce que la collecte et le traitement de vos données soient conformes au règlement général sur la protection des données (RGPD).</p>

                        <p style={{ marginTop: '20px' }}><strong>Finalité des données :</strong><br />
                            Les informations recueillies (notamment via le diagnostic) sont utilisées pour générer les rapports d'analyse et les fichiers de structuration IA. Elles ne sont pas revendues à des tiers.</p>

                        <p style={{ marginTop: '20px' }}><strong>Cookies :</strong><br />
                            Ce site utilise un minimum de cookies nécessaires à son bon fonctionnement.</p>

                        <p style={{ marginTop: '20px' }}><strong>Vos droits :</strong><br />
                            Vous disposez d'un droit d'accès, de rectification et d'effacement de vos données. Pour l'exercer, contactez-nous à hello@ai-visionary.com.</p>
                    </div>
                </div>
            </section>
            <Footer />
        </main>
    );
}
