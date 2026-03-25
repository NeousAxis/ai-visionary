"""
Quality audit of ALL AYA registry entities.
Detects: bad names, missing descriptions, wrong sectors, duplicates, mojibake, empty fields.

Usage:
    python quality_audit.py              # Full audit report
    python quality_audit.py --fix        # Fix auto-fixable issues
    python quality_audit.py --export     # Export issues to CSV

Output: aya/exports/quality-audit-report.md
"""

import os, sys, json, re, csv
from collections import Counter, defaultdict
from urllib.parse import urlparse

with open("/Users/cyrilleger/AI VISIONARY/.env.local", "r") as f:
    for line in f:
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            key, _, value = line.partition("=")
            os.environ[key.strip()] = value.strip().strip('"')

from supabase import create_client
sb = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_ROLE_KEY"])

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
EXPORT_DIR = os.path.join(SCRIPT_DIR, "exports")

# ─── Quality checks ───

NON_LATIN_RE = re.compile(r'[^\x00-\x7F\xC0-\xFF\u0100-\u024F\u1E00-\u1EFF\u2000-\u206F\u2010-\u2027\u00A0-\u00FF]')

GENERIC_NAMES = {
    "unknown", "entity", "unknown entity", "entreprise inconnue", "homepage",
    "welcome", "home", "redirecting", "loading", "untitled", "test",
    "about", "contact", "login", "sign in", "register",
}

GARBAGE_SERVICES = {
    'api', 'app', 'application', 'cloud', 'service', 'services', 'platform',
    'solution', 'solutions', 'product', 'products', 'tool', 'tools',
    'software', 'website', 'web', 'online', 'digital', 'data', 'system',
    'technology', 'tech', 'information', 'management', 'support',
    'login', 'contact', 'about', 'home', 'privacy', 'terms', 'blog',
    'offre', 'offres', 'accueil', 'boutique', 'restaurant', 'hotel',
    'delivery', 'conditions', 'compliance', 'security',
}

NSFW_KEYWORDS = {'porn', 'xxx', 'adult', 'sex', 'nude', 'erotic', 'casino', 'gambling', 'betting'}


def domain_from_url(url):
    try:
        parsed = urlparse(url if url.startswith("http") else f"https://{url}")
        host = parsed.hostname or ""
        return host.replace("www.", "")
    except:
        return url


def extract_asr_data(entity):
    payload = entity.get("asr_payload") or {}
    if isinstance(payload, str):
        try: payload = json.loads(payload)
        except: return {}, {}
    data = payload.get("data", {})
    if isinstance(data, str):
        try: data = json.loads(data)
        except: data = {}
    enrichment = payload.get("enrichment", {})
    return data, enrichment


def audit_entity(entity):
    """Run all quality checks on a single entity. Returns list of issues."""
    issues = []
    domain = domain_from_url(entity.get("website", ""))
    name = entity.get("display_name") or entity.get("legal_name") or ""
    score = entity.get("asr_score") or 0
    sector = entity.get("sector_macro") or ""
    country = entity.get("country_legal") or ""
    data, enrichment = extract_asr_data(entity)

    # CHECK 1: Name quality
    if not name or len(name) < 2:
        issues.append(("CRITICAL", "MISSING_NAME", "No display name"))
    elif name.lower() in GENERIC_NAMES:
        issues.append(("HIGH", "GENERIC_NAME", f"Generic name: '{name}'"))
    elif NON_LATIN_RE.search(name):
        issues.append(("HIGH", "MOJIBAKE_NAME", f"Non-Latin chars in name: '{name[:40]}'"))
    elif len(name) > 100:
        issues.append(("MEDIUM", "LONG_NAME", f"Name too long ({len(name)} chars): '{name[:50]}...'"))
    elif name == domain.split(".")[0].capitalize():
        issues.append(("LOW", "DOMAIN_AS_NAME", f"Name is just domain: '{name}'"))

    # CHECK 2: Name looks like a slogan or description
    slogan_indicators = ["the best", "leading", "world's", "your", "we are", "bienvenue", "welcome"]
    if any(ind in name.lower() for ind in slogan_indicators):
        issues.append(("HIGH", "SLOGAN_AS_NAME", f"Name looks like slogan: '{name[:60]}'"))

    # CHECK 3: Description quality
    services = data.get("offre", {}).get("services", {}).get("value", [])
    if isinstance(services, str): services = [services]
    real_services = [s for s in services if s.lower().strip() not in GARBAGE_SERVICES and len(s) > 3]
    gemini_desc = enrichment.get("gemini_description", "")

    if not gemini_desc and not real_services:
        issues.append(("HIGH", "NO_DESCRIPTION", "No Gemini description and no real services"))
    elif not gemini_desc and real_services:
        issues.append(("LOW", "NO_GEMINI_DESC", "Has services but no Gemini description"))

    # CHECK 4: Country
    if not country or country == "XX":
        issues.append(("MEDIUM", "UNKNOWN_COUNTRY", "Country not detected (XX)"))

    # CHECK 5: Sector
    if not sector or sector == "General":
        issues.append(("MEDIUM", "GENERIC_SECTOR", "Sector is Generic/missing"))

    # CHECK 6: Score anomalies
    if score == 0:
        issues.append(("HIGH", "ZERO_SCORE", "Score is 0"))
    elif score > 90 and not entity.get("payment_completed"):
        issues.append(("MEDIUM", "HIGH_SCORE_BOT", f"Bot entity with very high score: {score}"))

    # CHECK 7: Website issues
    website = entity.get("website", "")
    if not website:
        issues.append(("CRITICAL", "NO_WEBSITE", "No website URL"))
    elif ":443" in website:
        issues.append(("LOW", "PORT_IN_URL", "URL contains :443"))

    # CHECK 8: NSFW content
    all_text = f"{name} {domain} {sector} {' '.join(services)}".lower()
    for kw in NSFW_KEYWORDS:
        if kw in all_text:
            issues.append(("CRITICAL", "NSFW_CONTENT", f"NSFW keyword detected: '{kw}'"))
            break

    # CHECK 9: Duplicate name (checked in main)

    return issues


