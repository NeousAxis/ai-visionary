# AI VISIONARY — TODO.md

> Liste des taches restantes (et leur statut a jour).
> Extraite de CLAUDE.md le 1er mai 2026 pour désengorger le contexte.
> CLAUDE.md référence ce fichier en section 7.

---

## Tâches actives (à faire)

| # | Tache | Priorite | Statut |
|---|-------|----------|--------|
| 5 | Scraping 100k entites + registres du commerce | Critique | En cours — Vague 1 Tranco EU : batches 1-5 scrape (+39 478 JSONs cumules au 25 avril, total data/ ~46 000 incl. 6682 initial), ~11 batches de 10k restants dans `domains_growth_tranco.txt` |
| 8 | Soumission There's An AI For That | Moyenne | Cyril |
| 24 | Vague 1 batches 6→16 (~110 000 domaines Tranco restants) | Critique | Batches 1-5 faits (55 676 JSONs scrapes au 25 avril, 25 860 pushes Postgres VPS au 28 avril). ~11 batches de 10k restants. Cible push : Postgres VPS uniquement. |
| 25 | Patcher `aya/fetch_sirene.py` rate limit (HTTP 429) | Moyenne | REQUEST_DELAY 0.4s → 1.5s + retry exponentiel + MAX_PAGES_PER_CODE 8 → 4 |
| 26 | Trouver alternative Zefix CH (401 auth sur `/search`) | Moyenne | Candidate : opendata.swiss, Swiss Startup Map, OpenCorporates. Tranco a deja 3277 .ch, pas urgent |
| 28 | thepiratebay.se + politique warez | Moyenne | EN ATTENTE — Cyril a reporte la decision (14 avril). Pas dans blocklist pour l'instant |
| MV | **Migration Vercel → VPS Infomaniak (100% suisse)** | Critique | En cours. 13 etapes documentees dans `MIGRATION.md`. ~6-7h de travail. Cyril decide du planning. |
| 30 | Configurer Newsletter Infomaniak (50k credits/mois) | Haute | En attente des codes. Adapter template email ou utiliser API Newsletter Infomaniak |
| 31 | Setup kSuite Business 3 users @ai-visionary.com | Moyenne | En attente des codes. 3 boites email pro |
| 36 | Deblocage compte Newsletter Infomaniak | Critique | Reponse Infomaniak recue (28 avril) avec 4 questions. Reponse honnete envoyee. Newsletter ne sera utilisee qu'avec une vraie base opt-in. En attente confirmation Infomaniak. |
| 37 | **Pipeline LinkedIn marketing — finir publication auto** (branche `feature/linkedin-marketing`) | Critique | Pipeline complet en place : generation drafts + verif Gemini/ChatGPT + admin avec login persistent + queue approuvee + 2 crons (gen+publish) + table Postgres VPS. **Bloqueur** : LinkedIn anti-bot rejette les sessions Playwright (toast "Sorry something went wrong" + invalidation auto). Decision Cyril : (a) bouton "Copier le texte" + paste manuel (5 min code, 100% fiable), (b) xvfb sur VPS + login depuis IP VPS (30 min setup), (c) Company Page → API officielle (semaines). Voir STATE.md pour details. |
| 38 | **Débloquer projet GCP `gen-lang-client-0314106061`** (Generative Language API) | Critique | Suspendu par Google le 9 mai 2026 ("potential account hijacking" déclenché par surconso ~73€ entre 1-4 mai sur `gemini-3-flash-preview` via Claude Code mal configuré). Case Cloud Support 70874317 ouvert avec demande goodwill credit. En attente réponse Internal Team Google. **Tant que ce projet est suspendu, impossible de relancer le batch d'enrichissement VPS** (les ~22 000 entités sans description+keywords Gemini restent en l'état). |
| 39 | **Débloquer projet GCP Better-ESG (`gen-lang-client-0091131679`)** | Haute | Suspendu par Trust & Safety le 7 mai 2026 ("ressources piratées" suite à fuite clé GitHub publique 12 déc 2025 → 7 mai 2026). Appel envoyé par Cyril avec preuve historique Git + mesures correctives (cleanup git history `git-filter-repo` + force-push 4 branches + hook gitleaks installé). En attente réponse. Si pas réactivé : créer un nouveau projet GCP propre avec billing actif + budget alerts. |
| 40 | **Rebaser branches locales `claude/festive-satoshi-169a07` + `claude/heuristic-ellis-da6d78`** sur nouveau main | Basse | Ces 2 branches contiennent encore la clé `AIzaSy...` dans leur historique (avant le force-push du 9 mai). Pas un risque public (jamais pushed), mais à nettoyer pour éliminer définitivement la clé du repo local. Procédure : `git rebase --onto origin/main <ancienne-base> <branche>` puis `git gc --prune=now`. |

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

---

## Tâches abandonnées

| # | Tache | Raison | Date |
|---|-------|--------|------|
| 6 | Campagne email entreprises indexees via Newsletter | Cold marketing aux ~1583 entites AYA-BOT incompatible avec CGU Infomaniak Newsletter (opt-in obligatoire). Endpoint et template supprimes. | 28 avril 2026 |
| 11 | Re-scoring batch V2 | Scores bot 20-50 sont corrects et intentionnels, plafond 50 = moteur conversion AYO PRO | 7 avril 2026 |
| 21 | Email template `buildAyaIndexedAnnouncementEmail` | SUPPRIME suite à abandon cold marketing | 28 avril 2026 |
| 23 | Push Supabase Vague 1 batch 1 | Supabase intouchable (sanctuaire). Toutes les nouvelles entites scrapees vont sur Postgres VPS. | 28 avril 2026 |
| 27 | API endpoint `/api/admin/campaign-aya-indexed` | Endpoint supprime car incompatible avec CGU Infomaniak. `lib/infomaniak-newsletter.ts` conserve pour usage opt-in futur. | 28 avril 2026 |
