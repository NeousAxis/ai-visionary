# AI VISIONARY — Claude Code Project Guide

> Ce fichier est lu automatiquement par Claude Code. Il contient le contexte essentiel et le plan d'action.
> Pour l'historique complet des sessions et changelogs, voir `MEMORY.md`.
> Pour le plan de remediation original (10 sprints, tous termines), voir `PLAN-ACTION-AYO-COMPLET.md`.
> Derniere mise a jour : 8 avril 2026

---

## 1. CONTEXTE PROJET

**AI Visionary** — Startup basee a Geneve, Suisse, fondee par Cyril Leger.

| Terme | Definition |
|-------|-----------|
| **AYO** | Agent IA qui diagnostique la lisibilite IA d'un site web. V1=chatbot Gemini (page /diagnostic). V2=micro-agents LLM cibles Gemini 3 Flash (page /diagnostic-v2, branche feature/micro-agents-diagnostic). |
| **AIO Score** | Score 0-100, deterministe, base sur 7 blocs ponderes (la "Bible AIO"). |
| **AYA** | Registre public d'entites indexees/certifiees (Supabase `aya_registry`). ~4400+ entites, objectif 100k. |
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
- **Emails** : Infomaniak SMTP (nodemailer). Adresses : hello@ + security@ (alias). TODO: ajouter alias delivery@ et registry@ quand Infomaniak partenariat actif.
- **Paiements** : Stripe (mode LIVE depuis 11 avril 2026)
- **Domaine** : ai-visionary.xyz (primaire, depuis 8 avril 2026). ai-visionary.com redirige vers .xyz (301).

### Variables d'environnement requises

