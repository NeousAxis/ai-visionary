"""
Append Postgres VPS entities to the existing HuggingFace dataset.

Reads Postgres VPS (aya_local.aya_registry, ~25860 Tranco scraped entities),
downloads the current aya_business_dataset.csv + .jsonl from HF Hub,
appends new rows (dedup by entity_id), and re-uploads.

Usage:
    python3 export_huggingface_vps.py            # dry-run (writes to aya/exports/*_appended.*)
    python3 export_huggingface_vps.py --apply    # upload to HF Hub

Requires (in ../.env.local):
    HF_TOKEN
    VPS_PG_HOST, VPS_PG_PORT, VPS_PG_DB, VPS_PG_USER, VPS_PG_PASSWORD

Must run on the VPS (Postgres is localhost-only).
"""

import argparse
import csv
import json
import os
import sys

try:
    import psycopg2
    import psycopg2.extras
except ImportError:
    print("ERROR: psycopg2-binary not installed. Run: pip install psycopg2-binary")
    sys.exit(1)

try:
    from huggingface_hub import HfApi, hf_hub_download
except ImportError:
    print("ERROR: huggingface_hub not installed. Run: pip install huggingface_hub")
    sys.exit(1)

# Reuse extraction functions from the Supabase exporter for schema consistency
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from export_huggingface import (  # noqa: E402
    entity_to_csv_row,
    entity_to_jsonl_row,
)

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_DIR = os.path.dirname(SCRIPT_DIR)
EXPORT_DIR = os.path.join(SCRIPT_DIR, "exports")
ENV_FILE = os.path.join(PROJECT_DIR, ".env.local")

HF_REPO_ID = "NeousAxis/aya-business-dataset"
HF_REPO_TYPE = "dataset"
CSV_NAME = "aya_business_dataset.csv"
JSONL_NAME = "aya_business_dataset.jsonl"

CSV_FIELDS = [
    "name", "website", "country", "sector", "entity_type",
    "aio_score", "certified", "keywords", "source", "url",
]


def load_env():
    if not os.path.exists(ENV_FILE):
        print(f"ERROR: {ENV_FILE} not found")
        sys.exit(1)
    needed = {"HF_TOKEN", "VPS_PG_HOST", "VPS_PG_PORT", "VPS_PG_DB", "VPS_PG_USER", "VPS_PG_PASSWORD"}
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


def fetch_vps_entities() -> list:
    conn = psycopg2.connect(
        host=os.environ["VPS_PG_HOST"],
        port=int(os.environ.get("VPS_PG_PORT", "5432")),
        dbname=os.environ["VPS_PG_DB"],
        user=os.environ["VPS_PG_USER"],
        password=os.environ["VPS_PG_PASSWORD"],
    )
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(
                """
                SELECT
                    entity_id, display_name, legal_name, website, country_legal,
                    sector_macro, entity_type, asr_score, payment_completed,
                    asr_payload, data_origin, contact_email
                FROM aya_registry
                WHERE asr_score >= 20
                """
            )
            rows = cur.fetchall()
    finally:
        conn.close()
    return [dict(r) for r in rows]


