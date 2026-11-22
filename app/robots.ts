import { MetadataRoute } from 'next';
import { SITEMAP_BASE_URL, entitySitemapUrl, getSitemapChunkCount } from '@/lib/sitemap-config';

/**
 * PAS de `revalidate` ici, et c'est délibéré.
 *
 * `generateSitemaps()` fige la liste des chunks au BUILD : un id absent de cette
 * liste renvoie 404, Next.js ne le rend pas à la demande. Si robots.txt
 * recalculait le nombre de chunks à l'exécution, il finirait par annoncer un
 * `/aya/sitemap/9.xml` qui n'existe pas dès que le registre franchit un multiple
 * de 45 000 entre deux déploiements. Marge actuelle : environ 37 800 entités.
 *
 * En restant purement statique, ce fichier est calculé au même build que les
 * chunks et ne peut donc pas les contredire. Le prix à payer est qu'un nouveau
 * chunk n'est annoncé qu'au déploiement suivant, ce qui est exactement le moment
 * où il commence à exister.
 */
export default async function robots(): Promise<MetadataRoute.Robots> {
    // Le protocole Sitemaps accepte plusieurs directives `Sitemap:`, ce qui rend
    // les chunks découvrables sans dépendre d'un fichier index.
    const chunks = await getSitemapChunkCount();
    const entitySitemaps = Array.from({ length: chunks }, (_, id) => entitySitemapUrl(id));

    return {
        rules: {
            userAgent: '*',
            allow: '/',
            disallow: ['/admin/', '/api/', '/debug/', '/certificate/'],
        },
        sitemap: [`${SITEMAP_BASE_URL}/sitemap.xml`, ...entitySitemaps],
    };
}
