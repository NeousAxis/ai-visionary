# AI VISIONARY — STATE.md

> Liste de ce qui est FAIT et FONCTIONNE en production.
> Extraite de CLAUDE.md le 1er mai 2026 pour désengorger le contexte.
> CLAUDE.md référence ce fichier en section 6.

---

## Site & Frontend

- Site bilingue FR/EN : toggle header, `next-intl` + cookie `NEXT_LOCALE`, toutes pages + chatbot + emails + formulaires + API
- Stepper/barre de progression bilingue FR/EN (triggers mis a jour)
- Section GEO vs ASR sur la homepage — explication bilingue FR/EN de la différence entre GEO et ASR, colonnes distinctes (orange GEO / teal ASR) sur fond gris clair
- Pages FAQ (/faq), Glossaire (/glossaire), CGV (/cgv) — bilingues FR/EN, liens dans le footer.
- Mentions legales + confidentialite : hebergement = Infomaniak Network SA (Geneve, Suisse).
- Page `/developers` : stats dynamiques, docs GitHub/HuggingFace
- SEO metadata toutes pages + sitemap dynamique Supabase + confidentialite LPD/RGPD + mentions legales

## Flux AYO V4 Evidence-Based (actif en prod)

- Flux complet AYO V4 : URL -> scan -> classification site -> questions ciblees -> score strict -> paiement Stripe -> fichiers -> email (bilingue)
- V4 Evidence-Based actif en prod : site-classifier, question-engine, data reliability layer, anti-marketing, GDPR reclassification
- Sanitization complete des fichiers PRO via `sanitizeComplianceOutput()` partagee : anti-marketing, URL→label, country normalization, "And" prefix, trailing periods, GDPR principles filter, deterministic online detection
- Frontend label stripping : les `customLabel` des champs V4 sont automatiquement strippes des reponses utilisateur
- Per-block scoring caps respectent V4 signals (na:true, structured_absence, URL evidence)
- Generation et envoi des 5 fichiers PRO en ZIP (emails bilingues)
- Signature Ed25519 des ASR (cle rotee, env var)

## Diagnostic V2 Micro-Agents (mergé dans main 5 avril 2026)

- Diagnostic V2 micro-agents : page `/diagnostic-v2` avec 7 agents LLM cibles (Gemini 3 Flash), 8 etapes live, scoring 7 dimensions, compare concurrents AYA, score PRO projete.
- Diagnostic V2 : 8 micro-agents (dont detect-pedagogy LLM pour FAQ/glossary/docs), retry x3 pour stabilite score, OTP clients existants, email capture, Stripe LIVE connecte
- Diagnostic V2 universel tous types de sites : SPA (Jina fallback), NGO/nonprofit, e-commerce, agences, institutions. Detection deterministe legal links (footer regex), social links (bare domain regex), pedagogy elargie (blog/insights/reports/academy). Business type inference (NGO avant commercial). Compare filtering : INCOMPATIBLE_TYPES, SECTOR_AFFINITY, IDF keywords, containment strict (6 chars min + 40% ratio)
- Score V2 stable : whtg1.com 81/100 (±1 point entre scans)

## Paiements & Emails

- Stripe Checkout LIVE en production (CHF, 2 offres : AYA 19 CHF/mois, PRO 499 CHF). Basculé mode live le 11 avril 2026. Webhook configuré sur ai-visionary.xyz.
- Webhook Stripe : retry x2 pour enrichissement Gemini si premier appel echoue
- Emails : migration Resend → Infomaniak SMTP (nodemailer). `lib/mailer.ts` + 11 routes API migrees. Adresses : `hello@` (boite) + `security@` (alias). TODO partenariat Infomaniak : ajouter alias `delivery@` + `registry@`.

## Registre AYA

- Registre AYA public : ~4400+ entites, pagination serveur, badges certifie/indexe, recherche, tri
- API AYA : 7 endpoints (index, llm, docs, search, entity, stats, live) + `?lang=fr|en`
- Bot AYA : 6766 domaines pipeline, enrichissement Gemini 100% (descriptions EN+FR, keywords EN+FR)
- Public Key ID visible dans cartes AYA registry (label i18n FR/EN) + champ `public_key_id` dans LlmSummary API + GitHub export
- Admin enrichment API : `/api/admin/enrich` — re-enrichir une entite ou batch (certifiees sans description Gemini)
- API Monitoring : `lib/aya/api-tracker.ts` — buffer memoire + flush Supabase toutes les 5min. Classifie les callers (llm_agent, developer, crawler, browser). 7 routes AYA instrumentees. Endpoint admin `/api/aya/analytics?days=7`.
- Translation agents Python : descriptions certifiees, dictionnaire 16558 termes, keywords FR 100%
- Exports : GitHub (4372 fichiers) + HuggingFace (4437 entites) — re-exportes 7 avril 2026

