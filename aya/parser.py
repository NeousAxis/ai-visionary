"""
AYA Parser — Extracts structured data from HTML pages.
"""

import json
import re
from urllib.parse import urljoin, urlparse

from bs4 import BeautifulSoup

KEY_PAGES = [
    "/about",
    "/a-propos",
    "/contact",
    "/services",
    "/products",
    "/pricing",
    "/faq",
    "/legal",
    "/privacy",
    "/terms",
]


def clean_text(text: str) -> str:
    if not text:
        return ""
    text = re.sub(r"\s+", " ", text).strip()
    return text


def get_domain(url: str) -> str:
    parsed = urlparse(url)
    return parsed.netloc.lower().replace("www.", "")


def extract_title_and_meta(html: str) -> dict:
    soup = BeautifulSoup(html, "lxml")

    title = soup.title.string.strip() if soup.title and soup.title.string else ""

    meta_description = ""
    meta_desc_tag = soup.find("meta", attrs={"name": "description"})
    if meta_desc_tag and meta_desc_tag.get("content"):
        meta_description = meta_desc_tag["content"].strip()

    og_title = ""
    og_title_tag = soup.find("meta", attrs={"property": "og:title"})
    if og_title_tag and og_title_tag.get("content"):
        og_title = og_title_tag["content"].strip()

    og_description = ""
    og_desc_tag = soup.find("meta", attrs={"property": "og:description"})
    if og_desc_tag and og_desc_tag.get("content"):
        og_description = og_desc_tag["content"].strip()

    canonical = ""
    canonical_tag = soup.find("link", attrs={"rel": "canonical"})
    if canonical_tag and canonical_tag.get("href"):
        canonical = canonical_tag["href"].strip()

    hreflang_tags = soup.find_all("link", attrs={"hreflang": True})
    hreflang_present = len(hreflang_tags) > 0
    hreflang_values = [tag["hreflang"] for tag in hreflang_tags if tag.get("hreflang")]

    return {
        "title": title,
        "meta_description": meta_description,
        "og_title": og_title,
        "og_description": og_description,
        "canonical": canonical,
        "hreflang_present": hreflang_present,
        "_hreflang_values": hreflang_values,
    }


def extract_jsonld(html: str) -> list:
    soup = BeautifulSoup(html, "lxml")
    scripts = soup.find_all("script", attrs={"type": "application/ld+json"})
    payloads = []
    for script in scripts:
        raw = script.string or script.get_text() or ""
        raw = raw.strip()
        if raw:
            try:
                parsed = json.loads(raw)
                payloads.append(parsed)
            except json.JSONDecodeError:
                pass
    return payloads


def extract_emails(text: str) -> list:
    if not text:
        return []
    emails = re.findall(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}", text)
    return list(sorted(set(emails)))


def extract_phones(text: str) -> list:
    if not text:
        return []
    phones = re.findall(r"\+?\d[\d\s().-]{7,}\d", text)
    return list(sorted(set(p.strip() for p in phones)))


def extract_visible_text(html: str) -> str:
    soup = BeautifulSoup(html, "lxml")
    for tag in soup(["script", "style", "noscript"]):
        tag.decompose()
    text = soup.get_text(separator=" ")
    return clean_text(text)


def detect_key_pages(base_url: str) -> list:
    return [urljoin(base_url, path) for path in KEY_PAGES]


def extract_country_from_jsonld(payloads: list) -> str:
    """Try to extract country from JSON-LD address."""
    for payload in payloads:
        items = payload if isinstance(payload, list) else [payload]
        for item in items:
            if not isinstance(item, dict):
                continue
            address = item.get("address", {})
            if isinstance(address, dict):
                country = address.get("addressCountry", "")
                if country:
                    return country
    return ""


def extract_city_from_jsonld(payloads: list) -> str:
    """Try to extract city from JSON-LD address."""
    for payload in payloads:
        items = payload if isinstance(payload, list) else [payload]
        for item in items:
            if not isinstance(item, dict):
                continue
            address = item.get("address", {})
            if isinstance(address, dict):
                city = address.get("addressLocality", "")
                if city:
                    return city
    return ""


def parse_sitemap_urls(xml_text: str, limit: int = 200) -> list:
    """Extract URLs from a sitemap XML. Returns up to `limit` URLs."""
    if not xml_text:
        return []
    try:
        soup = BeautifulSoup(xml_text, "lxml-xml")
        urls = []
        for loc in soup.find_all("loc"):
            url = loc.get_text().strip()
            if url:
                urls.append(url)
            if len(urls) >= limit:
                break
        return urls
    except Exception:
        return []