```
SUPABASE_URL=https://hxoywzhrvacdmtopureh.supabase.co
SUPABASE_SERVICE_ROLE_KEY
STRIPE_SECRET_KEY
STRIPE_WEBHOOK_SECRET
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
STRIPE_PRICE_AYA=price_1TBDj5BaWEIL7y9ztiytROFa
STRIPE_PRICE_PRO=price_1TBDj3BaWEIL7y9zfQvGqVJi
GOOGLE_GENERATIVE_AI_API_KEY
SMTP_HOST=mail.infomaniak.com
SMTP_USER=hello@ai-visionary.xyz
SMTP_PASSWORD
ADMIN_SECRET
SESSION_SECRET
AYO_SIGNING_KEY
NEXT_PUBLIC_BASE_URL=https://ai-visionary.xyz
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
| `feature/micro-agents-diagnostic` | Experimentale | Diagnostic V2 micro-agents + one-page live. JETABLE si echec. |

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

1. **Croissance registre** : objectif 100k entites (scores bot 20-50 = corrects, plafond 50 = moteur conversion AYO PRO)
2. **Campagne email entreprises indexees**
3. **Stabiliser la qualite des fichiers PRO** — anti-marketing, classification correcte, normalisation pays/langue

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

### Diagnostic V2 — Micro-Agents LLM Cibles (branche `feature/micro-agents-diagnostic`)

> Branche experimentale JETABLE. Si echec, on supprime. `main` reste intacte.
> Page : `/diagnostic-v2` — coexiste avec `/diagnostic` (V1 chatbot Gemini)

#### Principe

Chaque micro-agent = 1 appel LLM (Gemini 3 Flash) avec un prompt ultra-cible de 3-5 lignes.
Tache trop specifique pour halluciner. Schema de sortie JSON valide par parseJson.
Les agents tournent en SEQUENTIEL pour que le client voie chaque agent travailler en live.

#### Les 8 micro-agents

| Agent | Fichier | Methode | Input | Output |
|-------|---------|---------|-------|--------|
| detect-contact | `lib/micro-agents/detect-contact.ts` | **LLM** | Texte site | `{ email, phone, hasContactForm, q }` |
| detect-services | `lib/micro-agents/detect-services.ts` | **LLM** | Texte site | `{ services[], products[], target_audience, use_cases[], pricing, q }` |
| detect-legal | `lib/micro-agents/detect-legal.ts` | **LLM** | Texte site | `{ policies[], frameworks[], certifications[], urls[], q }` |
| detect-location | `lib/micro-agents/detect-location.ts` | **JSON-LD d'abord, puis LLM** | Texte + URL | `{ city, country, q }` |
| detect-security | `lib/micro-agents/detect-security.ts` | **Headers deterministe + LLM** | Texte + headers | `{ measures[], q }` |
| detect-pedagogy | `lib/micro-agents/detect-pedagogy.ts` | **LLM + Jina HTML fallback** | HTML + URL | `{ has_faq, has_glossary, has_documentation, q }` |
| detect-jsonld | `lib/micro-agents/detect-jsonld.ts` | **Deterministe** (parsing JSON) | HTML brut | `{ schemas[], type, name, q }` |
| detect-social | `lib/micro-agents/detect-social.ts` | **Deterministe** (regex URL) | HTML brut | `{ links[], platforms[], q }` |

#### Architecture LLM

| Composant | Fichier | Role |
|-----------|---------|------|
| llm-agent | `lib/micro-agents/llm-agent.ts` | Caller partage : Gemini 3 Flash, temp=0, maxOutputTokens=4000 |
| html-fetcher | `lib/micro-agents/html-fetcher.ts` | Fetch HTML + SPA detection (jina.ai fallback) + Puppeteer |
| orchestrator | `lib/micro-agents/orchestrator.ts` | Sequentiel, merge → AyoExtract, check ASR + AYA registry |
| detect-pedagogy | `lib/micro-agents/detect-pedagogy.ts` | LLM sur liens/headings extraits + fallback Jina HTML pour SPA |

**Prompts bilingues** : tous les prompts supportent FR/EN/DE.
**parseJson robuste** : repare le JSON tronque (ferme les brackets manquants).
**SPA handling** : detecte les shells vides (div#root), fallback vers jina.ai markdown → conversion HTML.
**Contact forms** : un formulaire de contact = methode de contact valide (q=0.5), pas une penalite.

#### Orchestrateur — champs extraits

L'orchestrateur fait aussi un 8eme appel LLM pour process/indicateurs :
- `process_steps` : etapes methodologie
- `delivery_mode` : online / on-site / hybrid
- `geographies_served` : zones geographiques
- `quality_assurance` : suivi qualite
- `key_indicators` : chiffres cles (X ans, X clients, X projets)
- **Retry x3 + Merge** : detect-services, detect-legal et process/indicators sont appeles 3 fois en parallele. Les resultats sont fusionnes (union des arrays, keepLongest des strings). Stabilise le score a +/-1 point.

Checks supplementaires (deterministes) :
- HEAD `/.ayo/asr.json` → `has_asr`
- `db.getAyaEntityByUrl()` → `is_aya_registered`
- Viewport meta, sitemap, FAQ, glossaire, documentation → dans `contenus_pedagogiques` + `structure_technique`

#### Mapping agents → blocs AIO

| Bloc AyoExtract | Agents sources | Champs couverts |
|-----------------|---------------|-----------------|
| identite (10pts) | detect-contact, detect-location, detect-jsonld | name, city, country, email/form, phone |
| offre (20pts) | detect-services | services, products, target_audience, use_cases, pricing |
| processus_methodes (15pts) | orchestrator LLM | process_steps, delivery_mode, geographies, quality_assurance |
| engagements_conformite (15pts) | detect-legal, detect-security | policies, frameworks, certifications, security_measures |
| indicateurs (20pts) | orchestrator LLM | key_indicators |
| contenus_pedagogiques (10pts) | detect-pedagogy + detect-jsonld | has_faq, has_glossary, has_documentation |
| structure_technique (10pts) | detect-jsonld + deterministe | has_asr, has_jsonld, has_sitemap, mobile_optimized |

#### Score PRO projete

La route `/api/diagnostic/scan` calcule aussi un `proScore` :
- Clone l'extract et ajoute ce qu'AYO PRO genere reellement (FAQ, glossary, doc, ASR, JSON-LD)
- Repasse `computeAioScore()` sur l'extract enrichi
- Le delta montre la valeur ajoutee du Pack PRO (typiquement +10 a +18 points)

#### Page Diagnostic V2 — One-Page 8 etapes

| Etape | Description |
|-------|-------------|
| 1 | Champ URL + bouton Analyser |
| 2 | 8 cartes agents live via SSE (spinner + texte scanning + resultats) |
| 3 | Score AIO 7 dimensions (cartes full-width + ring total) |
| 4 | 5 fichiers ASR generes un par un avec barre de progression |
| 5 | Compare vs concurrents AYA (meme sector_macro, certifies d'abord) + score PRO |
| 6 | Choix plan AYA/PRO + email capture |
| 7 | OTP pour clients existants + paiement Stripe |
| 8 | Confirmation + checklist |

#### API Diagnostic V2

| Route | Methode | Description |
|-------|---------|-------------|
| `/api/diagnostic/scan` | POST | SSE — lance micro-agents sequentiels, stream resultats + score + proScore |
| `/api/diagnostic/score` | POST | Calcule AIO score depuis extract |
| `/api/diagnostic/compare` | POST | Cherche concurrents dans AYA par sector_macro |

#### Structure fichiers V2

```
lib/micro-agents/
  types.ts, llm-agent.ts, html-fetcher.ts, orchestrator.ts
  detect-contact.ts, detect-services.ts, detect-legal.ts
  detect-location.ts, detect-security.ts, detect-pedagogy.ts, detect-jsonld.ts, detect-social.ts

