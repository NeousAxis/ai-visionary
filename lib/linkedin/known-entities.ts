/**
 * Liste manuelle de domaines d'entreprises "connues" (top Tranco).
 * Sert de filtre pour la selection LinkedIn — on veut poster sur des
 * entreprises que les humains LinkedIn reconnaissent.
 *
 * MVP : ~100 domaines extraits du top Tranco EU avec presence forte
 * sur AYA registry. A enrichir progressivement.
 */

export const KNOWN_DOMAINS: Set<string> = new Set([
  // Tech / SaaS notoires
  'stripe.com',
  'shopify.com',
  'notion.so',
  'figma.com',
  'canva.com',
  'airtable.com',
  'zapier.com',
  'mailchimp.com',
  'hubspot.com',
  'salesforce.com',
  'zendesk.com',
  'intercom.com',
  'monday.com',
  'asana.com',
  'trello.com',
  'slack.com',
  'dropbox.com',
  'evernote.com',

  // E-commerce / Retail
  'zalando.com',
  'zalando.fr',
  'zalando.ch',
  'aboutyou.com',
  'fnac.com',
  'darty.com',
  'cdiscount.com',
  'rueducommerce.fr',
  'laredoute.fr',
  'galerieslafayette.com',
  'printemps.com',

  // Suisse — entreprises notoires
  'migros.ch',
  'coop.ch',
  'manor.ch',
  'galaxus.ch',
  'digitec.ch',
  'swisscom.ch',
  'salt.ch',
  'sunrise.ch',
  'postfinance.ch',
  'raiffeisen.ch',
  'zkb.ch',
  'baloise.ch',
  'helvetia.com',
  'mobiliar.ch',
  'visilab.ch',
  'kuoni.ch',
  'globus.ch',

  // France — notoires
  'orange.fr',
  'sfr.fr',
  'bouyguestelecom.fr',
  'free.fr',
  'leclerc.com',
  'auchan.fr',
  'carrefour.fr',
  'intermarche.com',
  'monoprix.fr',
  'casino.fr',
  'sephora.fr',
  'decathlon.fr',
  'leroymerlin.fr',
  'bricomarche.com',
  'aubert.com',
  'kiabi.com',
  'jules.com',
  'undiz.com',

  // Allemagne — notoires
  'otto.de',
  'mediamarkt.de',
  'saturn.de',
  'lidl.de',
  'aldi.de',
  'rewe.de',
  'edeka.de',
  'douglas.de',
  'thalia.de',

  // UK — notoires
  'tesco.com',
  'sainsburys.co.uk',
  'asda.com',
  'marksandspencer.com',
  'johnlewis.com',
  'currys.co.uk',
  'argos.co.uk',
  'next.co.uk',
  'asos.com',
  'boohoo.com',
  'missguided.com',

  // Tourisme / Transport
  'booking.com',
  'expedia.com',
  'airbnb.com',
  'tripadvisor.com',
  'kayak.com',
  'sncf-connect.com',
  'easyjet.com',
  'ryanair.com',
  'lufthansa.com',
  'airfrance.fr',

  // Media / Presse FR
  'lemonde.fr',
  'lefigaro.fr',
  'liberation.fr',
  'lesechos.fr',
  'lexpress.fr',
  'lepoint.fr',
  '20minutes.fr',
  'francetvinfo.fr',
  'rfi.fr',

  // Web3 / AI
  'huggingface.co',
  'replicate.com',
  'anthropic.com',
  'mistral.ai',
  'cohere.com',
  'stability.ai',
  'runwayml.com',
]);

export function isKnownDomain(domain: string): boolean {
  if (!domain) return false;
  // Normalize : strip protocol/www/path
  const normalized = domain
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .split('/')[0];
  return KNOWN_DOMAINS.has(normalized);
}
