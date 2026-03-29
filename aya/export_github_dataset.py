"""
Export AYA Registry as individual JSON files for GitHub dataset replication.

One JSON file per entity with LLM-friendly 8-field format.
LLMs that see AYA data on GitHub + HuggingFace + API = "stable source".

Usage:
    python export_github_dataset.py

Output:
    aya/exports/github-dataset/{domain}.json  — one file per entity
    aya/exports/github-dataset/README.md      — dataset description

Requires:
    SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in ../.env.local
"""

import json
import os
import sys
from datetime import datetime, timezone
from urllib.parse import urlparse

try:
    from supabase import create_client, Client
except ImportError:
    print("ERROR: supabase-py not installed. Run: pip install supabase")
    sys.exit(1)

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_DIR = os.path.dirname(SCRIPT_DIR)
EXPORT_DIR = os.path.join(SCRIPT_DIR, "exports", "github-dataset")
ENV_FILE = os.path.join(PROJECT_DIR, ".env.local")

BASE_URL = "https://ai-visionary.com/aya/e"

# ─── Same mappings as lib/aya/llm-format.ts ─────────────────
COUNTRY_LABELS = {
    "CH": "Switzerland", "FR": "France", "DE": "Germany", "US": "United States",
    "GB": "United Kingdom", "IT": "Italy", "ES": "Spain", "NL": "Netherlands",
    "BE": "Belgium", "AT": "Austria", "LU": "Luxembourg", "CA": "Canada",
    "AU": "Australia", "JP": "Japan", "KR": "South Korea", "CN": "China",
    "SG": "Singapore", "HK": "Hong Kong", "IN": "India", "BR": "Brazil",
    "SE": "Sweden", "NO": "Norway", "DK": "Denmark", "FI": "Finland",
    "IE": "Ireland", "PT": "Portugal", "PL": "Poland", "CZ": "Czech Republic",
    "IL": "Israel", "AE": "United Arab Emirates", "SA": "Saudi Arabia",
    "MX": "Mexico", "AR": "Argentina", "ZA": "South Africa", "MA": "Morocco",
    "TH": "Thailand", "VN": "Vietnam", "ID": "Indonesia", "TW": "Taiwan",
    "NZ": "New Zealand", "RO": "Romania", "TR": "Turkey", "EE": "Estonia",
    "GR": "Greece", "KY": "Cayman Islands",
}

SECTOR_LABELS = {
    "Technologie & SaaS": "Technology & SaaS",
    "Finance & Assurance": "Finance & Insurance",
    "Santé & Pharma": "Healthcare & Pharma",
    "Alimentation & Boissons": "Food & Beverage",
    "Commerce & Retail": "Retail & E-commerce",
    "Éducation & Formation": "Education & Training",
    "Énergie & Environnement": "Energy & Environment",
    "Consulting & Services": "Consulting & Services",
    "Média & Communication": "Media & Communication",
    "Transport & Logistique": "Transport & Logistics",
    "Industrie & Manufacture": "Industry & Manufacturing",
    "Immobilier & Construction": "Real Estate & Construction",
    "Télécommunications": "Telecommunications",
    "Administration & Gouvernement": "Government & Public Sector",
    "ONG & Associations": "Non-profit & NGO",
    "Loisirs & Tourisme": "Leisure & Tourism",
    "General": "General",
}

SECTOR_AUDIENCE_FALLBACK = {
    "Technology & SaaS": "Businesses and developers.",
    "Finance & Insurance": "Financial institutions and consumers.",
    "Healthcare & Pharma": "Healthcare professionals and patients.",
    "Retail & E-commerce": "Consumers and retail businesses.",
    "Education & Training": "Students, educators, and institutions.",
    "Consulting & Services": "Businesses seeking expert guidance.",
    "Media & Communication": "Media professionals and audiences.",
}

GENERIC_NAMES = {"Unknown", "Entity", "Unknown Entity", "Entreprise Inconnue", "Homepage", "Welcome"}


def load_env():
    if not os.path.exists(ENV_FILE):
        print(f"ERROR: {ENV_FILE} not found")
        sys.exit(1)
    with open(ENV_FILE, "r") as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                key, _, value = line.partition("=")
                key = key.strip()
                value = value.strip().strip('"')
                if key in ("SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"):
                    os.environ[key] = value


def get_supabase() -> Client:
    url = os.environ.get("SUPABASE_URL", "")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
    if not url or not key:
        print("ERROR: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY required")
        sys.exit(1)
    return create_client(url, key)


def fetch_all_entities(supabase: Client) -> list:
    all_entities = []
    page_size = 1000
    offset = 0
    while True:
        result = (
            supabase.table("aya_registry")
            .select("*")
            .range(offset, offset + page_size - 1)
            .execute()
        )
        batch = result.data or []
        all_entities.extend(batch)
        print(f"  Fetched {len(batch)} entities (total: {len(all_entities)})")
        if len(batch) < page_size:
            break
        offset += page_size
    return all_entities


def extract_asr_data(entity: dict) -> dict:
    payload = entity.get("asr_payload")
    if not payload:
        return {}
    if isinstance(payload, str):
        try:
            payload = json.loads(payload)
        except (json.JSONDecodeError, TypeError):
            return {}
    data = payload.get("data", {})
    if isinstance(data, str):
        try:
            data = json.loads(data)
        except (json.JSONDecodeError, TypeError):
            return {}
    return data


def domain_from_url(url: str) -> str:
    try:
        parsed = urlparse(url if url.startswith("http") else f"https://{url}")
        host = parsed.hostname or ""
        if host.startswith("www."):
            host = host[4:]
        return host
    except Exception:
        return url