## Sécurité & Lifecycle

- Supabase PostgreSQL (migration depuis Firestore terminee)
- 10 sprints de remediation securite termines
- OTP email (owner_email only), admin dashboard, logger, rate-limit, validators
- Lifecycle : formulaire MAJ 7 blocs + OTP gate + renouvellement + protection downgrade PRO->AYA

## Infra & Migration

- Migration domaine : `ai-visionary.xyz` = domaine primaire (8 avril 2026). `.com` redirige 301 vers `.xyz`. 42+ fichiers source + i18n + docs + public migres. DNS Infomaniak, Vercel, Stripe configures.
- `ayo-semantics.ts` : modele Gemini corrige → `gemini-3-flash-preview` (1.5-flash etait deprecie)

## Sessions Tranco EU (croissance 100k entités)

- **Vague 1 Tranco EU (14 avril 2026)** : `aya/fetch_tranco_eu.py` telecharge Tranco Top 1M, filtre 38 TLDs europeens, dedup vs `domains.txt` → **156 616 nouveaux domaines EU** dans `aya/domains_growth_tranco.txt` (apres blocklist). Batch 1 de 10 000 domaines (`domains_batch1_10k.txt`) scrape avec succes (96% success rate, +9595 JSONs dans `aya/data/`). Push Supabase BLOQUE jusqu'au 8 mai (grace period).
- **Blocklist porn/armement (14 avril 2026)** : `aya/blocklist.py` — patterns `PORN_RE` + `WEAPON_RE` + whitelist explicite (gun.io, gundam-store, riflessi, essex/sussex, emilfrey, etc.). Airsoft autorise (sport). 118 domaines bannis supprimes (104 porn + 14 armement). Filtre integre dans `run_pipeline_fast.py` (via `load_domains`) et `fetch_tranco_eu.py`. Aucune future vague ne peut ramener ces domaines.
- ~~**Email template campagne bot-indexed (14 avril 2026)**~~ : SUPPRIME le 28 avril 2026 suite a abandon de la campagne (cold marketing incompatible CGU Infomaniak Newsletter).
- **Schema aya_registry (14 avril 2026)** : ajout colonnes `missing_contact_email` (BOOLEAN) + `email_research_status` (TEXT: pending | researched_ok | researched_failed | do_not_contact) + index partiel `idx_aya_missing_email`.
- **Supabase grace period** : 7 avril → 7 mai 2026. Declenchee par l'incident rescoring V2 (depassement egress). Regle absolue : **pas de gros batch Supabase** pendant le grace period.
- **scripts/rescore-batch.sh supprime** (14 avril 2026) : ancien lanceur du rescoring V2 abandonne.
- **Batches 2 & 3 Tranco (17-18 avril 2026)** : batch 2 scrape en 1h04 (9998/10000), batch 3 en 2h40 (9979/10000 + retry 21/21 apres fix parser). Total au 18 avril : 36 245 JSONs dans `aya/data/`.
- **Fix `parser.py::normalize_country` (18 avril 2026)** : la fonction crashait sur `.strip()` si `raw_country` etait un dict (JSON-LD structure `{"@type":"Country","name":"Poland"}`). Ajout de `_coerce_to_str()`. 21 sites e-commerce recuperes.
- **Cap 50 sans ASR + masquage concurrents ai-visionary.xyz (21 avril 2026)** : commit `f31d1d65`. Tests end-to-end sur beta VPS valides. UI testee en EN via Claude-in-Chrome. Deploy prod Vercel applique.
- **Batch 4 Tranco (25 avril 2026)** : 6748/6767 succes (99.7%), 19 erreurs `not enough values to unpack` sur sites avec challenge Cloudflare/CDN.
- **Batch 5 Tranco (25 avril 2026)** : 9987/10000 succes (99.87%). 2h27 de scrape. `aya/domains_batch5_10k.txt` = lignes 30001-40000. Total cumule `aya/data/` apres batch 5 : ~46 000 JSONs.
- **Code campagne newsletter (25 avril 2026, partiellement REVERTE 28 avril)** : `lib/infomaniak-newsletter.ts` conserve pour usage opt-in futur. `app/api/admin/campaign-aya-indexed/route.ts` SUPPRIME le 28 avril 2026.
- **API DNS Infomaniak debloquee (25 avril 2026)** : endpoint `/1/domain/{domainId}/dns/record` accepte le token Newsletter. Domain ID `ai-visionary.xyz` = **2128919**. Format DKIM : `type:"DKIM", dkim_type:"CNAME"`.
- **Newsletter Infomaniak BLOQUEE puis pivot strategique (25-28 avril 2026)** : compte temporairement bloque. Pivot strategique : Newsletter Infomaniak ne servira QUE pour des destinataires opt-in explicites. Cold marketing aux entites AYA-BOT abandonne. Lecon double : ne jamais tester newsletter avec un dummy minimal + ne jamais utiliser Newsletter pour du cold marketing.
- **Sprint Postgres VPS + 8 fixes SEO (28 avril 2026)** : Setup Postgres 16 self-hosted sur VPS Infomaniak `aya-bot`. Push 25 860 entites scrapees (filter score >= 20) sur Postgres VPS via `aya/push_to_local_pg.py`. 8 fixes SEO. Architecture mixte preparee : `lib/db-local-pg.ts`, routes `/api/aya-local/{search,entity,live,stats}`, helper `getAyaEntitiesAggregated`. Doc dans `docs/vps-postgres-setup.md`.
- **Activation agregation Vercel ↔ VPS + 4 fixes residuels (28 avril 2026)** : Deploy code source sur VPS via rsync. Branchement agregation Vercel via 3 fns `getAyaSearchAggregated`, `getAyaStatsAggregated`, `getAyaLiveAggregated` dans `lib/db.ts`. 3 bugs residuels fixes (total VPS, taille HTML, path locale). Fix critique : nouvelle route VPS `/api/aya-local/entity-by-id/[id]/route.ts` + 2 fns agregees. **Resultat live** : `/api/aya/stats` → 30 298 entites (vs 4 438 avant). Commits : `fa1d8cff`, `d2f218e5`, `96bff7d9`, `6446005d`.

