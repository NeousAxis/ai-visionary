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

function buildSectorQueryFr(sector: string | undefined, city: string | undefined): string {
  if (sector && city) return `meilleure ${sector} a ${city}`;
  if (sector) return `meilleure ${sector}`;
  if (city) return `meilleure entreprise a ${city}`;
  return 'meilleure entreprise dans son secteur';
}

function buildSectorQueryEn(sector: string | undefined, city: string | undefined): string {
  if (sector && city) return `best ${sector} in ${city}`;
  if (sector) return `best ${sector}`;
  if (city) return `top company in ${city}`;
  return 'top company in its sector';
}

export function generatePostFr(ctx: PostContext): string {
  const query = buildSectorQueryFr(ctx.sectorPhrase, ctx.city);
  const certUrl = `${CERTIFICATE_BASE_URL}/${ctx.entityId}`;
  // Mention "@Nom" si on a un slug LinkedIn (le tag reel cliquable est fait
  // par Playwright autocomplete en mode auto-publish)
  const mention = ctx.linkedinSlug ? `@${ctx.entityName}` : ctx.entityName;

  return `Demandez a ChatGPT, Claude ou Gemini : "${query}".

${mention} ne sera pas cite. Pourtant l'entreprise existe, opere et est legitime.

Pourquoi ? Score AI-readability : ${ctx.currentScore}/100. Pas d'ASR. Donnees non structurees pour les IA.

Lisibilite -> recommandabilite -> visibilite. La chaine est rompue des la premiere etape.

Avec un ASR (AI Singular Record signe cryptographiquement) : projection ${ctx.projectedScore}/100. Lisible par toutes les IA. Et independant de Google, OpenAI, Anthropic.

Verifiable : ${certUrl}

#AIvisibility #AISearch #StructuredData #AYA #AIO`;
}

export function generatePostEn(ctx: PostContext): string {
  const query = buildSectorQueryEn(ctx.sectorPhrase, ctx.city);
  const certUrl = `${CERTIFICATE_BASE_URL}/${ctx.entityId}`;
  const mention = ctx.linkedinSlug ? `@${ctx.entityName}` : ctx.entityName;

  return `Ask ChatGPT, Claude or Gemini: "${query}".

${mention} won't be mentioned. Yet the company exists, operates and is legitimate.

Why? AI-readability score: ${ctx.currentScore}/100. No ASR. Unstructured data.

Readability -> recommendability -> visibility. The chain breaks at step one.

With an ASR (cryptographically-signed AI Singular Record): projected ${ctx.projectedScore}/100. Readable by every AI. Independent of Google, OpenAI, Anthropic.

Verifiable: ${certUrl}

#AIvisibility #AISearch #StructuredData #AYA #AIO`;
}

export function generatePost(ctx: PostContext): GeneratedPost {
  const text = ctx.locale === 'fr' ? generatePostFr(ctx) : generatePostEn(ctx);
  return { text, locale: ctx.locale };
}

/**
 * Pick locale heuristically from entity country code.
 * FR par defaut pour FR/CH/BE/LU. EN pour le reste.
 */
export function pickLocale(country: string | undefined): 'fr' | 'en' {
  if (!country) return 'en';
  const fr = ['FR', 'CH', 'BE', 'LU', 'MC'];
  return fr.includes(country.toUpperCase()) ? 'fr' : 'en';
}
