"""
Export AYA Registry to HuggingFace dataset formats (CSV + JSONL).

Connects to Supabase, fetches all aya_registry entities,
and exports structured data suitable for HuggingFace Hub.

Usage:
    python export_huggingface.py

Output:
    aya/exports/aya_business_dataset.csv   — tabular format
    aya/exports/aya_business_dataset.jsonl  — JSON Lines format

Requires:
    SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in ../.env.local
"""

import csv
import json
import os
import sys
from datetime import datetime, timezone

try:
    from supabase import create_client, Client
except ImportError:
    print("ERROR: supabase-py not installed. Run: pip install supabase")
    sys.exit(1)

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_DIR = os.path.dirname(SCRIPT_DIR)
EXPORT_DIR = os.path.join(SCRIPT_DIR, "exports")
ENV_FILE = os.path.join(PROJECT_DIR, ".env.local")

SOURCE_LABEL = "AYA Registry by AI Visionary"
BASE_URL = "https://ai-visionary.com/aya/e"


def load_env():
    """Load SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY from .env.local."""
    if not os.path.exists(ENV_FILE):
        print(f"ERROR: {ENV_FILE} not found")
        sys.exit(1)
    with open(ENV_FILE, "r") as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                key, _, value = line.partition("=")
                key = key.strip()
                value = value.strip().strip('"')
                if key in ("SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"):
                    os.environ[key] = value


def get_supabase() -> Client:
    url = os.environ.get("SUPABASE_URL", "")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
    if not url or not key:
        print("ERROR: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY required")
        sys.exit(1)
    return create_client(url, key)


def fetch_all_entities(supabase: Client) -> list:
    """Fetch all entities with pagination (Supabase 1000 row limit)."""
    all_entities = []
    page_size = 1000
    offset = 0

    while True:
        result = (
            supabase.table("aya_registry")
            .select("*")
            .range(offset, offset + page_size - 1)
            .execute()
        )
        batch = result.data or []
        all_entities.extend(batch)
        print(f"  Fetched {len(batch)} entities (total: {len(all_entities)})")
        if len(batch) < page_size:
            break
        offset += page_size

    return all_entities


def extract_keywords(entity: dict) -> list:
    """Extract keywords from asr_payload.data.external_context.keywords.value."""
    payload = entity.get("asr_payload")
    if not payload:
        return []
    if isinstance(payload, str):
        try:
            payload = json.loads(payload)
        except (json.JSONDecodeError, TypeError):
            return []

    data = payload.get("data", {})
    ext = data.get("external_context", {})
    kw = ext.get("keywords", {})
    value = kw.get("value", [])
    if isinstance(value, list):
        return [str(k).strip() for k in value if k and str(k).strip()]
    return []


def extract_services(entity: dict) -> list:
    """Extract services from asr_payload.data.offre.services.value or aio_blocks."""
    payload = entity.get("asr_payload")
    if not payload:
        return []
    if isinstance(payload, str):
        try:
            payload = json.loads(payload)
        except (json.JSONDecodeError, TypeError):
            return []

    data = payload.get("data", {})

    # Try offre.services first
    offre = data.get("offre", {})
    services = offre.get("services", {}).get("value", [])
    if services and isinstance(services, list):
        return [str(s).strip() for s in services if s and str(s).strip()]

    # Fallback: aio_blocks.offre.fields.keywords_detected
    blocks = data.get("aio_blocks", {})
    offre_block = blocks.get("offre", {})
    fields = offre_block.get("fields", {})
    detected = fields.get("keywords_detected", [])
    if detected and isinstance(detected, list):
        return [str(s).strip() for s in detected if s and str(s).strip()]

    return []


def extract_description(entity: dict) -> str:
    """Extract description from asr_payload.data.entity.description or sector."""
    payload = entity.get("asr_payload")
    if not payload:
        return ""
    if isinstance(payload, str):
        try:
            payload = json.loads(payload)
        except (json.JSONDecodeError, TypeError):
            return ""

    data = payload.get("data", {})
    ent = data.get("entity", {})
    desc = ent.get("description", "")
    if desc and isinstance(desc, str):
        return desc.strip()[:500]
    return ""


def extract_aio_blocks(entity: dict) -> dict:
    """Extract individual AIO block scores."""
    payload = entity.get("asr_payload")
    if not payload:
        return {}
    if isinstance(payload, str):
        try:
            payload = json.loads(payload)
        except (json.JSONDecodeError, TypeError):
            return {}

    data = payload.get("data", {})
    scoring = data.get("aio_scoring", {})
    blocks = scoring.get("block_scores", {})
    if blocks and isinstance(blocks, dict):
        return blocks
    return {}


