"""
Export Postgres VPS entities as individual JSON files to the GitHub AYA dataset.

Reads Postgres VPS (aya_local.aya_registry, ~25 860 Tranco scraped entities),
generates one JSON per entity (same 8-field schema as export_github_dataset.py),
and optionally pushes new files to the GitHub repo NeousAxis/aya-business-dataset.

IMPORTANT: Run this script ON THE VPS — Postgres is localhost-only.

Usage:
    python3 export_github_dataset_vps.py            # dry-run (writes to /tmp/aya-github-dataset-vps/)
    python3 export_github_dataset_vps.py --apply    # clone repo + push new entities

Requires (in ../.env.local on the VPS):
    VPS_PG_HOST, VPS_PG_PORT, VPS_PG_DB, VPS_PG_USER, VPS_PG_PASSWORD
    GITHUB_TOKEN  (or GH_TOKEN)  — OR — SSH key configured for github.com

Dedup strategy:
    - each JSON file in the repo is opened and its `entity_id` (UUID) is extracted
    - if a VPS entity's entity_id is already present in the repo → SKIP
    - slug naming for new filenames is unchanged (lowercase, alphanum + dash, -2/-3 on collision)
    - this is collision-proof: two entities with the same name/domain but different UUIDs
      are treated as distinct and both pushed
"""

import argparse
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlparse

try:
    import psycopg2
    import psycopg2.extras
except ImportError:
    print("ERROR: psycopg2-binary not installed. Run: pip install psycopg2-binary")
    sys.exit(1)

# ─── Paths ────────────────────────────────────────────────────────────────────

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_DIR = os.path.dirname(SCRIPT_DIR)
ENV_FILE = os.path.join(PROJECT_DIR, ".env.local")

TMP_JSON_DIR = Path("/tmp/aya-github-dataset-vps")
TMP_REPO_DIR = Path("/tmp/aya-github-dataset-repo")

GITHUB_REPO_URL = "https://github.com/NeousAxis/aya-business-dataset.git"
GITHUB_REPO_SSH = "git@github.com:NeousAxis/aya-business-dataset.git"

BASE_CERT_URL = "https://ai-visionary.com/aya/e"

# ─── Lookup tables (identical to export_github_dataset.py) ───────────────────

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

# ─── Helpers ──────────────────────────────────────────────────────────────────


def load_env() -> None:
    """Load required vars from .env.local into os.environ."""
    if not os.path.exists(ENV_FILE):
        print(f"ERROR: {ENV_FILE} not found")
        sys.exit(1)
    needed = {
        "VPS_PG_HOST", "VPS_PG_PORT", "VPS_PG_DB", "VPS_PG_USER", "VPS_PG_PASSWORD",
        "GITHUB_TOKEN", "GH_TOKEN",
    }
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


def domain_from_url(url: str) -> str:
    try:
        parsed = urlparse(url if url.startswith("http") else f"https://{url}")
        host = parsed.hostname or ""
        if host.startswith("www."):
            host = host[4:]
        return host
    except Exception:
        return url


def make_slug(name: str, domain: str) -> str:
    """
    Build a filename slug from the entity name (preferred) or domain.
    Lowercase, alphanum + dash only, max 80 chars.
    """
    raw = name.strip() if name and name not in GENERIC_NAMES and len(name) > 1 else domain
    raw = raw.lower()
    # replace dots and underscores with dashes, strip everything else
    raw = re.sub(r"[._\s]+", "-", raw)
    raw = re.sub(r"[^a-z0-9\-]", "", raw)
    raw = re.sub(r"-{2,}", "-", raw).strip("-")
    return raw[:80] or "entity"


def unique_slug(base: str, seen: set) -> str:
    """Return base slug, appending -2/-3/… if already in seen. Mutates seen."""
    candidate = base
    counter = 2
    while candidate in seen:
        candidate = f"{base}-{counter}"
        counter += 1
    seen.add(candidate)
    return candidate


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


