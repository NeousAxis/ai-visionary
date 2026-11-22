
import { MetadataRoute } from 'next';
import { getAyaSectorsAggregated, getAyaCountriesAggregated, getAyaSectorCountryCombinationsAggregated } from '@/lib/db';

/**
 * Root sitemap: static pages + taxonomy landing pages ONLY.
 *
 * The ~367 000 entity certificate pages live in their own chunked sitemaps at
 * /aya/sitemap/[id].xml (see app/aya/sitemap.ts) and are advertised to crawlers
 * through robots.txt. Keeping them out of this file is what stops it from
 * crossing Google's hard 50 000-URL ceiling — above that limit Google discards
 * the whole file, which previously took every taxonomy page down with it.
 */
/** Taxonomy grows with the registry — refresh daily rather than at deploy time. */
export const revalidate = 86_400;

/**
 * Déclare la version française d'une URL via les balises d'alternance.
 *
 * On ne duplique PAS les entrées : une seule `<url>` portant `xhtml:link
 * hreflang` suffit à Google pour découvrir et indexer `/fr/...`. Dupliquer
 * aurait doublé le volume du sitemap pour rien.
 */
function withFrench(entry: MetadataRoute.Sitemap[number]): MetadataRoute.Sitemap[number] {
    const path = entry.url.replace('https://ai-visionary.xyz', '');
    // Pas de barre finale : l'accueil devient `/fr`, pas `/fr/`. Next redirige
    // `/fr/` en 308, et déclarer dans un sitemap une URL qui redirige envoie
    // Google faire un saut pour rien.
    return {
        ...entry,
        alternates: {
            languages: {
                en: entry.url,
                fr: `https://ai-visionary.xyz/fr${path}`,
            },
        },
    };
}

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
            url: `${baseUrl}/for-agents`,
            lastModified: now,
            changeFrequency: 'weekly',
            priority: 0.8,
        },
        {
            url: `${baseUrl}/pollen-agents`,
            lastModified: now,
            changeFrequency: 'weekly',
            priority: 0.7,
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

    // 2. Sector landing pages (/aya/sector/[macro]) — aggregated
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

    // Taxonomy grows with the registry (sector × country combinations), so the
    // ceiling still has to be watched even without the entity pages.
    const total = staticPages.length + sectorPages.length + countryPages.length + crossPages.length;
    if (total > 45_000) {
        console.warn(`[sitemap] Taxonomy URL count ${total} is approaching the 50 000 limit — split this file too.`);
    }

    // Chaque page statique et de taxonomie déclare sa version française.
    return [...staticPages, ...sectorPages, ...countryPages, ...crossPages].map(withFrench);
}
