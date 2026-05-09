"""
Reclassify sector_macro + add gemini_description/gemini_description_fr
+ gemini_keywords/gemini_keywords_fr for all VPS Postgres entities
(aya_local.aya_registry, ~25 860 Tranco scraped).

Single-pass enrichment: 1 Gemini call per batch returns 4 outputs
(sector + EN/FR descriptions + EN/FR keywords) — replaces the legacy
4-script chain (enrich_with_gemini, enrich_keywords, translate_to_fr,
enrich_keywords_fr) that used 4x more API calls.

Usage:
    # Dry-run: samples 20 entities, prints comparison table, NO DB writes
    python3 reclassify_and_enrich_vps.py

    # Apply: processes all entities (or --limit N for a small test)
    python3 reclassify_and_enrich_vps.py --apply

    # Apply with limit (quick test on 100 entities)
    python3 reclassify_and_enrich_vps.py --apply --limit 100

Must run ON the VPS (Postgres is localhost-only).

Requires in ../.env.local:
    GOOGLE_GENERATIVE_AI_API_KEY  (or GEMINI_API_KEY as alias)
    VPS_PG_HOST, VPS_PG_PORT, VPS_PG_DB, VPS_PG_USER, VPS_PG_PASSWORD

Model: gemini-2.0-flash (10-20x cheaper than gemini-3-flash-preview).
Batch size: 20 entities per Gemini call.

Crash recovery:
    Progress is checkpointed in /tmp/reclassify_progress.json.
    Re-run with same flags to resume from the last completed batch.
"""

import argparse
import json
import os
import re
import sys
import time
from datetime import datetime

try:
    import psycopg2
    import psycopg2.extras
except ImportError:
    print("ERROR: psycopg2-binary not installed. Run: pip install psycopg2-binary")
    sys.exit(1)

try:
    import google.generativeai as genai
except ImportError:
    print("ERROR: google-generativeai not installed. Run: pip install google-generativeai")
    sys.exit(1)

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_DIR = os.path.dirname(SCRIPT_DIR)
ENV_FILE = os.path.join(PROJECT_DIR, ".env.local")
PROGRESS_FILE = "/tmp/reclassify_progress.json"

BATCH_SIZE = 20
SLEEP_BETWEEN_BATCHES = 0.5   # billing active = no rate limit; small delay for politeness
MAX_RETRIES = 3
RETRY_BASE_WAIT = 10           # seconds (exponential: 10, 20, 30)

# Closed list — Gemini MUST return one of these exactly.
ALLOWED_SECTORS = [
    "Technologie & SaaS",
    "Finance & Assurance",
    "Santé & Pharma",
    "Alimentation & Boissons",
    "Commerce & Retail",
    "Éducation & Formation",
    "Énergie & Environnement",
    "Consulting & Services",
    "Média & Communication",
    "Transport & Logistique",
    "Industrie & Manufacture",
    "Immobilier & Construction",
    "Télécommunications",
    "Administration & Gouvernement",
    "ONG & Associations",
    "Loisirs & Tourisme",
    "General",
]

ALLOWED_SECTORS_SET = set(ALLOWED_SECTORS)

# Gemini model — gemini-2.0-flash (stable, ~10-20x cheaper than gemini-3-flash-preview).
GEMINI_MODEL = "gemini-2.0-flash"

# ---------------------------------------------------------------------------
# Prompt template
# ---------------------------------------------------------------------------

SYSTEM_INSTRUCTION = (
    "You are a precise business classifier. You receive a list of companies with their "
    "name, website, current sector, and optional meta/services data. For each company you output "
    "a strict JSON array. No markdown, no explanation, no extra text — only the JSON array."
)

