// lib/update-form-config.ts
// Configuration for the 7-block AIO update form (client-facing)
// Labels, hints, and option labels are i18n KEYS resolved at render time
// via useTranslations('form') in UpdateFormClient.

export type FieldType =
  | "text"
  | "textarea"
  | "array"
  | "boolean"
  | "select"
  | "date"
  | "readonly"
  | "url_locked";

export interface FieldDefinition {
  /** Machine name matching AyoExtract fields key */
  name: string;
  /** i18n key for the label — resolved via t(`fields.${block.key}.${field.name}`) */
  labelKey: string;
  /** Input type for the form */
  type: FieldType;
  /** Placeholder text (not translated — examples stay in the user's context) */
  placeholder?: string;
  /** Whether the field is required */
  required?: boolean;
  /** For select fields: available options (value + i18n label key) */
  options?: { value: string; labelKey: string }[];
  /** i18n key for hint text — resolved via t(`hints.${block.key}.${field.name}`) */
  hintKey?: string;
  /** Max length for text/textarea */
  maxLength?: number;
  /** Max items for array fields */
  maxItems?: number;

  // ----- Legacy compat (kept for server-side code that may still read them) -----
  /** @deprecated Use labelKey + useTranslations instead */
  label?: string;
  /** @deprecated Use hintKey + useTranslations instead */
  hint?: string;
}

export interface BlockDefinition {
  /** Machine key matching AyoExtract blocks */
  key: string;
  /** i18n key for the title — resolved via t(`blocks.${block.key}`) */
  titleKey: string;
  /** Icon emoji */
  icon: string;
  /** AIO weight out of 100 */
  weight: number;
  /** Fields in this block */
  fields: FieldDefinition[];

  // ----- Legacy compat -----
  /** @deprecated Use titleKey + useTranslations instead */
  title?: string;
}

// ---------------------------------------------------------------------------
// Sector options (i18n keys — resolved via t(`sectors.${value}`))
// ---------------------------------------------------------------------------

export const SECTOR_OPTIONS: { value: string; labelKey: string; label?: string }[] = [
  { value: "agriculture", labelKey: "sectors.agriculture" },
  { value: "extraction", labelKey: "sectors.extraction" },
  { value: "industrie_transformation", labelKey: "sectors.industrie_transformation" },
  { value: "fabrication", labelKey: "sectors.fabrication" },
  { value: "artisanat", labelKey: "sectors.artisanat" },
  { value: "construction", labelKey: "sectors.construction" },
  { value: "commerce", labelKey: "sectors.commerce" },
  { value: "transport", labelKey: "sectors.transport" },
  { value: "energie", labelKey: "sectors.energie" },
  { value: "batiment", labelKey: "sectors.batiment" },
  { value: "services_entreprises", labelKey: "sectors.services_entreprises" },
  { value: "finance", labelKey: "sectors.finance" },
  { value: "sante", labelKey: "sectors.sante" },
  { value: "education", labelKey: "sectors.education" },
  { value: "recherche", labelKey: "sectors.recherche" },
  { value: "culture_medias", labelKey: "sectors.culture_medias" },
  { value: "tourisme", labelKey: "sectors.tourisme" },
  { value: "services_particuliers", labelKey: "sectors.services_particuliers" },
  { value: "securite", labelKey: "sectors.securite" },
  { value: "numerique", labelKey: "sectors.numerique" },
  { value: "administration", labelKey: "sectors.administration" },
  { value: "organisations", labelKey: "sectors.organisations" },
  { value: "plateformes", labelKey: "sectors.plateformes" },
  { value: "economie_circulaire", labelKey: "sectors.economie_circulaire" },
  { value: "economie_creative", labelKey: "sectors.economie_creative" },
];

// ---------------------------------------------------------------------------
// Country options (i18n keys — resolved via t(`countries.${value}`))
// ---------------------------------------------------------------------------

