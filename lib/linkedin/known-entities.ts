/**
 * Liste curee de domaines d'entreprises "regionales / sectorielles mid-tier"
 * avec leur metadata authoritative (sector, country, locale, linkedin_slug).
 *
 * Decision Cyril (2 mai 2026) : on ne post PAS sur les mega-marques globales
 * (Stripe, Shopify, Slack, HuggingFace, Booking, Airbnb, etc.) car les IA
 * les citent deja meme sans ASR. L'angle "X ne sera pas cite" serait faux.
 *
 * Cible legitime : entreprises CONNUES dans leur pays/region mais pas
 * globalement. Sans ASR, elles ne sortent PAS dans les recherches IA
 * specialisees ("meilleure banque cantonale Zurich", "supermarche bio Geneve").
 *
 * Le `linkedin_slug` correspond au handle LinkedIn de l'entreprise
 * (ex. linkedin.com/company/migros → 'migros'). Utilise plus tard pour
 * l'autocomplete @ via Playwright lors de la publication automatique.
 */

export interface KnownEntityMeta {
  /** Secteur formule en FR (utilise dans la query du post FR) */
  sector_fr: string;
  /** Secteur formule en EN (utilise dans la query du post EN) */
  sector_en: string;
  /** Locale du post (override le pickLocale par country) */
  locale: 'fr' | 'en';
  /** Pays affiche (informatif, non utilise dans le template actuel) */
  country?: string;
  /** Ville (optionnel, ajoute au query si present) */
  city?: string;
  /** Handle LinkedIn de l'entreprise (linkedin.com/company/{slug}) — best effort */
  linkedin_slug?: string;
}