def count_sitemap_urls(xml_text: str) -> int:
    """Count total URLs in sitemap without loading all."""
    if not xml_text:
        return 0
    return xml_text.count("<loc>")


# === SECTOR DETECTION ===

SECTOR_RULES = [
    {
        "id": "finance",
        "label": "Finance & Banque",
        "keywords": ["bank", "banque", "crédit", "investment", "fintech", "trading", "insurance", "assurance", "versicherung", "mortgage", "hypothèque", "wealth", "patrimoine", "portfolio", "vorsorge", "prévoyance", "pension"],
        "jsonld_types": ["BankOrCreditUnion", "FinancialService", "InsuranceAgency"],
    },
    {
        "id": "tech",
        "label": "Technologie & SaaS",
        "keywords": ["software", "saas", "cloud", "api", "platform", "developer", "devops", "data", "analytics", "machine learning", "artificial intelligence", "cybersecurity"],
        "jsonld_types": ["SoftwareApplication", "WebApplication"],
    },
    {
        "id": "ecommerce",
        "label": "E-commerce & Retail",
        "keywords": ["shop", "store", "boutique", "buy", "cart", "checkout", "livraison", "delivery", "marketplace", "produit", "product"],
        "jsonld_types": ["Store", "OnlineStore", "ShoppingCenter"],
    },
    {
        "id": "food",
        "label": "Restauration & Alimentation",
        "keywords": ["restaurant", "café", "menu", "cuisine", "food", "repas", "chef", "réservation", "bistro", "brasserie", "traiteur", "catering"],
        "jsonld_types": ["Restaurant", "FoodEstablishment", "CafeOrCoffeeShop", "Bakery"],
    },
    {
        "id": "health",
        "label": "Santé & Pharma",
        "keywords": ["health", "santé", "medical", "pharma", "clinical", "patient", "hospital", "hôpital", "therapy", "diagnostic", "biotech"],
        "jsonld_types": ["Hospital", "MedicalClinic", "Pharmacy", "MedicalOrganization"],
    },
    {
        "id": "education",
        "label": "Éducation & Formation",
        "keywords": ["university", "université", "school", "école", "formation", "training", "course", "student", "étudiant", "campus", "academic", "research"],
        "jsonld_types": ["EducationalOrganization", "School", "CollegeOrUniversity"],
    },
    {
        "id": "consulting",
        "label": "Conseil & Services Pro",
        "keywords": ["consulting", "conseil", "advisory", "strategy", "audit", "expertise", "cabinet", "fiduciaire", "accounting", "comptabilité", "legal", "juridique"],
        "jsonld_types": ["ProfessionalService", "AccountingService", "LegalService"],
    },
    {
        "id": "travel",
        "label": "Tourisme & Transport",
        "keywords": ["travel", "voyage", "hotel", "hôtel", "booking", "flight", "vol", "tourism", "tourisme", "transport", "airline", "train", "destination", "explore", "attractions", "visitor", "sightseeing", "excursion", "séjour", "vacances"],
        "jsonld_types": ["Hotel", "TravelAgency", "Airline", "TrainStation"],
    },
    {
        "id": "media",
        "label": "Média & Communication",
        "keywords": ["news", "media", "journal", "press", "presse", "magazine", "broadcast", "podcast", "video", "streaming", "marketing", "agence", "agency", "publicité"],
        "jsonld_types": ["NewsMediaOrganization", "MediaObject"],
    },
    {
        "id": "manufacturing",
        "label": "Industrie & Manufacturing",
        "keywords": ["manufacturing", "industrial", "factory", "production", "engineering", "construction", "materials", "matériaux", "machine", "automation"],
        "jsonld_types": ["Corporation"],
    },
    {
        "id": "luxury",
        "label": "Luxe & Mode",
        "keywords": ["luxury", "luxe", "fashion", "mode", "watch", "montre", "jewelry", "bijoux", "haute couture", "designer", "premium", "exclusive"],
        "jsonld_types": ["Brand"],
    },
    {
        "id": "realestate",
        "label": "Immobilier",
        "keywords": ["immobilier", "real estate", "property", "logement", "appartement", "apartment", "maison", "house", "location", "rental", "louer"],
        "jsonld_types": ["RealEstateAgent", "Apartment"],
    },
    {
        "id": "government",
        "label": "Administration & Public",
        "keywords": ["government", "gouvernement", "canton", "commune", "municipality", "public service", "état", "administration", "citoyen"],
        "jsonld_types": ["GovernmentOrganization", "GovernmentOffice"],
    },
]


