# AI VISIONARY — Claude Code Project Guide

> Ce fichier est lu automatiquement par Claude Code. Il contient le contexte essentiel et le plan d'action.
> Pour l'historique complet des sessions et changelogs, voir `MEMORY.md`.
> Pour le plan de remediation original (10 sprints, tous termines), voir `PLAN-ACTION-AYO-COMPLET.md`.
> Derniere mise a jour : 3 avril 2026

---

## 1. CONTEXTE PROJET

**AI Visionary** — Startup basee a Geneve, Suisse, fondee par Cyril Leger.

| Terme | Definition |
|-------|-----------|
| **AYO** | Chatbot IA qui diagnostique la lisibilite IA d'un site web. Utilise Google Gemini. |
| **AIO Score** | Score 0-100, deterministe, base sur 7 blocs ponderes (la "Bible AIO"). |
| **AYA** | Registre public d'entites indexees/certifiees (Supabase `aya_registry`). ~4400+ entites. |
| **ASR** | AI Singular Record — fichier JSON-LD signe Ed25519, identite numerique de l'entite. |
| **Hard cap** | Pas de JSON-LD + pas d'AYA = score max 50. Pas d'ASR = max 90. Score max 78 sans preuves externes. |
| **q values** | Qualite de chaque donnee extraite : 0 (absent), 0.5 (vague), 1 (concret/verifie). |

### Business model

1. **Analyse Light** (gratuit) — Diagnostic AIO + score (pas de fichier livre)
2. **Abonnement AYA** (19 CHF/mois) — Registre AYA + ASR heberge + MAJ
3. **Pack PRO** (499 CHF one-shot) — 5 fichiers ASR complets + 3 ans de Registre AYA offerts

### Les 7 blocs AIO

| Bloc | Poids | Champs principaux |
|------|-------|-------------------|
| 1. Identite & Ancrage | /10 | name, legal_name, business_type, city, country, contact |
| 2. Clarte de l'Offre | /20 | services, products, use_cases, target_audience, pricing |
| 3. Processus & Methodes | /15 | process_steps, delivery_mode, geographies, quality_assurance |
| 4. Confiance & Conformite | /15 | certifications, policies, frameworks, security_measures |
| 5. Indicateurs | /20 | key_indicators (chiffres), last_review_date |
| 6. Pedagogie | /10 | has_faq, has_glossary, has_documentation |
| 7. Socle Technique | /10 | has_jsonld, has_asr, has_sitemap, mobile_optimized |

### Doctrine AYO (regle produit canonique)

> **AYO scanne, confirme, classe, normalise, structure. AYO n'invente rien.**

AYO est un moteur de structuration, un classificateur semantique, un generateur de fichiers lisibles par les IA. AYO n'est PAS un reecrivain de site, un conseiller marketing, ni un optimiseur SEO.

**Pipeline correct :**
1. **Scan** — relever ce qui existe deja (identite, offre, processus, conformite, contenus, technique)
2. **Questionnaire** — completer UNIQUEMENT les zones ambigues/manquantes (confirmation, precision — jamais invention)
3. **Fusion** — construire une verite structuree unique (scan_detected + questionnaire_confirmed), priorite a la coherence
4. **Production** — 5 fichiers qui representent correctement ce qui a ete trouve et confirme

**Critere qualite :** BON = structure mieux l'information existante sans changer son sens. MAUVAIS = ajoute une idee absente, transforme un slogan en fait, melange les blocs, cree une incoherence scan/questionnaire.

### Flux principal (V4 — actif en prod)

```
URL -> Scanner (aio-scanner.ts) -> Score initial (aio-score-engine.ts)
    -> Classification site (site-classifier.ts) -> SiteType
    -> Questions ciblees V4 (question-engine.ts) -> seulement ce qui manque
    -> LLM extrait JSON (q values) -> evaluateEvidence() -> reliability capping
    -> downgradeFieldQuality() -> anti-marketing + GDPR principles filter
    -> Score enrichi -> Delta avant/apres -> Email capture -> Stripe Checkout
    -> Webhook -> Genere fichiers (sanitization complete) -> Email
```

### Les 5 fichiers du Pack PRO

