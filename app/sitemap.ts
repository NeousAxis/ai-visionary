
import { MetadataRoute } from 'next';
import { db } from '@/lib/db';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
    const baseUrl = 'https://ai-visionary.com';

    // 1. Pages Statiques
    const staticPages: MetadataRoute.Sitemap = [
        {
            url: baseUrl,
            lastModified: new Date(),
            changeFrequency: 'weekly',
            priority: 1,
        },
        {
            url: `${baseUrl}/aya`,
            lastModified: new Date(),
            changeFrequency: 'daily',
            priority: 0.9,
        },
        {
            url: `${baseUrl}/diagnostic`,
            lastModified: new Date(),
            changeFrequency: 'monthly',
            priority: 0.8,
        },
        {
            url: `${baseUrl}/ai-et-votre-entreprise`,
            lastModified: new Date(),
            changeFrequency: 'monthly',
            priority: 0.7,
        },
        {
            url: `${baseUrl}/mentions`,
            lastModified: new Date(),
            changeFrequency: 'yearly',
            priority: 0.3,
        },
        {
            url: `${baseUrl}/confidentialite`,
            lastModified: new Date(),
            changeFrequency: 'yearly',
            priority: 0.3,
        },
    ];

    // 2. Pages Entités Dynamiques (depuis Supabase)
    let entityPages: MetadataRoute.Sitemap = [];
    try {
        const entities = await db.getAyaEntities(10000);
        entityPages = entities
            .map((entity: any) => ({
                url: `${baseUrl}/aya/e/${entity.entity_id || entity.aya_entity_id}`,
                lastModified: new Date(entity.last_update || entity.created_at),
                changeFrequency: 'monthly' as const,
                priority: entity.payment_completed ? 0.8 : 0.6,
            }));
    } catch {
        // Firestore indisponible au build — sitemap statique uniquement
    }

    return [...staticPages, ...entityPages];
}
