"""
Avant de noter un site, verifier que le bot a vraiment pu le lire.

Une page d'accueil qui n'a pas pu etre ouverte, une page de parking (domaine
a vendre), un mur anti-bot ou une coquille JavaScript sans texte ne disent rien
de l'entreprise. Les noter fausse les scores et les statistiques : le 14.10.2026,
29 487 des 65 516 sites lus par le bot avaient recu 0 a 4/100 sans avoir ete lus,
ce qui faisait tomber la mediane publiee a 16 au lieu de 47.
"""

import re
from urllib.parse import urlparse

from bs4 import BeautifulSoup

# Statuts possibles : "ok" (lisible, on peut noter) ou une raison de ne pas noter.
READABLE = "ok"
UNREACHABLE = "unreachable"   # erreur reseau, DNS, TLS, 404, 5xx, corps vide
BLOCKED = "blocked"           # 401/403/429, page anti-bot (Cloudflare, captcha...)
PARKED = "parked"             # domaine en parking ou a vendre : l'entreprise n'y est plus
NO_TEXT = "no_text"           # coquille JavaScript : aucun texte visible sans executer JS
REDIRECTED = "redirected"     # renvoie vers un autre site : ce n'est plus celui de l'entreprise
PLACEHOLDER = "placeholder"   # page par defaut du serveur, site en construction ou hors ligne

MIN_VISIBLE_TEXT = 40   # caracteres visibles en dessous desquels la page ne dit rien
SHORT_PAGE = 1500       # les pages de parking et murs anti-bot sont courtes
TINY_PAGE = 300         # page quasi vide : quelques mots suffisent alors a reconnaitre un refus

# Memes regles que assessPageContent dans lib/micro-agents/html-fetcher.ts (scan AYO).
PARKING_HOSTS = (
    "sedoparking.com", "sedo.com", "dan.com", "afternic.com", "hugedomains.com",
    "bodis.com", "parkingcrew.net", "above.com", "undeveloped.com", "domainmarket.com",
    "buydomains.com", "parklogic.com", "domainlore.com", "efty.com", "squadhelp.com",
    "atom.com", "brandbucket.com", "epik.com", "uni.domains", "spaceship.com",
    "expireddomains.com",
)
PARKING_RE = re.compile(
    r"domain (name )?(is|may be) for sale|this domain (is|has been) (parked|registered)|"
    r"buy this domain|domain parking|parked (free|domain|by)|make an offer on this domain|"
    r"this domain name is available|domain for sale|hugedomains|sedoparking|parkingcrew|"
    r"is for sale!?\s*$|inquire about this domain",
    re.I,
)
CHALLENGE_TEXT_RE = re.compile(
    r"just a moment|attention required|checking (if the site connection is secure|your browser)|"
    r"enable javascript and cookies to continue|performing security verification|"
    r"verify(ing)? (that )?you are (a )?human|are you a (human|robot)|bot verification|"
    r"pardon our interruption|request unsuccessful|incapsula incident|ddos-guard|"
    r"(your|the) request is being verified|one moment,? please\.{0,3}\s*loader",
    re.I,
)
# Trop courants pour etre testes ailleurs que sur une page quasi vide. \bcaptcha\b laisse
# passer le "protected by reCAPTCHA" (ou hCaptcha) d'un simple formulaire de contact.
CHALLENGE_TINY_RE = re.compile(r"access denied|\bcaptcha\b|forbidden", re.I)
LANDER_RE = re.compile(r"""location(\.href)?\s*=\s*["']/lander""", re.I)
# Murs anti-bot reconnaissables dans le HTML brut, meme servis en 200. Le script
# /cdn-cgi/challenge-platform/ n'y figure pas : Cloudflare l'injecte aussi dans des pages
# normales, il faisait refuser de petits sites parfaitement lisibles.
CHALLENGE_HTML_RE = re.compile(r"_cf_chl_opt|cf-browser-verification|sgcaptcha|incapsula incident|ddos-guard",
                               re.I)
