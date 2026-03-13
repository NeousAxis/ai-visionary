# PLAN D'ACTION COMPLET — AI VISIONARY / AYO

> **Date** : 13 mars 2026
> **Auteur** : Claude (assistant) pour Cyril Leger
> **Périmètre** : Prompt AYO, Scoring, Production des 5 fichiers, Tunnel de vente, Emails, Sécurité, Questionnaire Universel, Composants UI, Sémantique, ASR Crypto, Pages légales, SEO, Cycle de vie client
> **Dernière mise à jour** : 13 mars 2026 — Re-scan complet de TOUS les fichiers du projet

---

## TABLE DES MATIÈRES

1. [État des lieux — Ce qui existe](#1-état-des-lieux)
2. [Les 3 bugs critiques de scoring](#2-bugs-critiques-scoring)
3. [Rewrite complet du prompt AYO](#3-rewrite-prompt-ayo)
4. [Questionnaire universel professionnel](#4-questionnaire-universel)
5. [Scoring — Corrections](#5-scoring-corrections)
6. [Production des 5 fichiers PRO](#6-production-5-fichiers)
7. [Tunnel de vente (tel qu'il est)](#7-tunnel-de-vente)
8. [Emails — 2 formats (PRO + Abo)](#8-emails)
9. [Sécurité — Audit et remédiation](#9-securite)
10. [Ordre d'exécution](#10-ordre-execution)
11. [Cycle de vie client — MAJ, Renouvellements, Notifications](#11-cycle-de-vie-client)
12. [Page certificat AYA public + Registre en ligne](#12-page-certificat-aya) *(EXISTE — à améliorer)*
13. [Hébergement ASR + Fichiers](#13-hébergement-asr)
14. [Analytics + Métriques business](#14-analytics)
15. [Gestion des erreurs UX](#15-gestion-erreurs-ux)
16. [Conformité légale (RGPD, CGV)](#16-conformité-légale) *(pages existent — incomplètes)*
17. [Composants UI — Chat, Paiement, Modals](#17-composants-ui) *(NOUVEAU)*
18. [Modules Sémantiques + ASR Crypto](#18-modules-semantiques-crypto) *(NOUVEAU)*
19. [SEO, Sitemap, Robots](#19-seo-sitemap-robots) *(NOUVEAU)*
20. [Homepage + Pages Marketing](#20-homepage-marketing) *(NOUVEAU)*

---

## 1. ÉTAT DES LIEUX

### Architecture actuelle

```
Utilisateur → /diagnostic (chatbot AYO)
  → Phase 1 : Donne son URL → Scanner aio-scanner.ts scanne le site
  → Phase 2 : Questionnaire enrichi (5-7 questions via LLM)
  → Phase 3 : Score final AIO → Proposition achat (AYA ou PRO)
  → Email capture → Stripe checkout
  → Webhook Stripe → Génération fichiers → Email livraison
```

### Fichiers clés

| Fichier | Rôle |
|---------|------|
| `app/api/chat/route.ts` | Chatbot AYO — 2750 lignes, tout le flux diagnostic |
| `lib/ayo-system-prompt.ts` | System prompt V3 (104 lignes) |
| `lib/aio-score-engine.ts` | Moteur de score déterministe (319 lignes) |
| `lib/aio-scanner.ts` | Scanner URL — HTML, JSON-LD, ASR, AYA (179 lignes) |
| `lib/ayo-generators.ts` | Générateurs des 5 fichiers PRO partagés (677 lignes) |
| `lib/ayo-crypto.ts` | Signature Ed25519 + génération ASR JSON-LD (399 lignes) |
| `lib/db.ts` | Firebase Admin Firestore operations (418 lignes) |
| `app/api/webhooks/checkout-success/route.ts` | Webhook Stripe post-paiement (477 lignes) |
| `app/api/create-checkout/route.ts` | Création session Stripe (137 lignes) |
| `app/api/light-report/route.ts` | Envoi Pack Light gratuit (234 lignes) |
| `app/api/auth/send-otp/route.ts` | Envoi OTP par email (82 lignes) |
| `app/api/auth/verify-otp/route.ts` | Vérification OTP (90 lignes) |
| `app/api/debug/clean/route.ts` | Nettoyage admin AYA (64 lignes) |
| `app/api/debug/email/route.ts` | Test email Resend (46 lignes) |
| `app/api/debug/test-ayo/route.ts` | Test pipeline AYO sans Stripe (174 lignes) |
| `app/api/stripe/portal/route.ts` | Stripe Billing Portal (89 lignes) — ⚠️ SANS AUTH |
| `app/api/admin/logs/route.ts` | API admin logs Firestore (66 lignes) |
| `app/api/aya/live/route.ts` | API publique entités AYA live (24 lignes) |
| `lib/ayo-semantics.ts` | Génération FAQ/Glossaire/Manifest via Gemini (132 lignes) |
| `lib/ayo-categories.ts` | Taxonomie 25 secteurs d'activité (40 lignes) |
| `lib/external-context.ts` | Génération external_context JSON (64 lignes) |
| `lib/asr-emit-mode.ts` | Blueprint pipeline scellement ASR — ⚠️ PSEUDO-CODE (78 lignes) |
| `lib/asr-seal-spec.ts` | Interfaces TypeScript ASR/Seal — ⚠️ TYPES SEULS (45 lignes) |
| `lib/asr-compliance-test.ts` | Blueprint test conformité ASR — ⚠️ PSEUDO-CODE (85 lignes) |

### Pages frontend existantes

| Fichier | Rôle | État |
|---------|------|------|
| `app/page.tsx` | Homepage — 9 sections, pricing, CTA (320 lignes) | ✅ Fonctionnel, styles inline |
| `app/diagnostic/page.tsx` | Page chat AYO fullscreen (36 lignes) | ✅ Fonctionnel, pas de SEO metadata |
| `app/aya/page.tsx` | **REGISTRE AYA PUBLIC** — recherche + grille entités (205 lignes) | ✅ EXISTE DÉJÀ |
| `app/aya/e/[id]/page.tsx` | **CERTIFICAT AYA** — page détail entité (216 lignes) | ✅ EXISTE DÉJÀ |
| `app/certificate/[id]/page.tsx` | Ancien certificat (doublon) (115 lignes) | ⚠️ DOUBLON à supprimer |
| `app/ai-et-votre-entreprise/page.tsx` | Page marketing pédagogique (179 lignes) | ✅ OK |
| `app/confidentialite/page.tsx` | Politique de confidentialité (35 lignes) | ⚠️ TROP COURTE |
| `app/mentions/page.tsx` | Mentions légales (33 lignes) | ⚠️ TROP COURTE |

### Composants React

| Fichier | Rôle | État |
|---------|------|------|
| `app/components/AyoChat.tsx` | Chat interactif principal (~52KB) | ⚠️ Markdown non-sanitisé, types `any[]` |
| `app/components/PaymentHandler.tsx` | Traitement paiement invisible (41 lignes) | ⚠️ Pas de retry, erreur silencieuse |
| `app/components/PaymentSuccessModal.tsx` | Modal post-paiement (191 lignes) | ⚠️ DOUBLON webhook avec PaymentHandler |

### Utilitaires existants (déjà créés)

| Fichier | Rôle | État |
|---------|------|------|
| `lib/logger.ts` | Logger structuré avec correlation IDs | ✅ OK |
| `lib/auth.ts` | Middleware admin (ADMIN_SECRET, timing-safe) | ✅ OK |
| `lib/validators.ts` | Schemas Zod (URL, email, OTP, SSRF) | ✅ OK |
| `lib/rate-limit.ts` | Rate limiting in-memory par IP | ✅ OK |
| `lib/sanitize.ts` | Sanitizer anti-injection LLM | ✅ OK |

---

## 2. BUGS CRITIQUES DE SCORING

### Bug #1 — Le LLM met q=1 sur des réponses poubelle

**Localisation** : `app/api/chat/route.ts:1981-1982`

**Le problème** : Le message utilisateur envoyé au LLM d'extraction dit :
```
"PRIORITIZE THIS INFO AND SET q=1"
```
Cela ordonne au LLM de mettre q=1 sur TOUTE réponse du questionnaire, même :
- "aucun" → stocké avec q=1
- "ça ne te regarde pas" → stocké avec q=1
- "non" → stocké avec q=1

**Post-validation existante** (lignes 2194-2289) : Rattrape CERTAINS cas (indicateurs sans chiffres, certifications sans noms reconnus, pricing vague) mais PAS :
- Réponses nihilistes ("aucun", "rien", "non applicable")
- Réponses agressives ou hors sujet
- Réponses de refus implicite ("je ne sais pas", "pas pour le moment")

**Fix requis** :
1. Supprimer "SET q=1" du message d'extraction (ligne 1982)
2. Ajouter une validation sémantique post-LLM universelle (pas champ par champ)
3. Pattern de détection : `"aucun|rien|non|pas de|n'ai pas|ne sais pas|pas applicable|ça ne te regarde|pas encore|jamais"` → q=0

### Bug #2 — Scores blocs ≠ Score final (hard cap invisible)

**Localisation** : `lib/aio-score-engine.ts:158-168`

**Le problème** : Le moteur applique un hard cap `Math.min(total, 50)` quand il n'y a pas de JSON-LD et pas d'AYA. Mais les scores individuels des 7 blocs sont affichés SANS ce cap. Résultat :
- Bloc Identité : 10/10
- Bloc Offre : 20/20
- ... (somme = 95)
- Score Final : **50/100** (le cap silencieux)

L'utilisateur voit une contradiction totale entre les blocs et le total.

**Fix requis** :
1. **Option A** : Afficher les scores blocs APRÈS application proportionnelle du cap
   - Si cap appliqué (50), multiplier chaque bloc par (50/total_brut)
2. **Option B** (Recommandée) : Garder les blocs vrais MAIS afficher une explication visible :
   - "⚠️ Plafond technique appliqué : Sans JSON-LD structuré ni inscription AYA, le score est plafonné à 50/100."
   - "Vos données valent X/100 mais la lisibilité technique limite à 50."

### Bug #3 — Pas de validation sémantique des réponses

**Le problème** : Le système ne distingue pas :
- "ISO 27001" (certification réelle → q=1) de "aucune" (négation → q=0)
- "12 communes" (KPI concret → q=1) de "bouche à oreille" (non mesurable → q=0.5)
- "3 étapes : audit, stratégie, implémentation" (process réel → q=1) de "on fait comme on peut" (vague → q=0)

La post-validation attrape certains champs spécifiques mais il n'y a PAS de règle universelle pour détecter les négations/refus.

**Fix requis** : Créer `lib/semantic-validator.ts` avec :
1. **Détecteur de négation universelle** — patterns : `^(non|aucun|rien|pas de|n'ai pas|ne sais pas|pas applicable|pas encore|jamais|je refuse|ça ne .* regarde)$`
2. **Détecteur de réponse vague** — patterns : `^(oui|ok|possible|peut-être|on verra|un peu|quelques|certains)$` → q=0.5 max
3. **Détecteur de réponse hostile** — patterns : `regarde pas|mêle pas|vie privée|confidentiel` → q=0
4. **Validation par type de champ** :
   - Champs numériques (key_indicators) : doit contenir un `\d` → sinon q=0.5 max
   - Champs liste (services, products) : doit contenir ≥2 items → sinon q=0.5
   - Champs booléens (has_faq, has_glossary) : "non"/"pas de" → value=false, q=0
   - Champs date (last_review_date) : doit contenir une date parsable → sinon q=0

---

## 3. REWRITE COMPLET DU PROMPT AYO

### Problème actuel

Le système prompt actuel (`lib/ayo-system-prompt.ts`) est propre (80 lignes) MAIS le vrai prompt est dans `chat/route.ts` qui contient encore :
1. Un prompt d'extraction de 130 lignes (lignes 1826-1962) avec "SET q=1"
2. Aucune guidance sur COMMENT poser les questions du questionnaire
3. Le LLM "invente" les questions au lieu de suivre un questionnaire structuré

### Objectif du rewrite

Le prompt AYO doit produire un **questionnaire universel professionnel** qui :
1. Couvre TOUS les champs nécessaires aux 5 fichiers PRO (ASR, manifest, FAQ, glossaire, external_context)
2. Est adapté à TOUTE entreprise (B2B, B2C, service, produit, artisan, startup, grand groupe)
3. Obtient des réponses de **qualité** exploitables par les IA
4. Guide l'utilisateur pour qu'il donne des réponses SPÉCIFIQUES et MESURABLES
5. Ne se contente pas d'un "oui/non" mais relance si la réponse est vague

### Prompt V4 — Structure cible

```
SYSTEM PROMPT (≈100 lignes) :
  - Identité AYO
  - Cadre AIO (7 blocs, poids)
  - Règles strictes (pas de calcul, pas de mensonge)
  - 3 phases claires

PHASE 1 — COLLECTE URL + SCAN
  - Demander l'URL
  - Le code (pas le LLM) scanne et calcule le score initial
  - Le code injecte le résultat dans le contexte du LLM
  - Le LLM AFFICHE les scores fournis par le système

PHASE 2 — QUESTIONNAIRE UNIVERSEL (voir section 4)
  - Le LLM suit un SCRIPT de questions prédéfinies
  - Il adapte l'ordre selon les blocs faibles
  - Il relance si la réponse est trop vague
  - Format JSON question_block OBLIGATOIRE

PHASE 3 — RÉSULTAT + CONVERSION
  - Le code recalcule le score enrichi
  - Le LLM affiche le delta
  - Capture email
  - Proposition AYA/PRO
```

### Changements code dans `chat/route.ts`

1. **Ligne 1982** : Supprimer "PRIORITIZE THIS INFO AND SET q=1"
   - Remplacer par : "Extract JSON now. Apply q values STRICTLY according to the quality rules in the system prompt."

2. **Prompt d'extraction** (lignes 1826-1962) : Garder tel quel SAUF :
   - Supprimer toute instruction qui force q=1
   - Renforcer les exemples de q=0 (négations, refus)
   - Ajouter un bloc "RÉPONSES INVALIDES" avec patterns de détection

3. **System prompt** (`lib/ayo-system-prompt.ts`) : Ajouter la liste des questions du questionnaire universel (voir section 4) pour que le LLM suive un script

4. **Post-validation** (lignes 2194-2289) : Étendre avec le `semantic-validator.ts`

---

## 4. QUESTIONNAIRE UNIVERSEL PROFESSIONNEL

### Objectif

Obtenir TOUTES les informations nécessaires pour :
- Remplir les 7 blocs AIO avec des données de qualité (q=1)
- Générer un ASR complet et exploitable par les IA
- Générer un manifest, FAQ, glossaire, external_context riches
- Permettre aux bots IA de RECOMMANDER l'entité dans AYA

### Les questions (par bloc, adaptées à tout type d'entreprise)

#### BLOC 1 — Identité & Ancrage (/10)
**Champs cibles** : name, legal_name, business_type, city, country, contact_email, contact_phone

> **Q1** : "Quel est le nom commercial exact de votre entreprise et sa forme juridique (SA, SARL, auto-entrepreneur, association...) ?"
> *Relance si vague* : "Pour que les IA vous identifient correctement, j'ai besoin du nom officiel tel qu'il apparaît sur vos documents légaux."

> **Q2** : "Dans quelle ville et quel pays êtes-vous basé(e) ? Si vous avez plusieurs localisations, indiquez la principale."
> *Relance* : "L'adresse exacte n'est pas nécessaire, mais la ville est essentielle pour la recherche locale par les IA."

> **Q3** : "Quel est votre email professionnel de contact et votre numéro de téléphone ?"

#### BLOC 2 — Clarté de l'Offre (/20)
**Champs cibles** : services, products, use_cases, target_audience, pricing_indication

> **Q4** : "Décrivez vos services ou produits principaux (3 à 5 maximum). Pour chacun, donnez un nom clair et une phrase de description."
> *Relance si <2* : "Les IA ont besoin d'au moins 2-3 offres distinctes pour vous recommander. Pouvez-vous détailler ?"
> *Relance si vague* : "Au lieu de 'consulting', précisez : 'Consulting en transformation digitale pour PME industrielles'. Plus c'est spécifique, mieux les IA vous trouvent."

> **Q5** : "Qui sont vos clients cibles ? (ex: PME de 10-50 salariés, particuliers 25-45 ans, collectivités locales...)"
> *Relance* : "Essayez d'être précis sur le profil : taille d'entreprise, secteur, ou tranche d'âge/localisation pour les particuliers."

> **Q6** : "Donnez 2-3 exemples concrets de problèmes que vous résolvez pour vos clients (cas d'usage)."
> *Relance* : "Pensez à des situations réelles : 'Un restaurateur qui voulait réduire ses pertes alimentaires de 30%' vaut mieux que 'réduction des coûts'."

> **Q7** : "Comment sont structurés vos tarifs ? (fourchette de prix, modèle d'abonnement, tarif horaire, sur devis avec fourchette indicative...)"
> *Relance si "sur devis" seul* : "'Sur devis' seul ne permet pas aux IA de vous positionner. Pouvez-vous donner une fourchette indicative ? (ex: 'entre 500 et 5000€ selon le projet')"

#### BLOC 3 — Processus & Méthodes (/15)
**Champs cibles** : process_steps, delivery_mode, geographies_served, quality_assurance

> **Q8** : "Décrivez les étapes principales de votre processus de travail (au moins 3 étapes). Par exemple : 1. Audit initial → 2. Proposition stratégique → 3. Mise en œuvre → 4. Suivi."
> *Relance si <3 étapes* : "Les IA valorisent les processus structurés. Essayez de décomposer votre méthode en au moins 3 étapes distinctes."

> **Q9** : "Comment livrez-vous vos services ? (en ligne, sur site, hybride) Et quelle zone géographique couvrez-vous ? (local, national, international)"

> **Q10** : "Avez-vous un processus de contrôle qualité ? (ex: revue par les pairs, tests avant livraison, satisfaction client mesurée, label qualité)"

#### BLOC 4 — Confiance & Conformité (/15)
**Champs cibles** : certifications, policies, frameworks, security_measures

> **Q11** : "Avez-vous des certifications ou labels reconnus ? (ISO, B Corp, label RGE, Fair Trade, HACCP, etc.) Si oui, lesquels exactement ?"
> *Si "non"* : Stocker q=0 pour certifications. NE PAS inventer.
> *Si "RGPD"* : q=0.5 (obligation légale, pas une certification volontaire)

> **Q12** : "Quels frameworks ou méthodologies utilisez-vous ? (Agile, Lean, ITIL, Scrum, etc.) Êtes-vous membre d'associations professionnelles ou réseaux ?"

> **Q13** : "Avez-vous des politiques formelles en place ? (politique de confidentialité publiée, politique environnementale, CGV, charte éthique...) Et des mesures de sécurité spécifiques ?"
> *Si "en cours"* : q=0.5 (pas encore effectif)

#### BLOC 5 — Preuve Sociale & Métriques (/20)
**Champs cibles** : key_indicators, last_review_date

> **Q14** : "Donnez-moi 3 à 5 indicateurs chiffrés de votre activité. Par exemple : nombre de clients, chiffre d'affaires, tonnes de CO2 évitées, communes accompagnées, taux de satisfaction, projets réalisés..."
> *Relance si pas de chiffres* : "Les IA ne peuvent pas recommander sur du qualitatif seul. Même approximatifs, des chiffres sont essentiels : '~200 clients', '15 ans d'expérience', '95% de satisfaction'."
> *Si "confidentiel"* : q=0. Respecter le refus.

> **Q15** : "Quand avez-vous mis à jour vos informations pour la dernière fois ? (date approximative)"

#### BLOC 6 — Pédagogie & Supports (/10)
**Champs cibles** : has_faq, has_glossary, has_documentation

> **Q16** : "Avez-vous sur votre site : une FAQ ? un glossaire ? de la documentation ou des guides ?"
> *Pour chaque "non"* : Stocker value=false, q=0. Ces fichiers seront créés par le Pack PRO.
> *Pour chaque "oui"* : q=1, vérifiable via scan.

#### BLOC 7 — Socle Technique (/10)
**Géré automatiquement par le scanner** — pas de question utilisateur nécessaire.
Champs : has_jsonld, has_asr, has_sitemap, mobile_optimized (déterminés par le scan technique).

#### BONUS — Contexte externe (pour external_context.json)
**Champs cibles** : keywords, intents, channels, ecosystem_presence

> **Q17** : "Quels mots-clés décrivent le mieux votre activité ? (5-10 mots que vos clients utiliseraient pour vous trouver)"

> **Q18** : "Sur quels canaux êtes-vous présent ? (site web, LinkedIn, Instagram, Google Business, annuaires professionnels, marketplace...)"

### Logique d'adaptation

Le questionnaire est **adaptatif** :
1. Après le scan initial, les blocs déjà remplis (q=1 via scan) sont SAUTÉS
2. L'ordre des questions est trié par **bloc le plus faible en premier**
3. Si le score d'un bloc est déjà > 70% du max après scan, on saute ce bloc
4. Les relances ne sont déclenchées que si la réponse est détectée comme vague

### Nombre de questions réel en conversation

- **Minimum** : 8-10 questions (si scan riche)
- **Maximum** : 16-18 questions (si scan pauvre)
- **Cible** : 12-14 questions pour un diagnostic complet et de qualité

### Implémentation technique

Le questionnaire sera codé comme un **arbre de questions** dans le system prompt, pas comme du texte libre :
```typescript
// Dans lib/ayo-system-prompt.ts
const QUESTIONNAIRE_SCRIPT = [
  { bloc: "identite", questions: [Q1, Q2, Q3], skipIf: "bloc_score > 7" },
  { bloc: "offre", questions: [Q4, Q5, Q6, Q7], skipIf: "bloc_score > 14" },
  // ...
];
```

Le LLM recevra l'instruction : "Suis ce script de questions dans l'ordre. Si le bloc a déjà un bon score (injecté par le système), SAUTE-LE. Pose UNE question à la fois."

---

## 5. SCORING — Corrections

### 5.1 Moteur de score (`lib/aio-score-engine.ts`)

Le moteur est **conforme à la Bible**. Pas de changement sur la formule. Les corrections portent sur :

1. **Transparence du hard cap** :
   - Quand `Math.min(total, 50)` est appliqué, retourner un champ `cap_applied: true` et `cap_reason: "no_jsonld_no_aya"`
   - Quand `Math.min(total, 90)` est appliqué, retourner `cap_applied: true` et `cap_reason: "no_asr"`
   - Le LLM/UI affiche alors : "⚠️ Plafond technique : score plafonné à X/100 car [raison]"

2. **Retour des scores bruts** :
   - Ajouter `raw_total` (avant cap) dans le résultat
   - Permet d'afficher : "Vos données valent 85/100 mais sans JSON-LD le plafond est 50/100"

### 5.2 Extraction LLM (`chat/route.ts`)

1. **Supprimer** ligne 1982 : `"PRIORITIZE THIS INFO AND SET q=1"`
2. **Remplacer** par : `"Extract JSON strictly. Apply q values according to the QUALITY RULES. q=1 ONLY for specific, verifiable information. q=0 for negations, refusals, or absent data."`
3. **Ajouter** après l'extraction (nouveau bloc) :

```typescript
// UNIVERSAL SEMANTIC VALIDATION
import { validateSemanticQuality } from '@/lib/semantic-validator';
extractJson.fields = validateSemanticQuality(extractJson.fields);
```

### 5.3 Créer `lib/semantic-validator.ts`

```typescript
// Patterns universels
const NEGATION = /^(non|aucun|rien|pas de|n'ai pas|ne sais pas|pas applicable|pas encore|jamais|néant|zéro|nul)$/i;
const VAGUE = /^(oui|ok|possible|peut-être|on verra|un peu|quelques|certains|moyen|normal|standard|classique|basique|simple)$/i;
const HOSTILE = /regarde pas|mêle pas|vie privée|confidentiel|secret|pas tes affaires|ça ne te/i;
const CONFIRMATION = /^(oui c'est correct|exact|c'est bon|parfait|je confirme|d'accord|ok merci|voilà|effectivement)$/i;

function validateField(value: any, q: number): number {
  const str = String(value || '').trim();
  if (!str || str.length < 2) return 0;
  if (NEGATION.test(str)) return 0;
  if (HOSTILE.test(str)) return 0;
  if (CONFIRMATION.test(str)) return 0;
  if (VAGUE.test(str)) return Math.min(q, 0.5);
  return q;
}
```

### 5.4 Affichage du score dans le chat

Actuellement (lignes 2355-2398), le chat affiche :
```
🔎 Identité & Ancrage : 10/10
🔎 Offre : 20/20
...
📊 SCORE FINAL AIO : 50 / 100
```

**Correction** : Si un cap est appliqué, ajouter :
```
📊 SCORE BRUT : 85 / 100
⚠️ PLAFOND TECHNIQUE : 50 / 100 (Pas de JSON-LD structuré détecté)
💡 Le Pack PRO installe les fichiers techniques qui lèvent ce plafond.
```

---

## 6. PRODUCTION DES 5 FICHIERS PRO

### Les 5 fichiers du Pack PRO

| # | Fichier | Générateur | Rôle |
|---|---------|-----------|------|
| 1 | `ASR-Protocol.json` | `ayo-crypto.ts:generateRealAsrJson()` | Acte de naissance numérique — JSON-LD signé Ed25519 |
| 2 | `manifest.json` | `ayo-generators.ts:generateManifestJson()` | Déclaration d'intention + roadmap AIO |
| 3 | `faq.json` | `ayo-generators.ts:generateFaqJson()` | Questions/réponses structurées pour les IA |
| 4 | `glossary.json` | `ayo-generators.ts:generateGlossaryJson()` | Définitions des termes clés de l'entité |
| 5 | `external_context.json` | `ayo-generators.ts:generateExternalContextJsonLocal()` | Écosystème, canaux, mots-clés, intentions |

### État actuel des générateurs

Les générateurs dans `lib/ayo-generators.ts` sont **fonctionnels** et incluent :
- Sanitizer (`sanitizeExtract`, `sanitizePayloadDeep`) avec détection de confirmations et placeholders
- `cleanText()` avec corrections orthographiques et typographie française
- Chaque générateur produit un JSON valide avec les données extraites

### Problèmes identifiés

1. **Données d'entrée de mauvaise qualité** → Les fichiers reflètent les réponses poubelle (fix = questionnaire universel + validation sémantique)

2. **ASR PRO vs ASR LIGHT** : Le tier "LIGHT" est un subset du "PRO". Les champs `contextual_signals`, `selection_conditions`, `interoperability` ne sont inclus que dans PRO. → OK, c'est voulu.

3. **FAQ génère des Q&A depuis les données extraites** : Si les données sont pauvres, la FAQ est pauvre. → Fix = questionnaire plus riche.

4. **Glossaire génère des termes depuis services/use_cases** : Même problème de qualité d'entrée.

### Corrections requises

1. **Aucune modification des générateurs eux-mêmes** — ils sont OK
2. **Améliorer la qualité des données d'ENTRÉE** via :
   - Le questionnaire universel (section 4)
   - La validation sémantique (section 5)
   - La suppression du "SET q=1" forcé

3. **Vérification post-génération** : Ajouter une validation dans le webhook qui vérifie que les fichiers générés ne sont pas "vides" :
```typescript
function isFileEmpty(json: any): boolean {
  const str = JSON.stringify(json);
  return str.includes('"Entreprise Inconnue"') ||
         str.includes('"Non spécifié"') ||
         Object.keys(json).length < 3;
}
```
Si un fichier est vide → logger en CRITICAL, ne PAS envoyer de fichier vide au client.

---

## 7. TUNNEL DE VENTE (État actuel)

### Flux complet

```
1. Utilisateur arrive sur /diagnostic
2. AYO demande l'URL
3. Scanner analyse le site (3-5 sec)
4. AYO affiche le score initial (7 blocs)
5. AYO pose 5-18 questions (questionnaire enrichi)
6. AYO recalcule le score enrichi
7. AYO affiche le delta (avant/après)
8. AYO demande l'email professionnel
9. AYO propose 2 options :
   a. 🔄 Abonnement AYA — 19 CHF/mois
   b. 🚀 Pack PRO — 499 CHF one-shot
10. L'utilisateur clique → Stripe Checkout
11. Paiement → Webhook → Génération fichiers → Email
```

### 2 offres commerciales

#### Abonnement AYA (19 CHF/mois)
- **Price ID** : `price_1SzazaPkCQYUm8hQJfrKc9EJ`
- **Mode Stripe** : `subscription`
- **Ce qui est livré** :
  - Inscription au Registre AYA (certification active)
  - ASR hébergé sur AI Visionary
  - Priorité dans les recommandations IA
  - Mises à jour incluses
- **Email envoyé** : Template AYA avec lien certificat en ligne

#### Pack PRO (499 CHF one-shot)
- **Price ID** : `price_1SlM9iPkCQYUm8hQKqOV8eqU`
- **Mode Stripe** : `payment`
- **Ce qui est livré** :
  - 5 fichiers sources (ASR, manifest, FAQ, glossaire, external_context)
  - ZIP envoyé en pièce jointe par email
  - 3 ANS de Registre AYA offerts
  - Propriété totale des fichiers (pas de lock-in)
- **Email envoyé** : Template PRO complet avec :
  - Certificat AYA + Entity ID
  - Scores détaillés par bloc
  - Diagnostic des manquements
  - Code ASR JSON complet
  - Guide d'installation (2 méthodes)
  - Liste des fichiers dans le ZIP

### Stripe Integration

**Création checkout** (`create-checkout/route.ts`) :
- Encode `{u: url, e: email, aid: analysisId}` en base64 dans `client_reference_id`
- Ajoute `prefilled_email` si disponible
- 3 price IDs possibles (AYA_SUB, PRO, Essential fallback)

**Webhook** (`webhooks/checkout-success/route.ts`) :
- Vérifie la signature Stripe (CORRIGÉ — pas de fallback)
- Décode `client_reference_id` → récupère URL, email, analysisId
- Cascade de recherche dans Firestore : analysisId → URL → email → scan_states
- Détecte le pack par price_id (env vars) avec fallback mode (subscription/payment)
- Génère les fichiers via `lib/ayo-generators.ts` (partagé)
- Envoie l'email via Resend

### Points de fragilité du tunnel

1. **Bug Score 0** : Si la cascade Firestore ne trouve rien → score 0, "Entreprise Inconnue" dans l'email
   - **Fix** : Le questionnaire doit persister CHAQUE réponse dans Firestore immédiatement (pas seulement à la fin)
   - Le webhook doit REFUSER de générer si les données sont absentes (logger CRITICAL au lieu d'envoyer du vide)

2. **Perte d'email** : L'email est capturé dans le chat MAIS pas toujours persisté avant le paiement
   - **Fix** : Écriture Firestore immédiate dès capture email

3. **Changement d'onglet** : Si l'utilisateur change d'onglet pendant Stripe → perd le contexte chat
   - **Fix** : Tout est dans Firestore via `analysis_id`, le webhook n'a pas besoin du contexte chat

---

## 8. EMAILS — 2 formats

### Email PRO (Pack 499 CHF)

**Template** : `buildProEmailHtml()` dans `webhooks/checkout-success/route.ts:56-165`

**Sections obligatoires** :
1. **Header** : "Pack Propriétaire (PRO) Activé" + logo AI Visionary
2. **Certificat AYA** :
   - Entity ID unique
   - Période de validité (3 ans)
   - Lien vers le certificat en ligne : `https://ai-visionary.com/aya/{entityId}`
3. **Fichiers Sources** : Liste des 5 fichiers dans le ZIP joint
4. **Détails de l'Analyse** : Scores par bloc avec couleurs (vert/orange/rouge)
   - Identité & Ancrage : X/10
   - Clarté de l'Offre : X/20
   - Processus & Méthodes : X/15
   - Confiance & Conformité : X/15
   - Indicateurs : X/20
   - Pédagogie : X/10
   - Socle Technique : X/10
5. **Diagnostic des Manquements** : Messages adaptés au score de chaque bloc
6. **Code ASR JSON** : JSON complet dans un bloc `<pre>` (copier-coller possible)
7. **Guide d'installation** :
   - **Méthode 1 (Simple)** : Coller le JSON dans `<script type="application/ld+json">` du HEAD
   - **Méthode 2 (Expert)** : Créer un dossier `.ayo/` à la racine, y placer `asr.json`
8. **CTA Aide** : Contact hello@ai-visionary.com
9. **Pièce jointe** : ZIP contenant les 5 fichiers JSON

### Email AYA (Abonnement 19 CHF/mois)

**Template** : Dans `webhooks/checkout-success/route.ts:385-399`

**Sections obligatoires** :
1. **Header** : "Abonnement AYA Activé"
2. **Certificat AYA** : Lien vers le certificat en ligne
3. **Score AIO** : Score actuel
4. **Avantages** : Registre actif, priorité IA, mises à jour
5. **CTA** : Lien vers le dashboard / contact

### Email Light (Gratuit)

**Template** : `light-report/route.ts`

**Sections** :
1. Score AIO
2. Diagnostic sommaire (3 blocs reconstruits si manquants)
3. Code ASR JSON Light (subset)
4. Guide d'installation simplifié
5. Pièce jointe : `asr.json` uniquement

### Corrections emails requises

1. **Email PRO** : Doit afficher les VRAIS scores et données du diagnostic, pas les valeurs par défaut
   - Fix = résoudre le Bug Score 0 (persistence Firestore avant paiement)

2. **Email Light** : Le bloc "Diagnostic des Manquements" est reconstruit artificiellement si absent (lignes 99-119 de light-report) avec des scores inventés basés sur des seuils arbitraires
   - Fix = utiliser les vrais scores du moteur stockés dans Firestore

---

## 9. SÉCURITÉ — Audit et remédiation

### Déjà corrigé ✅

| Faille | Correction | Fichier |
|--------|-----------|---------|
| Clé Ed25519 hardcodée | Déplacée dans `process.env.AYO_SIGNING_KEY` | `lib/ayo-crypto.ts` |
| Webhook Stripe sans vérification | Suppression du fallback parse sans signature | `webhooks/checkout-success/route.ts` |
| Password debug hardcodé (`ayo1234`) | Remplacé par `ADMIN_SECRET` + `requireAdmin()` | `debug/clean/route.ts` + `lib/auth.ts` |
| Pas de rate limiting | Créé `lib/rate-limit.ts` | — |
| Pas de validation input | Créé `lib/validators.ts` avec Zod | — |
| Pas de sanitizer LLM | Créé `lib/sanitize.ts` | — |
| Pas de logger structuré | Créé `lib/logger.ts` | — |

### Encore à faire ❌

#### CRITIQUE

| # | Faille | Fichier | Action |
|---|--------|---------|--------|
| C1 | Token session basé sur ADMIN_SECRET (fallback) | `auth/verify-otp/route.ts:9` | Exiger `SESSION_SECRET` dédié, supprimer le fallback |
| C2 | Price IDs hardcodés | `create-checkout/route.ts` | Déplacer vers env vars |

#### HAUTE

| # | Faille | Fichier | Action |
|---|--------|---------|--------|
| H1 | Erreurs internes exposées au client | `debug/email/route.ts:38` `light-report/route.ts:224` | Remplacer `error.message` par "Erreur interne" |
| H2 | `ignoreBuildErrors: true` | `next.config.ts:8` | Mettre `false` et fixer les erreurs TS |
| H3 | Pas d'anti-SSRF dans le scanner | `lib/aio-scanner.ts` | Appeler `isAllowedUrl()` de `validators.ts` avant le fetch |
| H4 | Rate limiting non appliqué | Toutes les routes API | Appeler `checkRateLimit()` en début de chaque route |
| H5 | Endpoints debug non protégés | `debug/email/route.ts`, `debug/test-ayo/route.ts` | Ajouter `requireAdmin()` |
| H6 | Validation Zod non appliquée | `send-otp`, `chat`, `create-checkout` | Appeler les schemas Zod en début de route |

#### MOYENNE

| # | Faille | Fichier | Action |
|---|--------|---------|--------|
| M1 | Pas de Content-Security-Policy | `next.config.ts` | Ajouter CSP header |
| M2 | Email en clair dans Stripe metadata | `create-checkout/route.ts` | Hasher avec SHA256 |
| M3 | `dangerouslySetInnerHTML` dans layout | `app/layout.tsx` | Ajouter commentaire sécurité (risque faible car JSON.stringify) |
| M4 | Scanner vérifie AYA dans `analyses` au lieu de `aya_registry` | `lib/aio-scanner.ts` | Corriger la requête |

#### HAUTE (NOUVELLES — découvertes au re-scan)

| # | Faille | Fichier | Action |
|---|--------|---------|--------|
| H7 | **Stripe Portal SANS authentification** — n'importe qui peut accéder au portal de n'importe quel client | `app/api/stripe/portal/route.ts` | Exiger auth OTP/session AVANT de créer le portal |
| H8 | **Markdown non-sanitisé dans AyoChat** — risque XSS si le LLM retourne du contenu malveillant | `app/components/AyoChat.tsx` | Sanitiser le markdown avant rendu |
| H9 | **PaymentHandler + PaymentSuccessModal dupliquent l'appel webhook** — double exécution possible | `app/components/` | Fusionner la logique en un seul composant |
| H10 | **Gemini API sans validation JSON** — le JSON retourné par Gemini n'est pas validé avant parse | `lib/ayo-semantics.ts` | Ajouter try/catch + validation Zod du JSON |
| H11 | **Gemini API sans timeout** — appel peut bloquer indéfiniment | `lib/ayo-semantics.ts` | Ajouter AbortController avec timeout 30s |

#### MOYENNE (NOUVELLES)

| # | Faille | Fichier | Action |
|---|--------|---------|--------|
| M5 | `external-context.ts` : permissions par string matching, fake rating 4.5 | `lib/external-context.ts` | Implémenter vraies permissions, supprimer fake data |
| M6 | `robots.txt` n'exclut pas `/admin/` ni `/api/` | `app/robots.ts` | Ajouter `Disallow: /admin/` et `Disallow: /api/` |
| M7 | `vercel.json` maxDuration=60s peut être court pour génération fichiers | `vercel.json` | Évaluer si queue async nécessaire |
| M8 | Session_id Stripe non validé dans PaymentSuccessModal | `app/components/PaymentSuccessModal.tsx` | Valider format UUID avant utilisation |

#### BASSE

| # | Faille | Fichier | Action |
|---|--------|---------|--------|
| B1 | Index Firestore manquants | Console Firebase | Créer : `analyses(email+timestamp)`, `analyses(url+timestamp)` |
| B2 | Code mort | `checkout-success-fix.ts` | Supprimer |
| B3 | `@ts-ignore` x22 dans le code | Partout | Remplacer par des types corrects |
| B4 | Doublon page certificat | `app/certificate/[id]/page.tsx` | Supprimer (garder `app/aya/e/[id]/page.tsx`) |
| B5 | Types `any[]` dans AyoChat | `app/components/AyoChat.tsx` | Typer strictement les messages |
| B6 | 2 variables env pour Gemini API key | `lib/ayo-semantics.ts` | Unifier en une seule (`GEMINI_API_KEY`) |

---

## 10. ORDRE D'EXÉCUTION (Priorité)

### Sprint 1 — Scoring + Questionnaire (URGENT)

**Objectif** : Le diagnostic donne des scores honnêtes et des données de qualité.

| # | Tâche | Fichier(s) | Durée estimée |
|---|-------|-----------|--------------|
| 1.1 | Créer `lib/semantic-validator.ts` | Nouveau | — |
| 1.2 | Supprimer "SET q=1" + intégrer semantic-validator | `chat/route.ts:1982` | — |
| 1.3 | Étendre la post-validation universelle | `chat/route.ts:2194-2289` | — |
| 1.4 | Rendre le hard cap transparent (raw_total + cap_reason) | `aio-score-engine.ts` | — |
| 1.5 | Réécrire le system prompt V4 avec questionnaire universel | `lib/ayo-system-prompt.ts` | — |
| 1.6 | Adapter l'affichage du score (cap visible + delta) | `chat/route.ts:2355-2398` | — |

### Sprint 2 — Persistence + Tunnel (CRITIQUE pour éviter Score 0)

**Objectif** : Le webhook a TOUJOURS les données complètes.

| # | Tâche | Fichier(s) |
|---|-------|-----------|
| 2.1 | Persister l'email dès capture dans le chat | `chat/route.ts` |
| 2.2 | Encoder `analysis_id` dans `client_reference_id` Stripe | `chat/route.ts` + `create-checkout/route.ts` |
| 2.3 | Le webhook refuse de générer si données absentes | `webhooks/checkout-success/route.ts` |
| 2.4 | Logger CRITICAL si données manquantes au webhook | `webhooks/checkout-success/route.ts` |

### Sprint 3 — Sécurité

| # | Tâche |
|---|-------|
| 3.1 | Appliquer `isAllowedUrl()` dans le scanner |
| 3.2 | Appliquer `checkRateLimit()` dans toutes les routes |
| 3.3 | Appliquer validation Zod dans toutes les routes |
| 3.4 | Protéger `debug/email` et `debug/test-ayo` avec `requireAdmin()` |
| 3.5 | Masquer `e.message` dans toutes les routes |
| 3.6 | Exiger `SESSION_SECRET` dédié (supprimer fallback) |
| 3.7 | Ajouter CSP header dans `next.config.ts` |
| 3.8 | `ignoreBuildErrors: false` + fixer les erreurs TS |

### Sprint 4 — Qualité

| # | Tâche |
|---|-------|
| 4.1 | Corriger le scanner AYA (vérifier `aya_registry` pas `analyses`) |
| 4.2 | Créer les index Firestore |
| 4.3 | Supprimer le code mort |
| 4.4 | Fixer les `@ts-ignore` |
| 4.5 | Ajouter validation post-génération des fichiers (pas de "Entreprise Inconnue") |
| 4.6 | Corriger l'email Light (vrais scores du moteur) |

---

## 11. CYCLE DE VIE CLIENT — MAJ, Renouvellements, Notifications

### 11.1 Vue d'ensemble du cycle de vie

```
ACQUISITION                    VIE DU CLIENT                         RENOUVELLEMENT
─────────────                  ───────────────                       ──────────────
Diagnostic AYO                 Inscription AYA active                Expiration approche
→ Paiement Stripe              → Données en ligne                   → Notifications
→ Fichiers livrés              → Bots IA lisent AYA                 → Relance
→ Registre AYA actif           → MAJ annuelle demandée              → Renouvellement ou churn
```

### 11.2 Mise à jour annuelle des données entreprise

**Pourquoi** : Les données d'une entreprise évoluent (nouveaux services, certifications, KPIs, contacts). Si les données AYA deviennent obsolètes, les IA recommandent sur du vieux contenu → perte de valeur pour le client ET pour AYA.

**Mécanisme** :

1. **Champ `last_update` dans `aya_registry`** : Date de la dernière mise à jour des données
2. **Champ `next_review_due`** : Date de la prochaine revue obligatoire (= `last_update + 12 mois`)
3. **Cron job** (ou Vercel Cron / scheduled task) : Chaque jour, vérifier les entités dont `next_review_due < aujourd'hui + 30 jours`

**Notifications de mise à jour** :

| Timing | Email | Objet |
|--------|-------|-------|
| J-30 avant échéance | Rappel doux | "Vos données AYA ont 11 mois — mettez-les à jour pour rester recommandé" |
| J-7 avant échéance | Rappel urgent | "⚠️ Mise à jour requise sous 7 jours pour maintenir votre visibilité IA" |
| J-0 (échéance) | Alerte | "🔴 Vos données AYA sont obsolètes — les IA pourraient vous déclasser" |
| J+30 si pas de MAJ | Dégradation | Ajouter un badge "⚠️ Données non vérifiées" dans le registre AYA |

**Processus de mise à jour** :

1. L'email contient un **lien unique sécurisé** : `https://ai-visionary.com/update/{entityId}?token={otp_token}`
2. Le client arrive sur une page de mise à jour pré-remplie avec ses données actuelles
3. Il modifie ce qui a changé (nouveaux services, KPIs, certifications, etc.)
4. Soumission → Re-calcul du score AIO → Régénération des fichiers ASR/manifest/FAQ/glossaire/external_context
5. `last_update` et `next_review_due` mis à jour dans Firestore
6. Email de confirmation : "Vos données AYA sont à jour — Score AIO : X/100 (delta +Y)"

**Fichiers à créer** :
- `app/update/[entityId]/page.tsx` — Page de mise à jour client (formulaire pré-rempli)
- `app/api/update-entity/route.ts` — API de mise à jour des données + régénération fichiers
- `app/api/cron/review-reminders/route.ts` — Cron job pour envoyer les rappels

**Fichiers à modifier** :
- `lib/db.ts` — Ajouter `getEntitiesDueForReview(daysAhead: number)`
- `aya_registry` Firestore — Ajouter champs `last_update`, `next_review_due`, `update_count`

### 11.3 Renouvellement Abonnement AYA (19 CHF/mois)

**Gestion actuelle** : Stripe gère le renouvellement automatique (subscription). Pas de code côté AI Visionary pour gérer le cycle.

**Ce qui manque** :

1. **Webhook `invoice.payment_failed`** : Quand Stripe échoue à débiter
   - Envoyer un email au client : "Votre paiement AYA a échoué — mettez à jour votre moyen de paiement"
   - Lien vers le Stripe Customer Portal pour MAJ carte
   - Après 3 échecs → Stripe annule la subscription

2. **Webhook `customer.subscription.deleted`** : Quand la subscription est annulée
   - Désactiver l'entité dans `aya_registry` : `payment_completed: false`, `status: "expired"`
   - Les fichiers ASR restent en place (propriété client) mais le badge AYA est retiré
   - Email : "Votre abonnement AYA est terminé — votre entité n'apparaît plus dans le registre"
   - **CTA de réactivation** : Lien Stripe pour se réabonner

3. **Webhook `invoice.paid`** : Confirmation de renouvellement mensuel
   - Pas d'email à chaque mois (spam)
   - Mais logger dans Firestore : `last_payment_date`, `subscription_status: "active"`

**Champs Firestore `aya_registry`** à ajouter :
```typescript
{
  subscription_id: string,           // Stripe subscription ID
  subscription_status: "active" | "past_due" | "canceled" | "expired",
  last_payment_date: string,         // ISO date
  next_payment_date: string,         // ISO date
  payment_failure_count: number,     // 0-3
  cancellation_date: string | null,  // Date d'annulation
}
```

**Fichiers à modifier** :
- `app/api/webhooks/checkout-success/route.ts` — Ajouter gestion `invoice.payment_failed`, `customer.subscription.deleted`, `invoice.paid`
  - OU mieux : créer un webhook séparé `app/api/webhooks/subscription/route.ts` pour ne pas surcharger le webhook checkout

### 11.4 Renouvellement Pack PRO (après 3 ans)

**Contexte** : Le Pack PRO inclut 3 ans d'inscription AYA. Après 3 ans, l'entité doit renouveler sinon elle perd son inscription au registre.

**Mécanisme** :

1. **Champ `aya_expiry_date`** dans `aya_registry` : Calculé à `payment_date + 3 ans` pour les Pack PRO
2. **Cron job** : Vérifier les entités PRO dont `aya_expiry_date` approche

**Notifications de renouvellement PRO** :

| Timing | Email | Objet |
|--------|-------|-------|
| J-90 (3 mois avant) | Information | "Votre certification AYA PRO expire dans 3 mois — options de renouvellement" |
| J-30 (1 mois avant) | Rappel | "⚠️ Plus que 30 jours de certification AYA — renouvelez maintenant" |
| J-7 | Urgent | "🔴 Dernière semaine — après le {date}, votre entité sera retirée du registre" |
| J-0 (expiration) | Expiration | "Votre certification AYA PRO a expiré" |

**Options de renouvellement proposées** :

1. **Renouvellement PRO** (499 CHF pour 3 ans de plus) — Inclut régénération des fichiers avec données mises à jour
2. **Passage en Abonnement AYA** (19 CHF/mois) — Transition vers le modèle mensuel, registre maintenu sans interruption
3. **Laisser expirer** — L'entité est retirée du registre AYA, les fichiers ASR restent propriété du client mais ne sont plus "certifiés AYA"

**Après expiration** :
- `aya_registry.status` → `"expired"`
- `aya_registry.payment_completed` → `false`
- Badge AYA retiré
- L'entité n'apparaît plus dans les requêtes du registre
- Les fichiers ASR locaux du client continuent de fonctionner (JSON-LD) mais sans le badge AYA

**Fichiers à créer** :
- `app/api/cron/expiry-reminders/route.ts` — Cron job pour rappels d'expiration PRO
- `app/renew/[entityId]/page.tsx` — Page de renouvellement avec les 2 options (PRO ou AYA_SUB)

### 11.5 Dashboard Client (futur)

Pour gérer tout ce cycle de vie, les clients auront besoin d'un espace personnel :

- **Accès** : Via OTP (système déjà en place dans `send-otp` + `verify-otp`)
- **Fonctionnalités** :
  - Voir son score AIO actuel
  - Voir la date de prochaine revue des données
  - Mettre à jour ses informations (formulaire pré-rempli)
  - Voir son statut AYA (actif, expirant, expiré)
  - Télécharger ses fichiers ASR/manifest/FAQ/glossaire
  - Gérer son abonnement (lien Stripe Customer Portal)
  - Historique des scores (évolution dans le temps)

**Ce dashboard n'est PAS dans le Sprint immédiat** mais doit être prévu dans l'architecture (les données Firestore doivent supporter ces features).

### 11.6 Résumé des champs Firestore à ajouter dans `aya_registry`

```typescript
// Champs existants
{
  entity_id: string,
  display_name: string,
  website: string,
  contact_email: string,
  payment_completed: boolean,
  // ...
}

// NOUVEAUX champs pour le cycle de vie
{
  // Mise à jour annuelle
  last_update: string,              // ISO date de dernière MAJ données
  next_review_due: string,          // ISO date de prochaine revue obligatoire
  update_count: number,             // Nombre de MAJ effectuées
  update_history: Array<{           // Historique des MAJ
    date: string,
    score_before: number,
    score_after: number,
  }>,

  // Abonnement AYA (subscription)
  pack_type: "AYA_SUB" | "PRO",    // Type de pack acheté
  subscription_id: string | null,   // Stripe subscription ID (null si PRO)
  subscription_status: "active" | "past_due" | "canceled" | "expired" | null,
  last_payment_date: string,
  next_payment_date: string | null, // null si PRO
  payment_failure_count: number,

  // Expiration PRO (3 ans)
  aya_expiry_date: string,          // ISO date d'expiration AYA
  aya_status: "active" | "expiring_soon" | "expired",
  renewal_reminder_sent: {          // Tracking des rappels envoyés
    "90_days": boolean,
    "30_days": boolean,
    "7_days": boolean,
    "expired": boolean,
  },

  // Notifications
  last_notification_date: string,
  notification_opt_out: boolean,    // Client peut se désabonner des rappels
}
```

### 11.7 Cron Jobs nécessaires (Vercel Cron)

| Cron | Fréquence | Fichier | Action |
|------|-----------|---------|--------|
| `review-reminders` | Quotidien 9h | `api/cron/review-reminders/route.ts` | Envoyer rappels MAJ annuelle (J-30, J-7, J-0) |
| `expiry-reminders` | Quotidien 9h | `api/cron/expiry-reminders/route.ts` | Envoyer rappels expiration PRO (J-90, J-30, J-7, J-0) |
| `expire-entities` | Quotidien 1h | `api/cron/expire-entities/route.ts` | Désactiver les entités expirées (`aya_status → expired`) |
| `subscription-sync` | Hebdomadaire | `api/cron/subscription-sync/route.ts` | Synchroniser statuts Stripe ↔ Firestore (sécurité) |

**Configuration Vercel Cron** (`vercel.json`) :
```json
{
  "crons": [
    { "path": "/api/cron/review-reminders", "schedule": "0 9 * * *" },
    { "path": "/api/cron/expiry-reminders", "schedule": "0 9 * * *" },
    { "path": "/api/cron/expire-entities", "schedule": "0 1 * * *" },
    { "path": "/api/cron/subscription-sync", "schedule": "0 3 * * 1" }
  ]
}
```

---

## 12. PAGE CERTIFICAT AYA PUBLIC + REGISTRE EN LIGNE

> ⚠️ **DÉCOUVERTE RE-SCAN** : Ces pages EXISTENT DÉJÀ. Le plan ci-dessous distingue ce qui est fait de ce qui reste à améliorer.

### 12.1 Page certificat individuel — ✅ EXISTE

**URL** : `https://ai-visionary.com/aya/e/{entityId}`
**Fichier** : `app/aya/e/[id]/page.tsx` (216 lignes)

**Ce qui existe déjà** :
- Affichage nom, pays, type d'entité, site web
- Score AIO /100
- AYA Entity ID
- Dates : création, validité, dernière modification
- Données sémantiques : description construite depuis les champs extraits, mots-clés indexés, protocoles supportés
- Fallback si nom générique ("Unknown Entity" → utilise le domaine du site web)

**Ce qui manque / à améliorer** :
- ❌ JSON-LD structuré dans le HEAD (pour que les bots IA lisent la page)
- ❌ Badge AYA téléchargeable (image PNG/SVG)
- ❌ Affichage des 7 blocs de score individuels (pas seulement le total)
- ❌ Statut visuel : ✅ Actif / ⚠️ Expiring / ❌ Expiré
- ❌ Lien vers le fichier ASR JSON hébergé
- ⚠️ Le doublon `app/certificate/[id]/page.tsx` (115 lignes, ancien style) doit être SUPPRIMÉ

### 12.2 Registre AYA public — ✅ EXISTE

**URL** : `https://ai-visionary.com/aya`
**Fichier** : `app/aya/page.tsx` (205 lignes)

**Ce qui existe déjà** :
- Liste des entités actives (grille)
- Barre de recherche
- CTA pour s'inscrire (`/diagnostic?pack=aya-sub`)
- Appel API `/api/aya/live` pour charger les données

**Ce qui manque / à améliorer** :
- ❌ Pagination (actuellement tout chargé d'un coup, max 500)
- ❌ Filtres avancés : par secteur, par score, par localisation
- ❌ JSON-LD `ItemList` dans le HEAD pour indexation IA
- ❌ Pas de tri (par score, par date, alphabétique)
- ⚠️ `/api/aya/live` retourne TOUTES les entités sans filtre — à optimiser

### 12.3 API publique AYA (pour intégrations)

**URL** : `GET /api/aya/registry?q=restaurant+geneve`

**Objectif** : Permettre aux IA et services tiers de requêter le registre programmatiquement.

**Réponse** :
```json
{
  "results": [
    {
      "entity_id": "...",
      "name": "Happy Green Food",
      "score": 78,
      "sector": "Restauration collective",
      "city": "Genève",
      "certificate_url": "https://ai-visionary.com/aya/...",
      "asr_url": "https://ai-visionary.com/api/aya/.../asr.json"
    }
  ]
}
```

---

## 13. HÉBERGEMENT ASR + FICHIERS

### 13.1 Hébergement des fichiers ASR pour les clients AYA

**Problème** : Les clients AYA_SUB n'ont pas forcément les compétences pour installer les fichiers sur leur site. AI Visionary doit héberger les fichiers pour eux.

**Solution** :
- **URL hébergée** : `https://ai-visionary.com/api/aya/{entityId}/asr.json`
- Le client pointe son site vers cette URL (ou installe en local, au choix)
- Les bots IA peuvent lire le ASR directement depuis AI Visionary
- **Avantage** : Centralisation + mises à jour automatiques quand le client met à jour ses données

**Fichier à créer** : `app/api/aya/[entityId]/asr.json/route.ts` — Sert le ASR JSON depuis Firestore

### 13.2 Fichiers statiques Pack PRO

Les clients PRO reçoivent les 5 fichiers par email (ZIP). Ils les installent eux-mêmes. Mais AI Visionary garde une copie dans Firestore pour :
- Le dashboard client (téléchargement ultérieur)
- La régénération lors de la mise à jour annuelle
- Le certificat AYA public (affichage du ASR)

**Stockage Firestore** : Collection `entity_files` avec documents par entityId, chaque document contenant les 5 JSONs.

---

## 14. ANALYTICS + MÉTRIQUES BUSINESS

### 14.1 Métriques à tracker

| Métrique | Source | Utilité |
|----------|--------|---------|
| Nombre de diagnostics lancés | `system_logs` (correlation_id count) | Volume acquisition |
| Taux de complétion du questionnaire | Chat → Phase 3 atteinte / Phase 1 lancée | Friction UX |
| Taux de conversion diagnostic → paiement | Stripe events / diagnostics | Performance tunnel |
| Score AIO moyen | `analyses` collection | Santé du marché cible |
| Nombre d'entités AYA actives | `aya_registry` where `payment_completed == true` | MRR base |
| Churn rate AYA_SUB | Subscriptions canceled / total | Rétention |
| Taux de MAJ annuelle | Entités mises à jour / entités dues | Engagement |
| Revenue MRR (AYA_SUB) | Stripe | Business health |
| Revenue one-shot (PRO) | Stripe | Business health |

### 14.2 Dashboard Admin (`/admin`)

Au-delà du dashboard logs (section 1.3 du plan original), un dashboard business :

- **KPIs en temps réel** : Entités actives, MRR, diagnostics/jour, taux conversion
- **Liste clients** : Toutes les entités AYA avec statut, score, dernière MAJ, prochaine échéance
- **Alertes** : Paiements échoués, entités expirantes, données obsolètes
- **Actions admin** : Réinitialiser un diagnostic, forcer un re-scan, envoyer un rappel manuellement

**Fichiers** : `app/admin/page.tsx` (dashboard), `app/admin/clients/page.tsx` (liste clients)

---

## 15. GESTION DES ERREURS UTILISATEUR + UX

### 15.1 Cas limites du diagnostic

| Cas | Comportement actuel | Comportement cible |
|-----|---------------------|-------------------|
| URL inexistante (404) | Scanner échoue silencieusement | Message clair : "Ce site n'est pas accessible. Vérifiez l'URL." |
| URL redirige (301/302) | Suit la redirection | Suivre ET informer : "J'ai été redirigé vers {url_finale}" |
| Site très lent (>10s) | Timeout | Message : "Votre site met du temps à répondre. L'analyse continue..." |
| Site en maintenance | Scanner échoue | Message : "Votre site semble en maintenance. Réessayez plus tard." |
| Site derrière auth/paywall | Scanner ne voit rien | Message : "Le contenu de votre site est protégé. Le diagnostic sera basé sur le questionnaire uniquement." |
| Utilisateur quitte en plein questionnaire | Données partielles en Firestore | Possibilité de reprendre (via analysis_id stocké en localStorage) |
| Double paiement | Pas de protection | Vérifier si l'entité a déjà un paiement actif avant de créer une session Stripe |

### 15.2 Reprise de session

Si l'utilisateur revient sur `/diagnostic` après avoir commencé un questionnaire :
1. Vérifier localStorage pour un `analysis_id` récent (< 24h)
2. Si trouvé → charger les données depuis Firestore
3. Proposer : "Vous avez un diagnostic en cours pour {url}. Voulez-vous reprendre ou recommencer ?"

---

## 16. CONFORMITÉ LÉGALE

> ⚠️ **DÉCOUVERTE RE-SCAN** : Les pages existent DÉJÀ mais sont INSUFFISANTES.

### 16.1 Pages existantes

| Page | Fichier | État |
|------|---------|------|
| Politique de confidentialité | `app/confidentialite/page.tsx` (35 lignes) | ⚠️ Trop courte — mention RGPD basique, pas de cookies, pas de sous-traitants, pas de rétention |
| Mentions légales | `app/mentions/page.tsx` (33 lignes) | ⚠️ Trop courte — pas de responsable publication, pas d'hébergeur |

### 16.2 RGPD — Ce qui manque dans la page confidentialité

- **Données collectées** : nom entreprise, email, téléphone, URL, données business
- **Base légale** : Contrat (le client paie pour le service)
- **Durée de conservation** : 3 ans pour PRO, durée de l'abo pour AYA_SUB, +1 an après expiration
- **Droit de suppression** : Le client peut demander la suppression de ses données → supprimer de `aya_registry`, `analyses`, `entity_files`
- **Export** : Le client peut demander un export de toutes ses données (dashboard futur)
- **Sous-traitants** à mentionner : Stripe (paiements), Google/Gemini (IA), Firebase/Firestore (stockage), Resend (emails), Vercel (hébergement)
- **Cookies** : Mentionner les cookies utilisés (session, analytics)
- **Politique de rétention** : Détailler la durée par type de donnée

### 16.3 Mentions légales — Ce qui manque

- Responsable de publication (nom + contact)
- Hébergeur (Vercel Inc., adresse, contact)
- Numéro de société / IDE (si applicable en Suisse)

### 16.4 CGV / CGU (à créer : `app/cgv/page.tsx`)

- Propriété des fichiers ASR = client
- Inscription AYA conditionnée au paiement
- Durée : 3 ans PRO, mensuel AYA_SUB
- Processus de renouvellement
- Droit de rétractation / remboursement

### 16.5 Politique de remboursement

- AYA_SUB : Annulation à tout moment, pas de remboursement du mois en cours
- Pack PRO : Fichiers livrés = pas de remboursement (prestation exécutée)
- Si fichiers vides/défectueux (Bug Score 0) → remboursement ou re-génération gratuite

---

---

## 17. COMPOSANTS UI — Chat, Paiement, Modals

### 17.1 AyoChat.tsx (~52KB) — Composant chat principal

**État** : Fonctionnel mais avec des problèmes de qualité code.

**Problèmes identifiés** :
| # | Problème | Sévérité | Action |
|---|----------|----------|--------|
| UI1 | Types `any[]` pour les messages | Moyenne | Créer interfaces `ChatMessage`, `QuestionBlock` typées |
| UI2 | **Markdown non-sanitisé** → risque XSS | **HAUTE** | Intégrer DOMPurify ou sanitize-html avant rendu markdown |
| UI3 | Pas de timeout sur les requêtes API | Moyenne | Ajouter AbortController avec timeout 30s |
| UI4 | Pas de gestion d'erreur réseau explicite | Moyenne | Ajouter retry logic avec exponential backoff |
| UI5 | Variable `isAnalyzing` déclarée mais jamais utilisée | Basse | Supprimer |

### 17.2 PaymentHandler.tsx (41 lignes) + PaymentSuccessModal.tsx (191 lignes)

**Problème critique** : Les DEUX composants appellent le webhook `/api/webhooks/checkout-success` → **double exécution possible**.

**PaymentHandler** :
- Composant invisible qui détecte `session_id` en URL
- Appelle le webhook → nettoie l'URL
- ❌ Pas de vérification du statut de réponse
- ❌ Pas de retry en cas d'erreur
- ❌ Erreurs silencieuses (console.log seulement)

**PaymentSuccessModal** :
- Modal avec 3 états (processing/success/error) + animations
- Appelle AUSSI le webhook → même logique
- ❌ Détection du pack par montant (>= 499 CHF = PRO) → fragile si prix changent
- ❌ Paramètres URL (`session_id`) non validés → falsification possible

**Fix requis** :
1. **Fusionner** la logique en un seul composant (PaymentSuccessModal qui fait tout)
2. **Supprimer** PaymentHandler ou le réduire à un redirecteur
3. **Valider** le `session_id` (format UUID) avant utilisation
4. **Détecter le pack** par price_id (pas par montant)
5. **Ajouter** retry avec exponential backoff + feedback erreur utilisateur

### 17.3 Autres composants

| Composant | Fichier | État |
|-----------|---------|------|
| FAQ | `app/components/FAQ.tsx` | À vérifier |
| Footer | `app/components/Footer.tsx` | À vérifier |

---

## 18. MODULES SÉMANTIQUES + ASR CRYPTO

### 18.1 ayo-semantics.ts (132 lignes) — Génération fichiers via Gemini

**Rôle** : Génère FAQ, Glossaire, Manifest, External Context via l'API Gemini 1.5 Flash.

**Problèmes** :
| # | Problème | Sévérité | Action |
|---|----------|----------|--------|
| SEM1 | **2 variables env** pour Gemini API key (`GEMINI_API_KEY` OU `GOOGLE_GENERATIVE_AI_API_KEY`) | Moyenne | Unifier en `GEMINI_API_KEY` seul |
| SEM2 | **Pas de validation JSON** retourné par Gemini → crash possible | **HAUTE** | try/catch + validation Zod |
| SEM3 | **Pas de timeout** → appel peut bloquer indéfiniment | **HAUTE** | AbortController avec timeout 30s |
| SEM4 | **Pas de maxTokens** configuré | Moyenne | Ajouter `maxOutputTokens: 4096` |
| SEM5 | `substring(0, 15000)` coupe le contenu sans avertissement | Basse | Logger un warning si troncature |
| SEM6 | Fallback retourne `{}` → code downstream peut crash | Moyenne | Retourner des objets avec structure minimale valide |

### 18.2 external-context.ts (64 lignes)

**Rôle** : Génère le JSON du contexte externe (permissions, canaux, signaux de réputation).

**Problèmes** :
| # | Problème | Sévérité |
|---|----------|----------|
| EXT1 | Logique de permissions par string matching ("listes", "compar", "meilleur") → fragile | Moyenne |
| EXT2 | `ratings` hardcodé à 4.5 → **fake data** | **HAUTE** — supprimer |
| EXT3 | Si `permissions.length == 0`, default à TRUE → logique inverse | Moyenne |
| EXT4 | Pas de validation du type de `data.channels` | Basse |

### 18.3 ASR Crypto — asr-emit-mode.ts + asr-seal-spec.ts + asr-compliance-test.ts

> ⚠️ **DÉCOUVERTE CRITIQUE** : Ces 3 fichiers sont du **PSEUDO-CODE** (blueprints). Aucune implémentation réelle.

| Fichier | Contenu | Lignes | Implémenté ? |
|---------|---------|--------|-------------|
| `asr-emit-mode.ts` | Pipeline 10 étapes (validation, hash, signature, etc.) | 78 | ❌ Pseudo-code |
| `asr-seal-spec.ts` | Interfaces TypeScript `ASR_Seal`, `ASR_Base`, `ASR_Published` | 45 | ⚠️ Types seuls, `[key: string]: any` |
| `asr-compliance-test.ts` | 15 checks de conformité (A1-E3) | 85 | ❌ Pseudo-code |

**Impact** : La vraie signature Ed25519 est dans `lib/ayo-crypto.ts` (qui fonctionne). Ces 3 fichiers représentent une **spec future** pour industrialiser le scellement ASR.

**Décision** :
- **Court terme** : Les garder comme documentation/spec. Ne pas les implémenter maintenant.
- **Moyen terme (Sprint 7+)** : Implémenter le pipeline `asr-emit-mode` pour remplacer le code ad-hoc de `ayo-crypto.ts`
- **Actions immédiates** : Renommer en `asr-emit-mode.SPEC.ts` ou ajouter un commentaire `// BLUEPRINT - NOT IMPLEMENTED` en tête de chaque fichier

### 18.4 ayo-categories.ts (40 lignes)

**Rôle** : Taxonomie de 25 catégories d'activité.
**État** : OK, mais le prompt de classification est hardcodé en français (pas d'i18n).
**Action** : Aucune action immédiate.

---

## 19. SEO, SITEMAP, ROBOTS

### 19.1 robots.ts (12 lignes)

**État actuel** :
```
Allow: /
Disallow: /private/
Sitemap: https://www.ai-visionary.com/sitemap.xml
```

**Problèmes** :
- ❌ `/admin/` n'est PAS exclu → crawlers peuvent indexer le dashboard admin
- ❌ `/api/` n'est PAS exclu → crawlers peuvent appeler les endpoints API
- ❌ `/debug/` n'est PAS exclu

**Fix requis** :
```
Allow: /
Disallow: /admin/
Disallow: /api/
Disallow: /private/
Disallow: /debug/
Sitemap: https://www.ai-visionary.com/sitemap.xml
```

### 19.2 sitemap.ts (42 lignes)

**Problème critique** : `getAllEntityIds()` est un **MOCK** qui retourne 2 IDs hardcodées au lieu de requêter Firestore.

**Fix requis** :
1. Implémenter une vraie requête Firestore pour les entity IDs actifs
2. Utiliser la vraie `lastModified` depuis le champ `last_update` de chaque entité
3. Ajouter TOUTES les pages statiques (confidentialité, mentions, ai-et-votre-entreprise, etc.)

### 19.3 SEO Metadata

**Pages sans metadata SEO** :
| Page | Fichier |
|------|---------|
| `/diagnostic` | `app/diagnostic/page.tsx` |
| `/ai-et-votre-entreprise` | `app/ai-et-votre-entreprise/page.tsx` |
| `/aya` | `app/aya/page.tsx` |
| `/aya/e/[id]` | `app/aya/e/[id]/page.tsx` |

**Action** : Ajouter `export const metadata` (Next.js) avec title, description, og:image pour chaque page.

### 19.4 JSON-LD structuré

Les pages AYA devraient inclure du JSON-LD dans le HEAD pour que les bots IA les lisent :
- Page registre : `ItemList` avec les entités
- Page certificat : `Organization` avec les données de l'entité
- Homepage : `WebSite` + `Organization` pour AI Visionary elle-même

---

## 20. HOMEPAGE + PAGES MARKETING

### 20.1 Homepage (`app/page.tsx`, 320 lignes)

**Ce qui existe** : 9 sections (Hero, Problème, Comparatif, Solution, Target, AYA, Pricing, CTA, Footer).
**Design** : Inline styles partout → difficulté de maintenance.

**Problèmes** :
| # | Problème | Action |
|---|----------|--------|
| HP1 | Inline styles partout (pas de Tailwind/CSS modules) | Migrer vers Tailwind progressivement |
| HP2 | Pas de metadata SEO | Ajouter `export const metadata` |
| HP3 | Pas d'images (juste CSS abstrait) | Ajouter illustrations/screenshots |
| HP4 | PaymentHandler wrappé en Suspense | OK — mais vérifier si nécessaire après fusion avec PaymentSuccessModal |

### 20.2 Page marketing (`app/ai-et-votre-entreprise/page.tsx`, 179 lignes)

**Ce qui existe** : 5 sections pédagogiques + 3 cas concrets + FAQ.
**État** : Bon contenu, inline styles, pas de SEO metadata.

### 20.3 Page diagnostic (`app/diagnostic/page.tsx`, 36 lignes)

**Ce qui existe** : Layout simple avec logo + AyoChat fullscreen.
**Problèmes** : Inline styles, pas de SEO metadata.

---

## ORDRE D'EXÉCUTION COMPLET (mise à jour)

### Sprint 1 — Scoring + Questionnaire (URGENT)
*(Déjà détaillé section 10)*

### Sprint 2 — Persistence + Tunnel (CRITIQUE)
*(Déjà détaillé section 10)*

### Sprint 3 — Sécurité
*(Déjà détaillé section 10)*

### Sprint 4 — Qualité
*(Déjà détaillé section 10)*

### Sprint 5 — Cycle de vie client

| # | Tâche | Fichier(s) |
|---|-------|-----------|
| 5.1 | Ajouter champs cycle de vie dans `aya_registry` | `lib/db.ts` + Firestore |
| 5.2 | Webhook `invoice.payment_failed` + `subscription.deleted` | `app/api/webhooks/subscription/route.ts` (nouveau) |
| 5.3 | Cron job rappels MAJ annuelle | `app/api/cron/review-reminders/route.ts` (nouveau) |
| 5.4 | Cron job rappels expiration PRO | `app/api/cron/expiry-reminders/route.ts` (nouveau) |
| 5.5 | Cron job désactivation entités expirées | `app/api/cron/expire-entities/route.ts` (nouveau) |
| 5.6 | Page de mise à jour client (formulaire pré-rempli) | `app/update/[entityId]/page.tsx` (nouveau) |
| 5.7 | API de mise à jour + régénération fichiers | `app/api/update-entity/route.ts` (nouveau) |
| 5.8 | Page de renouvellement PRO | `app/renew/[entityId]/page.tsx` (nouveau) |
| 5.9 | Config Vercel Cron | `vercel.json` |

### Sprint 6 — Registre AYA public + hébergement

| # | Tâche | Fichier(s) |
|---|-------|-----------|
| 6.1 | Page certificat individuel | `app/aya/[entityId]/page.tsx` |
| 6.2 | Page registre public | `app/aya/page.tsx` |
| 6.3 | API publique registre | `app/api/aya/registry/route.ts` (nouveau) |
| 6.4 | Hébergement ASR par entité | `app/api/aya/[entityId]/asr.json/route.ts` (nouveau) |
| 6.5 | Stockage fichiers dans Firestore | Collection `entity_files` |

### Sprint 7 — Dashboard admin + analytics

| # | Tâche | Fichier(s) |
|---|-------|-----------|
| 7.1 | Dashboard KPIs business | `app/admin/page.tsx` |
| 7.2 | Liste clients avec statuts | `app/admin/clients/page.tsx` |
| 7.3 | Dashboard logs (déjà prévu section 1.3) | `app/admin/logs/page.tsx` |

### Sprint 8 — Composants UI + UX

| # | Tâche | Fichier(s) |
|---|-------|-----------|
| 8.1 | Fusionner PaymentHandler + PaymentSuccessModal | `app/components/` |
| 8.2 | Sanitiser le markdown dans AyoChat (DOMPurify) | `app/components/AyoChat.tsx` |
| 8.3 | Typer strictement les messages du chat | `app/components/AyoChat.tsx` |
| 8.4 | Gestion des cas limites du scanner (404, timeout, auth) | `lib/aio-scanner.ts` + `chat/route.ts` |
| 8.5 | Reprise de session (localStorage + Firestore) | `app/components/AyoChat.tsx` |
| 8.6 | Protection double paiement | `app/api/create-checkout/route.ts` |

### Sprint 9 — UX + SEO + conformité

| # | Tâche | Fichier(s) |
|---|-------|-----------|
| 9.1 | Fixer `robots.ts` (exclure /admin/, /api/, /debug/) | `app/robots.ts` |
| 9.2 | Fixer `sitemap.ts` (requête Firestore réelle, pas mock) | `app/sitemap.ts` |
| 9.3 | Ajouter metadata SEO sur toutes les pages | Toutes les pages |
| 9.4 | Ajouter JSON-LD structuré (registre + certificats + homepage) | `app/aya/`, `app/page.tsx` |
| 9.5 | Étoffer page confidentialité (RGPD complet, sous-traitants) | `app/confidentialite/page.tsx` |
| 9.6 | Étoffer mentions légales (hébergeur, responsable) | `app/mentions/page.tsx` |
| 9.7 | Créer page CGV | `app/cgv/page.tsx` (nouveau) |
| 9.8 | Supprimer doublon certificat | `app/certificate/[id]/page.tsx` (supprimer) |

### Sprint 10 — Modules sémantiques + nettoyage

| # | Tâche | Fichier(s) |
|---|-------|-----------|
| 10.1 | Unifier variable env Gemini API | `lib/ayo-semantics.ts` |
| 10.2 | Ajouter validation JSON + timeout Gemini | `lib/ayo-semantics.ts` |
| 10.3 | Supprimer fake data (ratings 4.5) dans external-context | `lib/external-context.ts` |
| 10.4 | Renommer ASR spec files en .SPEC.ts ou ajouter banner | `lib/asr-*.ts` |
| 10.5 | Migrer inline styles vers Tailwind (homepage + pages) | Toutes les pages |
| 10.6 | Dashboard client (futur, post-MVP) | Architecture Firestore prête |

---

## RÉSUMÉ FINAL (après re-scan complet)

Le système AYO a une **bonne architecture** (moteur de score Bible, générateurs de fichiers, crypto Ed25519, tunnel Stripe) mais souffre de **3 problèmes interconnectés** :

1. **Le LLM surclasse les réponses** → scores gonflés artificiellement
2. **Le questionnaire est improvisé** → données pauvres → fichiers pauvres
3. **La persistence est fragile** → le webhook perd les données → Score 0

### Ce qui EXISTE et fonctionne
- Moteur de score AIO (7 blocs, conforme Bible)
- Générateurs des 5 fichiers (ASR, manifest, FAQ, glossaire, external_context)
- Signature Ed25519 des ASR
- Tunnel Stripe complet (checkout + webhook)
- Registre AYA public (page + API + certificat individuel)
- Système d'auth OTP
- Logger structuré, rate limiter, validators Zod, sanitizer LLM
- Pages légales (confidentialité + mentions — mais incomplètes)
- Page marketing pédagogique
- 25 catégories de secteur
- Génération sémantique via Gemini

### Ce qui est CASSÉ
- Scoring LLM non-déterministe (q=1 forcé, hard cap invisible)
- Persistence chat → webhook fragile (Score 0)
- Double appel webhook (PaymentHandler + PaymentSuccessModal)
- Stripe Portal sans authentification
- Markdown non-sanitisé dans le chat (XSS)
- Sitemap mock (pas de vraie requête DB)
- robots.txt n'exclut pas les routes sensibles
- ASR spec files sont du pseudo-code non-implémenté

### Ce qui MANQUE
- Cycle de vie client (MAJ annuelle, renouvellements, notifications)
- Webhooks Stripe pour subscriptions (payment_failed, deleted)
- Cron jobs (rappels, expirations)
- Dashboard admin business (KPIs, liste clients)
- Dashboard client (futur)
- JSON-LD sur les pages AYA (pour les bots)
- SEO metadata sur la plupart des pages
- CGV/CGU
- Validation JSON des réponses Gemini
- Page de mise à jour client
- Page de renouvellement PRO
- API publique registre avec recherche

### Chiffres

| Catégorie | Nombre |
|-----------|--------|
| Sprints | **10** |
| Fichiers à modifier | **~25 existants** |
| Fichiers à créer | **~15 nouveaux** |
| Failles sécurité restantes | **23** (2 critiques, 12 hautes, 8 moyennes, 6 basses) |
| Collections Firestore à enrichir | `aya_registry` (champs cycle de vie), `entity_files` (nouveau), `system_logs` (existant) |
| Infra | Vercel Cron (4 jobs), unification env vars |
| Pages existantes à améliorer | 8 (SEO, styles, contenu) |
| Pages à créer | 3 (CGV, update client, renouvellement PRO) |
