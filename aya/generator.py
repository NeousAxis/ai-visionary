"""
AYA Generator — Builds AYA_PREINDEX + ASR_DERIVED records from scraped data.
"""

import json
import os
import re
from datetime import datetime, timezone

from parser import (
    extract_title_and_meta,
    extract_jsonld,
    extract_visible_text,
    extract_emails,
    extract_phones,
    extract_country_from_jsonld,
    normalize_country,
    extract_city_from_jsonld,
    count_sitemap_urls,
    detect_sector,
    detect_country_from_tld,
)

# AIO block weights (Bible AIO) — Mirror of lib/aio-score-engine.ts, keep in sync
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
    # Page-specific generics
    "redirecting", "redirecting...", "newest questions",
    "accueil passagers", "privatkunden", "global home page",
    "news and perspectives",
}

COUNTRY_NAMES_NOT_ENTITY = {
    "switzerland", "suisse", "schweiz", "svizzera",
    "france", "germany", "deutschland", "italia", "italy",
    "españa", "spain", "united states", "united kingdom",
    "canada", "australia", "japan", "china", "india",
    "brasil", "brazil", "portugal", "austria", "österreich",
    "belgium", "belgique", "nederland", "netherlands",
    "luxembourg", "europe", "africa", "asia",
}

SLOGAN_INDICATORS = [
    # English
    "the best", "the leading", "the #1", "the number",
    "pioneering", "leading the", "transforming", "empowering",
    "your partner", "for a safe", "for speed", "for the future",
    "welcome to ", "we help", "we make", "we build", "we are",
    "enabling", "reimagining", "redefining", "unlocking",
    "connect, protect",
    "how to ", "smart data", "production-grade",
    "world leader", "passwords, secrets",
    "container orchestration", "workflow platform",
    "data platform", "data capture", "ai revenue",
    "ai platform", "marketing platform",
    "for the entire",
    # French
    "votre partenaire", "la référence", "toute la ", "tout le ",
    "découvrez", "bienvenue chez ", "bienvenue sur ",
    # German
    "günstige ", "willkommen", "führend", "für ki", "konzipiert",
    "entdecken", "suchen auf", "die schweizer",
    "trends und angebote", "im online shop",
]

# Verbs/adverbs that start slogans — checked via startswith() in _is_slogan
_ACTION_STARTERS = (
    "manage ", "secure ", "acheter ", "discover ", "arbeit ", "finally",
)

# Post-comma marketing words — "Name, tagline" detection in _is_slogan
_COMMA_MARKETING = ("world leader", "your way", "since ", "seit ", "votre ")

# Known brand names that can't be derived from domain capitalization
KNOWN_BRANDS = {
    "stackoverflow": "Stack Overflow",
    "postfinance": "PostFinance",
    "deepl": "DeepL",
    "wordpress": "WordPress",
    "hashicorp": "HashiCorp",
    "bigcommerce": "BigCommerce",
    "digitalocean": "DigitalOcean",
    "1password": "1Password",
    "mailchimp": "Mailchimp",
    "cloudflare": "Cloudflare",
    "snowflake": "Snowflake",
    "gitlab": "GitLab",
    "github": "GitHub",
    "linkedin": "LinkedIn",
    "youtube": "YouTube",
    "woocommerce": "WooCommerce",
    "sushizen": "SushiZen",
}

# Subdomain prefixes to strip when deriving name from domain
SUBDOMAIN_PREFIXES = {"about", "www", "fr", "de", "en", "developer", "group", "jira", "docs", "blog"}


def _clean_encoding(text: str) -> str:
    """Fix encoding issues: invisible chars, mojibake, trailing dots."""
    if not text:
        return ""
    # Remove zero-width characters
    text = re.sub(r'[\u200b\u200c\u200d\u200e\u200f\ufeff]', '', text)
    # Remove trailing dots (unless abbreviation like "S.A.")
    text = re.sub(r'\.{2,}$', '', text)
    # Strip leading dash
    if text.startswith('- '):
        text = text[2:]
    return text.strip()


def _strip_prefix(text: str) -> str:
    """Remove common prefixes like 'Welcome to ' and return the name part."""
    lower = text.lower().strip()
    prefixes = [
        "welcome to ", "bienvenue chez ", "bienvenue sur ", "bienvenue à ",
        "willkommen bei der ", "willkommen an der ", "willkommen bei ",
        "willkommen an ", "willkommen auf ",
    ]
    for prefix in prefixes:
        if lower.startswith(prefix):
            return text[len(prefix):].strip()
    return text


def _is_slogan(text: str) -> bool:
    """Detect if text is a marketing slogan rather than a company name."""
    lower = text.lower().strip()
    if len(lower) <= 1 or len(lower) > 50:
        return True
    if any(ind in lower for ind in SLOGAN_INDICATORS):
        return True
    if lower.startswith(("the ", "le ", "la ", "les ", "un ", "une ", "des ")) and len(lower) > 25:
        return True
    if lower.startswith(_ACTION_STARTERS):
        return True
    if ',' in lower:
        after_comma = lower.split(',', 1)[1].strip()
        if any(m in after_comma for m in _COMMA_MARKETING):
            return True
    return False


