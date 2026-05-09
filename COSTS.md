# AI VISIONARY — COSTS.md

> Analyse des couts et regles anti-depassement.
> Extraite de CLAUDE.md le 1er mai 2026 pour désengorger le contexte.
> CLAUDE.md référence ce fichier en section 8.

---

> **REGLE ABSOLUE : avant TOUT batch ou operation en volume, TOUJOURS estimer le cout et obtenir l'accord de Cyril.**

## Budget mensuel

| Service | Plan | Budget/mois | Limites |
|---------|------|-------------|---------|
| **Google Cloud (Gemini API)** | Pay-as-you-go | CHF 20.00 | Budget alert a 100% |
| **Supabase** | Free/Pro (org NeousAxis) | Quota plan | Depasse = bloque ou surcharge |
| **Vercel** | Pro | Inclus | maxDuration=120s par fonction |
| **Resend** | Free tier | 0 | 100 emails/jour, 3000/mois (deja remplace par SMTP Infomaniak via nodemailer pour transactionnel) |
| **Infomaniak Public Cloud** | Partenariat gratuit 2 ans | 0 | VPS 4C/8G/160GB + Swiss Backup 200GB + kSuite 3 users + Newsletter 50k/mois |
| **Stripe** | Mode LIVE | Commission standard (~2.9% + 0.30 CHF) | Production depuis 11 avril 2026 |

## Cout par operation Gemini

| Operation | Appels Gemini | Cout estime |
|-----------|---------------|-------------|
| 1 diagnostic V2 (micro-agents) | ~13 appels | ~$0.005 |
| 1 enrichissement Gemini (descriptions+keywords) | 1 appel | ~$0.001 |
| Bot AYA scraping (1000 entites) | 1000 appels | ~$0.50 |

## Historique des incidents couts

| Date | Incident | Cause | Impact |
|------|----------|-------|--------|
| 6-7 avril 2026 | Budget Google 100% atteint (CHF 20) | Rescoring batch V2 : ~500 entites × 13 appels = ~6500 appels Gemini inutiles | 100% du budget mensuel consomme en 7 jours |
| 7 avril 2026 | Quota Supabase depasse | Rescoring batch V2 : milliers de lectures/ecritures + 4 sessions paralleles | Supabase accorde une exception one-time, grace period jusqu'au **7 mai 2026** (apres : HTTP 402 sur requetes si toujours depasse) |
| 14 avril 2026 | (pas un incident) Correction estimation couts Gemini | Estimations initiales du batch Tranco 156k trop elevees (CHF 140 annonces, reel ~CHF 2.20 avec batching BATCH_SIZE=20 dans `enrich_with_gemini.py`) | Facteur 60x d'erreur — couts scraping negligeables en realite, seul le temps de scraping est contraignant |
| 1-4 mai 2026 | ~73€ brûlés sur projet `gen-lang-client-0314106061` (Gemini API) | `aya/reclassify_and_enrich_vps.py` tournait sur le VPS avec `gemini-3-flash-preview` (preview ~10-20× plus cher que `gemini-2.0-flash`) + BATCH_SIZE=5 + 4 scripts séparés au lieu d'1 unifié | Projet temporairement suspendu par Google ("potential account hijacking"). Case Cloud Support 70874317 ouvert pour goodwill credit. Script refactorisé le 9 mai (modèle → 2.0-flash, batch → 20, 4 outputs/prompt unique, estimation ~$1 pour terminer les 25 860 entités). |
| 9 mai 2026 | Projet Better-ESG (`gen-lang-client-0091131679`) SUSPENDU par Trust & Safety pour "ressources piratées" | Clé Gemini `[REDACTED-Gemini-key-was-here]` exposée dans repo GitHub public depuis 12 déc 2025 (commit `693beb99`, "retirée" 13 min après mais visible dans git log pendant ~5 mois) → bots GitHub l'ont exploitée | Cleanup git history via `git-filter-repo` + force-push 4 branches + hook gitleaks installé (`.githooks/pre-commit` versionné). Appel Trust & Safety envoyé par Cyril avec preuve fuite GitHub. |

## Regles anti-depassement

1. **JAMAIS de batch > 100 entites** sans estimation de cout prealable ET accord de Cyril
2. **JAMAIS de sessions paralleles** sur Supabase sans verifier le quota
3. **Budget Google = CHF 20/mois** — chaque appel Gemini compte
4. **Le bot AYA (scraping)** utilise aussi Gemini → compter dans le budget mensuel
5. **Rescoring batch V2 = INTERDIT** — les scores bot 20-50 sont corrects
6. **JAMAIS utiliser un modele Gemini en `-preview`** sans accord explicite de Cyril (les preview models sont 10-20× plus chers que les stable). Defaut : `gemini-2.0-flash`.
7. **JAMAIS hardcoder une clé API** dans un fichier qui finira sur GitHub (incident 12 déc 2025 → 9 mai 2026). Hook `gitleaks` actif depuis 9 mai 2026 dans `.githooks/pre-commit`. Toujours utiliser `.env.local` (gitignored).
8. **Toujours setup budget alerts Google Cloud** (50% / 80% / 100%) sur tout nouveau projet GCP avant de l'utiliser.
