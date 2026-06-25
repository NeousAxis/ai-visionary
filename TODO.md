# AI VISIONARY — TODO.md

> Liste des taches restantes (et leur statut a jour).
> Extraite de CLAUDE.md le 1er mai 2026 pour désengorger le contexte.
> CLAUDE.md référence ce fichier en section 7.

---

## Tâches actives (à faire)

| # | Tache | Priorite | Statut |
|---|-------|----------|--------|
| 44 | **Vision Pollen Agents × AYA — réseau ouvert d'agents** (récup. redevable + flywheel auto-financé) | Vision / Strat | 📄 Documenté dans `VISION-POLLEN-AGENTS.md` (31 mai 2026, exploration — NON commité). Repositionnement : AYA passe d'« annuaire lisible » à « source de confiance que les agents **interrogent** » (récupération redevable, pas remplacement du search). Extension **Pollen Agents** sur `ai-visionary.xyz/pollen-agents` = marché où des agents **rémunérés** (commission **non-distordante**, financée par les services pour un client acquis = flywheel auto-financé, zéro burn) viennent consulter AYA. Identité des 2 côtés (ASR services ↔ **mandat** agents) = anti-fraude qui rend l'économie possible. **AYA gratuit an 1** (land-grab offre, monétisation sur l'outcome). Distinction clé : signer = intégrité ≠ véracité → on rend la déclaration **redevable**. Prochaines étapes : (a) vérif dispo marque/domaine « Pollen Agents » ; (b) choisir 1ère verticale haute-valeur + chiffrer flywheel réel ; (c) décider AYA gratuit maintenant vs annoncé (cohérence partenaires) ; (d) cadrer le mandat d'agent (standards ouverts : W3C VC, MCP). Contact partenariat Mistral envoyé via formulaire le 31 mai. **MAJ 24 juin : exécution lancée — voir ligne 44b.** |
| 44b | **Pollen / Outreach / Cashback BD — EXÉCUTION** | Critique | ✅ **Construit + déployé + vérifié prod 24 juin** : (1) moteur outreach automatisé (`lib/outreach/`, SMTP `hello@`, **inerte** `OUTREACH_ENABLED` absent), cible 4 456 emails, test reçu inbox ; (2) pipeline partenaires cashback (détecteur affiliation + `partner_candidates` + dédup marque, ~16 marques qualifiées) ; (3) connecteur réseaux **Awin/Impact** → `cashback_offers` ; (4) copy « gratuit pour l'instant » (FAQ/CGV) ; (5) Pollen visible (section home `#pollen` + footer). Décisions verrouillées : Pollen=route, gratuit pour l'instant, hello@. **Gated Cyril** : (a) compte éditeur Awin → clés API, (b) filtre qualité email, (c) GO `OUTREACH_ENABLED=true` + ramp, (d) signer les deals. Voir STATE.md §Marketing + `NEOUSBOT-OUTREACH-RUNBOOK.md` + `POLLEN-DEAL-KIT.md`. |
| 44c | **DISTRIBUTION DES AGENTS — faire trouver le MCP `/agents/mcp`** | **PRIORITÉ N°1 — partie autonome ✅ FAITE (25 juin)** | Serveur MCP distant LIVE. **(b) Surfaces auto-descriptives ✅ déployées + vérifiées prod** : `/llms.txt`, page `/for-agents` (bilingue, config copier-coller Claude/Cursor/CLI, 5 outils, économie cashback, footer+sitemap), `.well-known/mcp.json`, `ai-plugin.json` enrichi `x_mcp`. **Manifestes registres ✅ prêts (repo)** : `server.json` (schéma registre MCP officiel, remote, namespace `xyz.ai-visionary/aya-registry`), `smithery.yaml`. **Runbooks ✅** : `MCP-DISTRIBUTION-RUNBOOK.md` + `POLLEN-AGENTS-BROADCAST.md` (posts prêts : awesome-mcp PR, r/AI_Agents, X, Show HN, Product Hunt, Discord MCP). **⏳ RESTE CLIC CYRIL (≈30 min)** : (a) publier sur registres — registre officiel MCP (`mcp-publisher` + DNS TXT `ai-visionary.xyz` OU OAuth GitHub NeousAxis), Smithery, mcp.so, PulseMCP, awesome-mcp PR ; (c) broadcast communautés. Pas-à-pas dans `MCP-DISTRIBUTION-RUNBOOK.md`. |
| 44d | **Côté DEMANDE — activer les premiers opérateurs d'agents** | Critique | Le vrai cold-start. Boucle prouvée + MCP distant prêt. Brancher 1-2 agents réels (dont celui de Cyril, sur Telegram → s'il parle MCP, lui donner l'URL) qui font des vraies requêtes + cashback. + Awin dès clés Cyril pour l'inventaire marques connues. |
| 5 | Scraping 100k entites + registres du commerce | Critique | En cours — Vague 1 Tranco EU : batches 1-5 scrape (+39 478 JSONs cumules au 25 avril, total data/ ~46 000 incl. 6682 initial), ~11 batches de 10k restants dans `domains_growth_tranco.txt` |
| 8 | Soumission There's An AI For That | Moyenne | Cyril |
| 24 | Vague 1 batches 6→16 (~110 000 domaines Tranco restants) | Critique | Batches 1-5 faits (55 676 JSONs scrapes au 25 avril, 25 860 pushes Postgres VPS au 28 avril). ~11 batches de 10k restants. Cible push : Postgres VPS uniquement. |
| 25 | Patcher `aya/fetch_sirene.py` rate limit (HTTP 429) | Moyenne | REQUEST_DELAY 0.4s → 1.5s + retry exponentiel + MAX_PAGES_PER_CODE 8 → 4 |
| 26 | ~~Trouver alternative Zefix CH (401 auth sur `/search`)~~ | ✅ **RÉSOLU 4 juin** | **LINDAS SPARQL** (`lindas.admin.ch/query`, graphe `register.ld.admin.ch/zefix/company/`) = registre suisse complet (788k), sans auth, sans limite, avec le but/IDE. API REST Zefix abandonnée (interdit la masse). |
| ING | **Ingestion mondiale SANS scraping → registre ×11 (367 301)** | ✅ **DONE 4 juin** | Moteur Web Data Commons chargé en prod + qualité (pays 72 %, secteurs) + recadrage + résolveur de domaine mondial. Packagé : skill `/aya-ingestion`, `aya/ingestion/` (scripts + HANDOFF), `PLAN-INGESTION-ANNUAIRES.md`. Reste : pays `.com` manquants (Wikidata), résoudre + charger les pools sans-site (LINDAS 789k, WDC min3 4,6M), vrais scores. |
| 28 | thepiratebay.se + politique warez | Moyenne | EN ATTENTE — Cyril a reporte la decision (14 avril). Pas dans blocklist pour l'instant |
| MV | ~~Migration Vercel → VPS Infomaniak (100% suisse)~~ | ✅ **DONE 11 mai 2026** | Bascule effectuée. DNS `ai-visionary.xyz` + `www` pointent sur VPS Infomaniak `83.228.229.212`. Cert Let's Encrypt étendu. nginx + cron jobs configurés. Vercel à désactiver après 24-48h surveillance. |
| MV+ | **Migration totale `aya_registry` Supabase → Postgres VPS** | ✅ **DONE 11 mai 2026** | 4 437 entités dumped + importées (26 254 total VPS, 5 certifiées). `lib/db.ts` refactor : reads/writes via `lib/db-local-pg.ts` quand `VPS_PG_PASSWORD` set. PR #4 merged (`a505aa5d`). |
| MV.cleanup | **Désactiver Vercel + retirer auto-deploy GitHub** | Moyenne | Attendre 24-48h surveillance VPS, puis : (a) suspendre projet Vercel, (b) retirer webhook GitHub Vercel, (c) supprimer record DNS `beta.ai-visionary.xyz`. |
| MV.cleanup2 | **Migration Supabase opérationnelles → Postgres VPS** (optionnel) | Basse | Reste `analyses`, `scan_states`, `system_logs`, `otp_codes`, `sessions`, `aya_api_analytics` sur Supabase. Pas urgent (data short-lived). À faire si quota Supabase devient problématique ou pour doctrine 100% suisse stricte. |
| MV.cleanup3 | **Recharger fichier JSON `regenereplus.ch`** | Critique post-vidéo | Cyril a supprimé regenereplus.ch de Supabase + VPS pour faire vidéo démo. Recharger après tournage via Supabase REST ou `/api/admin/enrich`. Cyril a le fichier JSON local. |
| 30 | Configurer Newsletter Infomaniak (50k credits/mois) | Haute | En attente des codes. Adapter template email ou utiliser API Newsletter Infomaniak |
| 31 | Setup kSuite Business 3 users @ai-visionary.com | Moyenne | En attente des codes. 3 boites email pro |
| 36 | Deblocage compte Newsletter Infomaniak | Critique | Reponse Infomaniak recue (28 avril) avec 4 questions. Reponse honnete envoyee. Newsletter ne sera utilisee qu'avec une vraie base opt-in. En attente confirmation Infomaniak. |
| 37 | **Pipeline LinkedIn marketing — finir publication auto** (branche `feature/linkedin-marketing`) | Critique | Pipeline complet en place : generation drafts + verif Gemini/ChatGPT + admin avec login persistent + queue approuvee + 2 crons (gen+publish) + table Postgres VPS. **Bloqueur** : LinkedIn anti-bot rejette les sessions Playwright (toast "Sorry something went wrong" + invalidation auto). Decision Cyril : (a) bouton "Copier le texte" + paste manuel (5 min code, 100% fiable), (b) xvfb sur VPS + login depuis IP VPS (30 min setup), (c) Company Page → API officielle (semaines). Voir STATE.md pour details. |
| 38 | **Débloquer projet GCP `gen-lang-client-0314106061`** (Generative Language API) | Critique | Suspendu par Google le 9 mai 2026 ("potential account hijacking" déclenché par surconso ~73€ entre 1-4 mai sur `gemini-3-flash-preview` via Claude Code mal configuré). Case Cloud Support 70874317 ouvert avec demande goodwill credit. En attente réponse Internal Team Google. **Tant que ce projet est suspendu, impossible de relancer le batch d'enrichissement VPS** (les ~22 000 entités sans description+keywords Gemini restent en l'état). |
| 39 | **Débloquer projet GCP Better-ESG (`gen-lang-client-0091131679`)** | Haute | Suspendu par Trust & Safety le 7 mai 2026 ("ressources piratées" suite à fuite clé GitHub publique 12 déc 2025 → 7 mai 2026). Appel envoyé par Cyril avec preuve historique Git + mesures correctives (cleanup git history `git-filter-repo` + force-push 4 branches + hook gitleaks installé). En attente réponse. Si pas réactivé : créer un nouveau projet GCP propre avec billing actif + budget alerts. |
| 40 | **Rebaser branches locales `claude/festive-satoshi-169a07` + `claude/heuristic-ellis-da6d78`** sur nouveau main | Basse | Ces 2 branches contiennent encore la clé `AIzaSy...` dans leur historique (avant le force-push du 9 mai). Pas un risque public (jamais pushed), mais à nettoyer pour éliminer définitivement la clé du repo local. Procédure : `git rebase --onto origin/main <ancienne-base> <branche>` puis `git gc --prune=now`. |
| 41 | **Envoyer mail Cloud Support** (case 70874317) demande remboursement CHF 1 592,74 | Critique | Pic facturation 10 mai (1 413,62 CHF Gemini API Better-ESG + autres). Preuve : 2 nouvelles clés exposées dans repo public Wise-Weather-App (`AIzaSyAxhl...hwSs`, `AIzaSyDiGm...gRhw`) → exploitées par bots → activité abusive. Mail rédigé (voir transcript 10 mai) à envoyer en réponse au case. |
| 42 | **Cleanup repo public Wise-Weather-App** (`https://github.com/NeousAxis/Wise-Weather-App`) | Haute | 2 clés Gemini encore dans l'historique Git public (`AIzaSyAxhl...hwSs` + `AIzaSyDiGm...gRhw`). Faire `git-filter-repo --replace-text secrets.txt` + force-push toutes branches + force-push --tags. Installer aussi le hook gitleaks. Procédure identique à celle du 9 mai sur ai-visionary. |
| 43 | **Vérifier le build app Wise-Weather-App sur App Store** | Critique | Si les 2 clés Gemini exposées sont encore dans le binaire iOS publié, l'app continuera à les utiliser. Soit : (a) elles ont déjà été remplacées dans une nouvelle version → OK, (b) le binaire en review/prod les utilise toujours → forcer release nouvelle version avec env vars hors code. À vérifier avec Cyril. |