# Domain hints — if domain contains these words, boost the sector score
DOMAIN_SECTOR_HINTS = {
    "travel": "travel", "tour": "travel", "visit": "travel", "hotel": "travel",
    "zuerich": "travel", "zurich": "travel", "geneve": "travel", "geneva": "travel",
    "lausanne": "travel", "bern": "travel", "luzern": "travel", "lugano": "travel",
    "paris": "travel", "london": "travel", "berlin": "travel", "rome": "travel",
    "barcelona": "travel", "amsterdam": "travel", "vienna": "travel",
    "wien": "travel", "munich": "travel", "muenchen": "travel",
    "lyon": "travel", "marseille": "travel", "tokyo": "travel",
    "roma": "travel", "milano": "travel",
    "basel": "travel",
    "bank": "finance", "credit": "finance", "finanz": "finance",
    "pharma": "health", "medic": "health", "sante": "health",
    "immobili": "realestate", "immo": "realestate",
    "edu": "education", "uni": "education", "school": "education",
    "news": "media", "media": "media", "press": "media",
    "admin": "government", "gouv": "government", "canton": "government",
}


def detect_sector(text: str, jsonld_payloads: list, domain: str) -> dict:
    """Detect the most likely business sector from text and JSON-LD."""
    lower_text = text.lower()
    domain_lower = domain.lower()

    # Check JSON-LD @type first (highest confidence)
    for payload in jsonld_payloads:
        items = payload if isinstance(payload, list) else [payload]
        for item in items:
            if not isinstance(item, dict):
                continue
            org_type = item.get("@type", "")
            if isinstance(org_type, list):
                org_type = org_type[0] if org_type else ""
            for rule in SECTOR_RULES:
                if org_type in rule["jsonld_types"]:
                    return {
                        "sector_id": rule["id"],
                        "sector_label": rule["label"],
                        "confidence": 0.85,
                        "source": "jsonld_type",
                        "evidence": [org_type],
                    }

    # Domain-based hint (boost +3 hits for matching sector)
    domain_boost_sector = None
    for hint_word, sector_id in DOMAIN_SECTOR_HINTS.items():
        if hint_word in domain_lower:
            domain_boost_sector = sector_id
            break

    # Keyword matching (lower confidence)
    scores = {}
    for rule in SECTOR_RULES:
        hits = [kw for kw in rule["keywords"] if kw in lower_text]
        if hits:
            hit_count = len(hits)
            # Apply domain boost
            if domain_boost_sector and rule["id"] == domain_boost_sector:
                hit_count += 10
            scores[rule["id"]] = {
                "rule": rule,
                "hits": hit_count,
                "evidence": hits[:5],
            }

    # If domain hints a sector but no keywords matched, add it with base score
    if domain_boost_sector and domain_boost_sector not in scores:
        for rule in SECTOR_RULES:
            if rule["id"] == domain_boost_sector:
                scores[rule["id"]] = {
                    "rule": rule,
                    "hits": 3,
                    "evidence": [f"domain:{domain}"],
                }
                break

    if scores:
        best = max(scores.values(), key=lambda x: x["hits"])
        return {
            "sector_id": best["rule"]["id"],
            "sector_label": best["rule"]["label"],
            "confidence": min(0.7, 0.3 + best["hits"] * 0.1),
            "source": "keyword_match",
            "evidence": best["evidence"],
        }

    return {
        "sector_id": "unknown",
        "sector_label": "Non détecté",
        "confidence": 0,
        "source": "none",
        "evidence": [],
    }


COUNTRY_NAME_TO_ISO = {
    # English
    "united states": "US", "usa": "US", "us": "US", "u.s.": "US", "u.s.a.": "US", "america": "US",
    "united kingdom": "GB", "uk": "GB", "england": "GB", "great britain": "GB",
    "switzerland": "CH", "suisse": "CH", "schweiz": "CH", "svizzera": "CH",
    "france": "FR", "germany": "DE", "deutschland": "DE", "italy": "IT", "italia": "IT",
    "spain": "ES", "españa": "ES", "netherlands": "NL", "nederland": "NL", "holland": "NL",
    "belgium": "BE", "belgique": "BE", "austria": "AT", "österreich": "AT",
    "portugal": "PT", "sweden": "SE", "norway": "NO", "denmark": "DK", "finland": "FI",
    "poland": "PL", "czech republic": "CZ", "ireland": "IE", "luxembourg": "LU",
    "japan": "JP", "south korea": "KR", "china": "CN", "australia": "AU",
    "new zealand": "NZ", "canada": "CA", "brazil": "BR", "brasil": "BR",
    "mexico": "MX", "india": "IN", "russia": "RU", "south africa": "ZA",
    "singapore": "SG", "hong kong": "HK", "taiwan": "TW", "israel": "IL",
    "united arab emirates": "AE", "uae": "AE",
}


