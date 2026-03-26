"""
Fix entity names, sectors, and countries in the AYA registry (Supabase).

1. Bad names: display_name is a slogan/meta title/generic name instead of real company name
2. Wrong sectors: well-known companies with incorrect sector
3. Country "XX": well-known companies missing country

Only fixes OBVIOUS mistakes. Uses UPDATE queries.

Usage:
    python fix_names_sectors.py              # Dry run (audit only)
    python fix_names_sectors.py --apply      # Apply fixes
"""

import os, sys, json, re
from urllib.parse import urlparse

# Load env vars
with open("/Users/cyrilleger/AI VISIONARY/.env.local", "r") as f:
    for line in f:
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            key, _, value = line.partition("=")
            os.environ[key.strip()] = value.strip().strip('"')

from supabase import create_client

sb = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_ROLE_KEY"])

DRY_RUN = "--apply" not in sys.argv

# ============================================================
# KNOWN FIXES — manually curated corrections
# Format: domain -> {field: new_value}
# ============================================================

KNOWN_FIXES = {
    # ---- BAD NAMES (slogan/meta title/generic → real company name) ----
    "mobotix.com": {"display_name": "Mobotix"},
    "wolfram.com": {"display_name": "Wolfram Research", "country_legal": "US"},
    "wix.com": {"country_legal": "IL"},
    "zuerich.com": {"display_name": "Zürich Tourismus"},

    # ---- WRONG SECTORS ----
    "wisycom.com": {"sector_macro": "Technologie & SaaS", "display_name": "Wisycom"},
    "syngenta.com": {"sector_macro": "Industrie & Manufacturing"},
    "wesfarmers.com.au": {"sector_macro": "E-commerce & Retail"},

    # ---- BAD NAMES — mojibake / meta titles / slogans ----
    "audi.com": {"display_name": "Audi"},
    "outokumpu.com": {"display_name": "Outokumpu"},
    "humana.com": {"display_name": "Humana"},
    "mccain.com": {"display_name": "McCain Foods"},
    "eurofins.com": {"display_name": "Eurofins"},
    "nonesuch.com": {"display_name": "Nonesuch Records"},
    "soylent.com": {"display_name": "Soylent"},
    "citrix.com": {"display_name": "Citrix"},
    "continue.dev": {"display_name": "Continue"},
    "bajaj.com": {"display_name": "Bajaj Group", "country_legal": "IN"},
    "astraspace.net": {"display_name": "Astra Space", "country_legal": "US"},
    "arxiv.org": {"display_name": "arXiv", "country_legal": "US"},
    "4dayweek.io": {"display_name": "4 Day Week Jobs"},
    "99app.com": {"display_name": "99"},
    "cantina.xyz": {"display_name": "Cantina"},
    "blur.io": {"display_name": "Blur"},
    "character.ai": {"display_name": "Character AI"},
    "charisma.ai": {"display_name": "Charisma"},
    "cred.club": {"display_name": "CRED"},
    "cyber.co": {"display_name": "Cyber"},
    "detectify.com": {"display_name": "Detectify"},
    "edp.com": {"display_name": "EDP"},
    "endel.io": {"display_name": "Endel"},
    "etherscan.io": {"display_name": "Etherscan"},
    "adventofcode.com": {"display_name": "Advent of Code"},
    "allbridge.io": {"display_name": "Allbridge"},
    "aptos.dev": {"display_name": "Aptos"},
    "corintis.com": {"display_name": "Corintis"},
    "agility.com": {"display_name": "Agility"},
    "observe.ai": {"display_name": "Observe.AI"},
    "trustwallet.com": {"display_name": "Trust Wallet"},
    "nissan-global.com": {"display_name": "Nissan"},
    "copy.ai": {"display_name": "Copy.ai"},
    "siemens-healthineers.com": {"display_name": "Siemens Healthineers"},
    "mazda.com": {"display_name": "Mazda"},
    "wordpress.com": {"display_name": "WordPress.com"},
    "deeplearning.ai": {"display_name": "DeepLearning.AI"},
    "snipcart.com": {"display_name": "Snipcart"},
    "adecco.com": {"display_name": "Adecco"},
    "innergex.com": {"display_name": "Innergex", "country_legal": "CA"},
    "bescherelle.com": {"display_name": "Bescherelle", "country_legal": "FR"},
    "coforge.com": {"display_name": "Coforge", "country_legal": "IN"},
    "web.vodafone.com.eg": {"display_name": "Vodafone Egypt", "country_legal": "EG"},
    "plivo.com": {"display_name": "Plivo"},
    "nfl.com": {"display_name": "NFL", "country_legal": "US"},
    "psg.fr": {"display_name": "Paris Saint-Germain", "country_legal": "FR"},
    "geico.com": {"display_name": "GEICO", "country_legal": "US"},
    "global.fujitsu": {"display_name": "Fujitsu", "country_legal": "JP"},

    # ---- More well-known XX → correct country ----
    "basf.com": {"country_legal": "DE"},
    "baxter.com": {"country_legal": "US"},
    "berkeley.edu": {"country_legal": "US"},
    "betterment.com": {"country_legal": "US"},

    # ---- Well-known companies with country XX ----
    "asana.com": {"country_legal": "US"},
    "asda.com": {"country_legal": "GB"},
    "canonical.com": {"country_legal": "GB"},
    "avaloq.com": {"country_legal": "CH"},
    "basecamp.com": {"country_legal": "US"},
    "barrick.com": {"country_legal": "CA"},
    "care.org": {"country_legal": "US"},
    "clickhouse.com": {"country_legal": "US"},
    "babolat.com": {"country_legal": "FR"},
    "backbase.com": {"country_legal": "NL"},
    "a16z.com": {"display_name": "Andreessen Horowitz", "country_legal": "US"},
    "a16zcrypto.com": {"country_legal": "US"},
    "aave.com": {"country_legal": "GB"},
    "aecom.com": {"country_legal": "US"},
    "bostondynamics.com": {"country_legal": "US"},
    "brewdog.com": {"country_legal": "GB"},
    "circleci.com": {"country_legal": "US"},
    "coda.io": {"country_legal": "US"},
    "consensys.io": {"country_legal": "US"},
    "cosmos.network": {"country_legal": "CH"},
    "deno.com": {"country_legal": "US"},
    "deepgram.com": {"country_legal": "US"},
    "elevenlabs.io": {"country_legal": "US"},
    "exxonmobil.com": {"country_legal": "US"},
    "bandcamp.com": {"country_legal": "US"},
    # bitcoin.org: Decentralized, keep XX
    "celestia.org": {"country_legal": "US"},
    "celo.org": {"country_legal": "US"},
    "chainstack.com": {"country_legal": "SG"},
    "contentsquare.com": {"country_legal": "FR"},
    "crowdin.com": {"country_legal": "US"},
    "decentraland.org": {"country_legal": "AR"},
    "dune.com": {"country_legal": "NO"},
    "doodle.com": {"country_legal": "CH"},
    "deutsche-boerse.com": {"display_name": "Deutsche Börse", "country_legal": "DE"},
    "arize.com": {"country_legal": "US"},
    "astro.build": {"country_legal": "US"},
    "boomi.com": {"country_legal": "US"},
    "crewai.com": {"country_legal": "US"},
    "devin.ai": {"country_legal": "US"},
    "stripe.com": {"country_legal": "US"},
    "openai.com": {"country_legal": "US"},
    "anthropic.com": {"country_legal": "US"},
    "google.com": {"country_legal": "US"},
    "microsoft.com": {"country_legal": "US"},
    "apple.com": {"country_legal": "US"},
    "amazon.com": {"country_legal": "US"},
    "meta.com": {"country_legal": "US"},
    "nvidia.com": {"country_legal": "US"},
    "tesla.com": {"country_legal": "US"},
    "netflix.com": {"country_legal": "US"},
    "spotify.com": {"country_legal": "SE"},
    "shopify.com": {"country_legal": "CA"},
    "cloudflare.com": {"country_legal": "US"},
    "github.com": {"country_legal": "US"},
    "gitlab.com": {"country_legal": "US"},
    "docker.com": {"country_legal": "US"},
    "hashicorp.com": {"country_legal": "US"},
    "twilio.com": {"country_legal": "US"},
    "salesforce.com": {"country_legal": "US"},
    "oracle.com": {"country_legal": "US"},
    "ibm.com": {"country_legal": "US"},
    "intel.com": {"country_legal": "US"},
    "amd.com": {"country_legal": "US"},
    "cisco.com": {"country_legal": "US"},
    "vmware.com": {"country_legal": "US"},
    "atlassian.com": {"country_legal": "AU"},
    "canva.com": {"country_legal": "AU"},
    "figma.com": {"country_legal": "US"},
    "notion.so": {"country_legal": "US"},
    "slack.com": {"country_legal": "US"},
    "zoom.us": {"country_legal": "US"},
    "dropbox.com": {"country_legal": "US"},
    "airbnb.com": {"country_legal": "US"},
    "uber.com": {"country_legal": "US"},
    "lyft.com": {"country_legal": "US"},
    "palantir.com": {"country_legal": "US"},
    "databricks.com": {"country_legal": "US"},
    "snowflake.com": {"country_legal": "US"},
    "datadog.com": {"country_legal": "US"},
    "elastic.co": {"country_legal": "NL"},
    "mongodb.com": {"country_legal": "US"},
    "redis.io": {"country_legal": "US"},
    "vercel.com": {"country_legal": "US"},
    "supabase.com": {"country_legal": "US"},
    "planetscale.com": {"country_legal": "US"},
    "airtable.com": {"country_legal": "US"},
    "zapier.com": {"country_legal": "US"},
    "hubspot.com": {"country_legal": "US"},
    "mailchimp.com": {"country_legal": "US"},
    "sendgrid.com": {"country_legal": "US"},
    "twitch.tv": {"country_legal": "US"},
    "discord.com": {"country_legal": "US"},
    "reddit.com": {"country_legal": "US"},
    "pinterest.com": {"country_legal": "US"},
    "linkedin.com": {"country_legal": "US"},
    "twitter.com": {"country_legal": "US"},
    "x.com": {"country_legal": "US"},
    "tiktok.com": {"country_legal": "CN"},
    "bytedance.com": {"country_legal": "CN"},
    "alibaba.com": {"country_legal": "CN"},
    "tencent.com": {"country_legal": "CN"},
    "baidu.com": {"country_legal": "CN"},
    "huawei.com": {"country_legal": "CN"},
    "xiaomi.com": {"country_legal": "CN"},
    "samsung.com": {"country_legal": "KR"},
    "sony.com": {"country_legal": "JP"},
    "toyota.com": {"country_legal": "JP"},
    "honda.com": {"country_legal": "JP"},
    "panasonic.com": {"country_legal": "JP"},
    "nintendo.com": {"country_legal": "JP"},
    "softbank.com": {"country_legal": "JP"},
    "siemens.com": {"country_legal": "DE"},
    "sap.com": {"country_legal": "DE"},
    "bosch.com": {"country_legal": "DE"},
    "bmw.com": {"country_legal": "DE"},
    "mercedes-benz.com": {"country_legal": "DE"},
    "adidas.com": {"country_legal": "DE"},
    "allianz.com": {"country_legal": "DE"},
    "philips.com": {"country_legal": "NL"},
    "asml.com": {"country_legal": "NL"},
    "unilever.com": {"country_legal": "NL"},
    "shell.com": {"country_legal": "NL"},
    "ikea.com": {"country_legal": "SE"},
    "ericsson.com": {"country_legal": "SE"},
    "volvo.com": {"country_legal": "SE"},
    "nokia.com": {"country_legal": "FI"},
    "dyson.com": {"country_legal": "GB"},
    "arm.com": {"country_legal": "GB"},
    "revolut.com": {"country_legal": "GB"},
    "wise.com": {"country_legal": "GB"},
    "deepmind.com": {"country_legal": "GB"},
    "stability.ai": {"country_legal": "GB"},
    "mistral.ai": {"country_legal": "FR"},
    "huggingface.co": {"country_legal": "US"},
    "cohere.com": {"country_legal": "CA"},
    "perplexity.ai": {"country_legal": "US"},
    "midjourney.com": {"country_legal": "US"},
    "runwayml.com": {"country_legal": "US"},
    "replicate.com": {"country_legal": "US"},
    "together.ai": {"country_legal": "US"},
    "anyscale.com": {"country_legal": "US"},
    "langchain.com": {"country_legal": "US"},
    "pinecone.io": {"country_legal": "US"},
    "weaviate.io": {"country_legal": "NL"},
    "qdrant.tech": {"country_legal": "DE"},
    "chainlink.com": {"country_legal": "US"},
    "ethereum.org": {"country_legal": "CH"},
    "solana.com": {"country_legal": "US"},
    "polygon.technology": {"country_legal": "IN"},
    "avalabs.org": {"country_legal": "US"},
    "near.org": {"country_legal": "CH"},
    "cosmos.network": {"country_legal": "CH"},
    "polkadot.network": {"country_legal": "CH"},
    "cardano.org": {"country_legal": "CH"},
    "ripple.com": {"country_legal": "US"},
    "binance.com": {"country_legal": "KY"},
    "coinbase.com": {"country_legal": "US"},
    "kraken.com": {"country_legal": "US"},
    "uniswap.org": {"country_legal": "US"},
    "lido.fi": {"country_legal": "KY"},
    "opensea.io": {"country_legal": "US"},
}


