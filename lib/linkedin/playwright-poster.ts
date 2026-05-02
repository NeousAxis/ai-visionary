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

let _browser: Browser | null = null;
let _context: BrowserContext | null = null;

// Session storage : pas dans /tmp (world-readable). Dans le CWD de l'app
// (proteged user-only via chmod 600 immediatement apres ecriture).
// Override via env var LINKEDIN_SESSION_PATH si besoin.
const STORAGE_STATE_PATH =
  process.env.LINKEDIN_SESSION_PATH ||
  path.join(process.cwd(), '.linkedin-session.json');

export interface PublishResult {
  success: boolean;
  postUrl?: string;
  error?: string;
}

async function getBrowser(): Promise<Browser> {
  const playwright = await import('playwright');
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
    const hasStorage = fs.existsSync(STORAGE_STATE_PATH);
    _context = await browser.newContext({
      userAgent:
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
      viewport: { width: 1280, height: 800 },
      locale: 'fr-CH',
      ...(hasStorage ? { storageState: STORAGE_STATE_PATH } : {}),
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
  await page.waitForTimeout(2000);

  const isLoggedIn = page.url().includes('/feed');
  if (isLoggedIn) return;

  // Pas connecte — login
  await page.goto('https://www.linkedin.com/login', { waitUntil: 'domcontentloaded' });

  const email = process.env.LINKEDIN_EMAIL;
  const password = process.env.LINKEDIN_PASSWORD;
  if (!email || !password) {
    throw new Error('LINKEDIN_EMAIL ou LINKEDIN_PASSWORD manquant dans .env.local');
  }

  await page.fill('input#username', email, { timeout: 10000 });
  await page.waitForTimeout(800);
  await page.fill('input#password', password);
  await page.waitForTimeout(800);
  await page.click('button[type="submit"]');

  // Attendre le feed (3s typique, 30s max)
  await page.waitForURL('**/feed/**', { timeout: 30000 }).catch(() => {});

  if (!page.url().includes('/feed')) {
    // Possibles : MFA, captcha, mot de passe faux
    throw new Error(`Login LinkedIn echoue — URL apres submit : ${page.url()}`);
  }

  // Sauvegarde session + chmod 600 immediat (cookies = credentials equivalents)
  const ctx = page.context();
  await ctx.storageState({ path: STORAGE_STATE_PATH });
  try {
    const fs = await import('fs');
    fs.chmodSync(STORAGE_STATE_PATH, 0o600);
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
  try {
    const ctx = await getContext();
    page = await ctx.newPage();
    await ensureLoggedIn(page);

    // Aller sur le feed
    await page.goto('https://www.linkedin.com/feed/', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2500);

    // Cliquer "Demarrer un post" / "Start a post"
    const startBtn = page.locator(
      'button.share-box-feed-entry__trigger, button:has-text("Démarrer un post"), button:has-text("Start a post")'
    ).first();
    await startBtn.click({ timeout: 15000 });
    await page.waitForTimeout(2000);

    // Saisir le texte (editable div avec role=textbox)
    const editor = page.locator('div[role="textbox"][contenteditable="true"]').first();
    await editor.click({ timeout: 10000 });
    await editor.fill(text);
    await page.waitForTimeout(1500);

    // Cliquer "Publier" / "Post"
    const publishBtn = page.locator(
      'button.share-actions__primary-action, button:has-text("Publier"), button:has-text("Post")'
    ).first();
    await publishBtn.click({ timeout: 15000 });
    await page.waitForTimeout(5000);

    // L'URL exacte du post n'est pas trivialement recuperable.
    // On retourne l'URL du feed comme fallback.
    return {
      success: true,
      postUrl: 'https://www.linkedin.com/feed/',
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
