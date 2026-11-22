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
    matcher: ['/fr', '/fr/:path*'],
};
