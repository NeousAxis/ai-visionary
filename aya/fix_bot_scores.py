"""
Fix bot entity scores: apply the real AIO hard caps.
- No JSON-LD + no AYA certification → max 50
- No ASR → max 90
Only affects bot-indexed entities (payment_completed=false).

Usage:
    python3 fix_bot_scores.py --dry-run    # Preview
    python3 fix_bot_scores.py              # Apply fixes
"""

import os, sys, json, argparse

with open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".env.local"), "r") as f:
    for line in f:
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            key, _, value = line.partition("=")
            os.environ.setdefault(key.strip(), value.strip().strip('"'))

from supabase import create_client

sb = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_ROLE_KEY"])


def has_jsonld(entity):
    payload = entity.get("asr_payload") or {}
    data = payload.get("data") or payload
    # Check source scan data
    source = data.get("source") or {}
    scan = source.get("scan") or source.get("structured_data_found") or {}
    if scan.get("jsonld_found") or scan.get("has_jsonld"):
        return True
    # Check structure_technique block
    tech = data.get("structure_technique") or data.get("aio_blocks", {}).get("structure_technique", {})
    fields = tech.get("fields") or tech
    if fields.get("has_jsonld", {}).get("value") if isinstance(fields.get("has_jsonld"), dict) else fields.get("has_jsonld"):
        return True
    return False


def has_asr(entity):
    payload = entity.get("asr_payload") or {}
    data = payload.get("data") or payload
    source = data.get("source") or {}
    scan = source.get("scan") or source.get("structured_data_found") or {}
    if scan.get("has_asr") or scan.get("asr_found"):
        return True
    tech = data.get("structure_technique") or data.get("aio_blocks", {}).get("structure_technique", {})
    fields = tech.get("fields") or tech
    if fields.get("has_asr", {}).get("value") if isinstance(fields.get("has_asr"), dict) else fields.get("has_asr"):
        return True
    return False


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    print("=== Fix Bot Scores — Apply AIO Hard Caps ===")
    if args.dry_run:
        print("DRY RUN\n")

    # Fetch all bot entities
    all_entities = []
    offset = 0
    while True:
        batch = sb.table("aya_registry").select(
            "entity_id,display_name,asr_score,payment_completed,asr_payload"
        ).eq("payment_completed", False).range(offset, offset + 999).execute()
        all_entities.extend(batch.data or [])
        if len(batch.data or []) < 1000:
            break
        offset += 1000

    print(f"Bot entities: {len(all_entities)}")

    capped = 0
    unchanged = 0

    for entity in all_entities:
        score = entity.get("asr_score") or 0
        eid = entity["entity_id"]
        name = (entity.get("display_name") or "?")[:40]

        jsonld = has_jsonld(entity)
        asr = has_asr(entity)

        # Apply hard caps
        max_score = 100
        cap_reason = None

        if not jsonld:
            # No JSON-LD → max 50 (regardless of AYA status since bot = no AYA)
            max_score = 50
            cap_reason = "no JSON-LD"
        elif not asr:
            max_score = 90
            cap_reason = "no ASR"

        if score > max_score:
            new_score = max_score
            if not args.dry_run:
                sb.table("aya_registry").update({"asr_score": new_score}).eq("entity_id", eid).execute()
            print(f"  CAP {name}: {score} → {new_score} ({cap_reason})")
            capped += 1
        else:
            unchanged += 1

    print(f"\n=== Done: {capped} capped, {unchanged} unchanged ===")


if __name__ == "__main__":
    main()