def entity_to_csv_row(entity: dict) -> dict:
    """Convert a Supabase entity to a flat CSV row."""
    keywords = extract_keywords(entity)
    entity_id = entity.get("entity_id", "")

    return {
        "name": (entity.get("display_name") or entity.get("legal_name") or "Unknown").strip(),
        "website": entity.get("website", ""),
        "country": entity.get("country_legal", "XX"),
        "sector": entity.get("sector_macro", ""),
        "entity_type": entity.get("entity_type", "company"),
        "aio_score": entity.get("asr_score", 0),
        "certified": entity.get("payment_completed", False),
        "keywords": "; ".join(keywords[:20]),
        "source": SOURCE_LABEL,
        "url": f"{BASE_URL}/{entity_id}" if entity_id else "",
    }


def entity_to_jsonl_row(entity: dict) -> dict:
    """Convert a Supabase entity to a rich JSONL row."""
    keywords = extract_keywords(entity)
    services = extract_services(entity)
    description = extract_description(entity)
    aio_blocks = extract_aio_blocks(entity)
    entity_id = entity.get("entity_id", "")

    row = {
        "entity_id": entity_id,
        "name": (entity.get("display_name") or entity.get("legal_name") or "Unknown").strip(),
        "legal_name": (entity.get("legal_name") or "").strip(),
        "website": entity.get("website", ""),
        "country": entity.get("country_legal", "XX"),
        "sector": entity.get("sector_macro", ""),
        "entity_type": entity.get("entity_type", "company"),
        "description": description,
        "aio_score": entity.get("asr_score", 0),
        "certified": entity.get("payment_completed", False),
        "data_origin": entity.get("data_origin", ""),
        "keywords": keywords[:20],
        "services": services[:15],
        "aio_blocks": aio_blocks,
        "source": SOURCE_LABEL,
        "url": f"{BASE_URL}/{entity_id}" if entity_id else "",
        "registry_url": "https://ai-visionary.com/aya",
    }
    return row


def main():
    print("=" * 60)
    print("AYA Registry -> HuggingFace Dataset Export")
    print("=" * 60)

    # Load env
    load_env()

    # Connect
    print("\nConnecting to Supabase...")
    supabase = get_supabase()

    # Fetch
    print("Fetching entities...")
    entities = fetch_all_entities(supabase)
    print(f"\nTotal entities: {len(entities)}")

    if not entities:
        print("ERROR: No entities found!")
        sys.exit(1)

    # Create export dir
    os.makedirs(EXPORT_DIR, exist_ok=True)

    # --- CSV export ---
    csv_path = os.path.join(EXPORT_DIR, "aya_business_dataset.csv")
    csv_fields = ["name", "website", "country", "sector", "entity_type", "aio_score", "certified", "keywords", "source", "url"]

    with open(csv_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=csv_fields)
        writer.writeheader()
        for entity in entities:
            row = entity_to_csv_row(entity)
            writer.writerow(row)

    print(f"\nCSV exported: {csv_path}")

    # --- JSONL export ---
    jsonl_path = os.path.join(EXPORT_DIR, "aya_business_dataset.jsonl")

    with open(jsonl_path, "w", encoding="utf-8") as f:
        for entity in entities:
            row = entity_to_jsonl_row(entity)
            f.write(json.dumps(row, ensure_ascii=False) + "\n")

    print(f"JSONL exported: {jsonl_path}")

    # --- Stats ---
    countries = set()
    sectors = set()
    certified_count = 0
    scores = []

    for entity in entities:
        c = entity.get("country_legal", "XX")
        if c and c != "XX":
            countries.add(c)
        s = entity.get("sector_macro", "")
        if s:
            sectors.add(s)
        if entity.get("payment_completed"):
            certified_count += 1
        score = entity.get("asr_score", 0)
        if score:
            scores.append(score)

    avg_score = sum(scores) / len(scores) if scores else 0

    print(f"\n{'=' * 60}")
    print(f"DATASET STATS")
    print(f"{'=' * 60}")
    print(f"  Total entities:   {len(entities)}")
    print(f"  Certified:        {certified_count}")
    print(f"  Indexed (bot):    {len(entities) - certified_count}")
    print(f"  Countries:        {len(countries)}")
    print(f"  Sectors:          {len(sectors)}")
    print(f"  Avg AIO score:    {avg_score:.1f}")
    print(f"  Score range:      {min(scores)}-{max(scores)}" if scores else "  Score range:      N/A")
    print(f"\nFiles:")
    print(f"  {csv_path}")
    print(f"  {jsonl_path}")
    print(f"\nDone! Ready for HuggingFace upload.")


if __name__ == "__main__":
    main()