| Fichier | Generateur |
|---------|-----------|
| `ASR-Protocol.json` | `ayo-crypto.ts:generateRealAsrJson()` |
| `manifest.json` | `ayo-generators.ts:generateManifestJson()` |
| `faq.json` | `ayo-generators.ts:generateFaqJson()` |
| `glossary.json` | `ayo-generators.ts:generateGlossaryJson()` |
| `external_context.json` | `ayo-generators.ts:generateExternalContextJsonLocal()` |

---

## 2. STACK TECHNIQUE

| Technologie | Version | Usage |
|-------------|---------|-------|
| Next.js | 16.0.10 | Framework fullstack (App Router) |
| React | 19.2.1 | Frontend |
| TypeScript | ^5 | Typage |
| Tailwind CSS | ^4 | Styles (+ inline styles legacy) |
| Supabase | @supabase/supabase-js | Base de donnees PostgreSQL |
| Stripe | ^20.3.1 | Paiements (checkout + subscriptions) |
| Resend | ^6.6.0 | Emails transactionnels |
| Vercel | — | Hosting + serverless + cron |
| Google Gemini | via @ai-sdk/google | LLM pour AYO + generation semantique |
| next-intl | — | i18n FR/EN (cookie NEXT_LOCALE) |
| TweetNaCl | ^1.0.3 | Signature Ed25519 pour ASR |
| Zod | ^4.1.13 | Validation schemas |
| JSZip | ^3.10.1 | Generation ZIP pour Pack PRO |

### Hebergement

- **Frontend + API** : Vercel (serverless, maxDuration=120s)
- **Base de donnees** : Supabase PostgreSQL
- **Emails** : Resend (hello@ai-visionary.com)
- **Paiements** : Stripe (mode test — ne jamais passer en prod sans accord Cyril)
- **Domaine** : ai-visionary.com

### Variables d'environnement requises

```
SUPABASE_URL=https://hxoywzhrvacdmtopureh.supabase.co
SUPABASE_SERVICE_ROLE_KEY
STRIPE_SECRET_KEY
STRIPE_WEBHOOK_SECRET
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
STRIPE_PRICE_AYA=price_1SzazaPkCQYUm8hQJfrKc9EJ
STRIPE_PRICE_PRO=price_1SlM9iPkCQYUm8hQKqOV8eqU
GOOGLE_GENERATIVE_AI_API_KEY
RESEND_API_KEY
ADMIN_SECRET
SESSION_SECRET
AYO_SIGNING_KEY
NEXT_PUBLIC_BASE_URL=https://ai-visionary.com
```

### Base de donnees Supabase

| Table | Usage |
|-------|-------|
| `analyses` | Resultats de diagnostic AYO (scores, donnees extraites, email, URL) |
| `aya_registry` | Entites AYA actives (certifiees + indexees bot) |
| `scan_states` | Etats intermediaires du scan |
| `system_logs` | Logs systeme |
| `otp_codes` | Codes OTP temporaires |
| `sessions` | Sessions utilisateur |

---

## 3. BRANCHES GIT

| Branche | Statut | Contenu |
|---------|--------|---------|
| `main` | Production | Bilingue FR/EN + V4 Evidence-Based actif (flag ON) |
| `fix/remediation` | Archivee | Sprints 1-10 (tous termines, merges dans main) |
| `fix/i18n-bilingual` | ARCHIVEE | Tentative i18n echouee du 28 mars, NE PAS UTILISER |

**Branches mergees dans main (31 mars - 3 avril 2026) :** `feature/i18n-en-fr`, `fix/otp-eclore-protection`, `feature/chat-bilingual`, `feature/ayo-v4-evidence-based`

**Workflow** : TOUJOURS travailler sur une branche feature/fix. Ne JAMAIS merger dans `main` sans validation de Cyril.

---

## 4. CONVENTIONS & REGLES

> **TOUTES les regles sont dans `regles.md`** — ce fichier est lu automatiquement par Claude Code.
> Inclut : workflow obligatoire, interdictions, securite, langue, git, style, tests.
> Regle critique : **Plan > Sous-agents > Orchestrateur > Verification INTEGRALE**

---

## 5. PLAN D'ACTION ACTUEL

### Priorite IMMEDIATE

1. **Stabiliser la qualite des fichiers PRO** — anti-marketing, classification correcte, normalisation pays/langue
2. **Croissance registre** : objectif 10k+ entites
3. **Campagne email entreprises indexees**

---

### AYO V4 Evidence-Based — ACTIF EN PRODUCTION

