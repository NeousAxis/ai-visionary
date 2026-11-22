import { headers } from 'next/headers';

const BASE = 'https://ai-visionary.xyz';

/**
 * Construit `alternates` pour `generateMetadata` : canonical auto-référent plus
 * les balises hreflang EN/FR.
 *
 * Sans hreflang, Google ne peut pas savoir que `/aya/e/x` et `/fr/aya/e/x` sont
 * deux versions linguistiques de la même page : il risque de les traiter comme
 * du contenu dupliqué et d'en écarter une.
 *
 * Le canonical doit être AUTO-RÉFÉRENT : la page française se déclare
 * canonique d'elle-même. Pointer le canonical de la version française vers
 * l'anglaise reviendrait à demander à Google de ne pas indexer le français,
 * soit exactement l'inverse du but.
 *
 * @param path chemin SANS préfixe de langue, ex. `/aya/e/<id>`
 */
export async function localizedAlternates(path: string) {
    const clean = path.startsWith('/') ? path : `/${path}`;
    const isFrench = (await headers()).get('x-locale') === 'fr';

    const en = `${BASE}${clean}`;
    const fr = `${BASE}/fr${clean}`;

    return {
        canonical: isFrench ? fr : en,
        languages: {
            en,
            fr,
            // x-default = version servie quand aucune langue ne correspond.
            // L'anglais, cohérent avec la locale par défaut du site.
            'x-default': en,
        },
    };
}
