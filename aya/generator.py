"""
AYA Generator — Builds AYA_PREINDEX + ASR_DERIVED records from scraped data.
"""

import json
import os
from datetime import datetime, timezone

from parser import (
    extract_title_and_meta,
    extract_jsonld,
    extract_visible_text,
    extract_emails,
    extract_phones,
    extract_country_from_jsonld,
    extract_city_from_jsonld,
    count_sitemap_urls,
    detect_sector,
    detect_country_from_tld,
)

# AIO block weights (Bible AIO)
BLOCK_WEIGHTS = {
    "identite": 10,
    "offre": 20,
    "processus_methodes": 15,
    "engagements_conformite": 15,
    "indicateurs": 20,
    "contenus_pedagogiques": 10,
    "structure_technique": 10,
}

OFFER_KEYWORDS = [
    "service", "services", "product", "products", "solution", "solutions",
    "platform", "application", "app", "software", "consulting",
    "restaurant", "delivery", "menu", "saas", "cloud", "api",
    "prestation", "offre", "produit", "produits",
]

PROCESS_KEYWORDS = [
    "how it works", "comment ça marche", "notre méthode", "our process",
    "methodology", "méthodologie", "étapes", "steps", "workflow",
    "how we work", "notre approche",
]

COMPLIANCE_KEYWORDS = [
    "privacy", "terms", "cookies", "gdpr", "rgpd", "legal",
    "confidentialité", "conditions", "mentions légales",
    "certification", "iso", "compliance", "conformité",
]

PEDAGOGY_KEYWORDS = [
    "faq", "documentation", "glossary", "glossaire", "guide",
    "tutorial", "tutoriel", "help", "aide", "blog", "articles",
    "knowledge base", "base de connaissances",
]


GENERIC_NAMES = {
    "home", "homepage", "accueil", "welcome", "bienvenue",
    "start", "index", "main", "default", "page d'accueil",
    "untitled", "sans titre", "new tab", "nouvel onglet",
    # Country names that sites use as JSON-LD name instead of company name
    "switzerland", "suisse", "schweiz", "svizzera",
    "france", "germany", "deutschland", "italia", "italy",
    "españa", "spain", "united states", "united kingdom",
    "canada", "australia", "japan", "china", "india",
    "brasil", "brazil", "portugal", "austria", "österreich",
    "belgium", "belgique", "nederland", "netherlands",
    "luxembourg", "europe", "africa", "asia",
}

SLOGAN_INDICATORS = [
    "the best", "the leading", "the #1", "the number",
    "pioneering", "leading the", "transforming", "empowering",
    "your partner", "votre partenaire", "la référence",
    "for a safe", "for speed", "for the future",
    "toute la ", "tout le ", "découvrez", "bienvenue",
    "welcome to ", "bienvenue chez ", "bienvenue sur ",
    "we help", "we make", "we build", "we are",
    "enabling", "reimagining", "redefining", "unlocking",
]


def _strip_prefix(text: str) -> str:
    """Remove common prefixes like 'Welcome to ' and return the name part."""
    lower = text.lower().strip()
    prefixes = ["welcome to ", "bienvenue chez ", "bienvenue sur ", "bienvenue à "]
    for prefix in prefixes:
        if lower.startswith(prefix):
            return text[len(prefix):].strip()
    return text


def _is_slogan(text: str) -> bool:
    """Detect if text is a marketing slogan rather than a company name."""
    lower = text.lower().strip()
    # Too long to be a name (> 60 chars is likely a slogan/description)
    if len(lower) > 60:
        return True
    # Contains slogan patterns
    for indicator in SLOGAN_INDICATORS:
        if indicator in lower:
            return True
    # Starts with an article → likely a description
    if lower.startswith(("the ", "le ", "la ", "les ", "un ", "une ", "des ")):
        # Exception: "The New York Times" etc. — allow if short
        if len(lower) > 30:
            return True
    return False


def _is_generic(text: str) -> bool:
    """Check if text is a generic/useless page name."""
    return text.lower().strip() in GENERIC_NAMES


