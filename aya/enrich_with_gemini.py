"""
Enrich AYA entities with real descriptions using Gemini Flash.
Only processes entities that DON'T already have a gemini_description.
Uses UPDATE (not DELETE+INSERT) — safe, no data loss.

Usage:
    python enrich_with_gemini.py
"""

import os, sys, json, time, re
from urllib.parse import urlparse

with open("/Users/cyrilleger/AI VISIONARY/.env.local", "r") as f:
    for line in f:
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            key, _, value = line.partition("=")
            os.environ[key.strip()] = value.strip().strip('"')

from supabase import create_client
import google.generativeai as genai

genai.configure(api_key=os.environ["GEMINI_API_KEY"])
model = genai.GenerativeModel("gemini-2.0-flash")
sb = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_ROLE_KEY"])


def domain_from_url(url):
    try:
        parsed = urlparse(url if url.startswith("http") else f"https://{url}")
        return (parsed.hostname or "").replace("www.", "")
    except:
        return url


def has_gemini_description(entity):
    """Check if entity already has a Gemini description."""
    payload = entity.get("asr_payload") or {}
    if isinstance(payload, str):
        try: payload = json.loads(payload)
        except: return False
    enrichment = payload.get("enrichment") or {}
    if isinstance(enrichment, str):
        try: enrichment = json.loads(enrichment)
        except: return False
    desc = enrichment.get("gemini_description") or ""
    return len(str(desc)) > 10


def enrich_batch(entities):
    """Send batch to Gemini, return list of descriptions."""
    lines = []
    for i, e in enumerate(entities):
        name = e.get("display_name") or domain_from_url(e.get("website", ""))
        domain = domain_from_url(e.get("website", ""))
        sector = e.get("sector_macro", "")
        country = e.get("country_legal", "")
        lines.append(f"{i+1}. {name} | {domain} | {sector} | {country}")

    prompt = f"""For each company below, write exactly ONE sentence in English describing what they do.
Be specific and factual. No marketing language.

Companies:
{chr(10).join(lines)}

Return ONLY a JSON array of strings. Example: ["Desc 1.", "Desc 2."]"""

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
                print(f"  ⏳ Rate limit 429 — retry in {wait}s (attempt {attempt+1}/3)")
                time.sleep(wait)
                continue
            print(f"  ERROR Gemini: {ex}")
            time.sleep(5)
            return [None] * len(entities)


def main():
    print("=== Gemini Enrichment ===")

    # Fetch all entities (only entity_id + asr_payload for filtering)
    print("Fetching all entities...")
    all_entities = []
    offset = 0
    while True:
        batch = sb.table("aya_registry").select("entity_id,display_name,legal_name,website,sector_macro,country_legal,asr_payload").range(offset, offset + 999).execute()
        all_entities.extend(batch.data or [])
        if len(batch.data or []) < 1000: break
        offset += 1000
        print(f"  {len(all_entities)} loaded...")

    # Filter: ONLY entities without gemini_description
    needs = [e for e in all_entities if not has_gemini_description(e)]
    done = len(all_entities) - len(needs)
    print(f"Total: {len(all_entities)} | Already done: {done} | Need enrichment: {len(needs)}")

    if not needs:
        print("Nothing to do!")
        return

    BATCH_SIZE = 20
    enriched = 0
    failed = 0

    for i in range(0, len(needs), BATCH_SIZE):
        batch = needs[i:i + BATCH_SIZE]
        bn = i // BATCH_SIZE + 1
        tb = (len(needs) + BATCH_SIZE - 1) // BATCH_SIZE
        print(f"\nBatch {bn}/{tb} ({len(batch)} entities)...")

        descriptions = enrich_batch(batch)

        for entity, desc in zip(batch, descriptions):
            if not desc:
                failed += 1
                continue

            domain = domain_from_url(entity.get("website", ""))
            eid = entity["entity_id"]

            # Build updated payload
            payload = entity.get("asr_payload") or {}
            if isinstance(payload, str):
                try: payload = json.loads(payload)
                except: payload = {}
            if "enrichment" not in payload:
                payload["enrichment"] = {}
            payload["enrichment"]["gemini_description"] = desc
            payload["enrichment"]["enriched_at"] = time.strftime("%Y-%m-%dT%H:%M:%SZ")

            # UPDATE — safe, no data loss
            try:
                sb.table("aya_registry").update({"asr_payload": payload}).eq("entity_id", eid).execute()
                print(f"  OK {domain}: {desc[:60]}")
                enriched += 1
            except Exception as ex:
                print(f"  FAIL {domain}: {ex}")
                failed += 1

        time.sleep(4)

    print(f"\n=== Done: {enriched} enriched, {failed} failed ===")


if __name__ == "__main__":
    main()
