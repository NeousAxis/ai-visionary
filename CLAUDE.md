# AI VISIONARY — Claude Code Project Guide

> Ce fichier est lu automatiquement par Claude Code. Il contient le contexte essentiel et le plan d'action.
> Pour l'historique complet des sessions et changelogs, voir `MEMORY.md`.
> Pour le plan de remediation original (10 sprints, tous termines), voir `PLAN-ACTION-AYO-COMPLET.md`.
> Derniere mise a jour : 28 avril 2026 (pivot 100% suisse + sprint Postgres VPS)

---

## 1. CONTEXTE PROJET

**AI Visionary** — Startup basee a Geneve, Suisse, fondee par Cyril Leger.

| Terme | Definition |
|-------|-----------|
| **AYO** | Agent IA qui diagnostique la lisibilite IA d'un site web. V1=chatbot Gemini (page /diagnostic). V2=micro-agents LLM cibles Gemini 3 Flash (page /diagnostic-v2, branche feature/micro-agents-diagnostic). |
| **AIO Score** | Score 0-100, deterministe, base sur 7 blocs ponderes (la "Bible AIO"). |
| **AYA** | Registre public d'entites indexees/certifiees. **Deux sources**: Supabase `aya_registry` (~4 438 entites legacy/certifiees, intouchable) + Postgres VPS Infomaniak `aya_local.aya_registry` (~25 860 entites scrapees Tranco EU, push 28 avril 2026). Objectif 100k. Total live au 28 avril : ~30 298. |
| **ASR** | AI Singular Record — fichier JSON-LD signe Ed25519, identite numerique de l'entite. |
| **Hard cap** | Pas de JSON-LD + pas d'AYA = score max 50. **Pas d'ASR = max 50** (doctrine stricte depuis 21 avril 2026). Score max 78 sans preuves externes. |
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

**Stratégie 100 % suisse (decidee 28 avril 2026)** : aucun service US ni hors-CH pour les composants critiques. Migration Vercel → VPS Infomaniak en cours. Cloudflare/AWS/Vercel/Mailchimp/Resend interdits. Que Infomaniak + self-hosted, ou rien.

- **Frontend + API** : Vercel (en sortie — pivot vers VPS Infomaniak en cours, etapes detaillees dans la section "Migration Vercel -> VPS")
- **VPS Infomaniak `aya-bot`** : Public Cloud 4C/8G/160GB NVMe (partenariat gratuit 2 ans, 17 avril 2026). Hostname `aya-bot`, IP `83.228.229.212`, accessible aussi via `beta.ai-visionary.xyz` (DNS staging temporaire — sera supprime apres bascule). SSH `ubuntu@beta.ai-visionary.xyz`, path `/home/ubuntu/app/`, PM2 app `ai-visionary` sur `:3000`, nginx `:443`. Cible : devient la prod 100 % suisse.
- **Base de donnees** :
  - **Supabase PostgreSQL** — sanctuaire intouchable (~4 438 entites + analyses + scan_states + otp_codes + sessions + system_logs). Lecture seule depuis l'app, JAMAIS de migration ni d'ecriture batch sans accord explicite Cyril.
  - **Postgres 16 self-hosted sur VPS aya-bot** (active 28 avril 2026) — DB `aya_local`, role `aya_app`, table `aya_registry` reproduite a l'identique. Contient ~25 860 entites scrapees Tranco EU (push fait le 28 avril). localhost-only, pg_hba scram-sha-256, pg_dump quotidien dans `/home/ubuntu/backups/`.
