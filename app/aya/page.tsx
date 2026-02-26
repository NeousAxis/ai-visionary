
"use client";

import Link from 'next/link';
import { useState, useEffect } from 'react';

// =========================================================================================
// 🚨 ZONE DE DONNÉES DE DÉMONSTRATION (MOCK DATA) 🚨
// =========================================================================================
// CES ENTITÉS SONT FICTIVES ET SERVENT À PEUPLER LE REGISTRE AVANT L'ARRIVÉE DES PREMIERS CLIENTS.
// 👉 À SUPPRIMER OU COMMENTER dès que la connexion à la vraie base de données (Firestore) est active.
// 👉 Le système utilise des UUIDs, donc la suppression de ces lignes ne cassera pas la numérotation.
// =========================================================================================
export default function AyaPage() {
    const [query, setQuery] = useState("");
    const [results, setResults] = useState<any[]>([]); // Start empty, no fake data
    const [loading, setLoading] = useState(true);

    // CONNEXION BACKEND RÉEL
    useEffect(() => {
        setLoading(true);
        fetch('/api/aya/live')
            .then(res => res.json())
            .then(apiRes => {
                if (apiRes.success && apiRes.data && Array.isArray(apiRes.data)) {
                    console.log(`🔥 AYA LIVE: Loading ${apiRes.data.length} real entities from Firestore/DB!`);
                    setResults(apiRes.data);
                } else {
                    console.log("ℹ️ AYA: No live data found.");
                    setResults([]);
                }
            })
            .catch(err => {
                console.warn("⚠️ AYA Backend connectivity issue.", err);
                setResults([]);
            })
            .finally(() => {
                setLoading(false);
            });
    }, []);

    // Correction de la logique de recherche pour supporter le mode Live
    const displayedResults = results.filter((ent: any) => {
        if (!query) return true;
        const q = query.toLowerCase();
        return (
            (ent.name && ent.name.toLowerCase().includes(q)) ||
            (ent.display_name && ent.display_name.toLowerCase().includes(q)) ||
            (ent.description && ent.description.toLowerCase().includes(q)) ||
            (ent.website && ent.website.toLowerCase().includes(q)) || // Added website search
            (ent.sector && ent.sector.toLowerCase().includes(q)) ||
            (ent.country && ent.country.toLowerCase().includes(q))
        );
    });

    return (
        <div style={{ background: 'var(--bg-main)', minHeight: '100vh', fontFamily: 'var(--font-body)' }}>

            {/* HEADER */}
            <header style={{ background: 'white', borderBottom: '1px solid var(--border-light)', position: 'sticky', top: 0, zIndex: 100, padding: '15px 0' }}>
                <div className="container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: '15px', textDecoration: 'none' }}>
                        <img src="/logo-v2.png" alt="AI Visionary" style={{ height: '40px', width: 'auto' }} />
                        <div style={{ height: '24px', width: '1px', background: 'var(--border-light)' }}></div>
                        <span style={{ fontSize: '1.2rem', fontWeight: 'bold', color: 'var(--text-main)', letterSpacing: '-0.02em' }}>
                            REGISTRE <span style={{ color: 'var(--primary-color)', fontWeight: '400' }}>AYA</span>
                        </span>
                    </Link>

                    <div style={{ display: 'flex', gap: '15px' }}>
                        <Link href="/diagnostic?pack=aya-sub" className="btn btn-primary" style={{ padding: '0.6rem 1.2rem', fontSize: '0.9rem' }}>
                            Inscrire mon entité
                        </Link>
                    </div>
                </div>
            </header>

            {/* HERO SECTION */}
            <section className="section" style={{ textAlign: 'center', paddingBottom: '3rem' }}>
                <div className="container">
                    <span style={{ display: 'inline-block', padding: '5px 15px', borderRadius: '20px', background: 'var(--bg-accent)', color: 'var(--primary-color)', fontSize: '0.8rem', fontWeight: 'bold', textTransform: 'uppercase', marginBottom: '20px', letterSpacing: '1px' }}>
                        Réseau de Confiance Certifié
                    </span>
                    <h1 className="headline" style={{ fontSize: '3.5rem', marginBottom: '20px', maxWidth: '900px', margin: '0 auto 20px' }}>
                        Devenez l'entreprise que l'IA recommande en priorité.
                    </h1>
                    <p className="subheadline" style={{ maxWidth: '700px', margin: '0 auto' }}>
                        Rendez votre entreprise visible pour les millions d'utilisateurs qui posent des questions à l'IA chaque jour (ChatGPT, Gemini, Claude, Mistral, Llama, Ernie...).
                    </p>

                    {/* SEARCH BAR */}
                    <div style={{ maxWidth: '600px', margin: '40px auto 0', position: 'relative' }}>
                        <input
                            type="text"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder="Rechercher une entité (ex: 'Horlogerie Suisse', 'Restaurant Paris')..."
                            style={{
                                width: '100%',
                                padding: '18px 25px',
                                borderRadius: '50px',
                                border: '1px solid var(--border-light)',
                                fontSize: '1.1rem',
                                boxShadow: 'var(--shadow-md)',
                                outline: 'none',
                                color: 'var(--text-main)'
                            }}
                        />
                    </div>
                </div>
            </section>

            {/* RESULTS LIST */}
            <section className="section" style={{ background: 'white', borderTop: '1px solid var(--border-light)' }}>
                <div className="container">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '40px' }}>
                        <div>
                            <h2 className="section-title" style={{ fontSize: '2.2rem', marginBottom: '10px' }}>Dernières Certifications en temps réel</h2>
                            <p style={{ color: 'var(--text-muted)' }}>Ces entreprises viennent d'obtenir leur validité ASR pour être citées par les Agents IA.</p>
                        </div>
                        <div style={{ background: 'var(--bg-accent)', padding: '5px 12px', borderRadius: '8px', fontSize: '0.9rem', color: 'var(--primary-color)', fontWeight: 'bold' }}>
                            {loading ? 'Chargement...' : `${results.length} Entités Réelles`}
                        </div>
                    </div>

                    <div className="grid-3" style={{ rowGap: '30px' }}>
                        {loading ? (
                            <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '40px' }}>Loading...</div>
                        ) : displayedResults.length > 0 ? (
                            displayedResults.map((entity) => (
                                <div key={entity.id || entity.aya_entity_id} className="card" style={{ position: 'relative', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '15px' }}>
                                        <span style={{ background: 'var(--bg-main)', color: 'var(--text-muted)', padding: '4px 8px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 'bold' }}>
                                            {(entity.country || entity.country_legal || 'XX').toUpperCase().slice(0, 2)} • {
                                                ({ 'company': 'Entreprise', 'association': 'Association', 'public_body': 'Organisme Public', 'individual': 'Indépendant' } as Record<string, string>)[entity.type || entity.entity_type] || 'Organisation'
                                            }
                                        </span>
                                        {(entity.status === 'verified' || entity.recommendability?.status === 'fresh') && (
                                            <span style={{ color: 'var(--primary-color)', fontSize: '0.75rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                ✓ ASR VALIDÉ
                                            </span>
                                        )}
                                    </div>

                                    <Link href={`/aya/e/${entity.id || entity.aya_entity_id}`} style={{ textDecoration: 'none' }}>
                                        <h3 style={{ fontSize: '1.4rem', marginBottom: '10px', color: 'var(--text-main)', cursor: 'pointer' }}>
                                            {entity.name || entity.display_name}
                                        </h3>
                                    </Link>
                                    <p style={{ fontSize: '1rem', color: 'var(--text-muted)', lineHeight: '1.5', flex: 1 }}>{entity.description || "Identité Sémantique optimisée pour les IAs."}</p>

                                    <div style={{ marginTop: '20px', paddingTop: '15px', borderTop: '1px solid var(--border-light)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                                            <span style={{ fontFamily: 'monospace', fontSize: '0.7rem', color: '#94a3b8', letterSpacing: '-0.5px' }}>
                                                ID: aya:{(entity.country || entity.country_legal || 'xx').toLowerCase()}:{(entity.id || entity.aya_entity_id).slice(0, 8)}...
                                            </span>
                                        </div>
                                        <div style={{ textAlign: 'right' }}>
                                            <span style={{ display: 'block', fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--primary-color)', lineHeight: 1 }}>{entity.asr_score || Math.round((entity.recommendability?.freshness_score || 0.99) * 100)}%</span>
                                            <span style={{ fontSize: '0.7rem', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Trust Score</span>
                                        </div>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '60px', background: 'var(--bg-main)', borderRadius: '16px', border: '1px dashed var(--border-light)' }}>
                                <p style={{ fontSize: '1.2rem', color: 'var(--text-muted)', marginBottom: '20px' }}>Aucun résultat pour "{query}".</p>
                                <Link href="/diagnostic?pack=aya-sub" className="btn btn-primary">
                                    Inscrire mon entreprise
                                </Link>
                            </div>
                        )}
                    </div>
                </div>
            </section>

            {/* CTA SECTION */}
            <section className="section" style={{ background: 'var(--text-main)', color: 'white', textAlign: 'center' }}>
                <div className="container">
                    <h2 style={{ color: 'white', marginBottom: '20px' }}>Prenez le contrôle de votre image IA.</h2>
                    <p className="subheadline" style={{ color: 'rgba(255,255,255,0.8)', marginBottom: '40px' }}>
                        Rejoignez le registre officiel et assurez-vous que tous les Agents IA parlent de vous correctement.
                    </p>
                    <div style={{ display: 'flex', justifyContent: 'center', gap: '20px', flexWrap: 'wrap' }}>
                        <Link href="/diagnostic?pack=aya-sub" className="btn" style={{ background: 'white', color: 'var(--text-main)' }}>
                            S'abonner au Registre (19 CHF/mois)
                        </Link>
                        <Link href="/diagnostic" className="btn" style={{ border: '1px solid rgba(255,255,255,0.3)', color: 'white' }}>
                            Faire un Audit Gratuit
                        </Link>
                    </div>
                </div>
            </section>

            {/* FOOTER */}
            <footer className="footer" style={{ background: 'var(--text-main)', color: 'white', padding: '40px 0', textAlign: 'center' }}>
                <div className="container">
                    <p style={{ color: '#ffffff', opacity: 0.9, fontSize: '0.9rem', fontWeight: '500' }}>Registre AYA v1.0 • Powered by AI Visionary</p>
                </div>
            </footer>
        </div>
    );
}
