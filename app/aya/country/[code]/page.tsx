import { notFound } from 'next/navigation';
import Link from 'next/link';
import type { Metadata } from 'next';
import { getTranslations, getLocale } from 'next-intl/server';
import { getAyaEntitiesByFilterAggregated } from '@/lib/db';
import { COUNTRY_LABELS, COUNTRY_LABELS_FR, SECTOR_LABELS } from '@/lib/aya/llm-format';
import {
    buildItemListJsonLd,
    buildFaqJsonLd,
    buildCountryFaqs,
    topSectorsFromEntities,
    entityDisplayName,
    entityDescription,
    escapeHtml,
} from '@/lib/aya/llm-page-builder';

export const dynamic = 'force-dynamic';

const PAGE_SIZE = 50;

type Entity = Awaited<ReturnType<typeof getAyaEntitiesByFilterAggregated>>['data'][number];

// ─── Metadata ────────────────────────────────────────────────────────────────

export async function generateMetadata({
    params,
}: {
    params: Promise<{ code: string }>;
}): Promise<Metadata> {
    const { code } = await params;
    const country = code.toUpperCase();
    const t = await getTranslations('countryPage');
    const locale = await getLocale();

    const { total } = await getAyaEntitiesByFilterAggregated({ country, limit: 1, offset: 0 });
    if (total === 0) return { title: t('notFound') };

    const countryMap = locale === 'fr' ? COUNTRY_LABELS_FR : COUNTRY_LABELS;
    const label = countryMap[country] || country;
    const title = t('metaTitle', { country: label, count: total });
    const description = t('metaDescription', { country: label, count: total });

    return {
        title,
        description,
        openGraph: {
            title,
            description,
            url: `https://ai-visionary.xyz/aya/country/${country}`,
            siteName: 'AI Visionary',
            type: 'website',
        },
    };
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function CountryPage({
    params,
    searchParams,
}: {
    params: Promise<{ code: string }>;
    searchParams: Promise<{ page?: string }>;
}) {
    const { code } = await params;
    const country = code.toUpperCase();
    const sp = await searchParams;
    const page = Math.max(1, parseInt(sp.page || '1', 10) || 1);
    const offset = (page - 1) * PAGE_SIZE;

    const t = await getTranslations('countryPage');
    const ta = await getTranslations('aya');
    const locale = await getLocale();

    const { data: entities, total } = await getAyaEntitiesByFilterAggregated({
        country,
        limit: PAGE_SIZE,
        offset,
    });

    if (total === 0) notFound();

    const totalPages = Math.ceil(total / PAGE_SIZE);
    const countryMap = locale === 'fr' ? COUNTRY_LABELS_FR : COUNTRY_LABELS;
    const label = countryMap[country] || country;

    // JSON-LD ItemList (enriched with descriptions for LLM crawlers)
    const localeCode = locale === 'fr' ? 'fr' : 'en';
    const jsonLd = buildItemListJsonLd({
        listName: `AYA Registry — ${label}`,
        listDescription: `${total} organizations from ${label} indexed for AI readability.`,
        listUrl: `https://ai-visionary.xyz/aya/country/${country}`,
        entities,
        locale: localeCode,
        offset,
    });

    // FAQ JSON-LD
    const topNames = entities.slice(0, 5).map((e: Entity) => entityDisplayName(e));
    const topSectors = topSectorsFromEntities(entities, SECTOR_LABELS, localeCode, 3);
    const countryFaqs = buildCountryFaqs({ countryLabel: label, total, topNames, topSectors, locale: localeCode });
    const faqJsonLd = buildFaqJsonLd(countryFaqs);

    return (
        <div style={{ background: 'var(--bg-main)', minHeight: '100vh', fontFamily: 'var(--font-body)' }}>
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
            />
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
            />

            {/* HEADER */}
            <header style={{ background: 'white', borderBottom: '1px solid var(--border-light)', position: 'sticky', top: 0, zIndex: 100, padding: '15px 0' }}>
                <div className="container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: '15px', textDecoration: 'none' }}>
                        <img src="/logo-v2.png" alt="AI Visionary" style={{ height: '40px', width: 'auto' }} />
                        <div style={{ height: '24px', width: '1px', background: 'var(--border-light)' }} />
                        <span style={{ fontSize: '1.2rem', fontWeight: 'bold', color: 'var(--text-main)', letterSpacing: '-0.02em' }}>
                            {ta('registryTitle')}{' '}
                            <span style={{ color: 'var(--primary-color)', fontWeight: '400' }}>{ta('registryName')}</span>
                        </span>
                    </Link>
                    <Link href="/diagnostic?pack=aya-sub" className="btn btn-primary" style={{ padding: '0.6rem 1.2rem', fontSize: '0.9rem' }}>
                        {ta('registerEntity')}
                    </Link>
                </div>
            </header>

            {/* HERO */}
            <section className="section" style={{ paddingBottom: '2rem' }}>
                <div className="container">
                    <Link
                        href="/aya"
                        style={{ display: 'inline-block', marginBottom: '1.5rem', color: 'var(--primary-color)', fontSize: '0.9rem', fontWeight: '600', textDecoration: 'none' }}
                    >
                        {t('back')}
                    </Link>
                    <h1 className="headline" style={{ marginBottom: '0.5rem' }}>
                        {t('heading', { country: label })}
                    </h1>
                    <p style={{ color: 'var(--text-muted)', fontSize: '1rem' }}>
                        {t('subheading', { count: total })}
                    </p>
                </div>
            </section>

            {/* ENTITY GRID */}
            <section style={{ paddingBottom: '3rem' }}>
                <div className="container">
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
                        {entities.map((entity: Entity) => {
                            const isCertified = entity.payment_completed === true;
                            const genericNames = ['Unknown', 'Entity', 'Unknown Entity'];
                            const rawName = entity.display_name || entity.legal_name;
                            const name = (rawName && !genericNames.includes(rawName))
                                ? rawName
                                : (entity.website
                                    ? entity.website.replace(/^https?:\/\/(www\.)?/, '').split('/')[0]
                                    : ta('entityFallback'));
                            const score = entity.asr_score != null ? entity.asr_score : null;
                            const enrichment = entity.asr_payload?.enrichment || {};
                            const desc = locale === 'en'
                                ? (enrichment.gemini_description || enrichment.gemini_description_fr || '')
                                : (enrichment.gemini_description_fr || enrichment.gemini_description || '');

                            return (
                                <Link
                                    key={entity.entity_id}
                                    href={`/aya/e/${entity.entity_id}`}
                                    style={{ textDecoration: 'none' }}
                                >
                                    <div
                                        className="card"
                                        style={{
                                            height: '100%',
                                            display: 'flex',
                                            flexDirection: 'column',
                                            justifyContent: 'space-between',
                                            transition: 'box-shadow 0.2s',
                                            cursor: 'pointer',
                                        }}
                                    >
                                        <div>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                                                <span style={{
                                                    fontSize: '0.75rem',
                                                    fontWeight: 'bold',
                                                    padding: '3px 10px',
                                                    borderRadius: '20px',
                                                    background: isCertified ? 'var(--bg-accent)' : '#F1F5F9',
                                                    color: isCertified ? 'var(--primary-color)' : '#64748B',
                                                }}>
                                                    {isCertified ? ta('certifiedBadge') : ta('indexedBadge')}
                                                </span>
                                                {score != null && (
                                                    <span style={{ fontSize: '0.85rem', fontWeight: '700', color: 'var(--text-main)' }}>
                                                        {score}<span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 'normal' }}>/100</span>
                                                    </span>
                                                )}
                                            </div>
                                            <h3 style={{ fontSize: '1rem', fontWeight: '700', color: 'var(--text-main)', marginBottom: '6px', lineHeight: '1.3' }}>
                                                {name}
                                            </h3>
                                            {desc && (
                                                <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', lineHeight: '1.5', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                                                    {desc}
                                                </p>
                                            )}
                                        </div>
                                        <div style={{ marginTop: '12px', display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                                            {entity.sector_macro && (
                                                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', background: 'var(--bg-main)', padding: '2px 8px', borderRadius: '12px', border: '1px solid var(--border-light)' }}>
                                                    {locale === 'en' ? (SECTOR_LABELS[entity.sector_macro] || entity.sector_macro) : entity.sector_macro}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </Link>
                            );
                        })}
                    </div>

                    {/* PAGINATION */}
                    {totalPages > 1 && (
                        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '16px', marginTop: '3rem' }}>
                            {page > 1 && (
                                <Link
                                    href={`/aya/country/${country}?page=${page - 1}`}
                                    className="btn"
                                    style={{ padding: '0.5rem 1rem', fontSize: '0.9rem' }}
                                >
                                    {ta('prevPage')}
                                </Link>
                            )}
                            <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                                {ta('pageOf', { current: page, total: totalPages, count: total })}
                            </span>
                            {page < totalPages && (
                                <Link
                                    href={`/aya/country/${country}?page=${page + 1}`}
                                    className="btn"
                                    style={{ padding: '0.5rem 1rem', fontSize: '0.9rem' }}
                                >
                                    {ta('nextPage')}
                                </Link>
                            )}
                        </div>
                    )}
                </div>
            </section>

            {/* LLM-FRIENDLY SECTION — flat list + FAQ for AI crawlers */}
            {page === 1 && (
                <section style={{ paddingBottom: '3rem', borderTop: '1px solid var(--border-light)' }}>
                    <div className="container">
                        {/* LLM H1 + intro paragraph */}
                        <h2 style={{ fontSize: '1.3rem', fontWeight: '700', color: 'var(--text-main)', margin: '2rem 0 0.75rem' }}>
                            {t('llmH1', { country: label })}
                        </h2>
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.92rem', lineHeight: '1.6', marginBottom: '1.5rem', maxWidth: '700px' }}>
                            {t('llmIntro', { count: total, country: label })}
                        </p>

                        {/* Flat entity list: Name = description */}
                        <h3 style={{ fontSize: '1rem', fontWeight: '600', color: 'var(--text-main)', marginBottom: '0.75rem' }}>
                            {t('llmListTitle')}
                        </h3>
                        <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 2rem', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            {entities.slice(0, 50).map((entity: Entity) => {
                                const name = entityDisplayName(entity);
                                const desc = entityDescription(entity, localeCode);
                                return (
                                    <li key={entity.entity_id} style={{ fontSize: '0.88rem', color: 'var(--text-muted)', lineHeight: '1.5' }}>
                                        <Link
                                            href={`/aya/e/${entity.entity_id}`}
                                            style={{ color: 'var(--text-main)', fontWeight: '600', textDecoration: 'none' }}
                                        >
                                            {escapeHtml(name)}
                                        </Link>
                                        {desc ? <span> = {escapeHtml(desc)}</span> : null}
                                    </li>
                                );
                            })}
                        </ul>

                        {/* FAQ section */}
                        <h3 style={{ fontSize: '1rem', fontWeight: '600', color: 'var(--text-main)', marginBottom: '0.75rem' }}>
                            {t('llmFaqTitle')}
                        </h3>
                        <dl style={{ margin: '0 0 2rem', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            {countryFaqs.map((faq, i) => (
                                <div key={i}>
                                    <dt style={{ fontWeight: '600', fontSize: '0.9rem', color: 'var(--text-main)', marginBottom: '2px' }}>
                                        {escapeHtml(faq.question)}
                                    </dt>
                                    <dd style={{ margin: 0, fontSize: '0.88rem', color: 'var(--text-muted)', lineHeight: '1.6' }}>
                                        {escapeHtml(faq.answer)}
                                    </dd>
                                </div>
                            ))}
                        </dl>

                        {/* Dataset links */}
                        <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', borderTop: '1px solid var(--border-light)', paddingTop: '1rem' }}>
                            <strong>{t('llmDatasetTitle')}</strong> — {t('llmDatasetText')}{' '}
                            <a href="https://huggingface.co/datasets/NeousAxis/aya-business-dataset" style={{ color: 'var(--primary-color)' }} rel="noopener">HuggingFace</a>
                            {' · '}
                            <a href="https://github.com/NeousAxis/aya-business-dataset" style={{ color: 'var(--primary-color)' }} rel="noopener">GitHub</a>
                        </p>
                    </div>
                </section>
            )}

            {/* CTA */}
            <section className="section" style={{ background: 'var(--text-main)', color: 'white', textAlign: 'center' }}>
                <div className="container">
                    <h2 style={{ color: 'white', marginBottom: '20px' }}>{ta('ctaTitle')}</h2>
                    <p className="subheadline" style={{ color: 'rgba(255,255,255,0.8)', marginBottom: '20px' }}>
                        {ta('ctaSub')}
                    </p>
                    <div style={{ display: 'flex', justifyContent: 'center', gap: '20px', flexWrap: 'wrap' }}>
                        <Link href="/diagnostic?pack=aya-sub" className="btn" style={{ background: 'white', color: 'var(--text-main)' }}>
                            {ta('ctaCertified')}
                        </Link>
                        <Link href="/diagnostic" className="btn" style={{ border: '1px solid rgba(255,255,255,0.3)', color: 'white' }}>
                            {ta('freeAudit')}
                        </Link>
                    </div>
                </div>
            </section>

            {/* FOOTER */}
            <footer className="footer" style={{ background: 'var(--text-main)', color: 'white', padding: '40px 0', textAlign: 'center' }}>
                <div className="container">
                    <div style={{ display: 'flex', justifyContent: 'center', gap: '20px', flexWrap: 'wrap', marginBottom: '15px' }}>
                        <Link href="/developers" style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.85rem', textDecoration: 'none' }}>{ta('footerApiDev')}</Link>
                        <Link href="/mentions" style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.85rem', textDecoration: 'none' }}>{ta('footerMentions')}</Link>
                        <Link href="/confidentialite" style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.85rem', textDecoration: 'none' }}>{ta('footerPrivacy')}</Link>
                    </div>
                    <p style={{ color: '#ffffff', opacity: 0.9, fontSize: '0.9rem', fontWeight: '500' }}>{ta('footerText')}</p>
                </div>
            </footer>
        </div>
    );
}
