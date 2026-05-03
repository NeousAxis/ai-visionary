
import { MetadataRoute } from 'next';
import { db, getAyaEntitiesAggregated, getAyaSectorsAggregated, getAyaCountriesAggregated, getAyaSectorCountryCombinationsAggregated } from '@/lib/db';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
    const baseUrl = 'https://ai-visionary.xyz';

    const now = new Date();

    // 1. Static pages
    const staticPages: MetadataRoute.Sitemap = [
        {
            url: baseUrl,
            lastModified: now,
            changeFrequency: 'weekly',
            priority: 1.0,
        },
        {
            url: `${baseUrl}/aya`,
            lastModified: now,
            changeFrequency: 'daily',
            priority: 0.9,
        },
        {
            url: `${baseUrl}/diagnostic`,
            lastModified: now,
            changeFrequency: 'monthly',
            priority: 0.5,
        },
        {
            url: `${baseUrl}/ai-et-votre-entreprise`,
            lastModified: now,
            changeFrequency: 'monthly',
            priority: 0.5,
        },
        {
            url: `${baseUrl}/developers`,
            lastModified: now,
            changeFrequency: 'monthly',
            priority: 0.5,
        },
        {
            url: `${baseUrl}/confidentialite`,
            lastModified: now,
            changeFrequency: 'yearly',
            priority: 0.5,
        },
        {
            url: `${baseUrl}/mentions`,
            lastModified: now,
            changeFrequency: 'yearly',
            priority: 0.5,
        },
    ];

    // 2. Dynamic entity certificate pages (Supabase + VPS Postgres aggregated)
    let entityPages: MetadataRoute.Sitemap = [];
    try {
        // getAyaEntitiesAggregated supports pagination; fetch a large first page to capture
        // all ~30k entities (Supabase ~4 438 + VPS ~25 860).  pageSize=50 000 is safe for
        // sitemap generation (server-side only, never sent to the browser).
        const result = await getAyaEntitiesAggregated({ page: 1, pageSize: 50_000 });
        entityPages = result.data
            .filter((entity: any) => entity.entity_id)
            .map((entity: any) => ({
                url: `${baseUrl}/aya/e/${entity.entity_id}`,
                lastModified: new Date(entity.updated_at || entity.created_at || now),
                changeFrequency: 'monthly' as const,
                priority: 0.6,
            }));
    } catch (_err) {
        // DB unavailable at build time — static sitemap only
        console.warn('[sitemap] Could not fetch entities (aggregated):', _err);
    }

    // 3. Sector landing pages (/aya/sector/[macro]) — aggregated
    let sectorPages: MetadataRoute.Sitemap = [];
    try {
        const sectors = await getAyaSectorsAggregated();
        sectorPages = sectors.map(({ sector }) => ({
            url: `${baseUrl}/aya/sector/${encodeURIComponent(sector)}`,
            lastModified: now,
            changeFrequency: 'weekly' as const,
            priority: 0.8,
        }));
    } catch (_err) {
        console.warn('[sitemap] Could not fetch sectors (aggregated):', _err);
    }

    // 4. Country landing pages (/aya/country/[code]) — aggregated
    let countryPages: MetadataRoute.Sitemap = [];
    try {
        const countries = await getAyaCountriesAggregated();
        countryPages = countries.map(({ country }) => ({
            url: `${baseUrl}/aya/country/${country}`,
            lastModified: now,
            changeFrequency: 'weekly' as const,
            priority: 0.8,
        }));
    } catch (_err) {
        console.warn('[sitemap] Could not fetch countries (aggregated):', _err);
    }

    // 5. Sector × Country cross pages (/aya/sector/[macro]/country/[code]) — aggregated
    //    Only includes combinations that actually have entities (count >= 1).
    let crossPages: MetadataRoute.Sitemap = [];
    try {
        const combinations = await getAyaSectorCountryCombinationsAggregated();
        crossPages = combinations.map(({ sector, country }) => ({
            url: `${baseUrl}/aya/sector/${encodeURIComponent(sector)}/country/${country}`,
            lastModified: now,
            changeFrequency: 'weekly' as const,
            priority: 0.7,
        }));
    } catch (_err) {
        console.warn('[sitemap] Could not fetch sector×country combinations (aggregated):', _err);
    }

    // Safety check: Google Sitemaps support max 50 000 URLs and 50 MB per file.
    // With ~4 438 Supabase entities, ~14 sectors, ~73 countries and < 1 000 cross combos
    // we are well within limits. Log a warning if we approach the threshold.
    const total = staticPages.length + entityPages.length + sectorPages.length + countryPages.length + crossPages.length;
    if (total > 45_000) {
        console.warn(`[sitemap] URL count ${total} is approaching the 50 000 limit — consider splitting into multiple sitemaps.`);
    }

    return [...staticPages, ...sectorPages, ...countryPages, ...crossPages, ...entityPages];
}
