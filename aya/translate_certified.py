"""
Translation agent for CERTIFIED entities only.
Generates faithful bilingual descriptions (EN+FR) + keywords from the client's actual data.
NOT generic Gemini summaries — faithful translations preserving exact business terminology.

For bot-indexed entities, descriptions remain approximate (they must register to get accurate data).

Usage:
    python3 translate_certified.py              # Process all certified entities
    python3 translate_certified.py --dry-run    # Preview without writing
    python3 translate_certified.py --force      # Re-translate even if already done
    python3 translate_certified.py --entity ID  # Translate a specific entity
"""

import os, sys, json, time, re, argparse

# Load env
with open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".env.local"), "r") as f:
    for line in f:
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            key, _, value = line.partition("=")
            os.environ.setdefault(key.strip(), value.strip().strip('"'))

from supabase import create_client
import google.generativeai as genai

api_key = os.environ.get("GOOGLE_GENERATIVE_AI_API_KEY") or os.environ.get("GEMINI_API_KEY")
if not api_key:
    print("ERROR: Missing GEMINI API key"); sys.exit(1)

genai.configure(api_key=api_key)
model = genai.GenerativeModel("gemini-2.0-flash")

sb = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_ROLE_KEY"])


def extract_client_data(entity):
    """Extract the real client data from the entity's asr_payload."""
    payload = entity.get("asr_payload") or {}
    data = payload.get("data") or payload
    fields = data.get("fields") or data

    name = entity.get("display_name") or entity.get("legal_name") or ""
    business_type = ""
    services = []
    audience = ""
    location = entity.get("country_legal") or ""

    # Try to get from structured fields
    if isinstance(fields, dict):
        id_block = fields.get("identite") or {}
        offer_block = fields.get("offre") or {}

        bt = id_block.get("business_type")
        if isinstance(bt, dict):
            business_type = bt.get("value") or ""
        elif isinstance(bt, str):
            business_type = bt

        svc = offer_block.get("services")
        if isinstance(svc, dict):
            v = svc.get("value")
            services = v if isinstance(v, list) else []
        elif isinstance(svc, list):
            services = svc

        aud = offer_block.get("target_audience")
        if isinstance(aud, dict):
            v = aud.get("value")
            audience = v if isinstance(v, str) else (", ".join(v) if isinstance(v, list) else "")
        elif isinstance(aud, str):
            audience = aud

    return {
        "name": name,
        "business_type": business_type,
        "services": services,
        "audience": audience,
        "location": location,
    }


def translate_entity(client_data):
    """Call Gemini to generate faithful bilingual descriptions + keywords."""
    context_parts = [
        f"Name: {client_data['name']}" if client_data["name"] else "",
        f"Business type: {client_data['business_type']}" if client_data["business_type"] else "",
        f"Services: {', '.join(client_data['services'])}" if client_data["services"] else "",
        f"Audience: {client_data['audience']}" if client_data["audience"] else "",
        f"Location: {client_data['location']}" if client_data["location"] else "",
    ]
    context = "\n".join(p for p in context_parts if p)

    if not context.strip():
        return None

    prompt = f"""You are a professional business translator. Given this company information:

{context}

Generate a JSON object with exactly 4 fields:
1. "description_en": A faithful 1-2 sentence description in English. Do NOT simplify or generalize — preserve the exact business terminology and specialization.
2. "description_fr": A faithful 1-2 sentence description in French. Same rule — preserve exact terminology.
3. "keywords_en": An array of 6-8 English business keywords for this company.
4. "keywords_fr": An array of 6-8 French business keywords (adapted to French business vocabulary, not literal translations).

IMPORTANT: These descriptions will be read by AI systems to recommend this company. They must be accurate and specific, not generic summaries.

Return ONLY valid JSON, no markdown."""

    for attempt in range(3):
        try:
            response = model.generate_content(prompt)
            text = response.text.strip()
            match = re.search(r'\{[\s\S]*\}', text)
            if match:
                parsed = json.loads(match.group())
                return {
                    "gemini_description": parsed.get("description_en", ""),
                    "gemini_description_fr": parsed.get("description_fr", ""),
                    "gemini_keywords": parsed.get("keywords_en", []),
                    "gemini_keywords_fr": parsed.get("keywords_fr", []),
                }
            return None
        except Exception as ex:
            if "429" in str(ex) and attempt < 2:
                wait = 30 * (attempt + 1)
                print(f"    Rate limit — retry in {wait}s", flush=True)
                time.sleep(wait)
                continue
            print(f"    ERROR: {ex}", flush=True)
            return None