def normalize_country(raw: str) -> str:
    """Normalize a country name or code to ISO 3166-1 alpha-2."""
    if not raw:
        return ""
    cleaned = raw.strip()
    # Already a 2-letter ISO code
    if len(cleaned) == 2 and cleaned.isalpha():
        return cleaned.upper()
    # Lookup by name
    return COUNTRY_NAME_TO_ISO.get(cleaned.lower(), "")


def detect_country_from_hreflang(meta: dict) -> str:
    """Extract country from hreflang tags (e.g. 'fr-CH' → 'CH', 'de-DE' → 'DE').

    Expects meta dict from extract_title_and_meta() — but we need the raw HTML
    to find all hreflang links.  As a lightweight alternative the caller can pass
    the full HTML via meta["_html"] so we parse it here, or we accept a
    pre-extracted list via meta["_hreflang_values"].
    """
    values: list[str] = meta.get("_hreflang_values", [])

    if not values:
        return ""

    # Collect region codes from values like "fr-CH", "de-DE", "en-US"
    region_counts: dict[str, int] = {}
    for val in values:
        val = val.strip().lower()
        if val in ("x-default", ""):
            continue
        # Format: lang-REGION  (e.g. fr-CH, de-DE, en-US)
        if "-" in val:
            parts = val.split("-")
            if len(parts) >= 2 and len(parts[-1]) == 2:
                region = parts[-1].upper()
                region_counts[region] = region_counts.get(region, 0) + 1

    if not region_counts:
        return ""

    # Return the most frequent region
    return max(region_counts, key=region_counts.get)  # type: ignore[arg-type]


# Phone prefix → ISO country code
PHONE_PREFIX_MAP = {
    "+41": "CH", "+33": "FR", "+1": "US", "+44": "GB", "+49": "DE",
    "+39": "IT", "+34": "ES", "+81": "JP", "+86": "CN", "+91": "IN",
    "+82": "KR", "+65": "SG", "+61": "AU", "+31": "NL", "+32": "BE",
    "+43": "AT", "+46": "SE", "+47": "NO", "+45": "DK", "+358": "FI",
    "+351": "PT", "+48": "PL", "+420": "CZ", "+36": "HU", "+7": "RU",
    "+55": "BR", "+52": "MX", "+971": "AE", "+966": "SA", "+972": "IL",
}

# Sorted by prefix length DESC so "+358" matches before "+3"
_SORTED_PREFIXES = sorted(PHONE_PREFIX_MAP.keys(), key=len, reverse=True)


def detect_country_from_phone(phones: list) -> str:
    """Detect country from phone number international prefix.

    Scans the list of phone strings and returns the ISO country code
    of the most common prefix found.
    """
    if not phones:
        return ""

    counts: dict[str, int] = {}
    for phone in phones:
        # Normalize: remove spaces, dashes, dots, parens
        cleaned = re.sub(r"[\s.()\-]", "", phone)
        if not cleaned.startswith("+"):
            continue
        for prefix in _SORTED_PREFIXES:
            if cleaned.startswith(prefix):
                cc = PHONE_PREFIX_MAP[prefix]
                counts[cc] = counts.get(cc, 0) + 1
                break

    if not counts:
        return ""

    return max(counts, key=counts.get)  # type: ignore[arg-type]


def detect_country_from_tld(domain: str) -> str:
    """Guess country from TLD."""
    tld_map = {
        ".ch": "CH", ".fr": "FR", ".de": "DE", ".it": "IT", ".es": "ES",
        ".uk": "GB", ".nl": "NL", ".be": "BE", ".at": "AT", ".pt": "PT",
        ".se": "SE", ".no": "NO", ".dk": "DK", ".fi": "FI", ".pl": "PL",
        ".cz": "CZ", ".ie": "IE", ".lu": "LU", ".jp": "JP", ".kr": "KR",
        ".cn": "CN", ".au": "AU", ".nz": "NZ", ".ca": "CA", ".br": "BR",
        ".mx": "MX", ".in": "IN", ".ru": "RU", ".za": "ZA",
    }
    for tld, country in tld_map.items():
        if domain.endswith(tld):
            return country
    return ""