def domain_from_url(url):
    """Extract clean domain from URL."""
    if not url:
        return None
    try:
        parsed = urlparse(url if url.startswith("http") else f"https://{url}")
        host = parsed.hostname or ""
        # Remove www.
        if host.startswith("www."):
            host = host[4:]
        # Remove port
        host = host.split(":")[0]
        return host.lower()
    except:
        return None


def detect_bad_names(entities):
    """Find entities with suspicious display_names."""
    bad = []

    # Patterns that indicate a bad name
    slogan_words = [
        "welcome", "official", "homepage", "website", "leading", "global",
        "best", "premier", "innovative", "pioneering", "world", "trusted",
        "your", "discover", "explore", "experience", "the future",
        "solutions for", "platform for", "high-resolution", "computation",
        "redefining", "transforming", "empowering", "accelerating",
        "building", "creating", "delivering", "powering", "enabling",
        "reimagining", "revolutionizing", "disrupting",
    ]

    generic_words = [
        "home", "index", "main", "default", "page", "site", "web",
        "start", "landing", "redirect", "redirecting", "loading",
        "untitled", "no title", "error", "404", "403",
    ]

    for e in entities:
        name = (e.get("display_name") or "").strip()
        domain = domain_from_url(e.get("website"))
        if not name or not domain:
            continue

        name_lower = name.lower()
        issues = []

        # Too long (likely a slogan or meta title)
        if len(name) > 50:
            issues.append(f"TOO_LONG ({len(name)} chars)")

        # Contains slogan-like words
        for w in slogan_words:
            if w in name_lower and len(name) > 30:
                issues.append(f"SLOGAN_WORD: '{w}'")
                break

        # Is generic
        if name_lower in generic_words or name_lower.rstrip(".") in generic_words:
            issues.append("GENERIC_NAME")

        # Contains pipe/dash separator (likely a meta title like "Company | Tagline")
        if (" | " in name or " - " in name or " — " in name) and len(name) > 35:
            issues.append("META_TITLE_SEPARATOR")

        # Name is just the domain
        if name_lower == domain.replace(".com", "").replace(".org", "").replace(".io", ""):
            pass  # This is actually OK for many entities

        if issues:
            bad.append({
                "entity_id": e.get("entity_id"),
                "domain": domain,
                "current_name": name,
                "issues": issues,
            })

    return bad