def build_llm_record(entity: dict) -> dict:
    """Build the 8-field LLM-friendly record (mirrors export_github_dataset.py:build_llm_record)."""
    asr = extract_asr_data(entity)

    # Name
    raw_name = entity.get("display_name") or entity.get("legal_name") or ""
    domain = domain_from_url(entity.get("website", ""))
    name = raw_name if raw_name and raw_name not in GENERIC_NAMES else domain

    # Category
    sector_raw = entity.get("sector_macro", "General")
    category = SECTOR_LABELS.get(sector_raw, sector_raw)

    # Location
    cc = entity.get("country_legal", "XX")
    location = COUNTRY_LABELS.get(cc, "Global" if cc == "XX" else cc)

    # What it does — Gemini description takes priority
    payload = entity.get("asr_payload") or {}
    if isinstance(payload, str):
        try:
            payload = json.loads(payload)
        except Exception:
            payload = {}
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
            what_it_does = (
                f"{business_type} providing {svc_text}." if business_type
                else f"Provides {svc_text}."
            )
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

    public_key_id = entity.get("aya_entity_id") or entity.get("entity_id", "")

    return {
        "entity_id": str(entity.get("entity_id", "")),
        "public_key_id": str(public_key_id),
        "name": name,
        "what_it_does": what_it_does,
        "for_who": for_who,
        "category": category,
        "location": location,
        "keywords": gemini_keywords[:8] if isinstance(gemini_keywords, list) else [],
        "aio_score": entity.get("asr_score", 0) or 0,
        "certificate_url": f"{BASE_CERT_URL}/{entity.get('entity_id', '')}",
    }