def build_prompt(entities: list) -> str:
    """Build the batch prompt for Gemini."""
    lines = []
    for i, e in enumerate(entities):
        name = e["name"] or e["website"] or "Unknown"
        website = e["website"] or ""
        current_sector = e["current_sector"] or "General"
        meta = (e["meta_description"] or "")[:200]          # cap to avoid token bloat
        services_raw = e["services"]
        if isinstance(services_raw, list):
            services = ", ".join(str(s) for s in services_raw[:5])
        elif isinstance(services_raw, str):
            services = services_raw[:200]
        else:
            services = ""

        lines.append(
            f"{i+1}. name={name} | website={website} | current_sector={current_sector} "
            f"| meta={meta} | services={services}"
        )

    sectors_list = " / ".join(ALLOWED_SECTORS)

    return f"""Classify each company and write short factual descriptions.

RULES:
- sector_macro: choose EXACTLY one from this list (no variation allowed):
  {sectors_list}
- description_en: 2-3 sentences in English. FACTUAL only.
- description_fr: 2-3 sentences in French. FACTUAL only.
- FORBIDDEN words: leader, best, premium, world-class, innovative, cutting-edge, top, #1, excellent, superior, unrivalled
- State what the company does, who it serves, where it operates.
- If the entity is unclear or the website seems dead → use sector="General" and a generic factual description.
- Return ONLY a JSON array, one object per company, in the SAME ORDER as the input.

Expected format:
[
  {{
    "entity_id": "...",
    "sector_macro": "...",
    "description_en": "...",
    "description_fr": "..."
  }},
  ...
]

Companies:
{chr(10).join(lines)}

Return ONLY the JSON array. No markdown. No explanation."""


# ---------------------------------------------------------------------------
# Environment loading
# ---------------------------------------------------------------------------

def load_env():
    """Load .env.local into os.environ."""
    if not os.path.exists(ENV_FILE):
        print(f"ERROR: {ENV_FILE} not found")
        sys.exit(1)
    needed = {
        "GOOGLE_GENERATIVE_AI_API_KEY", "GEMINI_API_KEY",
        "VPS_PG_HOST", "VPS_PG_PORT", "VPS_PG_DB", "VPS_PG_USER", "VPS_PG_PASSWORD",
    }
    with open(ENV_FILE, "r") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, _, value = line.partition("=")
            key = key.strip()
            value = value.strip().strip('"').strip("'")
            if key in needed:
                os.environ[key] = value


def get_gemini_key() -> str:
    key = os.environ.get("GOOGLE_GENERATIVE_AI_API_KEY") or os.environ.get("GEMINI_API_KEY", "")
    if not key:
        print("ERROR: GOOGLE_GENERATIVE_AI_API_KEY (or GEMINI_API_KEY) missing in .env.local")
        sys.exit(1)
    return key


# ---------------------------------------------------------------------------
# Postgres VPS connection
# ---------------------------------------------------------------------------

def get_pg_conn():
    return psycopg2.connect(
        host=os.environ.get("VPS_PG_HOST", "localhost"),
        port=int(os.environ.get("VPS_PG_PORT", "5432")),
        dbname=os.environ["VPS_PG_DB"],
        user=os.environ["VPS_PG_USER"],
        password=os.environ["VPS_PG_PASSWORD"],
    )