GENERATED_COLUMNS = {"website_normalized"}  # Generated columns that can't be inserted

def apply_single_field_fix(sb_client, entity_id, field_name, new_value):
    """Apply a single field fix using DELETE + INSERT (trigger workaround)."""
    from datetime import datetime, timezone
    full_row = sb_client.table("aya_registry").select("*").eq("entity_id", entity_id).execute()
    if full_row.data:
        row = full_row.data[0]
        row[field_name] = new_value
        row["last_update"] = datetime.now(timezone.utc).isoformat()
        # Remove generated columns
        for col in GENERATED_COLUMNS:
            row.pop(col, None)
        sb_client.table("aya_registry").delete().eq("entity_id", entity_id).execute()
        sb_client.table("aya_registry").insert(row).execute()
    else:
        print(f"    ⚠️ ROW NOT FOUND for {entity_id}")


def main():
    print("=" * 70)
    print("AYA REGISTRY — Data Quality Fix Script")
    print(f"Mode: {'DRY RUN (audit only)' if DRY_RUN else 'APPLY FIXES'}")
    print("=" * 70)

    # Fetch all entities (paginated — Supabase default limit is 1000)
    print("\nFetching entities from Supabase...")
    entities = []
    offset = 0
    batch_size = 1000
    while True:
        result = sb.table("aya_registry").select("entity_id, display_name, website, sector_macro, country_legal, asr_payload").range(offset, offset + batch_size - 1).execute()
        entities.extend(result.data)
        if len(result.data) < batch_size:
            break
        offset += batch_size
    print(f"Total entities: {len(entities)}")

    # ============================================================
    # PHASE 1: Apply KNOWN_FIXES
    # ============================================================
    print("\n" + "=" * 70)
    print("PHASE 1: Known fixes (manually curated)")
    print("=" * 70)

    known_applied = 0
    known_skipped = 0

    for e in entities:
        domain = domain_from_url(e.get("website"))
        if not domain or domain not in KNOWN_FIXES:
            continue

        fixes = KNOWN_FIXES[domain]
        changes = {}

        for field, new_value in fixes.items():
            current = e.get(field, "")
            if current != new_value:
                changes[field] = {"from": current, "to": new_value}

        if not changes:
            known_skipped += 1
            continue

        print(f"\n  [{domain}] (entity_id={e['entity_id']})")
        for field, change in changes.items():
            print(f"    {field}: '{change['from']}' → '{change['to']}'")

        if not DRY_RUN:
            # NOTE: Can't use UPDATE because a broken trigger (set_aya_registry_last_update)
            # references NEW.updated_at but column is last_update.
            # Using DELETE + INSERT instead (same pattern as push_to_aya.py).
            from datetime import datetime, timezone

            # Read full row first
            full_row = sb.table("aya_registry").select("*").eq("entity_id", e["entity_id"]).execute()
            if full_row.data:
                row = full_row.data[0]
                # Apply changes
                for field, change in changes.items():
                    row[field] = change["to"]
                row["last_update"] = datetime.now(timezone.utc).isoformat()
                # Remove generated columns
                for col in GENERATED_COLUMNS:
                    row.pop(col, None)
                # Delete old
                sb.table("aya_registry").delete().eq("entity_id", e["entity_id"]).execute()
                # Insert updated
                sb.table("aya_registry").insert(row).execute()
                print(f"    ✅ UPDATED (delete+insert)")
            else:
                print(f"    ⚠️ ROW NOT FOUND")

        known_applied += 1

    print(f"\nKnown fixes: {known_applied} applied, {known_skipped} already correct")

    # ============================================================
    # PHASE 2: Detect bad names (long slogans, meta titles)
    # ============================================================
    print("\n" + "=" * 70)
    print("PHASE 2: Detect bad names (auto-detection)")
    print("=" * 70)

    bad_names = detect_bad_names(entities)

    # For auto-detected bad names, we try to extract a cleaner name from the domain
    # But ONLY fix those where we have high confidence

    auto_fixes = []
    for item in bad_names:
        domain = item["domain"]
        name = item["current_name"]

        # Skip if already in KNOWN_FIXES
        if domain in KNOWN_FIXES:
            continue

        # Try to extract name before separator
        clean = None
        for sep in [" | ", " - ", " — ", " – ", " :: "]:
            if sep in name:
                parts = name.split(sep)
                # Take the shortest reasonable part
                candidates = [p.strip() for p in parts if 2 < len(p.strip()) < 40]
                if candidates:
                    clean = min(candidates, key=len)
                    break

        if clean and len(clean) < len(name) and len(clean) > 2:
            auto_fixes.append({
                "entity_id": item["entity_id"],
                "domain": domain,
                "current_name": name,
                "proposed_name": clean,
                "issues": item["issues"],
            })

    if auto_fixes:
        print(f"\nFound {len(auto_fixes)} auto-fixable names:")
        auto_applied = 0
        for fix in auto_fixes:
            # Only auto-apply if the name is really obviously bad (>50 chars)
            if len(fix["current_name"]) > 50:
                print(f"  [{fix['domain']}]")
                print(f"    FROM: '{fix['current_name']}'")
                print(f"    TO:   '{fix['proposed_name']}'")

                if not DRY_RUN:
                    apply_single_field_fix(sb, fix["entity_id"], "display_name", fix["proposed_name"])
                    print(f"    ✅ UPDATED")
                auto_applied += 1
            else:
                print(f"  [{fix['domain']}] SKIPPED (name not long enough to auto-fix)")
                print(f"    Current: '{fix['current_name']}'")
                print(f"    Proposed: '{fix['proposed_name']}'")

        print(f"\nAuto-fixed names: {auto_applied}")
    else:
        print("\nNo auto-fixable names found.")

    # ============================================================
    # PHASE 2b: Fix mojibake in names (â, Ã, etc.)
    # ============================================================
    print("\n" + "=" * 70)
    print("PHASE 2b: Fix mojibake characters in names")
    print("=" * 70)

    mojibake_fixes = 0
    # Common UTF-8 mojibake patterns (encoded as unicode escapes to avoid syntax issues)
    mojibake_patterns = [
        ("\u00e2\u0080\u0093", "\u2013"),  # en-dash
        ("\u00e2\u0080\u0094", "\u2014"),  # em-dash
        ("\u00e2\u0080\u0099", "\u2019"),  # right single quote
        ("\u00e2\u0080\u009c", "\u201c"),  # left double quote
        ("\u00e2\u0080\u009d", "\u201d"),  # right double quote
        ("\u00e2\u0080\u00a6", "\u2026"),  # ellipsis
        ("\u00c3\u00a9", "\u00e9"),  # e-acute
        ("\u00c3\u00a8", "\u00e8"),  # e-grave
        ("\u00c3\u00a0", "\u00e0"),  # a-grave
        ("\u00c3\u00a2", "\u00e2"),  # a-circumflex
        ("\u00c3\u00ae", "\u00ee"),  # i-circumflex
        ("\u00c3\u00b4", "\u00f4"),  # o-circumflex
        ("\u00c3\u00bc", "\u00fc"),  # u-umlaut
        ("\u00c3\u00b6", "\u00f6"),  # o-umlaut
        ("\u00c3\u00a4", "\u00e4"),  # a-umlaut
        ("\u00c3\u00a7", "\u00e7"),  # c-cedilla
    ]

    for e in entities:
        name = e.get("display_name", "")
        if not name:
            continue

        # Check for mojibake patterns
        fixed = name
        for bad, good in mojibake_patterns:
            if bad in fixed:
                fixed = fixed.replace(bad, good)

        if fixed != name:
            domain = domain_from_url(e.get("website"))
            # Skip if already in KNOWN_FIXES (those take priority)
            if domain in KNOWN_FIXES:
                continue
            print(f"  [{domain}] '{name}' -> '{fixed}'")
            if not DRY_RUN:
                apply_single_field_fix(sb, e["entity_id"], "display_name", fixed)
            mojibake_fixes += 1

    print(f"\nMojibake fixes: {mojibake_fixes}")

    # Also report remaining bad names that we couldn't auto-fix
    auto_fixed_domains = set(f["domain"] for f in auto_fixes if len(f["current_name"]) > 50)
    remaining_bad = [b for b in bad_names if b["domain"] not in KNOWN_FIXES and b["domain"] not in auto_fixed_domains]

    if remaining_bad:
        print(f"\n--- Remaining suspicious names (NOT auto-fixed, review manually): ---")
        for item in remaining_bad[:30]:  # Show first 30
            print(f"  [{item['domain']}] '{item['current_name']}' — {', '.join(item['issues'])}")

    # ============================================================
    # PHASE 3: Fix country XX for well-known .com domains
    # ============================================================
    print("\n" + "=" * 70)
    print("PHASE 3: Country XX entities")
    print("=" * 70)

    xx_entities = [e for e in entities if e.get("country_legal") == "XX"]
    print(f"Total entities with country=XX: {len(xx_entities)}")

    # We already fixed many via KNOWN_FIXES, count remaining
    xx_remaining = []
    for e in xx_entities:
        domain = domain_from_url(e.get("website"))
        if domain and domain not in KNOWN_FIXES:
            xx_remaining.append({
                "domain": domain,
                "name": e.get("display_name", ""),
                "entity_id": e["entity_id"],
            })

    print(f"XX entities already covered by known fixes: {len(xx_entities) - len(xx_remaining)}")
    print(f"XX entities remaining (not in known fixes): {len(xx_remaining)}")

    if xx_remaining:
        print(f"\n--- Sample XX entities (first 30): ---")
        for item in xx_remaining[:30]:
            print(f"  [{item['domain']}] '{item['name']}'")

    # ============================================================
    # SUMMARY
    # ============================================================
    print("\n" + "=" * 70)
    print("SUMMARY")
    print("=" * 70)
    print(f"Total entities: {len(entities)}")
    print(f"Known fixes applied: {known_applied}")
    print(f"Auto-fixed names (>50 chars): {len([f for f in auto_fixes if len(f['current_name']) > 50]) if auto_fixes else 0}")
    print(f"Bad names detected (all): {len(bad_names)}")
    print(f"Country XX remaining: {len(xx_remaining)}")

    if DRY_RUN:
        print(f"\n⚠️  DRY RUN — No changes applied. Run with --apply to fix.")
    else:
        print(f"\n✅ All fixes applied.")


if __name__ == "__main__":
    main()