# ─── Postgres fetch ───────────────────────────────────────────────────────────


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
                    entity_id, display_name, legal_name, website,
                    country_legal, sector_macro, entity_type, asr_score,
                    payment_completed, asr_payload, data_origin
                FROM aya_registry
                WHERE asr_score >= 20
                ORDER BY asr_score DESC
                """
            )
            rows = cur.fetchall()
    finally:
        conn.close()
    return [dict(r) for r in rows]


# ─── GitHub auth detection ────────────────────────────────────────────────────


def detect_github_auth() -> tuple[str, str]:
    """
    Returns (push_url, auth_method) where auth_method is 'ssh' or 'token'.
    Exits with code 1 if no auth available.
    """
    # 1. Try SSH
    try:
        result = subprocess.run(
            ["git", "ls-remote", "--exit-code", GITHUB_REPO_SSH, "HEAD"],
            capture_output=True, timeout=15,
        )
        if result.returncode == 0:
            return GITHUB_REPO_SSH, "ssh"
    except (subprocess.TimeoutExpired, FileNotFoundError):
        pass

    # 2. Try GITHUB_TOKEN / GH_TOKEN
    token = os.environ.get("GITHUB_TOKEN") or os.environ.get("GH_TOKEN", "")
    if token:
        token_url = f"https://{token}@github.com/NeousAxis/aya-business-dataset.git"
        try:
            result = subprocess.run(
                ["git", "ls-remote", "--exit-code", token_url, "HEAD"],
                capture_output=True, timeout=15,
            )
            if result.returncode == 0:
                return token_url, "token"
        except (subprocess.TimeoutExpired, FileNotFoundError):
            pass
        # Return token URL even if ls-remote failed (network issue on VPS with non-standard DNS)
        return token_url, "token"

    print(
        "ERROR: No GitHub authentication available.\n"
        "Configure GITHUB_TOKEN (or GH_TOKEN) in .env.local\n"
        "OR set up an SSH key for github.com (ssh-keygen + add to GitHub account)."
    )
    sys.exit(1)


# ─── Repo operations ──────────────────────────────────────────────────────────


def run_git(args: list[str], cwd: Path, check: bool = True) -> subprocess.CompletedProcess:
    return subprocess.run(
        ["git"] + args,
        cwd=str(cwd),
        capture_output=True,
        text=True,
        check=check,
    )


def clone_or_pull_repo(push_url: str, auth_method: str) -> Path:
    """Clone the GitHub repo into TMP_REPO_DIR, or git pull if already present."""
    if TMP_REPO_DIR.exists():
        print(f"  Repo already at {TMP_REPO_DIR}, running git pull...")
        result = run_git(["pull", "--ff-only"], cwd=TMP_REPO_DIR, check=False)
        if result.returncode != 0:
            print(f"  git pull failed: {result.stderr.strip()} — re-cloning...")
            shutil.rmtree(TMP_REPO_DIR)
        else:
            print(f"  git pull: {result.stdout.strip() or 'up to date'}")
            return TMP_REPO_DIR

    print(f"  Cloning {GITHUB_REPO_URL} into {TMP_REPO_DIR}...")
    subprocess.run(
        ["git", "clone", push_url, str(TMP_REPO_DIR)],
        check=True,
    )
    return TMP_REPO_DIR


def get_existing_entity_ids(repo_dir: Path) -> set:
    """
    Return the set of entity_id UUIDs already present in the cloned repo.

    Reads the first 512 bytes of each JSON file — enough to capture `entity_id`
    which is always the first field in the record (no need to parse the full file).
    Falls back to a full json.loads() if the partial read doesn't find the key.

    Performance: ~4 400 files × 512 bytes = ~2.2 MB I/O total, typically < 5 seconds.
    """
    import re as _re
    _eid_re = _re.compile(rb'"entity_id"\s*:\s*"([^"]+)"')

    existing_ids: set = set()
    json_files = list(repo_dir.glob("*.json"))
    for p in json_files:
        try:
            with open(p, "rb") as fh:
                head = fh.read(512)
            m = _eid_re.search(head)
            if m:
                existing_ids.add(m.group(1).decode("utf-8", errors="replace"))
            else:
                # Fallback: parse full file (handles edge case where entity_id is deep)
                with open(p, "r", encoding="utf-8") as fh2:
                    data = json.load(fh2)
                eid = data.get("entity_id", "")
                if eid:
                    existing_ids.add(str(eid))
        except Exception:
            # Corrupt / non-entity JSON (e.g. README accidentally named .json) — skip
            pass
    return existing_ids


# ─── JSON generation ──────────────────────────────────────────────────────────


def generate_json_files(entities: list) -> tuple[dict, dict]:
    """
    Generate JSON files into TMP_JSON_DIR.
    Returns:
        slug_to_path:    {slug: Path}  — all generated files, keyed by slug
        entity_id_to_slug: {entity_id: slug}  — reverse map for dedup by UUID
    """
    TMP_JSON_DIR.mkdir(parents=True, exist_ok=True)
    seen_slugs: set = set()
    slug_to_path: dict = {}
    entity_id_to_slug: dict = {}

    for entity in entities:
        domain = domain_from_url(entity.get("website", ""))
        raw_name = entity.get("display_name") or entity.get("legal_name") or ""
        base_slug = make_slug(raw_name, domain)
        slug = unique_slug(base_slug, seen_slugs)

        record = build_llm_record(entity)
        filepath = TMP_JSON_DIR / f"{slug}.json"
        with open(filepath, "w", encoding="utf-8") as f:
            json.dump(record, f, indent=2, ensure_ascii=False)

        slug_to_path[slug] = filepath
        eid = record.get("entity_id", "")
        if eid:
            entity_id_to_slug[eid] = slug

    return slug_to_path, entity_id_to_slug


# ─── Main ─────────────────────────────────────────────────────────────────────


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Export Postgres VPS AYA entities to the GitHub dataset (incremental)."
    )
    parser.add_argument(
        "--apply",
        action="store_true",
        help="Clone repo, copy new files, commit, and push. Default: dry-run only.",
    )
    args = parser.parse_args()

    print("=" * 60)
    print("AYA Registry VPS -> GitHub Dataset (incremental)")
    print(f"Mode: {'APPLY (commit + push)' if args.apply else 'DRY-RUN (local /tmp only)'}")
    print(f"Date: {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M UTC')}")
    print("=" * 60)

    load_env()

    # ── Fetch from Postgres VPS ──────────────────────────────────────────────
    print("\n[1/4] Fetching entities from Postgres VPS (asr_score >= 20)...")
    entities = fetch_vps_entities()
    print(f"      Found: {len(entities)} entities")

    if not entities:
        print("No entities to export. Exiting.")
        sys.exit(0)

    # ── Generate JSON files locally ──────────────────────────────────────────
    print(f"\n[2/4] Generating JSON files in {TMP_JSON_DIR}...")
    slug_to_path, entity_id_to_slug = generate_json_files(entities)
    print(f"      Generated: {len(slug_to_path)} JSON files")

    # ── Dedup against GitHub repo ────────────────────────────────────────────
    if args.apply:
        print("\n[3/4] Checking GitHub auth...")
        push_url, auth_method = detect_github_auth()
        print(f"      Auth method: {auth_method}")

        print(f"\n[4/4] Cloning/pulling {GITHUB_REPO_URL}...")
        repo_dir = clone_or_pull_repo(push_url, auth_method)

        print(f"      Reading entity_ids from existing repo JSON files...")
        existing_entity_ids = get_existing_entity_ids(repo_dir)
        print(f"      Existing entity_ids in repo: {len(existing_entity_ids)}")

        # Invert entity_id_to_slug → slug_to_entity_id for O(1) lookups
        slug_to_entity_id: dict = {s: eid for eid, s in entity_id_to_slug.items()}

        # Build list of new slugs whose entity_id is NOT already in the repo
        new_slugs = [
            slug for slug in slug_to_path
            if slug_to_entity_id.get(slug, "") not in existing_entity_ids
        ]
        skipped = len(slug_to_path) - len(new_slugs)

        print(f"\n      New entities to push:    {len(new_slugs)}")
        print(f"      Skipped (already exist): {skipped}")

        if not new_slugs:
            print("\nAll entities already present in repo. Nothing to push.")
            sys.exit(0)

        # Copy new files into the cloned repo
        for slug in new_slugs:
            src = slug_to_path[slug]
            dst = repo_dir / src.name
            shutil.copy2(src, dst)

        # git add + commit + push
        run_git(["add"] + [f"{s}.json" for s in new_slugs], cwd=repo_dir)
        commit_msg = f"Add {len(new_slugs)} new entities from Postgres VPS (Tranco scrape)"
        run_git(["commit", "-m", commit_msg], cwd=repo_dir)
        print(f"\n      Committed: {commit_msg}")

        # Push — set remote URL to push_url (handles token injection)
        run_git(["remote", "set-url", "origin", push_url], cwd=repo_dir)
        push_result = run_git(["push", "origin", "main"], cwd=repo_dir, check=False)
        if push_result.returncode != 0:
            # Try 'master' branch as fallback
            push_result2 = run_git(["push", "origin", "master"], cwd=repo_dir, check=False)
            if push_result2.returncode != 0:
                print(f"ERROR: git push failed:\n{push_result.stderr}\n{push_result2.stderr}")
                sys.exit(1)

        print(f"\nDone. {len(new_slugs)} new entities pushed to {GITHUB_REPO_URL}")

    else:
        # Dry-run: just show what would happen
        print(f"\n[3/4] DRY-RUN: entity_id dedup requires --apply (repo clone needed).")
        print("      (Skipping clone — dry-run mode. Use --apply to push.)")

        print(f"\n[4/4] Stats (dry-run, no dedup against live repo):")
        print(f"      VPS entities processed:  {len(entities)}")
        print(f"      JSON files generated:    {len(slug_to_path)}")
        print(f"      Temp output dir:         {TMP_JSON_DIR}")
        print(f"\n      Sample slugs:")
        for slug in list(slug_to_path.keys())[:5]:
            print(f"        {slug}.json")
        if len(slug_to_path) > 5:
            print(f"        ... and {len(slug_to_path) - 5} more")

        print(
            "\nDRY-RUN complete. Re-run with --apply to clone repo, dedup by entity_id, commit, and push."
        )


if __name__ == "__main__":
    main()