> Flag `AYO_V4_EVIDENCE=true` actif en prod depuis le 3 avril 2026.
> Merge dans `main`, plus de branche separee.

#### Data Reliability Layer (3 niveaux de verite)

| Niveau | Tag | Exemples | q max | Impact |
|--------|-----|----------|-------|--------|
| **Verifiable** | `verified` | Certifications, Privacy Policy, FAQ, glossaire | q=1 si URL | Fort |
| **Declaratif structure** | `self_declared` | KPIs, clients, uptime, process interne | q=0.5 max | Limite |
| **Interpretatif** | `interpretive` | "leader", "innovant", "best", "premium" | q=0 | Ignore |

#### Modules V4 en production

| Module | Fichier | Role |
|--------|---------|------|
| Site Classifier | `lib/site-classifier.ts` | 7 types de sites, deterministe |
| Question Engine | `lib/question-engine.ts` | 24 templates, reliability levels, 4-5 questions max |
| Evidence Types | `lib/evidence-types.ts` | Types partages (ReliabilityLevel, EvidenceAnswer) |
| Anti-marketing | `lib/agents/controle-qualite.ts` | INTERPRETIVE_CLAIMS_RE + downgradeFieldQuality |
| Compliance reclassifier | `lib/ayo-generators.ts` | reclassifyCompliance() + cleanOutputArray() |
| ASR Reliability Meta | `lib/ayo-crypto.ts` | data_reliability dans meta + GDPR principles filter |
| Score Engine Caps | `lib/aio-score-engine.ts` | Per-block caps respectent na:true, structured_absence, URL evidence |

#### Sanitization layers (ordre d'execution)

**En amont (chat/route.ts, controle-qualite.ts) :**
1. `sanitizeLlmFields()` — nettoie les question texts, copyright, hallucinations LLM
2. `downgradeFieldQuality()` — cap q-values (reliability), detecte interpretive claims (questionnaire only, PAS scan), structured absence
3. `INTERPRETIVE_CLAIMS_RE` — ne s'applique QU'aux reponses du questionnaire (evidence includes 'questionnaire_answer'), PAS aux donnees du scan (donnees factuelles)

**En aval (5 generateurs, via fonctions partagees) :**
4. `sanitizeComplianceOutput()` — fonction PARTAGEE utilisee par les 5 generateurs. Inclut :
   - `reclassifyCompliance()` — GDPR→framework, "Legal" supprime, URL→label AVANT filtrage
   - GDPR principles filter — "Privacy by Design", "GDPR compliance" sortis de security_measures
   - `splitLongSecurityEntries()` + `truncateSecurity()`
   - `cleanOutputArray()` — "And" prefix, trailing periods, capitalisation
5. Anti-marketing filters — "premium", "zero-latency", "ecosystem", etc. (ASR + ExternalContext + FAQ)
6. Country normalization — `normalizeCountryEN`/`normalizeCountryENec` dans TOUS les generateurs
7. City normalization — NOT_A_CITY filter dans TOUS les generateurs (Swiss, Suisse, "Swiss based" = pas une ville)
8. Frontend label stripping — les labels des champs V4 (`customLabel`) sont strippes des reponses avant evaluation
9. Deterministic online detection — si services contiennent website/app/software/saas/digital/agentic/cloud/api → isOnlineDelivery=true (independant du LLM)

#### Matrice de coherence des 5 generateurs (COMPLETE)

| Check | ASR | Manifest | FAQ | Glossary | EC |
|-------|-----|----------|-----|----------|----|
| sanitizeComplianceOutput | ✅ | ✅ | ✅ | ✅ | ✅ |
| City NOT_A_CITY | ✅ | ✅ | ✅ | ✅ | ✅ |
| Country normalize | ✅ | ✅ | ✅ | ✅ | ✅ |
| Geography Global | ✅ | — | ✅ | — | ✅ |
| cleanOutputArray | ✅ | ✅ | ✅ | ✅ | ✅ |
| Anti-marketing | ✅ | ✅ | ✅ | ✅ | ✅ |

#### Classification semantique correcte

