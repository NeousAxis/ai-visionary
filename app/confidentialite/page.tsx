import Link from 'next/link';
import Footer from '../components/Footer';

export const metadata = {
    title: "Politique de Confidentialité",
};

export default function ConfidentialitePage() {
    return (
        <main>
            <nav className="container" style={{ padding: '2rem 1rem' }}>
                <Link href="/" className="btn btn-secondary">
                    ← Retour à l'accueil
                </Link>
            </nav>

            <section className="section">
                <div className="container" style={{ maxWidth: '800px' }}>
                    <h1 className="section-title">Politique de Confidentialité</h1>
                    <div className="card" style={{ lineHeight: '1.8' }}>

                        <h2 style={{ fontSize: '1.2rem', marginBottom: '10px', color: 'var(--text-main)' }}>1. Responsable du traitement</h2>
                        <p>
                            <strong>AI Visionary</strong> — Genève, Suisse.<br />
                            Contact : <a href="mailto:hello@ai-visionary.com" style={{ color: 'var(--primary-color)' }}>hello@ai-visionary.com</a>
                        </p>

                        <h2 style={{ fontSize: '1.2rem', marginTop: '30px', marginBottom: '10px', color: 'var(--text-main)' }}>2. Données collectées</h2>
                        <p>Dans le cadre de nos services, nous collectons :</p>
                        <ul style={{ paddingLeft: '20px', marginTop: '10px' }}>
                            <li><strong>Diagnostic AYO :</strong> URL du site analysé, réponses au questionnaire, données extraites du site web (contenu public uniquement).</li>
                            <li><strong>Paiement :</strong> email professionnel. Les données bancaires sont traitées exclusivement par <strong>Stripe</strong> (certifié PCI-DSS). Nous ne stockons aucune donnée de carte.</li>
                            <li><strong>Registre AYA :</strong> nom de l'entreprise, secteur, pays, URL, score AIO, fichiers ASR générés.</li>
                        </ul>

                        <h2 style={{ fontSize: '1.2rem', marginTop: '30px', marginBottom: '10px', color: 'var(--text-main)' }}>3. Finalité du traitement</h2>
                        <p>Les données sont utilisées pour :</p>
                        <ul style={{ paddingLeft: '20px', marginTop: '10px' }}>
                            <li>Générer le diagnostic de visibilité IA (Score AIO) et les fichiers de structuration ASR.</li>
                            <li>Inscrire l'entité dans le Registre de Confiance AYA (si achat effectué).</li>
                            <li>Envoyer les fichiers ASR par email.</li>
                        </ul>
                        <p style={{ marginTop: '10px' }}>Les données ne sont <strong>jamais revendues à des tiers</strong>.</p>

                        <h2 style={{ fontSize: '1.2rem', marginTop: '30px', marginBottom: '10px', color: 'var(--text-main)' }}>4. Sous-traitants</h2>
                        <ul style={{ paddingLeft: '20px' }}>
                            <li><strong>Vercel Inc.</strong> — Hébergement du site (États-Unis, clauses contractuelles types).</li>
                            <li><strong>Google Cloud / Firebase</strong> — Stockage des données (région Europe).</li>
                            <li><strong>Stripe</strong> — Traitement des paiements (certifié PCI-DSS).</li>
                            <li><strong>Google Gemini</strong> — Génération de contenu sémantique (données anonymisées).</li>
                            <li><strong>Resend</strong> — Envoi d'emails transactionnels.</li>
                        </ul>

                        <h2 style={{ fontSize: '1.2rem', marginTop: '30px', marginBottom: '10px', color: 'var(--text-main)' }}>5. Durée de conservation</h2>
                        <p>
                            Les données du Registre AYA sont conservées pendant la durée de validité de la certification (1 an pour le Pack Plateforme, 3 ans pour le Pack PRO),
                            puis supprimées dans un délai de 30 jours après expiration sauf renouvellement.
                        </p>

                        <h2 style={{ fontSize: '1.2rem', marginTop: '30px', marginBottom: '10px', color: 'var(--text-main)' }}>6. Cookies</h2>
                        <p>
                            Ce site utilise uniquement des cookies strictement nécessaires à son fonctionnement technique.
                            Aucun cookie publicitaire ou de traçage n'est utilisé.
                        </p>

                        <h2 style={{ fontSize: '1.2rem', marginTop: '30px', marginBottom: '10px', color: 'var(--text-main)' }}>7. Vos droits (RGPD)</h2>
                        <p>Conformément au Règlement Général sur la Protection des Données (RGPD), vous disposez des droits suivants :</p>
                        <ul style={{ paddingLeft: '20px', marginTop: '10px' }}>
                            <li><strong>Accès</strong> : obtenir une copie de vos données personnelles.</li>
                            <li><strong>Rectification</strong> : corriger des données inexactes.</li>
                            <li><strong>Effacement</strong> : demander la suppression de vos données.</li>
                            <li><strong>Portabilité</strong> : recevoir vos données dans un format structuré.</li>
                            <li><strong>Opposition</strong> : vous opposer au traitement de vos données.</li>
                        </ul>
                        <p style={{ marginTop: '10px' }}>
                            Pour exercer ces droits, contactez-nous à : <a href="mailto:hello@ai-visionary.com" style={{ color: 'var(--primary-color)' }}>hello@ai-visionary.com</a>.
                            Nous répondrons dans un délai de 30 jours.
                        </p>

                        <h2 style={{ fontSize: '1.2rem', marginTop: '30px', marginBottom: '10px', color: 'var(--text-main)' }}>8. Droit applicable</h2>
                        <p>
                            La présente politique est soumise au droit suisse et au RGPD pour les utilisateurs résidant dans l'Union européenne.
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