# Page par defaut d'un serveur, compte suspendu, site en construction : rien sur l'entreprise.
# En plus de la version TS : compte inactif et site en panne (erreur PHP, base WordPress
# injoignable), vus en 200 dans aya_bot_reads le 14.10.2026.
PLACEHOLDER_RE = re.compile(
    r"welcome to nginx|apache2? [\w ]{0,20}default page|^\s*index of /|account (has been )?suspended|"
    r"account (is )?inactive|fatal error\s*:|failed to open stream|error establishing a database connection|"
    r"this (account|site|website) (has been|is) suspended|default (web )?(site|server) page|future home of|"
    r"(site|website|page|we are|we're)\s+(is\s+)?(coming soon|under construction)|under construction|"
    r"launching soon|site (web )?en (cours de )?construction|(site|website) bient[oô]t en ligne|"
    r"(site|website) (is )?(offline|down for maintenance)|(site|website) will be back soon|"
    r"under maintenance|maintenance mode|site (web )?en maintenance",
    re.I,
)
# Page qui ne s'affiche qu'avec JavaScript.
JS_REQUIRED_RE = re.compile(
    r"(enable|activate|turn on) javascript|javascript (is )?(required|disabled|must be enabled)|"
    r"requires javascript|activ(ez|er) (le )?javascript|javascript aktivieren",
    re.I,
)
# deuxiemes niveaux generiques (exemple.co.uk, exemple.com.au) pour retrouver le nom du site
_GENERIC_SLD = {"co", "com", "org", "net", "ac", "gov", "edu", "ltd", "plc", "gob", "nom", "or", "ne"}


def _host(url: str) -> str:
    return (urlparse(url or "").hostname or "").lower()


def _site_name(host: str) -> str:
    """exemple.co.uk, www.exemple.ch, shop.exemple.com donnent tous 'exemple'."""
    labels = [l for l in host.lower().split(".") if l and l != "www"]
    if len(labels) >= 3 and labels[-2] in _GENERIC_SLD and len(labels[-1]) == 2:
        return labels[-3]
    return labels[-2] if len(labels) >= 2 else (labels[0] if labels else "")


def same_site(requested_host: str, final_host: str) -> bool:
    """Vrai si la page finale appartient encore a l'entreprise : meme domaine,
    sous-domaine, ou meme nom sous une autre extension (exemple.ch vers exemple.com). Les
    tirets ne comptent pas : tecease.com vers tec-ease.com reste le meme site."""
    a, b = requested_host.lower().removeprefix("www."), final_host.lower().removeprefix("www.")
    if not a or not b or a == b or a.endswith("." + b) or b.endswith("." + a):
        return True
    return _site_name(a).replace("-", "") == _site_name(b).replace("-", "")


def classify_homepage(home: dict, requested_url: str = "") -> tuple:
    """Retourne (statut, raison). Statut READABLE seulement si la page d'accueil
    contient vraiment du contenu de l'entreprise ; sinon le site ne doit pas
    recevoir de score."""
    code = home.get("status_code")
    if not home.get("ok"):
        if code in (401, 403, 429):
            return BLOCKED, f"http {code}"
        return UNREACHABLE, f"http {code}" if code else "network"

    html = home.get("text") or ""
    if not html.strip():
        return UNREACHABLE, "empty body"

    ctype = (home.get("content_type") or "").lower()
    if ctype and "html" not in ctype and "xml" not in ctype:
        return UNREACHABLE, f"not html ({ctype.split(';')[0]})"

    host, asked = _host(home.get("url", "")), _host(requested_url)
    if asked and host and host != asked.removeprefix("www.") and host.removeprefix("www.") != asked.removeprefix("www."):
        # parking reconnu seulement apres redirection : sedo.com lu directement reste un vrai site
        if any(host == h or host.endswith("." + h) for h in PARKING_HOSTS):
            return PARKED, host
        if not same_site(asked, host):
            return REDIRECTED, host
    if LANDER_RE.search(html[:5000]):
        return PARKED, "lander redirect"

    soup = BeautifulSoup(html, "html.parser")
    title = soup.title.get_text(" ", strip=True) if soup.title else ""
    for tag in soup(["script", "style", "noscript", "template"]):
        tag.decompose()
    text = soup.get_text(" ", strip=True)

    if len(text) < SHORT_PAGE:
        if CHALLENGE_HTML_RE.search(html[:50000]):
            return BLOCKED, "challenge page"
        probe = f"{title} {text}"
        if PARKING_RE.search(probe):
            return PARKED, "parking page"
        if CHALLENGE_TEXT_RE.search(probe) or (len(text) < TINY_PAGE and CHALLENGE_TINY_RE.search(probe)):
            return BLOCKED, "challenge page"
        if PLACEHOLDER_RE.search(f"{title} {text[:400]}"):
            return PLACEHOLDER, "default or placeholder page"
        if len(text) < TINY_PAGE and JS_REQUIRED_RE.search(probe):
            return NO_TEXT, "javascript required"
    if len(text) < MIN_VISIBLE_TEXT:
        return NO_TEXT, f"{len(text)} visible chars"
    return READABLE, ""
