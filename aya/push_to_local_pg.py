"""
Push AYA bot data to a LOCAL PostgreSQL database on the Infomaniak VPS.

THIS SCRIPT RUNS ON THE VPS — it connects to Postgres on localhost:5432.
It does NOT touch Supabase in any way — no Supabase imports, no Supabase credentials.
It replaces push_to_aya.py for the VPS use case; push_to_aya.py (Supabase) remains intact.

The aya_registry table schema on the VPS is identical to the Supabase schema:
    entity_id           TEXT PRIMARY KEY
    legal_name          TEXT
    display_name        TEXT
    entity_type         TEXT
    country_legal       TEXT
    sector_macro        TEXT
    website             TEXT
    asr_score           INTEGER
    payment_completed   BOOLEAN
    contact_email       TEXT
    data_origin         TEXT
    asr_payload         JSONB
    recommendability    JSONB
    created_at          TIMESTAMPTZ DEFAULT now()
    updated_at          TIMESTAMPTZ DEFAULT now()

Usage:
    python push_to_local_pg.py                   # Push all data/*.json
    python push_to_local_pg.py --dry-run         # Preview without writing
    python push_to_local_pg.py --min-score 20    # Only push entities with score >= 20
    python push_to_local_pg.py --limit 500       # Process only first 500 records

Requires env vars:
    VPS_PG_PASSWORD   (required)
    VPS_PG_HOST       (default: localhost)
    VPS_PG_PORT       (default: 5432)
    VPS_PG_DB         (default: aya_local)
    VPS_PG_USER       (default: aya_app)
"""

import json
import os
import sys
import time
import uuid
from datetime import datetime, timezone, timedelta

try:
    import psycopg2
    import psycopg2.extras
    from psycopg2.extras import Json
except ImportError:
    print("ERROR: psycopg2 not installed. Run: pip install psycopg2-binary")
    sys.exit(1)

# Inline definitions of load_all_records / record_to_aya_entity — identical to
# push_to_aya.py but without any Supabase dependency, so this script runs on the
# VPS without needing supabase-py installed (PEP 668 makes pip install awkward
# on Ubuntu 24.04 system Python).

DATA_FOLDER = os.path.join(os.path.dirname(__file__), "data")


if True:

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
        """Convert an AYA bot record to an aya_registry row dict."""
        entity = record.get("entity", {})
        sector = record.get("sector", {})
        scoring = record.get("aio_scoring", {})
        readiness = record.get("aoi_readiness", {})

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
            "valid_until": (datetime.now(timezone.utc) + timedelta(days=365)).isoformat(),
        }

        keywords = record.get("keywords", [])
        if keywords:
            asr_payload["data"]["external_context"] = {
                "keywords": {"value": keywords, "q": 0.5, "source": "AYA-BOT"}
            }

        offer_kw = record.get("aio_blocks", {}).get("offre", {}).get("fields", {}).get("keywords_detected", [])
        if offer_kw:
            if "offre" not in asr_payload["data"]:
                asr_payload["data"]["offre"] = {}
            asr_payload["data"]["offre"]["services"] = {"value": offer_kw[:10], "q": 0.5, "source": "AYA-BOT"}

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
            "data_origin": "AYA-BOT",
            "asr_payload": asr_payload,
            "recommendability": recommendability,
        }


# ---------------------------------------------------------------------------
# Postgres connection
# ---------------------------------------------------------------------------

def get_pg_connection() -> "psycopg2.connection":
    """Build a psycopg2 connection from VPS_PG_* env vars."""
    password = os.environ.get("VPS_PG_PASSWORD", "")
    if not password:
        print("ERROR: VPS_PG_PASSWORD env var is required")
        sys.exit(1)

    host = os.environ.get("VPS_PG_HOST", "localhost")
    port = int(os.environ.get("VPS_PG_PORT", "5432"))
    dbname = os.environ.get("VPS_PG_DB", "aya_local")
    user = os.environ.get("VPS_PG_USER", "aya_app")

    conn = psycopg2.connect(
        host=host,
        port=port,
        dbname=dbname,
        user=user,
        password=password,
    )
    conn.autocommit = False
    return conn


# ---------------------------------------------------------------------------
# CLI helpers
# ---------------------------------------------------------------------------

def parse_args() -> dict:
    dry_run = "--dry-run" in sys.argv
    min_score = 0
    limit = None

    for i, arg in enumerate(sys.argv):
        if arg == "--min-score" and i + 1 < len(sys.argv):
            min_score = int(sys.argv[i + 1])
        if arg == "--limit" and i + 1 < len(sys.argv):
            limit = int(sys.argv[i + 1])

    return {"dry_run": dry_run, "min_score": min_score, "limit": limit}


