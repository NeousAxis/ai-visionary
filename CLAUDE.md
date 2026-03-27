# AI VISIONARY — Documentation Projet pour Claude Code

> **IMPORTANT** : Ce fichier est lu automatiquement par Claude Code à chaque nouvelle conversation.
> Il contient TOUTE la connaissance nécessaire pour reprendre le travail sur ce projet.
> Dernière mise à jour : 27 mars 2026, 22h00

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
| Sprint 1 | ✅ Terminé (Session 1, 14 mars 2026) |
| Sprint 2 | ✅ Terminé (Session 2, 14 mars 2026) |
| Sprint 3 | ✅ Terminé (Session 3, 15 mars 2026) |
| Sprint 4 | ✅ Terminé (Session 3, 15 mars 2026) |
| Sprint 5 | ✅ Terminé (Session 4, 19-23 mars 2026) |
| Sprint 6 | ✅ Terminé (Session 5, 15 mars 2026) |
| Sprint 7 | ✅ Terminé (Session 6, 24 mars 2026) |
| Sprint 8 | ✅ Terminé (Session 7, 27 mars 2026) |
| Sprint 9 | ❌ Pas commencé (Session 8) |
| Sprint 10 | ❌ Pas commencé (Session 8) |

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
| **Session 7** | Sprint 8 | ✅ Formulaire MAJ client 7 blocs + OTP + email PRO/AYA + boutons Mettre à jour/Renouveler + qualité registre | ~3h | 🟡 Moyen | Non |
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
| Session 6 | ✅ **TERMINÉE** | 2026-03-24 | Modules sémantiques — sanitizers fichiers PRO, ayo-semantics, external-context DÉJÀ FAITS. **NE PLUS TOUCHER AU PACK PRO NI À AYO.** |
| Session 7 | ✅ **TERMINÉE** | 2026-03-27 | Formulaire MAJ 7 blocs + OTP gate + email PRO (ZIP fichiers) + email AYA (confirmation) + boutons Mettre à jour/Renouveler sur certificats + disclaimer INDEXÉ + filtre NSFW registre + `cleanDisplayName()` (emojis, japonais, listes Python) + StatsBar 0→4400+ animation immédiate. Branche `main`. |
| Session 8 | ✅ **TERMINÉE** | 2026-03-27 | Fix webhook flux renouvellement : recalcul blocs AIO depuis fields quand blocks={} (renew flow). Template email dédié `buildAyaSubEmailHtml` (score + blocs + certificat, sans contenu PRO). Template PRO inchangé. PRO ✅ + AYA sub ✅ confirmés en test. |
| **Bot AYA** | ✅ **LIVE** | 2026-03-24 | **~3000+ entités** dans Supabase (5430 domaines scrapés, 6672 dans domains.txt). API compacte (6 champs LLM). Keywords auto extraits. 9 IA connectées (ChatGPT GPT Store, Claude MCP, Gemini, Mistral, Grok, Perplexity, DeepSeek, Qwen, Llama). OpenAPI spec + ai-plugin.json + MCP server. Fix certificat (INDEXÉ au lieu d'EXPIRÉ, date epoch, keywords). README GitHub rewrite "AYA inside". Page /developers avec 9 IA + fichiers intégration. **→ Voir section 16 pour le reste** |
| **Signal LLM** | ✅ **TERMINÉ** | 2026-03-25 | 4 chantiers Signal LLM : endpoint `/api/aya/llm/{domain}`, texte brut certificats, export GitHub dataset, domination Web3/AI. Enrichissement Gemini 3339/3339 (EN+FR). Filtre garbage 120 termes. 57 noms mojibake fixés. 3 entités supprimées. Trigger Supabase droppé. GitHub dataset public (3306 fichiers). HuggingFace ré-exporté. Mots-clés Gemini 3338/3339 (fix_keywords.py). Pagination serveur /aya (20/page, URL-based). Cache CDN 4 routes API. BackButton certificats. `AyaRegistryClient.tsx` composant client. **→ Voir sections 18 + 18.9** |

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
- ✅ Page registre avec recherche + 5 modes de tri (Par défaut, Certifiées, A→Z, Score, Pays)
- ✅ Page certificat avec détails
- ✅ **Option B implémentée** — toutes les entités visibles (certifiées + indexées par bot)
- ✅ Badges visuels : "ASR CERTIFIÉ" (vert) / "INDEXÉ" (gris)
- ✅ Barre de stats (total / certifiés / indexés)
- ✅ Tri organique (`created_at DESC` — derniers arrivés en premier)
- ✅ Bouton "Certifiées" pour filtrer les clients payants
- ✅ 889 entités dans le registre (données bot AYA)
- ✅ Pagination 50 entités par page (18 pages)
- ✅ Tri shuffle (Fisher-Yates) — certifiés en premier, puis mélange aléatoire (pas de regroupement alphabétique)
- ✅ README.md GitHub avec documentation API complète

**Ce qui manque** :
- ❌ JSON-LD dans le HEAD des pages (pour que les bots IA les lisent)
- ❌ Badge AYA téléchargeable
- ❌ Affichage des 7 blocs de score individuels sur le certificat
- ❌ Statut visuel (Actif / Expiring / Expiré)
- ❌ Fix noms/secteurs incorrects (ex: zuerich.com → "home_leisure" au lieu de "Zurich Tourism")

**Reste à faire (Sprint 8)** :
- Améliorer page certificat (JSON-LD, blocs score, statut)
- Implémenter le cycle de vie (MAJ annuelle, expiration, renouvellement)
- Fix données bot AYA : noms/secteurs incorrects pour certains domaines

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

## 16. SYNTHÈSE GÉNÉRALE — TOUT CE QUI RESTE À FAIRE

> **Date** : 25 mars 2026, 09h00
> **Branche** : `main` (synchro avec `fix/remediation`)

---

### ✅ CE QUI EST FAIT ET FONCTIONNE

- Flux complet AYO : URL → scan → questions statiques → score strict → paiement Stripe → fichiers → email
- Stripe Checkout live (CHF, 2 offres : AYA 19 CHF/mois, PRO 499 CHF)
- Registre AYA public : **~3000+ entités**, page `/aya` avec badges, pagination, tri shuffle, recherche
- Page certificat `/aya/e/[id]` — fix INDEXÉ (plus EXPIRÉ), fix date epoch, keywords depuis blocs AIO
- API AYA compacte (6 champs LLM) sur Vercel (search, entity, stats, docs, live)
- Page `/developers` — 9 IA connectées, stats, fichiers d'intégration
- **9 IA connectées** : ChatGPT (GPT Store + OpenAPI), Claude (MCP server), Gemini (function calling), Mistral (tool use), Grok, Perplexity, DeepSeek, Qwen, Llama
- `ai-plugin.json` + `openapi.json` + MCP server + function declarations Gemini + tool definitions Mistral
- README GitHub rewrite "AYA inside" (https://github.com/NeousAxis/ai-visionary)
- Bot AYA : **5430 domaines** scrapés (6672 dans domains.txt), pipeline concurrent, extraction auto mots-clés, détection pays hreflang+phone
- Génération et envoi des 5 fichiers PRO en ZIP
- Signature Ed25519 des ASR (clé rotée, env var)
- Migration Firestore → Supabase
- Questions statiques (ENRICHMENT_TEMPLATES), scoring strict (cap 78)
- Sessions 1-5 terminées, sprints 1-6 terminés
- OTP email, admin dashboard, logger, rate-limit, validators

---

### 🔴 TOUT CE QUI RESTE À FAIRE

#### A. BOT AYA — 3 objectifs (priorité immédiate)

**A1. Atteindre 5'000-10'000 entreprises**

| Tâche | Priorité |
|-------|----------|
| Enrichir `domains.txt` — annuaires CH, FR, DE, UK, US, Asie | 🔴 Critique |
| Scraper par lots — `run_pipeline_fast.py` sur les nouvelles listes | 🔴 Critique |
| Push vers Supabase — `push_to_aya.py --min-score 20` | 🔴 Critique |
| Scheduler automatique — cron Vercel ou script local pour re-scraper | 🟡 Haute |
| Objectif intermédiaire : 3'000 entités | 🔴 |
| Objectif final : 5'000-10'000 entités | 🔴 |

**A2. ASR_DERIVED exploitables (qualité des données)**

| Tâche | Priorité |
|-------|----------|
| Fix noms/secteurs incorrects (ex: zuerich.com → "home_leisure" au lieu de tourisme) | 🔴 Critique |
| Enrichissement IA (Gemini) pour secteur, description, nom d'entité | 🟡 Haute |
| Réduire les "XX" — 766 entités .com sans pays détecté | 🟡 Haute |
| Améliorer la détection de secteur (plus précis) | 🟡 Haute |
| Valider les données ASR_DERIVED — score cohérent, champs non vides | 🟡 Haute |
| ~~Fix tri page /aya — vrai mélange aléatoire~~ | ✅ Fixé (24 mars 2026) |

**A3. Connecter l'API aux IA (distribution)**

| Tâche | Priorité |
|-------|----------|
| **ChatGPT** — soumettre au GPT Store (ai-plugin.json prêt) | 🔴 Critique |
| **Anthropic/Claude** — créer un MCP server AYA | 🔴 Critique |
| **Google Gemini** — intégration via function calling / Extensions | 🟡 Haute |
| **Perplexity** — soumettre comme source de données structurées | 🟡 Haute |
| **Mistral** — intégration via tool use / plugins | 🟡 Haute |
| **IA chinoises** (DeepSeek, Qwen, Baidu ERNIE) — adapter doc, soumettre | 🟢 Moyenne |
| Monitoring — tracker les appels API par source (quel IA utilise AYA) | 🟢 Moyenne |

#### B. PRODUIT AYO — Sessions 7-8 (NE PLUS TOUCHER AU PACK PRO NI À AYO)

> **Session 6 (Sprint 7) = ✅ TERMINÉE** — modules sémantiques, sanitizers, ayo-semantics, external-context DÉJÀ FAITS.

**B1. Session 7 — Sprint 8 : Cycle de vie client (section 14.11)**

| Tâche | Priorité |
|-------|----------|
| MAJ annuelle : rappels email J-30, J-7, J-0 + page MAJ pré-remplie | 🟡 Haute |
| Renouvellement AYA Sub : webhooks Stripe `invoice.payment_failed`, `customer.subscription.deleted` | 🟡 Haute |
| Expiration Pack PRO (3 ans) : rappels J-90, J-30, J-7 + page renouvellement | 🟡 Haute |
| Cron jobs Vercel : 4 crons pour rappels et synchronisation | 🟡 Haute |
| Dashboard client (futur) : espace personnel OTP | 🟢 Moyenne |
| Améliorer page certificat : JSON-LD, blocs score, statut visuel | 🟡 Haute |

**Fichiers à créer** :
- `app/update/[entityId]/page.tsx`, `app/renew/[entityId]/page.tsx`
- `app/api/update-entity/route.ts`, `app/api/cron/review-reminders/route.ts`
- `app/api/cron/expiry-reminders/route.ts`, `app/api/cron/expire-entities/route.ts`
- `app/api/webhooks/subscription/route.ts`

**B3. Session 8 — Sprint 9+10 : UI/SEO + Pages légales + Tests (section 14.12)**

| Tâche | Priorité |
|-------|----------|
| SEO metadata sur toutes les pages (<title>, <meta description>, Open Graph) | 🟡 Haute |
| JSON-LD Organization sur la homepage | 🟡 Haute |
| Compléter page confidentialité (RGPD suisse LPD, cookies, sous-traitants) | 🟡 Haute |
| Compléter mentions légales (éditeur, hébergeur Vercel) | 🟡 Haute |
| sitemap.ts dynamique depuis Supabase `aya_registry` | 🟡 Haute |
| Migration progressive styles inline → Tailwind | 🟢 Moyenne |
| Tests E2E automatisés | 🟢 Moyenne |
| Nettoyage code mort final | 🟢 Moyenne |

---

### ORDRE DE PRIORITÉ RECOMMANDÉ

1. **IMMÉDIAT** — Fix bugs page /aya (noms, secteurs, tri)
2. **SEMAINE 1** — Augmenter à 3'000+ entreprises
3. **SEMAINE 2** — Connecter API aux IA (ChatGPT GPT Store, MCP Claude)
4. **SEMAINE 3** — Session 6 (modules sémantiques) + Session 7 (cycle de vie)
5. **SEMAINE 4** — Session 8 (SEO, légal, tests) + atteindre 5'000-10'000 entreprises

---

### AMÉLIORATIONS FUTURES (notées par Cyril)

| Tâche | Description |
|-------|-------------|
| **Mots-clés intelligents AYO** | Après que l'utilisateur ait répondu à toutes les questions (y compris les mots-clés), AYO doit lancer un sous-agent qui reprend TOUTES les réponses du questionnaire et complète avec des mots-clés que l'utilisateur pourrait avoir oubliés. Cela améliore la trouvabilité dans l'API AYA. |
| **Toggle EN/FR site** | Passer le site ai-visionary.com en bilingue anglais/français avec un toggle. L'anglais est nécessaire pour l'internationalisation. Chantier i18n complet sur toutes les pages. |
| **Dataset HuggingFace** | ✅ FAIT — Publié sur https://huggingface.co/datasets/NeousAxis/aya-business-dataset — CSV + JSONL, CC-BY-4.0, 1835 entités. À re-exporter après chaque batch de scraping pour tenir à jour. |
| **Campagne email entreprises indexées** | Après indexation d'entreprises IA/tech/crypto/blockchain, leur envoyer un email pour les informer qu'elles sont dans le registre AYA. Angle : souveraineté vs GAFAM — les IA de Google/OpenAI décident qui est visible, AYA est l'alternative ouverte. Template email ci-dessous. |
| **Soumission There's An AI For That** | S'inscrire sur https://theresanaiforthat.com/ et soumettre AYA comme outil IA. Newsletter hebdo avec 500K+ lecteurs dans l'écosystème IA. |

### STRATÉGIE COMMERCIALE — "AYA inside" (25 mars 2026)

**Hiérarchie des marques** :
- **AI Visionary** = la startup (marque mère, toujours mentionnée)
- **AYO** = l'agent IA qui diagnostique les sites + crée les fichiers ASR
- **AYA** = le registre public qui héberge les entités indexées/certifiées + bot automatisé qui scrape et indexe des entreprises
- **AIO** = le score de lisibilité IA (0-100)
- **ASR** = les fichiers d'identité numérique (JSON-LD signés Ed25519)

AYO et AYA sont des **produits et services d'AI Visionary**.

---

#### PRINCIPE

AYA n'est PAS une destination. C'est une couche invisible de données structurées sur les entreprises. Les IA la trouvent en crawlant le web. Personne n'a besoin de "venir sur AYA".

---

#### CIBLE PRIORITAIRE : INDUSTRIE IA / TECH / BLOCKCHAIN / CRYPTO

On commence par indexer massivement les entreprises de cette industrie parce que :
- **Elles comprennent les enjeux** de l'IA et de la visibilité algorithmique
- **Elles sont tech-native** → elles ont déjà du JSON-LD, des sites structurés, des APIs
- **Elles ont intérêt à être recommandées** par les IA concurrentes/partenaires
- **Elles parlent entre elles** → effet réseau (si Chainlink est dans AYA, Aave veut y être aussi)
- **L'angle souveraineté les touche directement** → elles savent que les GAFAM contrôlent l'accès

Une fois cette industrie conquise, on élargit aux autres secteurs (finance, santé, consulting, etc.).

---

#### LES 3 COUCHES QUI ATTIRENT LES IA

**Couche 1 — Web crawlable (passif)** ✅ FAIT
- JSON-LD Organization sur chaque page `/aya/e/[id]`
- Sitemap avec toutes les URLs
- `ai-plugin.json` au `/.well-known/`
- Plus d'entités = plus de pages = plus les IA trouvent nos données

**Couche 2 — API ouverte (pour les devs)** ✅ FAIT
- 3 endpoints, 0 auth, JSON
- OpenAPI spec compatible avec tous les standards

**Couche 3 — Dataset HuggingFace (long terme)** ✅ FAIT
- Publié sur https://huggingface.co/datasets/NeousAxis/aya-business-dataset
- Les futurs modèles s'entraînent sur nos données
- Re-exporter après chaque batch de scraping

---

#### ACQUISITION CLIENTS

**Étape 1 — Indexer massivement l'industrie IA/tech/crypto**
- Objectif : 10'000+ entreprises
- Bot AYA scrape automatiquement
- 6672 domaines dans le pipeline (dont ~1500 IA/crypto/blockchain)

**Étape 2 — Contacter les entreprises indexées par email**
- "Vous êtes dans le registre AYA, votre score est X/100"
- Angle : souveraineté vs GAFAM — les IA décident qui est visible, AYA est l'alternative ouverte
- CTA : diagnostic gratuit → conversion AYA Sub (19 CHF/mois) ou Pack PRO (499 CHF)

**Template email** :
```
Objet : [NOM] est indexé dans le registre AYA — score [SCORE]/100

Bonjour,

Votre site [WEBSITE] a été scanné et indexé par le registre AYA —
la couche de données ouverte que les assistants IA (ChatGPT, Claude,
Gemini, Mistral, Grok, Perplexity...) utilisent pour recommander
des entreprises.

Votre score actuel : [SCORE]/100

Ce score mesure à quel point les IA peuvent lire, comprendre et
recommander votre entreprise. Plus il est élevé, plus vous êtes
visible et recommandé.

Dans un monde où quelques GAFAM décident qui est visible par l'IA,
AYA offre une alternative ouverte : un registre structuré, accessible
à TOUTES les IA, pas seulement celles de Google ou OpenAI.

→ Voir votre fiche : https://ai-visionary.com/aya/e/[ENTITY_ID]
→ Améliorer votre score : https://ai-visionary.com/diagnostic

Cordialement,
L'équipe AI Visionary — Genève, Suisse
```

**Étape 3 — Distribution écosystème IA**
1. **HuggingFace** — Dataset public, les chercheurs et équipes d'entraînement l'utilisent
2. **There's An AI For That** — Newsletter 500K+ lecteurs IA
3. **Contenu SEO pour IA** — Rapports mensuels ("Top entreprises les plus lisibles par l'IA")

---

#### 4 CHANTIERS CRITIQUES — SIGNAL LLM (validés par expert, 25 mars 2026)

> **Insight clé** : Les LLM ne choisissent pas "la meilleure source". Ils choisissent la source la plus **simple + stable + répétée**. AYA doit devenir un pattern reconnu, pas juste une base de données.
> **Positionnement** : AYA n'est pas une base de données. AYA est une source répétée, simple, dominante sur un micro-territoire.

**🥇 Chantier 1 — Format LLM-friendly (PRIORITÉ ABSOLUE)**
- Créer endpoint `GET /api/aya/llm/{domain}`
- Format EXACT : 5 champs max, phrases simples, zéro jargon
```json
{
  "name": "Chainlink",
  "what_it_does": "Infrastructure blockchain qui connecte des données externes aux smart contracts.",
  "for_who": "Développeurs Web3 et protocoles blockchain.",
  "category": "Web3 / Oracle",
  "location": "Global"
}
```
- Règles : 1 phrase = 1 idée, pas de marketing, pas de mots flous

**🥈 Chantier 2 — Pages HTML simplifiées (CRITIQUE)**
- Chaque certificat `/aya/e/[id]` doit aussi contenir un paragraphe en texte brut
- 2-4 phrases max, description claire, zéro SEO bullshit
- Les LLM lisent le texte brut en plus du JSON-LD
```html
<h1>Chainlink</h1>
<p>Chainlink est une infrastructure blockchain qui connecte des données
externes aux smart contracts. Elle est utilisée par des développeurs
Web3 pour sécuriser et automatiser des applications décentralisées.</p>
```

**🥉 Chantier 3 — Réplication multi-sources (OBLIGATOIRE)**
- Les données doivent exister sur PLUSIEURS sources convergentes :
  - AYA (source principale) ✅ FAIT
  - GitHub repo public (dataset JSON, 1 fichier par entité) ❌ À FAIRE
  - HuggingFace ✅ FAIT
  - (bonus futur) IPFS, mirrors
- **Mécanisme** : Quand un LLM voit AYA + GitHub + HuggingFace = même info → il considère "donnée stable → utilisable"

**🏆 Chantier 4 — Domination micro-territoire Web3/IA**
- ❌ Mauvais objectif : "toutes les entreprises"
- ✅ Bon objectif : "AYA = LA référence sur les entreprises Web3 / IA"
- Plan :
  1. Lister top 500 Web3 + top 500 IA tools + top 500 infra
  2. Créer ASR_DERIVED + version LLM pour tous
  3. Publier : "Top 100 entreprises Web3 les plus lisibles par les IA"
- **Résultat** : AYA domine un territoire clair → crédibilité → expansion vers d'autres secteurs

---

#### CE QUI RESTE À FAIRE (plan complet)

| # | Tâche | Statut | Quand |
|---|-------|--------|-------|
| 1 | Finir scraping 6672 domaines + push Supabase | 🔄 En cours | Aujourd'hui |
| 2 | Endpoint `/api/aya/llm/{domain}` — format LLM-friendly | ❌ | Demain |
| 3 | Pages HTML simplifiées sur chaque certificat | ❌ | Demain |
| 4 | Réplication GitHub — dataset JSON public (1 fichier/entité) | ❌ | Demain |
| 5 | Domination Web3/IA — top 500 + contenu "Top 100" | ❌ | Cette semaine |
| 6 | Soumettre AYA sur There's An AI For That | ❌ | À faire (Cyril) |
| 7 | Préparer campagne email entreprises IA/tech/crypto | ❌ | Après indexation |
| 8 | Re-exporter dataset HuggingFace après batch | ❌ | Après chaque batch |
| 9 | Toggle EN/FR sur le site | ❌ | Session dédiée |
| 10 | Atteindre 10'000+ entreprises | ❌ | Continu |
| 11 | Session 7 — Cycle de vie client | ❌ | Session dédiée |
| 12 | Session 8 — SEO/Légal | ❌ | Session dédiée |

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

### Registre AYA — Option B (23 mars 2026)
- **`lib/db.ts:getAyaEntities()`** — Filtre `payment_completed=true` supprimé. Tri par `payment_completed DESC` puis `asr_score DESC`. Limit 20→500.
- **`app/aya/page.tsx`** — Refonte complète :
  - Badges visuels : "ASR CERTIFIÉ" (vert, bordure verte) / "INDEXÉ" (gris, bordure grise)
  - Barre de stats (total / certifiés / indexés)
  - Liens certificat : `entity_id` en priorité (corrige le bug "Certificat non trouvé")
  - CTA "Passez à Certifié" dans le footer
  - Recherche par nom, secteur, pays
- **`aya/generator.py:detect_entity_name()`** — Filtrage intelligent :
  - Slogans détectés ("The best VPN...", "Pioneering sustainable...") → fallback domain
  - Noms génériques filtrés ("Homepage", "Welcome", noms de pays)
  - `_clean_title()` : extraction du vrai nom avant séparateur `|`, `-`, `—`
  - `_strip_prefix()` : "Welcome to L'Oréal" → "L'Oréal"
  - `_name_matches_domain()` : JSON-LD name validé contre le domaine
- **887 entités** dans Supabase `aya_registry` (1108 scrapés, 887 avec score >= 20)

### Build
- `npm run build` ✅ — 16 pages générées, 0 erreur TypeScript

### Vulnérabilités npm (non corrigées — upstream)
- `fast-xml-parser` (critical) — dépendance transitive, `npm audit fix` inefficace
- `flatted` (high) — idem
- `@tootallnate/once` (moderate) — dépendance de `firebase-admin`
- `ajv` (moderate) — dépendance transitive

---

## 17. BOT AYA — Index automatisé d'entreprises

> Ajouté le 23 mars 2026

### 17.1 Qu'est-ce que le Bot AYA ?

Le Bot AYA est un **scraper automatisé** qui indexe des entreprises sans intervention humaine pour peupler le registre AYA avec des données structurées (ASR_DERIVED). L'objectif est d'atteindre **1'000–10'000 entreprises indexées** en 30 jours pour rendre l'API AYA utile aux agents IA.

### 17.2 Architecture

```
domains.txt (liste URLs)
    ↓
scraper.py (fetch homepage + sitemap + pages clés)
    ↓
parser.py (extraction HTML, JSON-LD, emails, phones, secteur, pays)
    ↓
generator.py (AYA_PREINDEX + ASR_DERIVED + score AIO estimé)
    ↓
data/*.json (stockage fichiers, 1 par domaine)
    ↓
push_to_aya.py (insertion dans Supabase aya_registry)
    ↓
api/main.py (API FastAPI locale — recherche, filtres, stats)
```

### 17.3 Fichiers du Bot AYA

| Fichier | Rôle | Lignes |
|---------|------|--------|
| `aya/parser.py` | Extraction HTML, JSON-LD, emails, phones, secteur (13 catégories), pays (TLD) | ~300 |
| `aya/scraper.py` | Fetch HTTP (home, sitemap, 10 pages clés) | ~70 |
| `aya/generator.py` | Génère AYA_PREINDEX + ASR_DERIVED + score AIO (7 blocs, hard caps) | ~250 |
| `aya/run_pipeline.py` | Pipeline séquentiel (simple) | ~40 |
| `aya/run_pipeline_fast.py` | Pipeline concurrent (ThreadPool, 10 workers) — **1108 domaines en ~12 min** | ~60 |
| `aya/push_to_aya.py` | Push vers Supabase `aya_registry` avec `payment_completed=false`, `data_origin='AYA-BOT'` | ~120 |
| `aya/api/main.py` | API FastAPI — 6 endpoints (search, entities, entity, asr, stats, root) | ~150 |
| `aya/domains.txt` | 1108 domaines (CH + FR + tech mondial) | 1108 |
| `aya/docs/api.md` | Documentation API complète | ~200 |
| `aya/docs/tool_spec.json` | Spec OpenAI tool-compatible (5 tools) | ~100 |

### 17.4 État actuel (23 mars 2026)

- ✅ **1'108 domaines** scrapés, **889 entités** dans Supabase `aya_registry` (score >= 20)
- ✅ **Page `/aya` live** sur ai-visionary.com — affiche toutes les entités (certifiées + indexées)
- ✅ **Option B implémentée** — filtre `payment_completed=true` supprimé, badges visuels "ASR CERTIFIÉ" (vert) / "INDEXÉ" (gris)
- ✅ **Noms d'entités corrigés** — 42 noms fixes (slogans, génériques, allemand, encodage, préfixes)
- ✅ **Liens certificat corrigés** — `entity_id` utilisé en priorité (au lieu de `entity.id` qui était null)
- ✅ **Pipeline concurrent** — `run_pipeline_fast.py` (10 workers, 1108 domaines en ~12 min)
- ✅ API FastAPI locale fonctionnelle avec filtres par secteur, pays, score
- ✅ Doc API (`aya/docs/api.md`) + Tool spec OpenAI (`aya/docs/tool_spec.json`) créés
- ✅ **Tri shuffle (Fisher-Yates)** — certifiés en premier, puis mélange aléatoire (plus de regroupement alphabétique)
- ✅ 5 modes de tri sur la page : Par défaut, Certifiées, A→Z, Score, Pays
- ✅ **Pagination** — 50 entités par page (18 pages)
- ✅ `.vercelignore` ajouté (exclut `/aya/` et `scripts/` du deploy Vercel)
- ✅ `useMemo` pour les stats et le filtrage
- ✅ Helper `getEntityId()` et constante `ENTITY_TYPE_LABELS` extraits
- ✅ Pays normalisés en ISO (40+ mappings : "United States"→US, "Switzerland"→CH, etc.)
- ✅ **Page `/developers`** — documentation API complète pour humains + bots
- ✅ **Repo GitHub public** — https://github.com/NeousAxis/ai-visionary
- ✅ **Clé Ed25519 rotée** — `AYO-KEY-2026-03`, ancienne clé compromise
- ✅ **README.md GitHub** — mis à jour avec doc API AYA complète (endpoints, exemples, score AIO, integration agents IA)

### 17.5 Registre AYA — Problème résolu (Option B)

**Problème initial** : La page `/aya` affichait "0 Entreprises" car `db.getAyaEntities()` filtrait sur `payment_completed = true`.

**Solution appliquée (Option B)** :
- `lib/db.ts:303` — Filtre supprimé, tri organique `created_at DESC` (derniers arrivés en premier)
- `app/aya/page.tsx` — Refonte complète avec badges visuels :
  - Clients payants : bordure verte + badge "ASR CERTIFIÉ"
  - Entités bot : bordure grise + badge "INDEXÉ"
  - Barre de stats en haut (total / certifiés / indexés)
  - 5 boutons de tri : Par défaut, Certifiées, A→Z, Score, Pays
  - CTA "Passez à Certifié" pour convertir les indexés

**Bugs corrigés dans la même session** :
- `generator.py:detect_entity_name()` — 42 noms corrigés :
  - Slogans filtrés ("The best VPN...", "Pioneering sustainable...", "Manage your team...")
  - Noms génériques filtrés ("Homepage", "Welcome", "Redirecting...", noms de pays)
  - Descriptions allemandes filtrées ("Willkommen bei...", "Günstige...", "führend im...")
  - Encodage corrigé (mojibake Crédit Agricole, caractères invisibles Orange)
  - `_clean_title()` : split sur séparateurs + sélection du segment pertinent
  - `_strip_prefix()` : "Welcome to L'Oréal" → "L'Oréal", "Willkommen bei der Helvetia..." → "Helvetia..."
  - `_name_matches_domain()` : JSON-LD name validé contre le domaine
  - `_clean_encoding()` : suppression zero-width chars, fix mojibake
  - `KNOWN_BRANDS` : capitalisation correcte (DeepL, WordPress, PostFinance, etc.)
  - Port `:443` nettoyé du canonical_domain
  - Sous-domaines nettoyés (about.gitlab.com → gitlab.com)
- `app/aya/page.tsx` — `entity_id` en priorité dans les liens (au lieu de `entity.id` qui est null pour les entités bot)

### 17.6 Ce qui a été accompli

| Tâche | Statut |
|-------|--------|
| Atteindre 1'000 domaines | ✅ (1108 domaines, 889 entités) |
| Affiner les noms — slogans, génériques, allemand | ✅ (42 noms corrigés) |
| Normaliser les pays — ISO codes | ✅ (40+ mappings) |
| API AYA publique — routes Next.js sur Vercel | ✅ (search, entity, stats, docs, live) |
| Connecter l'API aux IA — ai-plugin.json + tool_spec + doc | ✅ |
| Page /developers — documentation API | ✅ |
| Sécurité repo — rotation Ed25519, nettoyage secrets, repo public | ✅ |
| Pagination page /aya — 50 entités par page | ✅ |
| Tri shuffle — Fisher-Yates, certifiés en premier | ✅ |
| README.md GitHub — doc API complète | ✅ |

### 17.7 PLAN RESTANT — Objectif 30 jours

> **Objectif global** : 5'000-10'000 entreprises indexées, ASR_DERIVED exploitables, API connectée à TOUTES les IA.

```
BOT (scraping) → BASE (Supabase) → API AYA (Vercel) → IA (ChatGPT, Claude, Gemini, Perplexity, Mistral, IA chinoises)
```

#### OBJECTIF 1 — Augmenter le nombre d'entreprises (→ 5'000-10'000)

| Tâche | Priorité | Statut |
|-------|----------|--------|
| Enrichir `domains.txt` — annuaires CH, FR, DE, UK, US, Asie | 🔴 Critique | ❌ |
| Scraper par lots — lancer `run_pipeline_fast.py` sur les nouvelles listes | 🔴 Critique | ❌ |
| Push vers Supabase — `push_to_aya.py --min-score 20` | 🔴 Critique | ❌ |
| Scheduler automatique — cron Vercel ou script local pour re-scraper | 🟡 Haute | ❌ |
| Objectif intermédiaire : 3'000 entités | 🔴 Critique | ❌ |
| Objectif final : 5'000-10'000 entités | 🔴 Critique | ❌ |

#### OBJECTIF 2 — ASR_DERIVED exploitables (qualité des données)

| Tâche | Priorité | Statut |
|-------|----------|--------|
| Fix noms/secteurs incorrects — ex: zuerich.com → "home_leisure" au lieu de "Zurich Tourism" | 🔴 Critique | ❌ |
| Enrichissement IA (Gemini) pour secteur, description, nom d'entité | 🟡 Haute | ❌ |
| Réduire les "XX" — 766 entités .com sans pays détecté | 🟡 Haute | ❌ |
| Améliorer la détection de secteur (13 catégories → plus précis) | 🟡 Haute | ❌ |
| Valider les données ASR_DERIVED — score cohérent, champs non vides | 🟡 Haute | ❌ |

#### OBJECTIF 3 — Connecter l'API aux IA (distribution)

| Tâche | Priorité | Statut |
|-------|----------|--------|
| **ChatGPT** — soumettre au GPT Store (ai-plugin.json déjà prêt) | 🔴 Critique | ❌ |
| **Anthropic/Claude** — créer un MCP server AYA | 🔴 Critique | ❌ |
| **Google Gemini** — intégration via function calling / Extensions | 🟡 Haute | ❌ |
| **Perplexity** — soumettre comme source de données structurées | 🟡 Haute | ❌ |
| **Mistral** — intégration via tool use / plugins | 🟡 Haute | ❌ |
| **IA chinoises** (DeepSeek, Qwen, Baidu ERNIE) — adapter la doc, soumettre | 🟢 Moyenne | ❌ |
| **Monitoring** — tracker les appels API par source (quel IA utilise AYA) | 🟢 Moyenne | ❌ |

> **Décision API (23 mars 2026)** : L'API AYA publique est en routes Next.js `/api/aya/*` sur Vercel (gratuit, même infra). L'API FastAPI locale (`aya/api/main.py`) reste pour le dev/test.

### 17.8 Commandes

```bash
cd aya

# Scraping
python run_pipeline_fast.py      # Concurrent (12 min pour 1108 domaines)
python run_pipeline.py           # Séquentiel (debug)

# Push vers Supabase
python push_to_aya.py --dry-run         # Preview
python push_to_aya.py --min-score 20    # Push réel (score >= 20)

# API locale
uvicorn api.main:app --reload           # http://127.0.0.1:8000
# Swagger UI : http://127.0.0.1:8000/docs

# Dépendances
pip install -r requirements.txt
pip install supabase  # Pour push_to_aya.py
```

### 17.9 API AYA Publique (Vercel)

**Base URL** : `https://ai-visionary.com/api/aya`

| Route | Méthode | Description |
|-------|---------|-------------|
| `/api/aya` | GET | Index JSON — liste des endpoints, description AIO, rate limit |
| `/api/aya/llm/{domain}` | GET | **LLM-optimisé** — 5 champs ultra-simples (name, what_it_does, for_who, category, location). Cache CDN 1h. |
| `/api/aya/docs` | GET | Page HTML de documentation pour humains et bots |
| `/api/aya/search?q={query}&limit={n}` | GET | Recherche par nom/domaine/secteur/pays (max 200 résultats) |
| `/api/aya/entity/{domain}` | GET | Détail entité + ASR_DERIVED + scoring + recommendability |
| `/api/aya/stats` | GET | Statistiques : total, scores, répartition secteurs/pays |
| `/api/aya/live` | GET | Toutes les entités (payload complet, utilisé par la page /aya) |

**Découverte automatique pour agents IA** :
- `/.well-known/ai-plugin.json` — Manifeste AI plugin (standard OpenAI GPT Store)
- `aya/docs/tool_spec.json` — Spec compatible OpenAI function calling (5 tools)

**Rate limit** : 30 req/min par IP, aucune auth requise.

**Fichiers** :
| Fichier | Rôle |
|---------|------|
| `app/api/aya/route.ts` | Index JSON des endpoints |
| `app/api/aya/llm/[domain]/route.ts` | **Endpoint LLM** — 5 champs ultra-simples, O(1) lookup |
| `app/api/aya/docs/route.ts` | Page HTML documentation |
| `app/api/aya/search/route.ts` | Endpoint recherche |
| `app/api/aya/entity/[domain]/route.ts` | Endpoint détail entité |
| `app/api/aya/stats/route.ts` | Endpoint statistiques |
| `app/api/aya/live/route.ts` | Endpoint liste complète |
| `lib/aya/llm-format.ts` | **Lib partagée** — buildLlmSummary(), buildPlainTextDescription(), filtrage garbage |
| `public/.well-known/ai-plugin.json` | Manifeste AI plugin (mis à jour 25 mars) |
| `public/.well-known/openapi.json` | OpenAPI 3.1.0 spec (ajouté endpoint llm) |
| `aya/docs/tool_spec.json` | Spec OpenAI function calling |

### 17.10 Sécurité (23 mars 2026)

- ✅ Clé Ed25519 **rotée** — ancienne `ayo-root-2026` compromise, nouvelle `AYO-KEY-2026-03`
- ✅ Clé privée dans `AYO_SIGNING_PRIVATE_KEY` (env var Vercel + .env.local)
- ✅ `verifyAsrSignature()` public + `signAsrContent()` privé (serveur only)
- ✅ `ADMIN_SECRET` supprimé de `scripts/e2e-test.js`
- ✅ Stripe price IDs / payment links — plus de fallbacks hardcodés
- ✅ `.firebaserc` + `env.template` supprimés
- ✅ Repo GitHub **public** (`NeousAxis/ai-visionary`)
- ✅ `.vercelignore` — `/aya/` et `scripts/` exclus du deploy Vercel

---

## 18. SESSION SIGNAL LLM (25 mars 2026)

> **Objectif** : Rendre les données AYA immédiatement consommables par les LLM.
> **Principe** : Les LLM ne choisissent pas "la meilleure source". Ils choisissent la source la plus **simple + stable + répétée**.

### 18.1 Les 4 Chantiers Signal LLM

#### Chantier 1 — Endpoint `/api/aya/llm/{domain}` ✅

Nouvel endpoint ultra-simple retournant 5 champs :
```json
{
  "name": "Stripe",
  "what_it_does": "Online payment processing platform for internet businesses.",
  "for_who": "Businesses and developers.",
  "category": "Technology & SaaS",
  "location": "United States"
}
```

**Fichiers créés** :
- `lib/aya/llm-format.ts` — Bibliothèque partagée : `buildLlmSummary()`, `buildPlainTextDescription()`, filtrage garbage services, mappings pays/secteurs EN/FR
- `app/api/aya/llm/[domain]/route.ts` — Route API, lookup O(1) via `getAyaEntityByUrl()`, cache CDN 1h

**Priorité des descriptions** (dans llm-format.ts) :
1. Description Gemini enrichie (`asr_payload.enrichment.gemini_description`) — meilleure qualité
2. Services réels filtrés (mots multi-mots conservés, mots génériques seuls filtrés)
3. Meta description du site
4. Business type + location
5. Catégorie + "company" (fallback ultime)

**Filtre garbage services** : Le scraper bot détecte des mots HTML génériques (api, app, cloud, service, etc.) comme "services". Le filtre :
- Conserve les expressions multi-mots ("payment processing" → gardé)
- Filtre les mots génériques isolés ("api" seul → filtré, sauf si Gemini a enrichi)
- ~120 termes blacklistés EN/FR/DE

#### Chantier 2 — Texte brut sur pages certificat ✅

Ajout d'un paragraphe 2-4 phrases en français après la section hero sur chaque page `/aya/e/[id]`.
- Visible par les humains ET les crawlers LLM dans le HTML statique (SSR)
- Utilise `buildPlainTextDescription()` de `lib/aya/llm-format.ts`
- Noms de pays en français avec prépositions correctes ("en France", "aux États-Unis", "au Japon")

**Fichier modifié** : `app/aya/e/[id]/page.tsx` — import + section `<p>` insérée

#### Chantier 3 — Export dataset GitHub ✅

Script Python pour exporter chaque entité en fichier JSON individuel :
- Format 8 champs : les 5 champs LLM + `entity_id`, `aio_score`, `certificate_url`
- Génère aussi un `README.md` avec schema, stats, licence CC-BY-4.0

**Fichier créé** : `aya/export_github_dataset.py`
**Commande** : `cd aya && python export_github_dataset.py`
**Output** : `aya/exports/github-dataset/{domain}.json` + `README.md`

#### Chantier 4 — Domination micro-territoire Web3/AI ✅

**Fichiers créés** :
- `aya/domains_web3_ai.txt` — ~426 domaines curatés (Web3 DeFi/L1/L2/NFT + AI labs/tools/infra + SaaS)
- `aya/merge_domains.py` — Fusionne dans `domains.txt` sans doublons
- `aya/generate_top100_report.py` — Génère rapport Top 100 en markdown

**Résultat du merge** : 94 nouveaux domaines ajoutés (332 déjà présents), total 6766 domaines

### 18.2 Enrichissement Gemini (qualité des descriptions)

**Problème** : Le scraper bot détecte des mots-clés HTML génériques ("api, app, cloud") comme services pour TOUTES les entités. Arabian Business (site d'info) avait "api, app, cloud" comme activité.

**Solution** : Enrichissement via Gemini 2.0 Flash — 3 passes distinctes :

#### Pass 1 — Descriptions EN (gemini_description)
- Script : `aya/enrich_with_gemini.py`
- Gemini génère 1 phrase factuelle en anglais par entité
- Stocké dans `asr_payload.enrichment.gemini_description`
- **3339/3339 entités enrichies** ✅

#### Pass 2 — Traductions FR (gemini_description_fr)
- Même script, mode traduction FR depuis la description EN
- Stocké dans `asr_payload.enrichment.gemini_description_fr`
- **3339/3339 entités traduites** ✅
- Utilisé sur les pages certificat (site en français)
- Prêt pour le toggle EN/FR futur

#### Pass 3 — Mots-clés métier (gemini_keywords)
- Script : `aya/enrich_keywords.py`
- Gemini génère 5-8 mots-clés métier par entité depuis la description
- Stocké dans `asr_payload.enrichment.gemini_keywords` (array de strings)
- Exemples : Bundesliga → ["football", "ligue allemande", "scores"] au lieu de ["found", "legal", "website"]
- Affiché en priorité sur les certificats au lieu des mots-clés HTML garbage

**Coût total** : ~$0.05 pour les 3 passes × 3339 entités (Gemini 2.0 Flash)
**Durée** : ~25 min par passe (batches de 20, 4s entre chaque)

**Commandes** :
```bash
cd ~/AI\ VISIONARY/aya
python3 enrich_with_gemini.py     # Pass 1+2 (descriptions EN+FR)
python3 enrich_keywords.py        # Pass 3 (mots-clés)
```

**Structure enrichissement dans Supabase** :
```json
{
  "asr_payload": {
    "enrichment": {
      "gemini_description": "Stripe processes online payments for internet businesses.",
      "gemini_description_fr": "Stripe traite les paiements en ligne pour les entreprises internet.",
      "gemini_keywords": ["payment processing", "fintech", "e-commerce", "online payments", "credit cards"],
      "enriched_at": "2025-03-25T10:00:00Z"
    }
  }
}
```

**Priorité d'affichage** (dans llm-format.ts et page.tsx) :
1. `gemini_description_fr` (FR) ou `gemini_description` (EN) → descriptions
2. Services filtrés (mots multi-mots conservés, génériques filtrés) → fallback
3. Meta description du site → fallback 2
4. Secteur + localisation → fallback ultime

### 18.3 Filtre garbage services (lib/aya/llm-format.ts)

~120 termes blacklistés EN/FR/DE (api, app, cloud, service, platform, etc.)
- Conserve les expressions multi-mots ("payment processing" → gardé, c'est un vrai service)
- Filtre les mots génériques isolés ("api" seul → filtré)
- Si TOUS les services sont filtrés → pas de services affichés, Gemini prend le relais
- Si c'est le VRAI métier de l'entreprise (Twilio = API), Gemini le dit correctement

### 18.4 Audit qualité

**Fichier créé** : `aya/quality_audit.py`
**Commande** : `cd aya && python quality_audit.py` (ou `--export` pour CSV)
**Output** : `aya/exports/quality-audit-report.md`

**17 types de problèmes détectés** :
- CRITICAL : noms manquants, pas de site web, contenu NSFW
- HIGH : noms génériques, mojibake, slogans comme nom, pas de description
- MEDIUM : pays inconnu (XX), secteur générique, doublons, scores anormaux
- LOW : nom = domaine, port :443, pas encore enrichi par Gemini

### 18.5 Corrections de données (25 mars 2026)

| Action | Nombre | Détail |
|--------|--------|--------|
| Noms mojibake → latin | 57 | Arabe, chinois, japonais, russe, grec → noms latins connus |
| Entités supprimées | 3 | jarir.com (bookstore), porn.com (NSFW), gorillas.io (gambling) |
| Nouveaux domaines Web3/AI | 94 | Ajoutés à domains.txt via merge (total 6766) |
| Descriptions Gemini EN | 3339/3339 | ✅ 100% |
| Traductions Gemini FR | 3339/3339 | ✅ 100% |
| Mots-clés Gemini | 🔄 en cours | `python3 enrich_keywords.py` |
| Trigger Supabase dropped | ✅ | `DROP TRIGGER IF EXISTS update_updated_at ON aya_registry;` |

### 18.6 Réplication multi-sources (données AYA)

Les données AYA existent sur **4 sources convergentes** (principe : "si un LLM voit la même info sur plusieurs sources → donnée stable → utilisable") :

| Source | URL | Statut |
|--------|-----|--------|
| **API AYA** (Vercel) | `ai-visionary.com/api/aya/llm/{domain}` | ✅ Live |
| **GitHub** | `github.com/NeousAxis/aya-business-dataset` | ✅ 3306 fichiers JSON |
| **HuggingFace** | `huggingface.co/datasets/NeousAxis/aya-business-dataset` | ✅ CSV + JSONL |
| **Pages certificat** | `ai-visionary.com/aya/e/{id}` | ✅ HTML + JSON-LD |

### 18.7 Fichiers créés/modifiés (résumé session)

| Fichier | Action | Rôle |
|---------|--------|------|
| `lib/aya/llm-format.ts` | CRÉÉ | Bibliothèque LLM : summaries EN, descriptions FR, filtre garbage 120 termes, mappings pays FR/EN |
| `app/api/aya/llm/[domain]/route.ts` | CRÉÉ | Endpoint LLM 5 champs, O(1), cache CDN 1h |
| `app/aya/e/[id]/page.tsx` | MODIFIÉ | Paragraphe texte brut FR + description Gemini dans "Données Sémantiques" + gemini_keywords priorité |
| `app/api/aya/route.ts` | MODIFIÉ | Ajout endpoint llm dans l'index |
| `public/.well-known/openapi.json` | MODIFIÉ | Ajout path + schema LlmSummary |
| `public/.well-known/ai-plugin.json` | MODIFIÉ | Description mise à jour 3000+ entités + endpoint llm |
| `aya/export_github_dataset.py` | CRÉÉ | Export JSON individuels pour GitHub |
| `aya/enrich_keywords.py` | CRÉÉ | Enrichissement mots-clés via Gemini (5-8 par entité) |
| `aya/domains_web3_ai.txt` | CRÉÉ | ~426 domaines Web3/AI curatés |
| `aya/merge_domains.py` | CRÉÉ | Merge domaines sans doublons |
| `aya/generate_top100_report.py` | CRÉÉ | Rapport Top 100 markdown |
| `aya/enrich_with_gemini.py` | MODIFIÉ | Round 2 : enrichissement TOUTES les entités (pas seulement garbage) |
| `aya/quality_audit.py` | CRÉÉ | Audit qualité complet (17 checks) |

### 18.8 Ce qui reste à faire

| # | Tâche | Priorité | Statut |
|---|-------|----------|--------|
| 1 | Finir `enrich_keywords.py` (3339 entités) | 🔴 Critique | ✅ 3338/3339 (fix_keywords.py) |
| 2 | Re-exporter GitHub dataset avec descriptions Gemini | 🟡 Haute | ✅ 3306 fichiers |
| 3 | Re-exporter HuggingFace avec données enrichies | 🟡 Haute | ✅ CSV + JSONL |
| 4 | Scraper les 94 nouveaux domaines Web3/AI | 🟡 Haute | ✅ Mergés dans domains.txt |
| 5 | **Pagination serveur page /aya** — 20 entités/page, URL-based (?page=X&q=X&sort=X), BackButton history.back() | 🔴 Critique UX | ✅ FAIT |
| 6 | Toggle EN/FR sur le site (i18n) | 🟡 Haute | ❌ Session dédiée |
| 7 | Campagne email entreprises indexées | 🟡 Haute | ❌ |
| 8 | Session 7 — Cycle de vie client | 🟡 Haute | ❌ Session dédiée |
| 9 | Session 8 — SEO/Légal | 🟡 Haute | ❌ Session dédiée |
| 10 | Enrichissement registres du commerce — Zefix (CH), Sirene (FR), Companies House (UK) | 🟢 Long terme | ❌ |
| 11 | Atteindre 10'000+ entreprises | 🟢 Long terme | ❌ |

### 18.9 Session Signal LLM — Suite (25 mars 2026, après-midi/soir)

> Cette section documente la continuation de la session Signal LLM du 25 mars 2026.

#### Enrichissement Gemini — Mots-clés (Pass 3, terminée)

- **Script** : `aya/enrich_keywords.py` + `aya/fix_keywords.py`
- **Résultat** : 3338/3339 entités enrichies avec 6-8 mots-clés métier chacune
- `fix_keywords.py` relance Gemini sur les entités ayant moins de 6 mots-clés pour garantir un minimum
- Stocké dans `asr_payload.enrichment.gemini_keywords` (array de strings)
- Exemples : Bundesliga → `["football", "ligue allemande", "scores en direct", "Bundesliga", "matchs", "calendrier"]`
- **Affichage** : Les `gemini_keywords` sont affichés en priorité sur les pages certificat `/aya/e/[id]` au lieu des mots-clés HTML garbage du scraper

#### Pagination serveur page /aya

**Problème** : La page `/aya` chargeait TOUTES les entités (3000+) côté client → lent, mauvaise UX.

**Solution** : Pagination serveur complète avec URL-based state.

**Fichiers créés** :
- `app/components/AyaRegistryClient.tsx` — Composant client React avec :
  - Recherche debounced (300ms) synchronisée dans l'URL (`?q=`)
  - Pagination URL-based (`?page=X`)
  - 5 modes de tri (`?sort=default|certified|alpha|score|country`)
  - Badges "ASR CERTIFIÉ" (vert) / "INDEXÉ" (gris)
  - Barre de stats (total / certifiés / indexés)
  - Navigation bouton Précédent / Suivant + numéros de page
- `app/components/BackButton.tsx` — Composant `history.back()` pour les pages certificat

**Fichiers modifiés** :
- `app/aya/page.tsx` — Réécrit en **Server Component** : lit `searchParams`, appelle `getAyaEntitiesPaginated()`, passe les données à `AyaRegistryClient`
- `lib/db.ts` — Nouvelle fonction `getAyaEntitiesPaginated(page, limit, search, sort)` :
  - Recherche SQL `ilike` sur `display_name`, `website`, `sector`, `country`
  - Tri : `default` (certifiés d'abord, puis `created_at DESC`), `certified` (que les `payment_completed=true`), `alpha`, `score DESC`, `country`
  - Retourne `{ entities, total, page, totalPages }`
  - 20 entités par page

**Paramètres URL** : `?page=2&q=stripe&sort=score` — le back button du navigateur conserve la page/recherche/tri.

#### Cache CDN sur les routes API

| Route | Cache | Durée |
|-------|-------|-------|
| `/api/aya/live` | `s-maxage=300` | 5 min |
| `/api/aya/search` | `s-maxage=60` | 1 min |
| `/api/aya/stats` | `s-maxage=600` | 10 min |
| `/api/aya/entity/[domain]` | `s-maxage=3600` | 1 heure |
| `/api/aya/llm/[domain]` | `s-maxage=3600` | 1 heure |

#### Fix performance endpoint entity

- **Avant** : `getAyaEntityByUrl()` faisait un `SELECT *` sur toute la table et filtrait côté JS → O(n)
- **Après** : Requête SQL `ilike` sur `website` directement → O(1) avec index

#### Pages certificat — Améliorations

- **Description Gemini FR** en priorité dans la section "Données Sémantiques" (au lieu des services garbage)
- **Mots-clés Gemini** (`gemini_keywords`) affichés en priorité au lieu des mots-clés HTML du scraper
- **Paragraphe texte brut FR** ajouté après la section hero pour les crawlers LLM
- **BackButton** composant ajouté (flèche ← en haut à gauche, `history.back()`)

#### Données dans Supabase — État final

| Champ | Path | Couverture |
|-------|------|-----------|
| Description EN | `asr_payload.enrichment.gemini_description` | 3339/3339 (100%) |
| Description FR | `asr_payload.enrichment.gemini_description_fr` | 3339/3339 (100%) |
| Mots-clés | `asr_payload.enrichment.gemini_keywords` | 3338/3339 (99.97%) |
| Date enrichissement | `asr_payload.enrichment.enriched_at` | ISO timestamp |

#### Backup git

- Tag : `backup-before-bilingual-20260325-1024`

#### Fichiers créés (session complète 25 mars)

| Fichier | Rôle |
|---------|------|
| `lib/aya/llm-format.ts` | Bibliothèque LLM : `buildLlmSummary()`, `buildPlainTextDescription()`, filtre garbage ~120 termes, mappings pays FR/EN |
| `app/api/aya/llm/[domain]/route.ts` | Endpoint LLM 5 champs, O(1), cache CDN 1h |
| `app/components/AyaRegistryClient.tsx` | Composant client pagination /aya (debounced search, URL-based state) |
| `app/components/BackButton.tsx` | Composant `history.back()` pour certificats |
| `aya/export_github_dataset.py` | Export JSON individuels pour GitHub (3306 fichiers) |
| `aya/merge_domains.py` | Merge domaines sans doublons |
| `aya/generate_top100_report.py` | Rapport Top 100 markdown |
| `aya/domains_web3_ai.txt` | ~426 domaines Web3/AI curatés |
| `aya/enrich_keywords.py` | Enrichissement mots-clés Gemini (6-8 par entité) |
| `aya/fix_keywords.py` | Correction mots-clés (force minimum 6 mots-clés) |
| `aya/quality_audit.py` | Audit qualité complet (17 checks) |

#### Fichiers modifiés (session complète 25 mars)

| Fichier | Modification |
|---------|-------------|
| `app/aya/page.tsx` | Réécrit en Server Component avec pagination serveur |
| `app/aya/e/[id]/page.tsx` | Description Gemini prioritaire, gemini_keywords, BackButton, paragraphe texte brut |
| `lib/db.ts` | Ajout `getAyaEntitiesPaginated()` + fix `getAyaEntityByUrl()` O(1) |
| `app/api/aya/route.ts` | Ajout endpoint llm dans l'index JSON |
| `app/api/aya/entity/[domain]/route.ts` | Fix O(1) + cache headers CDN |
| `app/api/aya/live/route.ts` | Cache headers CDN (5min) |
| `app/api/aya/search/route.ts` | Cache headers CDN (1min) |
| `app/api/aya/stats/route.ts` | Cache headers CDN (10min) |
| `app/api/aya/llm/[domain]/route.ts` | Cache headers CDN (1h) |
| `public/.well-known/openapi.json` | Ajout path `/aya/llm/{domain}` + schema `LlmSummary` |
| `public/.well-known/ai-plugin.json` | Description mise à jour 3000+ entités + endpoint llm |
| `aya/enrich_with_gemini.py` | Round 2 : enrichissement TOUTES les entités (EN+FR) |
| `app/page.tsx` | Bandeau stats homepage + exemples recherche AYA + section "Entreprises technologiques" |

#### Ce qui reste à faire après cette session

| # | Tâche | Priorité |
|---|-------|----------|
| 1 | Toggle EN/FR sur le site (i18n) | 🟡 Haute |
| 2 | Campagne email entreprises indexées | 🟡 Haute |
| 3 | Session 7 — Finir cycle de vie client (rappels email, crons, page renouvellement, webhooks Stripe subscription) | 🟡 Haute |
| 4 | Session 8 — SEO/Légal/Tests | 🟡 Haute |
| 5 | Enrichissement registres du commerce — Zefix (CH), Sirene (FR), Companies House (UK) | 🟢 Long terme |
| 6 | Atteindre 10'000+ entreprises | 🟢 Long terme |
| 7 | Soumission There's An AI For That | 🟢 Moyenne |
| 8 | Re-exporter GitHub + HuggingFace après chaque nouveau batch | 🟢 Continue |

---

## 19. SESSION MISE À JOUR CLIENT (27 mars 2026)

> **Branche** : `feature/client-update-flow`
> **Objectif** : Permettre aux clients certifiés de mettre à jour leurs données AIO via un formulaire web sécurisé.

### 19.1 Ce qui a été créé

#### Fichiers créés

| Fichier | Rôle |
|---------|------|
| `app/update/[entityId]/page.tsx` | Page serveur — charge l'entité, extrait les valeurs du formulaire, génère le token d'auth |
| `app/update/[entityId]/UpdateFormClient.tsx` | Composant client — formulaire 7 blocs AIO avec onglets, dirty tracking, submit |
| `app/update/[entityId]/OtpGate.tsx` | Gate d'authentification OTP — vérifie l'email du client avant accès au formulaire |
| `app/renew/[entityId]/page.tsx` | Page de renouvellement (liens Stripe pour upgrader/renouveler) |
| `app/api/update-entity/route.ts` | API de mise à jour — merge les données modifiées, recalcule le score via le moteur AIO |
| `app/api/regenerate-files/route.ts` | API de régénération des fichiers ASR (Pack PRO) |
| `lib/update-form-config.ts` | Configuration des 7 blocs : champs, types, labels, options, hints |
| `lib/form-to-extract.ts` | Conversion formulaire ↔ AyoExtract (format du moteur de scoring) |
| `lib/update-token.ts` | Génération/vérification de tokens signés pour l'API update |

#### Fichiers modifiés

| Fichier | Modification |
|---------|-------------|
| `app/aya/e/[id]/page.tsx` | Bouton "Mettre a jour" sur la page certificat (entités certifiées uniquement) |
| `lib/db.ts` | Fonction `updateEntityData()` — suppression de la colonne `updated_at` inexistante |

### 19.2 Flux de mise à jour client

```
1. Client va sur son certificat /aya/e/[entityId]
2. Clique "Mettre a jour"
3. Page /update/[entityId] → OTP Gate
4. Client entre son email → OTP envoyé
5. Client vérifie le code → Formulaire 7 blocs affiché
6. Client modifie les champs souhaités
7. Clique "Enregistrer"
8. Seuls les champs RÉELLEMENT modifiés sont envoyés (comparaison valeur initiale vs actuelle)
9. Moteur AIO recalcule le score complet
10. Score + données mis à jour dans Supabase
11. Pack PRO : bouton "Régénérer mes fichiers ASR" disponible
```

### 19.3 Règles de scoring lors de la mise à jour

- **Scoring toujours via le moteur AIO** (`computeAioScore`) — pas de contournement
- **Comparaison valeur initiale vs actuelle** au moment du submit — seuls les champs dont la valeur a RÉELLEMENT changé sont envoyés au serveur
- **Si rien n'est modifié** → message "Aucune modification detectee", score inchangé
- **Le scan original** (camelCase keys : `hasJsonLd`, `hasFaqContent`, etc.) est correctement lu grâce au support double format
- **Les champs pédagogiques** (has_faq, etc.) peuvent contenir des strings descriptives (héritage AYO) → `hasTruthyValue()` les détecte correctement
- **Les données existantes ne sont JAMAIS écrasées** par des valeurs vides/par défaut du formulaire

### 19.4 Types de champs dans le formulaire

| Type | Rendu | Comportement |
|------|-------|-------------|
| `text` | Input texte | Éditable |
| `textarea` | Textarea multi-lignes | Éditable |
| `array` | Textarea (1 élément par ligne) | Converti en array au submit |
| `boolean` | Toggle switch | Oui/Non |
| `select` | Dropdown | Options prédéfinies (secteurs, pays) |
| `date` | Input date | Format ISO |
| `readonly` | Input grisé | Non modifiable (données du scan) |
| `url_locked` | Input grisé + bouton crayon | Verrouillé par défaut, clic crayon pour déverrouiller |

### 19.5 Bugs corrigés dans cette session

| Bug | Cause | Fix |
|-----|-------|-----|
| Erreur "mise à jour en base" | Colonnes `last_update`, `next_review_due`, `renewal_reminder_sent` n'existent pas dans Supabase | Supprimées de la requête update |
| Score baisse de 77→63 sans modification | Formulaire envoyait TOUS les champs (y compris les defaults vides) qui écrasaient les bonnes données | Comparaison valeur initiale vs actuelle — seuls les vrais changements sont envoyés |
| Score baisse de 77→76 | Clés scan en camelCase (`hasFaqContent`) non lues par le code qui attendait snake_case (`has_faq_content`) | Support double format camelCase/snake_case |
| Liens documents disparaissent | Champs URL (FAQ, glossaire, docs) pas pré-remplis depuis les données existantes | Pré-remplissage depuis le website de l'entité (`/.ayo/faq.json`, etc.) |
| Champs URL modifiables par défaut | Risque de modifier accidentellement les liens | Type `url_locked` : grisé par défaut, bouton crayon pour déverrouiller |
| Accès non authentifié au formulaire | N'importe qui avec l'entityId pouvait modifier les données | OTP Gate : vérification email avant accès |

### 19.6 Ce qui reste à faire (Session 8)

| Tâche | Priorité |
|-------|----------|
| Crons Vercel : rappels email J-30, J-7, J-0 pour MAJ annuelle | 🟡 Haute |
| Webhooks Stripe : `invoice.payment_failed`, `customer.subscription.deleted` | 🟡 Haute |
| Expiration Pack PRO (3 ans) : rappels + page renouvellement | 🟡 Haute |
| Page renouvellement `/renew/[entityId]` : finaliser avec Stripe Checkout | 🟡 Haute |
| SEO metadata sur toutes les pages (<title>, <meta description>, Open Graph) | 🟡 Haute |
| Compléter pages légales (confidentialité + mentions) | 🟡 Haute |
| sitemap.ts dynamique depuis Supabase | 🟡 Haute |
| Dashboard client (futur) : espace personnel OTP | 🟢 Moyenne |

### 19.7 Améliorations qualité registre (session 7, suite)

#### Email post-mise à jour

- **Clients PRO** (`pack_type` contient "pro") : génération des 5 fichiers + ZIP + envoi email avec pièce jointe. `maxDuration = 120` sur `update-entity/route.ts`.
- **Clients AYA sub** (non PRO) : email de confirmation avec score avant/après.
- `UpdateFormClient.tsx` affiche un bandeau vert selon `filesEmailSent` dans la réponse API.
- Les erreurs email sont catchées silencieusement — la mise à jour réussit même si l'email échoue.

#### Bouton "Renouveler" sur les certificats

- Ajouté à côté de "Mettre à jour" pour les entités certifiées (`isCertified`)
- Couleur coral (#CE6A6B), lien vers `/renew/[entityId]`
- Les deux boutons sont dans un `<div style={{ display: 'flex', gap: '8px' }}>`

#### Disclaimer sur les pages INDEXÉ

- Paragraphe affiché pour les entités `!isCertified` sur `/aya/e/[id]`
- Texte : "Cette fiche a été générée automatiquement par le bot AYA..."
- Lien "Revendiquez cette fiche" → `/diagnostic`

#### Filtre NSFW dans `db.getAyaEntitiesPaginated()`

Chaîne `.not()` sur Supabase avant le retour :
```typescript
.not('display_name', 'ilike', '%porn%')
.not('display_name', 'ilike', '% sex %')
.not('display_name', 'ilike', '%xxx%')
.not('display_name', 'ilike', '%escort%')
.not('display_name', 'ilike', '%onlyfans%')
.not('display_name', 'ilike', "['%")    // Python lists
.not('display_name', 'ilike', '{{%')    // Template artifacts
```

#### `cleanDisplayName()` dans `AyaRegistryClient.tsx`

Fonction client-side qui nettoie les noms avant affichage :
- Rejette les listes Python `['item']` → fallback domain
- Rejette les templates `{{` ou `{%` → fallback domain
- Rejette les noms à dominante CJK/arabe/cyrillique (nonLatin > latin && nonLatin > 2) → fallback domain
- Strip les emojis en tête (`\p{Emoji_Presentation}`)
- Strip les `|#!` en tête

#### StatsBar animation 0 → 4400+

- `StatsBar.tsx` : `useState({ total: 4400, countries: 73 })` comme valeur initiale (réaliste)
- Animation démarre immédiatement au chargement (0 → 4400)
- L'API `/api/aya/stats` corrige silencieusement si la vraie valeur diffère
- `useCountUp` utilise `fromRef` pour animer depuis la valeur courante, pas depuis 0
- `app/page.tsx` est `"use client"` → impossible de faire SSR fetch des stats

#### Détection PRO dans `update-entity/route.ts`

```typescript
const isPro = entity.pack_type &&
    ['pro', 'pack pro', 'pack_pro'].includes(entity.pack_type.toLowerCase());
```
Génère les fichiers uniquement si `isPro && email`.
