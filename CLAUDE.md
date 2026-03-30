# AI VISIONARY — Claude Code Project Guide

> Ce fichier est lu automatiquement par Claude Code. Il contient le contexte essentiel et le plan d'action.
> Pour l'historique complet des sessions et changelogs, voir `MEMORY.md`.
> Pour le plan de remediation original (10 sprints, tous termines), voir `PLAN-ACTION-AYO-COMPLET.md`.
> Derniere mise a jour : 29 mars 2026

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

### Flux principal

```
URL -> Scanner (aio-scanner.ts) -> Score initial (aio-score-engine.ts)
    -> Questions STATIQUES (ENRICHMENT_TEMPLATES) -> LLM extrait JSON (q values)
    -> Score enrichi -> Delta avant/apres -> Email capture -> Stripe Checkout
    -> Webhook -> Genere fichiers -> Email
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
| `main` | Production | FR only, pas encore mis a jour avec i18n |
| `feature/i18n-en-fr` | Testee, PAS mergee | i18n complet FR/EN (Session 10) |
| `feature/chat-bilingual` | En cours, PAS mergee | Chat bilingue + smart skip + threshold 70 |
| `fix/otp-eclore-protection` | Testee, PAS mergee | owner_email + admin section |
| `fix/remediation` | Archivee | Sprints 1-10 (tous termines, merges dans main) |
| `fix/i18n-bilingual` | ARCHIVEE | Tentative i18n echouee du 28 mars, NE PAS UTILISER |

**Workflow** : TOUJOURS travailler sur une branche feature/fix. Ne JAMAIS merger dans `main` sans validation de Cyril.

---

## 4. CONVENTIONS & REGLES

> **TOUTES les regles sont dans `regles.md`** — ce fichier est lu automatiquement par Claude Code.
> Inclut : workflow obligatoire, interdictions, securite, langue, git, style, tests.
> Regle critique : **Plan > Sous-agents > Orchestrateur > Verification INTEGRALE**

---

## 5. PLAN D'ACTION ACTUEL

### Priorite IMMEDIATE

1. **Merger les branches en attente** dans `main` apres validation Cyril : `feature/i18n-en-fr`, `fix/otp-eclore-protection`, `feature/chat-bilingual`
2. **Coherence linguistique des fichiers PRO** : FAQ, glossaire, external_context, ASR doivent etre 100% dans la langue du diagnostic
3. **Croissance registre** : objectif 10k+ entites

### Coherence linguistique fichiers PRO (a corriger)

Les generateurs (`ayo-generators.ts`, `ayo-crypto.ts`, `ayo-semantics.ts`) ont des templates FR hardcodes :
- FAQ questions/reponses sont en francais meme si le diagnostic est en anglais
- Glossaire idem
- `external_context.json` labels en francais
- `cap_reason`, `data_maturity` labels, `meta` fields dans l'ASR sont en francais
- **Solution** : passer la locale aux generateurs et avoir des templates EN/FR

### Fix temporaire en place (29 mars 2026)

En attendant le chantier V4, deux optimisations du questionnaire :
- **Seuil de confiance 85 -> 70** : les donnees scannees avec confidence >= 70 sont auto-validees (q=1, pas de question Yes/No)
- **Smart skip** : `RELATED_FIELD_SKIP_RULES` dans `chat/route.ts` — si services detectes, skip question products (et inversement)
- **Resultat** : ~7 questions redondantes en moins, questionnaire plus fluide
- **Rollback** : remettre le seuil a 85 dans `app/api/chat/route.ts` (chercher `>= 70 ? 1 :`, remettre `>= 85 ? 1 :`)
- **Rollback smart skip** : `RELATED_FIELD_SKIP_RULES = []` desactive instantanement

---

### Chantier AYO V4 — Architecture Evidence-Based (FUTUR MAJEUR)

> Complexite : CRITIQUE. Duree : 2-3 semaines. Cyril DOIT etre present.
> Pre-requis : i18n stable (fait), lifecycle stable (fait), 10k+ entites (en cours).

#### Probleme actuel

AYO fonctionne sur du **declaratif** : "Avez-vous des certifications ?" -> "Oui" -> q=0.5. Aucune preuve. Les IA ne peuvent pas recouper ces declarations.

#### Vision cible

AYO doit fonctionner sur des **preuves verifiables** :

| Actuel (declaratif) | Cible (evidence-based) |
|---------------------|----------------------|
| "Avez-vous une FAQ ?" -> Oui/Non | Le scan detecte la FAQ -> q=1 automatique |
| "Quels sont vos services ?" -> texte libre | Le scan extrait les services -> lien de confirmation |
| "Certifications ?" -> Oui/Non | "URL de votre page certifications ?" -> verifie auto |
| q=0.5 pour tout "Oui" | q=1 si preuve fournie, q=0.5 si declaration seule |
| 15-20 questions | 5-8 questions ciblees (preuve uniquement) |

#### Principe fondamental

**Lisibilite = Recommandabilite**. Pour qu'une IA recommande une entreprise SANS halluciner, elle a besoin de :
1. Des donnees structurees (ASR) — deja fait
2. Des preuves recoupables (URLs, certifications verifiables, avis publics) — pas encore
3. De la coherence entre la declaration et la realite observable — pas encore verifie

#### Architecture technique V4

**2 nouveaux modules a creer :**

##### 1. Site Classifier (`lib/site-classifier.ts`)

Analyse le scan result et classifie le type de site :
- `e-commerce` : produits, panier, prix detectes
- `saas` : app, login, API, pricing detectes
- `corporate` : equipe, a-propos, bureaux
- `freelance` : portfolio, 1 personne, services
- `association` : non-profit, membres, mission
- `media` : articles, blog, redaction
- `government` : .gov, services publics

Le type de site determine QUELLES questions poser et LESQUELLES sont pertinentes.

##### 2. Question Engine (`lib/question-engine.ts`)

Remplace les ENRICHMENT_TEMPLATES actuels par un systeme intelligent :

```typescript
// Structure
interface QuestionSet {
  type: SiteType;                    // e-commerce, saas, corporate, etc.
  questions: EvidenceQuestion[];
}

