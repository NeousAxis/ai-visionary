"use client";

// Recherche en langage courant du registre AYA (proposition A, 22.11.2026).
// La phrase part vers /api/aya/ask ; chaque critère est prouvé par une phrase
// réelle de la fiche. Les entreprises dont la ville est connue vont sur la carte.

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import AyaMap, { type MapPoint } from './AyaMap';
import LanguageToggle from './LanguageToggle';
import AyaContact from './AyaContact';

type Why = { label: string; matched: boolean; evidence: string | null };
type Result = {
    entity_id: string; name: string; domain: string; website: string | null; url: string;
    country: string | null; sector: string | null; score: number | null; certified: boolean;
    detail: 'riche' | 'simple'; city: string | null; zone: string | null; description: string | null;
    why: Why[]; matched_count: number; price: string | null; audience: string | null;
    contact: { phone: string | null; email: string | null } | null; can_contact: boolean;
    geo: { lat: number; lon: number; label: string } | null; distance_km: number | null;
};
type Ask = {
    q: string;
    understood: { chips: string[]; city: string | null };
    center: { lat: number; lon: number; label: string } | null;
    total: number; all_criteria: number; results: Result[];
};

const MCP_URL = 'https://ai-visionary.xyz/agents/mcp';

const card: React.CSSProperties = { border: '1px solid var(--border-light)', borderRadius: 24, background: '#fff' };
const eyebrowStyle: React.CSSProperties = { fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: 0.6, textTransform: 'uppercase' };

function Check({ on }: { on: boolean }) {
    return on ? (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--primary-color)" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flex: 'none', marginTop: 2 }}><path d="M20 6 9 17l-5-5" /></svg>
    ) : (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" aria-hidden="true" style={{ flex: 'none', marginTop: 2 }}><circle cx="12" cy="12" r="7" /></svg>
    );
}