- **CDN / DDoS / WAF** : aucun service externe. Anti-DDoS niveau reseau **inclus** avec Public Cloud Infomaniak. Hardening local : nginx (rate limiting + cache + gzip/brotli) + fail2ban + ufw.
- **Emails** : Infomaniak SMTP (nodemailer). Adresses : hello@ + security@ (alias). TODO: ajouter alias delivery@ et registry@.
- **Newsletter** : Infomaniak Newsletter (domain ID 62227, 50k credits/mois). Strict opt-in, pas de cold marketing (CGU). Compte bloque depuis 25 avril, ticket support en attente.
- **Paiements** : Stripe (mode LIVE depuis 11 avril 2026). Webhook URL `https://ai-visionary.xyz/api/webhooks/checkout-success` — suit le DNS, transparente lors de la bascule VPS.
- **Domaine** : ai-visionary.xyz (primaire, depuis 8 avril 2026). ai-visionary.com redirige vers .xyz (301). Registrar Infomaniak. Domain ID `2128919` pour API DNS.
- **Backup** : Swiss Backup Infomaniak 200 Go (a configurer apres bascule VPS).
- **kSuite Business** : 3 users @ai-visionary.com (a configurer).

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
VPS_PG_HOST=localhost                        # VPS Postgres self-hosted
VPS_PG_PORT=5432
VPS_PG_DB=aya_local
VPS_PG_USER=aya_app
VPS_PG_PASSWORD                              # Sur VPS uniquement, never in Vercel
HF_TOKEN                                     # HuggingFace dataset export
INFOMANIAK_NEWSLETTER_TOKEN
INFOMANIAK_NEWSLETTER_DOMAIN_ID=62227
```

> Note : `AYA_VPS_API_URL` (var Vercel pour fetch HTTP vers le VPS) est obsolete depuis le pivot 100% suisse — l'app sera sur le VPS et lira directement Postgres en local.

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

1. **Croissance registre** : objectif 100k entites — **Vague 1 Tranco EU en cours** (156k domaines extraits, batch 1 de 10k scrape = +9595 JSONs locaux au 14 avril). Push Supabase bloque jusqu'a fin grace period (7 mai 2026).
2. ~~**Campagne email entreprises indexees via Newsletter**~~ — ABANDONNEE (28 avril 2026). Cold marketing aux ~1583 entites AYA-BOT incompatible avec les CGU Infomaniak Newsletter (opt-in explicite obligatoire). Endpoint `app/api/admin/campaign-aya-indexed/` + template `buildAyaIndexedAnnouncementEmail` supprimes. Newsletter Infomaniak reservee a usage opt-in futur (clients AYA Sub / Pack PRO une fois lancement commercial effectif). Les colonnes `missing_contact_email` + `email_research_status` du schema restent (utiles pour gestion interne / canal SMTP individuel hors Newsletter).
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
- Diagnostic V2 : 8 micro-agents (dont detect-pedagogy LLM pour FAQ/glossary/docs), retry x3 pour stabilite score, OTP clients existants, email capture, Stripe LIVE connecte
- Diagnostic V2 universel tous types de sites : SPA (Jina fallback), NGO/nonprofit, e-commerce, agences, institutions. Detection deterministe legal links (footer regex), social links (bare domain regex), pedagogy elargie (blog/insights/reports/academy). Business type inference (NGO avant commercial). Compare filtering : INCOMPATIBLE_TYPES, SECTOR_AFFINITY, IDF keywords, containment strict (6 chars min + 40% ratio)
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
- **Vague 1 Tranco EU (14 avril 2026)** : `aya/fetch_tranco_eu.py` telecharge Tranco Top 1M, filtre 38 TLDs europeens, dedup vs `domains.txt` → **156 616 nouveaux domaines EU** dans `aya/domains_growth_tranco.txt` (apres blocklist). Batch 1 de 10 000 domaines (`domains_batch1_10k.txt`) scrape avec succes (96% success rate, +9595 JSONs dans `aya/data/`). Push Supabase BLOQUE jusqu'au 8 mai (grace period).
- **Blocklist porn/armement (14 avril 2026)** : `aya/blocklist.py` — patterns `PORN_RE` + `WEAPON_RE` + whitelist explicite (gun.io, gundam-store, riflessi, essex/sussex, emilfrey, etc.). Airsoft autorise (sport). 118 domaines bannis supprimes (104 porn + 14 armement). Filtre integre dans `run_pipeline_fast.py` (via `load_domains`) et `fetch_tranco_eu.py`. Aucune future vague ne peut ramener ces domaines.
- ~~**Email template campagne bot-indexed (14 avril 2026)**~~ : SUPPRIME le 28 avril 2026 suite a abandon de la campagne (cold marketing incompatible CGU Infomaniak Newsletter). Pour reference historique uniquement : la fonction etait `buildAyaIndexedAnnouncementEmail(entityName, score, publicAyaUrl, diagnosticUrl, locale)` dans `lib/email-templates.ts`, bilingue FR/EN.
- **Schema aya_registry (14 avril 2026)** : ajout colonnes `missing_contact_email` (BOOLEAN) + `email_research_status` (TEXT: pending | researched_ok | researched_failed | do_not_contact) + index partiel `idx_aya_missing_email`. Backfill manuel via SQL Editor — identifie les entites AYA-BOT sans email pour enrichissement manuel/tiers futur.
- **Supabase grace period** : 7 avril → 7 mai 2026. Declenchee par l'incident rescoring V2 (depassement egress). Regle absolue : **pas de gros batch Supabase** pendant le grace period. Apres le 7 mai, retour normal Free Plan si aucun nouveau depassement. Push des 9595 JSONs locaux reporte au 8 mai.
- **scripts/rescore-batch.sh supprime** (14 avril 2026) : ancien lanceur du rescoring V2 abandonne (utilisait nohup/caffeinate pour batch non supervise). Suppression demandee par Cyril.
- **Batches 2 & 3 Tranco (17-18 avril 2026)** : batch 2 scrape en 1h04 (9998/10000), batch 3 en 2h40 (9979/10000 + retry 21/21 apres fix parser). Total au 18 avril : 36 245 JSONs dans `aya/data/` (6682 initial + 29 562 nouveaux). 1583 avec contact_email candidats pour campagne email.
- **Fix `parser.py::normalize_country` (18 avril 2026)** : la fonction crashait sur `.strip()` si `raw_country` etait un dict (JSON-LD structure `{"@type":"Country","name":"Poland"}`). Ajout de `_coerce_to_str()` qui gere str/dict/list/None/int de maniere defensive. 21 sites e-commerce (gymbeam, vente-unique, benuta, mein-gartenshop24...) recuperes avec score 50 et country correctement detecte.
- **Cap 50 sans ASR + masquage concurrents ai-visionary.xyz (21 avril 2026)** : commit `f31d1d65`. (1) `lib/aio-score-engine.ts` : cap passe de 90 a 50 sans ASR (regle doctrinale AYO). (2) `app/api/diagnostic/scan/route.ts` : retire les 2 overrides V2 (`has_asr_file = true` + `is_aya_registered = true`) qui neutralisaient le cap — GARDE seulement `has_jsonld = true`. (3) `app/diagnostic/page.tsx` : section concurrents affiche une carte dediee "Vous etes la reference du registre AYA" au lieu de competitors quand domaine = ai-visionary.xyz. (4) `messages/fr.json` + `messages/en.json` : 3 cles i18n ajoutees (`compareSelfTitle`, `compareSelfDesc`, `compareSubSelf`). **Tests end-to-end sur beta VPS valides** : plombier-geneve.ch → 50/100 (cap applique), stripe.com → 50/100 (cap applique), ai-visionary.xyz → 98.8/100 (ASR reel, cap ignore). UI testee en EN via Claude-in-Chrome. Deploy prod Vercel applique.
- **Batch 4 Tranco (25 avril 2026)** : 6748/6767 succes (99.7%), 19 erreurs `not enough values to unpack` sur sites avec challenge Cloudflare/CDN. Retry n'a recupere que 3/19. Reste 16 abandonnes (negligeable).
- **Batch 5 Tranco (25 avril 2026)** : 9987/10000 succes (99.87%), 13 erreurs. 2h27 de scrape. `aya/domains_batch5_10k.txt` = lignes 30001-40000 du Tranco EU. Total cumule `aya/data/` apres batch 5 : ~46 000 JSONs.
- **Code campagne newsletter (25 avril 2026, partiellement REVERTE 28 avril)** : `lib/infomaniak-newsletter.ts` (wrapper API : createSubscriber, createCampaign, testCampaign, scheduleCampaign…) **conserve** pour usage opt-in futur. `app/api/admin/campaign-aya-indexed/route.ts` **SUPPRIME le 28 avril 2026** car il importait des contacts non opt-in dans Newsletter Infomaniak (incompatible avec les CGU). Variables env `INFOMANIAK_NEWSLETTER_TOKEN` + `INFOMANIAK_NEWSLETTER_DOMAIN_ID=62227` toujours dans `.env.local` (utilisables des qu'une vraie base opt-in sera constituee).
- **API DNS Infomaniak debloquee (25 avril 2026)** : decouverte critique — l'endpoint `/1/domain/{domainId}/dns/record` accepte le token Newsletter et permet la gestion DNS programmatique. Domain ID `ai-visionary.xyz` = **2128919**. Format des records DKIM : il faut envoyer `type:"DKIM", dkim_type:"CNAME"` (pas `type:"CNAME"`). Permet de recreer les 4 records (SPF + 3 DKIM amazonses) sans l'interface UI Infomaniak qui se verrouillait.
- **Newsletter Infomaniak BLOQUEE puis pivot strategique (25-28 avril 2026)** : compte temporairement bloque par le filtre qualite auto apres tests minimalistes (`campaign_is_spam`). Reponse Infomaniak (28 avril) : 4 questions sur opt-in + preuves d'inscription. Decision Cyril : reponse 100% honnete a Infomaniak — phase pre-lancement, pas de base opt-in, tests sur ses propres adresses. **Pivot strategique** : Newsletter Infomaniak ne servira QUE pour des destinataires opt-in explicites (clients AYA Sub / Pack PRO / inscriptions newsletter avec double opt-in) une fois le lancement commercial effectif. Cold marketing aux entites AYA-BOT abandonne. Code aligne avec la promesse : endpoint et template supprimes le 28 avril. Lecon double : **ne jamais tester newsletter avec un dummy minimal** + **ne jamais utiliser Newsletter pour du cold marketing — le service est strictement opt-in**.
- **Sprint Postgres VPS + 8 fixes SEO (28 avril 2026)** : (1) Setup Postgres 16 self-hosted sur VPS Infomaniak `aya-bot` (= `beta.ai-visionary.xyz`, IP 83.228.229.212) via sous-agent Sonnet : DB `aya_local`, role `aya_app`, table `aya_registry` repliquee schema Supabase, 5 indexes, pg_hba localhost-only, `listen_addresses=localhost`, cron pg_dump quotidien dans `/home/ubuntu/backups/`. Doc dans `docs/vps-postgres-setup.md`. (2) Push 25 860 entites scrapees (filter score >= 20) sur Postgres VPS via `aya/push_to_local_pg.py` (fork de `push_to_aya.py`, batches 50 + delai 200ms, INSERT/DELETE par entity_id, transactions). 0 erreur. (3) **8 fixes SEO** : `public/.well-known/ai-plugin.json` + `openapi.json` (decouverte IA), JSON-LD ItemList registre 10 → 100 entites, "3000+" → "4400+" homepage, twitter card `summary_large_image`, `/api/aya/search` retourne `entity_id` + `domain`, OG image dynamique 1200x630 (`app/aya/e/[id]/opengraph-image.tsx`), pages `/aya/sector/[macro]` + `/aya/country/[code]` + sitemap maj (4 499 URLs), Related entities sur fiche, badge SVG endpoint `/api/aya/badge/[domain]`. (4) Architecture mixte preparee : `lib/db-local-pg.ts` (client `pg` localhost), routes `/api/aya-local/{search,entity,live,stats}`, helper `getAyaEntitiesAggregated` dans `lib/db.ts`. tsc + `npm run build` sans erreur. Supabase intacte (4 438 entites verifie). 3 nouvelles methodes lecture seule dans `lib/db.ts` : `getAyaEntitiesByFilter`, `getAyaSectors`, `getAyaCountries`.

---

## 6.5 MIGRATION VERCEL → VPS INFOMANIAK (en cours)

> **Strategie 100 % suisse decidee 28 avril 2026.** AI Visionary doit etre 100% suisse. Aucun service US (Cloudflare interdit, AWS interdit, Vercel a sortir). Migration en cours.

### Etat infra cible

```
INTERNET
   |
   v