---

## Failles sécurité encore ouvertes

| ID | Faille | Risque | Statut |
|----|--------|--------|--------|
| H8 | Markdown non-sanitise dans AyoChat (XSS) | Haute | À fix — DOMPurify |
| M3 | `dangerouslySetInnerHTML` dans layout | Moyenne | À évaluer (risque faible : JSON.stringify) |
| B5 | Types `any[]` dans AyoChat | Basse | À typer strictement |

---

## Tâches faites (référence rapide)

| # | Tache | Date |
|---|-------|------|
| 1 | Merger branches en attente dans `main` | 31 mars 2026 |
| 2 | Coherence linguistique fichiers PRO (EN par defaut) | 31 mars 2026 |
| 3 | AYO V4 Evidence-Based actif en prod | 3 avril 2026 |
| 4 | Stabiliser qualite fichiers PRO (anti-marketing, classification, normalisation) | 3 avril 2026 |
| 7 | Re-exporter GitHub/HuggingFace | 7 avril 2026 |
| 9 | Diagnostic V2 micro-agents merge dans main | 5 avril 2026 |
| 10 | Monitoring API AYA | 7 avril 2026 |
| 12 | Dashboard Entreprise `/dashboard/[entityId]` | 6 avril 2026 |
| 13 | i18n FR/EN page diagnostic V2 | 6 avril 2026 |
| 14 | Responsive mobile page diagnostic V2 | 6 avril 2026 |
| 15 | Footer visibility (commit f91f98cd) | 6 avril 2026 |
| 16 | Score alignment V2→email→AYA | 6 avril 2026 |
| 17 | Public Key ID visible dans cartes AYA | 6 avril 2026 |
| 18 | Admin enrichment API + fix gemini-3-flash-preview | 6 avril 2026 |
| 19 | Vague 1 Tranco — extraction 156k domaines EU + batch 1 | 14 avril 2026 |
| 20 | Blocklist porn/armement | 14 avril 2026 |
| 22 | Schema Supabase `missing_contact_email` + `email_research_status` | 14 avril 2026 |
| 29 | Setup VPS Infomaniak `aya-bot` | 28 avril 2026 |
| 32 | Fix parser.py `normalize_country` crash sur JSON-LD dict | 18 avril 2026 |
| 33 | Cap 50 sans ASR (regle doctrinale stricte) | 21 avril 2026 (commit f31d1d65) |
| 34 | Masquage concurrents pour ai-visionary.xyz | 21 avril 2026 (commit f31d1d65) |
| 35 | API DNS Infomaniak | 25 avril 2026 |
| H7 | Stripe Portal authentification HMAC + auto-migration TEST→LIVE | 1er mai 2026 (commit `2ea71c6a`) |
| — | Désengorgement CLAUDE.md → STATE/MIGRATION/TODO/COSTS.md | 1er mai 2026 (commit `2ea71c6a`) |
| — | Alignement hardcodes "4400+/887" → "30000+/30298" | 1er mai 2026 (commit `35806291`) |
| — | Fix Supabase Disk IO (cache mémoire `aya_registry`) + 10 bugs `/ultrareview` | 11 mai 2026 (PR #1, commit `a77ac36f`) |
| — | Migration LLM Gemini → Infomaniak AI (`lib/llm-provider.ts`, Apertus puis Ministral-3-14B) | 11 mai 2026 (PR #2, commit `7d880762`) |
| — | Perf diagnostic V2 : 2 min → 19s (parallélisation 8 agents + retry x3 supprimé + double-scan supprimé + anti-hallucination email/phone) | 11 mai 2026 (PR #3, commit `75126da8`) |
| MV | Migration hosting Vercel → VPS Infomaniak (DNS switch, TLS, nginx, cron jobs) | 11 mai 2026 |
| MV+ | Migration `aya_registry` Supabase → Postgres VPS (4 437 entités + refactor `lib/db.ts`) | 11 mai 2026 (PR #4, commit `a505aa5d`) |

---

## Tâches abandonnées

| # | Tache | Raison | Date |
|---|-------|--------|------|
| 6 | Campagne email entreprises indexees via Newsletter | Cold marketing aux ~1583 entites AYA-BOT incompatible avec CGU Infomaniak Newsletter (opt-in obligatoire). Endpoint et template supprimes. | 28 avril 2026 |
| 11 | Re-scoring batch V2 | Scores bot 20-50 sont corrects et intentionnels, plafond 50 = moteur conversion AYO PRO | 7 avril 2026 |
| 21 | Email template `buildAyaIndexedAnnouncementEmail` | SUPPRIME suite à abandon cold marketing | 28 avril 2026 |
| 23 | Push Supabase Vague 1 batch 1 | Supabase intouchable (sanctuaire). Toutes les nouvelles entites scrapees vont sur Postgres VPS. | 28 avril 2026 |
| 27 | API endpoint `/api/admin/campaign-aya-indexed` | Endpoint supprime car incompatible avec CGU Infomaniak. `lib/infomaniak-newsletter.ts` conserve pour usage opt-in futur. | 28 avril 2026 |
