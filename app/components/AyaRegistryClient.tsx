"use client";

import { useRouter, useSearchParams } from 'next/navigation';
import { useState, useCallback, useEffect, useRef } from 'react';
import Link from 'next/link';

type SortMode = 'default' | 'alpha' | 'score' | 'country' | 'certified';

const SORT_LABELS: Record<SortMode, string> = {
    default: 'Par d\u00e9faut',
    certified: 'Certifi\u00e9es',
    alpha: 'A \u2192 Z',
    score: 'Score',
    country: 'Pays',
};

const ENTITY_TYPE_LABELS: Record<string, string> = {
    company: 'Entreprise',
    association: 'Association',
    public_body: 'Organisme Public',
    individual: 'Ind\u00e9pendant',
};

const getEntityId = (e: any): string => e.entity_id || e.aya_entity_id || e.id || '';
const isCertified = (entity: any) => entity.payment_completed === true;

interface AyaRegistryClientProps {
    entities: any[];
    totalEntities: number;
    certifiedCount: number;
    indexedCount: number;
    currentPage: number;
    pageSize: number;
    currentSearch: string;
    currentSort: SortMode;
}

export default function AyaRegistryClient({
    entities,
    totalEntities,
    certifiedCount,
    indexedCount,
    currentPage,
    pageSize,
    currentSearch,
    currentSort,
}: AyaRegistryClientProps) {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [searchInput, setSearchInput] = useState(currentSearch);
    const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Build URL with params
    const buildUrl = useCallback((overrides: { page?: number; search?: string; sort?: SortMode }) => {
        const params = new URLSearchParams();
        const page = overrides.page ?? currentPage;
        const search = overrides.search ?? currentSearch;
        const sort = overrides.sort ?? currentSort;

        if (page > 1) params.set('page', String(page));
        if (search) params.set('q', search);
        if (sort !== 'default') params.set('sort', sort);

        const qs = params.toString();
        return qs ? `/aya?${qs}` : '/aya';
    }, [currentPage, currentSearch, currentSort]);

    // Debounced search — navigates after 400ms of inactivity
    useEffect(() => {
        if (debounceTimer.current) clearTimeout(debounceTimer.current);

        // Don't trigger on initial mount if search matches
        if (searchInput === currentSearch) return;

        debounceTimer.current = setTimeout(() => {
            router.push(buildUrl({ search: searchInput, page: 1 }));
        }, 400);

        return () => {
            if (debounceTimer.current) clearTimeout(debounceTimer.current);
        };
    }, [searchInput]); // eslint-disable-line react-hooks/exhaustive-deps

    const handleSortChange = (sort: SortMode) => {
        router.push(buildUrl({ sort, page: 1 }));
    };

    const totalPages = Math.ceil(totalEntities / pageSize);

    // Build page numbers to show (1 ... 3 4 [5] 6 7 ... 20)
    const pageNumbers: (number | 'ellipsis')[] = [];
    const addPage = (p: number) => { if (!pageNumbers.includes(p)) pageNumbers.push(p); };
    if (totalPages <= 7) {
        for (let i = 1; i <= totalPages; i++) addPage(i);
    } else {
        addPage(1);
        if (currentPage > 3) pageNumbers.push('ellipsis');
        for (let i = Math.max(2, currentPage - 1); i <= Math.min(totalPages - 1, currentPage + 1); i++) addPage(i);
        if (currentPage < totalPages - 2) pageNumbers.push('ellipsis');
        addPage(totalPages);
    }

    return (
        <>
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
                            value={searchInput}
                            onChange={(e) => setSearchInput(e.target.value)}
                            placeholder="Rechercher une entreprise (ex: 'Anthropic', 'Infomaniak', 'Mistral')..."
                            style={{
                                width: '100%',
                                padding: '18px 25px',
                                borderRadius: '50px',
                                border: '1px solid var(--border-light)',
                                fontSize: '1.1rem',
                                boxShadow: 'var(--shadow-md)',
                                outline: 'none',
                                color: 'var(--text-main)',
                            }}
                        />
                    </div>
                </div>
            </section>

            {/* STATS BAR */}
            <div style={{ background: 'white', borderTop: '1px solid var(--border-light)', borderBottom: '1px solid var(--border-light)', padding: '12px 0' }}>
                <div className="container" style={{ display: 'flex', justifyContent: 'center', gap: '30px', flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '1.4rem', fontWeight: 'bold', color: 'var(--text-main)' }}>{certifiedCount + indexedCount}</span>
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Entreprises dans l&apos;index</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '1.4rem', fontWeight: 'bold', color: 'var(--primary-color)' }}>9</span>
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>IA compatibles</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '1.4rem', fontWeight: 'bold', color: 'var(--primary-color)' }}>73+</span>
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Pays couverts</span>
                    </div>
                </div>
            </div>

            {/* RESULTS LIST */}
            <section className="section" style={{ background: 'white' }}>
                <div className="container">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '40px', flexWrap: 'wrap', gap: '20px' }}>
                        <div>
                            <h2 className="section-title" style={{ fontSize: '2.2rem', marginBottom: '10px' }}>Index des entreprises</h2>
                            <p style={{ color: 'var(--text-muted)' }}>Entreprises analys&eacute;es pour leur lisibilit&eacute; IA &mdash; les certifi&eacute;es sont recommand&eacute;es en priorit&eacute;.</p>
                        </div>
                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                            {(['default', 'certified', 'alpha', 'score', 'country'] as const).map((key) => {
                                const active = currentSort === key;
                                return (
                                    <button key={key} onClick={() => handleSortChange(key)} style={{
                                        padding: '6px 14px',
                                        borderRadius: '20px',
                                        border: active ? '1px solid var(--primary-color)' : '1px solid var(--border-light)',
                                        background: active ? 'var(--bg-accent)' : 'white',
                                        color: active ? 'var(--primary-color)' : 'var(--text-muted)',
                                        fontSize: '0.8rem',
                                        fontWeight: active ? 'bold' : 'normal',
                                        cursor: 'pointer',
                                    }}>
                                        {SORT_LABELS[key]}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* PAGINATION INFO */}
                    {totalPages > 1 && (
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '20px' }}>
                            Page {currentPage}/{totalPages} &mdash; {totalEntities} r&eacute;sultats
                        </p>
                    )}

                    <div className="grid-3" style={{ rowGap: '30px' }}>
                        {entities.length > 0 ? (
                            entities.map((entity: any) => {
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
                                <p style={{ fontSize: '1.2rem', color: 'var(--text-muted)', marginBottom: '20px' }}>Aucun r&eacute;sultat pour &quot;{currentSearch}&quot;.</p>
                                <Link href="/diagnostic?pack=aya-sub" className="btn btn-primary">
                                    Inscrire mon entreprise
                                </Link>
                            </div>
                        )}
                    </div>

                    {/* PAGINATION */}
                    {totalPages > 1 && (
                        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', marginTop: '40px', flexWrap: 'wrap' }}>
                            {currentPage > 1 ? (
                                <Link
                                    href={buildUrl({ page: currentPage - 1 })}
                                    style={{
                                        padding: '8px 16px', borderRadius: '8px', border: '1px solid var(--border-light)',
                                        background: 'white', color: 'var(--text-main)',
                                        cursor: 'pointer', fontSize: '0.85rem', textDecoration: 'none',
                                    }}
                                >
                                    &larr; Pr&eacute;c&eacute;dent
                                </Link>
                            ) : (
                                <span style={{
                                    padding: '8px 16px', borderRadius: '8px', border: '1px solid var(--border-light)',
                                    background: '#f1f5f9', color: '#cbd5e1', fontSize: '0.85rem',
                                }}>
                                    &larr; Pr&eacute;c&eacute;dent
                                </span>
                            )}

                            {pageNumbers.map((p, idx) => {
                                if (p === 'ellipsis') {
                                    return <span key={`e${idx}`} style={{ color: '#cbd5e1' }}>&hellip;</span>;
                                }
                                return (
                                    <Link
                                        key={p}
                                        href={buildUrl({ page: p })}
                                        style={{
                                            padding: '8px 14px', borderRadius: '8px',
                                            border: p === currentPage ? '1px solid var(--primary-color)' : '1px solid var(--border-light)',
                                            background: p === currentPage ? 'var(--bg-accent)' : 'white',
                                            color: p === currentPage ? 'var(--primary-color)' : 'var(--text-muted)',
                                            fontWeight: p === currentPage ? 'bold' : 'normal',
                                            cursor: 'pointer', fontSize: '0.85rem', textDecoration: 'none',
                                        }}
                                    >
                                        {p}
                                    </Link>
                                );
                            })}

                            {currentPage < totalPages ? (
                                <Link
                                    href={buildUrl({ page: currentPage + 1 })}
                                    style={{
                                        padding: '8px 16px', borderRadius: '8px', border: '1px solid var(--border-light)',
                                        background: 'white', color: 'var(--text-main)',
                                        cursor: 'pointer', fontSize: '0.85rem', textDecoration: 'none',
                                    }}
                                >
                                    Suivant &rarr;
                                </Link>
                            ) : (
                                <span style={{
                                    padding: '8px 16px', borderRadius: '8px', border: '1px solid var(--border-light)',
                                    background: '#f1f5f9', color: '#cbd5e1', fontSize: '0.85rem',
                                }}>
                                    Suivant &rarr;
                                </span>
                            )}
                        </div>
                    )}
                </div>
            </section>
        </>
    );
}
