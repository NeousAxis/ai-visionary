# AI VISIONARY — Documentation Projet pour Claude Code

> **IMPORTANT** : Ce fichier est lu automatiquement par Claude Code à chaque nouvelle conversation.
> Il contient TOUTE la connaissance nécessaire pour reprendre le travail sur ce projet.
> Dernière mise à jour : 23 mars 2026

---

## 1. CONTEXTE PROJET

### Qu'est-ce que AI Visionary ?

AI Visionary est une startup basée à **Genève, Suisse** fondée par **Cyril Leger**.
Le produit principal est **AYO** (AI Your Org) — un chatbot IA qui diagnostique la **lisibilité IA** d'un site web via un score appelé **AIO** (AI-readability Intelligence Optimization), de 0 à 100.

### Le business model

1. **Analyse Light** (gratuit) — Diagnostic AIO + score de visibilité IA (pas de fichier livré)
2. **Abonnement AYA** (19 CHF/mois) — Inscription au Registre AYA (registre public d'entités certifiées) + ASR hébergé + mises à jour
3. **Pack PRO** (499 CHF one-shot) — 5 fichiers ASR complets (ASR-Protocol, manifest, faq, glossary, external_context) + 3 ans de Registre AYA offerts

### Concepts clés

| Terme | Définition |
|-------|-----------|
| **AYO** | Le chatbot IA qui réalise le diagnostic. Utilise Google Gemini comme LLM. |
| **AIO Score** | Score 0-100, déterministe, basé sur 7 blocs pondérés (la "Bible AIO"). |
| **AYA** | Registre public des entités certifiées (Firestore `aya_registry`). |
| **ASR** | AI Singular Record — fichier JSON-LD signé Ed25519, identité numérique de l'entité. |
| **Bible AIO** | Document de référence définissant les 7 blocs et leurs poids. Fichier : `AYO_BIBLE.md`. |
| **Hard cap** | Pas de JSON-LD + pas d'AYA → score max 50. Pas d'ASR → max 90. |
| **q values** | Qualité de chaque donnée extraite : 0 (absent/nul), 0.5 (vague), 1 (concret/vérifié). |

### Les 7 blocs AIO (pondération)

| Bloc | Poids | Champs principaux |
|------|-------|-------------------|
| 1. Identité & Ancrage | /10 | name, legal_name, business_type, city, country, contact |
| 2. Clarté de l'Offre | /20 | services, products, use_cases, target_audience, pricing |
| 3. Processus & Méthodes | /15 | process_steps, delivery_mode, geographies, quality_assurance |
| 4. Confiance & Conformité | /15 | certifications, policies, frameworks, security_measures |
| 5. Indicateurs | /20 | key_indicators (chiffrés), last_review_date |
| 6. Pédagogie | /10 | has_faq, has_glossary, has_documentation |
| 7. Socle Technique | /10 | has_jsonld, has_asr, has_sitemap, mobile_optimized |

---

## 2. STACK TECHNIQUE

### Core

| Technologie | Version | Usage |
|-------------|---------|-------|
| Next.js | 16.0.10 | Framework fullstack (App Router) |
| React | 19.2.1 | Frontend |
| TypeScript | ^5 | Typage |
| Tailwind CSS | ^4 | Styles (+ beaucoup d'inline styles legacy) |
| Supabase | @supabase/supabase-js | Base de données PostgreSQL |
| Stripe | ^20.3.1 | Paiements (checkout + subscriptions) |
| Resend | ^6.6.0 | Envoi d'emails transactionnels |
| Vercel | — | Hosting + serverless + cron |
| Google Gemini | via @ai-sdk/google | LLM pour le chatbot AYO et génération sémantique |
| TweetNaCl | ^1.0.3 | Signature Ed25519 pour ASR |
| Zod | ^4.1.13 | Validation schemas |
| JSZip | ^3.10.1 | Génération ZIP pour le Pack PRO |

### Hébergement

- **Frontend + API** : Vercel (serverless functions, maxDuration=120s)
- **Base de données** : Supabase PostgreSQL (https://hxoywzhrvacdmtopureh.supabase.co)
- **Emails** : Resend (hello@ai-visionary.com)
- **Paiements** : Stripe (mode live, CHF)
- **Domaine** : ai-visionary.com

### Variables d'environnement requises

```
# Supabase
SUPABASE_URL=https://hxoywzhrvacdmtopureh.supabase.co
SUPABASE_SERVICE_ROLE_KEY

# Stripe
STRIPE_SECRET_KEY
STRIPE_WEBHOOK_SECRET
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
STRIPE_PRICE_AYA=price_1SzazaPkCQYUm8hQJfrKc9EJ   # PACK PLATEFORME (19 CHF/mois)
STRIPE_PRICE_PRO=price_1SlM9iPkCQYUm8hQKqOV8eqU  # PACK PRO (499 CHF)

# Gemini
GOOGLE_GENERATIVE_AI_API_KEY (ou GEMINI_API_KEY — ⚠️ 2 vars actuellement)

# Email
RESEND_API_KEY

# Sécurité
ADMIN_SECRET
SESSION_SECRET (⚠️ manque — utilise ADMIN_SECRET en fallback)
AYO_SIGNING_KEY (clé Ed25519 — ⚠️ actuellement hardcodée dans ayo-crypto.ts)

# URL
NEXT_PUBLIC_BASE_URL=https://ai-visionary.com
```

---

## 3. ARBORESCENCE FICHIERS (TOUS les fichiers source)

### API Routes

| Fichier | Rôle | Lignes | État |
|---------|------|--------|------|
| `app/api/chat/route.ts` | **COEUR** — Chatbot AYO, tout le flux diagnostic | ~2800 | ✅ Questionnaire statique, scoring strict |
| `app/api/webhooks/checkout-success/route.ts` | Webhook Stripe post-paiement → génère fichiers + email | ~477 | ✅ Score corrigé |
| `app/api/create-checkout/route.ts` | Création session Stripe Checkout | 137 | OK |
| `app/api/light-report/route.ts` | Envoi Pack Light gratuit | 234 | ⚠️ Scores reconstructs artificiellement |
| `app/api/auth/send-otp/route.ts` | Envoi OTP par email | 82 | OK |
| `app/api/auth/verify-otp/route.ts` | Vérification OTP | 90 | ⚠️ Token basé sur ADMIN_SECRET |
| `app/api/stripe/portal/route.ts` | Stripe Billing Portal | 89 | 🔴 SANS AUTHENTIFICATION |
| `app/api/admin/logs/route.ts` | API admin logs Firestore | 66 | OK |
| `app/api/admin/fix-sectors/route.ts` | Fix secteurs admin | — | OK |
| `app/api/aya/live/route.ts` | API publique entités AYA | 24 | ⚠️ Pas de pagination |
| `app/api/debug/clean/route.ts` | Nettoyage admin AYA | 64 | OK (protégé) |
| `app/api/debug/email/route.ts` | Test email Resend | 46 | ⚠️ Non protégé |
| `app/api/debug/test-ayo/route.ts` | Test pipeline AYO sans Stripe | 174 | ⚠️ Non protégé |
| `app/api/webhooks/checkout-success-fix.ts` | ❌ CODE MORT — à supprimer | — | Supprimer |
| `app/api/webhooks/test-webhook/route.ts` | Test webhook | — | Debug |

### Librairies / Modules

| Fichier | Rôle | Lignes | État |
|---------|------|--------|------|
| `lib/ayo-system-prompt.ts` | System prompt V3 du chatbot | 104 | ⚠️ À réécrire (V4) |
| `lib/aio-score-engine.ts` | Moteur de score déterministe (7 blocs) | 319 | ✅ Conforme à la Bible (hard cap invisible) |
| `lib/aio-scanner.ts` | Scanner URL — HTML, JSON-LD, ASR, AYA | 179 | ✅ Anti-SSRF ajouté, M4 fixé (vérifie aya_registry) |
| `lib/ayo-generators.ts` | Générateurs des 5 fichiers PRO (partagés chat+webhook) | 677 | ✅ OK |
| `lib/ayo-crypto.ts` | Signature Ed25519 + génération ASR JSON-LD | 399 | ⚠️ Clé hardcodée |
| `lib/ayo-semantics.ts` | Génération FAQ/Glossaire/Manifest via Gemini 1.5 Flash | 132 | ✅ JSON validation, timeout 30s, GEMINI_API_KEY unique |
| `lib/ayo-categories.ts` | Taxonomie 25 secteurs d'activité | 40 | ✅ OK |
| `lib/external-context.ts` | Génération external_context JSON | 64 | ✅ Fake rating supprimé, permissions simplifiées |
| `lib/db.ts` | Supabase PostgreSQL operations (lazy-init, merge strategy) | 418 | ✅ Migré de Firestore |
| `lib/auth.ts` | Middleware admin (ADMIN_SECRET, timing-safe) | — | ✅ OK |
| `lib/logger.ts` | Logger structuré avec correlation IDs | — | ✅ OK |
| `lib/rate-limit.ts` | Rate limiting in-memory par IP | — | ✅ Créé mais PAS encore appliqué |
| `lib/validators.ts` | Schemas Zod (URL, email, OTP, SSRF) | — | ✅ Créé mais PAS encore appliqué |
| `lib/sanitize.ts` | Sanitizer anti-injection LLM | — | ✅ OK |
| `lib/aya/registry.ts` | Module registre AYA (registerOrUpdateEntity) | 125 | ✅ OK |
| `lib/aya/schema.ts` | Interface AyaEntity (Firestore) | 43 | ✅ OK |
| `lib/asr-emit-mode.ts` | Blueprint pipeline ASR | 78 | 🔴 PSEUDO-CODE — pas implémenté |
| `lib/asr-seal-spec.ts` | Interfaces TypeScript ASR | 45 | 🔴 TYPES SEULS |
| `lib/asr-compliance-test.ts` | Blueprint test conformité ASR | 85 | 🔴 PSEUDO-CODE |

### Pages Frontend

| Fichier | Rôle | État |
|---------|------|------|
| `app/page.tsx` | Homepage — 9 sections, pricing, CTA (320 lignes) | ✅ Fonctionnel, styles inline |
| `app/diagnostic/page.tsx` | Page chat AYO fullscreen (36 lignes) | ✅ OK, pas de SEO |
| `app/aya/page.tsx` | **REGISTRE AYA PUBLIC** (205 lignes) | ✅ OK — manque pagination/filtres |
| `app/aya/e/[id]/page.tsx` | **CERTIFICAT AYA** — page détail (216 lignes) | ✅ EXISTE — manque JSON-LD, blocs score |
| `app/certificate/[id]/page.tsx` | ~~Ancien certificat~~ | 🗑️ SUPPRIMÉ (Session 3 — B4) |
| `app/ai-et-votre-entreprise/page.tsx` | Page marketing (179 lignes) | ✅ OK, styles inline |
| `app/confidentialite/page.tsx` | Politique de confidentialité (35 lignes) | ⚠️ TROP COURTE |
| `app/mentions/page.tsx` | Mentions légales (33 lignes) | ⚠️ TROP COURTE |
| `app/admin/logs/page.tsx` | Dashboard admin logs | ✅ OK |

### Composants React

| Fichier | Rôle | État |
|---------|------|------|
| `app/components/AyoChat.tsx` | Chat interactif principal (~52KB) | ⚠️ Markdown non-sanitisé (XSS), types `any[]` |
| `app/components/PaymentHandler.tsx` | No-op (H9 fix — webhook déplacé dans Modal) | ✅ Neutralisé |
| `app/components/PaymentSuccessModal.tsx` | Modal post-paiement + webhook unique | ✅ H9 fixé, M8 session_id validé, Essential→Plateforme |
| `app/components/FAQ.tsx` | FAQ component | ✅ OK |
| `app/components/Footer.tsx` | Footer avec drapeau suisse | ✅ OK |

### Fichiers de config

| Fichier | Notes |
|---------|-------|
| `vercel.json` | maxDuration=120s pour checkout-success et chat |
| `next.config.ts` | ✅ `ignoreBuildErrors: false` + CSP header |
| `app/robots.ts` | ✅ Disallow /admin/, /api/, /debug/, /certificate/ |
| `app/sitemap.ts` | ⚠️ MOCK avec 2 entity IDs hardcodés |

---

## 4. FLUX PRINCIPAL (Comment ça marche)

```
1. Utilisateur → /diagnostic
2. AYO demande l'URL
3. Scanner (aio-scanner.ts) analyse le site (HTML, JSON-LD, AYA, ASR)
4. Score initial calculé par le moteur (aio-score-engine.ts) → 7 blocs
5. AYO affiche le score initial
6. AYO pose 10-20 questions STATIQUES (templates prédéfinis, PAS de LLM)
7. LLM extrait les réponses en JSON structuré (q values)
8. Score enrichi recalculé
9. AYO affiche le delta (avant/après)
10. Capture email → Proposition AYA (19 CHF/mois) ou PRO (499 CHF)
11. Utilisateur clique → Stripe Checkout
12. Paiement OK → Webhook Stripe
13. Webhook → Récupère données Firestore → Génère fichiers → Envoie email
```

### Stripe Price IDs

| Pack | Price ID | Mode |
|------|----------|------|
| AYA Sub (19 CHF/mois) | `price_1SzazaPkCQYUm8hQJfrKc9EJ` | subscription |
| PRO (499 CHF) | `price_1SlM9iPkCQYUm8hQKqOV8eqU` | payment |

### Les 5 fichiers du Pack PRO

| # | Fichier | Générateur |
|---|---------|-----------|
| 1 | `ASR-Protocol.json` | `ayo-crypto.ts:generateRealAsrJson()` |
| 2 | `manifest.json` | `ayo-generators.ts:generateManifestJson()` |
| 3 | `faq.json` | `ayo-generators.ts:generateFaqJson()` |
| 4 | `glossary.json` | `ayo-generators.ts:generateGlossaryJson()` |
| 5 | `external_context.json` | `ayo-generators.ts:generateExternalContextJsonLocal()` |

---

## 5. BUGS CORRIGÉS (Session 4)

| Bug | Statut | Correction |
|-----|--------|-----------|
| LLM force q=1 sur réponses vagues | ✅ Corrigé | Scoring strict : "oui" brut = q=0.5 max |
| Hard cap invisible (blocs=95 total=50) | ✅ Corrigé | Cap à 78 sans preuves externes, affiché |
| Score 0 dans l'email webhook | ✅ Corrigé | Données persistées progressivement dans Supabase |
| Double appel webhook | ✅ Corrigé (Session 3) | PaymentHandler neutralisé |
| Questions LLM aléatoires/incohérentes | ✅ Corrigé | Questions statiques (ENRICHMENT_TEMPLATES) |
| Email non sauvé en top-level Supabase | ✅ Corrigé | Extraction contact_email → colonne email |
| Boucle infinie questions preuve | ✅ Corrigé | Questions preuve supprimées |
| "Plombier urgence Lyon" comme documentation | ✅ Corrigé | Scanner filtre les exemples marketing |

---

## 6. FAILLES DE SÉCURITÉ (23 restantes)

### Critiques (2)
- C1 : Token session basé sur ADMIN_SECRET (fallback) → `verify-otp/route.ts`
- C2 : Price IDs hardcodés → `create-checkout/route.ts`

### Hautes (11)
- H1 : Erreurs internes exposées au client
- H2 : `ignoreBuildErrors: true` dans next.config
- H3 : Pas d'anti-SSRF dans le scanner
- H4 : Rate limiting créé mais non appliqué
- H5 : Endpoints debug non protégés
- H6 : Validation Zod créée mais non appliquée
- H7 : **Stripe Portal SANS auth** → `stripe/portal/route.ts`
- H8 : Markdown non-sanitisé dans AyoChat (XSS)
- H9 : PaymentHandler + PaymentSuccessModal dupliquent l'appel
- H10 : Gemini API sans validation JSON → `ayo-semantics.ts`
- H11 : Gemini API sans timeout → `ayo-semantics.ts`

### Moyennes (8)
- M1 : Pas de CSP header
- M2 : Email en clair dans Stripe metadata
- M3 : `dangerouslySetInnerHTML` dans layout
- M4 : Scanner vérifie mauvaise collection (`analyses` au lieu de `aya_registry`)
- M5 : external-context fake rating 4.5
- M6 : robots.txt n'exclut pas /admin/ ni /api/
- M7 : vercel.json maxDuration peut être court
- M8 : session_id Stripe non validé dans PaymentSuccessModal

### Basses (6)
- B1 : Index Firestore manquants
- B2 : Code mort (`checkout-success-fix.ts`)
- B3 : `@ts-ignore` x22
- B4 : Doublon page certificat
- B5 : Types `any[]` dans AyoChat
- B6 : 2 variables env pour Gemini API key

---

## 7. PLAN DE REMÉDIATION (10 Sprints)

Le plan complet est dans **`PLAN-ACTION-AYO-COMPLET.md`** (20 sections, ~1460 lignes).

### Résumé des sprints

| Sprint | Contenu | Risque |
|--------|---------|--------|
| 1 | Logger + Dashboard Admin | 🟢 Zéro (fichiers nouveaux) |
| 2 | 4 failles critiques (clé Ed25519, webhook, tokens, debug) | 🟡 Faible |
| 3 | 7 failles hautes (erreurs, Zod, SSRF, rate limit, auth) | 🟡 Faible |
| 4 | 5 failles moyennes (sanitize LLM, headers, index) | 🟡 Faible |
| 5 | **Rewrite prompt chat** (3 phases, scoring, questionnaire universel) | 🔴 Critique — cœur du produit |
| 6 | Fix webhook + flux complet (Score 0, email, pack detection) | 🟡 Moyen |
| 7 | Modules sémantiques (ayo-semantics, external-context, ASR crypto) | 🟡 Moyen |
| 8 | Pages AYA + certificat + lifecycle (MAJ, renouvellements) | 🟡 Moyen |
| 9 | UI/SEO/sitemap/robots + pages légales complètes | 🟢 Faible |
| 10 | Tests intégration + build propre + nettoyage code mort | 🟢 Faible |

### État d'avancement

| Sprint | Statut |
|--------|--------|
| Sprint 1 | ❌ Pas commencé |
| Sprint 2 | ❌ Pas commencé |
| Sprint 3 | ❌ Pas commencé |
| Sprint 4 | ❌ Pas commencé |
| Sprint 5 | ❌ Pas commencé |
| Sprint 6 | ❌ Pas commencé |
| Sprint 7 | ❌ Pas commencé |
| Sprint 8 | ❌ Pas commencé |
| Sprint 9 | ❌ Pas commencé |
| Sprint 10 | ❌ Pas commencé |

> **METTRE À JOUR CE TABLEAU** après chaque sprint complété.

### Organisation du travail en SESSIONS

Les sprints sont regroupés en **sessions de travail Claude Code** de 2-3h chacune.
Chaque session peut être lancée de manière autonome (Claude lit ce fichier et sait quoi faire).
**Cyril doit être présent pour la Session 4** (réécriture du cœur du produit).

| Session | Sprints | Contenu | Durée estimée | Risque | Cyril requis ? |
|---------|---------|---------|---------------|--------|----------------|
| **Session 1** | Sprint 1 | Logger + Dashboard Admin → que des fichiers NOUVEAUX, zéro modification de l'existant | ~2h | 🟢 Zéro | Non |
| **Session 2** | Sprint 2 | Failles critiques → corrections chirurgicales (1 ligne ici, 1 ligne là) | ~2h | 🟡 Faible | Non |
| **Session 3** | Sprint 3 + 4 | Failles hautes + moyennes → appliquer rate-limit, Zod, SSRF, CSP, protéger debug | ~4h | 🟡 Faible | Non |
| **Session 4** | Sprint 5 | ✅ **REWRITE QUESTIONNAIRE** — Questions statiques (ENRICHMENT_TEMPLATES), scoring strict, sanitizers fichiers, migration Supabase | ~8h | 🔴 Critique | Fait avec Cyril |
| **Session 5** | Sprint 6 | ✅ Fix webhook + Bug Score 0 + emails + fusion PaymentHandler | ~3h | 🟡 Moyen | Non |
| **Session 6** | Sprint 7 | ❌ Modules sémantiques — affiner les sanitizers, améliorer la qualité des 5 fichiers Pack PRO | ~3h | 🟡 Moyen | Non |
| **Session 7** | Sprint 8 | ❌ Pages AYA + certificat + cycle de vie client (MAJ, renouvellements, crons) — page /aya 404 à créer | ~3h | 🟡 Moyen | Non |
| **Session 8** | Sprint 9 + 10 | ❌ UI/SEO/sitemap/robots + pages légales + tests E2E automatisés + nettoyage | ~3h | 🟢 Faible | Non |

**Protocole pour chaque session** :
1. Vérifier la branche : `git checkout fix/remediation`
2. Lire ce tableau → identifier la prochaine session non complétée
3. Lire le détail du sprint dans `PLAN-ACTION-AYO-COMPLET.md`
4. Travailler, commiter après chaque tâche (`git commit`)
5. Vérifier le build : `npm run build`
6. Pusher : `git push origin fix/remediation`
7. **Mettre à jour le tableau d'avancement ci-dessus** (changer ❌ en ✅)
8. Si quelque chose casse → revenir au commit précédent, documenter le problème

**IMPORTANT** : Ne JAMAIS merger dans `main` sans validation de Cyril. La branche `fix/remediation` est l'espace de travail sécurisé.

### État des sessions

| Session | Statut | Date | Notes |
|---------|--------|------|-------|
| Session 1 | ✅ **TERMINÉE** | 2026-03-14 | Logger/rate-limit/validators/auth intégrés dans les 11 routes API. Build OK. |
| Session 2 | ✅ **TERMINÉE** | 2026-03-14 | C1+C2 critiques, H1-H3 hautes, M1+M2+M6 moyennes. CSP, anti-SSRF, ignoreBuildErrors:false. ⚠️ AJOUTER env vars: SESSION_SECRET, STRIPE_PRICE_PRO sur Vercel (Essential supprimé — n'existe plus) |
| Session 3 | ✅ **TERMINÉE** | 2026-03-15 | H9 double webhook fix, H10 JSON validation, H11 timeout 30s, M4 scanner aya_registry, M5 fake rating supprimé, M8 session_id validation, B2+B4 dead code supprimé, B6 env var unique, Essential→Plateforme, scripts debug supprimés, tsconfig exclude scripts/, Vercel deploy OK |
| Session 4 | ✅ **TERMINÉE** | 2026-03-19→23 | Rewrite complet questionnaire : questions statiques (ENRICHMENT_TEMPLATES), migration Firestore→Supabase, scoring strict (cap 78), sanitizers fichiers (form contamination, marketing, Etc., MAJUSCULES), suppression questions de preuve, fix multi-select+Autre, ~400 lignes dead code supprimées (/simplify) |
| Session 5 | ✅ **TERMINÉE** | 2026-03-15 | PaymentSuccessModal: stop calling webhook from browser (UX fix — users saw false "erreur technique"). Webhook: refuse empty generation, send apology email + return 422. Light-report: remove fake block scores. create-checkout: include analysisId in client_reference_id. |
| Session 6 | ❌ Pas commencée | — | Modules sémantiques |
| Session 7 | ❌ Pas commencée | — | Pages AYA + certificat (page /aya 404) |
| Session 8 | ❌ Pas commencée | — | UI/SEO + tests E2E |

> **METTRE À JOUR CE TABLEAU** après chaque session complétée (statut + date + notes).

---

## 8. BRANCHES GIT

| Branche | Rôle |
|---------|------|
| `main` | Code de production (à jour au 13 mars 2026) |
| `fix/remediation` | Branche de travail pour les 10 sprints |
| `restore-vercel-24jan` | Ancienne branche de travail (fusionnée dans main) |

**Workflow** : Travailler sur `fix/remediation`, commiter souvent, ne merger dans `main` qu'après validation.

---

## 9. BASE DE DONNÉES SUPABASE

**URL** : `https://hxoywzhrvacdmtopureh.supabase.co`
**Accès** : `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` (dans `.env.local` et Vercel)

| Table | Usage |
|-------|-------|
| `analyses` | Résultats de diagnostic AYO (scores, données extraites, email, URL) |
| `aya_registry` | Entités AYA actives (certifiées, payées) |
| `scan_states` | États intermédiaires du scan pour récupération |
| `system_logs` | Logs système |
| `otp_codes` | Codes OTP temporaires pour authentification |
| `sessions` | Sessions utilisateur |

> **Migration Firestore → Supabase** effectuée mars 2026. Ne PAS utiliser Firebase/Firestore.

---

## ARCHITECTURE QUESTIONNAIRE (Mars 2026)

### Questions STATIQUES (plus de LLM)
- Toutes les questions définies dans `ENRICHMENT_TEMPLATES` (greffier.ts)
- `buildValidationQuestion()` — données scan → Oui/Non confirmation
- `buildEnrichmentQuestion()` — données manquantes → template statique
- Gemini LLM utilisé UNIQUEMENT pour extraction/scoring, PAS pour les questions

### Règles du validateur (route.ts)
- "Avez-vous/Disposez-vous" → forcées en Oui/Non
- Champs texte (email, phone, legal_name) → `inputType: "text"`, pas de boutons
- `TEXT_INPUT_FIELD_NAMES` et `BOOLEAN_FIELD_NAMES` dérivés de ENRICHMENT_TEMPLATES
- Parasites LLM (feedback, satisfaction) → bloqués

### Scoring strict (aio-score-engine.ts)
- Score cappé à 78 max sans preuves externes
- Certifications vides → conformité max 8/15
- KPIs sans chiffres → indicateurs max 8/20
- "Oui" brut = q=0.5 max, jamais q=1

### Sanitizers fichiers (ayo-crypto.ts, ayo-generators.ts)
- Filtrer "Etc." de tous les tableaux
- Supprimer questions formulaire dans données ("Possédez-vous..." → supprimé)
- Nettoyer MAJUSCULES, numérotation parasite, guillemets échappés
- quality_assurance : filtrer promesses marketing

### NE JAMAIS FAIRE
- Modifier le CSS/design sans accord de Cyril
- Générer des questions via LLM (utiliser templates statiques)
- Dire "c'est fait" sans test E2E vérifié sur le site live
- Pusher sur main sans accord explicite
- Demander des preuves/URLs dans le questionnaire

### Bugs corrigés récemment
- ✅ Page `/aya` existe (mais manque pagination/filtres) → Session 7
- ✅ Scoring timeout → maxDuration=120s + fallback déterministe
- ✅ Pack selection → sanitization caractères spéciaux dans intro

---

## 10. CONVENTIONS & RÈGLES

### Langue
- **Code** : anglais (variables, fonctions, commentaires)
- **UI / contenu** : français
- **Répondre à Cyril** : en français

### Style
- Palette : teal (#4A919E), navy (#212E53), sage (#BED3C3), coral (#CE6A6B), salmon (#EBACA2)
- UI moderne, tons doux
- Beaucoup de styles inline legacy (migration Tailwind progressive)

### Sécurité
- **JAMAIS** de secrets dans le code
- **JAMAIS** de `console.log` avec des données sensibles
- Utiliser `lib/logger.ts` pour le logging
- Toujours valider les inputs avec `lib/validators.ts`
- Toujours appliquer le rate limiting avec `lib/rate-limit.ts`

### Git
- Commiter souvent avec des messages descriptifs
- Travailler sur `fix/remediation`, pas sur `main`
- Vérifier `npm run build` avant de commiter

### Le fichier .gitignore exclut
- `.env*`, `ADMIN_SECRETS*`, `.claude/`
- Tous les scripts de debug/test à la racine (`check*.js`, `test-*.ts`, etc.)

---

## 11. COMMANDES UTILES

```bash
# Développement
npm run dev          # Serveur local Next.js
npm run build        # Build de production
npm run lint         # Linting ESLint

# Déploiement
vercel --prod        # Deploy sur Vercel (prod)
vercel               # Deploy preview

# Git
git checkout fix/remediation   # Branche de travail
git push origin fix/remediation
```

---

## 12. CE QUI A ÉTÉ FAIT (Historique)

### Mars 2026 — Session de planification
1. ✅ Audit complet de ~100 fichiers du projet
2. ✅ Création du plan de remédiation `PLAN-ACTION-AYO-COMPLET.md` (20 sections, 10 sprints)
3. ✅ Nettoyage Git : fusion `restore-vercel-24jan` → `main`, force-push
4. ✅ Mise à jour `.gitignore` (secrets, debug scripts, .claude/)
5. ✅ Suppression de 17 scripts de debug du tracking Git
6. ✅ Création de la branche `fix/remediation`
7. ✅ Création de ce fichier `CLAUDE.md`

### Avant mars 2026 (par Cyril + Claude)
- Création de `lib/auth.ts`, `lib/logger.ts`, `lib/rate-limit.ts`, `lib/validators.ts`, `lib/sanitize.ts`
- Fix de la vérification webhook Stripe (suppression fallback)
- Fix des placeholders LLM dans les fichiers générés
- Fix du sanitizer récursif
- Fix de l'affichage du registre AYA (entreprises fictives supprimées, seulement les payantes)

---

## 13. POUR REPRENDRE LE TRAVAIL

### Ordre recommandé
1. Lire ce fichier CLAUDE.md (fait automatiquement)
2. Vérifier la branche : `git checkout fix/remediation`
3. Lire le tableau d'avancement (section 7) pour savoir quel sprint faire
4. Lire la section correspondante dans `PLAN-ACTION-AYO-COMPLET.md`
5. Travailler, commiter, mettre à jour le tableau d'avancement ici

### Si le build casse
```bash
npm run build 2>&1 | head -50   # Voir les erreurs
```
Note : `ignoreBuildErrors: true` est activé dans `next.config.ts` — le build passera même avec des erreurs TS. C'est un bug de sécurité (H2) à corriger dans le Sprint 3.

### Fichiers les plus critiques à lire en priorité
1. `app/api/chat/route.ts` — Le cœur du chatbot (2750 lignes)
2. `lib/aio-score-engine.ts` — Le moteur de scoring
3. `app/api/webhooks/checkout-success/route.ts` — Le webhook Stripe
4. `PLAN-ACTION-AYO-COMPLET.md` — Le plan de remédiation complet

---

## 14. DÉTAIL DES FONCTIONNALITÉS — État, Commentaires, Reste à Faire

### 14.1 CHATBOT AYO (Diagnostic IA)

**Fichiers** : `app/api/chat/route.ts` (2750 lignes), `lib/ayo-system-prompt.ts`, `app/diagnostic/page.tsx`, `app/components/AyoChat.tsx`

**Comment ça marche** :
- L'utilisateur donne son URL sur `/diagnostic`
- `AyoChat.tsx` est le composant React qui gère l'interface chat (streaming SSE)
- `chat/route.ts` est la route API qui orchestre tout :
  - Phase 1 : Reçoit l'URL → appelle `aio-scanner.ts` → calcule le score initial via `aio-score-engine.ts`
  - Phase 2 : Le LLM pose des questions (questionnaire) → extrait les réponses en JSON structuré avec des `q values`
  - Phase 3 : Recalcule le score enrichi → affiche le delta → capture l'email → propose les packs
- Le system prompt est dans `ayo-system-prompt.ts` (104 lignes, version V3)
- Le prompt d'extraction LLM (130 lignes) est DANS `chat/route.ts` lui-même (lignes ~1826-1962)

**Ce qui fonctionne** :
- ✅ Le flux complet fonctionne de bout en bout (URL → scan → questions → score → paiement)
- ✅ Le streaming SSE fonctionne
- ✅ L'extraction JSON des réponses fonctionne (la plupart du temps)
- ✅ Le scoring est conforme à la Bible AIO (7 blocs, pondérations correctes)

**Ce qui est cassé / problématique** :
- 🔴 Le prompt d'extraction force `q=1` sur toutes les réponses (Bug #1)
- 🔴 Le LLM invente les questions au lieu de suivre un script structuré
- 🔴 Pas de validation sémantique des réponses (Bug #3)
- ⚠️ Le composant `AyoChat.tsx` ne sanitise pas le markdown (risque XSS)
- ⚠️ Types `any[]` partout dans AyoChat
- ⚠️ Pas de timeout sur les appels LLM
- ⚠️ Pas de mécanisme de retry si le LLM échoue

**Reste à faire (Sprint 5)** :
- Réécrire le system prompt V4 avec questionnaire universel structuré (18 questions par bloc)
- Supprimer "SET q=1" du prompt d'extraction
- Créer `lib/semantic-validator.ts` pour valider les réponses
- Rendre le hard cap de score transparent (afficher le plafond)
- Adapter l'affichage du delta avant/après

---

### 14.2 MOTEUR DE SCORING AIO

**Fichier** : `lib/aio-score-engine.ts` (319 lignes)

**Comment ça marche** :
- Reçoit un objet `extractedData` avec tous les champs extraits (du scan + questionnaire)
- Calcule un score par bloc (7 blocs) selon les poids de la Bible AIO
- Chaque champ a un `q value` (0, 0.5, 1) qui pondère sa contribution
- Applique des hard caps :
  - Pas de JSON-LD + pas d'AYA → max 50/100
  - Pas d'ASR → max 90/100
- Retourne un objet avec les 7 scores de blocs + le total

**Ce qui fonctionne** :
- ✅ Les formules sont conformes à la Bible AIO
- ✅ Les hard caps fonctionnent correctement
- ✅ Les pondérations sont correctes

**Ce qui est cassé / problématique** :
- 🔴 Le hard cap est INVISIBLE — les scores de blocs sont affichés sans le cap, mais le total est cappé → contradiction visible pour l'utilisateur (Bug #2)
- ⚠️ Pas de champ `raw_total` retourné (score avant cap)
- ⚠️ Pas de champ `cap_reason` retourné

**Reste à faire (Sprint 5)** :
- Ajouter `raw_total` et `cap_applied` et `cap_reason` dans le retour
- Le chat doit afficher le message de plafond technique quand le cap s'applique

---

### 14.3 SCANNER URL

**Fichier** : `lib/aio-scanner.ts` (179 lignes)

**Comment ça marche** :
- Reçoit une URL → fetch le HTML
- Parse le HTML pour extraire : `<title>`, `<meta description>`, JSON-LD (`<script type="application/ld+json">`)
- Vérifie si un fichier ASR existe (`.ayo/asr.json`)
- Vérifie si l'entité est dans le registre AYA (⚠️ vérifie `analyses` au lieu de `aya_registry`)
- Vérifie sitemap.xml, mobile-friendly

**Ce qui fonctionne** :
- ✅ Le fetch HTML fonctionne
- ✅ L'extraction JSON-LD fonctionne
- ✅ La détection ASR fonctionne

**Ce qui est cassé / problématique** :
- 🔴 Pas d'anti-SSRF — un utilisateur peut scanner localhost, 127.0.0.1, ou des IPs internes (faille H3)
- 🔴 Vérifie AYA dans la collection `analyses` au lieu de `aya_registry` (faille M4)

**Reste à faire (Sprint 3)** :
- Appliquer `isAllowedUrl()` de `lib/validators.ts` avant le fetch
- Corriger la requête AYA pour utiliser `aya_registry`

---

### 14.4 WEBHOOK STRIPE (Post-paiement)

**Fichier** : `app/api/webhooks/checkout-success/route.ts` (477 lignes)

**Comment ça marche** :
- Reçoit l'événement `checkout.session.completed` de Stripe
- Vérifie la signature Stripe (sécurisé ✅)
- Décode `client_reference_id` → récupère URL, email, analysisId
- Cascade de recherche dans Firestore : analysisId → URL → email → scan_states
- Détecte le pack acheté par le price_id (env vars) avec fallback mode (subscription/payment)
- Pour le Pack PRO : génère les 5 fichiers via `ayo-generators.ts`, les zippe, envoie par email
- Pour AYA Sub : inscrit dans le registre AYA, envoie email de confirmation

**Ce qui fonctionne** :
- ✅ Vérification signature Stripe (corrigé, plus de fallback)
- ✅ Génération des 5 fichiers
- ✅ ZIP et envoi par email via Resend
- ✅ Inscription AYA

**Ce qui est cassé / problématique** :
- 🔴 **Bug Score 0** : Si la cascade Firestore ne trouve pas les données → email avec "Entreprise Inconnue" et score 0
  - Cause : Les données du chat ne sont pas toujours persistées dans Firestore avant le paiement
  - Cause 2 : L'analysisId dans `client_reference_id` ne correspond pas toujours à un document Firestore
- ⚠️ `PaymentHandler.tsx` ET `PaymentSuccessModal.tsx` appellent TOUS LES DEUX le webhook → double exécution possible
- ⚠️ La détection du pack utilise aussi le montant comme fallback (fragile si changement de prix)

**Reste à faire (Sprint 6)** :
- Persister l'email et les données du chat dans Firestore IMMÉDIATEMENT (pas à la fin)
- Le webhook doit REFUSER de générer si les données sont absentes → logger CRITICAL
- Fusionner PaymentHandler + PaymentSuccessModal en un seul composant
- Supprimer la détection par montant

---

### 14.5 SYSTÈME DE PAIEMENT STRIPE

**Fichiers** : `app/api/create-checkout/route.ts`, `app/api/stripe/portal/route.ts`, `app/components/PaymentHandler.tsx`, `app/components/PaymentSuccessModal.tsx`

**Comment ça marche** :
- `create-checkout` crée une session Stripe Checkout avec les metadata (URL, email, analysisId en base64)
- Après paiement → Stripe redirige vers la page avec `session_id` en query param
- `PaymentHandler.tsx` (invisible) appelle le webhook côté client
- `PaymentSuccessModal.tsx` affiche le modal de succès et appelle AUSSI le webhook
- `stripe/portal` crée une session Stripe Customer Portal pour gérer l'abonnement

**Ce qui fonctionne** :
- ✅ Checkout Stripe fonctionne (live, CHF)
- ✅ Les 2 packs (AYA_SUB 19 CHF/mois, PRO 499 CHF one-shot) sont gérés — Essential supprimé

**Ce qui est cassé / problématique** :
- 🔴 **Stripe Portal SANS AUTHENTIFICATION** — n'importe qui avec un customer_id peut accéder au portal de n'importe quel client (faille H7)
- 🔴 Double appel webhook (PaymentHandler + PaymentSuccessModal)
- ⚠️ Price IDs hardcodés dans le code au lieu d'env vars (faille C2)
- ⚠️ `PaymentHandler` n'a aucun error handling, échecs silencieux
- ⚠️ `PaymentSuccessModal` ne valide pas le format du session_id

**Reste à faire** :
- Sprint 2 : Déplacer price IDs vers env vars
- Sprint 3 : Ajouter auth OTP/session au Stripe Portal
- Sprint 6 : Fusionner PaymentHandler + PaymentSuccessModal

---

### 14.6 REGISTRE AYA (Entités certifiées)

**Fichiers** : `lib/aya/registry.ts`, `lib/aya/schema.ts`, `app/aya/page.tsx`, `app/aya/e/[id]/page.tsx`, `app/api/aya/live/route.ts`

**Comment ça marche** :
- `registry.ts` : `registerOrUpdateEntity()` inscrit/met à jour une entité dans Firestore `aya_registry`
- `schema.ts` : Interface TypeScript `AyaEntity` avec les champs (entity_id, display_name, website, score, etc.)
- `app/aya/page.tsx` : Page publique du registre — grille d'entités avec recherche
- `app/aya/e/[id]/page.tsx` : Page détail certificat d'une entité
- `api/aya/live` : API qui retourne toutes les entités actives

**Ce qui fonctionne** :
- ✅ Inscription AYA après paiement
- ✅ Page registre avec recherche
- ✅ Page certificat avec détails
- ✅ Seules les entités payantes s'affichent

**Ce qui manque** :
- ❌ Pagination sur la page registre (charge tout d'un coup)
- ❌ Filtres avancés (par secteur, score, localisation)
- ❌ Tri (par score, date, alphabétique)
- ❌ JSON-LD dans le HEAD des pages (pour que les bots IA les lisent)
- ❌ Badge AYA téléchargeable
- ❌ Affichage des 7 blocs de score individuels sur le certificat
- ❌ Statut visuel (Actif / Expiring / Expiré)
- ❌ Doublon `app/certificate/[id]/page.tsx` à supprimer

**Reste à faire (Sprint 8)** :
- Améliorer page registre (pagination, filtres, tri)
- Améliorer page certificat (JSON-LD, blocs score, statut)
- Supprimer le doublon certificate
- Implémenter le cycle de vie (MAJ annuelle, expiration, renouvellement)

---

### 14.7 GÉNÉRATION DES 5 FICHIERS PRO

**Fichiers** : `lib/ayo-generators.ts` (677 lignes), `lib/ayo-crypto.ts` (399 lignes), `lib/ayo-semantics.ts` (132 lignes), `lib/external-context.ts` (64 lignes)

**Comment ça marche** :
- `ayo-generators.ts` : Contient les générateurs partagés pour les 5 fichiers (manifest, FAQ, glossaire, external_context). Inclut un sanitizer (`sanitizeExtract`, `sanitizePayloadDeep`) qui nettoie les données LLM.
- `ayo-crypto.ts` : Génère l'ASR JSON-LD et le signe avec Ed25519 (TweetNaCl). Contient `generateRealAsrJson()`.
- `ayo-semantics.ts` : Utilise Gemini 1.5 Flash pour enrichir FAQ/Glossaire/Manifest avec du contenu sémantique.
- `external-context.ts` : Génère le fichier external_context.json (écosystème, canaux, keywords).

**Ce qui fonctionne** :
- ✅ Les 5 fichiers sont générés correctement quand les données d'entrée sont bonnes
- ✅ Le sanitizer détecte et corrige les placeholders LLM
- ✅ La signature Ed25519 fonctionne
- ✅ Le ZIP est généré et envoyé par email

**Ce qui est cassé / problématique** :
- 🔴 **Données d'entrée de mauvaise qualité** → Fix dépend du questionnaire universel (Sprint 5)
- 🔴 `ayo-crypto.ts` : Clé Ed25519 HARDCODÉE dans le code (faille sécurité) → Déplacer vers env var
- ⚠️ `ayo-semantics.ts` : 2 env vars pour l'API key Gemini, pas de validation JSON retour, pas de timeout
- ⚠️ `external-context.ts` : Fake rating 4.5 hardcodé, permissions détectées par string matching
- ⚠️ Les 3 fichiers ASR spec (`asr-emit-mode.ts`, `asr-seal-spec.ts`, `asr-compliance-test.ts`) sont du **PSEUDO-CODE** — blueprints non implémentés

**Reste à faire** :
- Sprint 2 : Déplacer la clé Ed25519 dans env var
- Sprint 7 : Fix ayo-semantics (validation JSON, timeout, 1 seule env var), fix external-context, implémenter les specs ASR

---

### 14.8 SYSTÈME D'EMAILS

**Fichiers** : webhook `checkout-success/route.ts` (templates inline), `light-report/route.ts`

**Comment ça marche** :
- **Email PRO** : Template HTML inline dans le webhook, envoyé via Resend avec ZIP en pièce jointe. Contient : certificat AYA, scores détaillés, diagnostic des manquements, code ASR JSON, guide d'installation.
- **Email AYA** : Template plus court, lien vers le certificat en ligne.
- **Email Light** : Envoyé par `light-report/route.ts`, contient un score reconstruit et un ASR basique.

**Ce qui fonctionne** :
- ✅ Envoi via Resend fonctionne
- ✅ Les templates HTML sont corrects visuellement
- ✅ ZIP en pièce jointe pour le Pack PRO

**Ce qui est cassé / problématique** :
- 🔴 Quand Bug Score 0 se produit → email avec "Entreprise Inconnue" et score 0
- ⚠️ Email Light reconstruit des scores artificiellement si les vrais sont absents
- ⚠️ Templates HTML inline (pas maintenables facilement)

**Reste à faire (Sprint 6)** :
- Résoudre le Bug Score 0 (persistence Firestore)
- Utiliser les vrais scores du moteur pour l'email Light

---

### 14.9 AUTHENTIFICATION / SÉCURITÉ

**Fichiers** : `lib/auth.ts`, `app/api/auth/send-otp/route.ts`, `app/api/auth/verify-otp/route.ts`, `lib/rate-limit.ts`, `lib/validators.ts`

**Comment ça marche** :
- `auth.ts` : Middleware `requireAdmin()` qui vérifie `ADMIN_SECRET` avec timing-safe comparison
- OTP : Envoi d'un code par email → vérification → génération d'un token JWT
- `rate-limit.ts` : Rate limiting in-memory par IP (créé mais PAS appliqué)
- `validators.ts` : Schemas Zod pour URL, email, OTP, SSRF (créé mais PAS appliqué)

**Ce qui fonctionne** :
- ✅ `requireAdmin()` protège les routes admin
- ✅ OTP envoi/vérification fonctionne
- ✅ Les modules rate-limit et validators sont créés et prêts

**Ce qui est cassé / problématique** :
- 🔴 `verify-otp` utilise `ADMIN_SECRET` comme fallback pour signer les tokens → Il faut un `SESSION_SECRET` dédié
- 🔴 Rate limiting et validation Zod ne sont appliqués **NULLE PART**
- 🔴 Les endpoints debug ne sont PAS protégés
- 🔴 `Stripe Portal` n'a AUCUNE authentification

**Reste à faire (Sprint 2-3)** :
- Exiger `SESSION_SECRET` dédié
- Appliquer rate limiting dans toutes les routes API
- Appliquer validation Zod dans toutes les routes API
- Protéger les endpoints debug avec `requireAdmin()`
- Ajouter auth au Stripe Portal

---

### 14.10 PAGES LÉGALES & SEO

**Fichiers** : `app/confidentialite/page.tsx`, `app/mentions/page.tsx`, `app/robots.ts`, `app/sitemap.ts`

**Ce qui existe** :
- ✅ Page confidentialité — mais 35 lignes seulement (pas de cookies, pas de sous-traitants, pas de rétention)
- ✅ Page mentions légales — mais 33 lignes (pas d'éditeur, pas d'hébergeur)
- ✅ robots.ts — mais n'exclut pas /admin/ ni /api/
- ✅ sitemap.ts — mais MOCK avec 2 entity IDs hardcodés

**Reste à faire (Sprint 9)** :
- Compléter confidentialité (RGPD suisse LPD, cookies, sous-traitants Firebase/Stripe/Resend/Vercel/Gemini)
- Compléter mentions légales (éditeur Cyril Leger, Genève, hébergeur Vercel)
- robots.ts : ajouter `Disallow: /admin/`, `Disallow: /api/`, `Disallow: /debug/`
- sitemap.ts : générer dynamiquement depuis les entités AYA Firestore

---

### 14.11 CYCLE DE VIE CLIENT (À CRÉER)

**Status** : ❌ N'EXISTE PAS ENCORE — documenté dans le plan, Sprint 8

**Ce qui est prévu** :
1. **MAJ annuelle** : Rappels email à J-30, J-7, J-0 + page de mise à jour pré-remplie
2. **Renouvellement AYA Sub** : Gestion des webhooks Stripe `invoice.payment_failed`, `customer.subscription.deleted`
3. **Expiration Pack PRO** (3 ans) : Rappels à J-90, J-30, J-7 + page de renouvellement
4. **Cron jobs Vercel** : 4 crons quotidiens/hebdomadaires pour les rappels et la synchronisation
5. **Dashboard client** (futur) : Espace personnel via OTP pour gérer ses données, scores, abonnement

**Fichiers à créer** :
- `app/update/[entityId]/page.tsx` — Page MAJ client
- `app/renew/[entityId]/page.tsx` — Page renouvellement
- `app/api/update-entity/route.ts` — API MAJ données
- `app/api/cron/review-reminders/route.ts` — Cron rappels MAJ
- `app/api/cron/expiry-reminders/route.ts` — Cron rappels expiration
- `app/api/cron/expire-entities/route.ts` — Cron désactivation expirés
- `app/api/webhooks/subscription/route.ts` — Webhook abonnements Stripe

**Champs Firestore à ajouter** : `last_update`, `next_review_due`, `pack_type`, `subscription_id`, `subscription_status`, `aya_expiry_date`, `aya_status`, `renewal_reminder_sent`

---

### 14.12 HOMEPAGE & PAGES MARKETING

**Fichiers** : `app/page.tsx` (320 lignes), `app/ai-et-votre-entreprise/page.tsx` (179 lignes)

**Ce qui existe** :
- ✅ Homepage avec 9 sections, pricing 2 offres, CTAs
- ✅ Page marketing pédagogique "L'IA et votre entreprise"
- ✅ Footer avec drapeau suisse + "Basée à Genève"

**Ce qui est cassé / problématique** :
- ⚠️ Styles inline PARTOUT (pas de classes Tailwind)
- ⚠️ Pas de SEO metadata (<title>, <meta description>, Open Graph)
- ⚠️ Pas de JSON-LD Organization sur la homepage

**Reste à faire (Sprint 9)** :
- Ajouter SEO metadata à toutes les pages
- Migrer progressivement les styles inline vers Tailwind
- Ajouter JSON-LD Organization sur la homepage

---

## 15. INTELLIGENCE DU SYSTÈME — Comment tout s'emboîte

### 15.1 La logique circulaire AYO → AYA → Recommandation IA

Le système AI Visionary crée un **cercle vertueux** :

```
1. AYO diagnostique un site web → Score AIO
2. Le client achète les fichiers (ASR, FAQ, glossaire, manifest, external_context)
3. Le client installe les fichiers sur son site → Son score AIO augmente
4. Le client est inscrit dans le registre AYA → Badge "certifié AYA"
5. Les IA (ChatGPT, Gemini, Perplexity) lisent les fichiers JSON-LD + consultent AYA
6. Les IA recommandent MIEUX les entreprises avec des fichiers AIO
7. Les entreprises voient l'impact → Renouvellent → Parlent d'AYO à d'autres
8. Retour au point 1 pour de nouveaux clients
```

**La proposition de valeur** : "Si votre site n'a pas de fichiers AIO, les IA ne peuvent pas vous recommander correctement. AYO diagnostique vos manques et vous fournit les fichiers pour être visible par les IA."

### 15.2 Le Score AIO — Pourquoi c'est le moteur de conversion

Le score AIO est **le cœur du système de vente** :

1. **Le score initial est bas** (souvent 20-40/100) car la plupart des sites n'ont ni JSON-LD structuré, ni ASR, ni FAQ structurée
2. **Le hard cap à 50** est la mécanique clé : même si les données de l'entreprise sont excellentes, sans JSON-LD → plafonné à 50. Le client comprend que le problème est TECHNIQUE, pas qualitatif.
3. **Le questionnaire enrichit les données** → Le score monte (simulé), montrant le POTENTIEL
4. **Le delta avant/après** crée l'urgence : "Votre site vaut 85/100 mais les IA ne voient que 35 → Avec nos fichiers, elles verront 85"
5. **Les 2 offres sont calibrées** :
   - AYA (19 CHF/mois) = "je veux être visible" (abonnement = revenu récurrent)
   - PRO (499 CHF) = "je veux tout posséder" (one-shot + 3 ans AYA offerts = trésorerie immédiate)

### 15.3 Les 5 fichiers — Pourquoi chacun existe

Les 5 fichiers ne sont pas arbitraires. Chacun répond à un besoin SPÉCIFIQUE de l'écosystème IA :

| Fichier | Qui le lit | Pourquoi |
|---------|-----------|----------|
| **ASR (JSON-LD)** | Tous les bots IA, Google, moteurs | C'est l'IDENTITÉ NUMÉRIQUE de l'entité — nom, services, certifications, contact. Format standard que toutes les IA comprennent. |
| **manifest.json** | Bots IA avancés | Déclare l'INTENTION de l'entité — roadmap AIO, stratégie, positionnement. Permet aux IA de comprendre où va l'entreprise, pas juste ce qu'elle fait. |
| **faq.json** | Bots IA conversationnels | Questions/réponses structurées. Quand un utilisateur demande "comment fonctionne [entreprise] ?" → L'IA puise dans la FAQ. |
| **glossary.json** | Bots IA spécialisés | Définitions des termes métier. L'IA comprend le VOCABULAIRE de l'entreprise → meilleure recommandation dans le contexte. |
| **external_context.json** | Bots IA de recommandation | Écosystème, canaux, mots-clés. L'IA sait OÙ et COMMENT l'entreprise est présente → meilleur matching avec les requêtes utilisateurs. |

### 15.4 La chaîne de données — Du chat à l'email

La donnée traverse 5 systèmes et DOIT rester cohérente :

```
[Utilisateur] → réponses texte
    ↓
[LLM Gemini] → extraction JSON structurée (avec q values)
    ↓
[Firestore] → persistance (collection "analyses")
    ↓
[Stripe] → paiement (client_reference_id encode url + email + analysisId)
    ↓
[Webhook] → récupère données Firestore → génère fichiers → envoie email
```

**Le Bug Score 0** se produit quand cette chaîne SE CASSE :
- Si le chat ne persiste pas les données avant le paiement
- Si le `analysisId` envoyé à Stripe ne correspond à rien dans Firestore
- Si la cascade de recherche Firestore (analysisId → URL → email) ne trouve rien
→ Le webhook génère des fichiers VIDES avec "Entreprise Inconnue"

**La correction** (Sprint 6) : Persister CHAQUE réponse du questionnaire immédiatement dans Firestore, et le webhook REFUSE de générer si les données sont absentes.

### 15.5 Le Registre AYA — Plus qu'une liste

Le registre AYA (`aya_registry` dans Firestore) est **l'atout stratégique** d'AI Visionary :

1. **Registre public consultable** : `ai-visionary.com/aya` — les bots IA et les humains peuvent vérifier si une entité est certifiée
2. **Chaque entité a un certificat** : `ai-visionary.com/aya/e/{entityId}` — page dédiée avec score, données, liens
3. **Le champ `recommendability`** dans le schema : Score de 0 à 1 qui indique à quel point une entité est recommandable par les IA
4. **L'ASR hébergé** : Pour les abonnés AYA, l'ASR est hébergé sur ai-visionary.com → Pas besoin d'installer sur son propre site
5. **Le badge AYA** : Signal de confiance — "Cette entreprise a été vérifiée par AYO et inscrite au registre AYA"

**La valeur du registre augmente** avec le nombre d'inscrits :
- Plus d'entités → plus de crédibilité → plus de gens veulent y être
- Les IA qui consultent AYA trouvent plus de résultats → AYA devient une source de référence

### 15.6 Le Questionnaire — Pourquoi c'est le point faible actuel

Le questionnaire est la **porte d'entrée des données**. Si les données sont mauvaises, TOUT est mauvais :
- Score faux → conversion faussée
- Fichiers PRO pauvres → client déçu
- Registre AYA avec des données vides → AYA perd sa valeur

**Problème actuel** : Le LLM INVENTE les questions au lieu de suivre un script. Résultat :
- Il pose des questions redondantes
- Il oublie des blocs entiers
- Il ne relance pas quand la réponse est vague
- Il met q=1 sur tout (le prompt lui dit "SET q=1")

**La solution** (Sprint 5) : Un questionnaire UNIVERSEL avec 18 questions structurées par bloc, des relances prédéfinies, et un validateur sémantique qui vérifie la qualité des réponses AVANT de les stocker.

### 15.7 La signature Ed25519 — Pourquoi c'est important

L'ASR est **signé cryptographiquement** avec Ed25519 :
- Cela prouve que le fichier a été émis par AI Visionary, pas falsifié
- La clé publique est vérifiable → Un bot IA peut vérifier l'authenticité
- C'est un différenciateur : personne d'autre ne signe les fichiers AIO

**Problème actuel** : La clé privée est HARDCODÉE dans `ayo-crypto.ts` → Si le repo est public, n'importe qui peut signer des ASR au nom d'AI Visionary.

### 15.8 Cohérence des offres

```
GRATUIT (Light)          ABONNEMENT (AYA)           PRO (One-shot)
─────────────           ──────────────              ──────────────
Score AIO initial        Registre AYA actif          5 fichiers sources
1 fichier ASR basique    ASR hébergé                 ZIP complet
Email avec diagnostic    Priorité IA                 3 ans AYA offerts
                         MAJ incluses                Propriété totale
                         19 CHF/mois                 499 CHF

→ Conversion Light       → Revenu récurrent          → Trésorerie immédiate
  vers AYA ou PRO          (MRR)                       + upsell AYA après 3 ans
```

L'entonnoir de conversion est :
1. **Light** (gratuit) → Le client voit son score bas → Veut améliorer
2. **AYA** ou **PRO** → Le client paie → Fichiers générés → Score augmente
3. **Renouvellement** → Après 12 mois (MAJ données) ou 3 ans (expiration PRO)

---

## 16. RÉSUMÉ — CE QUI MARCHE vs CE QUI NE MARCHE PAS

### ✅ Fonctionne en production
- Flux complet : URL → scan → questions → score → paiement → fichiers → email
- Stripe Checkout (live, CHF, 2 offres)
- Registre AYA public avec recherche
- Page certificat AYA
- Génération et envoi des 5 fichiers PRO en ZIP
- Signature Ed25519 des ASR
- OTP email
- Admin dashboard logs

### 🔴 Cassé / Critique
- Score faussé (q=1 forcé sur tout, y compris "aucun" et "non")
- Hard cap invisible (contradiction score blocs vs total)
- Bug Score 0 dans les emails (données perdues entre chat et webhook)
- Double appel webhook (PaymentHandler + PaymentSuccessModal)
- Stripe Portal sans authentification
- Rate limiting et validation Zod créés mais jamais appliqués
- Clé Ed25519 hardcodée dans le code source

### ⚠️ À améliorer
- Questionnaire trop aléatoire (le LLM invente les questions)
- Pages légales trop courtes
- SEO absent
- Pas de cycle de vie client (MAJ, expiration, renouvellement)
- ~~22 `@ts-ignore` dans le code~~ → Corrigé (branche fix/remediation, 19 mars 2026)
- `ignoreBuildErrors: true`
- Styles inline partout

---

## CHANGELOG — Branche `fix/remediation` (19 mars 2026)

### Sécurité (Critique)
- **Endpoint debug `/api/debug/test-ayo` protégé** avec `requireAdmin()` (était ouvert sans auth)
- **Fuite clé API Gemini supprimée** — `console.log` exposant les 5 premiers caractères de la clé retiré (`app/api/chat/route.ts:130`)
- **Liens Stripe TEST → env vars** — `STRIPE_LINK_PRO` et `STRIPE_LINK_AYA_SUB` remplacent les URLs hardcodées dans `lib/agents/vendeur.ts` et `lib/ayo-system-prompt.ts`
- **Stripe Price IDs retirés de `.env.example`** — les valeurs réelles ne sont plus commitées
- **Resend API** — initialisation conditionnelle (`null` si pas de clé) au lieu du placeholder `re_build_placeholder`

### Qualité code
- **17 `@ts-ignore` → `@ts-expect-error`** puis suppression des 15 directives devenues inutiles
- **47 erreurs `react/no-unescaped-entities`** corrigées (apostrophes FR → `&apos;`)
- **71 warnings `no-unused-vars`** corrigés (imports supprimés, params callback préfixés `_`)
- **Config ESLint** mise à jour avec `argsIgnorePattern: "^_"`
- **3 `catch {}` vides** remplacés par `catch (e) { console.warn(...) }` dans `test-ayo/route.ts`

### Nettoyage dead code (/simplify)
- **Supprimé** : `_portalUrl` + bloc Stripe Portal inutilisé (~30 lignes), `_messageText`, `_detectedValueForValidation`, `_jsonStringContent` (hot-path JSON.stringify inutile)
- **Supprimé** : `_activeBlock`, `_currentQIndex` (useState causant des re-renders inutiles), `_submitMultipleSelection` (fonction morte)
- **Supprimé** : `_hasJsonLd` (architecte.ts), `_services` (ayo-generators.ts), `_ayaLink` (checkout-success)

### Organisation
- **9 scripts** déplacés de la racine vers `/scripts/`
- **`ENTREPRISES_FACTICES_A_SUPPRIMER.json`** (291 Ko) supprimé
- **`.gitignore`** corrigé — patterns préfixés `/` pour ne s'appliquer qu'à la racine

### Questionnaire AYO (fix UX critique)
- **Questions de validation** — statique Oui/Non sans LLM pour les données scannées (lowConfidence)
- **Validateur post-LLM** — `validateQuestionBlock()` force min 2 options, max 1 question par message
- **Queues séparées** — `validationQueue` (statique) vs `enrichmentQueue` (LLM)
- **`buildValidationQuestion()`** — génère des questions structurées avec labels humains par bloc/champ
- **`BLOCK_LABELS` / `FIELD_LABELS`** — constantes module-level partagées
- **AyoChat.tsx** — `isValidationQuestion` unifié, skip/multi-select désactivés sur validations

### Qualité fichiers ASR (15 bugs corrigés)
- **Parenthèses non fermées** — `fixUnmatchedBrackets()` ferme `(`, `[`, `{` ouverts
- **Troncature audience** — `truncateOnSeparator()` coupe sur virgule, plus en plein mot
- **`__SKIPPED__` filtré** — `cleanSkippedValues()` remplace par `false` (booléens) ou omet (strings)
- **Intents non splittés** — `toArray()` ne coupe plus les questions contenant `?`
- **`platform_types`** — dérivé de `delivery_mode` (plus de confusion avec `frameworks`)
- **Double slash URLs** — normalisation dans manifest
- **`legalName` vide** → champ omis de l'ASR
- **`key_indicators` sans chiffre** → suffixe `: non déclaré`
- **Score cap transparent** — `meta.raw_score`, `cap_applied`, `cap_reason` ajoutés dans l'ASR
- **`contextualRelevance`** — rempli avec use_cases (high) + services (medium)
- **`compliance.gdpr`** — déduit des policies (`"declared"` si privacy/confidentialité détecté)
- **FAQ** — audience mentionnée uniquement dans les questions pertinentes
- **Glossaire** — 1 entrée "Public cible" au lieu de 10 segments individuels, descriptions variées
- **`geographies_served`** — note ajoutée si service en ligne

### Unification code (/simplify)
- **~80 lignes dupliquées supprimées** de `ayo-crypto.ts`
- **Imports unifiés** : `toArray`, `cleanText`, `cleanVal`, `cleanArray`, `cleanSkippedValues`
- **`isAssociation()`** partagée (remplace 4 duplications)
- **`PHONE_REGEX`** partagée (remplace 3 duplications)
- **`TERM_CORRECTIONS`** partagé (remplace `ASR_TERM_CORRECTIONS`)
- **`TextEncoder` + `PLACEHOLDER_PATTERNS`** hoistés en module-level
- **Variable morte `rawScore`** supprimée

### Migration Supabase (Firestore → Supabase)
- **Schéma SQL** : 6 tables (analyses, aya_registry, scan_states, system_logs, otp_codes, sessions)
- **lib/db.ts** réécrit : client Supabase, même interface publique, lazy-init
- **Merge strategy** : saveAnalysis() lit avant d'écrire (plus d'écrasement email→score=0)
- **URL normalisée** : colonne GENERATED `url_normalized` (1 requête au lieu de 7)
- **Tri** : `getLatestAnalysisByUrl` par `created_at DESC` (plus récent, pas meilleur score)
- **7 routes API** migrées, 6 scripts migrés, firebase.json supprimé
- **Injection scan_state** : avant FINAL_SAVE, les données détectées du scan sont injectées dans les champs vides d'extractJson

### Module absence structurée (recommandation expert)
- **indicateurs vides** → `data_availability` (status, reason) + `data_maturity` (level 0-5)
- **commitments** : measurement_intent, has_defined_targets, engagement_level
- **transparency** : data_declared_by_client, missing_data_explicit, no_fabrication_policy
- **interpretation_signal** : should_penalize, trust_modifier, recommendation_impact
- Principe : "absence structurée = signal neutre, absence vide = signal négatif"

### Qualité fichiers ASR — round 2 (10 bugs supplémentaires)
- **additionalType** ajouté dans identity avec fixUnmatchedBrackets
- **contactPoint** avec email si disponible
- **serviceMode** dérivé du delivery_mode réel
- **contextualRelevance** rempli automatiquement
- **compliance.gdpr** déduit des policies
- **industry** avec fixUnmatchedBrackets
- **cleanArray()** applique fixUnmatchedBrackets sur chaque élément
- **sanitizeAudience** limite augmentée 160→300 chars
- **FAQ** : réponses uniques par question, moins de répétition audience
- **Glossaire** : AIO renommé "AI-readability Intelligence Optimization"
- **Sanitizer** : PROTECTED_FIELDS (business_type, name, contact_email) préservés

### Scripts utilitaires ajoutés
- `scripts/e2e-test.js` — test E2E automatisé du questionnaire
- `scripts/generate-perfect-pack.ts` — génération fichiers avec données complètes

### Build
- `npm run build` ✅ — 16 pages générées, 0 erreur TypeScript

### Vulnérabilités npm (non corrigées — upstream)
- `fast-xml-parser` (critical) — dépendance transitive, `npm audit fix` inefficace
- `flatted` (high) — idem
- `@tootallnate/once` (moderate) — dépendance de `firebase-admin`
- `ajv` (moderate) — dépendance transitive
