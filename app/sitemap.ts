
import { MetadataRoute } from 'next';

// Mock function - En production, cela cherchera tous les IDs actifs dans Firestore
async function getAllEntityIds() {
    return [
        '7f8a9d12-3b4c-4d5e-9f0a-1b2c3d4e5f6a',
        'a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d'
    ];
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
    const baseUrl = 'https://ai-visionary.com';

    // 1. Pages Statiques
    const staticPages = [
        {
            url: baseUrl,
            lastModified: new Date(),
            changeFrequency: 'weekly' as const,
            priority: 1,
        },
        {
            url: `${baseUrl}/aya`,
            lastModified: new Date(),
            changeFrequency: 'daily' as const,
            priority: 0.9,
        },
    ];

    // 2. Pages Entités (Dynamiques)
    const ids = await getAllEntityIds();
    const entityPages = ids.map(id => ({
        url: `${baseUrl}/aya/e/${id}`,
        lastModified: new Date(),
        changeFrequency: 'monthly' as const,
        priority: 0.7,
    }));

    return [...staticPages, ...entityPages];
}