def load_hf_existing_entity_ids(token: str) -> set:
    """Download the current JSONL from HF and extract entity_ids."""
    print(f"Downloading {JSONL_NAME} from HF Hub...")
    jsonl_path = hf_hub_download(
        repo_id=HF_REPO_ID,
        filename=JSONL_NAME,
        repo_type=HF_REPO_TYPE,
        token=token,
    )
    ids = set()
    with open(jsonl_path, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                obj = json.loads(line)
                eid = obj.get("entity_id")
                if eid:
                    ids.add(eid)
            except json.JSONDecodeError:
                continue
    return ids, jsonl_path


def download_existing_csv(token: str) -> str:
    print(f"Downloading {CSV_NAME} from HF Hub...")
    return hf_hub_download(
        repo_id=HF_REPO_ID,
        filename=CSV_NAME,
        repo_type=HF_REPO_TYPE,
        token=token,
    )


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--apply", action="store_true", help="Upload to HF (default: dry-run)")
    args = parser.parse_args()

    print("=" * 60)
    print("AYA Registry VPS -> HuggingFace (append mode)")
    print(f"Mode: {'APPLY (upload)' if args.apply else 'DRY-RUN (local files only)'}")
    print("=" * 60)

    load_env()
    token = os.environ.get("HF_TOKEN", "")
    if not token:
        print("ERROR: HF_TOKEN missing in .env.local")
        sys.exit(1)

    print("\nFetching VPS entities (asr_score >= 20)...")
    vps_entities = fetch_vps_entities()
    print(f"  VPS rows: {len(vps_entities)}")

    print("\nLoading existing entity_ids from HF dataset...")
    existing_ids, jsonl_path_local = load_hf_existing_entity_ids(token)
    csv_path_local = download_existing_csv(token)
    print(f"  HF existing entity_ids: {len(existing_ids)}")

    new_csv_rows = []
    new_jsonl_rows = []
    duplicates = 0

    for entity in vps_entities:
        eid = entity.get("entity_id")
        if not eid:
            continue
        eid_str = str(eid)
        if eid_str in existing_ids:
            duplicates += 1
            continue
        new_csv_rows.append(entity_to_csv_row(entity))
        new_jsonl_rows.append(entity_to_jsonl_row(entity))

    print(f"\n  New rows to append: {len(new_csv_rows)}")
    print(f"  Duplicates skipped: {duplicates}")

    if not new_csv_rows:
        print("\nNothing to append. Exiting.")
        sys.exit(0)

    os.makedirs(EXPORT_DIR, exist_ok=True)
    out_csv = os.path.join(EXPORT_DIR, "aya_business_dataset_appended.csv")
    out_jsonl = os.path.join(EXPORT_DIR, "aya_business_dataset_appended.jsonl")

    # Build merged CSV: existing content + new rows (without re-writing header)
    with open(csv_path_local, "r", encoding="utf-8") as fin, open(out_csv, "w", encoding="utf-8", newline="") as fout:
        fout.write(fin.read().rstrip("\n") + "\n")
        writer = csv.DictWriter(fout, fieldnames=CSV_FIELDS)
        for row in new_csv_rows:
            writer.writerow(row)

    # Build merged JSONL: existing + new rows
    with open(jsonl_path_local, "r", encoding="utf-8") as fin, open(out_jsonl, "w", encoding="utf-8") as fout:
        for line in fin:
            line = line.rstrip("\n")
            if line:
                fout.write(line + "\n")
        for row in new_jsonl_rows:
            fout.write(json.dumps(row, ensure_ascii=False) + "\n")

    csv_size = os.path.getsize(out_csv)
    jsonl_size = os.path.getsize(out_jsonl)
    print(f"\nLocal merged files:")
    print(f"  {out_csv}  ({csv_size:,} bytes)")
    print(f"  {out_jsonl}  ({jsonl_size:,} bytes)")

    if not args.apply:
        print("\nDRY-RUN: not uploading. Re-run with --apply to push to HF Hub.")
        return

    print("\nUploading to HF Hub...")
    api = HfApi(token=token)
    api.upload_file(
        path_or_fileobj=out_csv,
        path_in_repo=CSV_NAME,
        repo_id=HF_REPO_ID,
        repo_type=HF_REPO_TYPE,
        commit_message=f"Append {len(new_csv_rows)} VPS entities (Tranco scrape)",
    )
    print(f"  ✓ {CSV_NAME} uploaded")
    api.upload_file(
        path_or_fileobj=out_jsonl,
        path_in_repo=JSONL_NAME,
        repo_id=HF_REPO_ID,
        repo_type=HF_REPO_TYPE,
        commit_message=f"Append {len(new_jsonl_rows)} VPS entities (Tranco scrape)",
    )
    print(f"  ✓ {JSONL_NAME} uploaded")
    print(f"\nDone. Dataset now has ~{len(existing_ids) + len(new_jsonl_rows)} entities.")


if __name__ == "__main__":
    main()