app/diagnostic-v2/
  page.tsx, layout.tsx

app/api/diagnostic/
  scan/route.ts, score/route.ts, compare/route.ts
```

---

### Croissance — Objectif 100k entites

#### Strategie scoring bot

Les entites indexees par le bot ont un score entre 20 et 50 (variable selon les donnees trouvees, PAS 50 pour tout le monde). Ce score reflete la realite : quasiment aucune entreprise n'a ses donnees correctement structurees. Le plafond naturel a 50 est le moteur de conversion : pour monter au-dessus de 50 → passer par AYO PRO. Le rescoring V2 des entites bot est NON PERTINENT — les scores bot sont corrects et intentionnels.

#### Bot AYA (scraping automatise)

```
domains.txt -> scraper.py -> parser.py -> generator.py -> push_to_aya.py -> Supabase
```

| Tache | Priorite |
|-------|----------|
| Enrichir `domains.txt` — annuaires CH, FR, DE, UK, US, Asie (objectif 100k) | Critique |
| Scraper par lots — `run_pipeline_fast.py` | Critique |
| Push vers Supabase — `push_to_aya.py --min-score 20` | Critique |
| Enrichissement registres du commerce (Zefix CH, Sirene FR, Companies House UK) — meme chantier que le bot | Critique |
| Fix noms/secteurs incorrects | Haute |
| Reduire les "XX" (entites .com sans pays detecte) | Haute |

#### Distribution — Strategie ATTRACTION SYSTEMIQUE

AYA n'est PAS une destination. Les donnees sont sur 4 sources convergentes :
- **API LLM-friendly** `ai-visionary.xyz/api/aya/llm/{domain}` (cache CDN 1h)
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
- Stripe Checkout LIVE en production (CHF, 2 offres : AYA 19 CHF/mois, PRO 499 CHF). Basculé mode live le 11 avril 2026. Webhook configuré sur ai-visionary.xyz.
- Section GEO vs ASR sur la homepage — explication bilingue FR/EN de la différence entre GEO et ASR, colonnes distinctes (orange GEO / teal ASR) sur fond gris clair
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
- Exports : GitHub (4372 fichiers) + HuggingFace (4437 entites) — re-exportes 7 avril 2026
- Diagnostic V2 micro-agents : page `/diagnostic-v2` avec 7 agents LLM cibles (Gemini 3 Flash), 8 etapes live, scoring 7 dimensions, compare concurrents AYA, score PRO projete. Branche `feature/micro-agents-diagnostic`.
- Diagnostic V2 : 8 micro-agents (dont detect-pedagogy LLM pour FAQ/glossary/docs), retry x3 pour stabilite score, OTP clients existants, email capture, Stripe TEST connecte
- Score V2 stable : whtg1.com 81/100 (±1 point entre scans)
- Public Key ID visible dans cartes AYA registry (label i18n FR/EN) + champ `public_key_id` dans LlmSummary API + GitHub export
- Admin enrichment API : `/api/admin/enrich` — re-enrichir une entite ou batch (certifiees sans description Gemini)
- Webhook Stripe : retry x2 pour enrichissement Gemini si premier appel echoue
- `ayo-semantics.ts` : modele Gemini corrige → `gemini-3-flash-preview` (1.5-flash etait deprecie)
- API Monitoring : `lib/aya/api-tracker.ts` — buffer memoire + flush Supabase toutes les 5min. Classifie les callers (llm_agent, developer, crawler, browser). 7 routes AYA instrumentees. Endpoint admin `/api/aya/analytics?days=7`.
- Migration domaine : `ai-visionary.xyz` = domaine primaire (8 avril 2026). `.com` redirige 301 vers `.xyz`. 42+ fichiers source + i18n + docs + public migres. DNS Infomaniak, Vercel, Stripe configures.
- Emails : migration Resend → Infomaniak SMTP (nodemailer). `lib/mailer.ts` + 11 routes API migrees. Adresses : `hello@` (boite) + `security@` (alias). TODO partenariat Infomaniak : ajouter alias `delivery@` + `registry@`.
- Pages FAQ (/faq), Glossaire (/glossaire), CGV (/cgv) — bilingues FR/EN, liens dans le footer.
- Mentions legales + confidentialite : hebergement = Infomaniak Network SA (Geneve, Suisse).

---

## 7. CE QUI RESTE A FAIRE

| # | Tache | Priorite | Statut |
|---|-------|----------|--------|
| 1 | ~~Merger branches en attente dans `main`~~ | ~~Immediat~~ | Fait (31 mars 2026) |
| 2 | ~~Coherence linguistique fichiers PRO (EN par defaut)~~ | ~~Immediat~~ | Fait (31 mars 2026) |
| 3 | ~~AYO V4 Evidence-Based~~ | ~~Haute~~ | Fait — actif en prod, flag ON (3 avril 2026) |
| 4 | ~~Stabiliser qualite fichiers PRO (anti-marketing, classification, normalisation)~~ | ~~Critique~~ | Fait — solidifie (3 avril 2026). sanitizeComplianceOutput() partagee, score stable 82/100 |
| 5 | Scraping 100k entites + registres du commerce | Critique | En cours (~4400) |
| 6 | Campagne email entreprises indexees | Haute | A faire |
| 7 | Re-exporter GitHub/HuggingFace apres chaque batch | Continue | Fait (7 avril 2026). GitHub 4372 entites + HuggingFace 4437 entites |
| 8 | Soumission There's An AI For That | Moyenne | Cyril |
| 9 | Diagnostic V2 micro-agents — 8 micro-agents LLM + detect-pedagogy. Score stable 81/100. OTP + email + Stripe TEST connectes. Merge dans main. Page `/diagnostic-v2`. | Haute | Fait — merge dans main (5 avril 2026) |
| 10 | ~~Monitoring API — tracker appels AYA par source~~ | ~~Moyenne~~ | Fait (7 avril 2026). `api-tracker.ts` + 7 routes instrumentees + `/api/aya/analytics` admin endpoint |
| 11 | ~~Re-scoring batch V2~~ | ~~Critique~~ | ABANDONNE (7 avril 2026) — scores bot 20-50 sont corrects et intentionnels, plafond 50 = moteur conversion AYO PRO |
| 12 | ~~Dashboard Entreprise — /dashboard/[entityId] complet : 7 blocs AIO, re-scan V2, admin compte, OTP gate~~ | ~~Haute~~ | Fait — verifie (6 avril 2026) |
| 13 | ~~i18n FR/EN page diagnostic V2 — 96+ cles, useTranslations('diagnostic'), 137 cles EN+FR~~ | ~~Haute~~ | Fait — verifie (6 avril 2026) |
| 14 | ~~Responsive mobile page diagnostic V2 — 2 breakpoints (768px, 640px), grids single col, no overflow~~ | ~~Haute~~ | Fait — verifie (6 avril 2026) |
| 15 | ~~Footer visibility — nav tags plus strippes dans orchestrator.ts, footers visibles par tous les agents (contact, location, services, legal)~~ | ~~Critique~~ | Fait — verifie (6 avril 2026, commit f91f98cd) |
| 16 | ~~Score alignment V2→email→AYA — proScore sauve dans analyses, webhook l'utilise, computeAioScore() unique partout, deterministe~~ | ~~Haute~~ | Fait — verifie (6 avril 2026). Variance Offer Clarity etait pre-V2. |
| 17 | ~~Public Key ID visible dans cartes AYA + LLM API + GitHub export~~ | ~~Haute~~ | Fait (6 avril 2026) |
| 18 | ~~Admin enrichment API + fix modele Gemini ayo-semantics~~ | ~~Critique~~ | Fait (6 avril 2026). `/api/admin/enrich` + retry webhook + gemini-3-flash-preview |

---

## 8. ANALYSE DES COUTS

> **REGLE ABSOLUE : avant TOUT batch ou operation en volume, TOUJOURS estimer le cout et obtenir l'accord de Cyril.**

### Budget mensuel

| Service | Plan | Budget/mois | Limites |
|---------|------|-------------|---------|
| **Google Cloud (Gemini API)** | Pay-as-you-go | CHF 20.00 | Budget alert a 100% |
| **Supabase** | Free/Pro (org NeousAxis) | Quota plan | Depasse = bloque ou surcharge |
| **Vercel** | Pro | Inclus | maxDuration=120s par fonction |
| **Resend** | Free tier | 0 | 100 emails/jour, 3000/mois |
| **Stripe** | Mode LIVE | Commission standard (~2.9% + 0.30 CHF) | Production depuis 11 avril 2026 |

### Cout par operation Gemini

| Operation | Appels Gemini | Cout estime |
|-----------|---------------|-------------|
| 1 diagnostic V2 (micro-agents) | ~13 appels | ~$0.005 |
| 1 enrichissement Gemini (descriptions+keywords) | 1 appel | ~$0.001 |
| Bot AYA scraping (1000 entites) | 1000 appels | ~$0.50 |

### Historique des incidents couts

| Date | Incident | Cause | Impact |
|------|----------|-------|--------|
| 6-7 avril 2026 | Budget Google 100% atteint (CHF 20) | Rescoring batch V2 : ~500 entites × 13 appels = ~6500 appels Gemini inutiles | 100% du budget mensuel consomme en 7 jours |
| 7 avril 2026 | Quota Supabase depasse | Rescoring batch V2 : milliers de lectures/ecritures + 4 sessions paralleles | Supabase accorde une exception one-time |

### Regles anti-depassement

1. **JAMAIS de batch > 100 entites** sans estimation de cout prealable ET accord de Cyril
2. **JAMAIS de sessions paralleles** sur Supabase sans verifier le quota
3. **Budget Google = CHF 20/mois** — chaque appel Gemini compte
4. **Le bot AYA (scraping)** utilise aussi Gemini → compter dans le budget mensuel
5. **Rescoring batch V2 = INTERDIT** — les scores bot 20-50 sont corrects

---

## 9. COMMANDES UTILES

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

# Admin — re-enrichir entites certifiees
curl -X POST "https://ai-visionary.xyz/api/admin/enrich?secret=$ADMIN_SECRET" -H "Content-Type: application/json" -d '{"entity_id": "<UUID>"}'      # une entite
curl -X POST "https://ai-visionary.xyz/api/admin/enrich?secret=$ADMIN_SECRET" -H "Content-Type: application/json" -d '{"all": true}'                  # batch
curl -X POST "https://ai-visionary.xyz/api/admin/enrich?secret=$ADMIN_SECRET" -H "Content-Type: application/json" -d '{"all": true, "force": true}'   # force re-enrichir tout

# API AYA locale (dev/test)
cd aya && uvicorn api.main:app --reload  # http://127.0.0.1:8000
```

