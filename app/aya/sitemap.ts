import { MetadataRoute } from 'next';
import { getAyaSitemapPage } from '@/lib/db';
import {
    ENTITIES_PER_SITEMAP,
    SITEMAP_BASE_URL,
    getSitemapChunkCount,
} from '@/lib/sitemap-config';

/**
 * Chunked sitemaps for the ~367 000 AYA entity certificate pages, served at
 * /aya/sitemap/[id].xml.
 *
 * These files are advertised to crawlers via robots.txt (the Sitemaps protocol
 * allows several `Sitemap:` directives), so we do not depend on Next.js
 * emitting a sitemap index — it does not document doing so.
 *
 * Entities are ordered certified-first then by score, and that ordering is
 * deterministic, so chunk 0 carries the strongest pages and no entity can slip
 * between two chunks.
 */
/**
 * Sitemap routes are cached at build time by default. The registry gains
 * entities continuously, so refresh daily instead of freezing until the next
 * deploy. Note the chunk COUNT is still fixed at build time: crossing a new
 * 45 000 boundary between deploys adds its chunk at the next build, which the
 * daily rebuild of robots.txt then advertises.
 */
export const revalidate = 86_400;

export async function generateSitemaps(): Promise<Array<{ id: number }>> {
    const chunks = await getSitemapChunkCount();
    return Array.from({ length: chunks }, (_, id) => ({ id }));
}

export default async function sitemap(props: {
    id: Promise<string>;
}): Promise<MetadataRoute.Sitemap> {
    // Next.js 16 hands the id over as a promise resolving to a string.
    const rawId = await props.id;
    const id = Number.parseInt(String(rawId), 10);
    if (!Number.isFinite(id) || id < 0) return [];

    const entities = await getAyaSitemapPage(id + 1, ENTITIES_PER_SITEMAP);

    return entities.map((entity) => ({
        url: `${SITEMAP_BASE_URL}/aya/e/${entity.entity_id}`,
        lastModified: entity.updated_at ?? undefined,
        changeFrequency: 'monthly' as const,
        priority: 0.6,
    }));
}
