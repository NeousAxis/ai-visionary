
"use client";

import Link from 'next/link';
import { useState, useEffect } from 'react';

export default function AyaPage() {
    const [query, setQuery] = useState("");
    const [results, setResults] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        setLoading(true);
        fetch('/api/aya/live')
            .then(res => res.json())
            .then(apiRes => {
                if (apiRes.success && apiRes.data && Array.isArray(apiRes.data)) {
                    setResults(apiRes.data);
                } else {
                    setResults([]);
                }
            })
            .catch(err => {
                console.warn("AYA Backend connectivity issue.", err);
                setResults([]);
            })
            .finally(() => {
                setLoading(false);
            });
    }, []);

    const displayedResults = results.filter((ent: any) => {
        if (!query) return true;
        const q = query.toLowerCase();
        return (
            (ent.display_name && ent.display_name.toLowerCase().includes(q)) ||
            (ent.legal_name && ent.legal_name.toLowerCase().includes(q)) ||
            (ent.website && ent.website.toLowerCase().includes(q)) ||
            (ent.sector_macro && ent.sector_macro.toLowerCase().includes(q)) ||
            (ent.country_legal && ent.country_legal.toLowerCase().includes(q))
        );
    });

    const certifiedCount = results.filter(e => e.payment_completed).length;
    const indexedCount = results.filter(e => !e.payment_completed).length;

    const isCertified = (entity: any) => entity.payment_completed === true;

    const entityTypeLabel: Record<string, string> = {
        'company': 'Entreprise',
        'association': 'Association',
        'public_body': 'Organisme Public',
        'individual': 'Ind\u00e9pendant',
    };

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
                            Inscrire mon entit&eacute;
                        </Link>
                    </div>
                </div>
            </header>

            {/* HERO SECTION */}
            <section className="section" style={{ textAlign: 'center', paddingBottom: '3rem' }}>
                <div className="container">
                    <span style={{ display: 'inline-block', padding: '5px 15px', borderRadius: '20px', background: 'var(--bg-accent)', color: 'var(--primary-color)', fontSize: '0.8rem', fontWeight: 'bold', textTransform: 'uppercase', marginBottom: '20px', letterSpacing: '1px' }}>
                        R&eacute;seau de Confiance Certifi&eacute;
                    </span>
                    <h1 className="headline" style={{ fontSize: '3.5rem', marginBottom: '20px', maxWidth: '900px', margin: '0 auto 20px' }}>
                        Devenez l&apos;entreprise que l&apos;IA recommande en priorit&eacute;.
                    </h1>
                    <p className="subheadline" style={{ maxWidth: '700px', margin: '0 auto' }}>
                        Rendez votre entreprise visible pour les millions d&apos;utilisateurs qui posent des questions &agrave; l&apos;IA chaque jour (ChatGPT, Gemini, Claude, Mistral, Llama, Ernie...).
                    </p>

                    {/* SEARCH BAR */}
                    <div style={{ maxWidth: '600px', margin: '40px auto 0', position: 'relative' }}>
                        <input
                            type="text"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder="Rechercher une entreprise (ex: 'Stripe', 'Novartis', 'UBS')..."
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

            {/* STATS BAR */}
            {!loading && (
                <div style={{ background: 'white', borderTop: '1px solid var(--border-light)', borderBottom: '1px solid var(--border-light)', padding: '12px 0' }}>
                    <div className="container" style={{ display: 'flex', justifyContent: 'center', gap: '30px', flexWrap: 'wrap' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontSize: '1.4rem', fontWeight: 'bold', color: 'var(--text-main)' }}>{results.length}</span>
                            <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Entreprises dans l&apos;index</span>
                        </div>
                        {certifiedCount > 0 && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#22c55e' }}></span>
                                <span style={{ fontSize: '1.4rem', fontWeight: 'bold', color: '#22c55e' }}>{certifiedCount}</span>
                                <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Certifi&eacute;es ASR</span>
                            </div>
                        )}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#94a3b8' }}></span>
                            <span style={{ fontSize: '1.4rem', fontWeight: 'bold', color: '#64748b' }}>{indexedCount}</span>
                            <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Index&eacute;es AYA</span>
                        </div>
                    </div>
                </div>
            )}

            {/* RESULTS LIST */}
            <section className="section" style={{ background: 'white' }}>
                <div className="container">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '40px' }}>
                        <div>
                            <h2 className="section-title" style={{ fontSize: '2.2rem', marginBottom: '10px' }}>Index des entreprises</h2>
                            <p style={{ color: 'var(--text-muted)' }}>Entreprises analys&eacute;es pour leur lisibilit&eacute; IA — les certifi&eacute;es sont recommand&eacute;es en priorit&eacute;.</p>
                        </div>
                    </div>

                    <div className="grid-3" style={{ rowGap: '30px' }}>
                        {loading ? (
                            <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '40px' }}>Chargement...</div>
                        ) : displayedResults.length > 0 ? (
                            displayedResults.map((entity) => {
                                const certified = isCertified(entity);
                                return (
                                    <div key={entity.id || entity.entity_id || entity.aya_entity_id} className="card" style={{
                                        position: 'relative',
                                        overflow: 'hidden',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        borderLeft: certified ? '3px solid #22c55e' : '3px solid #e2e8f0',
                                    }}>
                                        {/* TOP ROW: Country + Badge */}
                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '15px' }}>
                                            <span style={{ background: 'var(--bg-main)', color: 'var(--text-muted)', padding: '4px 8px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 'bold' }}>
                                                {(entity.country_legal || 'XX').toUpperCase().slice(0, 2)} &bull; {entityTypeLabel[entity.entity_type] || 'Organisation'}
                                            </span>
                                            {certified ? (
                                                <span style={{
                                                    color: '#22c55e',
                                                    fontSize: '0.7rem',
                                                    fontWeight: 'bold',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '4px',
                                                    background: '#f0fdf4',
                                                    padding: '3px 8px',
                                                    borderRadius: '4px',
                                                }}>
                                                    &#x2713; ASR CERTIFI&Eacute;
                                                </span>
                                            ) : (
                                                <span style={{
                                                    color: '#94a3b8',
                                                    fontSize: '0.7rem',
                                                    fontWeight: 'bold',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '4px',
                                                    background: '#f8fafc',
                                                    padding: '3px 8px',
                                                    borderRadius: '4px',
                                                }}>
                                                    &#x25CB; INDEX&Eacute;
                                                </span>
                                            )}
                                        </div>

                                        {/* NAME */}
                                        <Link href={`/aya/e/${entity.id || entity.entity_id || entity.aya_entity_id}`} style={{ textDecoration: 'none' }}>
                                            <h3 style={{ fontSize: '1.4rem', marginBottom: '10px', color: 'var(--text-main)', cursor: 'pointer' }}>
                                                {entity.display_name || entity.legal_name || "Entit\u00e9"}
                                            </h3>
                                        </Link>

                                        {/* SECTOR */}
                                        <p style={{ fontSize: '1rem', color: 'var(--text-muted)', lineHeight: '1.5', flex: 1 }}>
                                            {entity.sector_macro && entity.sector_macro !== 'General' && !/type schema/i.test(entity.sector_macro) && !/^organization$/i.test(entity.sector_macro)
                                                ? entity.sector_macro
                                                : certified ? "Identit\u00e9 S\u00e9mantique optimis\u00e9e pour les IAs." : "Entreprise index\u00e9e par AYA."}
                                        </p>

                                        {/* FOOTER: ID + SCORE */}
                                        <div style={{ marginTop: '20px', paddingTop: '15px', borderTop: '1px solid var(--border-light)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                                                <span style={{ fontFamily: 'monospace', fontSize: '0.7rem', color: '#94a3b8', letterSpacing: '-0.5px' }}>
                                                    ID: aya:{(entity.country_legal || 'xx').toLowerCase()}:{(entity.entity_id || entity.aya_entity_id || entity.id || '').slice(0, 8)}...
                                                </span>
                                            </div>
                                            <div style={{ textAlign: 'right' }}>
                                                <span style={{
                                                    display: 'block',
                                                    fontSize: '1.5rem',
                                                    fontWeight: 'bold',
                                                    color: certified ? 'var(--primary-color)' : '#94a3b8',
                                                    lineHeight: 1,
                                                }}>
                                                    {entity.asr_score != null ? entity.asr_score : '\u2014'}
                                                    <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)', fontWeight: 'normal' }}>/100</span>
                                                </span>
                                                <span style={{ fontSize: '0.7rem', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Score AIO</span>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })
                        ) : (
                            <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '60px', background: 'var(--bg-main)', borderRadius: '16px', border: '1px dashed var(--border-light)' }}>
                                <p style={{ fontSize: '1.2rem', color: 'var(--text-muted)', marginBottom: '20px' }}>Aucun r&eacute;sultat pour &quot;{query}&quot;.</p>
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
                    <h2 style={{ color: 'white', marginBottom: '20px' }}>Prenez le contr&ocirc;le de votre image IA.</h2>
                    <p className="subheadline" style={{ color: 'rgba(255,255,255,0.8)', marginBottom: '20px' }}>
                        Votre entreprise est d&eacute;j&agrave; dans notre index ? Passez &agrave; Certifi&eacute; pour &ecirc;tre recommand&eacute; en priorit&eacute; par les Agents IA.
                    </p>
                    <div style={{ display: 'flex', justifyContent: 'center', gap: '20px', flexWrap: 'wrap' }}>
                        <Link href="/diagnostic?pack=aya-sub" className="btn" style={{ background: 'white', color: 'var(--text-main)' }}>
                            Passer &agrave; Certifi&eacute; (19 CHF/mois)
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
                    <p style={{ color: '#ffffff', opacity: 0.9, fontSize: '0.9rem', fontWeight: '500' }}>Registre AYA v1.0 &bull; Powered by AI Visionary &bull; &#127464;&#127469; Bas&eacute;e &agrave; Gen&egrave;ve</p>
                </div>
            </footer>
        </div>
    );
}
