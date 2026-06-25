/**
 * lib/linkedin/playwright-poster.ts — STUB (désactivé)
 *
 * La publication LinkedIn automatique via Playwright est DÉSACTIVÉE, pour deux raisons :
 *  1. LinkedIn rejette les sessions Playwright (anti-bot, toast "Sorry something went
 *     wrong" + invalidation auto) — la feature était déjà non fonctionnelle.
 *  2. Le chargement runtime de playwright (`createRequire(import.meta.url)` + binaire natif
 *     chromium-headless-shell) fait PANIQUER le build Turbopack v16
 *     ("FileSourceReference resolve_reference / resolve_raw failed"), ce qui cassait
 *     L'INTÉGRALITÉ du build → prod en 502.
 *
 * On conserve l'interface (`publishToLinkedIn` / `teardown` / `PublishResult`) pour ne pas
 * casser les 3 routes qui l'importent (admin/linkedin-drafts, cron/linkedin-post,
 * cron/linkedin-publish-approved) ; elles renvoient une erreur claire "disabled".
 *
 * La logique Playwright d'origine reste dans l'historique git (commits 1698d5b4 /
 * e0e04fb6 / 013d79cd). Si on réactive un jour, le faire dans un worker Node SÉPARÉ
 * hors du bundle Next (script autonome sur le VPS), pas importé par une route.
 */

export interface PublishResult {
  success: boolean;
  postUrl?: string;
  error?: string;
}

export async function publishToLinkedIn(_text: string): Promise<PublishResult> {
  return {
    success: false,
    error:
      'LinkedIn auto-publish disabled (Playwright anti-bot + Turbopack build incompatibility). Use manual copy-paste from the admin draft.',
  };
}

export async function teardown(): Promise<void> {
  // no-op : plus de browser Playwright à fermer.
}