---

## Sessions 2-3 mai 2026 — Pipeline LinkedIn marketing (branche `feature/linkedin-marketing`)

**Contexte** : Cyril veut poster automatiquement 3x/jour sur LinkedIn des constats d'AI-readability sur des entreprises connues (sans ASR). Pas de page entreprise → pas d'API LinkedIn officielle → tentative via Playwright headless.

**Architecture livrée (fonctionne)** :
- `migrations/2026-05-01_linkedin_posts.sql` : table sur Postgres VPS uniquement (pas Supabase pendant grace period)
- `lib/linkedin/known-entities.ts` : ~80 KNOWN_DOMAINS_META curees regionales/sectorielles avec sector_en, country, locale, linkedin_slug. Mega-marques globales virees apres test (Stripe, Shopify, Notion, Booking, Airbnb, Anthropic, Mistral, etc.) — les LLMs les citent deja sans ASR.
- `lib/linkedin/post-generator.ts` : template EN-only, queries naturelles randomisees ("recommend a good X in Y", "which X is most reliable"), CTA `https://ai-visionary.xyz/diagnostic`, mention `@CompanyName`, hashtags
- `lib/linkedin/post-selector.ts` : selection FIFO Postgres VPS + cleanDisplayName (strip TLD)
- `lib/linkedin/visibility-checker.ts` : avant post, demande a Gemini ET ChatGPT (gpt-4o-mini) "List 5 best X in Y" → si entite citee, status='skipped' + retry max 5
- `lib/linkedin/playwright-poster.ts` : automation Playwright (createRequire bypass turbopack)
- `app/api/cron/linkedin-post/route.ts` : genere drafts + check visibility
- `app/api/cron/linkedin-publish-approved/route.ts` : prend le plus ancien `approved` et publie
- `app/api/admin/linkedin-drafts/list/route.ts` + `[id]/route.ts` + `[id]/visibility/route.ts` : API admin
- `app/admin/linkedin-drafts/page.tsx` : dashboard avec login persistent localStorage, bouton Deconnexion, badges (draft/✓teste/approved/published/skipped/failed), boutons Approuver/Rejeter/Publier maintenant/Tester Gemini/Tester ChatGPT
- Crontab Linux VPS : `0 7,11,16` genere drafts, `30 7,11,16` auto-publie

**Workflow autonome** : Cyril approuve les drafts en lot via admin (bouton ✓ Approuver) → cron auto-publie 3x/jour. Approuver 30 drafts un dimanche = 10 jours de posts auto.