export const COUNTRY_OPTIONS: { value: string; labelKey: string; label?: string }[] = [
  { value: "CH", labelKey: "countries.CH" },
  { value: "FR", labelKey: "countries.FR" },
  { value: "DE", labelKey: "countries.DE" },
  { value: "AT", labelKey: "countries.AT" },
  { value: "BE", labelKey: "countries.BE" },
  { value: "LU", labelKey: "countries.LU" },
  { value: "IT", labelKey: "countries.IT" },
  { value: "ES", labelKey: "countries.ES" },
  { value: "PT", labelKey: "countries.PT" },
  { value: "NL", labelKey: "countries.NL" },
  { value: "GB", labelKey: "countries.GB" },
  { value: "IE", labelKey: "countries.IE" },
  { value: "US", labelKey: "countries.US" },
  { value: "CA", labelKey: "countries.CA" },
  { value: "AU", labelKey: "countries.AU" },
  { value: "NZ", labelKey: "countries.NZ" },
  { value: "JP", labelKey: "countries.JP" },
  { value: "KR", labelKey: "countries.KR" },
  { value: "CN", labelKey: "countries.CN" },
  { value: "IN", labelKey: "countries.IN" },
  { value: "SG", labelKey: "countries.SG" },
  { value: "HK", labelKey: "countries.HK" },
  { value: "AE", labelKey: "countries.AE" },
  { value: "SA", labelKey: "countries.SA" },
  { value: "IL", labelKey: "countries.IL" },
  { value: "BR", labelKey: "countries.BR" },
  { value: "MX", labelKey: "countries.MX" },
  { value: "AR", labelKey: "countries.AR" },
  { value: "CL", labelKey: "countries.CL" },
  { value: "CO", labelKey: "countries.CO" },
  { value: "ZA", labelKey: "countries.ZA" },
  { value: "NG", labelKey: "countries.NG" },
  { value: "KE", labelKey: "countries.KE" },
  { value: "MA", labelKey: "countries.MA" },
  { value: "TN", labelKey: "countries.TN" },
  { value: "EG", labelKey: "countries.EG" },
  { value: "SE", labelKey: "countries.SE" },
  { value: "NO", labelKey: "countries.NO" },
  { value: "DK", labelKey: "countries.DK" },
  { value: "FI", labelKey: "countries.FI" },
  { value: "PL", labelKey: "countries.PL" },
  { value: "CZ", labelKey: "countries.CZ" },
  { value: "RO", labelKey: "countries.RO" },
  { value: "GR", labelKey: "countries.GR" },
  { value: "TR", labelKey: "countries.TR" },
  { value: "RU", labelKey: "countries.RU" },
  { value: "UA", labelKey: "countries.UA" },
  { value: "TH", labelKey: "countries.TH" },
  { value: "VN", labelKey: "countries.VN" },
  { value: "ID", labelKey: "countries.ID" },
  { value: "MY", labelKey: "countries.MY" },
  { value: "PH", labelKey: "countries.PH" },
  { value: "TW", labelKey: "countries.TW" },
  { value: "XX", labelKey: "countries.XX" },
];

// ---------------------------------------------------------------------------
// 7 Block definitions
// ---------------------------------------------------------------------------