### API AYA Publique

**Base URL** : `https://ai-visionary.xyz/api/aya`

| Route | Description |
|-------|-------------|
| `/api/aya` | Index JSON des endpoints |
| `/api/aya/llm/{domain}` | LLM-optimise — 6 champs incl. public_key_id (cache CDN 1h) |
| `/api/aya/search?q={query}` | Recherche (max 200 resultats) |
| `/api/aya/entity/{domain}` | Detail entite + ASR_DERIVED |
| `/api/aya/stats` | Statistiques globales |
| `/api/aya/live` | Toutes les entites |
| `/api/aya/docs` | Documentation HTML |
| `/api/aya/analytics?days=7` | **Admin** — analytics appels API (necessite ADMIN_SECRET) |

### Fichiers critiques a lire en priorite

1. `app/api/chat/route.ts` — Coeur du chatbot + pipeline V4 (~2800 lignes)
2. `lib/aio-score-engine.ts` — Moteur de scoring (per-block caps V4)
3. `lib/ayo-crypto.ts` — Generateur ASR + sanitization + signature Ed25519
4. `lib/ayo-generators.ts` — Generateurs FAQ/glossary/manifest/external_context + reclassifyCompliance + cleanOutputArray
5. `lib/agents/controle-qualite.ts` — Anti-marketing + downgradeFieldQuality + INTERPRETIVE_CLAIMS_RE
6. `lib/question-engine.ts` — V4 question templates + evaluateEvidence
7. `lib/site-classifier.ts` — Classification deterministe (7 types)
8. `app/api/webhooks/checkout-success/route.ts` — Webhook Stripe + PRO score lift
9. `lib/micro-agents/orchestrator.ts` — Orchestrateur micro-agents + mergeAgentResultsToExtract (V2)
10. `app/api/diagnostic/scan/route.ts` — SSE endpoint micro-agents (V2)
11. `lib/ayo-semantics.ts` — Enrichissement Gemini bilingue (descriptions + keywords) — modele `gemini-3-flash-preview`
12. `app/api/admin/enrich/route.ts` — Admin API re-enrichissement entites (single + batch)
13. `lib/aya/api-tracker.ts` — Monitoring API : buffer memoire, classification User-Agent, flush Supabase
14. `app/api/aya/analytics/route.ts` — Admin endpoint analytics (aggregation par jour/endpoint/caller)

