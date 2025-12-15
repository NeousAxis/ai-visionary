
import React from 'react';
import Link from 'next/link';

export default function ComprendrePage() {
    return (
        <main>
            {/* Header / Nav */}
            <nav className="container" style={{ padding: '2rem 1rem' }}>
                <Link href="/" className="btn btn-secondary">
                    ← Retour à l'accueil
                </Link>
            </nav>

            {/* Hero Section */}
            <section className="section" style={{ paddingTop: '1rem', paddingBottom: '1rem' }}>
                <div className="container hero-content">
                    <h1 className="headline" style={{ fontSize: '3rem' }}>
                        Comment les IA comprennent votre entreprise
                    </h1>
                    <div className="subheadline">
                        <p className="highlight">
                            De plus en plus de personnes posent leurs questions directement à des intelligences artificielles.
                        </p>
                        <p>
                            Cette page explique ce que les IA peuvent comprendre de votre entreprise, et pourquoi structurer vos informations change leur comportement, sans SEO, sans publicité, sans classement.
                        </p>
                    </div>
                </div>
            </section>

            {/* 1. Avant ASR */}
            <section className="section">
                <div className="container">
                    <div className="card" style={{ borderColor: 'rgba(239, 68, 68, 0.3)' }}>
                        <h2 style={{ marginBottom: '1rem', color: '#ef4444' }}>1. Avant une déclaration structurée : ce que l’IA perçoit</h2>
                        <p style={{ marginBottom: '1rem' }}>
                            Sans cadre explicite, une IA lit votre site comme un humain : des textes narratifs, des valeurs, des intentions, des formulations parfois ambiguës.
                        </p>
                        <p style={{ marginBottom: '1rem' }}><strong>Pour une IA, cela implique :</strong></p>
                        <ul className="clean-list" style={{ marginBottom: '1rem' }}>
                            <li>Un risque d’interprétation,</li>
                            <li>Une peur d’inventer un rôle, une compétence, un statut,</li>
                            <li>Des réponses prudentes, vagues, ou une absence de citation.</li>
                        </ul>
                        <p className="highlight" style={{ color: '#ef4444' }}>👉 Par prudence, l’IA évite de vous nommer… ou hallucine avec retenue.</p>
                    </div>
                </div>
            </section>

            {/* 2. Après ASR */}
            <section className="section">
                <div className="container">
                    <div className="card" style={{ borderColor: 'rgba(16, 185, 129, 0.3)', background: 'rgba(16, 185, 129, 0.05)' }}>
                        <h2 style={{ marginBottom: '1rem', color: '#10b981' }}>2. Après une déclaration structurée et scellée : ce qui change</h2>
                        <p style={{ marginBottom: '1rem' }}>
                            Avec une déclaration explicite (ASR – AYO Singular Record), votre entreprise devient pour l’IA :
                        </p>
                        <ul className="clean-list" style={{ marginBottom: '1rem' }}>
                            <li>Une entité clairement bornée,</li>
                            <li>Un périmètre d’activité déclaré,</li>
                            <li>Une source stable, non ambiguë.</li>
                        </ul>
                        <p className="highlight" style={{ color: '#10b981' }}>👉 L’IA peut alors oser nommer, oser citer, oser mentionner votre entreprise sans inventer, sans extrapoler, sans promettre.</p>
                    </div>
                </div>
            </section>

            {/* 3. Cas concrets */}
            <section className="section">
                <div className="container">
                    <h2 className="section-title">Dans quels cas concrets une IA peut vous citer</h2>

                    <div className="process-steps">
                        {/* Cas 1 */}
                        <div className="step">
                            <span className="step-number" style={{ fontSize: '1.5rem', opacity: 0.7 }}>Cas 1</span>
                            <h4>Question factuelle / exploratoire</h4>
                            <p style={{ fontStyle: 'italic', marginBottom: '0.5rem' }}>« Quelles entreprises ou organisations travaillent sur [votre domaine] dans [votre région] ? »</p>
                            <ul className="clean-list" style={{ fontSize: '0.9rem' }}>
                                <li style={{ color: '#ef4444' }}><strong>Sans cadre :</strong> réponse générique, acteurs non nommés.</li>
                                <li style={{ color: '#10b981' }}><strong>Avec ASR :</strong> l’IA peut mentionner votre entreprise comme acteur déclaré, sans jugement.</li>
                            </ul>
                        </div>

                        {/* Cas 2 */}
                        <div className="step">
                            <span className="step-number" style={{ fontSize: '1.5rem', opacity: 0.7 }}>Cas 2</span>
                            <h4>Question d’orientation (sans recommandation)</h4>
                            <p style={{ fontStyle: 'italic', marginBottom: '0.5rem' }}>« Existe-t-il des structures qui proposent [type de service] ? »</p>
                            <p style={{ fontSize: '0.9rem', marginBottom: '0.5rem' }}>Les IA évitent les recommandations (“la meilleure”). Mais elles peuvent :</p>
                            <ul className="clean-list" style={{ fontSize: '0.9rem' }}>
                                <li>Décrire des types d’acteurs,</li>
                                <li>Citer des exemples déclarés.</li>
                            </ul>
                            <p className="highlight" style={{ fontSize: '0.9rem', marginTop: '0.5rem', color: '#10b981' }}>👉 Votre entreprise devient mentionnable, car son périmètre est clair.</p>
                        </div>

                        {/* Cas 3 */}
                        <div className="step">
                            <span className="step-number" style={{ fontSize: '1.5rem', opacity: 0.7 }}>Cas 3</span>
                            <h4>Question professionnelle ou institutionnelle</h4>
                            <p style={{ fontStyle: 'italic', marginBottom: '0.5rem' }}>« Comment des organisations peuvent-elles aborder [un enjeu précis] ? »</p>
                            <ul className="clean-list" style={{ fontSize: '0.9rem' }}>
                                <li style={{ color: '#ef4444' }}><strong>Sans déclaration :</strong> méthodes génériques.</li>
                                <li style={{ color: '#10b981' }}><strong>Avec déclaration :</strong> l’IA peut pointer des acteurs qui déclarent intervenir sur ce sujet, dont votre entreprise.</li>
                            </ul>
                        </div>
                    </div>
                </div>
            </section>

            {/* 4. Pourquoi l'IA n'hallucine plus */}
            <section className="section">
                <div className="container">
                    <div className="grid-2">
                        <div className="card">
                            <h3>4. Pourquoi l’IA n’hallucine plus quand tout est déclaré</h3>
                            <p style={{ marginTop: '1rem' }}>Parce qu’une déclaration structurée :</p>
                            <ul className="clean-list">
                                <li>Dit ce que vous êtes,</li>
                                <li>Dit ce que vous faites,</li>
                                <li>Dit aussi ce que vous ne déclarez pas.</li>
                            </ul>
                            <p style={{ marginTop: '1rem' }}><strong>L’IA n’a plus besoin de :</strong></p>
                            <ul className="clean-list">
                                <li>Combler les vides,</li>
                                <li>Interpréter votre discours,</li>
                                <li>Projeter des compétences implicites.</li>
                            </ul>
                            <p className="highlight" style={{ marginTop: '1rem' }}>👉 Moins de liberté d’interprétation = plus de citations possibles.</p>
                        </div>

                        <div className="card">
                            <h3>5. Ce qui déclenche réellement la mention par une IA</h3>
                            <p style={{ marginTop: '1rem', color: '#ef4444', textDecoration: 'line-through' }}>Pas le SEO. Pas la popularité. Pas un score marketing.</p>
                            <p style={{ marginTop: '1rem', fontWeight: 'bold' }}>Mais :</p>
                            <ul className="clean-list">
                                <li><strong>Correspondance sémantique claire :</strong> La question posée correspond exactement à ce que vous déclarez.</li>
                                <li><strong>Faible risque d’erreur :</strong> L’IA peut répondre sans extrapoler.</li>
                                <li><strong>Contexte neutre :</strong> Les IA préfèrent décrire, mentionner, illustrer, plutôt que recommander.</li>
                            </ul>
                            <p className="highlight" style={{ marginTop: '1rem' }}>👉 Être mentionnable est le prérequis à toute visibilité IA.</p>
                        </div>
                    </div>
                </div>
            </section>

            {/* Conclusion */}
            <section className="section cta-final-section">
                <div className="container">
                    <h2 className="section-title">À retenir</h2>
                    <p className="final-phrase" style={{ fontSize: '1.5rem', fontStyle: 'italic', maxWidth: '800px', margin: '0 auto' }}>
                        "Les IA ne citent pas ce qui est le plus visible.<br />
                        Elles citent ce qu’elles peuvent comprendre sans se tromper."
                    </p>
                    <p style={{ marginTop: '2rem', color: 'var(--text-muted)' }}>
                        C’est exactement le rôle d’une déclaration structurée et scellée.
                    </p>
                    <div style={{ marginTop: '3rem' }}>
                        <Link href="/" className="btn btn-primary">
                            Comprendre comment AYO peut vous aider
                        </Link>
                    </div>
                </div>
            </section>

            {/* Footer */}
            <footer className="footer">
                <div className="container">
                    <div className="footer-links">
                        <Link href="/">Accueil</Link>
                    </div>
                    <p className="footer-copy">© 2025 AI VISIONARY. Tous droits réservés.</p>
                </div>
            </footer>
        </main>
    );
}