DNS Infomaniak
   |
   v
[Anti-DDoS Infomaniak — inclus avec Public Cloud]
   |
   v
VPS aya-bot (83.228.229.212, 4C/8G)
   |
   |--- ufw (22/80/443 only)
   |--- fail2ban (ban abus auto)
   |--- nginx (TLS Let's Encrypt + rate limit + cache + gzip/brotli)
   |--- PM2 -> Next.js prod
   |       |--- lit Postgres VPS local (25 860 entites)
   |       |--- lit Supabase via SDK (4 438 entites legacy, READ ONLY)
   |--- Postgres 16 self-hosted (localhost:5432)
   |--- crontab : pg_dump + cron jobs Next.js
```

### Ce qui reste pour basculer (~6-7h de travail)

| # | Etape | Duree |
|---|-------|-------|
| MV.1 | Code a jour sur le VPS : rsync + npm install (`pg` + `@types/pg`) + `npm run build` + `pm2 restart` | 30-45 min |
| MV.2 | Verifier `.env.local` du VPS contient TOUTES les vars (Supabase URL/KEY, Stripe, Gemini, SMTP, Admin/Session/AYO keys, HF_TOKEN, Newsletter) | 30 min |
| MV.3 | Refactorer `getAyaEntitiesAggregated` pour lire Postgres VPS en local (sans HTTP fetch) + brancher dans `/api/aya/{search,live,entity,stats}` | 1 h |
| MV.4 | TLS Let's Encrypt sur `ai-visionary.xyz` + `www.ai-visionary.xyz` (certbot) | 30 min |
| MV.5 | nginx config server block + reverse proxy `:3000` + `gzip`/`brotli` + `proxy_cache` + `limit_req_zone` | 1 h |
| MV.6 | ufw firewall (22/80/443 only) + fail2ban (regles nginx + ssh) | 30 min |
| MV.7 | Cron jobs Linux : `expire-entities` (1h), `expiry-reminders` (9h), `review-reminders` (9h) via `curl localhost:3000/api/cron/...` | 30 min |
| MV.8 | Tests E2E sur `beta.ai-visionary.xyz` : pages publiques + diagnostic V2 + Stripe checkout + webhook + email Pack PRO + OTP + API AYA fusionnee + sitemap 30k+ URLs | 2 h |
| MV.9 | Reduire TTL DNS `ai-visionary.xyz` a 300s (preparation switch) | 5 min |
| MV.10 | Switch DNS : `A ai-visionary.xyz 83.228.229.212` + `CNAME www → @`, garder Vercel actif 48h | 5 min + propagation |
| MV.11 | Surveillance 48h (logs, monitoring uptime suisse) | continu |
| MV.12 | Desactiver Vercel + retirer auto-deploy GitHub | 5 min |
| MV.13 | Supprimer record DNS `beta.ai-visionary.xyz` | 5 min |

**Stripe webhook** : URL ne change pas (`ai-visionary.xyz/api/webhooks/checkout-success` suit le DNS). Aucune action cote dashboard Stripe.

**Post-bascule** : `/api/aya-local/*` deviennent redondantes (l'app sur le VPS lit Postgres en local) — a fusionner dans `/api/aya/*` ou supprimer.

---

## 7. CE QUI RESTE A FAIRE

| # | Tache | Priorite | Statut |
|---|-------|----------|--------|
| 1 | ~~Merger branches en attente dans `main`~~ | ~~Immediat~~ | Fait (31 mars 2026) |
| 2 | ~~Coherence linguistique fichiers PRO (EN par defaut)~~ | ~~Immediat~~ | Fait (31 mars 2026) |
| 3 | ~~AYO V4 Evidence-Based~~ | ~~Haute~~ | Fait — actif en prod, flag ON (3 avril 2026) |
| 4 | ~~Stabiliser qualite fichiers PRO (anti-marketing, classification, normalisation)~~ | ~~Critique~~ | Fait — solidifie (3 avril 2026). sanitizeComplianceOutput() partagee, score stable 82/100 |
| 5 | Scraping 100k entites + registres du commerce | Critique | En cours — Vague 1 Tranco EU : batches 1-5 scrape (+39 478 JSONs cumules au 25 avril, total data/ ~46 000 incl. 6682 initial), ~11 batches de 10k restants dans `domains_growth_tranco.txt` |
| 6 | ~~Campagne email entreprises indexees via Newsletter~~ | ~~Haute~~ | ABANDONNE (28 avril 2026). Cold marketing aux ~1583 entites AYA-BOT incompatible avec CGU Infomaniak Newsletter (opt-in obligatoire). Endpoint `app/api/admin/campaign-aya-indexed/route.ts` et template `buildAyaIndexedAnnouncementEmail` supprimes. Si un canal d'annonce vers entites indexees est un jour necessaire, faire SMTP individuel via `hello@` (hors Newsletter Infomaniak), avec opt-out conforme LPD/RGPD. |
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
| 19 | ~~Vague 1 Tranco — extraction 156k domaines EU + batch 1 scrape 10k~~ | ~~Critique~~ | Fait (14 avril 2026). `aya/fetch_tranco_eu.py` + `aya/domains_growth_tranco.txt` + `aya/domains_batch1_10k.txt` + +9595 JSONs |
| 20 | ~~Blocklist porn/armement + filtre permanent~~ | ~~Critique~~ | Fait (14 avril 2026). `aya/blocklist.py` + integration `run_pipeline_fast.py` + `fetch_tranco_eu.py`. 118 domaines bannis supprimes |
| 21 | ~~Email template `buildAyaIndexedAnnouncementEmail`~~ | ~~Haute~~ | Fait (14 avril 2026), puis SUPPRIME (28 avril 2026) — abandon cold marketing via Newsletter Infomaniak. |
| 22 | ~~Schema Supabase `missing_contact_email` + `email_research_status`~~ | ~~Haute~~ | Fait (14 avril 2026). Ajoute manuellement par Cyril via SQL Editor |
| 23 | ~~Push Supabase Vague 1 batch 1~~ | ~~Critique~~ | ABANDONNE (28 avril 2026). Supabase intouchable (sanctuaire). Toutes les nouvelles entites scrapees vont sur Postgres VPS. Au 28 avril : 25 860 entites pushees sur Postgres VPS (filter score >= 20, 0 erreur). |
| 24 | Vague 1 batches 6→16 (~110 000 domaines Tranco restants) | Critique | Batches 1-5 faits (55 676 JSONs scrapes au 25 avril, 25 860 pushes Postgres VPS au 28 avril). ~11 batches de 10k restants. Cible push : Postgres VPS uniquement. |
| 32 | ~~Fix parser.py — normalize_country crash sur JSON-LD dict~~ | ~~Haute~~ | Fait (18 avril 2026). Nouvelle fonction `_coerce_to_str()` dans parser.py gere str/dict/list/None/int pour JSON-LD structures (ex: `{"@type":"Country","name":"Poland"}`). Permet de recuperer 21 sites e-commerce qui crashaient (gymbeam, vente-unique, benuta, etc.). Pays detecte correctement (PL/FR/DE) depuis le JSON-LD |
| 25 | Patcher `aya/fetch_sirene.py` rate limit (HTTP 429) | Moyenne | REQUEST_DELAY 0.4s → 1.5s + retry exponentiel + MAX_PAGES_PER_CODE 8 → 4 |
| 26 | Trouver alternative Zefix CH (401 auth sur `/search`) | Moyenne | Candidate : opendata.swiss, Swiss Startup Map, OpenCorporates. Tranco a deja 3277 .ch, pas urgent |
| 27 | ~~API endpoint `/api/admin/campaign-aya-indexed`~~ | ~~Haute~~ | ABANDONNE (28 avril 2026). Endpoint supprime car incompatible avec CGU Infomaniak (importait des contacts non opt-in). `lib/infomaniak-newsletter.ts` conserve pour usage opt-in futur. |
| 28 | thepiratebay.se + politique warez | Moyenne | EN ATTENTE — Cyril a reporte la decision (14 avril). Pas dans blocklist pour l'instant |
| 29 | ~~Setup VPS Infomaniak `aya-bot` (Public Cloud 4C/8G/160GB)~~ | ~~Critique~~ | Fait (28 avril 2026). VPS actif (= `beta.ai-visionary.xyz`, IP 83.228.229.212). Postgres 16 + 25 860 entites pushees. Reste a installer scripts aya/ scraping pour batches 24/7 (tache 24). |
| MV | **Migration Vercel → VPS Infomaniak (100% suisse)** | Critique | En cours. 13 etapes documentees en section 6.5. ~6-7h de travail. Cyril decide du planning. |
| 30 | Configurer Newsletter Infomaniak (50k credits/mois) | Haute | En attente des codes. Adapter template email ou utiliser API Newsletter Infomaniak |
| 31 | Setup kSuite Business 3 users @ai-visionary.com | Moyenne | En attente des codes. 3 boites email pro |
| 33 | ~~Cap 50 sans ASR (regle doctrinale stricte)~~ | ~~Haute~~ | Fait (21 avril 2026). `lib/aio-score-engine.ts` passe de 90 a 50. Retire aussi les overrides V2 dans `app/api/diagnostic/scan/route.ts` (`has_asr_file = true` + `is_aya_registered = true`) qui neutralisaient le cap. Teste end-to-end : plombier-geneve.ch → 50, stripe.com → 50, ai-visionary.xyz → 98.8 (ASR reel). Commit f31d1d65 |
| 34 | ~~Masquage concurrents pour ai-visionary.xyz~~ | ~~Haute~~ | Fait (21 avril 2026). `/api/diagnostic/compare` retourne `competitors:[]` quand domaine = ai-visionary. Carte dediee "Vous etes la reference du registre AYA" dans `app/diagnostic/page.tsx`. Cles i18n `compareSelfTitle/compareSelfDesc/compareSubSelf` ajoutees dans FR+EN. Commit f31d1d65 |
| 35 | API DNS Infomaniak — gestion programmatique des records | Decouverte | Fait (25 avril). Endpoint `/1/domain/{domainId}/dns/record` accepte le token Newsletter. Domain ID ai-visionary.xyz = 2128919. Format DKIM specifique : `type:"DKIM", dkim_type:"CNAME"`. Permet de gerer DNS sans UI (tres utile pour eviter les erreurs de saisie). |
| 36 | Deblocage compte Newsletter Infomaniak | Critique | Reponse Infomaniak recue (28 avril) avec 4 questions (sujets/destinataires, sources fichier, branding, preuves opt-in). Reponse honnete envoyee : phase pre-lancement, pas de base opt-in, tests sur adresses internes. Decision : Newsletter ne sera utilisee qu'avec une vraie base opt-in (clients AYA Sub / Pack PRO / inscriptions newsletter avec double opt-in) une fois lancement commercial. Cold marketing aux entites AYA-BOT abandonne. Code aligne (endpoint et template supprimes). En attente confirmation Infomaniak sur procedure de reactivation. |

---

## 8. ANALYSE DES COUTS

> **REGLE ABSOLUE : avant TOUT batch ou operation en volume, TOUJOURS estimer le cout et obtenir l'accord de Cyril.**

### Budget mensuel

| Service | Plan | Budget/mois | Limites |
|---------|------|-------------|---------|
| **Google Cloud (Gemini API)** | Pay-as-you-go | CHF 20.00 | Budget alert a 100% |
| **Supabase** | Free/Pro (org NeousAxis) | Quota plan | Depasse = bloque ou surcharge |
| **Vercel** | Pro | Inclus | maxDuration=120s par fonction |
| **Resend** | Free tier | 0 | 100 emails/jour, 3000/mois (deja remplace par SMTP Infomaniak via nodemailer pour transactionnel) |
| **Infomaniak Public Cloud** | Partenariat gratuit 2 ans | 0 | VPS 4C/8G/160GB + Swiss Backup 200GB + kSuite 3 users + Newsletter 50k/mois |
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
| 7 avril 2026 | Quota Supabase depasse | Rescoring batch V2 : milliers de lectures/ecritures + 4 sessions paralleles | Supabase accorde une exception one-time, grace period jusqu'au **7 mai 2026** (apres : HTTP 402 sur requetes si toujours depasse) |
| 14 avril 2026 | (pas un incident) Correction estimation couts Gemini | Estimations initiales du batch Tranco 156k trop elevees (CHF 140 annonces, reel ~CHF 2.20 avec batching BATCH_SIZE=20 dans `enrich_with_gemini.py`) | Facteur 60x d'erreur — couts scraping negligeables en realite, seul le temps de scraping est contraignant |

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
