// lib/update-form-config.ts
// Configuration for the 7-block AIO update form (client-facing)

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
  /** Human-readable label (FR) */
  label: string;
  /** Input type for the form */
  type: FieldType;
  /** Placeholder text */
  placeholder?: string;
  /** Whether the field is required */
  required?: boolean;
  /** For select fields: available options */
  options?: { value: string; label: string }[];
  /** Hint text below the field */
  hint?: string;
  /** Max length for text/textarea */
  maxLength?: number;
  /** Max items for array fields */
  maxItems?: number;
}

export interface BlockDefinition {
  /** Machine key matching AyoExtract blocks */
  key: string;
  /** Human-readable title (FR) */
  title: string;
  /** Icon emoji */
  icon: string;
  /** AIO weight out of 100 */
  weight: number;
  /** Fields in this block */
  fields: FieldDefinition[];
}

// ---------------------------------------------------------------------------
// Sector options (simplified from ayo-categories.ts for form select)
// ---------------------------------------------------------------------------

export const SECTOR_OPTIONS: { value: string; label: string }[] = [
  { value: "agriculture", label: "Agriculture & production primaire" },
  { value: "extraction", label: "Extraction & ressources naturelles" },
  { value: "industrie_transformation", label: "Industrie de transformation" },
  { value: "fabrication", label: "Fabrication industrielle" },
  { value: "artisanat", label: "Artisanat & production manuelle" },
  { value: "construction", label: "Construction & biens immobiliers" },
  { value: "commerce", label: "Commerce & distribution" },
  { value: "transport", label: "Transport & logistique" },
  { value: "energie", label: "Énergie & réseaux" },
  { value: "batiment", label: "Bâtiment & travaux" },
  { value: "services_entreprises", label: "Services aux entreprises" },
  { value: "finance", label: "Services financiers" },
  { value: "sante", label: "Santé & social" },
  { value: "education", label: "Éducation & transmission" },
  { value: "recherche", label: "Recherche & innovation" },
  { value: "culture_medias", label: "Culture, arts & médias" },
  { value: "tourisme", label: "Tourisme & loisirs" },
  { value: "services_particuliers", label: "Services aux particuliers" },
  { value: "securite", label: "Sécurité & protection" },
  { value: "numerique", label: "Numérique & information" },
  { value: "administration", label: "Administration & services publics" },
  { value: "organisations", label: "Organisations collectives" },
  { value: "plateformes", label: "Plateformes économiques" },
  { value: "economie_circulaire", label: "Économie circulaire" },
  { value: "economie_creative", label: "Économie créative & émergente" },
];

// ---------------------------------------------------------------------------
// Country options (ISO 3166-1 alpha-2, common countries first)
// ---------------------------------------------------------------------------

export const COUNTRY_OPTIONS: { value: string; label: string }[] = [
  { value: "CH", label: "Suisse" },
  { value: "FR", label: "France" },
  { value: "DE", label: "Allemagne" },
  { value: "AT", label: "Autriche" },
  { value: "BE", label: "Belgique" },
  { value: "LU", label: "Luxembourg" },
  { value: "IT", label: "Italie" },
  { value: "ES", label: "Espagne" },
  { value: "PT", label: "Portugal" },
  { value: "NL", label: "Pays-Bas" },
  { value: "GB", label: "Royaume-Uni" },
  { value: "IE", label: "Irlande" },
  { value: "US", label: "États-Unis" },
  { value: "CA", label: "Canada" },
  { value: "AU", label: "Australie" },
  { value: "NZ", label: "Nouvelle-Zélande" },
  { value: "JP", label: "Japon" },
  { value: "KR", label: "Corée du Sud" },
  { value: "CN", label: "Chine" },
  { value: "IN", label: "Inde" },
  { value: "SG", label: "Singapour" },
  { value: "HK", label: "Hong Kong" },
  { value: "AE", label: "Émirats arabes unis" },
  { value: "SA", label: "Arabie saoudite" },
  { value: "IL", label: "Israël" },
  { value: "BR", label: "Brésil" },
  { value: "MX", label: "Mexique" },
  { value: "AR", label: "Argentine" },
  { value: "CL", label: "Chili" },
  { value: "CO", label: "Colombie" },
  { value: "ZA", label: "Afrique du Sud" },
  { value: "NG", label: "Nigéria" },
  { value: "KE", label: "Kenya" },
  { value: "MA", label: "Maroc" },
  { value: "TN", label: "Tunisie" },
  { value: "EG", label: "Égypte" },
  { value: "SE", label: "Suède" },
  { value: "NO", label: "Norvège" },
  { value: "DK", label: "Danemark" },
  { value: "FI", label: "Finlande" },
  { value: "PL", label: "Pologne" },
  { value: "CZ", label: "Tchéquie" },
  { value: "RO", label: "Roumanie" },
  { value: "GR", label: "Grèce" },
  { value: "TR", label: "Turquie" },
  { value: "RU", label: "Russie" },
  { value: "UA", label: "Ukraine" },
  { value: "TH", label: "Thaïlande" },
  { value: "VN", label: "Vietnam" },
  { value: "ID", label: "Indonésie" },
  { value: "MY", label: "Malaisie" },
  { value: "PH", label: "Philippines" },
  { value: "TW", label: "Taïwan" },
  { value: "XX", label: "Autre / Non spécifié" },
];