| Type | Contenu | Exemples |
|------|---------|----------|
| **certification** | Label qualite delivre par un tiers | ISO 27001, B Corp, SOC 2 |
| **framework** | Regulation ou cadre de conformite | GDPR, HIPAA, PCI-DSS |
| **policy** | Document publie par l'entreprise | Terms & Conditions, Privacy Policy |
| **security_measure** | Technique de securite deployee | TLS 1.3, AES-256, MFA |
| **NOT security** | Principes reglementaires | Privacy by Design, Right to Erasure |
| **NOT certification** | GDPR (c'est un framework) | |
| **NOT framework** | "Legal" seul (meaningless) | |

---

### Croissance — Objectif 10k+ entites

#### Bot AYA (scraping automatise)

```
domains.txt -> scraper.py -> parser.py -> generator.py -> push_to_aya.py -> Supabase
```

| Tache | Priorite |
|-------|----------|
| Enrichir `domains.txt` — annuaires CH, FR, DE, UK, US, Asie | Critique |
| Scraper par lots — `run_pipeline_fast.py` | Critique |
| Push vers Supabase — `push_to_aya.py --min-score 20` | Critique |
| Enrichissement registres du commerce (Zefix CH, Sirene FR, Companies House UK) — meme chantier que le bot | Critique |
| Fix noms/secteurs incorrects | Haute |
| Reduire les "XX" (entites .com sans pays detecte) | Haute |

#### Distribution — Strategie ATTRACTION SYSTEMIQUE

AYA n'est PAS une destination. Les donnees sont sur 4 sources convergentes :
- **API LLM-friendly** `ai-visionary.com/api/aya/llm/{domain}` (cache CDN 1h)
- **Pages HTML** sur chaque certificat `/aya/e/[id]` (crawlable)
- **GitHub dataset** — `github.com/NeousAxis/aya-business-dataset` (JSON individuels)
- **HuggingFace dataset** — CSV + JSONL, CC-BY-4.0

| Tache | Priorite |
|-------|----------|
| Campagne email entreprises indexees | Haute |
| Re-exporter GitHub + HuggingFace apres chaque batch | Continue |
| Soumission There's An AI For That (Cyril) | Moyenne |
| Monitoring — tracker appels API par source | Moyenne |

---

## 6. CE QUI EST FAIT ET FONCTIONNE

- Site bilingue FR/EN : toggle header, `next-intl` + cookie `NEXT_LOCALE`, toutes pages + chatbot + emails + formulaires + API
- Flux complet AYO V4 : URL -> scan -> classification site -> questions ciblees -> score strict -> paiement Stripe -> fichiers -> email (bilingue)
- V4 Evidence-Based actif en prod : site-classifier, question-engine, data reliability layer, anti-marketing, GDPR reclassification
- Sanitization complete des fichiers PRO via `sanitizeComplianceOutput()` partagee : anti-marketing, URL→label, country normalization, "And" prefix, trailing periods, GDPR principles filter, deterministic online detection
- Frontend label stripping : les `customLabel` des champs V4 sont automatiquement strippes des reponses utilisateur
- Stepper/barre de progression bilingue FR/EN (triggers mis a jour)
- Stripe Checkout live (CHF, 2 offres : AYA 19 CHF/mois, PRO 499 CHF)
- Registre AYA public : ~4400+ entites, pagination serveur, badges certifie/indexe, recherche, tri
- API AYA : 7 endpoints (index, llm, docs, search, entity, stats, live) + `?lang=fr|en`
- Bot AYA : 6766 domaines pipeline, enrichissement Gemini 100% (descriptions EN+FR, keywords EN+FR)
- Generation et envoi des 5 fichiers PRO en ZIP (emails bilingues)
- Signature Ed25519 des ASR (cle rotee, env var)
- Supabase PostgreSQL (migration depuis Firestore terminee)
- Per-block scoring caps respectent V4 signals (na:true, structured_absence, URL evidence)
- 10 sprints de remediation securite termines
- OTP email (owner_email only), admin dashboard, logger, rate-limit, validators
- Lifecycle : formulaire MAJ 7 blocs + OTP gate + renouvellement + protection downgrade PRO->AYA
- SEO metadata toutes pages + sitemap dynamique Supabase + confidentialite LPD/RGPD + mentions legales
- Translation agents Python : descriptions certifiees, dictionnaire 16558 termes, keywords FR 100%
- Page `/developers` : stats dynamiques, docs GitHub/HuggingFace
- Exports : GitHub (4435 fichiers) + HuggingFace (4436 entites)

---

## 7. CE QUI RESTE A FAIRE

| # | Tache | Priorite | Statut |
|---|-------|----------|--------|
| 1 | ~~Merger branches en attente dans `main`~~ | ~~Immediat~~ | Fait (31 mars 2026) |
| 2 | ~~Coherence linguistique fichiers PRO (EN par defaut)~~ | ~~Immediat~~ | Fait (31 mars 2026) |
| 3 | ~~AYO V4 Evidence-Based~~ | ~~Haute~~ | Fait — actif en prod, flag ON (3 avril 2026) |
| 4 | ~~Stabiliser qualite fichiers PRO (anti-marketing, classification, normalisation)~~ | ~~Critique~~ | Fait — solidifie (3 avril 2026). sanitizeComplianceOutput() partagee, score stable 82/100 |
| 5 | Scraping 10k+ entites + registres du commerce | Critique | En cours (~4400) |
| 6 | Campagne email entreprises indexees | Haute | A faire |
| 7 | Re-exporter GitHub/HuggingFace apres chaque batch | Continue | Automatise |
| 8 | Soumission There's An AI For That | Moyenne | Cyril |
| 9 | Reduire dependance LLM — scanner regex 80%+ des donnees, LLM pour 20% ambigus | Future | Identifie |
| 10 | Monitoring API — tracker appels AYA par source | Moyenne | A faire |

---

## 8. COMMANDES UTILES

```bash
# Developpement
npm run dev          # Serveur local Next.js
npm run build        # Build de production
npm run lint         # Linting ESLint

# Deploiement
vercel --prod        # Deploy sur Vercel (prod)
vercel               # Deploy preview

# Bot AYA (scraping)
cd aya
python run_pipeline_fast.py              # Concurrent (12 min pour 1108 domaines)
python push_to_aya.py --dry-run          # Preview push
python push_to_aya.py --min-score 20     # Push reel
python export_github_dataset.py          # Export GitHub dataset

# API AYA locale (dev/test)
cd aya && uvicorn api.main:app --reload  # http://127.0.0.1:8000
```

### API AYA Publique

**Base URL** : `https://ai-visionary.com/api/aya`

| Route | Description |
|-------|-------------|
| `/api/aya` | Index JSON des endpoints |
| `/api/aya/llm/{domain}` | LLM-optimise — 5 champs (cache CDN 1h) |
| `/api/aya/search?q={query}` | Recherche (max 200 resultats) |
| `/api/aya/entity/{domain}` | Detail entite + ASR_DERIVED |
| `/api/aya/stats` | Statistiques globales |
| `/api/aya/live` | Toutes les entites |
| `/api/aya/docs` | Documentation HTML |

### Fichiers critiques a lire en priorite

1. `app/api/chat/route.ts` — Coeur du chatbot + pipeline V4 (~2800 lignes)
2. `lib/aio-score-engine.ts` — Moteur de scoring (per-block caps V4)
3. `lib/ayo-crypto.ts` — Generateur ASR + sanitization + signature Ed25519
4. `lib/ayo-generators.ts` — Generateurs FAQ/glossary/manifest/external_context + reclassifyCompliance + cleanOutputArray
5. `lib/agents/controle-qualite.ts` — Anti-marketing + downgradeFieldQuality + INTERPRETIVE_CLAIMS_RE
6. `lib/question-engine.ts` — V4 question templates + evaluateEvidence
7. `lib/site-classifier.ts` — Classification deterministe (7 types)
8. `app/api/webhooks/checkout-success/route.ts` — Webhook Stripe + PRO score lift

---

## 9. REFERENCE

- **Historique complet** des sessions, changelogs, bugs corriges : voir `MEMORY.md`
- **Plan de remediation original** (10 sprints) : voir `PLAN-ACTION-AYO-COMPLET.md`
- **Bible AIO** (7 blocs, ponderations) : voir `AYO_BIBLE.md`
- **GitHub repo public** : https://github.com/NeousAxis/ai-visionary
- **HuggingFace dataset** : https://huggingface.co/datasets/NeousAxis/aya-business-dataset

### Hierarchie des marques

- **AI Visionary** = la startup (marque mere)
- **AYO** = l'agent IA qui diagnostique les sites + cree les fichiers ASR
- **AYA** = le registre public + bot automatise d'indexation
- **AIO** = le score de lisibilite IA (0-100)
- **ASR** = les fichiers d'identite numerique (JSON-LD signes Ed25519)