def _clean_title(raw: str, domain: str = "") -> str:
    """Extract company name from a <title> like 'Stripe | Payment processing'.

    Strategy:
    1. Split on separators (|, -, —, –, :, ·)
    2. Filter out generic/slogan parts
    3. Prefer the part that matches the domain
    4. Otherwise take the longest meaningful part (names > slogans)
    """
    if not raw:
        return ""
    # Split on ALL separators at once
    import re
    parts = re.split(r'\s*[|–—·]\s*|\s+-\s+|\s*:\s+', raw)
    parts = [p.strip() for p in parts if p.strip()]

    if len(parts) <= 1:
        result = raw.strip()
        if _is_generic(result):
            return ""
        return result[:120]

    # Filter out generic and domain-echo parts (e.g. "ge.ch" in "ge.ch – République...")
    candidates = []
    for p in parts:
        if _is_generic(p):
            continue
        # Skip if it's just the domain itself (e.g. "ge.ch")
        if domain and p.lower().strip() == domain.lower().strip():
            continue
        if _is_slogan(p):
            continue
        candidates.append(p)

    if candidates:
        # Prefer the part matching the domain
        if domain:
            for c in candidates:
                if _name_matches_domain(c, domain):
                    return c[:120]
        # Otherwise take the longest meaningful part (usually the real name)
        return max(candidates, key=len)[:120]

    # All parts were filtered — try domain-matching among ALL parts
    if domain:
        for p in parts:
            if not _is_generic(p) and _name_matches_domain(p, domain):
                return p[:120]

    # Last resort: longest non-generic part
    non_generic = [p for p in parts if not _is_generic(p)]
    if non_generic:
        return max(non_generic, key=len)[:120]

    return ""


def _domain_to_name(domain: str) -> str:
    """Convert domain.com → Domain (capitalized, no TLD)."""
    name = domain.split(".")[0] if "." in domain else domain
    # Handle compound domains: swissinfo → Swissinfo, protonvpn → Protonvpn
    return name.capitalize()


def _name_matches_domain(name: str, domain: str) -> bool:
    """Check if a candidate name is plausibly related to the domain."""
    name_lower = name.lower().replace(" ", "").replace("-", "")
    domain_base = domain.split(".")[0].lower().replace("-", "") if "." in domain else domain.lower()
    # Direct match or containment
    if domain_base in name_lower or name_lower in domain_base:
        return True
    # Partial overlap (at least 4 chars in common)
    for i in range(len(name_lower) - 3):
        chunk = name_lower[i:i+4]
        if chunk in domain_base:
            return True
    return False


def detect_entity_name(meta: dict, jsonld_payloads: list, domain: str) -> str:
    """Extract entity name from JSON-LD, meta tags, or domain.

    Priority:
    1. JSON-LD 'name' field (if not a slogan/generic)
    2. og:title / title (cleaned — before separator, not slogan/generic)
    3. Domain name (capitalized)
    """
    domain_fallback = _domain_to_name(domain)

    # Try JSON-LD first — most reliable source
    for payload in jsonld_payloads:
        items = payload if isinstance(payload, list) else [payload]
        for item in items:
            if isinstance(item, dict) and item.get("name"):
                name = str(item["name"]).strip()
                if _is_generic(name) or _is_slogan(name):
                    continue
                # Single-word name that doesn't match domain → suspicious
                if " " not in name and not _name_matches_domain(name, domain):
                    continue
                return name[:120]

    # Then meta tags — clean before use
    for raw in [meta.get("og_title", ""), meta.get("title", "")]:
        if not raw:
            continue
        cleaned = _clean_title(raw, domain)
        if not cleaned or _is_generic(cleaned):
            continue
        # If it's a slogan, try stripping "Welcome to" etc.
        if _is_slogan(cleaned):
            stripped = _strip_prefix(cleaned)
            if stripped != cleaned and not _is_generic(stripped) and not _is_slogan(stripped):
                return stripped[:120]
            continue
        return cleaned

    # Fallback: domain name (e.g. swissinfo.ch → Swissinfo)
    return domain_fallback


