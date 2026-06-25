#!/usr/bin/env python3
"""
Récupération d'emails LÉGÈRE pour les entités AYA sans contact_email.

Objectif : élargir la base d'entreprises JOIGNABLES pour faire adopter le STANDARD
ASR (cf. [[strategy_asr_is_the_standard]]). 355k/367k entités n'ont pas d'email.

Léger volontairement : `requests` + regex uniquement (pas de scrapling/playwright/dns,
non installés sur le VPS prod). Suit la home + quelques pages contact/impressum/mentions,
extrait les emails (mailto + regex + déobfuscation Cloudflare basique), filtre la qualité
(rôles exclus, domaine de l'entité préféré), met à jour `contact_email` UNIQUEMENT quand
NULL/vide (jamais d'écrasement). ~0 CHF.

Usage (sur le VPS) :
  VPS_PG_PASSWORD=... python3 email_recover_lite.py --limit 1500 --workers 12 [--apply]
  (sans --apply = dry-run : compte sans écrire)
"""
import argparse, concurrent.futures as cf, os, re, sys, threading
from urllib.parse import urljoin, urlparse
import requests
import psycopg2

UA = "AYA-Bot/0.3 (+https://ai-visionary.xyz/aya)"
EMAIL_RE = re.compile(r"[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}")
MAILTO_RE = re.compile(r'mailto:([^"\'?>\s]+)', re.I)
CF_RE = re.compile(r'data-cfemail="([0-9a-fA-F]+)"')
CONTACT_PATHS = ["", "/contact", "/contact-us", "/contacts", "/kontakt", "/impressum",
                 "/mentions-legales", "/mentions", "/about", "/a-propos", "/legal", "/imprint"]
ROLE_RE = re.compile(r"^(copyright|legal|abuse|postmaster|webmaster|hostmaster|noreply|no-reply|"
                     r"donotreply|do-not-reply|mailer-daemon|privacy|dpo|compliance|gdpr|rgpd|spam|"
                     r"root|nobody|notification|notifications|newsletter|unsubscribe|marketing|press|presse)$", re.I)
BAD_HOST = ("sentry", "wixpress", "example.", "domain.com", "email.com", "yourdomain",
            "godaddy", "squarespace", "sentry.io", ".png", ".jpg", ".gif", ".webp")

def bare_host(url):
    try:
        h = urlparse(url if url.startswith("http") else "https://" + url).hostname or ""
        return h.lower().replace("www.", "")
    except Exception:
        return ""

def cf_decode(hexstr):
    try:
        r = int(hexstr[:2], 16)
        return "".join(chr(int(hexstr[i:i+2], 16) ^ r) for i in range(2, len(hexstr), 2))
    except Exception:
        return ""

def valid_email(e):
    e = e.strip().strip(".,;:").lower()
    if not e or e.count("@") != 1:
        return None
    local, _, host = e.partition("@")
    if len(local) < 3 or ROLE_RE.match(local) or local.isdigit() or re.match(r"^[0-9]{5,}", local):
        return None
    if any(b in e for b in BAD_HOST) or "@domain.com" in e or "." not in host:
        return None
    if re.search(r"\.(png|jpg|jpeg|gif|webp|svg|css|js)$", host):
        return None
    return e

def extract_emails(html):
    found = set()
    for m in MAILTO_RE.findall(html):
        v = valid_email(m.split("?")[0])
        if v: found.add(v)
    for m in CF_RE.findall(html):
        v = valid_email(cf_decode(m))
        if v: found.add(v)
    for m in EMAIL_RE.findall(html):
        v = valid_email(m)
        if v: found.add(v)
    return found

def fetch(url, timeout=8):
    try:
        r = requests.get(url, headers={"User-Agent": UA}, timeout=timeout, allow_redirects=True)
        if r.status_code == 200 and "text/html" in r.headers.get("content-type", ""):
            return r.text[:400_000]
    except Exception:
        pass
    return ""

def recover_one(entity):
    eid, website = entity
    host = bare_host(website)
    if not host or "." not in host:
        return (eid, None, None)
    origin = "https://" + host
    all_emails = set()
    for path in CONTACT_PATHS:
        html = fetch(origin + path)
        if html:
            all_emails |= extract_emails(html)
        if any(e.endswith("@" + host) for e in all_emails):
            break  # email du domaine trouvé = on s'arrête
    if not all_emails:
        return (eid, None, None)
    # qualité : préférer une adresse sur le domaine de l'entité
    on_domain = [e for e in all_emails if e.endswith("@" + host)]
    best = sorted(on_domain)[0] if on_domain else sorted(all_emails)[0]
    quality = "on_domain" if on_domain else "off_domain"
    return (eid, best, quality)

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--limit", type=int, default=1000)
    ap.add_argument("--workers", type=int, default=12)
    ap.add_argument("--apply", action="store_true")
    ap.add_argument("--include-off-domain", action="store_true")
    args = ap.parse_args()

    pw = os.environ.get("VPS_PG_PASSWORD")
    if not pw:
        print("ERROR: VPS_PG_PASSWORD manquant"); sys.exit(1)
    conn = psycopg2.connect(host="localhost", dbname="aya_local", user="aya_app", password=pw)
    cur = conn.cursor()
    cur.execute("""SELECT entity_id, website FROM aya_registry
                   WHERE (contact_email IS NULL OR contact_email='')
                     AND website IS NOT NULL AND website<>''
                   ORDER BY asr_score DESC NULLS LAST LIMIT %s""", (args.limit,))
    targets = cur.fetchall()
    print(f"Cibles : {len(targets)} entités sans email")

    found = 0; applied = 0; lock = threading.Lock()
    with cf.ThreadPoolExecutor(max_workers=args.workers) as ex:
        for eid, email, quality in ex.map(recover_one, targets):
            if not email:
                continue
            if quality == "off_domain" and not args.include_off_domain:
                continue
            with lock:
                found += 1
                if args.apply:
                    cur.execute("""UPDATE aya_registry SET contact_email=%s,
                                   email_research_status=%s
                                   WHERE entity_id=%s AND (contact_email IS NULL OR contact_email='')""",
                                (email, "recovered_" + quality, eid))
                    if cur.rowcount > 0:
                        applied += 1
                        if applied % 50 == 0:
                            conn.commit()
    if args.apply:
        conn.commit()
    print(f"Emails trouvés : {found} | appliqués (contact_email rempli) : {applied} | mode : {'APPLY' if args.apply else 'DRY-RUN'}")
    cur.close(); conn.close()

if __name__ == "__main__":
    main()