def fetch_entities(limit: int | None = None) -> list:
    """
    Fetch entities from VPS Postgres.
    Extracts name, website, sector_macro, meta_description, services from asr_payload.
    Returns a list of dicts ready for the Gemini prompt.
    """
    query = """
        SELECT
            entity_id,
            COALESCE(display_name, legal_name, '') AS display_name,
            website,
            sector_macro,
            asr_payload
        FROM aya_registry
        WHERE asr_score >= 20
        ORDER BY entity_id
    """
    if limit:
        query += f" LIMIT {limit}"

    conn = get_pg_conn()
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(query)
            rows = cur.fetchall()
    finally:
        conn.close()

    entities = []
    for r in rows:
        payload = r["asr_payload"] or {}
        if isinstance(payload, str):
            try:
                payload = json.loads(payload)
            except Exception:
                payload = {}

        # Extract meta_description from asr_payload->data->aio_blocks->offre->fields->meta_description
        meta_description = ""
        try:
            meta_description = (
                payload.get("data", {})
                .get("aio_blocks", {})
                .get("offre", {})
                .get("fields", {})
                .get("meta_description", "")
                or ""
            )
        except Exception:
            pass

        # Extract services from asr_payload->data->offre->services->value
        services = ""
        try:
            services = (
                payload.get("data", {})
                .get("offre", {})
                .get("services", {})
                .get("value", "")
                or ""
            )
        except Exception:
            pass

        # Also check if all 4 enrichment fields already exist (skip if so)
        enr = {}
        try:
            enr = payload.get("data", {}).get("enrichment", {}) or {}
        except Exception:
            pass

        existing_desc = str(enr.get("gemini_description", "") or "")
        existing_desc_fr = str(enr.get("gemini_description_fr", "") or "")
        existing_kws = enr.get("gemini_keywords") or []
        existing_kws_fr = enr.get("gemini_keywords_fr") or []

        # An entity is "fully enriched" only if all 4 fields are present.
        fully_enriched = (
            len(existing_desc) >= 10
            and len(existing_desc_fr) >= 10
            and isinstance(existing_kws, list) and len(existing_kws) > 0
            and isinstance(existing_kws_fr, list) and len(existing_kws_fr) > 0
        )

        entities.append({
            "entity_id": str(r["entity_id"]),
            "name": r["display_name"] or "",
            "website": r["website"] or "",
            "current_sector": r["sector_macro"] or "General",
            "meta_description": str(meta_description)[:300] if meta_description else "",
            "services": services,
            "existing_description": existing_desc,
            "fully_enriched": fully_enriched,
            "payload": payload,   # kept for UPDATE later
        })

    return entities


# ---------------------------------------------------------------------------
# Progress checkpoint
# ---------------------------------------------------------------------------

def load_progress() -> set:
    """Return set of entity_ids already processed (from checkpoint file)."""
    if not os.path.exists(PROGRESS_FILE):
        return set()
    try:
        with open(PROGRESS_FILE, "r") as f:
            data = json.load(f)
        return set(data.get("done", []))
    except Exception:
        return set()


def save_progress(done_ids: set):
    """Persist set of completed entity_ids to checkpoint file."""
    try:
        with open(PROGRESS_FILE, "w") as f:
            json.dump({"done": list(done_ids), "updated_at": datetime.utcnow().isoformat()}, f)
    except Exception as ex:
        print(f"  WARNING: could not save progress checkpoint: {ex}")


# ---------------------------------------------------------------------------
# Gemini call with retry
# ---------------------------------------------------------------------------