---

## 10. REFERENCE

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

<!-- gitnexus:start -->
# GitNexus — Code Intelligence

This project is indexed by GitNexus as **AI VISIONARY** (5570 symbols, 7127 relationships, 92 execution flows). Use the GitNexus MCP tools to understand code, assess impact, and navigate safely.

> If any GitNexus tool warns the index is stale, run `npx gitnexus analyze` in terminal first.

## Always Do

- **MUST run impact analysis before editing any symbol.** Before modifying a function, class, or method, run `gitnexus_impact({target: "symbolName", direction: "upstream"})` and report the blast radius (direct callers, affected processes, risk level) to the user.
- **MUST run `gitnexus_detect_changes()` before committing** to verify your changes only affect expected symbols and execution flows.
- **MUST warn the user** if impact analysis returns HIGH or CRITICAL risk before proceeding with edits.
- When exploring unfamiliar code, use `gitnexus_query({query: "concept"})` to find execution flows instead of grepping. It returns process-grouped results ranked by relevance.
- When you need full context on a specific symbol — callers, callees, which execution flows it participates in — use `gitnexus_context({name: "symbolName"})`.

## When Debugging

1. `gitnexus_query({query: "<error or symptom>"})` — find execution flows related to the issue
2. `gitnexus_context({name: "<suspect function>"})` — see all callers, callees, and process participation
3. `READ gitnexus://repo/AI VISIONARY/process/{processName}` — trace the full execution flow step by step
4. For regressions: `gitnexus_detect_changes({scope: "compare", base_ref: "main"})` — see what your branch changed

