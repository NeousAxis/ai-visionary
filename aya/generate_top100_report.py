"""
Generate a "Top 100 AI-readable Web3 & AI companies" report from Supabase.

Usage:
    python generate_top100_report.py
    python generate_top100_report.py --sectors "Technology & SaaS,Blockchain & Web3"

Output:
    aya/exports/top-100-ai-readable-web3-ai.md
"""

import json
import os
import sys
from datetime import datetime, timezone

try:
    from supabase import create_client, Client
except ImportError:
    print("ERROR: supabase-py not installed. Run: pip install supabase")
    sys.exit(1)

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_DIR = os.path.dirname(SCRIPT_DIR)
EXPORT_DIR = os.path.join(SCRIPT_DIR, "exports")
ENV_FILE = os.path.join(PROJECT_DIR, ".env.local")

# Sectors that match Web3/AI/Tech
DEFAULT_SECTORS = {
    "Technologie & SaaS",
    "Technology & SaaS",
    "Blockchain & Web3",
    "Intelligence Artificielle",
    "Artificial Intelligence",
    "Télécommunications",
    "Telecommunications",
}

COUNTRY_LABELS = {
    "CH": "Switzerland", "FR": "France", "DE": "Germany", "US": "United States",
    "GB": "United Kingdom", "IT": "Italy", "NL": "Netherlands", "CA": "Canada",
    "JP": "Japan", "SG": "Singapore", "IN": "India", "IL": "Israel",
    "SE": "Sweden", "IE": "Ireland", "KR": "South Korea", "AU": "Australia",
    "XX": "Global",
}


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
            .select("entity_id,display_name,legal_name,website,sector_macro,country_legal,asr_score,payment_completed")
            .range(offset, offset + page_size - 1)
            .execute()
        )
        batch = result.data or []
        all_entities.extend(batch)
        if len(batch) < page_size:
            break
        offset += page_size
    return all_entities


def domain_from_url(url: str) -> str:
    try:
        d = url.replace("https://", "").replace("http://", "")
        if d.startswith("www."):
            d = d[4:]
        return d.split("/")[0]
    except Exception:
        return url


def main():
    sectors_filter = DEFAULT_SECTORS

    # Parse --sectors argument
    if "--sectors" in sys.argv:
        idx = sys.argv.index("--sectors")
        if idx + 1 < len(sys.argv):
            sectors_filter = set(s.strip() for s in sys.argv[idx + 1].split(","))

    print("=== Top 100 AI-Readable Companies Report ===")
    load_env()
    supabase = get_supabase()

    print("\nFetching entities...")
    entities = fetch_all_entities(supabase)
    print(f"Total: {len(entities)} entities")

    # Filter by sector (case-insensitive partial match)
    filtered = []
    for e in entities:
        sector = e.get("sector_macro", "")
        score = e.get("asr_score", 0) or 0
        if score < 10:
            continue
        for s in sectors_filter:
            if s.lower() in sector.lower() or sector.lower() in s.lower():
                filtered.append(e)
                break

    print(f"After sector filter: {len(filtered)} entities")

    # Sort by score DESC
    filtered.sort(key=lambda x: x.get("asr_score", 0) or 0, reverse=True)
    top100 = filtered[:100]

    # Stats
    scores = [e.get("asr_score", 0) or 0 for e in top100]
    avg_score = sum(scores) / len(scores) if scores else 0
    country_counts: dict[str, int] = {}
    for e in top100:
        cc = e.get("country_legal", "XX")
        country_counts[cc] = country_counts.get(cc, 0) + 1

    now = datetime.now(timezone.utc).strftime("%Y-%m-%d")

    # Generate markdown
    lines = [
        f"# Top 100 AI-Readable Web3 & AI Companies",
        f"",
        f"> Generated on {now} from the [AYA Registry](https://ai-visionary.com/aya) by AI Visionary.",
        f"> Ranked by AIO score (AI-readability Intelligence Optimization, 0-100).",
        f"",
        f"## Key Stats",
        f"",
        f"- **{len(top100)}** companies ranked",
        f"- **Average AIO score**: {avg_score:.0f}/100",
        f"- **Highest score**: {max(scores) if scores else 0}/100",
        f"- **{len(country_counts)}** countries represented",
        f"",
        f"## Rankings",
        f"",
        f"| Rank | Name | Domain | AIO Score | Sector | Country |",
        f"|------|------|--------|-----------|--------|---------|",
    ]

    for i, e in enumerate(top100, 1):
        name = e.get("display_name") or e.get("legal_name") or "—"
        domain = domain_from_url(e.get("website", ""))
        score = e.get("asr_score", 0) or 0
        sector = e.get("sector_macro", "—")
        cc = e.get("country_legal", "XX")
        country = COUNTRY_LABELS.get(cc, cc)
        certified = " *" if e.get("payment_completed") else ""
        lines.append(f"| {i} | {name}{certified} | {domain} | {score} | {sector} | {country} |")

    lines.extend([
        f"",
        f"_* = AYA Certified (verified by AYO diagnostic)_",
        f"",
        f"## Country Distribution",
        f"",
        f"| Country | Count |",
        f"|---------|-------|",
    ])

    for cc, count in sorted(country_counts.items(), key=lambda x: x[1], reverse=True):
        country = COUNTRY_LABELS.get(cc, cc)
        lines.append(f"| {country} | {count} |")

    lines.extend([
        f"",
        f"---",
        f"",
        f"Data source: [AYA Registry API](https://ai-visionary.com/api/aya) | [HuggingFace Dataset](https://huggingface.co/datasets/NeousAxis/aya-business-dataset)",
        f"",
        f"Powered by AI Visionary — Geneva, Switzerland",
    ])

    # Write
    os.makedirs(EXPORT_DIR, exist_ok=True)
    output_path = os.path.join(EXPORT_DIR, "top-100-ai-readable-web3-ai.md")
    with open(output_path, "w", encoding="utf-8") as f:
        f.write("\n".join(lines))

    print(f"\nReport written to {output_path}")
    print(f"Top 3: {', '.join(e.get('display_name', '?') for e in top100[:3])}")
    print("Done!")


if __name__ == "__main__":
    main()