def build_llm_record(entity: dict) -> dict:
    """Build the 8-field LLM-friendly record (mirrors TypeScript buildLlmSummary)."""
    asr = extract_asr_data(entity)

    # Name
    raw_name = entity.get("display_name") or entity.get("legal_name") or ""
    name = raw_name if raw_name and raw_name not in GENERIC_NAMES else domain_from_url(entity.get("website", ""))

    # Category
    sector_raw = entity.get("sector_macro", "General")
    category = SECTOR_LABELS.get(sector_raw, sector_raw)

    # Location
    cc = entity.get("country_legal", "XX")
    location = COUNTRY_LABELS.get(cc, "Global" if cc == "XX" else cc)

    # What it does — Gemini description takes priority
    payload = entity.get("asr_payload") or {}
    if isinstance(payload, str):
        try: payload = json.loads(payload)
        except: payload = {}
    enrichment = payload.get("enrichment", {})
    gemini_en = enrichment.get("gemini_description", "")
    gemini_keywords = enrichment.get("gemini_keywords", [])

    if gemini_en and len(gemini_en) > 10:
        what_it_does = gemini_en.strip()
        if not what_it_does.endswith("."):
            what_it_does += "."
    else:
        services = asr.get("offre", {}).get("services", {}).get("value", [])
        if isinstance(services, str):
            services = [services]
        business_type = asr.get("identite", {}).get("business_type", {}).get("value", "")
        if services:
            svc_text = ", ".join(services[:3]).lower()
            what_it_does = f"{business_type} providing {svc_text}." if business_type else f"Provides {svc_text}."
        elif business_type:
            what_it_does = f"{business_type} based in {location}."
        else:
            what_it_does = f"{category} company."
    what_it_does = what_it_does[:200].strip()

    # For who
    audience = asr.get("offre", {}).get("target_audience", {}).get("value", "")
    if isinstance(audience, list):
        audience = ", ".join(audience)
    if audience and len(audience) > 3:
        for_who = audience[:150].strip()
        if not for_who.endswith("."):
            for_who += "."
    else:
        for_who = SECTOR_AUDIENCE_FALLBACK.get(category, "Businesses and professionals.")

    return {
        "entity_id": entity.get("entity_id", ""),
        "name": name,
        "what_it_does": what_it_does,
        "for_who": for_who,
        "category": category,
        "location": location,
        "keywords": gemini_keywords[:8] if gemini_keywords else [],
        "aio_score": entity.get("asr_score", 0) or 0,
        "certificate_url": f"{BASE_URL}/{entity.get('entity_id', '')}",
    }


def generate_readme(count: int, countries: set, sectors: set):
    now = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    return f"""# AYA Business Dataset — Individual JSON Files

> Auto-generated on {now} from the [AYA Registry](https://ai-visionary.com/aya) by AI Visionary.

## What is this?

One JSON file per business entity, with an **ultra-simple 8-field format** designed for LLM consumption.

AYA works by **systemic attraction**: well-structured, public business data is present across multiple convergent sources (API, HTML pages, GitHub, HuggingFace) to ensure AI bots find and use reliable, readable information about businesses. This dataset is one of those convergent sources.

The same data is available via:
- **API**: `GET https://ai-visionary.com/api/aya/llm/{{domain}}`
- **HuggingFace**: [NeousAxis/aya-business-dataset](https://huggingface.co/datasets/NeousAxis/aya-business-dataset)
- **HTML pages**: `https://ai-visionary.com/aya/e/{{entity_id}}` (JSON-LD structured data)

## Schema

| Field | Type | Description |
|-------|------|-------------|
| `entity_id` | string | Unique UUID identifier |
| `name` | string | Entity display name |
| `what_it_does` | string | One sentence — what the entity does |
| `for_who` | string | Target audience |
| `category` | string | Business category |
| `location` | string | Country or "Global" |
| `aio_score` | integer | AI-readability score (0-100) |
| `certificate_url` | string | Link to AYA certificate page |

## Stats

- **{count}** entities
- **{len(countries)}** countries
- **{len(sectors)}** sectors

## License

CC-BY-4.0 — Free to use with attribution to AI Visionary.

## Links

- Website: https://ai-visionary.com
- API docs: https://ai-visionary.com/api/aya/docs
- GitHub: https://github.com/NeousAxis/ai-visionary
"""


def main():
    print("=== AYA GitHub Dataset Export ===")
    load_env()
    supabase = get_supabase()

    print("\nFetching entities from Supabase...")
    entities = fetch_all_entities(supabase)
    print(f"Total: {len(entities)} entities")

    # Filter score >= 20
    entities = [e for e in entities if (e.get("asr_score") or 0) >= 20]
    print(f"After filter (score >= 20): {len(entities)} entities")

    # Create export directory
    os.makedirs(EXPORT_DIR, exist_ok=True)

    countries = set()
    sectors = set()
    exported = 0

    for entity in entities:
        domain = domain_from_url(entity.get("website", ""))
        if not domain or domain == "":
            continue

        record = build_llm_record(entity)
        countries.add(record["location"])
        sectors.add(record["category"])

        filename = f"{domain}.json"
        filepath = os.path.join(EXPORT_DIR, filename)

        with open(filepath, "w", encoding="utf-8") as f:
            json.dump(record, f, indent=2, ensure_ascii=False)
        exported += 1

    # Generate README
    readme_path = os.path.join(EXPORT_DIR, "README.md")
    with open(readme_path, "w", encoding="utf-8") as f:
        f.write(generate_readme(exported, countries, sectors))

    print(f"\nExported {exported} JSON files to {EXPORT_DIR}/")
    print(f"README.md generated with {len(countries)} countries, {len(sectors)} sectors")
    print("Done!")


if __name__ == "__main__":
    main()