## When Refactoring

- **Renaming**: MUST use `gitnexus_rename({symbol_name: "old", new_name: "new", dry_run: true})` first. Review the preview — graph edits are safe, text_search edits need manual review. Then run with `dry_run: false`.
- **Extracting/Splitting**: MUST run `gitnexus_context({name: "target"})` to see all incoming/outgoing refs, then `gitnexus_impact({target: "target", direction: "upstream"})` to find all external callers before moving code.
- After any refactor: run `gitnexus_detect_changes({scope: "all"})` to verify only expected files changed.

## Never Do

- NEVER edit a function, class, or method without first running `gitnexus_impact` on it.
- NEVER ignore HIGH or CRITICAL risk warnings from impact analysis.
- NEVER rename symbols with find-and-replace — use `gitnexus_rename` which understands the call graph.
- NEVER commit changes without running `gitnexus_detect_changes()` to check affected scope.

## Tools Quick Reference

| Tool | When to use | Command |
|------|-------------|---------|
| `query` | Find code by concept | `gitnexus_query({query: "auth validation"})` |
| `context` | 360-degree view of one symbol | `gitnexus_context({name: "validateUser"})` |
| `impact` | Blast radius before editing | `gitnexus_impact({target: "X", direction: "upstream"})` |
| `detect_changes` | Pre-commit scope check | `gitnexus_detect_changes({scope: "staged"})` |
| `rename` | Safe multi-file rename | `gitnexus_rename({symbol_name: "old", new_name: "new", dry_run: true})` |
| `cypher` | Custom graph queries | `gitnexus_cypher({query: "MATCH ..."})` |