export const KNOWN_DOMAINS_META: Map<string, KnownEntityMeta> = new Map([
  // ──────────────────────────────────────────────────────────────────────────
  // SUISSE — entites nationales connues mais peu visibles globalement
  // ──────────────────────────────────────────────────────────────────────────
  ['migros.ch',       { sector_fr: 'distribution alimentaire', sector_en: 'supermarket chain', locale: 'fr', country: 'CH', city: 'Zurich', linkedin_slug: 'migros' }],
  ['coop.ch',         { sector_fr: 'distribution alimentaire', sector_en: 'supermarket chain', locale: 'fr', country: 'CH', city: 'Bale', linkedin_slug: 'coopgroup' }],
  ['manor.ch',        { sector_fr: 'grands magasins', sector_en: 'department store', locale: 'fr', country: 'CH', linkedin_slug: 'manor-ag' }],
  ['galaxus.ch',      { sector_fr: 'e-commerce generaliste', sector_en: 'online retailer', locale: 'fr', country: 'CH', linkedin_slug: 'galaxus' }],
  ['digitec.ch',      { sector_fr: 'e-commerce electronique', sector_en: 'online electronics store', locale: 'fr', country: 'CH', linkedin_slug: 'digitec-galaxus-ag' }],
  ['swisscom.ch',     { sector_fr: 'operateur telecom', sector_en: 'telecom operator', locale: 'fr', country: 'CH', linkedin_slug: 'swisscom' }],
  ['salt.ch',         { sector_fr: 'operateur telecom', sector_en: 'telecom operator', locale: 'fr', country: 'CH', linkedin_slug: 'salt-mobile' }],
  ['sunrise.ch',      { sector_fr: 'operateur telecom', sector_en: 'telecom operator', locale: 'fr', country: 'CH', linkedin_slug: 'sunrise-communications' }],
  ['postfinance.ch',  { sector_fr: 'banque', sector_en: 'bank', locale: 'fr', country: 'CH', linkedin_slug: 'postfinance' }],
  ['raiffeisen.ch',   { sector_fr: 'banque cooperative', sector_en: 'cooperative bank', locale: 'fr', country: 'CH', linkedin_slug: 'raiffeisenschweiz' }],
  ['zkb.ch',          { sector_fr: 'banque cantonale', sector_en: 'cantonal bank', locale: 'fr', country: 'CH', city: 'Zurich', linkedin_slug: 'zurcher-kantonalbank' }],
  ['baloise.ch',      { sector_fr: 'compagnie d assurance', sector_en: 'insurance company', locale: 'fr', country: 'CH', linkedin_slug: 'baloise' }],
  ['helvetia.com',    { sector_fr: 'compagnie d assurance', sector_en: 'insurance company', locale: 'fr', country: 'CH', linkedin_slug: 'helvetia-insurance' }],
  ['mobiliar.ch',     { sector_fr: 'compagnie d assurance', sector_en: 'insurance company', locale: 'fr', country: 'CH', linkedin_slug: 'die-mobiliar' }],
  ['visilab.ch',      { sector_fr: 'opticien', sector_en: 'optician chain', locale: 'fr', country: 'CH', linkedin_slug: 'visilab-sa' }],
  ['kuoni.ch',        { sector_fr: 'agence de voyage', sector_en: 'travel agency', locale: 'fr', country: 'CH', linkedin_slug: 'kuoni' }],
  ['globus.ch',       { sector_fr: 'grands magasins', sector_en: 'department store', locale: 'fr', country: 'CH', linkedin_slug: 'globus' }],

  // ──────────────────────────────────────────────────────────────────────────
  // FRANCE — entites nationales connues
  // ──────────────────────────────────────────────────────────────────────────
  ['fnac.com',                { sector_fr: 'e-commerce produits culturels et tech', sector_en: 'tech and books retailer', locale: 'fr', country: 'FR', linkedin_slug: 'fnac' }],
  ['darty.com',               { sector_fr: 'e-commerce electromenager', sector_en: 'home appliances retailer', locale: 'fr', country: 'FR', linkedin_slug: 'darty' }],
  ['cdiscount.com',           { sector_fr: 'e-commerce generaliste', sector_en: 'online retailer', locale: 'fr', country: 'FR', linkedin_slug: 'cdiscount' }],
  ['rueducommerce.fr',        { sector_fr: 'e-commerce generaliste', sector_en: 'online retailer', locale: 'fr', country: 'FR', linkedin_slug: 'rueducommerce' }],
  ['laredoute.fr',            { sector_fr: 'e-commerce mode et maison', sector_en: 'fashion and home retailer', locale: 'fr', country: 'FR', linkedin_slug: 'la-redoute' }],
  ['galerieslafayette.com',   { sector_fr: 'grand magasin de mode', sector_en: 'fashion department store', locale: 'fr', country: 'FR', linkedin_slug: 'galeries-lafayette' }],
  ['orange.fr',               { sector_fr: 'operateur telecom', sector_en: 'telecom operator', locale: 'fr', country: 'FR', linkedin_slug: 'orange' }],
  ['sfr.fr',                  { sector_fr: 'operateur telecom', sector_en: 'telecom operator', locale: 'fr', country: 'FR', linkedin_slug: 'sfr' }],
  ['bouyguestelecom.fr',      { sector_fr: 'operateur telecom', sector_en: 'telecom operator', locale: 'fr', country: 'FR', linkedin_slug: 'bouygues-telecom' }],
  ['free.fr',                 { sector_fr: 'operateur telecom', sector_en: 'telecom operator', locale: 'fr', country: 'FR', linkedin_slug: 'free' }],
  ['leclerc.com',             { sector_fr: 'distribution alimentaire', sector_en: 'supermarket chain', locale: 'fr', country: 'FR', linkedin_slug: 'e.leclerc' }],
  ['auchan.fr',               { sector_fr: 'distribution alimentaire', sector_en: 'supermarket chain', locale: 'fr', country: 'FR', linkedin_slug: 'auchan-retail' }],
  ['carrefour.fr',            { sector_fr: 'distribution alimentaire', sector_en: 'supermarket chain', locale: 'fr', country: 'FR', linkedin_slug: 'carrefour' }],
  ['intermarche.com',         { sector_fr: 'distribution alimentaire', sector_en: 'supermarket chain', locale: 'fr', country: 'FR', linkedin_slug: 'intermarche' }],
  ['monoprix.fr',             { sector_fr: 'distribution alimentaire', sector_en: 'urban supermarket', locale: 'fr', country: 'FR', linkedin_slug: 'monoprix' }],
  ['casino.fr',               { sector_fr: 'distribution alimentaire', sector_en: 'supermarket chain', locale: 'fr', country: 'FR', linkedin_slug: 'groupe-casino' }],
  ['sephora.fr',              { sector_fr: 'distribution beaute', sector_en: 'cosmetics retailer', locale: 'fr', country: 'FR', linkedin_slug: 'sephora' }],
  ['decathlon.fr',            { sector_fr: 'distribution articles de sport', sector_en: 'sports retailer', locale: 'fr', country: 'FR', linkedin_slug: 'decathlon' }],
  ['leroymerlin.fr',          { sector_fr: 'distribution bricolage', sector_en: 'DIY store', locale: 'fr', country: 'FR', linkedin_slug: 'leroy-merlin' }],
  ['bricomarche.com',         { sector_fr: 'distribution bricolage', sector_en: 'DIY store', locale: 'fr', country: 'FR', linkedin_slug: 'bricomarche' }],
  ['aubert.com',              { sector_fr: 'puericulture', sector_en: 'baby goods store', locale: 'fr', country: 'FR', linkedin_slug: 'aubert' }],
  ['kiabi.com',               { sector_fr: 'distribution mode familiale', sector_en: 'family fashion brand', locale: 'fr', country: 'FR', linkedin_slug: 'kiabi' }],
  ['jules.com',               { sector_fr: 'mode masculine', sector_en: 'menswear store', locale: 'fr', country: 'FR', linkedin_slug: 'jules-mode-mens' }],
  ['undiz.com',               { sector_fr: 'lingerie', sector_en: 'lingerie brand', locale: 'fr', country: 'FR', linkedin_slug: 'undiz' }],
  ['sncf-connect.com',        { sector_fr: 'reservation ferroviaire', sector_en: 'rail booking', locale: 'fr', country: 'FR', linkedin_slug: 'sncf-connect-tech' }],
  ['airfrance.fr',            { sector_fr: 'compagnie aerienne', sector_en: 'airline', locale: 'fr', country: 'FR', linkedin_slug: 'air-france' }],

  // ──────────────────────────────────────────────────────────────────────────
  // FRANCE — Media / Presse (connus en France, peu globalement)
  // ──────────────────────────────────────────────────────────────────────────
  ['lemonde.fr',          { sector_fr: 'presse quotidienne', sector_en: 'daily news', locale: 'fr', country: 'FR', linkedin_slug: 'le-monde' }],
  ['lefigaro.fr',         { sector_fr: 'presse quotidienne', sector_en: 'daily news', locale: 'fr', country: 'FR', linkedin_slug: 'le-figaro' }],
  ['liberation.fr',       { sector_fr: 'presse quotidienne', sector_en: 'daily news', locale: 'fr', country: 'FR', linkedin_slug: 'liberation' }],
  ['lesechos.fr',         { sector_fr: 'presse economique', sector_en: 'business news', locale: 'fr', country: 'FR', linkedin_slug: 'les-echos' }],
  ['lexpress.fr',         { sector_fr: 'magazine d actualite', sector_en: 'news magazine', locale: 'fr', country: 'FR', linkedin_slug: 'lexpress' }],
  ['lepoint.fr',          { sector_fr: 'magazine d actualite', sector_en: 'news magazine', locale: 'fr', country: 'FR', linkedin_slug: 'le-point' }],
  ['20minutes.fr',        { sector_fr: 'presse quotidienne gratuite', sector_en: 'free daily news', locale: 'fr', country: 'FR', linkedin_slug: '20minutesfrance' }],
  ['francetvinfo.fr',     { sector_fr: 'media audiovisuel public', sector_en: 'public broadcaster', locale: 'fr', country: 'FR', linkedin_slug: 'france-televisions' }],
  ['rfi.fr',              { sector_fr: 'radio internationale', sector_en: 'international radio', locale: 'fr', country: 'FR', linkedin_slug: 'rfi' }],

  // ──────────────────────────────────────────────────────────────────────────
  // ALLEMAGNE — entites nationales connues
  // ──────────────────────────────────────────────────────────────────────────
  ['otto.de',         { sector_fr: 'e-commerce generaliste', sector_en: 'online retailer', locale: 'en', country: 'DE', linkedin_slug: 'otto-gmbh-&-co-kg' }],
  ['mediamarkt.de',   { sector_fr: 'distribution electronique', sector_en: 'electronics retailer', locale: 'en', country: 'DE', linkedin_slug: 'mediamarkt' }],
  ['saturn.de',       { sector_fr: 'distribution electronique', sector_en: 'electronics retailer', locale: 'en', country: 'DE', linkedin_slug: 'saturn' }],
  ['lidl.de',         { sector_fr: 'distribution discount alimentaire', sector_en: 'discount supermarket', locale: 'en', country: 'DE', linkedin_slug: 'lidl' }],
  ['aldi.de',         { sector_fr: 'distribution discount alimentaire', sector_en: 'discount supermarket', locale: 'en', country: 'DE', linkedin_slug: 'aldi-sud' }],
  ['rewe.de',         { sector_fr: 'distribution alimentaire', sector_en: 'supermarket chain', locale: 'en', country: 'DE', linkedin_slug: 'rewe-group' }],
  ['edeka.de',        { sector_fr: 'distribution alimentaire', sector_en: 'supermarket chain', locale: 'en', country: 'DE', linkedin_slug: 'edeka' }],
  ['douglas.de',      { sector_fr: 'distribution beaute', sector_en: 'cosmetics retailer', locale: 'en', country: 'DE', linkedin_slug: 'douglas' }],
  ['thalia.de',       { sector_fr: 'librairie', sector_en: 'bookstore chain', locale: 'en', country: 'DE', linkedin_slug: 'thalia-bucher-gmbh' }],

  // ──────────────────────────────────────────────────────────────────────────
  // UK — entites nationales connues
  // ──────────────────────────────────────────────────────────────────────────
  ['tesco.com',           { sector_fr: 'distribution alimentaire', sector_en: 'supermarket chain', locale: 'en', country: 'GB', linkedin_slug: 'tesco' }],
  ['sainsburys.co.uk',    { sector_fr: 'distribution alimentaire', sector_en: 'supermarket chain', locale: 'en', country: 'GB', linkedin_slug: 'j-sainsbury' }],
  ['asda.com',            { sector_fr: 'distribution alimentaire', sector_en: 'supermarket chain', locale: 'en', country: 'GB', linkedin_slug: 'asda' }],
  ['marksandspencer.com', { sector_fr: 'grands magasins', sector_en: 'department store', locale: 'en', country: 'GB', linkedin_slug: 'marks-and-spencer' }],
  ['johnlewis.com',       { sector_fr: 'grands magasins', sector_en: 'department store', locale: 'en', country: 'GB', linkedin_slug: 'john-lewis-partnership' }],
  ['currys.co.uk',        { sector_fr: 'distribution electronique', sector_en: 'electronics retailer', locale: 'en', country: 'GB', linkedin_slug: 'currys' }],
  ['argos.co.uk',         { sector_fr: 'distribution generaliste', sector_en: 'general retail', locale: 'en', country: 'GB', linkedin_slug: 'argos' }],
  ['next.co.uk',          { sector_fr: 'mode et maison', sector_en: 'fashion and home retailer', locale: 'en', country: 'GB', linkedin_slug: 'next-plc' }],
  ['boohoo.com',          { sector_fr: 'e-commerce mode', sector_en: 'online fashion store', locale: 'en', country: 'GB', linkedin_slug: 'boohoo-com' }],
  ['missguided.com',      { sector_fr: 'e-commerce mode feminine', sector_en: 'womenswear e-commerce', locale: 'en', country: 'GB', linkedin_slug: 'missguided' }],

  // ──────────────────────────────────────────────────────────────────────────
  // E-commerce mode regional EU
  // ──────────────────────────────────────────────────────────────────────────
  ['zalando.fr',  { sector_fr: 'e-commerce mode', sector_en: 'online fashion store', locale: 'fr', country: 'FR', linkedin_slug: 'zalando' }],
  ['zalando.ch',  { sector_fr: 'e-commerce mode', sector_en: 'online fashion store', locale: 'fr', country: 'CH', linkedin_slug: 'zalando' }],

  // NB: Sont VOLONTAIREMENT exclus de cette liste car les IA les citent deja
  // (cible inappropriee pour la doctrine du post) :
  // - Tech globaux : stripe.com, shopify.com, notion.so, figma.com, canva.com,
  //   airtable.com, zapier.com, mailchimp.com, hubspot.com, salesforce.com,
  //   zendesk.com, intercom.com, monday.com, asana.com, trello.com, slack.com,
  //   dropbox.com, evernote.com
  // - Travel globaux : booking.com, expedia.com, airbnb.com, tripadvisor.com,
  //   kayak.com, easyjet.com, ryanair.com, lufthansa.com
  // - AI globaux : huggingface.co, replicate.com, anthropic.com, mistral.ai,
  //   cohere.com, stability.ai, runwayml.com
  // - Mode globale : asos.com, aboutyou.com, zalando.com (.com global), printemps.com
]);

/** Set des domaines connus (utilise par la query SQL pour le filtre WHERE ANY) */
export const KNOWN_DOMAINS: Set<string> = new Set(KNOWN_DOMAINS_META.keys());

export function isKnownDomain(domain: string): boolean {
  if (!domain) return false;
  const normalized = domain
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .split('/')[0];
  return KNOWN_DOMAINS.has(normalized);
}

export function getKnownEntityMeta(domain: string): KnownEntityMeta | null {
  if (!domain) return null;
  const normalized = domain
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .split('/')[0];
  return KNOWN_DOMAINS_META.get(normalized) || null;
}
