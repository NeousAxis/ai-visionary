
"use client";

import Link from 'next/link';
import { useState, useEffect, useMemo } from 'react';

const ENTITY_TYPE_LABELS: Record<string, string> = {
    'company': 'Entreprise',
    'association': 'Association',
    'public_body': 'Organisme Public',
    'individual': 'Indépendant',
};

const getEntityId = (e: any): string => e.entity_id || e.aya_entity_id || e.id || '';

/** Deterministic shuffle — uses FNV-1a hash for better distribution across entity IDs */
function deterministicShuffle<T>(arr: T[], getId: (item: T) => string): T[] {
    const fnv1a = (s: string) => {
        let h = 0x811c9dc5;
        for (let i = 0; i < s.length; i++) {
            h ^= s.charCodeAt(i);
            h = Math.imul(h, 0x01000193);
        }
        return h >>> 0;
    };
    const copy = [...arr];
    for (let i = copy.length - 1; i > 0; i--) {
        const seed = fnv1a(getId(copy[i]) + ':' + i);
        const j = seed % (i + 1);
        [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
}

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

    const { certifiedCount, indexedCount } = useMemo(() => {
        let certified = 0;
        let indexed = 0;
        for (const e of results) {
            if (e.payment_completed) certified++;
            else indexed++;
        }
        return { certifiedCount: certified, indexedCount: indexed };
    }, [results]);

    const [sortBy, setSortBy] = useState<'default' | 'alpha' | 'score' | 'country' | 'certified'>('default');
    const [page, setPage] = useState(1);
    const PAGE_SIZE = 50;

    // Reset page when search or sort changes
    useEffect(() => { setPage(1); }, [query, sortBy]);

    const displayedResults = useMemo(() => {
        let filtered = results.filter((ent: any) => {
            // Text search
            if (query) {
                const q = query.toLowerCase();
                const matches = (
                    (ent.display_name && ent.display_name.toLowerCase().includes(q)) ||
                    (ent.legal_name && ent.legal_name.toLowerCase().includes(q)) ||
                    (ent.website && ent.website.toLowerCase().includes(q)) ||
                    (ent.sector_macro && ent.sector_macro.toLowerCase().includes(q)) ||
                    (ent.country_legal && ent.country_legal.toLowerCase().includes(q))
                );
                if (!matches) return false;
            }
            // Certified filter
            if (sortBy === 'certified' && !ent.payment_completed) return false;
            return true;
        });

        if (sortBy === 'alpha') {
            filtered = [...filtered].sort((a, b) =>
                (a.display_name || '').localeCompare(b.display_name || '', 'fr')
            );
        } else if (sortBy === 'score') {
            filtered = [...filtered].sort((a, b) => (b.asr_score || 0) - (a.asr_score || 0));
        } else if (sortBy === 'country') {
            filtered = [...filtered].sort((a, b) =>
                (a.country_legal || 'ZZ').localeCompare(b.country_legal || 'ZZ')
            );
        }
        // 'default': certified first (by created_at DESC), then shuffled non-certified
        // 'certified': only certified, organic order
        if (sortBy === 'default') {
            const certified = filtered.filter((e: any) => e.payment_completed);
            const indexed = filtered.filter((e: any) => !e.payment_completed);
            // Keep certified in created_at DESC order (real customers first)
            // Shuffle indexed entities so they don't appear grouped alphabetically
            filtered = [...certified, ...deterministicShuffle(indexed, (e: any) => e.website || e.display_name || getEntityId(e))];
        }

        return filtered;
    }, [results, query, sortBy]);

    const isCertified = (entity: any) => entity.payment_completed === true;

    const jsonLd = useMemo(() => {
        if (!results.length) return null;
        return {
            "@context": "https://schema.org",
            "@type": "ItemList",
            "name": "AYA Registry — AI Readability Index",
            "description": `Public registry of ${results.length}+ organizations rated for AI readability (AIO score 0-100)`,
            "url": "https://ai-visionary.com/aya",
            "numberOfItems": results.length,
            "itemListElement": results.slice(0, 10).map((e, i) => ({
                "@type": "ListItem",
                "position": i + 1,
                "item": {
                    "@type": "Organization",
                    "name": e.display_name || e.name || e.canonical_domain || "Unknown",
                    ...(e.website ? { "url": e.website } : {}),
                },
            })),
        };
    }, [results]);

    return (
        <div style={{ background: 'var(--bg-main)', minHeight: '100vh', fontFamily: 'var(--font-body)' }}>

            {jsonLd && (
                <script
                    type="application/ld+json"
                    dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
                />
            )}

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
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '40px', flexWrap: 'wrap', gap: '20px' }}>
                        <div>
                            <h2 className="section-title" style={{ fontSize: '2.2rem', marginBottom: '10px' }}>Index des entreprises</h2>
                            <p style={{ color: 'var(--text-muted)' }}>Entreprises analys&eacute;es pour leur lisibilit&eacute; IA — les certifi&eacute;es sont recommand&eacute;es en priorit&eacute;.</p>
                        </div>
                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                            {(['default', 'certified', 'alpha', 'score', 'country'] as const).map((key) => {
                                const labels: Record<string, string> = { default: 'Par d\u00e9faut', certified: 'Certifi\u00e9es', alpha: 'A \u2192 Z', score: 'Score', country: 'Pays' };
                                const active = sortBy === key;
                                return (
                                    <button key={key} onClick={() => setSortBy(key)} style={{
                                        padding: '6px 14px',
                                        borderRadius: '20px',
                                        border: active ? '1px solid var(--primary-color)' : '1px solid var(--border-light)',
                                        background: active ? 'var(--bg-accent)' : 'white',
                                        color: active ? 'var(--primary-color)' : 'var(--text-muted)',
                                        fontSize: '0.8rem',
                                        fontWeight: active ? 'bold' : 'normal',
                                        cursor: 'pointer',
                                    }}>
                                        {labels[key]}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* PAGINATION INFO */}
                    {!loading && displayedResults.length > PAGE_SIZE && (
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '20px' }}>
                            Page {page}/{Math.ceil(displayedResults.length / PAGE_SIZE)} &mdash; {displayedResults.length} r&eacute;sultats
                        </p>
                    )}

                    <div className="grid-3" style={{ rowGap: '30px' }}>
                        {loading ? (
                            <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '40px' }}>Chargement...</div>
                        ) : displayedResults.length > 0 ? (
                            displayedResults.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE).map((entity) => {
                                const certified = isCertified(entity);
                                return (
                                    <div key={getEntityId(entity)} className="card" style={{
                                        position: 'relative',
                                        overflow: 'hidden',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        borderLeft: certified ? '3px solid #22c55e' : '3px solid #e2e8f0',
                                    }}>
                                        {/* TOP ROW: Country + Badge */}
                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '15px' }}>
                                            <span style={{ background: 'var(--bg-main)', color: 'var(--text-muted)', padding: '4px 8px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 'bold' }}>
                                                {(entity.country_legal || 'XX').toUpperCase().slice(0, 2)} &bull; {ENTITY_TYPE_LABELS[entity.entity_type] || 'Organisation'}
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
                                        <Link href={`/aya/e/${getEntityId(entity)}`} style={{ textDecoration: 'none' }}>
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
                                                    ID: aya:{(entity.country_legal || 'xx').toLowerCase()}:{(getEntityId(entity) || '').slice(0, 8)}...
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

                    {/* PAGINATION */}
                    {!loading && displayedResults.length > PAGE_SIZE && (
                        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', marginTop: '40px', flexWrap: 'wrap' }}>
                            <button
                                onClick={() => { setPage(p => Math.max(1, p - 1)); window.scrollTo({ top: 400, behavior: 'smooth' }); }}
                                disabled={page === 1}
                                style={{
                                    padding: '8px 16px', borderRadius: '8px', border: '1px solid var(--border-light)',
                                    background: page === 1 ? '#f1f5f9' : 'white', color: page === 1 ? '#cbd5e1' : 'var(--text-main)',
                                    cursor: page === 1 ? 'default' : 'pointer', fontSize: '0.85rem',
                                }}
                            >
                                &larr; Pr&eacute;c&eacute;dent
                            </button>

                            {Array.from({ length: Math.ceil(displayedResults.length / PAGE_SIZE) }, (_, i) => i + 1)
                                .filter(p => p === 1 || p === Math.ceil(displayedResults.length / PAGE_SIZE) || Math.abs(p - page) <= 2)
                                .map((p, idx, arr) => (
                                    <span key={p}>
                                        {idx > 0 && arr[idx - 1] !== p - 1 && <span style={{ color: '#cbd5e1' }}>&hellip;</span>}
                                        <button
                                            onClick={() => { setPage(p); window.scrollTo({ top: 400, behavior: 'smooth' }); }}
                                            style={{
                                                padding: '8px 14px', borderRadius: '8px',
                                                border: p === page ? '1px solid var(--primary-color)' : '1px solid var(--border-light)',
                                                background: p === page ? 'var(--bg-accent)' : 'white',
                                                color: p === page ? 'var(--primary-color)' : 'var(--text-muted)',
                                                fontWeight: p === page ? 'bold' : 'normal',
                                                cursor: 'pointer', fontSize: '0.85rem',
                                            }}
                                        >
                                            {p}
                                        </button>
                                    </span>
                                ))}

                            <button
                                onClick={() => { setPage(p => Math.min(Math.ceil(displayedResults.length / PAGE_SIZE), p + 1)); window.scrollTo({ top: 400, behavior: 'smooth' }); }}
                                disabled={page === Math.ceil(displayedResults.length / PAGE_SIZE)}
                                style={{
                                    padding: '8px 16px', borderRadius: '8px', border: '1px solid var(--border-light)',
                                    background: page === Math.ceil(displayedResults.length / PAGE_SIZE) ? '#f1f5f9' : 'white',
                                    color: page === Math.ceil(displayedResults.length / PAGE_SIZE) ? '#cbd5e1' : 'var(--text-main)',
                                    cursor: page === Math.ceil(displayedResults.length / PAGE_SIZE) ? 'default' : 'pointer', fontSize: '0.85rem',
                                }}
                            >
                                Suivant &rarr;
                            </button>
                        </div>
                    )}

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
                    <div style={{ display: 'flex', justifyContent: 'center', gap: '20px', flexWrap: 'wrap', marginBottom: '15px' }}>
                        <Link href="/developers" style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.85rem', textDecoration: 'none' }}>API &amp; D&eacute;veloppeurs</Link>
                        <Link href="/mentions" style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.85rem', textDecoration: 'none' }}>Mentions</Link>
                        <Link href="/confidentialite" style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.85rem', textDecoration: 'none' }}>Confidentialit&eacute;</Link>
                    </div>
                    <p style={{ color: '#ffffff', opacity: 0.9, fontSize: '0.9rem', fontWeight: '500' }}>Registre AYA v1.0 &bull; Powered by AI Visionary &bull; &#127464;&#127469; Bas&eacute;e &agrave; Gen&egrave;ve</p>
                </div>
            </footer>
        </div>
    );
}
