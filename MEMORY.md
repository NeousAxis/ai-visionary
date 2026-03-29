# AI VISIONARY — MEMORY.md (Historique complet du projet)

> Ce fichier contient l'historique COMPLET du projet AI Visionary.
> Il est auto-suffisant : toute personne lisant ce fichier comprendra l'intégralite de l'histoire du projet.
> Derniere mise a jour : 29 mars 2026

---

## TABLE DES MATIERES

1. [Historique des Sessions](#1-historique-des-sessions)
2. [Bugs Corriges](#2-bugs-corriges)
3. [Failles de Securite](#3-failles-de-securite)
4. [Erreurs et Lecons Apprises](#4-erreurs-et-lecons-apprises)
5. [Changelog Complet](#5-changelog-complet)
6. [Architecture Actuelle (Etat technique)](#6-architecture-actuelle-etat-technique)
7. [Fonctionnalites Detaillees](#7-fonctionnalites-detaillees)
8. [Bot AYA](#8-bot-aya)
9. [Session Signal LLM](#9-session-signal-llm)
10. [Session Mise a Jour Client](#10-session-mise-a-jour-client)
11. [Strategie Commerciale](#11-strategie-commerciale)
12. [Intelligence du Systeme](#12-intelligence-du-systeme)

---

## 1. HISTORIQUE DES SESSIONS

### Contexte

AI Visionary est une startup basee a Geneve, Suisse, fondee par Cyril Leger. Le produit principal est AYO (AI Your Org) -- un chatbot IA qui diagnostique la lisibilite IA d'un site web via un score appele AIO (AI-readability Intelligence Optimization), de 0 a 100.

Le travail a ete organise en 10 sprints, regroupes en sessions de travail Claude Code de 2-3h chacune. Un plan de remediation complet (`PLAN-ACTION-AYO-COMPLET.md`, 20 sections, ~1460 lignes) a guide tout le travail.

### Avant mars 2026 (par Cyril + Claude)

- Creation de `lib/auth.ts`, `lib/logger.ts`, `lib/rate-limit.ts`, `lib/validators.ts`, `lib/sanitize.ts`
- Fix de la verification webhook Stripe (suppression fallback)
- Fix des placeholders LLM dans les fichiers generes
- Fix du sanitizer recursif
- Fix de l'affichage du registre AYA (entreprises fictives supprimees, seulement les payantes)

### Mars 2026 -- Session de planification

1. Audit complet de ~100 fichiers du projet
2. Creation du plan de remediation `PLAN-ACTION-AYO-COMPLET.md` (20 sections, 10 sprints)
3. Nettoyage Git : fusion `restore-vercel-24jan` -> `main`, force-push
4. Mise a jour `.gitignore` (secrets, debug scripts, .claude/)
5. Suppression de 17 scripts de debug du tracking Git
6. Creation de la branche `fix/remediation`
7. Creation du fichier `CLAUDE.md`

---

### Session 1 -- Logger + Dashboard Admin

| Detail | Valeur |
|--------|--------|
| **Date** | 14 mars 2026 |
| **Sprint** | Sprint 1 |
| **Branche** | `fix/remediation` |
| **Risque** | Zero (fichiers nouveaux uniquement) |
| **Cyril requis** | Non |
| **Duree estimee** | ~2h |

**Ce qui a ete fait** :
- Logger/rate-limit/validators/auth integres dans les 11 routes API
- Build OK

---

### Session 2 -- Failles critiques

| Detail | Valeur |
|--------|--------|
| **Date** | 14 mars 2026 |
| **Sprint** | Sprint 2 |
| **Branche** | `fix/remediation` |
| **Risque** | Faible |
| **Cyril requis** | Non |
| **Duree estimee** | ~2h |

**Ce qui a ete fait** :
- C1+C2 critiques corrigees (token session, price IDs)
- H1-H3 hautes corrigees (erreurs exposees, ignoreBuildErrors, anti-SSRF)
- M1+M2+M6 moyennes corrigees (CSP header, email clair Stripe, robots.ts)
- `ignoreBuildErrors: false` dans next.config.ts
- Anti-SSRF dans le scanner

**Actions requises apres session** :
- AJOUTER env vars sur Vercel : `SESSION_SECRET`, `STRIPE_PRICE_PRO`
- Pack "Essential" supprime (n'existait plus)

---

### Session 3 -- Failles hautes + moyennes

| Detail | Valeur |
|--------|--------|
| **Date** | 15 mars 2026 |
| **Sprints** | Sprint 3 + Sprint 4 |
| **Branche** | `fix/remediation` |
| **Risque** | Faible |
| **Cyril requis** | Non |
| **Duree estimee** | ~4h |

**Ce qui a ete fait** :
- H9 : Double webhook fix -- `PaymentHandler.tsx` neutralise
- H10 : JSON validation dans `ayo-semantics.ts`
- H11 : Timeout 30s dans `ayo-semantics.ts`
- M4 : Scanner utilise `aya_registry` au lieu de `analyses`
- M5 : Fake rating 4.5 supprime de `external-context.ts`
- M8 : `session_id` Stripe valide dans `PaymentSuccessModal`
- B2 : Dead code `checkout-success-fix.ts` supprime
- B4 : Doublon page certificat supprime (`app/certificate/[id]/page.tsx`)
- B6 : Env var unique pour Gemini API key
- Renommage "Essential" -> "Plateforme"
- Scripts debug supprimes
- `tsconfig` exclude `scripts/`
- Vercel deploy OK

---

### Session 4 -- REWRITE QUESTIONNAIRE (Session critique)

| Detail | Valeur |
|--------|--------|
| **Date** | 19-23 mars 2026 |
| **Sprint** | Sprint 5 |
| **Branche** | `fix/remediation` |
| **Risque** | CRITIQUE -- coeur du produit |
| **Cyril requis** | OUI (fait avec Cyril) |
| **Duree estimee** | ~8h |

**Ce qui a ete fait** :
- Rewrite complet du questionnaire : questions statiques (`ENRICHMENT_TEMPLATES`)
- Migration Firestore -> Supabase
- Scoring strict (cap 78 sans preuves externes)
- Sanitizers fichiers :
  - Filtrage contamination formulaire ("Possedez-vous..." supprime)
  - Filtrage marketing ("Plombier urgence Lyon" comme documentation)
  - Filtrage "Etc." de tous les tableaux
  - Nettoyage MAJUSCULES, numerotation parasite, guillemets echappes
- Suppression des questions de preuve (boucle infinie corrigee)
- Fix multi-select + Autre
- ~400 lignes dead code supprimees (`/simplify`)

**Bugs corriges dans cette session** :
- LLM forcait q=1 sur reponses vagues -> scoring strict (q=0.5 max pour "oui" brut)
- Hard cap invisible (blocs=95 total=50) -> cap a 78, affiche
- Questions LLM aleatoires/incoherentes -> questions statiques
- Email non sauve en top-level -> extraction contact_email -> colonne email
- Boucle infinie questions preuve -> questions preuve supprimees
- "Plombier urgence Lyon" comme documentation -> scanner filtre exemples marketing

---

### Session 5 -- Fix webhook + Bug Score 0

| Detail | Valeur |
|--------|--------|
| **Date** | 15 mars 2026 |
| **Sprint** | Sprint 6 |
| **Branche** | `fix/remediation` |
| **Risque** | Moyen |
| **Cyril requis** | Non |
| **Duree estimee** | ~3h |

**Ce qui a ete fait** :
- `PaymentSuccessModal` : stop calling webhook from browser (UX fix -- users saw false "erreur technique")
- Webhook : refuse empty generation, send apology email + return 422
- `Light-report` : remove fake block scores
- `create-checkout` : include `analysisId` in `client_reference_id`
- Score 0 dans l'email webhook -> donnees persistees progressivement dans Supabase
- Double appel webhook -> PaymentHandler neutralise (Session 3)

---

### Session 6 -- Modules semantiques

| Detail | Valeur |
|--------|--------|
| **Date** | 24 mars 2026 |
| **Sprint** | Sprint 7 |
| **Branche** | `fix/remediation` |
| **Risque** | Moyen |
| **Cyril requis** | Non |
| **Duree estimee** | ~3h |

**Ce qui a ete fait** :
- Modules semantiques -- sanitizers fichiers PRO, ayo-semantics, external-context DEJA FAITS
- **Decision critique** : NE PLUS TOUCHER AU PACK PRO NI A AYO apres cette session

---

### Session 7 -- Formulaire MAJ client + Cycle de vie

| Detail | Valeur |
|--------|--------|
| **Date** | 27 mars 2026 |
| **Sprint** | Sprint 8 |
| **Branche** | `main` |
| **Risque** | Moyen |
| **Cyril requis** | Non |

**Ce qui a ete fait** :
- Formulaire MAJ 7 blocs + OTP gate
- Email PRO (ZIP fichiers) + email AYA (confirmation)
- Boutons "Mettre a jour" / "Renouveler" sur certificats
- Disclaimer INDEXE sur pages entites bot
- Filtre NSFW registre (porn, sex, xxx, escort, onlyfans, listes Python, templates)
- `cleanDisplayName()` -- emojis, japonais, listes Python, templates
- StatsBar 0->4400+ animation immediate
- Page `/renew` + RenewButtons (POST create-checkout)
- Recalcul blocs AIO depuis fields quand blocks={}
- `buildAyaSubEmailHtml` dedie (score + blocs + certificat AYA, sans contenu PRO)
- `existingAyaEntityId` passe au registry (update au lieu de creer)
- PRO + AYA sub confirmes en test

---

### Session 8 -- SEO/Legal

| Detail | Valeur |
|--------|--------|
| **Date** | 25 mars 2026 |
| **Sprints** | Sprint 9 + Sprint 10 |
| **Branche** | non precise |
| **Risque** | Faible |
| **Cyril requis** | Non |

**Ce qui a ete fait** :
- SEO metadata 8 pages + `generateMetadata` dynamique certificats
- Sitemap dynamique Supabase (3339+ URLs)
- Confidentialite LPD/RGPD 13 sections
- Mentions legales 10 sections
- robots.ts mis a jour (Disallow /admin/, /api/, /debug/, /certificate/)

---

### Bot AYA -- Session scraping (24 mars 2026)

**Ce qui a ete fait** :
- ~3300+ entites dans Supabase (6766 domaines dans domains.txt)
- API compacte LLM-friendly
- Keywords Gemini
- OpenAPI spec + ai-plugin.json
- Fix certificat (INDEXE au lieu d'EXPIRE, date epoch, keywords)
- README GitHub rewrite "AYA inside"
- Page /developers

---

### Signal LLM -- Session enrichissement (25 mars 2026)

**Ce qui a ete fait** :
- 4 chantiers Signal LLM :
  1. Endpoint `/api/aya/llm/{domain}` -- 5 champs ultra-simples
  2. Texte brut certificats -- 2-4 phrases crawlables
  3. Export GitHub dataset -- 3306 fichiers JSON publics
  4. Domination Web3/AI -- 426 domaines curates
- Enrichissement Gemini 3339/3339 (EN+FR)
- Filtre garbage 120 termes
- 57 noms mojibake fixes
- 3 entites supprimees (jarir.com, porn.com, gorillas.io)
- Trigger Supabase droppe
- GitHub dataset public (3306 fichiers)
- HuggingFace re-exporte
- Mots-cles Gemini 3338/3339 (fix_keywords.py)
- Pagination serveur /aya (20/page, URL-based)
- Cache CDN 4 routes API
- BackButton certificats
- `AyaRegistryClient.tsx` composant client

---

### Session 9 -- Securite proprietaire (28 mars 2026)

**Branche** : `fix/otp-eclore-protection`

**Ce qui a ete fait** :
- Systeme `owner_email` : OTP n'accepte QUE l'email Stripe du payeur
- Plus de domain matching ni fallback contact_email
- Section admin compte (Nom/Prenom/Email Pro avec validation domaine)
- Endpoint delegation `POST /api/update-owner-email`
- Protection bot (`push_to_aya.py` skip `payment_completed=true`)
- Fix Eclore (description originale restauree + contact_email corrige)
- Exports GitHub (4435 JSON) + HuggingFace (4436 entites) re-generes

---

### Session 10 -- i18n FR/EN complet (29 mars 2026)

**Branche** : `feature/i18n-en-fr` (en attente de merge dans main)

**Ce qui a ete fait** :

#### i18n complet FR/EN
- `next-intl` avec cookie `NEXT_LOCALE` + `messages/fr.json` + `messages/en.json` (labels UI)
- Toggle FR/EN dans le header de toutes les pages
- Chatbot AYO bilingue : system prompt, questions statiques, scoring, reponses
- Emails bilingues : templates PRO (ZIP + certificat), AYA sub (confirmation), Light report
- Form config bilingue : `lib/update-form-config.ts` avec labels/hints/options EN+FR
- API LLM `?lang=fr|en` : descriptions + keywords localises
- Pages certificat : descriptions Gemini FR/EN, keywords FR/EN, pays FR/EN, labels UI FR/EN
- Page `/developers` : rewrite complet (stats dynamiques, supprime "9 Connected AIs", ajoute attraction systemique + docs GitHub/HuggingFace)

#### Translation agents (scripts Python)
- `aya/translate_certified.py` : traduction fidele des descriptions certifiees (pas de reecriture)
- `aya/keyword_dictionary.py` : dictionnaire 16558 termes anglais->francais (batch lookup)
- `aya/enrich_keywords_fr.py` : enrichissement keywords FR via Gemini (toutes entites)
- `aya/run_keywords_fr_until_done.py` : boucle jusqu'a 100% de couverture keywords FR
- Resultat : 100% des entites ont `gemini_keywords_fr`

#### Bot scores capped at 50
- `aya/generator.py` : hard cap score 50 pour entites bot (pas de JSON-LD ni AYA)
- `aya/fix_bot_scores.py` : script one-shot pour corriger les 1849 entites existantes
- Coherent avec la logique AIO : sans JSON-LD structure -> score max 50

#### Autres changements
- Supprime `public/.well-known/ai-plugin.json` + `public/.well-known/openapi.json` (strategie GPT Store abandonnee)
- README rewrite : positionnement souverain et independant
- Lifecycle renew : si pack actif -> message informatif + boutons caches, pas de downgrade PRO->AYA
- Security : OTP MODE 1 utilise `owner_email` uniquement, `update-token.ts` supprime fallback ADMIN_SECRET
- Simplify : `extractEntityFields()` helper partage, `addArticle()` bug fix, dead code `dirtyFields` removed
- Exports re-generes : GitHub (4435 fichiers) + HuggingFace (4436 entites)

#### Donnees dans Supabase -- Etat final

| Champ | Path | Couverture |
|-------|------|-----------|
| Description EN | `asr_payload.enrichment.gemini_description` | 100% |
| Description FR | `asr_payload.enrichment.gemini_description_fr` | 100% |
| Keywords EN | `asr_payload.enrichment.gemini_keywords` | 100% |
| Keywords FR | `asr_payload.enrichment.gemini_keywords_fr` | 100% |

---

## 2. BUGS CORRIGES

### Bugs majeurs corriges Session 4 (19-23 mars 2026)

| Bug | Correction |
|-----|-----------|
| LLM force q=1 sur reponses vagues | Scoring strict : "oui" brut = q=0.5 max |
| Hard cap invisible (blocs=95 total=50) | Cap a 78 sans preuves externes, affiche |
| Score 0 dans l'email webhook | Donnees persistees progressivement dans Supabase |
| Double appel webhook | PaymentHandler neutralise (Session 3) |
| Questions LLM aleatoires/incoherentes | Questions statiques (ENRICHMENT_TEMPLATES) |
| Email non sauve en top-level Supabase | Extraction contact_email -> colonne email |
| Boucle infinie questions preuve | Questions preuve supprimees |
| "Plombier urgence Lyon" comme documentation | Scanner filtre les exemples marketing |

### Bugs corriges Session 3 (15 mars 2026)

| Bug | Correction |
|-----|-----------|
| Double appel webhook (H9) | PaymentHandler neutralise, seul PaymentSuccessModal appelle |
| Gemini API sans validation JSON (H10) | Validation JSON ajoutee dans ayo-semantics.ts |
| Gemini API sans timeout (H11) | Timeout 30s ajoute |
| Scanner verifie mauvaise collection (M4) | Corrige pour utiliser `aya_registry` |
| Fake rating 4.5 (M5) | Supprime de external-context.ts |
| session_id non valide (M8) | Validation ajoutee dans PaymentSuccessModal |

### Bugs corriges Session 7 (27 mars 2026)

| Bug | Correction |
|-----|-----------|
| Score baisse de 77->63 sans modification | Formulaire envoyait TOUS les champs -> comparaison valeur initiale vs actuelle |
| Score baisse de 77->76 | Cles scan en camelCase non lues -> support double format |
| Liens documents disparaissent | Champs URL pas pre-remplis -> pre-remplissage depuis website |
| Champs URL modifiables par defaut | Type `url_locked` : grise par defaut, bouton crayon pour deverrouiller |
| Acces non authentifie au formulaire | OTP Gate : verification email avant acces |
| Erreur "mise a jour en base" | Colonnes inexistantes supprimees de la requete update |

### Bugs corriges Session 9 (28 mars 2026)

| Bug | Correction |
|-----|-----------|
| OTP acceptait domain matching | OTP n'accepte QUE owner_email (email Stripe payeur) |
| Bot ecrasait donnees clients payants | push_to_aya.py skip payment_completed=true |
| Eclore description ecrasee 3 fois | Description originale restauree + contact_email corrige |

### Bugs corriges Session 10 (29 mars 2026)

| Bug | Correction |
|-----|-----------|
| Questions redundantes (ex: produits quand services detectes) | Smart skip via RELATED_FIELD_SKIP_RULES |
| Seuil de confiance trop eleve (85) | Abaisse a 70 -- donnees scannees avec confidence >= 70 auto-validees |
| Strategie GPT Store non pertinente | ai-plugin.json + openapi.json supprimes |
| Downgrade PRO->AYA possible | Si pack actif -> message informatif + boutons caches |
| update-token.ts fallback ADMIN_SECRET | Fallback supprime |

### Bugs corriges Signal LLM (25 mars 2026)

| Bug | Correction |
|-----|-----------|
| 57 noms mojibake (arabe, chinois, japonais, russe, grec) | Corriges vers noms latins connus |
| 3 entites problematiques | Supprimees (jarir.com, porn.com, gorillas.io) |
| Mots garbage comme services (api, app, cloud) | Filtre garbage ~120 termes dans llm-format.ts |
| Page /aya chargeait TOUTES les entites (3000+) | Pagination serveur 20/page URL-based |
| getAyaEntityByUrl() O(n) | Requete SQL ilike directement O(1) |

### Qualite fichiers ASR -- 15 bugs corriges (Session 4)

| Bug | Correction |
|-----|-----------|
| Parentheses non fermees | `fixUnmatchedBrackets()` |
| Troncature audience en plein mot | `truncateOnSeparator()` coupe sur virgule |
| `__SKIPPED__` dans les donnees | `cleanSkippedValues()` remplace par false/omet |
| Intents non splittes | `toArray()` ne coupe plus sur `?` |
| `platform_types` derive de frameworks | Derive de `delivery_mode` |
| Double slash URLs | Normalisation dans manifest |
| `legalName` vide | Champ omis de l'ASR |
| `key_indicators` sans chiffre | Suffixe `: non declare` |
| Score cap invisible | `meta.raw_score`, `cap_applied`, `cap_reason` ajoutes |
| `contextualRelevance` vide | Rempli avec use_cases (high) + services (medium) |
| `compliance.gdpr` vide | Deduit des policies |
| FAQ audience repetitive | Audience mentionnee uniquement dans questions pertinentes |
| Glossaire repetitif | 1 entree "Public cible" au lieu de 10 segments individuels |
| `geographies_served` sans note | Note ajoutee si service en ligne |
| additionalType manquant | Ajoute dans identity avec fixUnmatchedBrackets |

---

## 3. FAILLES DE SECURITE

### Les 23 failles originales et leur statut

#### Critiques (2)

| ID | Faille | Statut | Correction |
|----|--------|--------|-----------|
| C1 | Token session base sur ADMIN_SECRET (fallback) | CORRIGE (Session 2) | SESSION_SECRET env var dedie |
| C2 | Price IDs hardcodes dans create-checkout | CORRIGE (Session 2) | Deplaces vers env vars |

#### Hautes (11)

| ID | Faille | Statut | Correction |
|----|--------|--------|-----------|
| H1 | Erreurs internes exposees au client | CORRIGE (Session 2) | Messages generiques cote client |
| H2 | `ignoreBuildErrors: true` dans next.config | CORRIGE (Session 2) | Mis a `false` |
| H3 | Pas d'anti-SSRF dans le scanner | CORRIGE (Session 2) | `isAllowedUrl()` applique |
| H4 | Rate limiting cree mais non applique | CORRIGE (Session 1) | Integre dans les 11 routes API |
| H5 | Endpoints debug non proteges | CORRIGE (Session 2) | `requireAdmin()` ajoute |
| H6 | Validation Zod creee mais non appliquee | CORRIGE (Session 1) | Integre dans les routes |
| H7 | Stripe Portal SANS auth | RESTE | `stripe/portal/route.ts` -- toujours sans authentification |
| H8 | Markdown non-sanitise dans AyoChat (XSS) | RESTE | AyoChat.tsx -- risque XSS |
| H9 | PaymentHandler + PaymentSuccessModal dupliquent l'appel | CORRIGE (Session 3) | PaymentHandler neutralise |
| H10 | Gemini API sans validation JSON | CORRIGE (Session 3) | Validation ajoutee dans ayo-semantics.ts |
| H11 | Gemini API sans timeout | CORRIGE (Session 3) | Timeout 30s ajoute |

#### Moyennes (8)

| ID | Faille | Statut | Correction |
|----|--------|--------|-----------|
| M1 | Pas de CSP header | CORRIGE (Session 2) | CSP header dans next.config.ts |
| M2 | Email en clair dans Stripe metadata | CORRIGE (Session 2) | -- |
| M3 | `dangerouslySetInnerHTML` dans layout | RESTE | -- |
| M4 | Scanner verifie mauvaise collection | CORRIGE (Session 3) | Utilise `aya_registry` |
| M5 | external-context fake rating 4.5 | CORRIGE (Session 3) | Supprime |
| M6 | robots.txt n'exclut pas /admin/ ni /api/ | CORRIGE (Session 2) | Disallow ajoutes |
| M7 | vercel.json maxDuration peut etre court | CORRIGE | maxDuration=120s |
| M8 | session_id Stripe non valide | CORRIGE (Session 3) | Validation ajoutee |

#### Basses (6)

| ID | Faille | Statut | Correction |
|----|--------|--------|-----------|
| B1 | Index Firestore manquants | OBSOLETE | Migration Supabase |
| B2 | Code mort (checkout-success-fix.ts) | CORRIGE (Session 3) | Fichier supprime |
| B3 | `@ts-ignore` x22 | CORRIGE (Session 4) | 17 -> @ts-expect-error puis 15 supprimes |
| B4 | Doublon page certificat | CORRIGE (Session 3) | app/certificate/[id] supprime |
| B5 | Types `any[]` dans AyoChat | RESTE | -- |
| B6 | 2 variables env pour Gemini API key | CORRIGE (Session 3) | GEMINI_API_KEY unique |

### Failles encore ouvertes (au 29 mars 2026)

| ID | Faille | Risque |
|----|--------|--------|
| H7 | Stripe Portal SANS authentification | Haute |
| H8 | Markdown non-sanitise dans AyoChat (XSS) | Haute |
| M3 | `dangerouslySetInnerHTML` dans layout | Moyenne |
| B5 | Types `any[]` dans AyoChat | Basse |

---

## 4. ERREURS ET LECONS APPRISES

### 4.1 Tentative i18n echouee (28 mars 2026)

**Branche** : `fix/i18n-bilingual` -- ARCHIVEE, NE PAS MERGER

La premiere tentative d'internationalisation le 28 mars a echoue. La branche `fix/i18n-bilingual` a ete archivee. La session du 29 mars a reussi sur une nouvelle branche `feature/i18n-en-fr` avec une approche differente (`next-intl` + cookie `NEXT_LOCALE`).

**Lecon** : Toujours creer une nouvelle branche propre plutot que de tenter de recuperer une branche cassee.

### 4.2 Eclore -- Description ecrasee 3 fois

L'entite "Eclore" (client payant certifie) a eu sa description ecrasee par le bot AYA a plusieurs reprises. La description originale a du etre restauree manuellement, et le `contact_email` corrige.

**Corrections appliquees** (Session 9) :
- `push_to_aya.py` skip desormais les entites avec `payment_completed=true`
- Guard dans `update-entity` : `owner_email` ne peut pas etre modifie via le formulaire general
- Description originale restauree manuellement

**Lecon** : Le bot automatise ne doit JAMAIS ecraser les donnees de clients payants. Toujours verifier `payment_completed` avant update.

### 4.3 OTP -- Faille domain matching

**Probleme initial** : Le systeme OTP acceptait des emails par domain matching (n'importe quel email @mondomaine.com pouvait acceder aux donnees de mondomaine.com). Pire, il y avait un fallback sur `contact_email` du scan.

**Corrections appliquees** (Session 9) :
- OTP n'accepte QUE `owner_email` (l'email Stripe du payeur)
- Plus de domain matching
- Plus de fallback contact_email
- Endpoint `/api/update-owner-email` pour delegation d'acces

**Lecon** : L'authentification doit etre stricte. Domain matching = faille critique.

### 4.4 Bot ecrasant les donnees clients payants

**Probleme** : `push_to_aya.py` mettait a jour TOUTES les entites dans Supabase, y compris celles des clients payants. Resultat : scores, descriptions, et contact_email ecrases par les donnees du scraper bot (souvent de moindre qualite).

**Correction** : `push_to_aya.py` verifie desormais `payment_completed` et skip les entites payantes.

**Lecon** : Toujours proteger les donnees clients payants des processus automatises.

### 4.5 Violations de workflow

**Memoire `feedback_workflow_obligation.md`** :
> OBLIGATION : Plan > Sous-agents > Orchestrateur. Ne jamais coder sans planifier d'abord.

**Memoire `feedback_never_say_done.md`** :
> Ne JAMAIS dire "ca fonctionne" sans avoir teste et verifie soi-meme. Pression != excuse pour skip le process.

**Memoire `feedback_scan_before_talking.md`** :
> Scanner git log AVANT de parler d'avancement ou de plan. Ne jamais presenter un etat sans verification prealable.

**Memoire `feedback_pipeline_bot.md`** :
> Registres du commerce (Zefix/Sirene/Companies House) = meme chantier que le scraping bot AYA, ne jamais separer.

### 4.6 Stripe en mode test

**Memoire `project_stripe_mode.md`** :
> Stripe en mode test jusqu'a validation complete du site (ne jamais passer en prod sans accord Cyril).

Note : Au 29 mars 2026, Stripe est en mode LIVE (CHF).

### 4.7 Regles NE JAMAIS FAIRE

Ces regles ont ete etablies suite a des erreurs passees :

- Modifier le CSS/design sans accord de Cyril
- Generer des questions via LLM (utiliser templates statiques)
- Dire "c'est fait" sans test E2E verifie sur le site live
- Pusher sur main sans accord explicite
- Demander des preuves/URLs dans le questionnaire
- Travailler directement sur `main` -- TOUJOURS sur une branche feature/fix
- Declarer "c'est corrige" sans verifier visuellement sur le site live
- Modifier `buildPlainTextDescription` ou la page certificat sans tester 3 entites : 1 certifiee FR, 1 bot anglophone, 1 bot francophone
- Utiliser `vercel --prod` sans verifier avec `vercel alias set` que `ai-visionary.com` pointe sur le bon deploiement

---

## 5. CHANGELOG COMPLET

### Changelog -- Branche `fix/remediation` (19 mars 2026)

#### Securite (Critique)
- Endpoint debug `/api/debug/test-ayo` protege avec `requireAdmin()` (etait ouvert sans auth)
- Fuite cle API Gemini supprimee -- `console.log` exposant les 5 premiers caracteres de la cle retire (`app/api/chat/route.ts:130`)
- Liens Stripe TEST -> env vars -- `STRIPE_LINK_PRO` et `STRIPE_LINK_AYA_SUB` remplacent les URLs hardcodees dans `lib/agents/vendeur.ts` et `lib/ayo-system-prompt.ts`
- Stripe Price IDs retires de `.env.example` -- les valeurs reelles ne sont plus commitees
- Resend API -- initialisation conditionnelle (`null` si pas de cle) au lieu du placeholder `re_build_placeholder`

#### Qualite code
- 17 `@ts-ignore` -> `@ts-expect-error` puis suppression des 15 directives devenues inutiles
- 47 erreurs `react/no-unescaped-entities` corrigees (apostrophes FR -> `&apos;`)
- 71 warnings `no-unused-vars` corriges (imports supprimes, params callback prefixes `_`)
- Config ESLint mise a jour avec `argsIgnorePattern: "^_"`
- 3 `catch {}` vides remplaces par `catch (e) { console.warn(...) }` dans `test-ayo/route.ts`

#### Nettoyage dead code (/simplify)
- Supprime : `_portalUrl` + bloc Stripe Portal inutilise (~30 lignes), `_messageText`, `_detectedValueForValidation`, `_jsonStringContent` (hot-path JSON.stringify inutile)
- Supprime : `_activeBlock`, `_currentQIndex` (useState causant des re-renders inutiles), `_submitMultipleSelection` (fonction morte)
- Supprime : `_hasJsonLd` (architecte.ts), `_services` (ayo-generators.ts), `_ayaLink` (checkout-success)

#### Organisation
- 9 scripts deplaces de la racine vers `/scripts/`
- `ENTREPRISES_FACTICES_A_SUPPRIMER.json` (291 Ko) supprime
- `.gitignore` corrige -- patterns prefixes `/` pour ne s'appliquer qu'a la racine

#### Questionnaire AYO (fix UX critique)
- Questions de validation -- statique Oui/Non sans LLM pour les donnees scannees (lowConfidence)
- Validateur post-LLM -- `validateQuestionBlock()` force min 2 options, max 1 question par message
- Queues separees -- `validationQueue` (statique) vs `enrichmentQueue` (LLM)
- `buildValidationQuestion()` -- genere des questions structurees avec labels humains par bloc/champ
- `BLOCK_LABELS` / `FIELD_LABELS` -- constantes module-level partagees
- AyoChat.tsx -- `isValidationQuestion` unifie, skip/multi-select desactives sur validations

#### Qualite fichiers ASR (15 bugs corriges)
- Parentheses non fermees -- `fixUnmatchedBrackets()` ferme `(`, `[`, `{` ouverts
- Troncature audience -- `truncateOnSeparator()` coupe sur virgule, plus en plein mot
- `__SKIPPED__` filtre -- `cleanSkippedValues()` remplace par `false` (booleens) ou omet (strings)
- Intents non splittes -- `toArray()` ne coupe plus les questions contenant `?`
- `platform_types` -- derive de `delivery_mode` (plus de confusion avec `frameworks`)
- Double slash URLs -- normalisation dans manifest
- `legalName` vide -> champ omis de l'ASR
- `key_indicators` sans chiffre -> suffixe `: non declare`
- Score cap transparent -- `meta.raw_score`, `cap_applied`, `cap_reason` ajoutes dans l'ASR
- `contextualRelevance` -- rempli avec use_cases (high) + services (medium)
- `compliance.gdpr` -- deduit des policies (`"declared"` si privacy/confidentialite detecte)
- FAQ -- audience mentionnee uniquement dans les questions pertinentes
- Glossaire -- 1 entree "Public cible" au lieu de 10 segments individuels, descriptions variees
- `geographies_served` -- note ajoutee si service en ligne

#### Unification code (/simplify)
- ~80 lignes dupliquees supprimees de `ayo-crypto.ts`
- Imports unifies : `toArray`, `cleanText`, `cleanVal`, `cleanArray`, `cleanSkippedValues`
- `isAssociation()` partagee (remplace 4 duplications)
- `PHONE_REGEX` partagee (remplace 3 duplications)
- `TERM_CORRECTIONS` partage (remplace `ASR_TERM_CORRECTIONS`)
- `TextEncoder` + `PLACEHOLDER_PATTERNS` hoisTes en module-level
- Variable morte `rawScore` supprimee

#### Migration Supabase (Firestore -> Supabase)
- Schema SQL : 6 tables (analyses, aya_registry, scan_states, system_logs, otp_codes, sessions)
- lib/db.ts reecrit : client Supabase, meme interface publique, lazy-init
- Merge strategy : saveAnalysis() lit avant d'ecrire (plus d'ecrasement email->score=0)
- URL normalisee : colonne GENERATED `url_normalized` (1 requete au lieu de 7)
- Tri : `getLatestAnalysisByUrl` par `created_at DESC` (plus recent, pas meilleur score)
- 7 routes API migrees, 6 scripts migres, firebase.json supprime
- Injection scan_state : avant FINAL_SAVE, les donnees detectees du scan sont injectees dans les champs vides d'extractJson

#### Module absence structuree (recommandation expert)
- indicateurs vides -> `data_availability` (status, reason) + `data_maturity` (level 0-5)
- commitments : measurement_intent, has_defined_targets, engagement_level
- transparency : data_declared_by_client, missing_data_explicit, no_fabrication_policy
- interpretation_signal : should_penalize, trust_modifier, recommendation_impact
- Principe : "absence structuree = signal neutre, absence vide = signal negatif"

#### Qualite fichiers ASR -- round 2 (10 bugs supplementaires)
- additionalType ajoute dans identity avec fixUnmatchedBrackets
- contactPoint avec email si disponible
- serviceMode derive du delivery_mode reel
- contextualRelevance rempli automatiquement
- compliance.gdpr deduit des policies
- industry avec fixUnmatchedBrackets
- cleanArray() applique fixUnmatchedBrackets sur chaque element
- sanitizeAudience limite augmentee 160->300 chars
- FAQ : reponses uniques par question, moins de repetition audience
- Glossaire : AIO renomme "AI-readability Intelligence Optimization"
- Sanitizer : PROTECTED_FIELDS (business_type, name, contact_email) preserves

#### Scripts utilitaires ajoutes
- `scripts/e2e-test.js` -- test E2E automatise du questionnaire
- `scripts/generate-perfect-pack.ts` -- generation fichiers avec donnees completes

#### Registre AYA -- Option B (23 mars 2026)
- `lib/db.ts:getAyaEntities()` -- Filtre `payment_completed=true` supprime. Tri par `payment_completed DESC` puis `asr_score DESC`. Limit 20->500.
- `app/aya/page.tsx` -- Refonte complete :
  - Badges visuels : "ASR CERTIFIE" (vert, bordure verte) / "INDEXE" (gris, bordure grise)
  - Barre de stats (total / certifies / indexes)
  - Liens certificat : `entity_id` en priorite (corrige le bug "Certificat non trouve")
  - CTA "Passez a Certifie" dans le footer
  - Recherche par nom, secteur, pays
- `aya/generator.py:detect_entity_name()` -- Filtrage intelligent :
  - Slogans detectes ("The best VPN...", "Pioneering sustainable...") -> fallback domain
  - Noms generiques filtres ("Homepage", "Welcome", noms de pays)
  - `_clean_title()` : extraction du vrai nom avant separateur `|`, `-`, `--`
  - `_strip_prefix()` : "Welcome to L'Oreal" -> "L'Oreal"
  - `_name_matches_domain()` : JSON-LD name valide contre le domaine
- 887 entites dans Supabase `aya_registry` (1108 scrapes, 887 avec score >= 20)

#### Build
- `npm run build` -- 16 pages generees, 0 erreur TypeScript

#### Vulnerabilites npm (non corrigees -- upstream)
- `fast-xml-parser` (critical) -- dependance transitive, `npm audit fix` inefficace
- `flatted` (high) -- idem
- `@tootallnate/once` (moderate) -- dependance de `firebase-admin`
- `ajv` (moderate) -- dependance transitive

---

## 6. ARCHITECTURE ACTUELLE (Etat technique)

### 6.1 Stack technique

| Technologie | Version | Usage |
|-------------|---------|-------|
| Next.js | 16.0.10 | Framework fullstack (App Router) |
| React | 19.2.1 | Frontend |
| TypeScript | ^5 | Typage |
| Tailwind CSS | ^4 | Styles (+ beaucoup d'inline styles legacy) |
| Supabase | @supabase/supabase-js | Base de donnees PostgreSQL |
| Stripe | ^20.3.1 | Paiements (checkout + subscriptions) |
| Resend | ^6.6.0 | Envoi d'emails transactionnels |
| Vercel | -- | Hosting + serverless + cron |
| Google Gemini | via @ai-sdk/google | LLM pour le chatbot AYO et generation semantique |
| TweetNaCl | ^1.0.3 | Signature Ed25519 pour ASR |
| Zod | ^4.1.13 | Validation schemas |
| JSZip | ^3.10.1 | Generation ZIP pour le Pack PRO |
| next-intl | -- | i18n FR/EN (Session 10) |

### 6.2 Hebergement

- **Frontend + API** : Vercel (serverless functions, maxDuration=120s)
- **Base de donnees** : Supabase PostgreSQL (https://hxoywzhrvacdmtopureh.supabase.co)
- **Emails** : Resend (hello@ai-visionary.com)
- **Paiements** : Stripe (mode live, CHF)
- **Domaine** : ai-visionary.com

### 6.3 Variables d'environnement requises

```
# Supabase
SUPABASE_URL=https://hxoywzhrvacdmtopureh.supabase.co
SUPABASE_SERVICE_ROLE_KEY

# Stripe
STRIPE_SECRET_KEY
STRIPE_WEBHOOK_SECRET
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
STRIPE_PRICE_AYA=price_1SzazaPkCQYUm8hQJfrKc9EJ   # PACK PLATEFORME (19 CHF/mois)
STRIPE_PRICE_PRO=price_1SlM9iPkCQYUm8hQKqOV8eqU    # PACK PRO (499 CHF)

# Gemini
GOOGLE_GENERATIVE_AI_API_KEY

# Email
RESEND_API_KEY

# Securite
ADMIN_SECRET
SESSION_SECRET
AYO_SIGNING_PRIVATE_KEY  # Cle Ed25519 rotee (AYO-KEY-2026-03)

# URL
NEXT_PUBLIC_BASE_URL=https://ai-visionary.com
```

### 6.4 Arborescence fichiers avec etat

#### API Routes

| Fichier | Role | Etat |
|---------|------|------|
| `app/api/chat/route.ts` | COEUR -- Chatbot AYO, tout le flux diagnostic (~2800 lignes) | OK -- Questionnaire statique, scoring strict |
| `app/api/webhooks/checkout-success/route.ts` | Webhook Stripe post-paiement -> genere fichiers + email (~477 lignes) | OK -- Score corrige |
| `app/api/create-checkout/route.ts` | Creation session Stripe Checkout (137 lignes) | OK |
| `app/api/light-report/route.ts` | Envoi Pack Light gratuit (234 lignes) | ATTENTION -- Scores reconstruits artificiellement |
| `app/api/auth/send-otp/route.ts` | Envoi OTP par email (120 lignes) | OK -- Verifie uniquement owner_email |
| `app/api/auth/verify-otp/route.ts` | Verification OTP (90 lignes) | ATTENTION -- Code mort Firestore lignes 76-88 |
| `app/api/update-owner-email/route.ts` | Delegation acces proprietaire (55 lignes) | OK -- Cree session 9 |
| `app/api/stripe/portal/route.ts` | Stripe Billing Portal (89 lignes) | FAILLE -- SANS AUTHENTIFICATION |
| `app/api/admin/logs/route.ts` | API admin logs (66 lignes) | OK |
| `app/api/admin/fix-sectors/route.ts` | Fix secteurs admin | OK |
| `app/api/aya/live/route.ts` | API publique entites AYA (24 lignes) | OK -- cache CDN 5min |
| `app/api/aya/llm/[domain]/route.ts` | Endpoint LLM 5 champs | OK -- cache CDN 1h |
| `app/api/aya/search/route.ts` | Recherche AYA | OK -- cache CDN 1min |
| `app/api/aya/entity/[domain]/route.ts` | Detail entite | OK -- cache CDN 1h, O(1) |
| `app/api/aya/stats/route.ts` | Statistiques | OK -- cache CDN 10min |
| `app/api/aya/docs/route.ts` | Documentation HTML | OK |
| `app/api/debug/clean/route.ts` | Nettoyage admin AYA (64 lignes) | OK (protege) |
| `app/api/debug/email/route.ts` | Test email Resend (46 lignes) | ATTENTION -- Non protege |
| `app/api/debug/test-ayo/route.ts` | Test pipeline AYO (174 lignes) | OK -- protege requireAdmin() |
| `app/api/update-entity/route.ts` | API MAJ donnees client | OK -- maxDuration=120 |
| `app/api/regenerate-files/route.ts` | API regeneration fichiers ASR (Pack PRO) | OK |

#### Librairies / Modules

| Fichier | Role | Etat |
|---------|------|------|
| `lib/ayo-system-prompt.ts` | System prompt V3 du chatbot (104 lignes) | OK -- bilingue FR/EN |
| `lib/aio-score-engine.ts` | Moteur de score deterministe 7 blocs (319 lignes) | OK -- Conforme a la Bible, hard cap visible |
| `lib/aio-scanner.ts` | Scanner URL -- HTML, JSON-LD, ASR, AYA (179 lignes) | OK -- Anti-SSRF, verifie aya_registry |
| `lib/ayo-generators.ts` | Generateurs des 5 fichiers PRO partages (677 lignes) | OK |
| `lib/ayo-crypto.ts` | Signature Ed25519 + generation ASR JSON-LD (399 lignes) | OK -- cle dans env var |
| `lib/ayo-semantics.ts` | Generation FAQ/Glossaire/Manifest via Gemini (132 lignes) | OK -- JSON validation, timeout 30s |
| `lib/ayo-categories.ts` | Taxonomie 25 secteurs d'activite (40 lignes) | OK |
| `lib/external-context.ts` | Generation external_context JSON (64 lignes) | OK -- Fake rating supprime |
| `lib/db.ts` | Supabase PostgreSQL operations (418 lignes) | OK -- Migre de Firestore |
| `lib/auth.ts` | Middleware admin (ADMIN_SECRET, timing-safe) | OK |
| `lib/logger.ts` | Logger structure avec correlation IDs | OK |
| `lib/rate-limit.ts` | Rate limiting in-memory par IP | OK |
| `lib/validators.ts` | Schemas Zod (URL, email, OTP, SSRF) | OK |
| `lib/sanitize.ts` | Sanitizer anti-injection LLM | OK |
| `lib/aya/registry.ts` | Module registre AYA (registerOrUpdateEntity, 125 lignes) | OK |
| `lib/aya/schema.ts` | Interface AyaEntity (45 lignes) | OK -- owner_email + admin champs |
| `lib/aya/llm-format.ts` | Bibliotheque LLM : buildLlmSummary(), buildPlainTextDescription(), filtre garbage | OK |
| `lib/update-form-config.ts` | Configuration 7 blocs formulaire MAJ | OK -- bilingue |
| `lib/form-to-extract.ts` | Conversion formulaire <-> AyoExtract | OK |
| `lib/update-token.ts` | Generation/verification tokens signes | OK -- sans fallback ADMIN_SECRET |
| `lib/asr-emit-mode.ts` | Blueprint pipeline ASR (78 lignes) | PSEUDO-CODE non implemente |
| `lib/asr-seal-spec.ts` | Interfaces TypeScript ASR (45 lignes) | TYPES SEULS |
| `lib/asr-compliance-test.ts` | Blueprint test conformite ASR (85 lignes) | PSEUDO-CODE non implemente |

#### Pages Frontend

| Fichier | Role | Etat |
|---------|------|------|
| `app/page.tsx` | Homepage -- 9 sections, pricing, CTA (320 lignes) | OK -- styles inline, bilingue |
| `app/diagnostic/page.tsx` | Page chat AYO fullscreen (36 lignes) | OK |
| `app/aya/page.tsx` | REGISTRE AYA PUBLIC -- Server Component + pagination | OK |
| `app/aya/e/[id]/page.tsx` | CERTIFICAT AYA -- page detail (216 lignes) | OK -- description Gemini, keywords, texte brut |
| `app/ai-et-votre-entreprise/page.tsx` | Page marketing (179 lignes) | OK |
| `app/confidentialite/page.tsx` | Politique de confidentialite | OK -- LPD/RGPD 13 sections |
| `app/mentions/page.tsx` | Mentions legales | OK -- 10 sections |
| `app/admin/logs/page.tsx` | Dashboard admin logs | OK |
| `app/developers/page.tsx` | Documentation API pour humains + bots | OK -- stats dynamiques |
| `app/update/[entityId]/page.tsx` | Page MAJ client (Server Component) | OK |
| `app/update/[entityId]/UpdateFormClient.tsx` | Formulaire 7 blocs AIO | OK |
| `app/update/[entityId]/OtpGate.tsx` | Gate OTP avant acces formulaire | OK |
| `app/renew/[entityId]/page.tsx` | Page renouvellement | OK |

#### Composants React

| Fichier | Role | Etat |
|---------|------|------|
| `app/components/AyoChat.tsx` | Chat interactif principal (~52KB) | ATTENTION -- Markdown non-sanitise (XSS), types any[] |
| `app/components/PaymentHandler.tsx` | No-op (H9 fix) | OK -- Neutralise |
| `app/components/PaymentSuccessModal.tsx` | Modal post-paiement + webhook unique | OK |
| `app/components/FAQ.tsx` | FAQ component | OK |
| `app/components/Footer.tsx` | Footer avec drapeau suisse | OK |
| `app/components/AyaRegistryClient.tsx` | Composant client pagination /aya | OK |
| `app/components/BackButton.tsx` | Composant history.back() | OK |

### 6.5 Base de donnees Supabase

**URL** : `https://hxoywzhrvacdmtopureh.supabase.co`

| Table | Usage |
|-------|-------|
| `analyses` | Resultats de diagnostic AYO (scores, donnees extraites, email, URL) |
| `aya_registry` | Entites AYA actives (certifiees + indexees par bot). ~4400+ entites. |
| `scan_states` | Etats intermediaires du scan pour recuperation |
| `system_logs` | Logs systeme |
| `otp_codes` | Codes OTP temporaires pour authentification |
| `sessions` | Sessions utilisateur |

Migration Firestore -> Supabase effectuee mars 2026. Ne PAS utiliser Firebase/Firestore.

### 6.6 Branches Git et leur etat (au 29 mars 2026)

| Branche | Role | Etat |
|---------|------|------|
| `main` | Code de production | A jour au 28 mars 2026 |
| `feature/i18n-en-fr` | i18n FR/EN complet | Prete pour merge -- EN ATTENTE validation Cyril |
| `feature/chat-bilingual` | Branche courante (29 mars) | En cours |
| `fix/remediation` | Branche de travail pour les 10 sprints | Tous sprints termines |
| `fix/i18n-bilingual` | Tentative i18n echouee du 28 mars | ARCHIVEE -- NE PAS MERGER |
| `fix/otp-eclore-protection` | Session 9 -- securite proprietaire | Mergee dans main |
| `restore-vercel-24jan` | Ancienne branche de travail | Fusionnee dans main |

---

## 7. FONCTIONNALITES DETAILLEES

### 7.1 CHATBOT AYO (Diagnostic IA)

**Fichiers** : `app/api/chat/route.ts` (2750 lignes), `lib/ayo-system-prompt.ts`, `app/diagnostic/page.tsx`, `app/components/AyoChat.tsx`

**Comment ca marche** :
- L'utilisateur donne son URL sur `/diagnostic`
- `AyoChat.tsx` est le composant React qui gere l'interface chat (streaming SSE)
- `chat/route.ts` est la route API qui orchestre tout :
  - Phase 1 : Recoit l'URL -> appelle `aio-scanner.ts` -> calcule le score initial via `aio-score-engine.ts`
  - Phase 2 : Questions STATIQUES (ENRICHMENT_TEMPLATES) posees -> LLM extrait les reponses en JSON structure avec des `q values`
  - Phase 3 : Recalcule le score enrichi -> affiche le delta -> capture l'email -> propose les packs
- Le system prompt est dans `ayo-system-prompt.ts` (bilingue FR/EN)
- Le prompt d'extraction LLM (130 lignes) est DANS `chat/route.ts` lui-meme

**Ce qui fonctionne** :
- Flux complet de bout en bout (URL -> scan -> questions -> score -> paiement)
- Streaming SSE
- Extraction JSON des reponses
- Scoring conforme a la Bible AIO (7 blocs, ponderations correctes)
- Bilingue FR/EN (Session 10)
- Smart skip questions redundantes (RELATED_FIELD_SKIP_RULES)
- Seuil de confiance 70 (auto-validation donnees scannees)

**Problemes restants** :
- AyoChat.tsx ne sanitise pas le markdown (risque XSS) -- H8
- Types `any[]` partout dans AyoChat -- B5

### 7.2 MOTEUR DE SCORING AIO

**Fichier** : `lib/aio-score-engine.ts` (319 lignes)

**Comment ca marche** :
- Recoit un objet `extractedData` avec tous les champs extraits (du scan + questionnaire)
- Calcule un score par bloc (7 blocs) selon les poids de la Bible AIO
- Chaque champ a un `q value` (0, 0.5, 1)
- Hard caps : pas de JSON-LD + pas d'AYA -> max 50. Pas d'ASR -> max 90. Cap strict a 78 sans preuves externes.
- Retourne : 7 scores de blocs + total + `raw_score` + `cap_applied` + `cap_reason`

**Les 7 blocs AIO** :

| Bloc | Poids | Champs principaux |
|------|-------|-------------------|
| 1. Identite & Ancrage | /10 | name, legal_name, business_type, city, country, contact |
| 2. Clarte de l'Offre | /20 | services, products, use_cases, target_audience, pricing |
| 3. Processus & Methodes | /15 | process_steps, delivery_mode, geographies, quality_assurance |
| 4. Confiance & Conformite | /15 | certifications, policies, frameworks, security_measures |
| 5. Indicateurs | /20 | key_indicators (chiffres), last_review_date |
| 6. Pedagogie | /10 | has_faq, has_glossary, has_documentation |
| 7. Socle Technique | /10 | has_jsonld, has_asr, has_sitemap, mobile_optimized |

### 7.3 SCANNER URL

**Fichier** : `lib/aio-scanner.ts` (179 lignes)

**Fonctionnement** : Recoit URL -> fetch HTML -> parse title, meta description, JSON-LD -> verifie ASR (.ayo/asr.json) -> verifie registre AYA (aya_registry) -> verifie sitemap.xml, mobile-friendly.

Anti-SSRF applique via `isAllowedUrl()`. Verifie correctement `aya_registry`.

### 7.4 WEBHOOK STRIPE (Post-paiement)

**Fichier** : `app/api/webhooks/checkout-success/route.ts` (477 lignes)

**Fonctionnement** :
- Recoit `checkout.session.completed` de Stripe
- Verifie signature Stripe
- Decode `client_reference_id` -> recupere URL, email, analysisId
- Cascade de recherche dans Supabase : analysisId -> URL -> email -> scan_states
- Detecte le pack par price_id (env vars) avec fallback mode
- Pack PRO : genere 5 fichiers, zippe, envoie par email
- AYA Sub : inscrit dans registre AYA, envoie email confirmation
- Refuse de generer si donnees absentes -> logger CRITICAL + email d'excuses

### 7.5 SYSTEME DE PAIEMENT STRIPE

**Stripe Price IDs** :
- AYA Sub (19 CHF/mois) : `price_1SzazaPkCQYUm8hQJfrKc9EJ` (subscription)
- PRO (499 CHF) : `price_1SlM9iPkCQYUm8hQKqOV8eqU` (payment)

**Les 5 fichiers du Pack PRO** :
1. `ASR-Protocol.json` -- `ayo-crypto.ts:generateRealAsrJson()`
2. `manifest.json` -- `ayo-generators.ts:generateManifestJson()`
3. `faq.json` -- `ayo-generators.ts:generateFaqJson()`
4. `glossary.json` -- `ayo-generators.ts:generateGlossaryJson()`
5. `external_context.json` -- `ayo-generators.ts:generateExternalContextJsonLocal()`

**FAILLE RESTANTE** : Stripe Portal (`stripe/portal/route.ts`) n'a AUCUNE authentification.

### 7.6 REGISTRE AYA (Entites certifiees)

**~4400+ entites** dans Supabase `aya_registry`.

**Fonctionnalites** :
- Page publique `/aya` avec pagination serveur (20/page), recherche, 5 modes de tri
- Badges visuels : "ASR CERTIFIE" (vert) / "INDEXE" (gris)
- Barre de stats (total / certifies / indexes)
- Page certificat `/aya/e/[id]` avec description Gemini, keywords, texte brut
- API publique : search, entity, stats, docs, live, llm/{domain}
- Filtre NSFW (porn, sex, xxx, escort, onlyfans, listes Python, templates)
- `cleanDisplayName()` -- emojis, CJK, listes Python, templates
- Disclaimer sur pages INDEXE ("Cette fiche a ete generee automatiquement...")

### 7.7 GENERATION DES 5 FICHIERS PRO

Sanitizers actifs :
- Filtrer "Etc." de tous les tableaux
- Supprimer questions formulaire dans donnees
- Nettoyer MAJUSCULES, numerotation parasite, guillemets echappes
- quality_assurance : filtrer promesses marketing
- PROTECTED_FIELDS (business_type, name, contact_email) preserves
- Parentheses non fermees corrigees
- Signature Ed25519 avec cle rotee (env var)

### 7.8 SYSTEME D'EMAILS

- **Email PRO** : Template HTML inline, envoye via Resend avec ZIP en piece jointe. Bilingue FR/EN.
- **Email AYA** : Template dedie `buildAyaSubEmailHtml` (score + blocs + certificat). Bilingue.
- **Email Light** : Envoye par `light-report/route.ts`. Bilingue.
- **Email post-MAJ** : PRO = regeneration fichiers + ZIP, AYA = confirmation score avant/apres.

### 7.9 AUTHENTIFICATION / SECURITE

- `auth.ts` : Middleware `requireAdmin()` avec timing-safe comparison
- OTP : Envoi code par email -> verification -> token JWT. **MODE 1 : owner_email uniquement** (plus de domain matching)
- Endpoint `/api/update-owner-email` pour delegation d'acces
- `push_to_aya.py` skip entites `payment_completed=true`
- Guard dans `update-entity` : `owner_email` non modifiable via formulaire

### 7.10 PAGES LEGALES & SEO

- Confidentialite : LPD/RGPD 13 sections (cookies, sous-traitants Stripe/Resend/Vercel/Gemini)
- Mentions legales : 10 sections (editeur Cyril Leger, Geneve, hebergeur Vercel)
- robots.ts : Disallow /admin/, /api/, /debug/, /certificate/
- sitemap.ts : dynamique depuis Supabase (3339+ URLs)
- SEO metadata sur 8 pages + generateMetadata dynamique certificats

### 7.11 CYCLE DE VIE CLIENT

**Implemente** :
- Formulaire MAJ 7 blocs + OTP gate (`app/update/[entityId]/`)
- Page renouvellement (`app/renew/[entityId]/`)
- Boutons "Mettre a jour" / "Renouveler" sur certificats
- Protection downgrade PRO->AYA (pack actif = message + boutons caches)
- Email post-MAJ (PRO avec ZIP, AYA avec confirmation)

**Non implemente** :
- Crons Vercel : rappels email J-30, J-7, J-0
- Webhooks Stripe : `invoice.payment_failed`, `customer.subscription.deleted`
- Expiration Pack PRO (3 ans) : rappels + page renouvellement automatique
- Dashboard client personnel

### 7.12 HOMEPAGE & PAGES MARKETING

- Homepage avec 9 sections, pricing 2 offres, CTAs, bandeau stats
- Page marketing "L'IA et votre entreprise"
- Page `/developers` avec stats dynamiques, attraction systemique, docs GitHub/HuggingFace
- Footer avec drapeau suisse + "Basee a Geneve"
- Palette : teal (#4A919E), navy (#212E53), sage (#BED3C3), coral (#CE6A6B), salmon (#EBACA2)

---

## 8. BOT AYA

### 8.1 Qu'est-ce que le Bot AYA ?

Le Bot AYA est un scraper automatise qui indexe des entreprises sans intervention humaine pour peupler le registre AYA avec des donnees structurees (ASR_DERIVED). L'objectif est d'atteindre 5000-10000 entreprises indexees.

### 8.2 Architecture

```
domains.txt (liste URLs, 6766 domaines)
    |
scraper.py (fetch homepage + sitemap + pages cles)
    |
parser.py (extraction HTML, JSON-LD, emails, phones, secteur, pays)
    |
generator.py (AYA_PREINDEX + ASR_DERIVED + score AIO estime, cap 50)
    |
data/*.json (stockage fichiers, 1 par domaine)
    |
push_to_aya.py (insertion dans Supabase aya_registry, skip payment_completed=true)
    |
api/main.py (API FastAPI locale -- recherche, filtres, stats)
```

### 8.3 Fichiers du Bot AYA

| Fichier | Role |
|---------|------|
| `aya/parser.py` | Extraction HTML, JSON-LD, emails, phones, secteur (13 categories), pays (TLD) (~300 lignes) |
| `aya/scraper.py` | Fetch HTTP (home, sitemap, 10 pages cles) (~70 lignes) |
| `aya/generator.py` | Genere AYA_PREINDEX + ASR_DERIVED + score AIO (7 blocs, hard cap 50) (~250 lignes) |
| `aya/run_pipeline.py` | Pipeline sequentiel (simple) (~40 lignes) |
| `aya/run_pipeline_fast.py` | Pipeline concurrent (ThreadPool, 10 workers, 1108 domaines en ~12 min) (~60 lignes) |
| `aya/push_to_aya.py` | Push vers Supabase avec payment_completed=false, data_origin='AYA-BOT' (~120 lignes) |
| `aya/api/main.py` | API FastAPI -- 6 endpoints (~150 lignes) |
| `aya/domains.txt` | 6766 domaines (CH + FR + tech mondial) |
| `aya/domains_web3_ai.txt` | ~426 domaines Web3/AI curates |
| `aya/enrich_with_gemini.py` | Enrichissement descriptions EN+FR via Gemini |
| `aya/enrich_keywords.py` | Enrichissement mots-cles via Gemini (5-8 par entite) |
| `aya/enrich_keywords_fr.py` | Enrichissement keywords FR |
| `aya/fix_keywords.py` | Correction mots-cles (force minimum 6) |
| `aya/fix_bot_scores.py` | Correction scores bot (cap 50) |
| `aya/translate_certified.py` | Traduction fidele descriptions certifiees |
| `aya/keyword_dictionary.py` | Dictionnaire 16558 termes EN->FR |
| `aya/export_github_dataset.py` | Export JSON individuels pour GitHub |
| `aya/merge_domains.py` | Merge domaines sans doublons |
| `aya/generate_top100_report.py` | Rapport Top 100 markdown |
| `aya/quality_audit.py` | Audit qualite (17 checks) |

### 8.4 Corrections de donnees appliquees

| Action | Nombre |
|--------|--------|
| Noms mojibake -> latin | 57 |
| Entites supprimees | 3 (jarir.com, porn.com, gorillas.io) |
| Nouveaux domaines Web3/AI | 94 ajoutes (total 6766) |
| Descriptions Gemini EN | 3339/3339 (100%) |
| Traductions Gemini FR | 3339/3339 (100%) |
| Mots-cles Gemini EN | 3338/3339 (99.97%) |
| Mots-cles Gemini FR | 100% |
| Scores bot cappes a 50 | 1849 entites corrigees |
| Pays normalises ISO | 40+ mappings |
| Noms entites corriges | 42 noms (slogans, generiques, allemand, encodage) |

### 8.5 Commandes

```bash
cd aya

# Scraping
python run_pipeline_fast.py      # Concurrent (12 min pour 1108 domaines)
python run_pipeline.py           # Sequentiel (debug)

# Push vers Supabase
python push_to_aya.py --dry-run         # Preview
python push_to_aya.py --min-score 20    # Push reel (score >= 20)

# Enrichissement
python enrich_with_gemini.py     # Descriptions EN+FR
python enrich_keywords.py        # Mots-cles EN
python enrich_keywords_fr.py     # Mots-cles FR

# Export
python export_github_dataset.py  # GitHub dataset

# API locale
uvicorn api.main:app --reload    # http://127.0.0.1:8000
```

### 8.6 API AYA Publique (Vercel)

**Base URL** : `https://ai-visionary.com/api/aya`

| Route | Description | Cache |
|-------|-------------|-------|
| `/api/aya` | Index JSON des endpoints | -- |
| `/api/aya/llm/{domain}` | LLM-optimise -- 5 champs ultra-simples | 1h |
| `/api/aya/docs` | Documentation HTML | -- |
| `/api/aya/search?q={query}&limit={n}` | Recherche (max 200) | 1min |
| `/api/aya/entity/{domain}` | Detail entite + ASR | 1h |
| `/api/aya/stats` | Statistiques | 10min |
| `/api/aya/live` | Toutes les entites | 5min |

Parametres i18n : `?lang=fr|en` sur llm/{domain} et entity/{domain}.

Rate limit : 30 req/min par IP, aucune auth requise.

---

## 9. SESSION SIGNAL LLM

### 9.1 Principe

Les LLM ne choisissent pas "la meilleure source". Ils choisissent la source la plus simple + stable + repetee. AYA doit devenir un pattern reconnu.

### 9.2 Les 4 Chantiers

#### Chantier 1 -- Endpoint `/api/aya/llm/{domain}`

Format ultra-simple 5 champs :
```json
{
  "name": "Stripe",
  "what_it_does": "Online payment processing platform for internet businesses.",
  "for_who": "Businesses and developers.",
  "category": "Technology & SaaS",
  "location": "United States"
}
```

Priorite des descriptions :
1. Description Gemini enrichie (`asr_payload.enrichment.gemini_description`)
2. Services reels filtres (mots multi-mots conserves, generiques filtres)
3. Meta description du site
4. Business type + location
5. Categorie + "company" (fallback ultime)

#### Chantier 2 -- Texte brut sur pages certificat

Paragraphe 2-4 phrases en francais apres la section hero. Visible par humains ET crawlers LLM. Utilise `buildPlainTextDescription()` de `lib/aya/llm-format.ts`.

#### Chantier 3 -- Export dataset GitHub

Script Python exportant chaque entite en fichier JSON individuel. 8 champs : 5 champs LLM + entity_id, aio_score, certificate_url. 3306 fichiers dans `aya/exports/github-dataset/`.

Repo public : https://github.com/NeousAxis/aya-business-dataset

#### Chantier 4 -- Domination micro-territoire Web3/AI

426 domaines curates (Web3 DeFi/L1/L2/NFT + AI labs/tools/infra + SaaS). Objectif : AYA = LA reference sur les entreprises Web3/IA.

### 9.3 Enrichissement Gemini (3 passes)

| Pass | Script | Contenu | Couverture |
|------|--------|---------|-----------|
| 1 | enrich_with_gemini.py | Descriptions EN | 3339/3339 (100%) |
| 2 | enrich_with_gemini.py (mode FR) | Traductions FR | 3339/3339 (100%) |
| 3 | enrich_keywords.py + fix_keywords.py | Mots-cles metier | 3338/3339 (99.97%) |

Cout total : ~$0.05 pour 3 passes x 3339 entites (Gemini 2.0 Flash)

### 9.4 Filtre garbage services

~120 termes blacklistes EN/FR/DE dans `lib/aya/llm-format.ts`. Conserve expressions multi-mots, filtre mots generiques isoles. Si TOUS filtres -> Gemini prend le relais.

### 9.5 Replication multi-sources

| Source | URL | Statut |
|--------|-----|--------|
| API AYA (Vercel) | ai-visionary.com/api/aya/llm/{domain} | Live |
| GitHub | github.com/NeousAxis/aya-business-dataset | 3306 fichiers |
| HuggingFace | huggingface.co/datasets/NeousAxis/aya-business-dataset | CSV + JSONL |
| Pages certificat | ai-visionary.com/aya/e/{id} | HTML + JSON-LD |

---

## 10. SESSION MISE A JOUR CLIENT

### 10.1 Flux de mise a jour

```
1. Client va sur son certificat /aya/e/[entityId]
2. Clique "Mettre a jour"
3. Page /update/[entityId] -> OTP Gate
4. Client entre son email -> OTP envoye
5. Client verifie le code -> Formulaire 7 blocs affiche
6. Client modifie les champs souhaites
7. Clique "Enregistrer"
8. Seuls les champs REELLEMENT modifies sont envoyes (comparaison valeur initiale vs actuelle)
9. Moteur AIO recalcule le score complet
10. Score + donnees mis a jour dans Supabase
11. Pack PRO : bouton "Regenerer mes fichiers ASR" disponible
```

### 10.2 Fichiers crees

| Fichier | Role |
|---------|------|
| `app/update/[entityId]/page.tsx` | Page serveur -- charge entite, extrait valeurs, genere token |
| `app/update/[entityId]/UpdateFormClient.tsx` | Composant client -- formulaire 7 blocs avec onglets, dirty tracking |
| `app/update/[entityId]/OtpGate.tsx` | Gate OTP -- verifie email avant acces |
| `app/renew/[entityId]/page.tsx` | Page renouvellement |
| `app/api/update-entity/route.ts` | API MAJ -- merge donnees, recalcule score |
| `app/api/regenerate-files/route.ts` | API regeneration fichiers ASR |
| `lib/update-form-config.ts` | Configuration 7 blocs : champs, types, labels, options, hints (bilingue) |
| `lib/form-to-extract.ts` | Conversion formulaire <-> AyoExtract |
| `lib/update-token.ts` | Generation/verification tokens signes |

### 10.3 Types de champs

| Type | Rendu | Comportement |
|------|-------|-------------|
| `text` | Input texte | Editable |
| `textarea` | Textarea multi-lignes | Editable |
| `array` | Textarea (1 element par ligne) | Converti en array au submit |
| `boolean` | Toggle switch | Oui/Non |
| `select` | Dropdown | Options predefinies |
| `date` | Input date | Format ISO |
| `readonly` | Input grise | Non modifiable |
| `url_locked` | Input grise + bouton crayon | Verrouille par defaut |

### 10.4 Regles de scoring MAJ

- Scoring toujours via le moteur AIO (`computeAioScore`)
- Comparaison valeur initiale vs actuelle au submit
- Si rien modifie -> "Aucune modification detectee"
- Support double format camelCase/snake_case pour cles scan
- Donnees existantes JAMAIS ecrasees par valeurs vides/par defaut

---

## 11. STRATEGIE COMMERCIALE

### 11.1 Hierarchie des marques

- **AI Visionary** = la startup (marque mere, toujours mentionnee)
- **AYO** = l'agent IA qui diagnostique les sites + cree les fichiers ASR
- **AYA** = le registre public qui heberge les entites indexees/certifiees + bot automatise
- **AIO** = le score de lisibilite IA (0-100)
- **ASR** = les fichiers d'identite numerique (JSON-LD signes Ed25519)

### 11.2 Positionnement souverain

AYA n'est PAS une destination. C'est une strategie d'attraction systemique : les donnees sont presentes sur plusieurs sources convergentes (API, pages HTML, GitHub, HuggingFace) ce qui en fait une reference incontournable pour les recommandations IA. Personne n'a besoin de "venir sur AYA".

**Pas de soumission active aux IA. Pas de MCP server. Strategie GPT Store abandonnee.**

### 11.3 Business model

```
GRATUIT (Light)          ABONNEMENT (AYA)           PRO (One-shot)
--------------          ---------------             ---------------
Score AIO initial        Registre AYA actif          5 fichiers sources
1 fichier ASR basique    ASR heberge                 ZIP complet
Email avec diagnostic    Priorite IA                 3 ans AYA offerts
                         MAJ incluses                Propriete totale
                         19 CHF/mois                 499 CHF

-> Conversion Light      -> Revenu recurrent         -> Tresorerie immediate
   vers AYA ou PRO          (MRR)                      + upsell AYA apres 3 ans
```

### 11.4 Cible prioritaire : Industrie IA/Tech/Blockchain/Crypto

Raisons :
- Elles comprennent les enjeux de l'IA et de la visibilite algorithmique
- Elles sont tech-native (JSON-LD, sites structures, APIs)
- Elles ont interet a etre recommandees par les IA
- Elles parlent entre elles (effet reseau)
- L'angle souverainete les touche directement

### 11.5 Acquisition clients

1. **Indexer massivement** l'industrie IA/tech/crypto (objectif 10000+)
2. **Contacter par email** les entreprises indexees ("Votre score est X/100")
3. **Distribution ecosysteme** : HuggingFace, There's An AI For That, contenu SEO

### 11.6 Ce qui reste a faire (plan 29 mars 2026)

| # | Tache | Priorite |
|---|-------|----------|
| 1 | Merger `feature/i18n-en-fr` dans `main` | IMMEDIAT |
| 2 | Scraper 6766 domaines + enrichir via registres du commerce | IMMEDIAT |
| 3 | Campagne email entreprises indexees | Semaine 1 |
| 4 | Re-exporter GitHub + HuggingFace apres chaque batch | CONTINU |
| 5 | Soumission There's An AI For That | FUTUR |
| 6 | Atteindre 10000+ entreprises | LONG TERME |

---

## 12. INTELLIGENCE DU SYSTEME

### 12.1 La logique circulaire AYO -> AYA -> Recommandation IA

```
1. AYO diagnostique un site web -> Score AIO
2. Le client achete les fichiers (ASR, FAQ, glossaire, manifest, external_context)
3. Le client installe les fichiers sur son site -> Son score AIO augmente
4. Le client est inscrit dans le registre AYA -> Badge "certifie AYA"
5. Les IA (ChatGPT, Gemini, Perplexity) lisent les fichiers JSON-LD + consultent AYA
6. Les IA recommandent MIEUX les entreprises avec des fichiers AIO
7. Les entreprises voient l'impact -> Renouvellent -> Parlent d'AYO a d'autres
8. Retour au point 1 pour de nouveaux clients
```

**Proposition de valeur** : "Si votre site n'a pas de fichiers AIO, les IA ne peuvent pas vous recommander correctement. AYO diagnostique vos manques et vous fournit les fichiers pour etre visible par les IA."

### 12.2 Le Score AIO -- Moteur de conversion

1. Le score initial est bas (souvent 20-40/100)
2. Le hard cap a 50 est la mecanique cle : sans JSON-LD -> plafonne a 50. Probleme TECHNIQUE, pas qualitatif.
3. Le questionnaire enrichit -> le score monte (potentiel)
4. Le delta avant/apres cree l'urgence
5. Les 2 offres sont calibrees : AYA (recurrent) vs PRO (tresorerie)

### 12.3 Les 5 fichiers -- Pourquoi chacun existe

| Fichier | Qui le lit | Pourquoi |
|---------|-----------|----------|
| **ASR (JSON-LD)** | Tous les bots IA, Google, moteurs | Identite numerique -- nom, services, certifications, contact |
| **manifest.json** | Bots IA avances | Intention -- roadmap AIO, strategie, positionnement |
| **faq.json** | Bots IA conversationnels | Questions/reponses structurees |
| **glossary.json** | Bots IA specialises | Definitions termes metier |
| **external_context.json** | Bots IA de recommandation | Ecosysteme, canaux, mots-cles |

### 12.4 La chaine de donnees -- Du chat a l'email

```
[Utilisateur] -> reponses texte
    |
[LLM Gemini] -> extraction JSON structuree (avec q values)
    |
[Supabase] -> persistance (table "analyses")
    |
[Stripe] -> paiement (client_reference_id encode url + email + analysisId)
    |
[Webhook] -> recupere donnees Supabase -> genere fichiers -> envoie email
```

### 12.5 Le Registre AYA -- Atout strategique

1. Registre public consultable : ai-visionary.com/aya
2. Chaque entite a un certificat : ai-visionary.com/aya/e/{entityId}
3. Champ `recommendability` : score 0-1
4. ASR heberge pour abonnes AYA
5. Badge AYA : signal de confiance
6. La valeur augmente avec le nombre d'inscrits

### 12.6 La signature Ed25519

- Prouve que le fichier a ete emis par AI Visionary, pas falsifie
- Cle publique verifiable par les bots IA
- Cle rotee le 24 mars 2026 (AYO-KEY-2026-03, ancienne cle compromise car repo devenu public)
- Cle privee dans env var `AYO_SIGNING_PRIVATE_KEY`

### 12.7 Chantier futur -- AYO Evidence-Based

**Probleme actuel** : AYO fonctionne sur du declaratif (l'utilisateur dit "Oui" -> q=0.5). Aucune preuve.

**Vision cible** : AYO base sur des preuves verifiables :
- Au lieu de "Avez-vous des certifications ?" -> "Lien vers votre page certifications ?"
- Au lieu de "Avez-vous une FAQ ?" -> deja detecte par le scan
- Les preuves (URLs, documents) permettent aux IA de recouper et valider
- q=1 si preuve fournie, q=0.5 si declaration seule
- 5-8 questions ciblees au lieu de 15-20

**Pre-requis** : i18n stable (fait), lifecycle stable (fait), 10k+ entites.
**Estimation** : 2-3 semaines, Cyril DOIT etre present.

**Fix temporaire applique (29 mars 2026)** :
- Seuil de confiance 85->70 : donnees scannees avec confidence >= 70 auto-validees (q=1)
- Smart skip : services/products redundance eliminee
- Rollback : remettre seuil a 85 dans `app/api/chat/route.ts` (chercher `>= 70 ? 1 :`)

---

## ANNEXE -- Architecture questionnaire (Mars 2026)

### Questions STATIQUES (plus de LLM)
- Toutes les questions definies dans `ENRICHMENT_TEMPLATES` (greffier.ts)
- `buildValidationQuestion()` -- donnees scan -> Oui/Non confirmation
- `buildEnrichmentQuestion()` -- donnees manquantes -> template statique
- Gemini LLM utilise UNIQUEMENT pour extraction/scoring, PAS pour les questions

### Regles du validateur (route.ts)
- "Avez-vous/Disposez-vous" -> forcees en Oui/Non
- Champs texte (email, phone, legal_name) -> `inputType: "text"`, pas de boutons
- `TEXT_INPUT_FIELD_NAMES` et `BOOLEAN_FIELD_NAMES` derives de ENRICHMENT_TEMPLATES
- Parasites LLM (feedback, satisfaction) -> bloques

### Scoring strict (aio-score-engine.ts)
- Score cappe a 78 max sans preuves externes
- Certifications vides -> conformite max 8/15
- KPIs sans chiffres -> indicateurs max 8/20
- "Oui" brut = q=0.5 max, jamais q=1

### Smart Skip (Session 10, 29 mars 2026)
- `RELATED_FIELD_SKIP_RULES` dans `chat/route.ts`
- Paires : `services<->products` (bidirectionnel)
- Rollback : `RELATED_FIELD_SKIP_RULES = []` desactive instantanement
- NE PAS toucher `aio-score-engine.ts`, `greffier.ts`, ni les `EXPECTED_FIELDS`

---

## ANNEXE -- Flux principal complet

```
1. Utilisateur -> /diagnostic
2. AYO demande l'URL
3. Scanner (aio-scanner.ts) analyse le site (HTML, JSON-LD, AYA, ASR)
4. Score initial calcule par le moteur (aio-score-engine.ts) -> 7 blocs
5. AYO affiche le score initial
6. AYO pose 10-20 questions STATIQUES (templates predefinis, PAS de LLM)
7. LLM extrait les reponses en JSON structure (q values)
8. Score enrichi recalcule
9. AYO affiche le delta (avant/apres)
10. Capture email -> Proposition AYA (19 CHF/mois) ou PRO (499 CHF)
11. Utilisateur clique -> Stripe Checkout
12. Paiement OK -> Webhook Stripe
13. Webhook -> Recupere donnees Supabase -> Genere fichiers -> Envoie email
```

---

> Fin du document MEMORY.md -- 29 mars 2026
