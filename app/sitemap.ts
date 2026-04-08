
import { MetadataRoute } from 'next';
import { db } from '@/lib/db';

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

    // 2. Dynamic entity certificate pages (from Supabase aya_registry)
    let entityPages: MetadataRoute.Sitemap = [];
    try {
        const entities = await db.getAyaEntities(50000);
        entityPages = entities
            .filter((entity: any) => entity.entity_id)
            .map((entity: any) => ({
                url: `${baseUrl}/aya/e/${entity.entity_id}`,
                lastModified: new Date(entity.updated_at || entity.created_at || now),
                changeFrequency: 'monthly' as const,
                priority: 0.7,
            }));
    } catch (_err) {
        // Supabase unavailable at build time — static sitemap only
        console.warn('[sitemap] Could not fetch entities from Supabase:', _err);
    }

    return [...staticPages, ...entityPages];
}
