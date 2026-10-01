/**
 * Normalisation stricte des pays vers ISO 3166-1 alpha-2 (colonne aya_registry.country_legal).
 *
 * Renvoie un code valide ou null : on ne fabrique jamais de code (doctrine AYO).
 * Remplace les raccourcis `country.length === 2` (« 日本 » fait 2 caractères) et
 * `.slice(0, 2)` (« Netherlands » devenait « NE », le Niger).
 *
 * Même liste de codes que aya/country_iso.py et que le trigger SQL
 * aya_normalize_country_legal (cohérence vérifiée par aya/test_country_iso.py).
 */

// codes:start
const ISO_3166_ALPHA2 = new Set((
    'AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI ' +
    'BJ BL BM BN BO BQ BR BS BT BV BW BY BZ CA CC CD CF CG CH CI CK CL CM CN ' +
    'CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK ' +
    'FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM ' +
    'HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP KE KG KH KI KM KN ' +
    'KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ' +
    'ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP ' +
    'NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW ' +
    'SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF ' +
    'TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG UM US UY UZ VA VC VE VG VI ' +
    'VN VU WF WS YE YT ZA ZM ZW'
).split(' '));
// codes:end

/** Kosovo : code utilisateur XK, employé par la Confédération, l'UE et CLDR. */
const VALID_CODES = new Set<string>([...ISO_3166_ALPHA2, 'XK']);

/** Codes à deux lettres hors norme dont le sens est sans ambiguïté. */
const CODE_ALIASES: Record<string, string> = { UK: 'GB', EL: 'GR' };

/** Noms usuels absents des noms CLDR renvoyés par Intl.DisplayNames. */
const NAME_ALIASES: Record<string, string> = {
    usa: 'US', 'u.s.a': 'US', 'u.s': 'US', america: 'US', 'united states of america': 'US',
    'great britain': 'GB', britain: 'GB', england: 'GB', scotland: 'GB', wales: 'GB',
    holland: 'NL', 'the netherlands': 'NL', uae: 'AE', korea: 'KR', russia: 'RU',
    'czech republic': 'CZ', turkey: 'TR', macau: 'MO', 'ivory coast': 'CI',
    'рф': 'RU', 'российская федерация': 'RU', '호주': 'AU', '澳洲': 'AU', '台灣': 'TW', '台湾': 'TW',
};

/** Langues dont les noms de pays CLDR sont indexés. */
const LOCALES = [
    'en', 'fr', 'de', 'it', 'es', 'pt', 'nl', 'pl', 'cs', 'sk', 'sv', 'da', 'nb', 'fi', 'ro',
    'hu', 'hr', 'sl', 'el', 'tr', 'ru', 'uk', 'ja', 'zh-Hans', 'zh-Hant', 'ko',
];

function nameKey(value: string): string {
    return value
        .normalize('NFKC')
        .toLowerCase()
        .replace(/[\u2018\u2019`]/g, "'")
        .replace(/\s+/g, ' ')
        .replace(/^[\s.]+|[\s.]+$/g, '');
}

function stripAccents(value: string): string {
    return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

let nameIndex: Map<string, string> | null = null;

function getNameIndex(): Map<string, string> {
    if (nameIndex) return nameIndex;
    const index = new Map<string, string>();
    const ambiguous = new Set<string>();
    const add = (name: string | undefined, code: string) => {
        if (!name) return;
        const key = nameKey(name);
        for (const k of [key, stripAccents(key)]) {
            if (!k || ambiguous.has(k)) continue;
            const known = index.get(k);
            if (known && known !== code) {
                index.delete(k); // même nom pour deux pays : on ne tranche pas
                ambiguous.add(k);
            } else {
                index.set(k, code);
            }
        }
    };
    for (const locale of LOCALES) {
        for (const style of ['long', 'short'] as const) {
            let names: Intl.DisplayNames;
            try {
                names = new Intl.DisplayNames([locale], { type: 'region', style });
            } catch {
                continue;
            }
            for (const code of VALID_CODES) add(names.of(code), code);
        }
    }
    for (const [name, code] of Object.entries(NAME_ALIASES)) index.set(nameKey(name), code);
    nameIndex = index;
    return index;
}

/** Code ISO 3166-1 alpha-2 (ou XK) correspondant à `raw`, sinon null. */
export function normalizeCountryCode(raw: unknown): string | null {
    if (typeof raw !== 'string') return null;
    const text = raw.normalize('NFKC').trim().replace(/\.+$/, '').trim();
    if (!text) return null;
    if (/^[A-Za-z]{2}$/.test(text)) {
        const upper = text.toUpperCase();
        const code = CODE_ALIASES[upper] ?? upper;
        return VALID_CODES.has(code) ? code : null;
    }
    const index = getNameIndex();
    const key = nameKey(text);
    return index.get(key) ?? index.get(stripAccents(key)) ?? null;
}