def detect_keywords(text: str, keywords: list) -> list:
    lower_text = text.lower()
    return sorted(set(kw for kw in keywords if kw in lower_text))


def estimate_block_fill(block: dict) -> float:
    """Estimate how complete a block is (0.0 to 1.0)."""
    if not block["present"]:
        return 0.0
    fields = block.get("fields", {})
    if not fields:
        return 0.3  # Present but no structured fields
    filled = sum(1 for v in fields.values() if v)
    total = len(fields) if fields else 1
    return max(0.3, min(1.0, filled / total))


def estimate_aio_score(blocks: dict, has_jsonld: bool, has_sitemap: bool) -> dict:
    """Calculate AIO score with per-block breakdown."""
    block_scores = {}
    raw_total = 0

    for block_name, weight in BLOCK_WEIGHTS.items():
        fill = estimate_block_fill(blocks[block_name])
        block_score = round(weight * fill, 1)
        block_scores[block_name] = {
            "weight": weight,
            "fill": round(fill, 2),
            "score": block_score,
        }
        raw_total += block_score

    raw_total = round(raw_total, 1)

    # Hard caps (Bible AIO)
    cap_applied = False
    cap_reason = None
    final_score = raw_total

    if not has_jsonld:
        if final_score > 50:
            final_score = 50
            cap_applied = True
            cap_reason = "no_jsonld_no_aya"

    return {
        "raw_score": raw_total,
        "final_score": round(final_score),
        "cap_applied": cap_applied,
        "cap_reason": cap_reason,
        "block_scores": block_scores,
    }


def detect_org_type_from_jsonld(payloads: list) -> str:
    """Try to detect organization type from JSON-LD @type."""
    for payload in payloads:
        items = payload if isinstance(payload, list) else [payload]
        for item in items:
            if isinstance(item, dict):
                t = item.get("@type", "")
                if isinstance(t, list):
                    t = t[0] if t else ""
                if t:
                    return str(t)
    return ""