// ---------------------------------------------------------------------------
// 7 Block definitions
// ---------------------------------------------------------------------------

export const BLOCK_DEFINITIONS: BlockDefinition[] = [
  // BLOC 1 — Identite & Ancrage (/10)
  {
    key: "identite",
    title: "Identité & Ancrage",
    icon: "🏢",
    weight: 10,
    fields: [
      {
        name: "name",
        label: "Nom commercial",
        type: "text",
        placeholder: "Ex : AI Visionary",
        required: true,
        maxLength: 200,
      },
      {
        name: "legal_name",
        label: "Raison sociale (nom légal)",
        type: "text",
        placeholder: "Ex : AI Visionary SA",
        maxLength: 200,
      },
      {
        name: "business_type",
        label: "Type d'activité",
        type: "select",
        options: SECTOR_OPTIONS,
        required: true,
      },
      {
        name: "city",
        label: "Ville",
        type: "text",
        placeholder: "Ex : Genève",
        maxLength: 100,
      },
      {
        name: "country",
        label: "Pays",
        type: "select",
        options: COUNTRY_OPTIONS,
        required: true,
      },
      {
        name: "contact_email",
        label: "Email de contact",
        type: "text",
        placeholder: "Ex : contact@example.com",
        maxLength: 254,
        hint: "Visible uniquement dans vos fichiers ASR, pas sur le registre public.",
      },
      {
        name: "contact_phone",
        label: "Téléphone de contact",
        type: "text",
        placeholder: "Ex : +41 22 123 45 67",
        maxLength: 30,
      },
    ],
  },

  // BLOC 2 — Clarte de l'Offre (/20)
  {
    key: "offre",
    title: "Clarté de l'Offre",
    icon: "🎯",
    weight: 20,
    fields: [
      {
        name: "services",
        label: "Services proposés",
        type: "array",
        placeholder: "Ex : Diagnostic IA, Audit SEO, Formation",
        hint: "Séparez par des virgules ou ajoutez un par un.",
        maxItems: 20,
      },
      {
        name: "products",
        label: "Produits",
        type: "array",
        placeholder: "Ex : Pack PRO, Abonnement AYA",
        hint: "Séparez par des virgules ou ajoutez un par un.",
        maxItems: 20,
      },
      {
        name: "use_cases",
        label: "Cas d'usage",
        type: "array",
        placeholder: "Ex : Améliorer sa visibilité IA",
        hint: "Comment vos clients utilisent vos services ?",
        maxItems: 20,
      },
      {
        name: "target_audience",
        label: "Audience cible",
        type: "textarea",
        placeholder: "Décrivez votre clientèle principale...",
        maxLength: 500,
      },
      {
        name: "pricing_indication",
        label: "Indication tarifaire",
        type: "text",
        placeholder: "Ex : À partir de 19 CHF/mois",
        maxLength: 200,
        hint: "Fourchette ou modèle de prix (pas de montants exacts obligatoires).",
      },
    ],
  },

  // BLOC 3 — Processus & Methodes (/15)
  {
    key: "processus_methodes",
    title: "Processus & Méthodes",
    icon: "⚙️",
    weight: 15,
    fields: [
      {
        name: "process_steps",
        label: "Étapes de votre processus",
        type: "array",
        placeholder: "Ex : Diagnostic, Analyse, Livraison, Suivi",
        hint: "Les grandes étapes de votre prestation.",
        maxItems: 15,
      },
      {
        name: "delivery_mode",
        label: "Mode de livraison",
        type: "text",
        placeholder: "Ex : En ligne, sur site, hybride",
        maxLength: 200,
      },
      {
        name: "geographies_served",
        label: "Zones géographiques desservies",
        type: "text",
        placeholder: "Ex : Suisse romande, Europe, Monde entier",
        maxLength: 300,
      },
      {
        name: "quality_assurance",
        label: "Assurance qualité",
        type: "textarea",
        placeholder: "Décrivez vos mesures de qualité...",
        maxLength: 500,
        hint: "Certifications, processus de contrôle, engagements qualité.",
      },
    ],
  },

  // BLOC 4 — Engagements & Conformite (/15)
  {
    key: "engagements_conformite",
    title: "Engagements & Conformité",
    icon: "🛡️",
    weight: 15,
    fields: [
      {
        name: "certifications",
        label: "Certifications",
        type: "array",
        placeholder: "Ex : ISO 27001, B Corp, GDPR compliant",
        maxItems: 15,
      },
      {
        name: "frameworks",
        label: "Cadres de référence",
        type: "array",
        placeholder: "Ex : NIST, SOC 2, EU AI Act",
        maxItems: 15,
      },
      {
        name: "policies",
        label: "Politiques",
        type: "array",
        placeholder: "Ex : Politique de confidentialité, CGV",
        maxItems: 15,
      },
      {
        name: "security_measures",
        label: "Mesures de sécurité",
        type: "array",
        placeholder: "Ex : Chiffrement E2E, 2FA, Audit annuel",
        maxItems: 15,
      },
    ],
  },

  // BLOC 5 — Indicateurs (/20)
  {
    key: "indicateurs",
    title: "Indicateurs",
    icon: "📊",
    weight: 20,
    fields: [
      {
        name: "key_indicators",
        label: "Indicateurs clés",
        type: "array",
        placeholder: "Ex : 500 clients actifs, 99.9% uptime, 3 ans d'activité",
        hint: "Chiffres concrets prouvant votre activité. Plus ils sont précis, meilleur sera votre score.",
        maxItems: 20,
      },
      {
        name: "last_review_date",
        label: "Date de dernière mise à jour",
        type: "date",
        hint: "Quand avez-vous mis à jour vos données pour la dernière fois ?",
      },
    ],
  },

  // BLOC 6 — Contenus pedagogiques (/10)
  {
    key: "contenus_pedagogiques",
    title: "Contenus Pédagogiques",
    icon: "📚",
    weight: 10,
    fields: [
      {
        name: "has_faq",
        label: "Avez-vous une FAQ sur votre site ?",
        type: "boolean",
        hint: "Page FAQ publiquement accessible.",
      },
      {
        name: "faq_url",
        label: "Lien vers votre FAQ",
        type: "url_locked",
        placeholder: "https://example.com/faq",
        hint: "Cliquez sur le crayon pour modifier le lien.",
      },
      {
        name: "has_glossary",
        label: "Avez-vous un glossaire sur votre site ?",
        type: "boolean",
        hint: "Glossaire de termes métier accessible.",
      },
      {
        name: "glossary_url",
        label: "Lien vers votre glossaire",
        type: "url_locked",
        placeholder: "https://example.com/glossaire",
        hint: "Cliquez sur le crayon pour modifier le lien.",
      },
      {
        name: "has_documentation",
        label: "Avez-vous de la documentation en ligne ?",
        type: "boolean",
        hint: "Guides, tutoriels, documentation technique.",
      },
      {
        name: "documentation_url",
        label: "Lien vers votre documentation",
        type: "url_locked",
        placeholder: "https://example.com/docs",
        hint: "Cliquez sur le crayon pour modifier le lien.",
      },
    ],
  },

  // BLOC 7 — Structure technique (/10)
  {
    key: "structure_technique",
    title: "Structure Technique",
    icon: "🔧",
    weight: 10,
    fields: [
      {
        name: "has_jsonld",
        label: "JSON-LD détecté",
        type: "readonly",
        hint: "Détecté automatiquement lors du scan de votre site.",
      },
      {
        name: "has_asr",
        label: "Fichier ASR détecté",
        type: "readonly",
        hint: "Détecté automatiquement (fichier .ayo/asr.json).",
      },
      {
        name: "has_sitemap",
        label: "Sitemap détecté",
        type: "readonly",
        hint: "Détecté automatiquement (sitemap.xml).",
      },
      {
        name: "mobile_optimized",
        label: "Site mobile-friendly",
        type: "readonly",
        hint: "Détecté automatiquement lors du scan.",
      },
    ],
  },
];