export default function AyaAsk({ totalCount }: { totalCount: number }) {
    const t = useTranslations('ayaAsk');
    const [q, setQ] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(false);
    const [data, setData] = useState<Ask | null>(null);
    const [openContact, setOpenContact] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);

    const run = useCallback(async (query: string) => {
        const text = query.trim();
        if (text.length < 2) return;
        setLoading(true); setError(false); setOpenContact(null);
        try {
            const res = await fetch(`/api/aya/ask?q=${encodeURIComponent(text)}`);
            if (!res.ok) throw new Error(String(res.status));
            setData(await res.json());
            const u = new URL(window.location.href);
            u.searchParams.set('ask', text);
            window.history.replaceState(null, '', u.toString());
        } catch {
            setError(true);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        const a = new URLSearchParams(window.location.search).get('ask');
        if (a) { setQ(a); run(a); }
    }, [run]);

    const examples = [t('ex1'), t('ex2'), t('ex3'), t('ex4')];
    const results = data?.results ?? [];
    const points: MapPoint[] = results
        .map((r, i) => (r.geo ? { lat: r.geo.lat, lon: r.geo.lon, n: i + 1, label: r.name, strong: r.certified } : null))
        .filter(Boolean) as MapPoint[];
    const first = results[0];
    const agentJson = first ? JSON.stringify({
        name: first.name, domain: first.domain, certified: first.certified, aio_score: first.score,
        city: first.city, country: first.country,
        matches: first.why.filter((w) => w.matched).map((w) => w.label),
        record: `https://ai-visionary.xyz${first.url}`,
    }, null, 2) : '';

    return (
        <>
            <section className="section" style={{ textAlign: 'center', paddingBottom: 48 }}>
                <div className="container" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20 }}>
                    <span style={{ display: 'inline-block', border: '1px solid var(--primary-color)', background: 'var(--bg-accent)', color: 'var(--primary-hover)', fontWeight: 700, fontSize: 13, letterSpacing: 1.2, textTransform: 'uppercase', padding: '6px 16px', borderRadius: 999 }}>{t('eyebrow')}</span>
                    <h1 className="headline" style={{ margin: 0, fontSize: 'clamp(2.2rem, 5vw, 3.6rem)', lineHeight: 1.08, maxWidth: 900 }}>
                        {t('title1')}<br /><span style={{ color: 'var(--primary-color)' }}>{t('title2')}</span>
                    </h1>
                    <p className="subheadline" style={{ margin: 0, maxWidth: 680 }}>{t('sub', { count: totalCount.toLocaleString('fr-CH') })}</p>
                    <LanguageToggle />

                    <form onSubmit={(e) => { e.preventDefault(); run(q); }} style={{ width: '100%', maxWidth: 860, background: '#fff', border: '1px solid var(--border-light)', borderRadius: 24, boxShadow: 'var(--shadow-lg)', padding: 20, display: 'flex', flexDirection: 'column', gap: 14, textAlign: 'left' }}>
                        <label htmlFor="aya-ask" style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)', paddingLeft: 6 }}>{t('label')}</label>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
                            <input id="aya-ask" type="text" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('placeholder')} maxLength={300}
                                style={{ flex: '999 1 420px', minWidth: 0, height: 56, border: '1px solid var(--border-light)', borderRadius: 16, padding: '0 18px', fontSize: 17, color: 'var(--text-main)', background: 'var(--bg-main)', outline: 'none' }} />
                            <button type="submit" disabled={loading} style={{ flex: '1 1 160px', height: 56, border: 0, borderRadius: 16, background: 'var(--primary-hover)', color: '#fff', fontWeight: 700, fontSize: 17, cursor: loading ? 'wait' : 'pointer' }}>
                                {loading ? t('searching') : t('submit')}
                            </button>
                        </div>
                        {data && data.understood.chips.length > 0 && (
                            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, paddingLeft: 6 }}>
                                <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-muted)', marginRight: 4 }}>{t('understood')}</span>
                                {data.understood.chips.map((c) => (
                                    <span key={c} style={{ background: 'var(--bg-accent)', color: 'var(--text-main)', fontSize: 14, fontWeight: 500, padding: '6px 12px', borderRadius: 999 }}>{c}</span>
                                ))}
                            </div>
                        )}
                    </form>

                    <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center', gap: 10, maxWidth: 900 }}>
                        <span style={{ fontSize: 14, color: 'var(--text-muted)' }}>{t('tryAlso')}</span>
                        {examples.map((ex) => (
                            <button key={ex} type="button" onClick={() => { setQ(ex); run(ex); }}
                                style={{ border: '1px solid var(--border-light)', background: '#fff', color: 'var(--text-body)', fontSize: 14, padding: '8px 14px', borderRadius: 999, cursor: 'pointer' }}>{ex}</button>
                        ))}
                    </div>
                </div>
            </section>

            {(data || error) && (
                <section style={{ background: '#fff', borderTop: '1px solid var(--border-light)' }}>
                    <div className="container" style={{ padding: '48px 0 64px', display: 'flex', flexWrap: 'wrap', gap: 32, alignItems: 'flex-start' }}>
                        <div style={{ flex: '999 1 560px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 20 }}>
                            {error && <p style={{ margin: 0, color: 'var(--accent-color)' }}>{t('error')}</p>}
                            {data && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                    <h2 style={{ margin: 0, fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: 26, color: 'var(--text-main)' }}>
                                        {results.length === 0 ? t('resultsNone') : data.all_criteria > 0 ? t('resultsAll', { n: data.all_criteria }) : t('resultsSome')}
                                    </h2>
                                    {results.length > 0 && <p style={{ margin: 0, fontSize: 15, color: 'var(--text-muted)' }}>{t('sortNote')}</p>}
                                </div>
                            )}

                            {results.map((r, i) => (
                                <article key={r.entity_id} style={{ ...card, padding: 28, display: 'flex', flexDirection: 'column', gap: 18, boxShadow: i === 0 ? 'var(--shadow-md)' : 'none' }}>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: 16, alignItems: 'flex-start' }}>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
                                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
                                                <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 26, height: 26, borderRadius: 999, background: r.certified ? 'var(--primary-hover)' : 'var(--primary-color)', color: '#fff', fontSize: 13, fontWeight: 700 }}>{i + 1}</span>
                                                <span style={{ background: r.certified ? 'var(--bg-accent)' : 'var(--bg-main)', color: r.certified ? 'var(--primary-hover)' : 'var(--text-muted)', fontSize: 13, fontWeight: 700, padding: '5px 12px', borderRadius: 999 }}>
                                                    {r.certified ? t('certified') : t('indexed')}
                                                </span>
                                            </div>
                                            <h3 style={{ margin: 0, fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: 26, lineHeight: 1.2, color: 'var(--text-main)' }}>{r.name}</h3>
                                            <p style={{ margin: 0, fontSize: 15, color: 'var(--text-muted)' }}>
                                                {[r.sector, r.city, r.distance_km != null && data?.center ? t('kmFrom', { km: r.distance_km, place: data.center.label }) : null].filter(Boolean).join(' · ')}
                                            </p>
                                        </div>
                                        {r.score != null && (
                                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                                                <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 38, lineHeight: 1, color: 'var(--primary-hover)' }}>{Math.round(r.score)}<span style={{ fontSize: 16, color: 'var(--text-muted)', fontWeight: 500 }}>/100</span></span>
                                                <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600, letterSpacing: 0.4 }}>{t('scoreAio')}</span>
                                            </div>
                                        )}
                                    </div>

                                    {r.description && <p style={{ margin: 0, color: 'var(--text-body)' }}>{r.description}</p>}

                                    {r.why.length > 0 && (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                            <h4 style={{ ...eyebrowStyle, margin: 0, color: 'var(--text-main)' }}>{t('whyTitle')}</h4>
                                            <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 10 }}>
                                                {r.why.map((w) => (
                                                    <li key={w.label} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                                                        <Check on={w.matched} />
                                                        <span>
                                                            <strong style={{ color: w.matched ? 'var(--text-main)' : 'var(--text-muted)' }}>{w.label}</strong>
                                                            <span style={{ color: 'var(--text-muted)' }}>{' : '}{w.matched ? `« ${w.evidence} »` : t('notInFiche')}</span>
                                                        </span>
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    )}

                                    {(r.price || r.audience || r.zone) && (
                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 200px), 1fr))', gap: 12 }}>
                                            {[[t('price'), r.price], [t('audience'), r.audience], [t('zone'), r.zone]].filter(([, val]) => val).map(([lab, val]) => (
                                                <div key={lab as string} style={{ background: 'var(--bg-main)', borderRadius: 16, padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 2 }}>
                                                    <span style={eyebrowStyle}>{lab}</span>
                                                    <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>{val}</span>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {r.detail === 'simple' && <p style={{ margin: 0, fontSize: 14, color: 'var(--text-muted)' }}>{t('simpleFiche')}</p>}

                                    {r.contact && (r.contact.phone || r.contact.email) && (
                                        <div style={{ borderTop: '1px solid var(--border-light)', paddingTop: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
                                            <h4 style={{ ...eyebrowStyle, margin: 0, color: 'var(--text-main)' }}>{t('contactTitle')}</h4>
                                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 24px', fontWeight: 600 }}>
                                                {r.city && <span style={{ color: 'var(--text-main)' }}>{r.city}{r.country ? `, ${r.country}` : ''}</span>}
                                                {r.contact.phone && <a href={`tel:${r.contact.phone.replace(/\s/g, '')}`} style={{ textDecoration: 'none' }}>{r.contact.phone}</a>}
                                                {r.contact.email && <a href={`mailto:${r.contact.email}`} style={{ textDecoration: 'none', wordBreak: 'break-all' }}>{r.contact.email}</a>}
                                                {r.domain && <a href={r.website || `https://${r.domain}`} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none' }}>{r.domain}</a>}
                                            </div>
                                        </div>
                                    )}

                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
                                        {r.can_contact ? (
                                            <button type="button" onClick={() => setOpenContact(openContact === r.entity_id ? null : r.entity_id)} aria-expanded={openContact === r.entity_id}
                                                style={{ border: 0, background: 'var(--primary-hover)', color: '#fff', fontWeight: 700, padding: '13px 22px', borderRadius: 999, cursor: 'pointer' }}>{t('contactVia')}</button>
                                        ) : (
                                            r.domain && <a href={r.website || `https://${r.domain}`} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none', background: 'var(--primary-hover)', color: '#fff', fontWeight: 700, padding: '13px 22px', borderRadius: 999 }}>{t('visitSite')}</a>
                                        )}
                                        <Link href={r.url} style={{ textDecoration: 'none', border: '1px solid var(--primary-color)', color: 'var(--primary-hover)', fontWeight: 700, padding: '12px 22px', borderRadius: 999 }}>{t('seeFiche')}</Link>
                                        {!r.can_contact && <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{t('contactNotActive')}</span>}
                                    </div>

                                    {openContact === r.entity_id && <AyaContact entityId={r.entity_id} companyName={r.name} query={data?.q || ''} />}
                                </article>
                            ))}
                        </div>

                        {data && results.length > 0 && (
                            <aside style={{ flex: '1 1 340px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 20 }}>
                                <div style={{ ...card, overflow: 'hidden' }}>
                                    <div style={{ padding: '16px 20px 12px' }}>
                                        <h3 style={{ margin: 0, fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: 18, color: 'var(--text-main)' }}>{t('mapTitle')}</h3>
                                    </div>
                                    {points.length > 0 ? (
                                        <AyaMap points={points} target={data.center} osmLabel={t('osm')} zoomInLabel={t('zoomIn')} zoomOutLabel={t('zoomOut')} />
                                    ) : (
                                        <p style={{ margin: 0, padding: '0 20px 16px', fontSize: 14, color: 'var(--text-muted)' }}>{t('mapNone')}</p>
                                    )}
                                    {points.length > 0 && (
                                        <div style={{ padding: '12px 20px 16px', display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13, color: 'var(--text-body)' }}>
                                            <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}><span style={{ width: 12, height: 12, borderRadius: 999, background: 'var(--primary-hover)' }} />{t('mapLegendFound')}</span>
                                            {data.center && <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}><span style={{ width: 8, height: 8, borderRadius: 999, border: '2.5px solid #CE6A6B' }} />{t('mapLegendYou')} : {data.center.label}</span>}
                                        </div>
                                    )}
                                </div>

                                <div style={{ background: '#0f172a', borderRadius: 24, padding: 22, display: 'flex', flexDirection: 'column', gap: 12 }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                                        <h3 style={{ margin: 0, fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: 18, color: '#fff' }}>{t('agentTitle')}</h3>
                                        <span style={{ fontSize: 12, fontWeight: 600, color: '#94a3b8' }}>{t('agentNote')}</span>
                                    </div>
                                    <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 13, lineHeight: 1.6, color: '#E2EFE9' }}>{agentJson}</pre>
                                </div>

                                <div style={{ ...card, padding: 22, display: 'flex', flexDirection: 'column', gap: 10 }}>
                                    <h3 style={{ margin: 0, fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: 18, color: 'var(--text-main)' }}>{t('connectTitle')}</h3>
                                    <p style={{ margin: 0, fontSize: 15 }}>{t('connectBody')}</p>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', background: 'var(--bg-main)', border: '1px solid var(--border-light)', borderRadius: 14, padding: '8px 8px 8px 14px' }}>
                                        <code style={{ flex: '1 1 200px', minWidth: 0, fontSize: 13, color: 'var(--text-main)', wordBreak: 'break-all' }}>{MCP_URL}</code>
                                        <button type="button" onClick={() => { navigator.clipboard?.writeText(MCP_URL).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1800); }).catch(() => {}); }}
                                            style={{ border: 0, background: 'var(--text-main)', color: '#fff', fontSize: 14, fontWeight: 600, padding: '10px 16px', borderRadius: 10, cursor: 'pointer' }}>{copied ? t('copied') : t('copy')}</button>
                                    </div>
                                </div>
                            </aside>
                        )}
                    </div>
                </section>
            )}
        </>
    );
}