def build_record(scraped: dict) -> dict:
    homepage_html = scraped["homepage"]["text"]
    homepage_url = scraped["homepage"]["url"] or scraped["input_url"]

    meta = extract_title_and_meta(homepage_html) if homepage_html else {}
    text = extract_visible_text(homepage_html) if homepage_html else ""
    jsonld_payloads = extract_jsonld(homepage_html) if homepage_html else []

    all_text = text
    pages_scanned = [homepage_url]
    for page in scraped["key_pages"]:
        all_text += " " + extract_visible_text(page["text"])
        pages_scanned.append(page["url"])

    emails = extract_emails(all_text)
    phones = extract_phones(all_text)

    has_jsonld = len(jsonld_payloads) > 0
    has_sitemap = bool(scraped["sitemap"]["ok"])

    offer_found = detect_keywords(all_text, OFFER_KEYWORDS)
    process_found = detect_keywords(all_text, PROCESS_KEYWORDS)
    compliance_found = detect_keywords(all_text, COMPLIANCE_KEYWORDS)
    pedagogy_found = detect_keywords(all_text, PEDAGOGY_KEYWORDS)

    entity_name = detect_entity_name(meta, jsonld_payloads, scraped["canonical_domain"])
    country = extract_country_from_jsonld(jsonld_payloads)
    if not country:
        country = detect_country_from_tld(scraped["canonical_domain"])
    city = extract_city_from_jsonld(jsonld_payloads)
    org_type = detect_org_type_from_jsonld(jsonld_payloads)
    sector = detect_sector(all_text, jsonld_payloads, scraped["canonical_domain"])
    sitemap_url_count = count_sitemap_urls(scraped["sitemap"]["text"]) if scraped["sitemap"]["ok"] else 0

    blocks = {
        "identite": {
            "present": bool(meta.get("title") or emails or phones or entity_name),
            "fields": {
                "name": entity_name,
                "website": homepage_url,
                "email": emails[0] if emails else "",
                "phone": phones[0] if phones else "",
                "country": country,
                "city": city,
                "org_type": org_type,
            },
            "evidence": [meta.get("title", "")[:100]],
        },
        "offre": {
            "present": len(offer_found) > 0,
            "fields": {
                "keywords_detected": offer_found,
                "meta_description": meta.get("meta_description", "")[:300],
                "og_description": meta.get("og_description", "")[:300],
            },
            "evidence": offer_found[:5],
        },
        "processus_methodes": {
            "present": len(process_found) > 0,
            "fields": {
                "keywords_detected": process_found,
            },
            "evidence": process_found[:3],
        },
        "engagements_conformite": {
            "present": len(compliance_found) > 0,
            "fields": {
                "keywords_detected": compliance_found,
            },
            "evidence": compliance_found[:5],
        },
        "indicateurs": {
            "present": False,
            "fields": {},
            "evidence": [],
        },
        "contenus_pedagogiques": {
            "present": len(pedagogy_found) > 0,
            "fields": {
                "keywords_detected": pedagogy_found,
            },
            "evidence": pedagogy_found[:3],
        },
        "structure_technique": {
            "present": has_jsonld or has_sitemap or bool(meta.get("canonical")),
            "fields": {
                "has_jsonld": has_jsonld,
                "has_sitemap": has_sitemap,
                "canonical_present": bool(meta.get("canonical")),
                "hreflang_present": bool(meta.get("hreflang_present")),
                "jsonld_types": [
                    detect_org_type_from_jsonld([p]) for p in jsonld_payloads
                ],
            },
            "evidence": [],
        },
    }

    scoring = estimate_aio_score(blocks, has_jsonld, has_sitemap)

    record = {
        "version": "AYA-PREINDEX-1.0",
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "source": {
            "input_url": scraped["input_url"],
            "canonical_domain": scraped["canonical_domain"],
            "pages_scanned": pages_scanned,
            "pages_scanned_count": len(pages_scanned),
            "structured_data_found": {
                "asr_found": False,
                "jsonld_found": has_jsonld,
                "jsonld_count": len(jsonld_payloads),
                "sitemap_found": has_sitemap,
                "sitemap_url_count": sitemap_url_count,
            },
        },
        "entity": {
            "is_organization": True,
            "name": entity_name,
            "website": homepage_url,
            "country": country,
            "city": city,
            "languages": [],
            "org_type": org_type,
            "contacts": {
                "email": emails[0] if emails else "",
                "phone": phones[0] if phones else "",
                "address": "",
            },
        },
        "sector": sector,
        "aio_blocks": blocks,
        "aio_scoring": scoring,
        "aoi_readiness": {
            "blocks_present": [k for k, v in blocks.items() if v["present"]],
            "blocks_missing": [k for k, v in blocks.items() if not v["present"]],
            "estimated_aio_score": scoring["final_score"],
            "raw_score": scoring["raw_score"],
            "cap_applied": scoring["cap_applied"],
            "cap_reason": scoring["cap_reason"],
            "confidence": 60 if has_jsonld else 35,
        },
        "extracted_structured_payloads": {
            "asr": None,
            "jsonld": jsonld_payloads,
        },
        "asr_derived": {
            "asr_status": "ASR_DERIVED",
            "source": "AYA-BOT",
            "version": "0.1",
            "confidence": round(0.6 if has_jsonld else 0.35, 2),
            "generated_at": datetime.now(timezone.utc).isoformat(),
        },
    }

    return record


def save_record(record: dict, folder: str = "data") -> str:
    os.makedirs(folder, exist_ok=True)
    domain = record["source"]["canonical_domain"].replace("/", "_")
    filepath = os.path.join(folder, f"{domain}.json")
    with open(filepath, "w", encoding="utf-8") as f:
        json.dump(record, f, ensure_ascii=False, indent=2)
    return filepath