def call_gemini_batch(model, entities: list) -> list | None:
    """
    Send one batch to Gemini. Returns list of dicts with keys:
    entity_id, sector_macro, description_en, description_fr.
    Returns None on total failure.
    """
    # Inject entity_ids into the prompt so Gemini echoes them back
    prompt_entities = []
    for e in entities:
        prompt_entities.append({
            **e,
            "entity_id": e["entity_id"],   # ensure it's in the item
        })

    # Build prompt lines with entity_id embedded
    lines = []
    for i, e in enumerate(prompt_entities):
        name = e["name"] or e["website"] or "Unknown"
        website = e["website"] or ""
        current_sector = e["current_sector"] or "General"
        meta = (e["meta_description"] or "")[:200]
        services_raw = e["services"]
        if isinstance(services_raw, list):
            services = ", ".join(str(s) for s in services_raw[:5])
        elif isinstance(services_raw, str):
            services = services_raw[:200]
        else:
            services = ""

        lines.append(
            f"{i+1}. entity_id={e['entity_id']} | name={name} | website={website} "
            f"| current_sector={current_sector} | meta={meta} | services={services}"
        )

    sectors_list = " / ".join(ALLOWED_SECTORS)

    prompt = f"""Classify each company, write short factual descriptions, and extract business keywords.

RULES:
- sector_macro: choose EXACTLY one from this list (no variation allowed):
  {sectors_list}
- description_en: 2-3 sentences in English. FACTUAL only.
- description_fr: 2-3 sentences in French. FACTUAL only.
- keywords_en: 5-8 business keywords in English describing the actual activity (e.g. football, automobile, banking, cloud computing). NO generic terms (service, platform, app, website, solution, digital, company, business).
- keywords_fr: 5-8 business keywords in French. Adapt to French business vocabulary (do not translate literally). Lowercase except proper nouns. Keep technical terms unchanged (blockchain, API, SaaS, NFT, DeFi, etc.).
- FORBIDDEN words in descriptions: leader, best, premium, world-class, innovative, cutting-edge, top, #1, excellent, superior, unrivalled
- State what the company does, who it serves, where it operates.
- If the entity is unclear or the website seems dead → use sector_macro="General", generic factual description, and 5 broad keywords.
- Echo back the entity_id exactly as given.
- Return ONLY a JSON array, one object per company, in the SAME ORDER as the input.

Expected format:
[
  {{
    "entity_id": "...",
    "sector_macro": "...",
    "description_en": "...",
    "description_fr": "...",
    "keywords_en": ["...", "...", "..."],
    "keywords_fr": ["...", "...", "..."]
  }},
  ...
]

Companies:
{chr(10).join(lines)}

Return ONLY the JSON array. No markdown fences. No explanation."""

    for attempt in range(MAX_RETRIES):
        try:
            response = model.generate_content(prompt)
            text = response.text.strip()

            # Strip markdown code fences if present
            text = re.sub(r'^```(?:json)?\s*', '', text)
            text = re.sub(r'\s*```$', '', text)
            text = text.strip()

            # Extract JSON array
            match = re.search(r'\[.*\]', text, re.DOTALL)
            if not match:
                print(f"    WARNING: Gemini returned no JSON array (attempt {attempt+1})")
                print(f"    DEBUG raw text (first 500 chars): {text[:500]!r}")
                try:
                    print(f"    DEBUG finish_reason: {response.candidates[0].finish_reason}")
                except Exception:
                    pass
                if attempt < MAX_RETRIES - 1:
                    time.sleep(RETRY_BASE_WAIT * (attempt + 1))
                    continue
                return None

            results = json.loads(match.group())
            if not isinstance(results, list):
                print(f"    WARNING: Gemini result is not a list (attempt {attempt+1})")
                if attempt < MAX_RETRIES - 1:
                    time.sleep(RETRY_BASE_WAIT * (attempt + 1))
                    continue
                return None

            return results

        except json.JSONDecodeError as ex:
            print(f"    WARNING: JSON parse error (attempt {attempt+1}): {ex}")
            if attempt < MAX_RETRIES - 1:
                time.sleep(RETRY_BASE_WAIT * (attempt + 1))
                continue
            return None

        except Exception as ex:
            err_str = str(ex)
            if "429" in err_str or "quota" in err_str.lower():
                wait = 30 * (attempt + 1)
                print(f"    Rate limit 429 — retry in {wait}s (attempt {attempt+1}/{MAX_RETRIES})")
                time.sleep(wait)
                continue
            print(f"    ERROR Gemini: {ex}")
            if attempt < MAX_RETRIES - 1:
                time.sleep(RETRY_BASE_WAIT * (attempt + 1))
                continue
            return None

    return None


# ---------------------------------------------------------------------------
# DB update
# ---------------------------------------------------------------------------

