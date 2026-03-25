"""
Enrich AYA entities with real descriptions using Gemini Flash.
Replaces garbage "api, app, cloud" with actual 1-sentence descriptions.

Usage:
    python enrich_with_gemini.py              # Enrich all entities missing good descriptions
    python enrich_with_gemini.py --limit 50   # Enrich first 50 only (test)
    python enrich_with_gemini.py --dry-run    # Preview without writing to DB

Cost: ~$0.01 per 1000 entities with Gemini 2.0 Flash
"""

import os, sys, json, time, re
from urllib.parse import urlparse

with open("/Users/cyrilleger/AI VISIONARY/.env.local", "r") as f:
    for line in f:
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            key, _, value = line.partition("=")
            os.environ[key.strip()] = value.strip().strip('"')

try:
    from supabase import create_client
    import google.generativeai as genai
except ImportError as e:
    print(f"ERROR: Missing dependency: {e}")
    print("Run: pip install supabase google-generativeai")
    sys.exit(1)

# ─── Config ───
GEMINI_KEY = os.environ.get("GEMINI_API_KEY", "")
if not GEMINI_KEY:
    print("ERROR: GEMINI_API_KEY not found in .env.local")
    sys.exit(1)

genai.configure(api_key=GEMINI_KEY)
model = genai.GenerativeModel("gemini-2.0-flash")

sb = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_ROLE_KEY"])

# ─── Garbage detection ───
GARBAGE_WORDS = {
    'api', 'app', 'application', 'cloud', 'service', 'services', 'platform',
    'solution', 'solutions', 'product', 'products', 'tool', 'tools',
    'software', 'website', 'web', 'online', 'digital', 'data', 'system',
    'technology', 'tech', 'information', 'management', 'support',
    'restaurant', 'hotel', 'shop', 'store', 'delivery', 'conditions',
    'offre', 'offres', 'accueil', 'connexion', 'boutique',
}

def is_garbage_description(services):
    """Check if services list is garbage (all generic words)."""
    if not services:
        return True
    clean = [s for s in services if s.lower().strip() not in GARBAGE_WORDS and len(s) > 3]
    return len(clean) == 0

def domain_from_url(url):
    try:
        parsed = urlparse(url if url.startswith("http") else f"https://{url}")
        host = parsed.hostname or ""
        return host.replace("www.", "")
    except:
        return url

# ─── Gemini batch enrichment ───
def enrich_batch(entities):
    """Send a batch of entities to Gemini for description generation."""
    if not entities:
        return []

    # Build prompt with all entities in one call (cheaper + faster)
    lines = []
    for i, e in enumerate(entities):
        name = e.get("display_name") or e.get("legal_name") or domain_from_url(e.get("website", ""))
        domain = domain_from_url(e.get("website", ""))
        sector = e.get("sector_macro", "")
        country = e.get("country_legal", "")
        lines.append(f"{i+1}. {name} | {domain} | {sector} | {country}")

    entity_list = "\n".join(lines)

    prompt = f"""For each company below, write exactly ONE sentence in English describing what they do.
Be specific and factual. No marketing language. No generic descriptions like "technology company" or "provides services".

If you know the company, describe their ACTUAL business (e.g., "Online payment processing platform for internet businesses" for Stripe).
If you don't know the company, infer from the domain name and sector what they likely do.

Format: Return ONLY a JSON array of strings, one description per company, in the same order.

Companies:
{entity_list}

Return ONLY the JSON array, nothing else. Example: ["Description 1.", "Description 2."]"""

    try:
        response = model.generate_content(prompt)
        text = response.text.strip()
        # Extract JSON array from response
        match = re.search(r'\[.*\]', text, re.DOTALL)
        if match:
            descriptions = json.loads(match.group())
            return descriptions
        else:
            print(f"  WARNING: Could not parse Gemini response")
            return [None] * len(entities)
    except Exception as ex:
        print(f"  ERROR Gemini: {ex}")
        time.sleep(2)
        return [None] * len(entities)


def main():
    dry_run = "--dry-run" in sys.argv
    limit = None
    if "--limit" in sys.argv:
        idx = sys.argv.index("--limit")
        if idx + 1 < len(sys.argv):
            limit = int(sys.argv[idx + 1])

    print(f"=== Gemini Enrichment {'(DRY RUN)' if dry_run else ''} ===")

    # Fetch all entities
    all_entities = []
    offset = 0
    while True:
        batch = sb.table("aya_registry").select("*").range(offset, offset + 999).execute()
        all_entities.extend(batch.data or [])
        if len(batch.data or []) < 1000: break
        offset += 1000

    print(f"Total entities: {len(all_entities)}")

    # Filter: entities that need enrichment (garbage or missing descriptions)
    needs_enrichment = []
    for e in all_entities:
        payload = e.get("asr_payload") or {}
        if isinstance(payload, str):
            try: payload = json.loads(payload)
            except: payload = {}
        data = payload.get("data", {})
        if isinstance(data, str):
            try: data = json.loads(data)
            except: data = {}

        services = data.get("offre", {}).get("services", {}).get("value", [])
        if isinstance(services, str): services = [services]

        if is_garbage_description(services):
            needs_enrichment.append(e)

    print(f"Need enrichment: {len(needs_enrichment)} entities")

    if limit:
        needs_enrichment = needs_enrichment[:limit]
        print(f"Limited to: {limit}")

    # Process in batches of 20 (Gemini can handle ~20 per call)
    BATCH_SIZE = 20
    enriched = 0
    failed = 0

    for i in range(0, len(needs_enrichment), BATCH_SIZE):
        batch = needs_enrichment[i:i + BATCH_SIZE]
        print(f"\nBatch {i//BATCH_SIZE + 1}/{(len(needs_enrichment) + BATCH_SIZE - 1)//BATCH_SIZE} ({len(batch)} entities)...")

        descriptions = enrich_batch(batch)

        for j, (entity, desc) in enumerate(zip(batch, descriptions)):
            if not desc:
                failed += 1
                continue

            name = entity.get("display_name") or domain_from_url(entity.get("website", ""))
            domain = domain_from_url(entity.get("website", ""))

            if dry_run:
                print(f"  [DRY] {domain}: {desc[:80]}")
                enriched += 1
                continue

            # Update asr_payload with enriched description
            payload = entity.get("asr_payload") or {}
            if isinstance(payload, str):
                try: payload = json.loads(payload)
                except: payload = {}

            if "data" not in payload:
                payload["data"] = {}
            data = payload["data"]
            if isinstance(data, str):
                try: data = json.loads(data)
                except: data = {}
                payload["data"] = data

            # Store Gemini description in a new field
            if "enrichment" not in payload:
                payload["enrichment"] = {}
            payload["enrichment"]["gemini_description"] = desc
            payload["enrichment"]["enriched_at"] = time.strftime("%Y-%m-%dT%H:%M:%SZ")

            # Write back via DELETE + INSERT (trigger workaround)
            eid = entity["entity_id"]
            try:
                sb.table("aya_registry").delete().eq("entity_id", eid).execute()
                new_row = {k: v for k, v in entity.items() if k != "website_normalized"}
                new_row["asr_payload"] = payload
                sb.table("aya_registry").insert(new_row).execute()
                print(f"  OK {domain}: {desc[:60]}")
                enriched += 1
            except Exception as ex:
                print(f"  FAIL {domain}: {ex}")
                failed += 1

        # Rate limit: 15 RPM for Gemini free tier
        if not dry_run:
            time.sleep(4)

    print(f"\n=== Done: {enriched} enriched, {failed} failed ===")


if __name__ == "__main__":
    main()
