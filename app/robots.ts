import { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
    return {
        rules: {
            userAgent: '*',
            allow: '/',
            disallow: ['/admin/', '/api/', '/debug/'],
        },
        sitemap: 'https://ai-visionary.com/sitemap.xml',
    };
}