# ---------------------------------------------------------------------------
# Push logic
# ---------------------------------------------------------------------------

BATCH_SIZE = 50
BATCH_DELAY = 0.2  # seconds between batches

INSERT_SQL = """
INSERT INTO aya_registry (
    entity_id, legal_name, display_name, entity_type,
    country_legal, sector_macro, website, asr_score,
    payment_completed, contact_email, data_origin,
    asr_payload, recommendability
) VALUES (
    %(entity_id)s, %(legal_name)s, %(display_name)s, %(entity_type)s,
    %(country_legal)s, %(sector_macro)s, %(website)s, %(asr_score)s,
    %(payment_completed)s, %(contact_email)s, %(data_origin)s,
    %(asr_payload)s, %(recommendability)s
)
"""

SELECT_SQL = """
SELECT entity_id, payment_completed
FROM aya_registry
WHERE entity_id = %(entity_id)s
"""

DELETE_SQL = """
DELETE FROM aya_registry
WHERE entity_id = %(entity_id)s
  AND data_origin = 'AYA-BOT'
"""


def push_records(records: list) -> None:
    """Push a list of aya_entity dicts to local Postgres in batches of 50."""
    conn = get_pg_connection()
    cur = conn.cursor()

    total = len(records)
    success = 0
    skipped = 0
    errors = 0

    try:
        for batch_start in range(0, total, BATCH_SIZE):
            batch = records[batch_start: batch_start + BATCH_SIZE]

            for record in batch:
                entity = record_to_aya_entity(record)
                i = batch_start + batch.index(record) + 1
                name = entity["display_name"][:40]

                try:
                    # PROTECT: never overwrite paying customers
                    cur.execute(SELECT_SQL, {"entity_id": entity["entity_id"]})
                    existing = cur.fetchone()

                    if existing and existing[1]:  # payment_completed = True
                        print(f"[{i}/{total}] PROTECTED: {name} (paying customer — skipped)")
                        skipped += 1
                        continue

                    # Delete existing bot entry (safe: AYA-BOT only)
                    cur.execute(DELETE_SQL, {"entity_id": entity["entity_id"]})

                    # Build params — wrap JSONB columns with psycopg2 Json adapter
                    params = {**entity}
                    params["asr_payload"] = Json(entity["asr_payload"])
                    params["recommendability"] = Json(entity["recommendability"])

                    cur.execute(INSERT_SQL, params)

                    print(f"[{i}/{total}] OK: {name} (score={entity['asr_score']})")
                    success += 1

                except Exception as e:
                    error_msg = str(e)
                    conn.rollback()
                    if "duplicate" in error_msg.lower() or "unique" in error_msg.lower():
                        print(f"[{i}/{total}] EXISTS: {name}")
                        skipped += 1
                    else:
                        print(f"[{i}/{total}] ERROR: {name} — {error_msg[:120]}")
                        errors += 1

            # Commit the whole batch at once, then sleep before the next batch
            try:
                conn.commit()
            except Exception as e:
                print(f"  BATCH COMMIT ERROR: {e}")
                conn.rollback()
                errors += len(batch)

            if batch_start + BATCH_SIZE < total:
                time.sleep(BATCH_DELAY)

    finally:
        cur.close()
        conn.close()

    print(f"\n=== Done: {success} pushed, {skipped} skipped, {errors} errors ===")


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

def main() -> None:
    args = parse_args()
    dry_run: bool = args["dry_run"]
    min_score: int = args["min_score"]
    limit = args["limit"]

    records = load_all_records()
    print(f"=== AYA Push (local PG) — {len(records)} records loaded ===")

    if min_score > 0:
        records = [r for r in records if r.get("aoi_readiness", {}).get("estimated_aio_score", 0) >= min_score]
        print(f"  Filtered to {len(records)} with score >= {min_score}")

    if limit is not None:
        records = records[:limit]
        print(f"  Limited to first {len(records)} records")

    if dry_run:
        print("\n[DRY RUN] Would push these entities:\n")
        for r in records[:10]:
            entity = record_to_aya_entity(r)
            print(f"  {entity['display_name'][:40]:40s} | score={entity['asr_score']:3} | {entity['country_legal']:2s} | {entity['sector_macro']}")
        if len(records) > 10:
            print(f"  ... and {len(records) - 10} more")
        print(f"\nTotal: {len(records)} entities")
        return

    push_records(records)


if __name__ == "__main__":
    main()
