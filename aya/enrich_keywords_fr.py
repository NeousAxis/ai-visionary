"""
Translate English business keywords to French for all AYA entities.
Only processes entities that have gemini_keywords but NOT gemini_keywords_fr.
Uses UPDATE (not DELETE+INSERT) — safe, no data loss.

Usage:
    cd ~/AI\ VISIONARY/aya && python3 enrich_keywords_fr.py
    cd ~/AI\ VISIONARY/aya && python3 enrich_keywords_fr.py --dry-run
    cd ~/AI\ VISIONARY/aya && python3 enrich_keywords_fr.py --limit 50

Requires: GOOGLE_GENERATIVE_AI_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY in ../.env.local
"""

import os, sys, json, time, re, argparse
from urllib.parse import urlparse

# Load env from ../.env.local
with open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".env.local"), "r") as f:
    for line in f:
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            key, _, value = line.partition("=")
            os.environ.setdefault(key.strip(), value.strip().strip('"'))

from supabase import create_client
import google.generativeai as genai

# Support both env var names
api_key = os.environ.get("GOOGLE_GENERATIVE_AI_API_KEY") or os.environ.get("GEMINI_API_KEY")
if not api_key:
    print("ERROR: No Gemini API key found (GOOGLE_GENERATIVE_AI_API_KEY or GEMINI_API_KEY)")
    sys.exit(1)

genai.configure(api_key=api_key)
model = genai.GenerativeModel("gemini-2.0-flash")
sb = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_ROLE_KEY"])


def domain_from_url(url):
    try:
        parsed = urlparse(url if url.startswith("http") else f"https://{url}")
        return (parsed.hostname or "").replace("www.", "")
    except:
        return url


def get_enrichment(entity):
    """Extract the enrichment dict from an entity's asr_payload."""
    payload = entity.get("asr_payload") or {}
    if isinstance(payload, str):
        try: payload = json.loads(payload)
        except: payload = {}
    enrichment = payload.get("enrichment") or {}
    if isinstance(enrichment, str):
        try: enrichment = json.loads(enrichment)
        except: enrichment = {}
    return enrichment


def needs_fr_keywords(entity):
    """True if entity has gemini_keywords but NOT gemini_keywords_fr."""
    enrichment = get_enrichment(entity)
    has_en = enrichment.get("gemini_keywords") and len(enrichment["gemini_keywords"]) > 0
    has_fr = enrichment.get("gemini_keywords_fr") and len(enrichment["gemini_keywords_fr"]) > 0
    return has_en and not has_fr


def translate_batch(entities):
    """Send batch to Gemini for FR keyword translation, return list of keyword arrays."""
    lines = []
    for i, e in enumerate(entities):
        enrichment = get_enrichment(e)
        keywords_en = enrichment.get("gemini_keywords", [])
        name = e.get("display_name") or domain_from_url(e.get("website", ""))
        lines.append(f'{i+1}. {name}: {json.dumps(keywords_en, ensure_ascii=False)}')

    prompt = f"""Translate each company's English business keywords to French.
Adapt to French business vocabulary — do NOT translate literally.
Use natural French terms that professionals would search for.
Keep the same number of keywords per company.

Companies and their English keywords:
{chr(10).join(lines)}

Return ONLY a JSON array of arrays of strings. Example: [["mot-cle1", "mot-cle2"], ["mot-cle3", "mot-cle4"]]"""

    for attempt in range(3):
        try:
            response = model.generate_content(prompt)
            text = response.text.strip()
            match = re.search(r'\[.*\]', text, re.DOTALL)
            if match:
                return json.loads(match.group())
            return [None] * len(entities)
        except Exception as ex:
            if "429" in str(ex) and attempt < 2:
                wait = 30 * (attempt + 1)
                print(f"  Rate limit 429 — retry in {wait}s (attempt {attempt+1}/3)", flush=True)
                time.sleep(wait)
                continue
            print(f"  ERROR Gemini: {ex}", flush=True)
            time.sleep(5)
            return [None] * len(entities)


def main():
    parser = argparse.ArgumentParser(description="Translate EN keywords to FR for AYA entities")
    parser.add_argument("--dry-run", action="store_true", help="Preview without writing to Supabase")
    parser.add_argument("--limit", type=int, default=0, help="Process only N entities (0 = all)")
    args = parser.parse_args()

    print("=== Gemini Keywords EN -> FR Translation ===")
    if args.dry_run:
        print("DRY RUN — no writes to Supabase")

    # Fetch all entities (paginated)
    print("Fetching all entities...", flush=True)
    all_entities = []
    offset = 0
    while True:
        batch = sb.table("aya_registry").select(
            "entity_id,display_name,legal_name,website,asr_payload"
        ).range(offset, offset + 999).execute()
        all_entities.extend(batch.data or [])
        if len(batch.data or []) < 1000:
            break
        offset += 1000
        print(f"  {len(all_entities)} loaded...", flush=True)

    # Filter: only entities with EN keywords but no FR keywords
    needs = [e for e in all_entities if needs_fr_keywords(e)]
    done_count = len(all_entities) - len(needs)
    print(f"Total: {len(all_entities)} | Already translated: {done_count} | Need FR keywords: {len(needs)}", flush=True)

    if not needs:
        print("Nothing to do!")
        return

    if args.limit > 0:
        needs = needs[:args.limit]
        print(f"Limited to {args.limit} entities", flush=True)

    BATCH_SIZE = 20
    translated = 0
    failed = 0

    for i in range(0, len(needs), BATCH_SIZE):
        batch = needs[i:i + BATCH_SIZE]
        bn = i // BATCH_SIZE + 1
        tb = (len(needs) + BATCH_SIZE - 1) // BATCH_SIZE
        print(f"\nBatch {bn}/{tb} ({len(batch)} entities)...", flush=True)

        results = translate_batch(batch)

        for entity, kws_fr in zip(batch, results):
            if not kws_fr or not isinstance(kws_fr, list):
                failed += 1
                continue

            name = entity.get("display_name") or domain_from_url(entity.get("website", ""))
            eid = entity["entity_id"]

            # Build updated payload
            payload = entity.get("asr_payload") or {}
            if isinstance(payload, str):
                try: payload = json.loads(payload)
                except: payload = {}
            if "enrichment" not in payload:
                payload["enrichment"] = {}
            payload["enrichment"]["gemini_keywords_fr"] = kws_fr
            payload["enrichment"]["keywords_fr_at"] = time.strftime("%Y-%m-%dT%H:%M:%SZ")

            print(f"  [{translated + failed + 1}/{len(needs)}] {name}: {', '.join(kws_fr[:5])}", flush=True)

            if args.dry_run:
                translated += 1
                continue

            # UPDATE — safe, no data loss
            try:
                sb.table("aya_registry").update({"asr_payload": payload}).eq("entity_id", eid).execute()
                translated += 1
            except Exception as ex:
                print(f"  FAIL {name}: {ex}", flush=True)
                failed += 1

        time.sleep(4)

    print(f"\n=== Done: {translated} translated, {failed} failed ===", flush=True)


if __name__ == "__main__":
    main()