**Bloqueur final identifie** : LinkedIn anti-bot. Login session Playwright marche (via SSH SOCKS proxy `ssh -D 1080 ubuntu@beta.ai-visionary.xyz` + `playwright codegen --proxy-server=socks5://127.0.0.1:1080`). Mais apres click "Commencer un post", LinkedIn affiche un toast "Sorry, something went wrong" et invalide la session. Plusieurs tentatives (locale FR/EN, navigation directe `/feed/?shareActive=true` au lieu de click, multi-selectors editeur Quill/Lexical) — toutes echouent. **L'auto-publication via Playwright n'est pas viable a court terme.**

**Solutions futures (a Cyril de trancher)** :
- Bouton "Copier le texte" sur l'admin → Cyril colle manuellement dans LinkedIn (10 sec/post, 100% fiable)
- xvfb sur VPS + login direct depuis IP VPS (30 min setup, fingerprint coherent)
- LinkedIn Marketing Developer Platform (necessite Company Page que Cyril ne peut pas creer)

**Commits** : `2ea71c6a` (initial pipeline), `e2c60a9b` (refactor VPS-only), `8475d91b` (admin page), `661f5464` (Gemini/ChatGPT visibility buttons), `da667d5f` (localStorage persist), `2fe6e9ef` (logout), `c7cd78f3` (Gemini auto-check), `576acbff` (badge teste), `ad9e8f3b` (queue + auto-publish), `7851fce6` (serverExternalPackages), `f23f277a` (clear error_message), `047e6b5f` (createRequire turbopack bypass).

**Branche `feature/linkedin-marketing` non mergee dans main.** Cyril decide quoi en faire.

---

## Session 1er mai 2026 — Securite Stripe Portal + desengorgement docs

- **Fix faille H7 — Stripe Portal authentification** : `app/api/stripe/portal/route.ts` reecrit. Avant : check `sessionToken` truthy uniquement (n'importe quelle string passait). Apres : `verifyUpdateToken(token, entityId)` HMAC stateless (pattern aligne sur `/api/update-entity`, `/api/regenerate-files`, `/api/update-owner-email`). Stateless donc survit aux migrations Firestore→Supabase→Infomaniak. Code-reviewer subagent : 0 issue HIGH/CRITICAL. Aucun call site frontend (route etait dead code, donc 0 risque de regression).
- **Robustesse Stripe TEST→LIVE** : meme route. Wrapper `billingPortal.sessions.create()` dans try/catch. Si stored `stripe_customer_id` est `cus_test_*` (legacy avant 11 avril) → fallback `customers.list({email})` en mode LIVE → auto-update `stripe_customer_id` Supabase (1 row, ownership prouve par HMAC) → retry. Si toujours rien → 404 `is_legacy:true`.
- **Desengorgement CLAUDE.md 779 → 405 lignes** : sections 6 (CE QUI EST FAIT), 6.5 (MIGRATION), 7 (TODO), 8 (COSTS) externalisees vers fichiers dedies. CLAUDE.md devient un index avec stubs pointant vers `STATE.md` / `MIGRATION.md` / `TODO.md` / `COSTS.md`.
- **Alignement hardcodes vs realite 30 298** : `app/page.tsx:25` (JSON-LD homepage) "4400+" → "30000+". `app/api/aya/docs/route.ts:124` exemple stats `indexed_count` 887 → 30292.
- **Activation agregation cote VPS** : ajout `AYA_VPS_API_URL=http://localhost:3000/api/aya-local` au `.env.local` du VPS (non committe). Avant : VPS retournait Supabase only (4438). Apres : VPS retourne agregation (30 298) via self-call HTTP localhost. Solution temporaire en attendant MV.3 (refactor pour lecture Postgres locale directe sans HTTP).
- **Incident rsync individuel** : `rsync ./app/page.tsx ubuntu@vps:/home/ubuntu/app/` copie le fichier a la **racine** de la destination (pas dans `app/`). Toujours utiliser `rsync -R` (relative) pour preserver la structure quand on transfere des fichiers individuels.
- Commits : `2ea71c6a` (Stripe Portal H7 + desengorgement) + `35806291` (hardcodes alignes). Pushes sur `main`. VPS et Vercel alignes sur `35806291`.

---

## Référence rapide

| Métrique | Valeur (28 avril 2026) |
|----------|------------------------|
| Entités AYA totales (live) | 30 298 |
| - Supabase (legacy/certifiées) | 4 438 |
| - Postgres VPS (Tranco scrapées) | 25 860 |
| Pays | 73+ |
| ASR certifiés | 4 |
| JSONs locaux dans `aya/data/` | ~46 000 |
| Domaines Tranco restants à scraper | ~110 000 (11 batches de 10k) |
