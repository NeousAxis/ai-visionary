/**
 * Generateur de texte de post LinkedIn.
 *
 * Doctrine validee par Cyril (1er mai 2026) :
 * - Lisibilite -> recommandabilite -> visibilite (CHAINE STRUCTURELLE, pas SEO)
 * - On vend (a) la structuration et (b) la souverainete crypto
 * - Ton demonstratif et factuel (pas de "ameliorez votre score")
 * - Doctrine AYA constitution : pas de recommandation de ranking, juste constat
 */

export interface PostContext {
  entityName: string;
  entityDomain: string;
  entityId: string;
  currentScore: number;     // ex: 47 (cappe a 50 sans ASR)
  projectedScore: number;   // ex: 78 (avec ASR + structures)
  /** Phrase decrivant le secteur, deja formee dans la locale du post.
   *  Exemple FR : "plateforme e-commerce" ; EN : "e-commerce platform". */
  sectorPhrase?: string;
  city?: string;
  country?: string;
  locale: 'fr' | 'en';
  /** Handle LinkedIn — utilise pour generer un @mention dans le texte.
   *  Le tag reel cliquable est cree par Playwright autocomplete au moment de
   *  la publication ; ici on insert "@EntityName" en texte plain. */
  linkedinSlug?: string;
}

export interface GeneratedPost {
  text: string;
  locale: 'fr' | 'en';
}

const CERTIFICATE_BASE_URL = 'https://ai-visionary.xyz/aya/e';
const DIAGNOSTIC_URL = 'https://ai-visionary.xyz/diagnostic';

/**
 * Builds a natural-sounding question that a real human would ask ChatGPT.
 * Picks one of several templates at random to vary across posts.
 *
 * `sector` is already a noun phrase like "online retailer" or "supermarket chain".
 * `country` is the country *name* (e.g. "Switzerland"), not the ISO code.
 */
function buildSectorQueryEn(sector: string | undefined, country: string | undefined): string {
  if (!sector) return country ? `top company in ${country}` : 'top company in this sector';

  const templates: string[] = [];
  if (country) {
    templates.push(`recommend a good ${sector} in ${country}`);
    templates.push(`which ${sector} should I use in ${country}`);
    templates.push(`top ${sector} in ${country}`);
    templates.push(`best ${sector} for ${country} customers`);
  }
  templates.push(`recommend a good ${sector}`);
  templates.push(`which ${sector} is the most reliable`);
  templates.push(`top-rated ${sector}`);

  return templates[Math.floor(Math.random() * templates.length)];
}

// FR template removed (2 May 2026): all LinkedIn posts are now in English.
// Kept signature stable for callers — generatePost() always returns EN.

/** ISO country code → human-readable English country name */
const COUNTRY_NAMES_EN: Record<string, string> = {
  CH: 'Switzerland', FR: 'France', DE: 'Germany', GB: 'the UK', UK: 'the UK',
  IT: 'Italy', ES: 'Spain', NL: 'the Netherlands', BE: 'Belgium', AT: 'Austria',
  PL: 'Poland', SE: 'Sweden', DK: 'Denmark', NO: 'Norway', FI: 'Finland',
  IE: 'Ireland', PT: 'Portugal', CZ: 'Czechia', GR: 'Greece', HU: 'Hungary',
  US: 'the US', CA: 'Canada', AU: 'Australia', IL: 'Israel',
};

function countryName(code: string | undefined): string | undefined {
  if (!code) return undefined;
  return COUNTRY_NAMES_EN[code.toUpperCase()] || undefined;
}

export function generatePostEn(ctx: PostContext): string {
  const country = countryName(ctx.country);
  const query = buildSectorQueryEn(ctx.sectorPhrase, country);
  const mention = ctx.linkedinSlug ? `@${ctx.entityName}` : ctx.entityName;

  return `🔍 Test: ask ChatGPT "${query}".

${mention} won't show up in the answer.

Yet ${ctx.entityName} is legitimate, operating, with real customers. But to AI systems: AI-readability score ${ctx.currentScore}/100. No ASR. Invisible data.

It's mechanical:
Readability → Recommendability → Visibility.
No structure, no citation. No citation, no leads.

With an ASR (cryptographically-signed AI Singular Record):
projected ${ctx.projectedScore}/100. Readable by EVERY AI.
Independent of Google, OpenAI, Anthropic.
🇨🇭 Swiss sovereignty, Swiss infrastructure.

👉 And YOUR company? Test in 30 seconds:
${DIAGNOSTIC_URL}

#AIvisibility #AISearch #ASR #SwissTech #StructuredData`;
}

export function generatePost(ctx: PostContext): GeneratedPost {
  // All LinkedIn posts are now in English (decision 2 May 2026).
  return { text: generatePostEn(ctx), locale: 'en' };
}

/**
 * Always returns 'en' — locale field kept for back-compat with callers.
 */
export function pickLocale(_country: string | undefined): 'fr' | 'en' {
  return 'en';
}
