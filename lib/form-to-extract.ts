// lib/form-to-extract.ts
// Converts form data (from the 7-block update form) to/from AyoExtract format.

import type { AyoExtract } from "./aio-score-engine";
import { BLOCK_DEFINITIONS } from "./update-form-config";

type Quality = 0 | 0.5 | 1;

interface FieldNode<T> {
  value: T;
  q: Quality;
  evidence: string[];
}

// Form values: flat key→value per block
export type FormBlockValues = Record<string, Record<string, unknown>>;

// ---------------------------------------------------------------------------
// formDataToAyoExtract
// Merges form block data into an existing AyoExtract payload.
// - New non-empty values get q=1 (client-declared)
// - Empty values are skipped (preserve existing)
// - source.scan is preserved from existing payload
// ---------------------------------------------------------------------------

export function formDataToAyoExtract(
  formBlocks: FormBlockValues,
  existingPayload?: Partial<AyoExtract>
): AyoExtract {
  // Start from existing or empty extract
  const extract: AyoExtract = existingPayload
    ? JSON.parse(JSON.stringify(existingPayload))
    : createEmptyExtract();

  // Ensure fields object exists
  if (!extract.fields) {
    const empty = createEmptyExtract();
    extract.fields = empty.fields;
  }

  for (const blockDef of BLOCK_DEFINITIONS) {
    const blockKey = blockDef.key as keyof AyoExtract["fields"];
    const formValues = formBlocks[blockDef.key];
    if (!formValues) continue;

    // Skip structure_technique — readonly, only from scanner
    if (blockKey === "structure_technique") continue;

    // Skip blocks not in AyoExtract fields
    const targetBlock = extract.fields[blockKey];
    if (!targetBlock) continue;

    for (const fieldDef of blockDef.fields) {
      if (fieldDef.type === "readonly") continue;

      const rawValue = formValues[fieldDef.name];
      if (rawValue === undefined || rawValue === null) continue;

      const fieldKey = fieldDef.name as keyof typeof targetBlock;

      // N/A declaration: field explicitly declared not applicable — exclude from scoring
      if (rawValue === '__NA__') {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (targetBlock as any)[fieldKey] = { value: null, q: 0, na: true, evidence: ['client_na_declaration'] };
        continue;
      }

      // Bug 7 fix: check emptiness with field type awareness
      if (isEmptyValue(rawValue, fieldDef.type)) continue;
      const existingField = targetBlock[fieldKey] as
        | FieldNode<unknown>
        | undefined;

      // Bug 5 fix: determine q value based on content quality
      const coerced = coerceValue(rawValue, fieldDef.type);
      const q = determineFormQuality(coerced, fieldDef.type);

      // Build the field node
      const node: FieldNode<unknown> = {
        value: coerced,
        q,
        evidence: existingField?.evidence ?? [],
      };

      // Tag evidence as client-updated
      if (!node.evidence.includes("client_form_update")) {
        node.evidence = [...node.evidence, "client_form_update"];
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (targetBlock as any)[fieldKey] = node;
    }
  }

  return extract;
}

// ---------------------------------------------------------------------------
// extractFormValues
// Extracts flat form-friendly values from an asr_payload.data object
// (which uses {value, q} nodes). Used for pre-filling the update form.
// ---------------------------------------------------------------------------

export function extractFormValues(
  asrPayloadData: Record<string, unknown> | undefined,
  entityOverrides?: {
    sector_macro?: string;
    country_legal?: string;
    display_name?: string;
    legal_name?: string;
    contact_email?: string;
  }
): FormBlockValues {
  const result: FormBlockValues = {};

  if (!asrPayloadData) return result;

  for (const blockDef of BLOCK_DEFINITIONS) {
    const blockData = asrPayloadData[blockDef.key] as
      | Record<string, unknown>
      | undefined;
    if (!blockData) {
      result[blockDef.key] = {};
      continue;
    }

    const blockValues: Record<string, unknown> = {};

    for (const fieldDef of blockDef.fields) {
      const fieldData = blockData[fieldDef.name] as
        | { value?: unknown; q?: number }
        | unknown;

      if (fieldData === undefined || fieldData === null) {
        blockValues[fieldDef.name] = getDefaultValue(fieldDef.type);
        continue;
      }

      // Handle FieldNode format {value, q, evidence}
      if (isFieldNode(fieldData)) {
        const val = (fieldData as { value: unknown }).value;
        blockValues[fieldDef.name] = normalizeForForm(val, fieldDef.type);
      } else {
        // Raw value (legacy data without {value, q} wrapper)
        blockValues[fieldDef.name] = normalizeForForm(
          fieldData,
          fieldDef.type
        );
      }
    }

    result[blockDef.key] = blockValues;
  }

  // Apply entity-level overrides (top-level Supabase columns take priority
  // over potentially stale asr_payload nested data)
  if (entityOverrides) {
    if (!result.identite) result.identite = {};
    const id = result.identite as Record<string, unknown>;
    if (entityOverrides.display_name && !id.name) id.name = entityOverrides.display_name;
    if (entityOverrides.legal_name && !id.legal_name) id.legal_name = entityOverrides.legal_name;
    if (entityOverrides.contact_email && !id.contact_email) id.contact_email = entityOverrides.contact_email;
    if (entityOverrides.country_legal && !id.country) id.country = entityOverrides.country_legal;
    if (entityOverrides.sector_macro) {
      if (!result.identite) result.identite = {};
      const idBlock = result.identite as Record<string, unknown>;
      if (!idBlock.business_type) idBlock.business_type = entityOverrides.sector_macro;
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isFieldNode(val: unknown): boolean {
  if (typeof val !== "object" || val === null) return false;
  return "value" in (val as Record<string, unknown>);
}

/**
 * Bug 7 fix: field-type-aware emptiness check.
 * For boolean fields, false is a valid value (not empty).
 */
function isEmptyValue(val: unknown, fieldType?: string): boolean {
  if (val === null || val === undefined) return true;
  // Boolean fields: false is a valid filled value, not empty
  if (fieldType === "boolean") return typeof val !== "boolean";
  if (val === "" || val === false) return true;
  if (Array.isArray(val) && val.length === 0) return true;
  if (
    Array.isArray(val) &&
    val.every((v) => typeof v === "string" && v.trim() === "")
  )
    return true;
  return false;
}

/**
 * Bug 5 fix: determine quality value based on content type and richness.
 * - Boolean fields: q=0.5 (self-declared, not verified)
 * - Text fields < 10 chars: q=0.5
 * - Text fields >= 10 chars: q=1
 * - Array fields with >= 2 items: q=1, else q=0.5
 * - Date fields: q=1
 */
function determineFormQuality(
  value: string | string[] | boolean,
  fieldType: string
): Quality {
  if (typeof value === "boolean") return 0.5;
  if (fieldType === "date") return 1;
  // Select fields (country, sector) are structured choices — always q=1
  if (fieldType === "select") return 1;
  if (Array.isArray(value)) return value.length >= 2 ? 1 : 0.5;
  if (typeof value === "string") return value.trim().length >= 10 ? 1 : 0.5;
  return 0.5;
}

function coerceValue(
  raw: unknown,
  fieldType: string
): string | string[] | boolean {
  switch (fieldType) {
    case "array": {
      if (Array.isArray(raw)) {
        return (raw as unknown[])
          .map((v) => String(v).trim())
          .filter((v) => v.length > 0);
      }
      if (typeof raw === "string") {
        return raw
          .split(",")
          .map((s) => s.trim())
          .filter((s) => s.length > 0);
      }
      return [];
    }
    case "boolean":
      return Boolean(raw);
    case "text":
    case "textarea":
    case "select":
    case "date":
    case "url_locked":
    default:
      return String(raw).trim();
  }
}

function getDefaultValue(
  fieldType: string
): string | string[] | boolean | null {
  switch (fieldType) {
    case "array":
      return [];
    case "boolean":
      return false;
    case "readonly":
      return null;
    default:
      return "";
  }
}

function normalizeForForm(
  val: unknown,
  fieldType: string
): string | string[] | boolean | null {
  if (val === null || val === undefined) return getDefaultValue(fieldType);

  switch (fieldType) {
    case "array":
      if (Array.isArray(val)) return val.map((v) => String(v));
      if (typeof val === "string")
        return val
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);
      return [];
    case "boolean":
      return Boolean(val);
    case "readonly":
      if (typeof val === "boolean") return val;
      return val === "true" || val === true;
    default:
      return String(val);
  }
}

// ---------------------------------------------------------------------------
// Empty extract factory
// ---------------------------------------------------------------------------

function emptyField<T>(defaultValue: T): FieldNode<T> {
  return { value: defaultValue, q: 0, evidence: [] };
}

function createEmptyExtract(): AyoExtract {
  return {
    version: "AYO-EXTRACT-3.0",
    source: {
      url: "",
      scan: {
        is_reachable: null,
        has_jsonld: null,
        jsonld_count: null,
        has_asr_file: null,
        has_faq_content: null,
        has_faq_schema: null,
        is_aya_registered: false,
      },
    },
    fields: {
      identite: {
        name: emptyField(""),
        legal_name: emptyField(""),
        business_type: emptyField(""),
        city: emptyField(""),
        country: emptyField(""),
        contact_email: emptyField(""),
        contact_phone: emptyField(""),
      },
      offre: {
        services: emptyField<string[]>([]),
        products: emptyField<string[]>([]),
        use_cases: emptyField<string[]>([]),
        target_audience: emptyField(""),
        pricing_indication: emptyField(""),
      },
      processus_methodes: {
        process_steps: emptyField<string[]>([]),
        delivery_mode: emptyField(""),
        geographies_served: emptyField(""),
        quality_assurance: emptyField(""),
      },
      engagements_conformite: {
        policies: emptyField<string[]>([]),
        frameworks: emptyField<string[]>([]),
        certifications: emptyField<string[]>([]),
        security_measures: emptyField<string[]>([]),
      },
      indicateurs: {
        key_indicators: emptyField<string[]>([]),
        last_review_date: emptyField(""),
      },
      contenus_pedagogiques: {
        has_faq: emptyField(false),
        has_glossary: emptyField(false),
        has_documentation: emptyField(false),
      },
      structure_technique: {
        has_asr: emptyField(false),
        has_jsonld: emptyField(false),
        has_sitemap: emptyField<boolean | null>(null),
        mobile_optimized: emptyField(false),
      },
      contextual_signals: {
        pricing_level: emptyField(""),
        access_mode: emptyField(""),
        service_mode: emptyField<string[]>([]),
        schedule_type: emptyField<string[]>([]),
      },
      recommandation: {
        contextual_relevance: emptyField<
          {
            userIntent: string;
            queryExamples: string[];
            decisionCriteria: string[];
            status: "eligible" | "uncertain" | "excluded";
          }[]
        >([]),
        selection_conditions: emptyField<{
          required: string[];
          exclusion: string[];
        }>({ required: [], exclusion: [] }),
        ai_simulation: emptyField<
          { query: string; result: "\u2705" | "\u26a0\ufe0f" | "\u274c"; reason: string }[]
        >([]),
      },
    },
  };
}
