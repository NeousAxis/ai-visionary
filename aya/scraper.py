"""
AYA Scraper — Fetches homepage, sitemap, and key pages from a domain.
"""

import requests
from urllib.parse import urljoin

from parser import get_domain, detect_key_pages

HEADERS = {
    "User-Agent": "AYA-Bot/0.1 (+https://ai-visionary.com/aya)"
}
TIMEOUT = 12


def fetch_url(url: str) -> dict:
    try:
        response = requests.get(
            url, headers=HEADERS, timeout=TIMEOUT, allow_redirects=True
        )
        return {
            "url": response.url,
            "status_code": response.status_code,
            "ok": response.ok,
            "text": response.text if response.ok else "",
        }
    except requests.RequestException:
        return {
            "url": url,
            "status_code": None,
            "ok": False,
            "text": "",
        }


def fetch_homepage(url: str) -> dict:
    return fetch_url(url)


def fetch_sitemap(base_url: str) -> dict:
    sitemap_url = urljoin(base_url, "/sitemap.xml")
    return fetch_url(sitemap_url)


def fetch_key_pages(base_url: str) -> list:
    results = []
    for page_url in detect_key_pages(base_url):
        page = fetch_url(page_url)
        if page["ok"]:
            results.append(page)
    return results


def normalize_url(url: str) -> str:
    url = url.strip()
    if not url:
        return ""
    if not url.startswith("http://") and not url.startswith("https://"):
        url = "https://" + url
    return url


def scrape_site(url: str) -> dict:
    base_url = normalize_url(url)
    homepage = fetch_homepage(base_url)
    sitemap = fetch_sitemap(base_url)
    key_pages = fetch_key_pages(base_url)

    return {
        "input_url": base_url,
        "canonical_domain": get_domain(
            homepage["url"] if homepage["url"] else base_url
        ),
        "homepage": homepage,
        "sitemap": sitemap,
        "key_pages": key_pages,
    }
