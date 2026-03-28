"""
Fix bot entity scores: cap ALL bot entities at 50/100.
Bot entities (payment_completed=false) NEVER have ASR files — ASR is only
generated for paying clients. Per the AIO Bible, no ASR → max 50.

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


MAX_BOT_SCORE = 50


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    print(f"=== Fix Bot Scores — Cap ALL bot entities at {MAX_BOT_SCORE}/100 ===")
    print("(Bot entities never have ASR files → always capped)")
    if args.dry_run:
        print("DRY RUN\n")

    # Fetch all bot entities with score > MAX_BOT_SCORE
    all_entities = []
    offset = 0
    while True:
        batch = sb.table("aya_registry").select(
            "entity_id,display_name,asr_score"
        ).eq("payment_completed", False).gt("asr_score", MAX_BOT_SCORE).range(offset, offset + 999).execute()
        all_entities.extend(batch.data or [])
        if len(batch.data or []) < 1000:
            break
        offset += 1000

    print(f"Bot entities with score > {MAX_BOT_SCORE}: {len(all_entities)}")

    capped = 0

    for entity in all_entities:
        score = entity.get("asr_score") or 0
        eid = entity["entity_id"]
        name = (entity.get("display_name") or "?")[:40]

        if not args.dry_run:
            sb.table("aya_registry").update({"asr_score": MAX_BOT_SCORE}).eq("entity_id", eid).execute()
        print(f"  CAP {name}: {score} → {MAX_BOT_SCORE}")
        capped += 1

    print(f"\n=== Done: {capped} entities capped to {MAX_BOT_SCORE} ===")


if __name__ == "__main__":
    main()
