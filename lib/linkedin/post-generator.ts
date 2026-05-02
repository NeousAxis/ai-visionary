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
  sectorMacro?: string;
  city?: string;
  country?: string;
  locale: 'fr' | 'en';
}

export interface GeneratedPost {
  text: string;
  locale: 'fr' | 'en';
}

const CERTIFICATE_BASE_URL = 'https://ai-visionary.xyz/aya/e';

function buildSectorQueryFr(sector: string | undefined, city: string | undefined): string {
  if (sector && city) return `meilleur ${sector.toLowerCase()} a ${city}`;
  if (sector) return `meilleur ${sector.toLowerCase()}`;
  if (city) return `meilleure entreprise a ${city}`;
  return 'meilleure entreprise dans son secteur';
}

function buildSectorQueryEn(sector: string | undefined, city: string | undefined): string {
  if (sector && city) return `best ${sector.toLowerCase()} in ${city}`;
  if (sector) return `best ${sector.toLowerCase()}`;
  if (city) return `top company in ${city}`;
  return 'top company in its sector';
}

export function generatePostFr(ctx: PostContext): string {
  const query = buildSectorQueryFr(ctx.sectorMacro, ctx.city);
  const certUrl = `${CERTIFICATE_BASE_URL}/${ctx.entityId}`;

  return `Demandez a ChatGPT, Claude ou Gemini : "${query}".

${ctx.entityName} ne sera pas cite. Pourtant l'entreprise existe, opere et est legitime.

Pourquoi ? Score AI-readability : ${ctx.currentScore}/100. Pas d'ASR. Donnees non structurees pour les IA.

Lisibilite -> recommandabilite -> visibilite. La chaine est rompue des la premiere etape.

Avec un ASR (AI Singular Record signe cryptographiquement) : projection ${ctx.projectedScore}/100. Lisible par toutes les IA. Et independant de Google, OpenAI, Anthropic.

Verifiable : ${certUrl}

#AIvisibility #AISearch #StructuredData #AYA #AIO`;
}

export function generatePostEn(ctx: PostContext): string {
  const query = buildSectorQueryEn(ctx.sectorMacro, ctx.city);
  const certUrl = `${CERTIFICATE_BASE_URL}/${ctx.entityId}`;

  return `Ask ChatGPT, Claude or Gemini: "${query}".

${ctx.entityName} won't be mentioned. Yet the company exists, operates and is legitimate.

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