def apply_updates(updates: list):
    """
    Apply a list of updates to Postgres VPS.
    Each update: {entity_id, sector_macro, description_en, description_fr,
                  keywords_en, keywords_fr}
    Uses jsonb_set to write into asr_payload.data.enrichment without touching other fields.
    """
    conn = get_pg_conn()
    try:
        with conn.cursor() as cur:
            for u in updates:
                cur.execute(
                    """
                    UPDATE aya_registry
                    SET
                        sector_macro = %s,
                        asr_payload = jsonb_set(
                            jsonb_set(
                                jsonb_set(
                                    jsonb_set(
                                        COALESCE(asr_payload, '{}'::jsonb),
                                        '{data,enrichment,gemini_description}',
                                        to_jsonb(%s::text),
                                        true
                                    ),
                                    '{data,enrichment,gemini_description_fr}',
                                    to_jsonb(%s::text),
                                    true
                                ),
                                '{data,enrichment,gemini_keywords}',
                                %s::jsonb,
                                true
                            ),
                            '{data,enrichment,gemini_keywords_fr}',
                            %s::jsonb,
                            true
                        )
                    WHERE entity_id = %s::uuid
                    """,
                    (
                        u["sector_macro"],
                        u["description_en"],
                        u["description_fr"],
                        json.dumps(u["keywords_en"], ensure_ascii=False),
                        json.dumps(u["keywords_fr"], ensure_ascii=False),
                        u["entity_id"],
                    ),
                )
        conn.commit()
    except Exception as ex:
        conn.rollback()
        raise ex
    finally:
        conn.close()


# ---------------------------------------------------------------------------
# Progress bar helper
# ---------------------------------------------------------------------------