def _is_generic(text: str) -> bool:
    """Check if text is a generic page name, country name, or technical slug."""
    lower = text.lower().strip()
    if lower in GENERIC_NAMES or lower in COUNTRY_NAMES_NOT_ENTITY:
        return True
    # Technical slugs with underscores (e.g. "home_leisure", "main_page")
    if "_" in lower and " " not in lower:
        return True
    return False


def _clean_domain(domain: str) -> str:
    """Normalize domain: strip port, strip known subdomain prefixes."""
    domain = re.sub(r':\d+$', '', domain)  # "qonto.com:443" → "qonto.com"
    parts = domain.split('.')
    if len(parts) >= 3 and parts[0] in SUBDOMAIN_PREFIXES:
        domain = '.'.join(parts[1:])
    return domain


def _clean_title(raw: str, domain: str = "") -> str:
    """Extract company name from a <title> tag."""
    if not raw:
        return ""
    raw = _clean_encoding(raw)
    if not raw:
        return ""

    # Split on separators: |, –, —, ·, \, and " - "
    parts = re.split(r'\s*[|–—·\\]\s*|\s+-\s+|\s*:\s+', raw)
    parts = [p.strip() for p in parts if p.strip()]

    if len(parts) <= 1:
        # No separator — try comma split for "Name, tagline" pattern
        if ',' in raw:
            comma_parts = raw.split(',', 1)
            first = comma_parts[0].strip()
            second = comma_parts[1].strip()
            if _is_slogan(second) or _is_generic(second):
                if first and not _is_generic(first):
                    return first[:120]
        result = raw.strip()
        if _is_generic(result):
            return ""
        return result[:120]

    # Filter out generic, domain-echo, and slogan parts
    candidates = []
    for p in parts:
        if _is_generic(p):
            continue
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
        # Otherwise take the shortest meaningful part (usually the name, not description)
        return min(candidates, key=len)[:120]

    # All parts were filtered — try domain-matching among ALL parts
    if domain:
        for p in parts:
            if not _is_generic(p) and _name_matches_domain(p, domain):
                return p[:120]

    # Last resort: shortest non-generic part
    non_generic = [p for p in parts if not _is_generic(p)]
    if non_generic:
        return min(non_generic, key=len)[:120]

    return ""


def _domain_to_name(domain: str) -> str:
    """Convert domain.com → Domain (capitalized, no TLD)."""
    name = domain.split(".")[0] if "." in domain else domain
    if name.lower() in KNOWN_BRANDS:
        return KNOWN_BRANDS[name.lower()]
    return name.capitalize()


def _name_matches_domain(name: str, domain: str) -> bool:
    """Check if a candidate name is plausibly related to the domain."""
    name_lower = name.lower().replace(" ", "").replace("-", "")
    domain_base = domain.split(".")[0].lower().replace("-", "") if "." in domain else domain.lower()
    if domain_base in name_lower or name_lower in domain_base:
        return True
    for i in range(len(name_lower) - 3):
        if name_lower[i:i+4] in domain_base:
            return True
    return False


def detect_entity_name(meta: dict, jsonld_payloads: list, domain: str) -> str:
    """Extract entity name from JSON-LD, meta tags, or domain."""
    # Clean domain first (strip port, subdomain)
    domain = _clean_domain(domain)
    domain_fallback = _domain_to_name(domain)

    # Try JSON-LD first
    for payload in jsonld_payloads:
        items = payload if isinstance(payload, list) else [payload]
        for item in items:
            if isinstance(item, dict) and item.get("name"):
                raw_name = _clean_encoding(str(item["name"]).strip())
                # Clean separators in JSON-LD names too (e.g. "Éclore | Transition écologique")
                name = _clean_title(raw_name, domain) if ("|" in raw_name or " - " in raw_name or " — " in raw_name) else raw_name
                if not name or _is_generic(name) or _is_slogan(name):
                    continue
                if " " not in name and not _name_matches_domain(name, domain):
                    continue
                return name[:120]

    # Then meta tags
    for raw in [meta.get("og_title", ""), meta.get("title", "")]:
        if not raw:
            continue
        cleaned = _clean_title(raw, domain)
        if not cleaned or _is_generic(cleaned):
            continue
        if _is_slogan(cleaned):
            stripped = _strip_prefix(cleaned)
            if stripped != cleaned and not _is_generic(stripped) and not _is_slogan(stripped):
                return stripped[:120]
            continue
        return cleaned

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
    raw_country = extract_country_from_jsonld(jsonld_payloads)
    country = normalize_country(raw_country)
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
