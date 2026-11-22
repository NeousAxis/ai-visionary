import { NextRequest, NextResponse } from 'next/server';

/**
 * Donne au français ses propres URLs, sans déplacer une seule route.
 *
 * Le site est bilingue depuis toujours, mais les deux langues vivaient à la
 * MÊME adresse, la langue étant choisie par le cookie NEXT_LOCALE. Googlebot
 * crawle sans cookie : il ne voyait donc que l'anglais, et tout le contenu
 * français était invisible pour lui.
 *
 * Ce proxy réécrit `/fr/<chemin>` vers `/<chemin>` en posant l'en-tête
 * `x-locale: fr`, que `i18n/request.ts` lit en priorité. Résultat :
 *   /aya/e/<id>      -> anglais  (URLs existantes INCHANGÉES, aucun acquis SEO perdu)
 *   /fr/aya/e/<id>   -> français (nouvelle URL, indexable)
 *
 * Alternative écartée : passer l'app en `app/[locale]/`. Cela imposait de
 * déplacer les 23 routes et c'est exactement ce qui a fait échouer la tentative
 * i18n du 28 mars (branche `fix/i18n-bilingual`, archivée).
 */

const LOCALE_PREFIX = '/fr';

/** Chemins à ne JAMAIS traiter comme des pages traduisibles. */
function isExcluded(pathname: string): boolean {
    return (
        pathname.startsWith('/api/') ||
        pathname.startsWith('/_next/') ||
        pathname.startsWith('/agents/') ||   // endpoint MCP
        pathname.startsWith('/.well-known/') ||
        pathname === '/robots.txt' ||
        pathname === '/sitemap.xml' ||
        pathname === '/llms.txt' ||
        pathname.startsWith('/aya/sitemap/') ||
        /\.[a-z0-9]+$/i.test(pathname)       // fichiers statiques (.png, .svg, .ico...)
    );
}

export function proxy(req: NextRequest) {
    const { pathname, search } = req.nextUrl;

    // API interne /api/aya-local : réservée au serveur lui-même. Elle renvoie
    // des fiches complètes (dont l'email du titulaire) et était joignable depuis
    // Internet. Toute requête venue de l'extérieur passe par nginx, qui pose
    // X-Real-IP ; un appel local du serveur n'en a pas. (22.11.2026)
    if (pathname.startsWith('/api/aya-local')) {
        const ip = (req.headers.get('x-real-ip') || '').trim();
        if (ip && ip !== '127.0.0.1' && ip !== '::1') {
            return new NextResponse(null, { status: 404 });
        }
        return NextResponse.next();
    }

    if (!pathname.startsWith(LOCALE_PREFIX + '/') && pathname !== LOCALE_PREFIX) {
        return NextResponse.next();
    }

    // /fr        -> /
    // /fr/aya/x  -> /aya/x
    const stripped = pathname.slice(LOCALE_PREFIX.length) || '/';

    if (isExcluded(stripped)) {
        // /fr/api/... n'a pas de sens : renvoyer vers la vraie URL plutôt que
        // de servir l'API sous un préfixe de langue (contenu dupliqué).
        return NextResponse.redirect(new URL(stripped + search, req.url), 308);
    }

    const url = req.nextUrl.clone();
    url.pathname = stripped;

    const headers = new Headers(req.headers);
    headers.set('x-locale', 'fr');

    return NextResponse.rewrite(url, { request: { headers } });
}

export const config = {
    // Ne fait tourner le proxy que sur ce qui commence par /fr, pour ne
    // rien coûter aux 367 000 pages anglaises.
    // + l'API interne /api/aya-local, fermée à l'extérieur (voir plus haut).
    matcher: ['/fr', '/fr/:path*', '/api/aya-local/:path*'],
};
