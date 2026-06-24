# AI VISIONARY — STATE.md

> Liste de ce qui est FAIT et FONCTIONNE en production.
> Extraite de CLAUDE.md le 1er mai 2026 pour désengorger le contexte.
> CLAUDE.md référence ce fichier en section 6.

---

## Marketing — machine à deux côtés (24 juin 2026)

> Voir `NEOUSBOT-OUTREACH-RUNBOOK.md` (exploitation outreach) + `POLLEN-DEAL-KIT.md` (BD partenaires) + `VISION-POLLEN-AGENTS.md` (stratégie). Tout déployé + vérifié en prod VPS.

- **Pivot « gratuit pour l'instant »** (décision verrouillée) : paywall retiré du parcours public ; copy FAQ (a4/a7) + CGV (s2/s3) alignés FR/EN ; Stripe gardé sous le capot. Vérifié en prod (texte visible sans 19/499 CHF).
- **Pollen Agents rendu visible** : la page `/pollen-agents` (déjà live) est désormais liée — **section dédiée `#pollen`** sur la home (fond `#F1F5F9`, badge teal, 3 cartes blanches à liseré teal « Pour les entreprises / Pour les utilisateurs / Ouvert & neutre », bouton `btn-primary` « Découvrir Pollen Agents ») + **lien footer** (FR/EN). Construit 100% sur le design system (pas d'emoji abeille ni couleurs hors-palette).
- **Moteur d'outreach automatisé** (`lib/outreach/`) — **ARMÉ mais INERTE** (`OUTREACH_ENABLED` absent = dry-run forcé) : SMTP throttlé via identité dédiée `hello@` (décision Cyril), List-Unsubscribe one-click RFC 8058, suppression globale, désinscription publique, cron warmup gated. Tables `outreach_recipients`/`outreach_suppression`/`outreach_events`. Templates FR/EN (angle standard ouvert). Cible ASR = **4 456 emails** digital/SaaS/fintech/crypto. `verify` SMTP OK, test réel reçu en **inbox**. Endpoints `/api/admin/outreach` (preview/import/send/test/suppress/verify), `/api/outreach/unsubscribe`, `/api/cron/outreach`.
- **Pipeline partenaires cashback** (BD automatisée) : détecteur de programme d'affiliation `lib/outreach/affiliate-detector.ts` (haute précision, path-based) → table `partner_candidates` (shortlist BD persistante) + **dédup par marque** (`outreach_recipients.kind`/`brand`). ~177 marques scannées → ~16 avec affiliation détectée. **Connecteur réseaux d'affiliation Awin/Impact** `lib/pollen/network-connector.ts` → `cashback_offers` (marques connues), admin `import-network` (dry-run/réel) — attend le compte éditeur Awin de Cyril + clés API.
- **Moteur cashback Pollen** (déployé 16 juin) : jeton d'attribution Ed25519, `/api/pollen-agents/*` (offer/claim/ask), admin/cashback, validation manuelle outcome-only.
- **Gated (Cyril, external-facing)** : clés API Awin/Impact, filtre qualité email avant envoi (junk type `info@domain.com`), GO `OUTREACH_ENABLED=true` + ramp, signature des deals.

## Ingestion & croissance registre (4 juin 2026) — registre 32 333 → 367 301 (×11)

- **Moteur de masse mondial = Web Data Commons** (annuaires Common Crawl) : entreprises domain-keyed chargées en prod VPS sans scraping, ~0 CHF. `FUSION-WDC` (321 893) + `FUSION-WDC-MIN3` (13 075).
- **Qualité appliquée live** : pays normalisés + remplis par ccTLD (couverture **72 %**), +126 791 secteurs par mots-clés, recadrage Wikidata/Infomaniak (55 pays + secteurs corrigés, ex. M&S Belgique→GB).
- **Résolveur de domaine MONDIAL** (`aya/ingestion/domain_resolver.py`) : trouve le site d'une boîte à partir de son nom (teste en vrai + vérifie, ccTLD par pays, ~25-39 %) → réveille les pools sans-site (LINDAS CH, annuaires WDC, registres FR/UK/DE).
- **Packagé** : skill `/aya-ingestion`, pipeline `aya/ingestion/run_all.sh` + `resolve_and_load.sh`, doc `aya/ingestion/HANDOFF.md`, stratégie `PLAN-INGESTION-ANNUAIRES.md`. Réversible par `data_origin`. Accès VPS : clé `~/.ssh/aya-bot`.

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

## Session 11 mai 2026 — Bascule prod 100% suisse (hosting + LLM + DB aya_registry)

**Contexte** : matin = alerte Supabase Disk IO Budget en cours d'épuisement (incident Tranco rescoring egress en grace period expiré le 7 mai). Pivot complet vers infrastructure 100% suisse en une session.

### Étape 1 — Fix Supabase Disk IO (PR #1, commit `a77ac36f`)
- Cache mémoire in-process sur `getAyaEntities` (15min TTL) et `getAyaEntitiesByFilter` (10min TTL)
- 3 passes `/ultrareview` → 10 bugs trouvés/corrigés (cache poisoning, race condition, mutation cache, NSFW count mismatch, unbounded eviction, no invalidation, external writers, stripe error check, generation counter, deep-clone enrichment)

### Étape 2 — Migration LLM Gemini → Infomaniak AI (PR #2, commit `7d880762`)
- Nouveau `lib/llm-provider.ts` : `llmJson` (json_schema mode) + `llmText` (free text)
- Provider routing implicite via `INFOMANIAK_AI_TOKEN`
- Migration des 4 call sites Gemini : `lib/micro-agents/llm-agent.ts`, `app/api/chat/route.ts`, `lib/ayo-semantics.ts`, `lib/linkedin/visibility-checker.ts` (ChatGPT path conservé pour cross-check)
- Modèle initial Apertus-70B (pure swiss-ai) puis switch sur **Ministral-3-14B** pour latence (`mistralai/Ministral-3-14B-Instruct-2512`, ~5x plus rapide, hosted Suisse Infomaniak)

### Étape 3 — Perf diagnostic V2 (PR #3, commit `75126da8`)
- 8 micro-agents **en parallèle** via `Promise.all` (étaient séquentiels)
- **Retry x3 supprimé** (services, legal, process — json_schema rend l'output deterministe)
- **Double-scan post-OTP supprimé** : `startScan(true)` après verify-OTP était lancé même si `score` déjà calculé
- **Anti-hallucination email/phone** dans `detect-contact.ts` : si l'email retourné par le LLM n'est pas littéralement dans le HTML source → rejeté avec warning "HALLUCINATION REJECTED" (doctrine AYO "n'invente rien")
- **Résultat** : diagnostic E2E **2 min → 19s** (~6x plus rapide)

### Étape 4 — Bascule hosting Vercel → VPS Infomaniak
- DNS Infomaniak : `ai-visionary.xyz` A `216.198.79.1` (Vercel) → `83.228.229.212` (VPS), `www` CNAME Vercel → A VPS (TTL 60s)
- Certbot `--nginx --expand` : SAN ajouté pour `ai-visionary.xyz` + `www.*` (en plus de `beta.*`), Let's Encrypt valide jusqu'au 9 août 2026
- nginx config : `proxy_read_timeout 300s`, `proxy_buffering off` (pour SSE longs)
- 3 cron jobs Linux ajoutés sur le VPS : `expire-entities` (hourly), `expiry-reminders` (07:00 UTC), `review-reminders` (07:05 UTC) via curl localhost:3000 avec Bearer CRON_SECRET
- Env vars sync local → VPS (merge): 7 vars critiques manquantes ajoutées (SMTP_*, NEXT_PUBLIC_BASE_URL, STRIPE_PRICE_*, etc). Stripe LIVE keys restaurées depuis Vercel après sync overrode par les test keys local.

### Étape 5 — Migration totale `aya_registry` Supabase → Postgres VPS (PR #4, commit `a505aa5d`)
- Dump des 4 437 entités Supabase via SDK REST (paginé 1000) → JSON 22 MB
- ALTER TABLE VPS : `asr_score` INTEGER → NUMERIC(5,1), +10 colonnes manquantes (admin_*, owner_email, pack_type, subscription_*, etc.)
- Import via Python `psycopg2` avec ON CONFLICT UPDATE → 394 nouvelles + 4 043 updated, 0 erreurs
- **Total VPS** : 26 254 entités (5 certifiées : WHTG1, Global Workflow, Association Éclore, AI VISIONARY, API Glossaries)
- `lib/db-local-pg.ts` étendu : `localPgUpsertEntity`, `localPgUpdateEntity`, `localPgGetEntityBySubscriptionId`, `localPgMarkEntitiesExpired`, `localPgGetAyaEntities`, `LocalPgStats` enrichie
- `lib/db.ts` : early-return VPS-only sur toutes les fonctions `aya_registry` (reads + writes) quand `isLocalPgConfigured()`
- Supabase rows `aya_registry` **gardées en backup** (pas de DELETE) pour rollback eventuel
- Live tests post-bascule (https://ai-visionary.xyz) : `/api/aya/stats` 67ms, `/api/aya/search` 100ms, pages SSR `/aya/sector/*` 150-180ms, diagnostic E2E anthropic.com 19s

### Reliquats
- Vercel reste actif 24-48h pour surveillance, puis désactivation manuelle
- DNS staging `beta.ai-visionary.xyz` à supprimer après confiance prod établie
- Tables Supabase opérationnelles (`analyses`, `scan_states`, `system_logs`, `otp_codes`, `sessions`, `aya_api_analytics`) restent sur Supabase (migration plus tard si besoin)
- DELETE pour démo : entité `regenereplus.ch` (entity_id `48147436-...`) supprimée de Supabase pour permettre re-scan en vidéo démo. Fichier JSON de la fiche conservé par Cyril pour rechargement post-démo.

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

## Session 10 mai 2026 — Suite incident facturation Google + 2e fuite (Wise-Weather-App) + désactivation hooks adaptive-model

**Pic facturation détecté** : 1 592,74 CHF cumulés en mai 2026 sur le billing account `015BAF-B06CBF-E23957` (1 413,62 CHF sur Gemini API du projet Better-ESG, +3 235% vs avril). Tentative de prélèvement ~$400 sur la carte de Cyril → **échec** → Google a flaggé "potential account hijacking" et désactivé automatiquement la facturation sur **TOUS les projets** du compte.

**2e fuite découverte (repo public Wise-Weather-App)** : 2 nouvelles clés Gemini exposées dans le repo public `https://github.com/NeousAxis/Wise-Weather-App` :
- `[REDACTED-WiseWeather-key-1]`
- `[REDACTED-WiseWeather-key-2]`

Ces clés sont la cause probable du pic 1 413,62 CHF sur Gemini API : exposées plusieurs mois → exploitées par bots GitHub → activité abusive imputée au compte.

**Régularisation manuelle effectuée** :
1. Désactivation manuelle (via Claude in Chrome MCP) de plusieurs projets dans `https://console.cloud.google.com/billing/015BAF-B06CBF-E23957/manage` : Better-ESG, wise-weather-app, Body Twin, WiseWeatherPollen.
2. **Réactivation** de `wise-weather-app` (project ID `wise-weather-app`) + `WiseWeatherPollen` (`gen-lang-client-0641825525`) car l'app Wise-Weather-App est en lancement App Store. Vérification effectuée : `wise-weather-app` est confirmé comme le bon project ID via `.env.production` + `package.json` + workflows GitHub Actions du repo. Les 3 autres projets "WiseWeather*" sont des doublons obsolètes.
3. **Nettoyage tags GitHub manquants** : la clé `[REDACTED-Gemini-key-was-here]` traînait encore dans 19 tags publics (`deploy-202601*`, `v1.0.0`, `v2.0.0`, `v2026-01-15-working-state`, etc.) qui n'avaient pas été force-pushés lors du cleanup du 9 mai. Tags réécrits via `git-filter-repo` + `git push --force --tags origin`. Repo public `ai-visionary` désormais 100% propre (vérification re-clone : 0 occurrence de la clé).

**État sécurité AI-VISIONARY (vérifié 10 mai)** : aucune clé Gemini exposée dans le code source (working tree), aucune dans l'historique Git public (branches + tags), `.env.local` privé contient `GEMINI_API_KEY=...sL4` qui est sur le projet `gen-lang-client-0314106061` (suspendu).

**Désactivation des hooks `adaptive-model`** (cause de doublons de réponse) :
- Les 3 hooks (`adaptive-model-verify.sh`, `adaptive-model-reminder.sh`, `adaptive-model-delegation-verify.sh`) remplacés par des stubs `exit 0` dans `~/.claude/hooks/`. Originaux préservés dans `*.bak`.
- `~/.claude/CLAUDE.md` (instructions globales) : règle "Honest model annotation" remplacée par note `DISABLED 2026-05-10`.
- `~/.claude/commands/adaptive-model.md` : nettoyé.
- `~/.claude/skills/adaptive-model/SKILL.md` : note en tête désactivant les tags `[Session: ...]` et `[Delegating to: ...]` (logique de routing préservée).

**3 mails support en cours** :
1. Trust & Safety pour Better-ESG (envoyé 8 mai par Cyril).
2. Cloud Support case 70874317 pour `gen-lang-client-0314106061` ~73€ (envoyé par Cyril).
3. Suite à découverte 2e fuite Wise-Weather-App : nouveau mail à envoyer pour contester les 1 592 CHF cumulés.

**État final compte facturation** :
- ✅ wise-weather-app (réactivé, app App Store)
- ✅ WiseWeatherPollen (réactivé)
- 🚫 Better-ESG (suspendu Google + désactivé)
- 🚫 AI-VISIONARY x2 (gen-lang-client-0314106061 suspendu, ai-visionary-3786e désactivé Google)
- 🚫 9 autres projets (Body Twin, BODY TWIN, COSMOS-APP, Gemini API, wikiflow, Wise-Weather-App, WiseWeatherApp, digitalqrcard, better-esg) : tous "Facturation désactivée" automatiquement par Google

---

## Session 7-9 mai 2026 — Incident clé Gemini exposée + cleanup git history + hook gitleaks

**Contexte** : projet Google Cloud `gen-lang-client-0091131679` (Better-ESG) suspendu pour "ressources piratées" + projet `gen-lang-client-0314106061` facturé ~73€ entre 1-4 mai sur `gemini-3-flash-preview`.

**Cause 1 (Better-ESG)** : clé `[REDACTED-Gemini-key-was-here]` introduite le 12 déc 2025 (commit `693beb99`) dans `landing-page/script.js` puis "retirée" 13 min plus tard (commit `0e92bb8c`). Mais la clé est restée recoverable dans l'historique Git public ~5 mois → bots GitHub l'ont exploitée → suspension automatique pour activité abusive.

**Cause 2 (gen-lang-client-0314106061)** : `aya/reclassify_and_enrich_vps.py` tournait sur le VPS avec :
- Modèle `gemini-3-flash-preview` (preview, ~10-20× plus cher que `gemini-2.0-flash`)
- BATCH_SIZE=5 au lieu de 20 (4× plus d'overhead prompt)
- 4 scripts séparés (`enrich_with_gemini.py`, `enrich_keywords.py`, `enrich_keywords_fr.py`, `translate_to_fr.py`) → 4 appels Gemini par entité au lieu d'1
→ ~73€ consommés en 4 jours pour ce que devait coûter ~$1.

**Actions correctives appliquées (9 mai 2026)** :

1. **Cleanup git history** via `git-filter-repo` (alternative moderne à BFG) : clé `AIzaSy...` remplacée par `***REMOVED***` dans tous les commits passés sur 4 branches (`main`, `feature/ayo-v4-evidence-based`, `feature/linkedin-marketing`, `fix/domain-xyz`). Force-push effectué. Backup miroir préservé dans `/tmp/ai-visionary-backup-*.git`.
2. **Hook gitleaks** installé (`brew install gitleaks` + `.githooks/pre-commit` versionné dans le repo + `core.hooksPath = .githooks` configuré). Tout commit futur contenant un secret (`AIza...`, `sk-...`, etc.) est automatiquement bloqué.
3. **Script `reclassify_and_enrich_vps.py` refactorisé** : modèle → `gemini-2.0-flash`, BATCH_SIZE → 20, prompt unique retournant 4 outputs (description EN/FR + keywords EN/FR), filtre skip si les 4 champs présents, jsonb_set 4-niveaux pour write Postgres VPS. Estimation coût : ~$0.50–$1 pour 25 860 entités (vs ~73€ avant).
4. **2 mails de support** envoyés par Cyril : (a) Trust & Safety (Better-ESG) avec preuve fuite GitHub, (b) Cloud Support case 70874317 pour goodwill credit ~73€ avec full transparency sur cause Claude Code mal configuré.
5. **Repo local resync** : `~/AI VISIONARY` reset sur nouveau `main` (SHA `ebe149f1`), modifs locales préservées via stash/pop.

**Bloqueur actuel** : les 2 projets GCP sont suspendus (Better-ESG + gen-lang-client-0314106061), donc impossible de relancer le batch d'enrichissement VPS. En attente réponse Google.

**Note résiduelle** : la clé exposée traîne encore dans 2 branches locales (`claude/festive-satoshi-169a07` + `claude/heuristic-ellis-da6d78`) qui ne sont pas sur GitHub. Pas un risque public, mais à nettoyer (rebase + `git gc --prune=now`) quand Cyril veut.

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

| Métrique | Valeur (11 mai 2026) |
|----------|----------------------|
| Entités AYA totales (live, Postgres VPS) | **26 254** |
| - Issues du dump Supabase (legacy/certifiées) | 4 437 (394 nouvelles + 4 043 overlap déjà sur VPS) |
| - Issues du scraping Tranco EU | ~25 860 |
| Pays | 73+ |
| ASR certifiés (`payment_completed=true`) | **5** (WHTG1, Global Workflow, Éclore, AI VISIONARY, API Glossaries) |
| JSONs locaux dans `aya/data/` | ~46 000 |
| Domaines Tranco restants à scraper | ~110 000 (11 batches de 10k) |
| Hosting | VPS Infomaniak (IP `83.228.229.212`) |
| LLM | Infomaniak AI / Ministral-3-14B (`mistralai/Ministral-3-14B-Instruct-2512`) |
| DB `aya_registry` | Postgres VPS local (`aya_local`) |
| DB tables operationnelles | Supabase (residuel) |