def progress_bar(done: int, total: int, start_time: float, bar_width: int = 40) -> str:
    pct = done / total if total else 0
    filled = int(bar_width * pct)
    bar = "#" * filled + "-" * (bar_width - filled)
    elapsed = time.time() - start_time
    eta_str = ""
    if done > 0:
        eta = elapsed / done * (total - done)
        mins, secs = divmod(int(eta), 60)
        eta_str = f" ETA {mins}m{secs:02d}s"
    return f"[{bar}] {done}/{total} ({pct*100:.1f}%){eta_str}"


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(
        description="Reclassify sector + add Gemini descriptions for VPS entities."
    )
    parser.add_argument(
        "--apply",
        action="store_true",
        help="Execute real DB updates. Without this flag: dry-run on 20 sample entities.",
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=None,
        help="Process at most N entities (useful for testing, e.g. --apply --limit 100).",
    )
    parser.add_argument(
        "--skip-existing",
        action="store_true",
        default=True,
        help="Skip entities that already have a gemini_description (default: True).",
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="Re-process ALL entities even if they already have a gemini_description.",
    )
    parser.add_argument(
        "--reset-progress",
        action="store_true",
        help="Delete /tmp/reclassify_progress.json and start from scratch.",
    )
    args = parser.parse_args()

    # Resolve skip logic
    skip_existing = not args.force

    print("=" * 65)
    print("AYA VPS — Sector Reclassification + Gemini Description Enrichment")
    print(f"Mode   : {'APPLY (real DB writes)' if args.apply else 'DRY-RUN (no DB writes, 20 sample entities)'}")
    print(f"Model  : {GEMINI_MODEL}")
    print(f"Limit  : {args.limit or 'all'}")
    print(f"Skip existing descriptions: {skip_existing}")
    print("=" * 65)

    # Load environment
    load_env()
    api_key = get_gemini_key()
    genai.configure(api_key=api_key)
    model = genai.GenerativeModel(
        GEMINI_MODEL,
        generation_config=genai.types.GenerationConfig(
            temperature=0.0,         # fully deterministic — classification task
            max_output_tokens=16384, # plenty of room for 5 × bilingual JSON output
            response_mime_type='application/json',  # force valid JSON output, no markdown
        ),
    )

    # Reset progress if requested
    if args.reset_progress and os.path.exists(PROGRESS_FILE):
        os.remove(PROGRESS_FILE)
        print(f"Progress checkpoint reset: {PROGRESS_FILE}")

    # Dry-run: force limit to 20, no --apply
    effective_limit = args.limit
    if not args.apply:
        effective_limit = 20
        print(f"\nDRY-RUN: fetching {effective_limit} sample entities...")
    else:
        print(f"\nFetching entities from VPS Postgres (asr_score >= 20, limit={effective_limit or 'all'})...")

    entities = fetch_entities(limit=effective_limit)
    print(f"  Fetched: {len(entities)} entities")

    # Filter entities missing any of the 4 enrichment fields (unless --force)
    if skip_existing:
        needs_work = [e for e in entities if not e.get("fully_enriched")]
        already_done_count = len(entities) - len(needs_work)
        print(f"  Already fully enriched (desc EN+FR + kws EN+FR): {already_done_count}")
        print(f"  Need enrichment: {len(needs_work)}")
    else:
        needs_work = entities
        print(f"  Force mode: processing all {len(needs_work)} entities")

    if not needs_work:
        print("\nNothing to do!")
        return

    # Load crash-recovery progress
    done_ids = load_progress()
    if done_ids:
        before = len(needs_work)
        needs_work = [e for e in needs_work if e["entity_id"] not in done_ids]
        print(f"  Resuming from checkpoint: {before - len(needs_work)} already done, {len(needs_work)} remaining")

    if not needs_work:
        print("\nAll entities already processed (checkpoint). Use --reset-progress to rerun.")
        return

    # Stats counters
    sector_changed = 0
    sector_kept = 0
    sector_invalid = 0
    desc_ok = 0
    desc_failed = 0
    batch_failed = 0

    start_time = time.time()

    # Dry-run: just print the comparison table
    if not args.apply:
        print(f"\n--- DRY-RUN: sample of {len(needs_work)} entities ---\n")
        batch = needs_work[:BATCH_SIZE]
        results = call_gemini_batch(model, batch)

        if not results:
            print("ERROR: Gemini returned nothing for the sample batch.")
            sys.exit(1)

        # Build lookup by entity_id
        result_map = {}
        for r in results:
            if isinstance(r, dict) and "entity_id" in r:
                result_map[r["entity_id"]] = r

        # Print table
        print(f"{'Name':<30} {'Old sector':<28} {'New sector':<28} {'Description (EN, first 60 chars)'}")
        print("-" * 130)
        for e in batch:
            eid = e["entity_id"]
            r = result_map.get(eid)
            if not r:
                # Try matching by position
                idx = batch.index(e)
                r = results[idx] if idx < len(results) else None

            if not r or not isinstance(r, dict):
                print(f"{'  ' + (e['name'] or e['website']):<30} {e['current_sector']:<28} {'[NO RESULT]':<28}")
                continue

            new_sector = r.get("sector_macro", "")
            desc_en = r.get("description_en", "")[:60]
            old = e["current_sector"]
            changed = " <-- CHANGED" if new_sector != old else ""
            valid = "" if new_sector in ALLOWED_SECTORS_SET else " [INVALID!]"
            name_display = (e["name"] or e["website"] or "?")[:28]
            print(f"  {name_display:<28} {old:<28} {new_sector:<28} {desc_en}{changed}{valid}")

        print(f"\nDRY-RUN complete. Re-run with --apply to write to DB.")
        return

    # --- APPLY mode ---
    total = len(needs_work)
    batches = [needs_work[i:i + BATCH_SIZE] for i in range(0, total, BATCH_SIZE)]
    total_batches = len(batches)
    print(f"\nProcessing {total} entities in {total_batches} batches of {BATCH_SIZE}...\n")

    for batch_idx, batch in enumerate(batches):
        print(f"Batch {batch_idx + 1}/{total_batches} | {progress_bar(batch_idx * BATCH_SIZE, total, start_time)}")

        results = call_gemini_batch(model, batch)

        if results is None:
            print(f"  BATCH FAILED — skipping {len(batch)} entities")
            batch_failed += 1
            desc_failed += len(batch)
            time.sleep(SLEEP_BETWEEN_BATCHES)
            continue

        # Build lookup by entity_id (Gemini echoes back the id)
        result_map: dict = {}
        for r in results:
            if isinstance(r, dict) and "entity_id" in r:
                result_map[str(r["entity_id"])] = r

        updates_this_batch = []
        newly_done = set()

        for i, e in enumerate(batch):
            eid = e["entity_id"]

            # Primary lookup: by entity_id
            r = result_map.get(eid)

            # Fallback: by position (Gemini may not always echo entity_id correctly)
            if not r and i < len(results):
                r = results[i]

            if not r or not isinstance(r, dict):
                print(f"  SKIP {e['name'] or e['website']}: no result from Gemini")
                desc_failed += 1
                continue

            new_sector = r.get("sector_macro", "").strip()
            desc_en = r.get("description_en", "").strip()
            desc_fr = r.get("description_fr", "").strip()
            kws_en = r.get("keywords_en", []) or []
            kws_fr = r.get("keywords_fr", []) or []
            if not isinstance(kws_en, list):
                kws_en = []
            if not isinstance(kws_fr, list):
                kws_fr = []
            # Sanitize keywords: lowercase strings, strip empties, cap length
            kws_en = [str(k).strip() for k in kws_en if k and str(k).strip()][:10]
            kws_fr = [str(k).strip() for k in kws_fr if k and str(k).strip()][:10]

            # Validate sector
            if new_sector not in ALLOWED_SECTORS_SET:
                print(f"  WARNING {e['name'] or e['website']}: invalid sector '{new_sector}' — keeping '{e['current_sector']}'")
                new_sector = e["current_sector"]   # keep old sector
                sector_invalid += 1
            else:
                if new_sector != e["current_sector"]:
                    sector_changed += 1
                    print(f"  RECLASSIFIED {e['name'] or e['website']}: {e['current_sector']} → {new_sector}")
                else:
                    sector_kept += 1

            if not desc_en or not desc_fr:
                print(f"  WARNING {e['name'] or e['website']}: empty description(s)")
                desc_failed += 1
                # Still update sector if valid
                desc_en = desc_en or f"{e['name'] or e['website']} — no description available."
                desc_fr = desc_fr or f"{e['name'] or e['website']} — description non disponible."

            updates_this_batch.append({
                "entity_id": eid,
                "sector_macro": new_sector,
                "description_en": desc_en,
                "description_fr": desc_fr,
                "keywords_en": kws_en,
                "keywords_fr": kws_fr,
            })
            newly_done.add(eid)
            desc_ok += 1

        # Write batch to DB
        if updates_this_batch:
            try:
                apply_updates(updates_this_batch)
                done_ids.update(newly_done)
                save_progress(done_ids)
                print(f"  OK: {len(updates_this_batch)} entities updated")
            except Exception as ex:
                print(f"  DB ERROR on batch {batch_idx + 1}: {ex}")
                desc_failed += len(updates_this_batch)
                batch_failed += 1

        time.sleep(SLEEP_BETWEEN_BATCHES)

    # Final summary
    elapsed = time.time() - start_time
    mins, secs = divmod(int(elapsed), 60)
    print("\n" + "=" * 65)
    print("DONE")
    print(f"  Total entities processed : {total}")
    print(f"  Descriptions written OK  : {desc_ok}")
    print(f"  Descriptions failed      : {desc_failed}")
    print(f"  Sector changed           : {sector_changed}")
    print(f"  Sector kept (same)       : {sector_kept}")
    print(f"  Sector invalid (skipped) : {sector_invalid}")
    print(f"  Batches failed entirely  : {batch_failed}")
    print(f"  Elapsed                  : {mins}m{secs:02d}s")
    print(f"  Progress checkpoint      : {PROGRESS_FILE}")
    print("=" * 65)

    if desc_failed > 0 or batch_failed > 0:
        print(f"\nTip: {desc_failed} entities were not updated. Re-run to retry skipped ones.")
        print("     Use --reset-progress only if you want to reprocess already-done entities.")


if __name__ == "__main__":
    main()
