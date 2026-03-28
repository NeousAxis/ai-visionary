import Link from 'next/link';
import { db } from '@/lib/db';
import AyaRegistryClient from '@/app/components/AyaRegistryClient';
import LanguageToggle from '@/app/components/LanguageToggle';
import { Suspense } from 'react';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

export async function generateMetadata(): Promise<Metadata> {
    const stats = await db.getAyaEntitiesPaginated({ page: 1, pageSize: 1 });
    const total = stats.total || 0;
    const rounded = Math.floor(total / 100) * 100;
    return {
        title: `Registre AYA — ${rounded}+ entreprises indexees pour l'IA`,
        description: `Le registre public AYA regroupe plus de ${rounded} entreprises indexees et certifiees pour leur lisibilite IA. Consultez les scores AIO, les donnees structurees et les certificats de chaque entite.`,
        openGraph: {
            title: `Registre AYA — ${rounded}+ entreprises indexees | AI Visionary`,
            description: `Explorez le registre public AYA : plus de ${rounded} entreprises notees sur leur lisibilite par les IA (ChatGPT, Gemini, Claude).`,
            url: 'https://ai-visionary.com/aya',
            siteName: 'AI Visionary',
            type: 'website',
        },
    };
}

// Force dynamic rendering (no static cache)
export const dynamic = 'force-dynamic';

const PAGE_SIZE = 20;

type SortMode = 'default' | 'alpha' | 'score' | 'country' | 'certified';
const VALID_SORTS: SortMode[] = ['default', 'alpha', 'score', 'country', 'certified'];

export default async function AyaPage({
    searchParams,
}: {
    searchParams: Promise<{ page?: string; q?: string; sort?: string }>;
}) {
    const params = await searchParams;
    const page = Math.max(1, parseInt(params.page || '1', 10) || 1);
    const search = (params.q || '').trim();
    const sort: SortMode = VALID_SORTS.includes(params.sort as SortMode) ? (params.sort as SortMode) : 'default';

    const t = await getTranslations('aya');

    // Server-side data fetch — only 20 entities per page
    const { data: entities, total, certifiedCount, indexedCount } = await db.getAyaEntitiesPaginated({
        page,
        pageSize: PAGE_SIZE,
        search: search || undefined,
        sort,
    });

    // JSON-LD for SEO (always based on total counts)
    const totalAll = certifiedCount + indexedCount;
    const jsonLd = {
        "@context": "https://schema.org",
        "@type": "ItemList",
        "name": "AYA Registry \u2014 AI Readability Index",
        "description": `Public registry of ${totalAll}+ organizations rated for AI readability (AIO score 0-100)`,
        "url": "https://ai-visionary.com/aya",
        "numberOfItems": totalAll,
        "itemListElement": entities.slice(0, 10).map((e: any, i: number) => ({
            "@type": "ListItem",
            "position": i + 1,
            "item": {
                "@type": "Organization",
                "name": e.display_name || e.legal_name || e.website || "Unknown",
                ...(e.website ? { "url": e.website } : {}),
            },
        })),
    };

    return (
        <div style={{ background: 'var(--bg-main)', minHeight: '100vh', fontFamily: 'var(--font-body)' }}>

            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
            />

            {/* HEADER */}
            <header style={{ background: 'white', borderBottom: '1px solid var(--border-light)', position: 'sticky', top: 0, zIndex: 100, padding: '15px 0' }}>
                <div className="container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: '15px', textDecoration: 'none' }}>
                        <img src="/logo-v2.png" alt="AI Visionary" style={{ height: '40px', width: 'auto' }} />
                        <div style={{ height: '24px', width: '1px', background: 'var(--border-light)' }}></div>
                        <span style={{ fontSize: '1.2rem', fontWeight: 'bold', color: 'var(--text-main)', letterSpacing: '-0.02em' }}>
                            {t('registryTitle')} <span style={{ color: 'var(--primary-color)', fontWeight: '400' }}>{t('registryName')}</span>
                        </span>
                    </Link>

                    <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
                        <LanguageToggle />
                        <Link href="/diagnostic?pack=aya-sub" className="btn btn-primary" style={{ padding: '0.6rem 1.2rem', fontSize: '0.9rem' }}>
                            {t('registerEntity')}
                        </Link>
                    </div>
                </div>
            </header>

            {/* CLIENT INTERACTIVE SECTION (search, sort, grid, pagination) */}
            <Suspense fallback={
                <div style={{ textAlign: 'center', padding: '80px 20px' }}>{t('loading')}</div>
            }>
                <AyaRegistryClient
                    entities={entities}
                    totalEntities={total}
                    certifiedCount={certifiedCount}
                    indexedCount={indexedCount}
                    currentPage={page}
                    pageSize={PAGE_SIZE}
                    currentSearch={search}
                    currentSort={sort}
                />
            </Suspense>

            {/* CTA SECTION */}
            <section className="section" style={{ background: 'var(--text-main)', color: 'white', textAlign: 'center' }}>
                <div className="container">
                    <h2 style={{ color: 'white', marginBottom: '20px' }}>{t('ctaTitle')}</h2>
                    <p className="subheadline" style={{ color: 'rgba(255,255,255,0.8)', marginBottom: '20px' }}>
                        {t('ctaSub')}
                    </p>
                    <div style={{ display: 'flex', justifyContent: 'center', gap: '20px', flexWrap: 'wrap' }}>
                        <Link href="/diagnostic?pack=aya-sub" className="btn" style={{ background: 'white', color: 'var(--text-main)' }}>
                            {t('ctaCertified')}
                        </Link>
                        <Link href="/diagnostic" className="btn" style={{ border: '1px solid rgba(255,255,255,0.3)', color: 'white' }}>
                            {t('ctaAudit')}
                        </Link>
                    </div>
                </div>
            </section>

            {/* FOOTER */}
            <footer className="footer" style={{ background: 'var(--text-main)', color: 'white', padding: '40px 0', textAlign: 'center' }}>
                <div className="container">
                    <div style={{ display: 'flex', justifyContent: 'center', gap: '20px', flexWrap: 'wrap', marginBottom: '15px' }}>
                        <Link href="/developers" style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.85rem', textDecoration: 'none' }}>{t('footerApiDev')}</Link>
                        <Link href="/mentions" style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.85rem', textDecoration: 'none' }}>{t('footerLegal')}</Link>
                        <Link href="/confidentialite" style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.85rem', textDecoration: 'none' }}>{t('footerPrivacy')}</Link>
                    </div>
                    <p style={{ color: '#ffffff', opacity: 0.9, fontSize: '0.9rem', fontWeight: '500' }}>{t('footerText')}</p>
                </div>
            </footer>
        </div>
    );
}
