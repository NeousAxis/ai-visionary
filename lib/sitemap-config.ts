import { getAyaSitemapCount } from '@/lib/db';

export const SITEMAP_BASE_URL = 'https://ai-visionary.xyz';

/**
 * URLs per entity sitemap chunk.
 *
 * Google rejects an ENTIRE sitemap file above 50 000 URLs (or 50 MB), it does
 * not simply truncate it. We keep a wide margin below that ceiling so a growing
 * registry can never silently push a file over the edge again.
 */
export const ENTITIES_PER_SITEMAP = 45_000;

/**
 * How many entity chunk files to declare. Always >= 1 so /aya/sitemap/0.xml
 * stays a valid (possibly empty) document even when the DB is unreachable.
 */
export async function getSitemapChunkCount(): Promise<number> {
    const total = await getAyaSitemapCount();
    return Math.max(1, Math.ceil(total / ENTITIES_PER_SITEMAP));
}

/** Public URL of one entity chunk. */
export function entitySitemapUrl(id: number): string {
    return `${SITEMAP_BASE_URL}/aya/sitemap/${id}.xml`;
}
