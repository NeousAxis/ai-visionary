"""
Push AYA bot data to Supabase aya_registry.

Entities are inserted with:
- payment_completed = false (not paying customers)
- data_origin = 'AYA-BOT' (scraped, not diagnosed by AYO)

This keeps them separate from real paying clients while building
the index for AI consumption via the API.

Usage:
    python push_to_aya.py                   # Push all data/*.json
    python push_to_aya.py --dry-run         # Preview without writing
    python push_to_aya.py --min-score 20    # Only push entities with score >= 20

Requires env vars:
    SUPABASE_URL
    SUPABASE_SERVICE_ROLE_KEY
"""

import json
import os
import sys
import uuid
from datetime import datetime, timezone

try:
    from supabase import create_client, Client
except ImportError:
    print("ERROR: supabase-py not installed. Run: pip install supabase")
    sys.exit(1)


DATA_FOLDER = os.path.join(os.path.dirname(__file__), "data")


def get_supabase() -> Client:
    url = os.environ.get("SUPABASE_URL", "")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
    if not url or not key:
        print("ERROR: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set")
        sys.exit(1)
    return create_client(url, key)


def load_all_records() -> list:
    records = []
    if not os.path.exists(DATA_FOLDER):
        return records
    for filename in sorted(os.listdir(DATA_FOLDER)):
        if filename.endswith(".json"):
            path = os.path.join(DATA_FOLDER, filename)
            try:
                with open(path, "r", encoding="utf-8") as f:
                    records.append(json.load(f))
            except (json.JSONDecodeError, OSError):
                pass
    return records


def record_to_aya_entity(record: dict) -> dict:
    """Convert an AYA bot record to a Supabase aya_registry row."""
    entity = record.get("entity", {})
    sector = record.get("sector", {})
    scoring = record.get("aio_scoring", {})
    readiness = record.get("aoi_readiness", {})

    # Build ASR payload (the structured data for AI consumption)
    asr_payload = {
        "version": "AYA-BOT-1.0",
        "asr_status": "ASR_DERIVED",
        "source": "AYA-BOT",
        "confidence": record.get("asr_derived", {}).get("confidence", 0.35),
        "data": {
            "entity": entity,
            "sector": sector,
            "aio_blocks": record.get("aio_blocks", {}),
            "aio_scoring": scoring,
        },
        "generated_at": record.get("generated_at", ""),
    }

    # Build recommendability
    score = readiness.get("estimated_aio_score", 0)
    has_jsonld = record.get("source", {}).get("structured_data_found", {}).get("jsonld_found", False)
    recommendability = {
        "machine_readable": has_jsonld,
        "status": "indexed",
        "freshness_score": 0.8,
        "priority_level": "high" if score >= 60 else "medium" if score >= 30 else "low",
        "source_url": entity.get("website", ""),
        "asr_status": "ASR_DERIVED",
    }

    # Determine entity type
    org_type = entity.get("org_type", "")
    entity_type = "company"
    if org_type in ("EducationalOrganization", "School", "CollegeOrUniversity"):
        entity_type = "public_body"
    elif org_type in ("GovernmentOrganization", "GovernmentOffice"):
        entity_type = "public_body"
    elif "association" in org_type.lower():
        entity_type = "association"

    return {
        "entity_id": str(uuid.uuid5(uuid.NAMESPACE_URL, entity.get("website", record.get("source", {}).get("canonical_domain", "")))),
        "legal_name": entity.get("name", "Unknown")[:200],
        "display_name": entity.get("name", "Unknown")[:200],
        "entity_type": entity_type,
        "country_legal": entity.get("country", "XX") or "XX",
        "sector_macro": sector.get("sector_label", "General") if sector else "General",
        "website": entity.get("website", ""),
        "asr_score": min(score, 100),
        "payment_completed": False,
        "contact_email": entity.get("contacts", {}).get("email", ""),
        "last_update": datetime.now(timezone.utc).isoformat(),
        "data_origin": "AYA-BOT",
        "asr_payload": asr_payload,
        "recommendability": recommendability,
    }


def main():
    dry_run = "--dry-run" in sys.argv
    min_score = 0
    for i, arg in enumerate(sys.argv):
        if arg == "--min-score" and i + 1 < len(sys.argv):
            min_score = int(sys.argv[i + 1])

    records = load_all_records()
    print(f"=== AYA Push — {len(records)} records loaded ===")

    if min_score > 0:
        records = [r for r in records if r.get("aoi_readiness", {}).get("estimated_aio_score", 0) >= min_score]
        print(f"  Filtered to {len(records)} with score >= {min_score}")

    if dry_run:
        print("\n[DRY RUN] Would push these entities:\n")
        for r in records[:10]:
            entity = record_to_aya_entity(r)
            print(f"  {entity['display_name'][:40]:40s} | score={entity['asr_score']:3} | {entity['country_legal']:2s} | {entity['sector_macro']}")
        if len(records) > 10:
            print(f"  ... and {len(records) - 10} more")
        print(f"\nTotal: {len(records)} entities")
        return

    supabase = get_supabase()

    success = 0
    errors = 0
    skipped = 0

    for i, record in enumerate(records, 1):
        entity = record_to_aya_entity(record)
        name = entity["display_name"][:40]

        try:
            result = supabase.table("aya_registry").upsert(
                entity,
                on_conflict="entity_id"
            ).execute()

            if result.data:
                print(f"[{i}/{len(records)}] OK: {name} (score={entity['asr_score']})")
                success += 1
            else:
                print(f"[{i}/{len(records)}] SKIP: {name}")
                skipped += 1
        except Exception as e:
            error_msg = str(e)
            if "duplicate" in error_msg.lower() or "unique" in error_msg.lower():
                print(f"[{i}/{len(records)}] EXISTS: {name}")
                skipped += 1
            else:
                print(f"[{i}/{len(records)}] ERROR: {name} — {error_msg[:100]}")
                errors += 1

    print(f"\n=== Done: {success} pushed, {skipped} skipped, {errors} errors ===")


if __name__ == "__main__":
    main()