export const BLOCK_DEFINITIONS: BlockDefinition[] = [
  // BLOC 1 — Identite & Ancrage (/10)
  {
    key: "identite",
    titleKey: "blocks.identite",
    icon: "\uD83C\uDFE2",
    weight: 10,
    fields: [
      {
        name: "name",
        labelKey: "fields.identite.name",
        type: "text",
        placeholder: "Ex : AI Visionary",
        required: true,
        maxLength: 200,
      },
      {
        name: "legal_name",
        labelKey: "fields.identite.legal_name",
        type: "text",
        placeholder: "Ex : AI Visionary SA",
        maxLength: 200,
      },
      {
        name: "business_type",
        labelKey: "fields.identite.business_type",
        type: "select",
        options: SECTOR_OPTIONS,
        required: true,
      },
      {
        name: "city",
        labelKey: "fields.identite.city",
        type: "text",
        placeholder: "Ex : Genève",
        maxLength: 100,
      },
      {
        name: "country",
        labelKey: "fields.identite.country",
        type: "select",
        options: COUNTRY_OPTIONS,
        required: true,
      },
      {
        name: "contact_email",
        labelKey: "fields.identite.contact_email",
        type: "text",
        placeholder: "Ex : contact@example.com",
        maxLength: 254,
        hintKey: "hints.identite.contact_email",
      },
      {
        name: "contact_phone",
        labelKey: "fields.identite.contact_phone",
        type: "text",
        placeholder: "Ex : +41 22 123 45 67",
        maxLength: 30,
      },
    ],
  },

  // BLOC 2 — Clarte de l'Offre (/20)
  {
    key: "offre",
    titleKey: "blocks.offre",
    icon: "\uD83C\uDFAF",
    weight: 20,
    fields: [
      {
        name: "services",
        labelKey: "fields.offre.services",
        type: "array",
        placeholder: "Ex : Diagnostic IA, Audit SEO, Formation",
        hintKey: "hints.offre.services",
        maxItems: 20,
      },
      {
        name: "products",
        labelKey: "fields.offre.products",
        type: "array",
        placeholder: "Ex : Pack PRO, Abonnement AYA",
        hintKey: "hints.offre.products",
        maxItems: 20,
      },
      {
        name: "use_cases",
        labelKey: "fields.offre.use_cases",
        type: "array",
        placeholder: "Ex : Améliorer sa visibilité IA",
        hintKey: "hints.offre.use_cases",
        maxItems: 20,
      },
      {
        name: "target_audience",
        labelKey: "fields.offre.target_audience",
        type: "textarea",
        placeholder: "Décrivez votre clientèle principale...",
        maxLength: 500,
      },
      {
        name: "pricing_indication",
        labelKey: "fields.offre.pricing_indication",
        type: "text",
        placeholder: "Ex : À partir de 19 CHF/mois",
        maxLength: 200,
        hintKey: "hints.offre.pricing_indication",
      },
    ],
  },

  // BLOC 3 — Processus & Methodes (/15)
  {
    key: "processus_methodes",
    titleKey: "blocks.processus_methodes",
    icon: "\u2699\uFE0F",
    weight: 15,
    fields: [
      {
        name: "process_steps",
        labelKey: "fields.processus_methodes.process_steps",
        type: "array",
        placeholder: "Ex : Diagnostic, Analyse, Livraison, Suivi",
        hintKey: "hints.processus_methodes.process_steps",
        maxItems: 15,
      },
      {
        name: "delivery_mode",
        labelKey: "fields.processus_methodes.delivery_mode",
        type: "text",
        placeholder: "Ex : En ligne, sur site, hybride",
        maxLength: 200,
      },
      {
        name: "geographies_served",
        labelKey: "fields.processus_methodes.geographies_served",
        type: "text",
        placeholder: "Ex : Suisse romande, Europe, Monde entier",
        maxLength: 300,
      },
      {
        name: "quality_assurance",
        labelKey: "fields.processus_methodes.quality_assurance",
        type: "textarea",
        placeholder: "Décrivez vos mesures de qualité...",
        maxLength: 500,
        hintKey: "hints.processus_methodes.quality_assurance",
      },
    ],
  },

  // BLOC 4 — Engagements & Conformite (/15)
  {
    key: "engagements_conformite",
    titleKey: "blocks.engagements_conformite",
    icon: "\uD83D\uDEE1\uFE0F",
    weight: 15,
    fields: [
      {
        name: "certifications",
        labelKey: "fields.engagements_conformite.certifications",
        type: "array",
        placeholder: "Ex : ISO 27001, B Corp, GDPR compliant",
        maxItems: 15,
      },
      {
        name: "frameworks",
        labelKey: "fields.engagements_conformite.frameworks",
        type: "array",
        placeholder: "Ex : NIST, SOC 2, EU AI Act",
        maxItems: 15,
      },
      {
        name: "policies",
        labelKey: "fields.engagements_conformite.policies",
        type: "array",
        placeholder: "Ex : Politique de confidentialité, CGV",
        maxItems: 15,
      },
      {
        name: "security_measures",
        labelKey: "fields.engagements_conformite.security_measures",
        type: "array",
        placeholder: "Ex : Chiffrement E2E, 2FA, Audit annuel",
        maxItems: 15,
      },
    ],
  },

  // BLOC 5 — Indicateurs (/20)
  {
    key: "indicateurs",
    titleKey: "blocks.indicateurs",
    icon: "\uD83D\uDCCA",
    weight: 20,
    fields: [
      {
        name: "key_indicators",
        labelKey: "fields.indicateurs.key_indicators",
        type: "array",
        placeholder: "Ex : 500 clients actifs, 99.9% uptime, 3 ans d'activité",
        hintKey: "hints.indicateurs.key_indicators",
        maxItems: 20,
      },
      {
        name: "last_review_date",
        labelKey: "fields.indicateurs.last_review_date",
        type: "date",
        hintKey: "hints.indicateurs.last_review_date",
      },
    ],
  },

  // BLOC 6 — Contenus pedagogiques (/10)
  {
    key: "contenus_pedagogiques",
    titleKey: "blocks.contenus_pedagogiques",
    icon: "\uD83D\uDCDA",
    weight: 10,
    fields: [
      {
        name: "has_faq",
        labelKey: "fields.contenus_pedagogiques.has_faq",
        type: "boolean",
        hintKey: "hints.contenus_pedagogiques.has_faq",
      },
      {
        name: "faq_url",
        labelKey: "fields.contenus_pedagogiques.faq_url",
        type: "url_locked",
        placeholder: "https://example.com/faq",
        hintKey: "hints.contenus_pedagogiques.faq_url",
      },
      {
        name: "has_glossary",
        labelKey: "fields.contenus_pedagogiques.has_glossary",
        type: "boolean",
        hintKey: "hints.contenus_pedagogiques.has_glossary",
      },
      {
        name: "glossary_url",
        labelKey: "fields.contenus_pedagogiques.glossary_url",
        type: "url_locked",
        placeholder: "https://example.com/glossaire",
        hintKey: "hints.contenus_pedagogiques.glossary_url",
      },
      {
        name: "has_documentation",
        labelKey: "fields.contenus_pedagogiques.has_documentation",
        type: "boolean",
        hintKey: "hints.contenus_pedagogiques.has_documentation",
      },
      {
        name: "documentation_url",
        labelKey: "fields.contenus_pedagogiques.documentation_url",
        type: "url_locked",
        placeholder: "https://example.com/docs",
        hintKey: "hints.contenus_pedagogiques.documentation_url",
      },
    ],
  },

  // BLOC 7 — Structure technique (/10)
  {
    key: "structure_technique",
    titleKey: "blocks.structure_technique",
    icon: "\uD83D\uDD27",
    weight: 10,
    fields: [
      {
        name: "has_jsonld",
        labelKey: "fields.structure_technique.has_jsonld",
        type: "readonly",
        hintKey: "hints.structure_technique.has_jsonld",
      },
      {
        name: "has_asr",
        labelKey: "fields.structure_technique.has_asr",
        type: "readonly",
        hintKey: "hints.structure_technique.has_asr",
      },
      {
        name: "has_sitemap",
        labelKey: "fields.structure_technique.has_sitemap",
        type: "readonly",
        hintKey: "hints.structure_technique.has_sitemap",
      },
      {
        name: "mobile_optimized",
        labelKey: "fields.structure_technique.mobile_optimized",
        type: "readonly",
        hintKey: "hints.structure_technique.mobile_optimized",
      },
    ],
  },
];
