/**
 * Automation LinkedIn via Playwright (sans API officielle).
 *
 * Pourquoi Playwright et pas l'API LinkedIn :
 * - Cyril n'a pas de compte LinkedIn Developer
 * - L'API Marketing Developer Platform demande review LinkedIn (24-48h)
 * - Solution : un bot qui se connecte avec ses identifiants comme un humain
 *
 * Risques :
 * - LinkedIn peut detecter et bannir le compte (3 posts/jour avec pauses
 *   humaines = risque modere)
 * - DOM LinkedIn change regulierement (selectors a maintenir)
 * - MFA doit etre desactive sur le compte source
 *
 * MVP : retourne success + URL du post si OK, error sinon.
 */

import type { Browser, BrowserContext, Page } from 'playwright';
import * as path from 'path';
import { createRequire } from 'module';

// Bypass Next.js bundler (turbopack/webpack) pour charger playwright directement
// depuis node_modules au runtime. Sinon : "Failed to load chunk server/chunks/
// [externals]_playwright_*.js" car turbopack n'arrive pas a bundler le binaire
// natif chromium-headless-shell.
const requireExt = createRequire(import.meta.url);

let _browser: Browser | null = null;
let _context: BrowserContext | null = null;

// Session storage : pas dans /tmp (world-readable). Dans le CWD de l'app
// (proteged user-only via chmod 600 immediatement apres ecriture).
// Override via env var LINKEDIN_SESSION_PATH si besoin.
// IMPORTANT : resolu au runtime (pas en constante module-level) pour eviter
// que Turbopack interprete le path comme un glob et matche 60k fichiers
// du projet ("file pattern matches 60456 files").
function getStorageStatePath(): string {
  return (
    process.env.LINKEDIN_SESSION_PATH ||
    path.join(process.cwd(), '.linkedin-session.json')
  );
}

export interface PublishResult {
  success: boolean;
  postUrl?: string;
  error?: string;
}

async function getBrowser(): Promise<Browser> {
  // Force runtime require natif (pas un import bundleable) pour eviter
  // que Next.js essaie de bundler les binaires Chromium dans les server chunks.
  const playwright = requireExt('playwright') as typeof import('playwright');
  if (!_browser) {
    _browser = await playwright.chromium.launch({
      headless: true,
      args: [
        '--disable-blink-features=AutomationControlled',
        '--no-sandbox',
        '--disable-setuid-sandbox',
      ],
    });
  }
  return _browser;
}

async function getContext(): Promise<BrowserContext> {
  const browser = await getBrowser();
  if (!_context) {
    const fs = await import('fs');
    const storagePath = getStorageStatePath();
    const hasStorage = fs.existsSync(storagePath);
    _context = await browser.newContext({
      userAgent:
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
      viewport: { width: 1280, height: 800 },
      // IMPORTANT : garder la locale identique a celle utilisee lors de la
      // generation de la session (fr-CH quand Cyril a fait playwright codegen
      // depuis son Mac). Sinon LinkedIn detecte le mismatch fingerprint et
      // invalide la session.
      locale: 'fr-CH',
      timezoneId: 'Europe/Zurich',
      extraHTTPHeaders: {
        'Accept-Language': 'fr-CH,fr;q=0.9,en;q=0.8',
      },
      ...(hasStorage ? { storageState: storagePath } : {}),
    });
  }
  return _context;
}

/**
 * Login LinkedIn — passe la page email puis le mot de passe.
 * Sauvegarde la session pour eviter de relogin a chaque post.
 */
