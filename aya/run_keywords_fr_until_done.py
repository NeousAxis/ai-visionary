"""
Run enrich_keywords_fr.py in a loop until ALL entities have gemini_keywords_fr.
Handles Gemini rate limits by waiting and retrying.

Usage: python3 run_keywords_fr_until_done.py
"""

import subprocess
import sys
import time
import os

SCRIPT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "enrich_keywords_fr.py")
MAX_ROUNDS = 20
WAIT_BETWEEN_ROUNDS = 60  # seconds


def count_remaining():
    """Query Supabase for entities still missing FR keywords."""
    from dotenv import load_dotenv
    load_dotenv(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".env.local"))
    from supabase import create_client
    sb = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_ROLE_KEY"])

    has_fr = 0
    no_fr = 0
    offset = 0
    while True:
        batch = sb.table("aya_registry").select("asr_payload").range(offset, offset + 999).execute()
        if not batch.data:
            break
        for e in batch.data:
            enr = (e.get("asr_payload") or {}).get("enrichment") or {}
            if enr.get("gemini_keywords_fr"):
                has_fr += 1
            elif enr.get("gemini_keywords"):
                no_fr += 1
        offset += 1000
    return has_fr, no_fr


def main():
    print("=== Keywords FR — Run Until Done ===\n")

    for round_num in range(1, MAX_ROUNDS + 1):
        has_fr, no_fr = count_remaining()
        total = has_fr + no_fr
        pct = has_fr * 100 // total if total else 0
        print(f"Round {round_num}/{MAX_ROUNDS} — {has_fr}/{total} done ({pct}%), {no_fr} remaining")

        if no_fr == 0:
            print(f"\n✅ ALL DONE! {has_fr}/{total} entities have FR keywords.")
            return

        print(f"  Running enrich_keywords_fr.py...\n")
        result = subprocess.run(
            [sys.executable, SCRIPT],
            cwd=os.path.dirname(os.path.abspath(__file__)),
        )

        if result.returncode != 0:
            print(f"  Script exited with code {result.returncode}")

        if round_num < MAX_ROUNDS:
            print(f"\n  Waiting {WAIT_BETWEEN_ROUNDS}s before next round...\n")
            time.sleep(WAIT_BETWEEN_ROUNDS)

    # Final check
    has_fr, no_fr = count_remaining()
    total = has_fr + no_fr
    pct = has_fr * 100 // total if total else 0
    print(f"\n=== Final: {has_fr}/{total} ({pct}%), {no_fr} still missing ===")
    if no_fr > 0:
        print("⚠️ Max rounds reached. Run again later.")


if __name__ == "__main__":
    main()
