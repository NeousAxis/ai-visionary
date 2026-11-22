/**
 * lib/outreach/lang.ts
 *
 * Choix de la langue du template d'outreach a partir du pays legal de l'entite.
 * Par defaut EN (largement acceptable en B2B). FR uniquement pour les pays
 * majoritairement francophones — l'identite de l'expediteur etant suisse romande.
 */

export type OutreachLang = 'fr' | 'en';

// Pays a servir en francais (ISO 3166-1 alpha-2).
const FR_COUNTRIES = new Set(['FR', 'MC', 'CH', 'LU', 'BE', 'MQ', 'GP', 'GF', 'RE', 'NC', 'PF']);

export function pickOutreachLang(countryLegal?: string | null): OutreachLang {
    if (!countryLegal) return 'en';
    return FR_COUNTRIES.has(countryLegal.trim().toUpperCase()) ? 'fr' : 'en';
}