## Impact Risk Levels

| Depth | Meaning | Action |
|-------|---------|--------|
| d=1 | WILL BREAK — direct callers/importers | MUST update these |
| d=2 | LIKELY AFFECTED — indirect deps | Should test |
| d=3 | MAY NEED TESTING — transitive | Test if critical path |

## Resources

| Resource | Use for |
|----------|---------|
| `gitnexus://repo/AI VISIONARY/context` | Codebase overview, check index freshness |
| `gitnexus://repo/AI VISIONARY/clusters` | All functional areas |
| `gitnexus://repo/AI VISIONARY/processes` | All execution flows |
| `gitnexus://repo/AI VISIONARY/process/{name}` | Step-by-step execution trace |

## Self-Check Before Finishing

Before completing any code modification task, verify:
1. `gitnexus_impact` was run for all modified symbols
2. No HIGH/CRITICAL risk warnings were ignored
3. `gitnexus_detect_changes()` confirms changes match expected scope
4. All d=1 (WILL BREAK) dependents were updated

## Keeping the Index Fresh

After committing code changes, the GitNexus index becomes stale. Re-run analyze to update it:

```bash
npx gitnexus analyze
```

If the index previously included embeddings, preserve them by adding `--embeddings`:

```bash
npx gitnexus analyze --embeddings
```

To check whether embeddings exist, inspect `.gitnexus/meta.json` — the `stats.embeddings` field shows the count (0 means no embeddings). **Running analyze without `--embeddings` will delete any previously generated embeddings.**

> Claude Code users: A PostToolUse hook handles this automatically after `git commit` and `git merge`.

## CLI

| Task | Read this skill file |
|------|---------------------|
| Understand architecture / "How does X work?" | `.claude/skills/gitnexus/gitnexus-exploring/SKILL.md` |
| Blast radius / "What breaks if I change X?" | `.claude/skills/gitnexus/gitnexus-impact-analysis/SKILL.md` |
| Trace bugs / "Why is X failing?" | `.claude/skills/gitnexus/gitnexus-debugging/SKILL.md` |
| Rename / extract / split / refactor | `.claude/skills/gitnexus/gitnexus-refactoring/SKILL.md` |
| Tools, resources, schema reference | `.claude/skills/gitnexus/gitnexus-guide/SKILL.md` |
| Index, status, clean, wiki CLI commands | `.claude/skills/gitnexus/gitnexus-cli/SKILL.md` |

<!-- gitnexus:end -->