interface EvidenceQuestion {
  field: string;                     // champ AIO cible
  askOnlyIf: (scan: ScanResult) => boolean;  // condition pour poser la question
  question_fr: string;
  question_en: string;
  evidenceType: 'url' | 'text' | 'confirmation';
  qValueIfEvidence: number;          // 1.0 si preuve fournie
  qValueIfDeclaration: number;       // 0.5 si juste "oui"
}
```

**Logique `askOnlyIfMissing`** : La question n'est posee QUE si le scan n'a pas deja detecte la donnee avec une confidence suffisante. Si le scan a trouve l'info -> q=1 automatique, pas de question.

##### Ordre du pipeline V4

```
1. Scan (aio-scanner.ts) -> ScanResult
2. Classification (site-classifier.ts) -> SiteType
3. Detection automatique -> q=1 pour tout ce qui est deja detecte
4. Questions ciblees (question-engine.ts) -> seulement ce qui manque
5. Extraction LLM -> JSON structure avec q values
6. Scoring (aio-score-engine.ts) -> Score final
7. Generation ASR -> Fichiers avec preuves integrees
```

##### QUESTION_SETS_BY_TYPE (exemples)

**E-commerce** : questions sur catalogues, methodes de paiement, politique retour, certifications e-commerce
**SaaS** : questions sur API, documentation, uptime/SLA, integrations
**Corporate** : questions sur equipe, processus, certifications ISO
**Freelance** : questions sur portfolio, references, methodologie
**Association** : questions sur mission, membres, transparence financiere

#### Impact technique

| Fichier | Modification |
|---------|-------------|
| `lib/site-classifier.ts` | CREER — classification du type de site |
| `lib/question-engine.ts` | CREER — moteur de questions evidence-based |
| `lib/agents/greffier.ts` | Reecrire les ENRICHMENT_TEMPLATES pour preuves |
| `app/api/chat/route.ts` | Refondre la logique de queue (validation/enrichment -> evidence) |
| `lib/aio-score-engine.ts` | Ajouter score de confiance base sur preuves |
| `lib/aio-scanner.ts` | Enrichir le scan pour verifier URLs de preuve |
| `lib/ayo-system-prompt.ts` | Adapter le prompt pour le mode evidence-based |

#### Dependances

- Les fichiers PRO (5 fichiers ASR) dependent des donnees extraites
- Les emails dependent des scores
- Le registre AYA depend du scoring
- Les pages certificat affichent les donnees extraites

#### Risques

- Changer le questionnaire = changer le coeur du produit
- Le scoring doit rester coherent avec les entites deja certifiees
- Les clients existants ne doivent pas voir leur score baisser
- La transition doit etre progressive (pas de big bang)

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
- Flux complet AYO : URL -> scan -> questions statiques -> score strict -> paiement Stripe -> fichiers -> email (bilingue)
- Stripe Checkout live (CHF, 2 offres : AYA 19 CHF/mois, PRO 499 CHF)
- Registre AYA public : ~4400+ entites, pagination serveur, badges certifie/indexe, recherche, tri
- API AYA : 7 endpoints (index, llm, docs, search, entity, stats, live) + `?lang=fr|en`
- Bot AYA : 6766 domaines pipeline, enrichissement Gemini 100% (descriptions EN+FR, keywords EN+FR)
- Generation et envoi des 5 fichiers PRO en ZIP (emails bilingues)
- Signature Ed25519 des ASR (cle rotee, env var)
- Supabase PostgreSQL (migration depuis Firestore terminee)
- Questions statiques (ENRICHMENT_TEMPLATES), scoring strict (cap 78)
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
| 1 | Merger branches en attente dans `main` (validation Cyril) | Immediat | En attente |
| 2 | Coherence linguistique fichiers PRO (FAQ/glossaire/ASR en langue du site) | Immediat | A faire |
| 3 | Scraping 10k+ entites + registres du commerce | Critique | En cours |
| 4 | Campagne email entreprises indexees | Haute | A faire |
| 5 | Chantier AYO V4 Evidence-Based | Haute (futur) | A planifier |
| 6 | Re-exporter GitHub/HuggingFace apres chaque batch | Continue | Automatise |
| 7 | Soumission There's An AI For That | Moyenne | Cyril |
| 8 | Mots-cles intelligents AYO (sous-agent post-questionnaire) | Future | Idee |
| 9 | Dashboard client (espace personnel OTP) | Future | Idee |

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

1. `app/api/chat/route.ts` — Coeur du chatbot (~2800 lignes)
2. `lib/aio-score-engine.ts` — Moteur de scoring
3. `app/api/webhooks/checkout-success/route.ts` — Webhook Stripe
4. `lib/agents/greffier.ts` — Templates de questions statiques
5. `lib/ayo-generators.ts` — Generateurs des 5 fichiers PRO

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
