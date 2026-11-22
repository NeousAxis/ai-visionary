"""Tests de la porte « site vraiment lu ». Lancer : python3 aya/test_page_check.py

Cas tires de aya_bot_reads (14.10.2026) : de vrais sites refuses a cause d'un reCAPTCHA
de formulaire ou du script Cloudflare, et des murs servis en 200 qui recevaient une note.
"""
import os
import sys
import unittest

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import page_check as pc  # noqa: E402

COMPANY = (
    "<h1>Cook's Tavern</h1><p>Family restaurant in Cherry Hill since 1998. Lunch and dinner "
    "seven days a week, private room for 40 guests, catering for weddings and corporate events. "
    "Our menu changes with the seasons and we source our produce from local farms in New Jersey. "
    "Call us at 856 555 0142 or write to us using the form below.</p>"
    "<form><input name=email><textarea name=message></textarea><button>Send</button></form>"
)


def page(body: str, title: str = "", head: str = "") -> str:
    return f"<html><head><title>{title}</title>{head}</head><body>{body}</body></html>"


def home(html: str, url: str = "https://example.com/", code: int = 200, ok: bool = True) -> dict:
    return {"ok": ok, "status_code": code, "url": url, "text": html, "content_type": "text/html; charset=utf-8"}


def verdict(html: str, url: str = "https://example.com/", asked: str = "https://example.com") -> str:
    return pc.classify_homepage(home(html, url), asked)[0]


class ReadableSitesTest(unittest.TestCase):
    """Vrais sites qui etaient refuses comme « challenge page »."""

    def test_recaptcha_on_contact_form(self):
        html = page(COMPANY + "<small>This site is protected by reCAPTCHA and the Google "
                    "Privacy Policy and Terms of Service apply.</small>", "Cook's Tavern")
        self.assertEqual(verdict(html), pc.READABLE)

    def test_hcaptcha_on_contact_form(self):
        html = page(COMPANY + "<small>Protected by hCaptcha</small>", "Cook's Tavern")
        self.assertEqual(verdict(html), pc.READABLE)

    def test_cloudflare_script_on_normal_page(self):
        head = '<script src="/cdn-cgi/challenge-platform/scripts/jsd/main.js"></script>'
        self.assertEqual(verdict(page(COMPANY, "Cook's Tavern", head)), pc.READABLE)

    def test_access_denied_mentioned_in_content(self):
        html = page(COMPANY + "<p>Access denied to the kitchen for guests, sorry!</p>", "Cook's Tavern")
        self.assertEqual(verdict(html), pc.READABLE)

    def test_hyphen_variant_is_same_site(self):
        html = page(COMPANY, "Tec Ease")
        self.assertEqual(verdict(html, "https://tec-ease.com/", "https://tecease.com"), pc.READABLE)


class WallsAndPlaceholdersTest(unittest.TestCase):
    """Murs anti-bot et pages vides de sens servis en 200, qui recevaient une note."""

    def test_request_being_verified(self):
        html = page('<div class="loader">Loader</div><h1>One moment, please...</h1>'
                    "<p>Please wait while your request is being verified...</p>", "One moment, please...")
        self.assertEqual(verdict(html), pc.BLOCKED)

    def test_cloudflare_just_a_moment(self):
        html = page("<p>Checking your browser before accessing example.com.</p>", "Just a moment...",
                    "<script>window._cf_chl_opt={cvId:'3'}</script>")
        self.assertEqual(verdict(html), pc.BLOCKED)

    def test_tiny_captcha_page(self):
        self.assertEqual(verdict(page("<p>Please solve the captcha to continue.</p>", "Security check")),
                         pc.BLOCKED)

    def test_tiny_access_denied(self):
        self.assertEqual(verdict(page("<h1>Access Denied</h1><p>You don't have permission.</p>", "Error")),
                         pc.BLOCKED)

    def test_website_offline(self):
        html = page("<h1>Website is offline now</h1><p>The website will be back soon. "
                    "Thank you for your patience.</p>", "Website offline")
        self.assertEqual(verdict(html), pc.PLACEHOLDER)

    def test_launching_soon(self):
        html = page("<h1>Launching Soon</h1><p>Subscribe to be notified when we go live.</p>", "Second Go")
        self.assertEqual(verdict(html), pc.PLACEHOLDER)

    def test_nginx_default_page(self):
        html = page("<h1>Welcome to nginx!</h1><p>If you see this page, the nginx web server is "
                    "successfully installed and working.</p>", "Welcome to nginx!")
        self.assertEqual(verdict(html), pc.PLACEHOLDER)

    def test_account_inactive(self):
        self.assertEqual(verdict(page("<h1>Account inactive</h1><p>Please contact support.</p>")),
                         pc.PLACEHOLDER)

    def test_php_fatal_error(self):
        html = page("<b>Warning</b>: require(/home/www/site/wp-blog-header.php): failed to open stream: "
                    "No such file or directory in <b>/home/www/site/index.php</b> on line 17<br>"
                    "<b>Fatal error</b>: require(): Failed opening required file")
        self.assertEqual(verdict(html), pc.PLACEHOLDER)

    def test_wordpress_database_error(self):
        self.assertEqual(verdict(page("<h1>Error establishing a database connection</h1>",
                                      "Database Error")), pc.PLACEHOLDER)

    def test_javascript_required_shell(self):
        html = page('<p>You need to enable JavaScript to run this app.</p><div id="root"></div>', "App")
        self.assertEqual(verdict(html), pc.NO_TEXT)


class UnchangedRulesTest(unittest.TestCase):
    """Ce qui marchait deja doit continuer a marcher."""

    def test_parking_text(self):
        self.assertEqual(verdict(page("<h1>example.com is for sale!</h1><p>Make an offer on this domain.</p>")),
                         pc.PARKED)

    def test_lander_redirect(self):
        self.assertEqual(verdict(page("<script>window.location.href=\"/lander\"</script>")), pc.PARKED)

    def test_redirect_to_parking_host(self):
        self.assertEqual(verdict(page(COMPANY), "https://www.sedo.com/search?q=x"), pc.PARKED)

    def test_redirect_to_other_site(self):
        self.assertEqual(verdict(page(COMPANY), "https://other-company.org/"), pc.REDIRECTED)

    def test_http_403(self):
        self.assertEqual(pc.classify_homepage(home("", code=403, ok=False), "https://example.com")[0],
                         pc.BLOCKED)

    def test_network_error(self):
        self.assertEqual(pc.classify_homepage(home("", code=None, ok=False), "https://example.com")[0],
                         pc.UNREACHABLE)

    def test_empty_shell(self):
        self.assertEqual(verdict(page('<div id="root"></div>', "App")), pc.NO_TEXT)


if __name__ == "__main__":
    unittest.main(verbosity=1)