async function ensureLoggedIn(page: Page): Promise<void> {
  await page.goto('https://www.linkedin.com/feed/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);

  const urlAfterFeed = page.url();
  const isLoggedIn = urlAfterFeed.includes('/feed');
  if (isLoggedIn) return;

  // Si on est sur checkpoint, login, ou autre → la session est invalide.
  // Ne PAS tenter le login auto (LinkedIn detecte le bot et bloque sur
  // checkpoint/captcha). Demander un refresh manuel de la session.
  try {
    await page.screenshot({ path: `/tmp/linkedin-session-invalid-${Date.now()}.png`, fullPage: false });
  } catch {}

  throw new Error('Session LinkedIn invalide');

  // Sauvegarde session + chmod 600 immediat (cookies = credentials equivalents)
  const ctx = page.context();
  const storagePath = getStorageStatePath();
  await ctx.storageState({ path: storagePath });
  try {
    const fs = await import('fs');
    fs.chmodSync(storagePath, 0o600);
  } catch {
    // chmod peut echouer sur certains FS (Windows dev), pas critique pour le runtime
  }
}

/**
 * Publie un texte sur LinkedIn (profil personnel ou page entreprise selon
 * compte connecte).
 */
export async function publishToLinkedIn(text: string): Promise<PublishResult> {
  let page: Page | null = null;
  // Helper pour screenshot de debug en cas d'echec
  const screenshotOnFail = async (label: string): Promise<string | undefined> => {
    if (!page) return undefined;
    try {
      const file = `/tmp/linkedin-fail-${label}-${Date.now()}.png`;
      await page.screenshot({ path: file, fullPage: false });
      return file;
    } catch {
      return undefined;
    }
  };

  try {
    const ctx = await getContext();
    page = await ctx.newPage();
    await ensureLoggedIn(page);

    // Strategie : aller direct sur l'URL qui pre-ouvre la modale de partage,
    // au lieu de cliquer sur "Commencer un post". Moins suspect anti-bot
    // (navigation HTTP vs click programmatique → LinkedIn ne declenche pas
    // son toast "Sorry, something went wrong").
    await page.goto('https://www.linkedin.com/feed/?shareActive=true', {
      waitUntil: 'domcontentloaded',
    });
    await page.waitForTimeout(4000);

    // Saisir le texte dans l'editeur (modale qui doit s'etre ouverte)
    // LinkedIn utilise plusieurs editeurs selon A/B test : Quill (.ql-editor),
    // Lexical, ou un simple contenteditable div.
    const editorSelectors = [
      'div.ql-editor[contenteditable="true"]',
      'div[role="textbox"][contenteditable="true"]',
      'div[data-placeholder*="post"][contenteditable="true"]',
      'div[data-placeholder*="parler"][contenteditable="true"]',
      'div[aria-label*="post"][contenteditable="true"]',
      'div[aria-label*="texte"][contenteditable="true"]',
      'div[contenteditable="true"]',
    ];
    let editor: ReturnType<typeof page.locator> | null = null;
    for (const sel of editorSelectors) {
      try {
        const loc = page.locator(sel).first();
        // attendre jusqu'a 8s qu'il apparaisse (la modale prend du temps a charger)
        await loc.waitFor({ state: 'visible', timeout: 8000 });
        editor = loc;
        break;
      } catch {
        // try next
      }
    }
    if (!editor) {
      const screenshot = await screenshotOnFail('editor-not-found');
      throw new Error(`Editeur de post introuvable apres click sur "Commencer un post". Screenshot: ${screenshot ?? 'n/a'}`);
    }
    try {
      await editor.click({ timeout: 5000 });
    } catch {
      // peut-etre deja focus
    }
    await editor.fill(text);
    await page.waitForTimeout(1500);

    // Cliquer "Publier" / "Post"
    const publishSelectors = [
      'button.share-actions__primary-action',
      'button[aria-label*="Publier"]',
      'button[aria-label*="Post"]',
      'button:has-text("Publier")',
      'button:has-text("Post")',
      // Souvent c'est le primary button le plus a droite de la modale
    ];
    let clickedPublish = false;
    for (const sel of publishSelectors) {
      try {
        const loc = page.locator(sel).last(); // .last() car il peut y avoir plusieurs "Post" / "Publier"
        if (await loc.count() > 0 && await loc.isEnabled()) {
          await loc.click({ timeout: 5000 });
          clickedPublish = true;
          break;
        }
      } catch {
        // try next
      }
    }
    if (!clickedPublish) {
      const screenshot = await screenshotOnFail('publish-btn-not-found');
      throw new Error(`Bouton "Publier" introuvable. Screenshot: ${screenshot ?? 'n/a'}`);
    }
    await page.waitForTimeout(6000);

    // Screenshot de succes pour validation manuelle
    let successScreenshot: string | undefined;
    try {
      successScreenshot = `/tmp/linkedin-success-${Date.now()}.png`;
      await page.screenshot({ path: successScreenshot, fullPage: false });
    } catch {
      successScreenshot = undefined;
    }

    return {
      success: true,
      postUrl: successScreenshot
        ? `https://www.linkedin.com/feed/ (screenshot: ${successScreenshot})`
        : 'https://www.linkedin.com/feed/',
    };
  } catch (e: any) {
    return {
      success: false,
      error: e?.message || 'Unknown error',
    };
  } finally {
    if (page) await page.close().catch(() => {});
  }
}

/**
 * Cleanup global — a appeler en fin de cron pour liberer les ressources.
 */
export async function teardown(): Promise<void> {
  if (_context) {
    await _context.close().catch(() => {});
    _context = null;
  }
  if (_browser) {
    await _browser.close().catch(() => {});
    _browser = null;
  }
}