def main():
    do_fix = "--fix" in sys.argv
    do_export = "--export" in sys.argv

    print("=== AYA Quality Audit ===\n")

    # Fetch all
    all_entities = []
    offset = 0
    while True:
        batch = sb.table("aya_registry").select("*").range(offset, offset + 999).execute()
        all_entities.extend(batch.data or [])
        if len(batch.data or []) < 1000: break
        offset += 1000

    print(f"Total entities: {len(all_entities)}\n")

    # Run audit
    all_issues = []  # (entity, domain, issues)
    name_counts = Counter()
    domain_counts = Counter()

    for entity in all_entities:
        domain = domain_from_url(entity.get("website", ""))
        name = entity.get("display_name") or ""
        name_counts[name.lower()] += 1
        domain_counts[domain] += 1

        issues = audit_entity(entity)
        if issues:
            all_issues.append((entity, domain, issues))

    # Check duplicates
    duplicate_names = {n for n, c in name_counts.items() if c > 1 and n}
    duplicate_domains = {d for d, c in domain_counts.items() if c > 1 and d}

    for entity, domain, issues in all_issues:
        name = (entity.get("display_name") or "").lower()
        if name in duplicate_names:
            issues.append(("MEDIUM", "DUPLICATE_NAME", f"Name '{name}' appears {name_counts[name]} times"))
        if domain in duplicate_domains:
            issues.append(("MEDIUM", "DUPLICATE_DOMAIN", f"Domain '{domain}' appears {domain_counts[domain]} times"))

    # Also add entities with only duplicate issues
    for entity in all_entities:
        domain = domain_from_url(entity.get("website", ""))
        name = (entity.get("display_name") or "").lower()
        existing = [e for e, d, i in all_issues if e["entity_id"] == entity["entity_id"]]
        if not existing:
            dup_issues = []
            if name in duplicate_names:
                dup_issues.append(("MEDIUM", "DUPLICATE_NAME", f"Name '{name}' appears {name_counts[name]} times"))
            if domain in duplicate_domains:
                dup_issues.append(("MEDIUM", "DUPLICATE_DOMAIN", f"Domain '{domain}' appears {domain_counts[domain]} times"))
            if dup_issues:
                all_issues.append((entity, domain, dup_issues))

    # Stats
    severity_counts = Counter()
    type_counts = Counter()
    for _, _, issues in all_issues:
        for sev, typ, _ in issues:
            severity_counts[sev] += 1
            type_counts[typ] += 1

    clean_count = len(all_entities) - len(set(e["entity_id"] for e, _, _ in all_issues))

    # Enrichment stats
    enriched = sum(1 for e in all_entities
                   if (e.get("asr_payload") or {}).get("enrichment", {}).get("gemini_description"))
    not_enriched = len(all_entities) - enriched

    # ─── Report ───
    lines = [
        "# AYA Registry — Quality Audit Report",
        "",
        f"**Date**: {__import__('datetime').datetime.now().strftime('%Y-%m-%d %H:%M')}",
        f"**Total entities**: {len(all_entities)}",
        f"**Clean entities** (no issues): {clean_count} ({100*clean_count//len(all_entities)}%)",
        f"**Entities with issues**: {len(set(e['entity_id'] for e, _, _ in all_issues))}",
        f"**Gemini enriched**: {enriched}/{len(all_entities)} ({100*enriched//len(all_entities)}%)",
        f"**Not enriched**: {not_enriched}",
        "",
        "## Issue Summary",
        "",
        "| Severity | Count |",
        "|----------|-------|",
    ]
    for sev in ["CRITICAL", "HIGH", "MEDIUM", "LOW"]:
        lines.append(f"| {sev} | {severity_counts.get(sev, 0)} |")

    lines.extend([
        "",
        "## Issue Types",
        "",
        "| Type | Count | Description |",
        "|------|-------|-------------|",
    ])
    type_descs = {
        "MISSING_NAME": "No display name set",
        "GENERIC_NAME": "Name is generic (Homepage, Welcome, etc.)",
        "MOJIBAKE_NAME": "Non-Latin characters in name",
        "LONG_NAME": "Name is too long (>100 chars)",
        "DOMAIN_AS_NAME": "Name is just the domain capitalized",
        "SLOGAN_AS_NAME": "Name looks like a marketing slogan",
        "NO_DESCRIPTION": "No Gemini description AND no real services",
        "NO_GEMINI_DESC": "Has services but no Gemini enrichment yet",
        "UNKNOWN_COUNTRY": "Country code is XX (unknown)",
        "GENERIC_SECTOR": "Sector is General or missing",
        "ZERO_SCORE": "AIO score is 0",
        "HIGH_SCORE_BOT": "Bot entity with score >90",
        "NO_WEBSITE": "No website URL",
        "PORT_IN_URL": "URL contains :443",
        "NSFW_CONTENT": "NSFW/adult content detected",
        "DUPLICATE_NAME": "Same name as another entity",
        "DUPLICATE_DOMAIN": "Same domain as another entity",
    }
    for typ, count in sorted(type_counts.items(), key=lambda x: -x[1]):
        desc = type_descs.get(typ, "")
        lines.append(f"| {typ} | {count} | {desc} |")

    # Critical issues detail
    critical = [(e, d, i) for e, d, i in all_issues if any(s == "CRITICAL" for s, _, _ in i)]
    if critical:
        lines.extend(["", "## CRITICAL Issues (must fix)", ""])
        for entity, domain, issues in critical[:50]:
            for sev, typ, msg in issues:
                if sev == "CRITICAL":
                    lines.append(f"- **{domain}**: {msg}")

    # High issues detail (first 50)
    high = [(e, d, i) for e, d, i in all_issues if any(s == "HIGH" for s, _, _ in i)]
    if high:
        lines.extend(["", f"## HIGH Issues (top 50 of {len(high)})", ""])
        for entity, domain, issues in high[:50]:
            for sev, typ, msg in issues:
                if sev == "HIGH":
                    lines.append(f"- **{domain}**: {msg}")

    # Duplicates
    if duplicate_domains:
        lines.extend(["", f"## Duplicate Domains ({len(duplicate_domains)})", ""])
        for d in sorted(duplicate_domains):
            lines.append(f"- {d} (x{domain_counts[d]})")

    # Country distribution
    country_dist = Counter(e.get("country_legal", "XX") for e in all_entities)
    lines.extend(["", "## Country Distribution (top 20)", "", "| Country | Count |", "|---------|-------|"])
    for cc, count in country_dist.most_common(20):
        lines.append(f"| {cc} | {count} |")

    # Sector distribution
    sector_dist = Counter(e.get("sector_macro", "General") for e in all_entities)
    lines.extend(["", "## Sector Distribution", "", "| Sector | Count |", "|--------|-------|"])
    for sec, count in sector_dist.most_common():
        lines.append(f"| {sec} | {count} |")

    report = "\n".join(lines)

    # Write report
    os.makedirs(EXPORT_DIR, exist_ok=True)
    report_path = os.path.join(EXPORT_DIR, "quality-audit-report.md")
    with open(report_path, "w", encoding="utf-8") as f:
        f.write(report)

    # Console summary
    print("─" * 60)
    print(f"CLEAN:    {clean_count}/{len(all_entities)} ({100*clean_count//len(all_entities)}%)")
    print(f"ENRICHED: {enriched}/{len(all_entities)} ({100*enriched//len(all_entities)}%)")
    print(f"CRITICAL: {severity_counts.get('CRITICAL', 0)}")
    print(f"HIGH:     {severity_counts.get('HIGH', 0)}")
    print(f"MEDIUM:   {severity_counts.get('MEDIUM', 0)}")
    print(f"LOW:      {severity_counts.get('LOW', 0)}")
    print(f"DUPES:    {len(duplicate_domains)} duplicate domains")
    print("─" * 60)
    print(f"\nFull report: {report_path}")

    # Export CSV
    if do_export:
        csv_path = os.path.join(EXPORT_DIR, "quality-audit-issues.csv")
        with open(csv_path, "w", newline="", encoding="utf-8") as f:
            w = csv.writer(f)
            w.writerow(["domain", "name", "severity", "type", "message", "entity_id"])
            for entity, domain, issues in all_issues:
                name = entity.get("display_name", "")
                for sev, typ, msg in issues:
                    w.writerow([domain, name, sev, typ, msg, entity["entity_id"]])
        print(f"CSV export: {csv_path}")


if __name__ == "__main__":
    main()