def main():
    parser = argparse.ArgumentParser(description="Translate certified entities faithfully")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--force", action="store_true", help="Re-translate even if already done")
    parser.add_argument("--entity", type=str, help="Translate a specific entity by ID")
    args = parser.parse_args()

    print("=== Certified Entity Translation Agent ===")
    if args.dry_run:
        print("DRY RUN — no writes\n")

    # Fetch certified entities
    if args.entity:
        result = sb.table("aya_registry").select("*").eq("entity_id", args.entity).execute()
    else:
        result = sb.table("aya_registry").select("*").eq("payment_completed", True).execute()

    entities = result.data or []
    print(f"Certified entities: {len(entities)}\n")

    translated = 0
    skipped = 0
    failed = 0

    for i, entity in enumerate(entities, 1):
        name = entity.get("display_name") or entity.get("legal_name") or "?"
        eid = entity["entity_id"]
        enrichment = (entity.get("asr_payload") or {}).get("enrichment") or {}

        # PROTECT: Never overwrite manually-set descriptions
        if enrichment.get("translation_source") == "manual":
            print(f"[{i}/{len(entities)}] PROTECTED {name} (manually set — never overwrite)")
            skipped += 1
            continue

        # Skip if already has faithful translations (unless --force)
        has_en = bool(enrichment.get("gemini_description"))
        has_fr = bool(enrichment.get("gemini_description_fr"))
        has_kw_en = bool(enrichment.get("gemini_keywords"))
        has_kw_fr = bool(enrichment.get("gemini_keywords_fr"))

        if has_en and has_fr and has_kw_en and has_kw_fr and not args.force:
            print(f"[{i}/{len(entities)}] SKIP {name} (already complete)")
            skipped += 1
            continue

        # Extract client data
        client_data = extract_client_data(entity)
        print(f"[{i}/{len(entities)}] {name}")
        print(f"    Type: {client_data['business_type'][:60] or 'N/A'}")
        print(f"    Services: {', '.join(client_data['services'][:3]) or 'N/A'}")

        if args.dry_run:
            translated += 1
            continue

        # Generate translations
        result = translate_entity(client_data)
        if not result or not result["gemini_description"]:
            print(f"    FAILED — no translation generated")
            failed += 1
            continue

        # Update Supabase
        payload = entity.get("asr_payload") or {}
        if "enrichment" not in payload:
            payload["enrichment"] = {}
        payload["enrichment"]["gemini_description"] = result["gemini_description"]
        payload["enrichment"]["gemini_description_fr"] = result["gemini_description_fr"]
        payload["enrichment"]["gemini_keywords"] = result["gemini_keywords"]
        payload["enrichment"]["gemini_keywords_fr"] = result["gemini_keywords_fr"]
        payload["enrichment"]["enriched_at"] = time.strftime("%Y-%m-%dT%H:%M:%SZ")
        payload["enrichment"]["translation_source"] = "certified_agent"

        try:
            sb.table("aya_registry").update({"asr_payload": payload}).eq("entity_id", eid).execute()
            print(f"    EN: {result['gemini_description'][:80]}")
            print(f"    FR: {result['gemini_description_fr'][:80]}")
            translated += 1
        except Exception as ex:
            print(f"    SAVE FAILED: {ex}")
            failed += 1

        time.sleep(2)  # Rate limit protection

    print(f"\n=== Done: {translated} translated, {skipped} skipped, {failed} failed ===")


if __name__ == "__main__":
    main()
