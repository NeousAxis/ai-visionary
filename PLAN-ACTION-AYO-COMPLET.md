# PLAN D'ACTION COMPLET — AI VISIONARY / AYO

> **Date** : 13 mars 2026
> **Mise à jour** : 16 mars 2026 — Architecture Multi-Agents
> **Auteur** : Claude (assistant) pour Cyril Leger
> **Périmètre** : Architecture Multi-Agents AYO, Scoring, Production des 5 fichiers, Tunnel de vente, Emails, Sécurité, Questionnaire Universel, Composants UI, Sémantique, ASR Crypto, Pages légales, SEO, Cycle de vie client

---

## TABLE DES MATIÈRES

1. [Architecture Multi-Agents AYO](#1-architecture-multi-agents-ayo)
2. [Agent SCANNER](#2-agent-scanner)
3. [Agent GREFFIER](#3-agent-greffier)
4. [Agent ANALYSTE](#4-agent-analyste)
5. [Agent VENDEUR](#5-agent-vendeur)
6. [Agent ARCHITECTE ASR](#6-agent-architecte-asr)
7. [Agent CONTRÔLE QUALITÉ](#7-agent-contrôle-qualité)
8. [AYO — Le Routeur / Orchestrateur](#8-ayo-le-routeur)
9. [État des lieux — Ce qui existe](#9-état-des-lieux)
10. [Bugs critiques de scoring](#10-bugs-critiques-scoring)
11. [Tunnel de vente](#11-tunnel-de-vente)
12. [Emails — 2 formats](#12-emails)
13. [Sécurité — Audit et remédiation](#13-securite)
14. [Cycle de vie client](#14-cycle-de-vie-client)
15. [Page certificat AYA + Registre](#15-page-certificat-aya)
16. [Hébergement ASR + Fichiers](#16-hébergement-asr)
17. [Analytics + Métriques business](#17-analytics)
18. [Gestion des erreurs UX](#18-gestion-erreurs-ux)
19. [Conformité légale (RGPD, CGV)](#19-conformité-légale)
20. [Composants UI — Chat, Paiement, Modals](#20-composants-ui)
21. [Modules Sémantiques + ASR Crypto](#21-modules-semantiques-crypto)
22. [SEO, Sitemap, Robots](#22-seo-sitemap-robots)
23. [Homepage + Pages Marketing](#23-homepage-marketing)
24. [Ordre d'exécution (Sprints)](#24-ordre-execution)

---

## 1. ARCHITECTURE MULTI-AGENTS AYO

### Pourquoi ?

Aujourd'hui, **tout le code est dans 1 fichier** (`chat/route.ts` — 2800 lignes) avec **1 seul prompt LLM** qui fait tout : scanner, questionner, scorer, vendre, générer des fichiers. Résultat :
- Le LLM confond ASR (AI Singular Record) avec ASR (Automatic Speech Recognition)
- Il repose des questions que le scan a déjà résolues
- Il génère des fichiers PRO avec des données sales
- 1 bug = tout casse, debugging impossible

### Vision Multi-Agents

```
CLIENT ↔ AYO (visage public, orchestre tout)
              │
              ├→ SCANNER      (crawl technique — PAS de LLM)
              ├→ GREFFIER     (pose les questions — LLM spécialisé)
              ├→ ANALYSTE     (calcule le score — PAS de LLM)
              ├→ VENDEUR      (tunnel Stripe — PAS de LLM)
              ├→ ARCHITECTE   (génère les 5 fichiers PRO — LLM spécialisé)
              └→ CONTRÔLE QC  (valide avant livraison — PAS de LLM)
```

**Le client ne voit que AYO.** Les 6 agents travaillent en coulisse.

### Coûts comparés

| | Tokens input / diagnostic | Coût Gemini Flash |
|---|---|---|
| Aujourd'hui (1 gros prompt) | ~250K | ~$0.025 |
| Multi-agents | ~65K | ~$0.007 |

**~70% d'économie** + moins de tokens = moins d'hallucinations = moins de bugs.

### Principes

1. **Chaque agent a 1 seul rôle** — il ne sait rien des autres
2. **Seuls 2 agents sur 6 utilisent le LLM** (Greffier + Architecte)
3. **Chaque agent a son propre fichier** — testable isolément
4. **AYO est le routeur** — il dispatch, suit l'état, et parle au client
5. **ASR = AI Singular Record** — JAMAIS "Automatic Speech Recognition"

### Flow complet

```
1. Client tape URL
   → AYO → SCANNER (crawl technique, 0 LLM)
   → Résultat scan stocké dans Firestore scan_state/{docId}

2. AYO affiche le score initial
   → AYO → ANALYSTE (formule déterministe, 0 LLM)

3. AYO pose les questions
   → AYO → GREFFIER (LLM spécialisé, prompt ~800 tokens)
   → Le Greffier ne pose QUE les questions sur les données MANQUANTES
   → Chaque réponse est stockée immédiatement dans Firestore

4. AYO affiche le score enrichi + delta
   → AYO → ANALYSTE (recalcul, 0 LLM)

5. AYO propose les packs
   → AYO → VENDEUR (templates HTML, liens Stripe, 0 LLM)

6. Client paie via Stripe
   → Webhook → ARCHITECTE (1 seul appel LLM, génère les 5 fichiers)
   → ARCHITECTE → CONTRÔLE QC (validation, 0 LLM)
   → Si QC échoue → retour à ARCHITECTE avec les erreurs
   → Si QC passe → livraison email + ZIP
```

---

## 2. AGENT SCANNER

### Rôle
Crawl technique du site. **Zéro LLM. 100% déterministe.**

### Entrée
- URL du client

### Sortie (JSON structuré)
```typescript
interface ScanResult {
  url: string;
  isReachable: boolean;
  metaTitle: string;
  metaDescription: string;
  hasJsonLd: boolean;
  jsonLdCount: number;
  hasAsrFile: boolean;       // AI Singular Record détecté
  hasFaqContent: boolean;
  hasFaqSchema: boolean;
  hasSitemap: boolean;       // Détecté au scan
  hasRobotsTxt: boolean;     // Détecté au scan
  detectedServices: string[];
  detectedProducts: string[];
  detectedPolicies: string[];
  htmlContent: string;       // Pour extraction LLM ultérieure
}
```

### Fichier actuel
`lib/aio-scanner.ts` (179 lignes) — **existe déjà, fonctionne**

### Ce qui change
- Extraire la logique de scan de `chat/route.ts` vers `lib/aio-scanner.ts` si pas déjà fait
- Le scanner stocke ses résultats dans Firestore `scan_state/{scanStateDocId(url)}`
- Le scanner utilise la normalisation URL : `normalizeScanStateUrl()` + `scanStateDocId()` (déjà implémenté dans le fix/remediation)
- **Le scanner ne parle JAMAIS au client**

### Ce qu'il détecte automatiquement (JAMAIS demandé en question)
- Sitemap
- Robots.txt
- JSON-LD
- Fichier ASR (AI Singular Record)
- FAQ structurée
- Mobile responsive

---

## 3. AGENT GREFFIER

### Rôle
Questionner le client **UNIQUEMENT** sur ce que le Scanner n'a pas trouvé. C'est un greffier de tribunal : il remplit un formulaire, point.

### Ce qu'il sait
- Les 7 blocs AIO et leurs champs
- Le résultat du scan (injecté par AYO)
- Les réponses précédentes (contexte court)

### Ce qu'il ne sait PAS
- Ce qu'est un score AIO
- Ce qu'est un fichier ASR
- Ce qu'est un pack PRO
- Le tunnel de vente
- **ASR = il ne connaît même pas ce mot**

### Prompt (~800 tokens)
```
Tu es un greffier. Tu remplis un formulaire structuré pour une entreprise.
Tu poses UNE question à la fois. Tu es bref et direct.

RÈGLES :
1. Si le scan a déjà trouvé une donnée → NE POSE PAS la question
2. Si le client répond "aucun", "non", "rien" → accepte et passe (q=0)
3. Si le client est vague → relance UNE SEULE FOIS pour obtenir des détails
4. Tu ne fais JAMAIS de calcul, de score, de pitch commercial
5. Tu ne parles JAMAIS de "ASR", "AI Singular Record", "pack", "certification"
6. Format de sortie TOUJOURS un JSON question_block
```

### Questions par bloc

#### BLOC 1 — Identité & Ancrage (/10)
| # | Question | Champ cible | Skip si scan ? |
|---|----------|-------------|----------------|
| Q1 | Nom commercial + forme juridique | name, legal_name, business_type | Non |
| Q2 | Ville + pays | city, country | Non |
| Q3 | Email + téléphone pro | contact_email, contact_phone | Non |

#### BLOC 2 — Clarté de l'Offre (/20)
| # | Question | Champ cible | Skip si scan ? |
|---|----------|-------------|----------------|
| Q4 | Services/produits principaux (3-5) | services, products | Oui si détectés |
| Q5 | Audience cible | target_audience | Oui si détectée |
| Q6 | Cas d'usage concrets (2-3) | use_cases | Non |
| Q7 | Structure tarifaire | pricing_indication | Non |

#### BLOC 3 — Processus & Méthodes (/15)
| # | Question | Champ cible | Skip si scan ? |
|---|----------|-------------|----------------|
| Q8 | Étapes du processus de travail (≥3) | process_steps | Non |
| Q9 | Mode de livraison + zone géographique | delivery_mode, geographies_served | Partiellement |
| Q10 | Contrôle qualité | quality_assurance | Non |

#### BLOC 4 — Confiance & Conformité (/15)
| # | Question | Champ cible | Skip si scan ? |
|---|----------|-------------|----------------|
| Q11 | Certifications / labels | certifications | Non |
| Q12 | Frameworks / méthodologies / associations | frameworks | Non |
| Q13 | Politiques formelles + sécurité | policies, security_measures | Oui si détectées |

#### BLOC 5 — Preuve Sociale & Métriques (/20)
| # | Question | Champ cible | Skip si scan ? |
|---|----------|-------------|----------------|
| Q14 | 3-5 indicateurs chiffrés | key_indicators | Non |
| Q15 | Date de dernière mise à jour | last_review_date | Non |

#### BLOC 6 — Pédagogie & Supports (/10)
| # | Question | Champ cible | Skip si scan ? |
|---|----------|-------------|----------------|
| Q16 | FAQ / glossaire / documentation sur le site ? | has_faq, has_glossary, has_documentation | Oui (scan détecte) |

#### BLOC 7 — Socle Technique (/10)
**AUCUNE QUESTION** — 100% géré par le Scanner.
- has_jsonld → scan
- has_asr → scan (AI Singular Record)
- has_sitemap → scan
- mobile_optimized → scan

#### BONUS — Contexte externe
| # | Question | Champ cible |
|---|----------|-------------|
| Q17 | Mots-clés décrivant l'activité (5-10) | keywords |
| Q18 | Canaux de présence | channels |
| Q19 | Intentions utilisateurs ciblées | intents |

### Logique d'adaptation
1. Après le scan, les blocs déjà remplis (q=1 via scan) sont **SAUTÉS**
2. L'ordre des questions est trié par **bloc le plus faible en premier**
3. **Nombre de questions** : 8-18 selon la richesse du scan

### Fichier cible
`lib/agents/greffier.ts` — Nouveau fichier, prompt isolé

---

## 4. AGENT ANALYSTE

### Rôle
Calculer le score AIO. **Zéro LLM. Formule déterministe.**

### Formule
```
score_bloc = (champs_valides / champs_attendus) × poids_bloc
score_total = Σ score_bloc
```

### Les 7 blocs et leurs poids
| Bloc | Poids | Champs |
|------|-------|--------|
| Identité & Ancrage | /10 | name, legal_name, business_type, city, country |
| Clarté de l'Offre | /20 | services, products, use_cases, target_audience, pricing |
| Processus & Méthodes | /15 | process_steps, delivery_mode, geographies, quality_assurance |
| Confiance & Conformité | /15 | certifications, policies, frameworks, security |
| Preuve Sociale & Métriques | /20 | key_indicators, last_review_date |
| Pédagogie & Supports | /10 | has_faq, has_glossary, has_documentation |
| Socle Technique | /10 | has_jsonld, has_asr, has_sitemap, mobile_optimized |

### Hard caps (transparents)
- Sans JSON-LD ET sans AYA → max 50/100
- Sans ASR (AI Singular Record) → max 90/100
- **NOUVEAU** : Quand un cap est appliqué, l'Analyste retourne `cap_applied: true`, `cap_reason`, et `raw_total` (score brut avant cap)

### Validation sémantique des réponses
L'Analyste valide aussi la qualité des réponses AVANT de scorer :
```
"aucun" / "rien" / "non" → q=0
"oui" / "ok" / "peut-être" → q=0.5 max
"ça ne te regarde pas" → q=0
"ISO 27001" → q=1 (certification vérifiable)
"12 communes" → q=1 (KPI chiffré)
```

### Fichier actuel
`lib/aio-score-engine.ts` (319 lignes) — **existe déjà, fonctionne**

### Ce qui change
- Extraire la validation sémantique dans `lib/agents/analyste.ts`
- Supprimer "SET q=1" du prompt d'extraction (ligne 1982 de route.ts)
- Le hard cap est transparent : `raw_total` + `cap_reason` retournés
- **L'Analyste ne parle JAMAIS au client**

---

## 5. AGENT VENDEUR

### Rôle
Présenter les packs et gérer le tunnel Stripe. **Zéro LLM. Templates HTML.**

### Ce qu'il gère
1. Affichage des 2 packs (Light gratuit / PRO 499 CHF / AYA Sub 19 CHF/mois)
2. Création de la session Stripe Checkout
3. Réception du webhook post-paiement
4. Déclenchement de la génération des fichiers (appel à l'Architecte)
5. Envoi de l'email de livraison

### 2 offres commerciales

#### Abonnement AYA (19 CHF/mois)
- **Price ID** : `price_1SzazaPkCQYUm8hQJfrKc9EJ`
- **Mode Stripe** : `subscription`
- Inscription au Registre AYA (certification active)
- ASR hébergé sur AI Visionary
- Priorité recommandations IA
- Mises à jour incluses

#### Pack PRO (499 CHF one-shot)
- **Price ID** : `price_1SlM9iPkCQYUm8hQKqOV8eqU`
- **Mode Stripe** : `payment`
- 5 fichiers sources (ASR, manifest, FAQ, glossaire, external_context)
- ZIP envoyé par email
- 3 ANS de Registre AYA offerts
- Propriété totale des fichiers

### Stripe Integration
- Checkout : encode `{u: url, e: email, aid: analysisId}` en base64 dans `client_reference_id`
- Webhook : vérifie signature Stripe, décode le `client_reference_id`, lance la génération

### Fichiers actuels
- `app/api/create-checkout/route.ts` (137 lignes)
- `app/api/webhooks/checkout-success/route.ts` (477 lignes)

### Ce qui change
- Le Vendeur est un module autonome dans `lib/agents/vendeur.ts`
- Il ne fait que le routing Stripe + déclenchement Architecte
- **Le Vendeur ne génère AUCUN fichier lui-même**
- **Le Vendeur ne parle JAMAIS au client** (AYO gère l'affichage)

---

## 6. AGENT ARCHITECTE ASR

### Rôle
Générer les 5 fichiers PRO à partir de l'extract JSON. **1 seul appel LLM.**

### Les 5 fichiers

| # | Fichier | Rôle |
|---|---------|------|
| 1 | `ASR-Protocol.json` | AI Singular Record — JSON-LD signé Ed25519 |
| 2 | `manifest.json` | Déclaration d'intention + roadmap AIO |
| 3 | `faq.json` | Questions/réponses structurées pour les IA |
| 4 | `glossary.json` | Définitions des termes clés de l'entité |
| 5 | `external_context.json` | Écosystème, canaux, mots-clés, intentions |

### Prompt spécialisé (~2000 tokens)
```
Tu es un architecte de données structurées.
Tu reçois un JSON extract contenant les données d'une entreprise.
Tu génères 5 fichiers JSON conformes aux schémas suivants.

VOCABULAIRE :
- ASR = AI Singular Record (l'acte de naissance numérique d'une entité)
- ASR ≠ Automatic Speech Recognition (JAMAIS)
- AIO = AI Optimization (score de visibilité IA)
- AYA = AI Verified Authority (registre certifié)

RÈGLES DE FORMAT :
- target_audience : segments courts séparés par virgule, JAMAIS une phrase complète
- products : noms complets avec parenthèses fermées
- quality_assurance : TOUJOURS un array [], JAMAIS une string
- geographies_served : si vide, fallback au pays
- discovery_keywords : max 50 caractères par entrée, JAMAIS de descriptions
- intent_keywords : max 80 caractères par entrée
```

### Fichiers actuels
- `lib/ayo-generators.ts` (677 lignes) — générateurs des 5 fichiers
- `lib/ayo-crypto.ts` (399 lignes) — signature Ed25519 + ASR JSON-LD

### Ce qui change
- Les générateurs restent dans `lib/ayo-generators.ts` (ils fonctionnent)
- Le prompt d'appel LLM est isolé dans `lib/agents/architecte.ts`
- **L'Architecte ne parle JAMAIS au client**
- **L'Architecte ne connaît PAS le score** — il ne fait que générer

---

## 7. AGENT CONTRÔLE QUALITÉ

### Rôle
Valider les fichiers PRO **AVANT** livraison au client. **Zéro LLM. Règles déterministes.**

### Validations

| Fichier | Règle | Action si échec |
|---------|-------|-----------------|
| ASR-Protocol.json | `audience` pas une phrase (>100 chars sans virgule) | Rejeter → renvoyer à Architecte |
| ASR-Protocol.json | `products` pas tronqués (parenthèses fermées) | Rejeter |
| ASR-Protocol.json | `quality_assurance` est un array `[]` | Corriger automatiquement |
| ASR-Protocol.json | `geographies_served` pas vide | Corriger (fallback pays) |
| faq.json | Chaque Q/A a ≥20 chars de réponse | Rejeter les entrées vides |
| glossary.json | Définitions spécifiques (pas "protection des données" générique) | Corriger via map de définitions |
| external_context.json | `discovery_keywords` chaque entrée ≤50 chars | Filtrer les entrées longues |
| external_context.json | `intent_keywords` chaque entrée ≤80 chars | Filtrer |
| manifest.json | URL en minuscule | Corriger automatiquement |
| TOUS | Pas de "Entreprise Inconnue" ni "Non spécifié" | BLOQUER la livraison |
| TOUS | JSON valide (parsable) | BLOQUER si invalide |

### Boucle de correction
```
ARCHITECTE génère les fichiers
    → CONTRÔLE QC valide
    → Si ÉCHEC : retour à ARCHITECTE avec liste d'erreurs
    → Si OK : livraison
    → Max 2 tentatives — après, logger CRITICAL et alerter l'admin
```

### Fichier cible
`lib/agents/controle-qualite.ts` — Nouveau fichier

### C'est cet agent qui aurait attrapé TOUS les bugs de la semaine dernière :
- audience = phrase complète ❌
- products tronqués ❌
- quality_assurance = string ❌
- keywords trop longs ❌
- définitions glossary génériques ❌

---

## 8. AYO — LE ROUTEUR / ORCHESTRATEUR

### Rôle
AYO est le **chef d'orchestre**. C'est le seul qui parle au client. Il dispatch aux agents et gère l'état du dossier.

### Ce qu'AYO gère
1. **L'état du dossier** — où on en est dans le flow (scan / questions / score / vente / génération)
2. **La personnalité / le ton** — discours pédagogique sur la visibilité IA
3. **Le routing** — "scan fini → questions → score → vente"
4. **Les erreurs** — "le Scanner a planté → message propre au client"
5. **L'injection de contexte** — passe le résultat du Scanner au Greffier, l'extract à l'Architecte, etc.

### Ce qu'AYO ne gère PAS
- Quelles questions poser (→ Greffier)
- Le calcul du score (→ Analyste)
- La génération de fichiers (→ Architecte)
- La validation des fichiers (→ Contrôle QC)
- Les liens Stripe (→ Vendeur)

### Machine à états

```
ÉTAT 0 : ATTENTE_URL
  → Client donne URL
  → AYO → SCANNER
  → Transition vers ÉTAT 1

ÉTAT 1 : SCAN_EN_COURS
  → Scanner retourne les résultats
  → AYO → ANALYSTE (score initial)
  → AYO affiche le score + transparence du scan
  → Transition vers ÉTAT 2

ÉTAT 2 : QUESTIONNAIRE
  → AYO → GREFFIER (question suivante)
  → Client répond
  → Réponse stockée dans Firestore immédiatement
  → Boucle jusqu'à ce que le Greffier ait fini
  → AYO → ANALYSTE (score enrichi)
  → AYO affiche le delta
  → Transition vers ÉTAT 3

ÉTAT 3 : CAPTURE_EMAIL
  → AYO demande l'email professionnel
  → Email stocké dans Firestore
  → Transition vers ÉTAT 4

ÉTAT 4 : PROPOSITION_PACKS
  → AYO → VENDEUR (affiche les packs)
  → Client clique → Stripe Checkout
  → Transition vers ÉTAT 5

ÉTAT 5 : PAIEMENT_EN_COURS
  → Stripe webhook reçu
  → AYO → VENDEUR → ARCHITECTE (génération fichiers)
  → ARCHITECTE → CONTRÔLE QC (validation)
  → Si QC OK → envoi email + ZIP
  → Transition vers ÉTAT 6

ÉTAT 6 : LIVRÉ
  → Client a reçu ses fichiers
  → Entité inscrite dans le Registre AYA
```

### Fichier cible
`lib/agents/ayo-router.ts` — Machine à états du routeur

---

## 9. ÉTAT DES LIEUX

### Architecture actuelle (à migrer)

```
Utilisateur → /diagnostic (chatbot AYO)
  → Phase 1 : Donne son URL → Scanner aio-scanner.ts scanne le site
  → Phase 2 : Questionnaire enrichi (5-18 questions via LLM)
  → Phase 3 : Score final AIO → Proposition achat (AYA ou PRO)
  → Email capture → Stripe checkout
  → Webhook Stripe → Génération fichiers → Email livraison
```

### Architecture cible (multi-agents)

```
Utilisateur → /diagnostic (AYO Routeur)
  → ÉTAT 0 : URL → SCANNER (0 LLM)
  → ÉTAT 1 : Score initial → ANALYSTE (0 LLM)
  → ÉTAT 2 : Questions → GREFFIER (LLM ~800 tok/question)
  → ÉTAT 2 : Score enrichi → ANALYSTE (0 LLM)
  → ÉTAT 3 : Email capture
  → ÉTAT 4 : Packs → VENDEUR (0 LLM)
  → ÉTAT 5 : Fichiers → ARCHITECTE (1 appel LLM) → CONTRÔLE QC (0 LLM)
  → ÉTAT 6 : Livré
```

### Fichiers clés (actuels)

| Fichier | Rôle | Agent cible |
|---------|------|-------------|
| `app/api/chat/route.ts` | TOUT (2800 lignes) | → Éclaté en 6 agents |
| `lib/aio-scanner.ts` | Scanner URL (179 lignes) | → SCANNER |
| `lib/aio-score-engine.ts` | Moteur de score (319 lignes) | → ANALYSTE |
| `lib/ayo-generators.ts` | Générateurs 5 fichiers (677 lignes) | → ARCHITECTE |
| `lib/ayo-crypto.ts` | Signature Ed25519 + ASR (399 lignes) | → ARCHITECTE |
| `lib/ayo-system-prompt.ts` | System prompt V3 (104 lignes) | → GREFFIER |
| `lib/db.ts` | Firebase Admin Firestore (418 lignes) | → Partagé |
| `app/api/webhooks/checkout-success/route.ts` | Webhook Stripe (477 lignes) | → VENDEUR |
| `app/api/create-checkout/route.ts` | Création session Stripe (137 lignes) | → VENDEUR |
| `app/api/light-report/route.ts` | Pack Light gratuit (234 lignes) | → VENDEUR |

### Nouveaux fichiers (multi-agents)

| Fichier | Agent |
|---------|-------|
| `lib/agents/ayo-router.ts` | AYO — Machine à états |
| `lib/agents/scanner.ts` | SCANNER — Wraps aio-scanner.ts |
| `lib/agents/greffier.ts` | GREFFIER — Prompt + logique questions |
| `lib/agents/analyste.ts` | ANALYSTE — Wraps aio-score-engine.ts + validation sémantique |
| `lib/agents/vendeur.ts` | VENDEUR — Tunnel Stripe |
| `lib/agents/architecte.ts` | ARCHITECTE — Wraps ayo-generators.ts + ayo-crypto.ts |
| `lib/agents/controle-qualite.ts` | CONTRÔLE QC — Validation fichiers |

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

### Utilitaires existants

| Fichier | Rôle | État |
|---------|------|------|
| `lib/logger.ts` | Logger structuré avec correlation IDs | ✅ OK |
| `lib/auth.ts` | Middleware admin (ADMIN_SECRET, timing-safe) | ✅ OK |
| `lib/validators.ts` | Schemas Zod (URL, email, OTP, SSRF) | ✅ OK |
| `lib/rate-limit.ts` | Rate limiting in-memory par IP | ✅ OK |
| `lib/sanitize.ts` | Sanitizer anti-injection LLM | ✅ OK |

---

## 10. BUGS CRITIQUES DE SCORING

### Bug #1 — Le LLM met q=1 sur des réponses poubelle

**Localisation** : `app/api/chat/route.ts:1981-1982`

**Le problème** : `"PRIORITIZE THIS INFO AND SET q=1"` → le LLM met q=1 sur TOUT.

**Fix Multi-Agents** : Le GREFFIER ne fait PAS l'extraction. Il pose les questions. L'ANALYSTE valide les réponses avec la validation sémantique AVANT de scorer.

### Bug #2 — Scores blocs ≠ Score final (hard cap invisible)

**Localisation** : `lib/aio-score-engine.ts:158-168`

**Le problème** : `Math.min(total, 50)` invisible → contradiction blocs vs total.

**Fix Multi-Agents** : L'ANALYSTE retourne `raw_total` + `cap_applied` + `cap_reason`. AYO affiche :
```
📊 SCORE BRUT : 85 / 100
⚠️ PLAFOND TECHNIQUE : 50 / 100 (Pas de JSON-LD structuré détecté)
💡 Le Pack PRO installe les fichiers techniques qui lèvent ce plafond.
```

### Bug #3 — Pas de validation sémantique des réponses

**Fix Multi-Agents** : Créer `lib/agents/analyste.ts` avec :
```typescript
const NEGATION = /^(non|aucun|rien|pas de|n'ai pas|ne sais pas|pas applicable|pas encore|jamais|néant|zéro|nul)$/i;
const VAGUE = /^(oui|ok|possible|peut-être|on verra|un peu|quelques|certains)$/i;
const HOSTILE = /regarde pas|mêle pas|vie privée|confidentiel|secret/i;
```

### Bug #4 — ASR confondu avec "Automatic Speech Recognition"

**Fix Multi-Agents** : Le GREFFIER ne sait même pas ce qu'est un ASR. Il ne pose AUCUNE question sur le Socle Technique (Bloc 7). Le SCANNER détecte automatiquement si un fichier ASR existe. Terminé.

---

## 11. TUNNEL DE VENTE

### Flux complet (multi-agents)

```
1. Client → /diagnostic → AYO demande l'URL (ÉTAT 0)
2. AYO → SCANNER analyse le site (ÉTAT 1)
3. AYO → ANALYSTE calcule le score initial (ÉTAT 1)
4. AYO affiche le score initial (7 blocs)
5. AYO → GREFFIER pose 8-18 questions (ÉTAT 2)
6. AYO → ANALYSTE recalcule le score enrichi (ÉTAT 2)
7. AYO affiche le delta (avant/après) (ÉTAT 2)
8. AYO demande l'email professionnel (ÉTAT 3)
9. AYO → VENDEUR affiche les 2 packs (ÉTAT 4)
10. Client clique → Stripe Checkout (ÉTAT 5)
11. Webhook → VENDEUR → ARCHITECTE → CONTRÔLE QC → Email (ÉTAT 5→6)
```

### Stripe Integration

**Création checkout** (`create-checkout/route.ts` → VENDEUR) :
- Encode `{u: url, e: email, aid: analysisId}` en base64 dans `client_reference_id`
- 3 price IDs possibles (AYA_SUB, PRO, Essential)

**Webhook** (`webhooks/checkout-success/route.ts` → VENDEUR) :
- Vérifie la signature Stripe
- Décode `client_reference_id` → URL, email, analysisId
- Cascade Firestore : analysisId → URL → email → scan_states
- Détecte le pack par price_id
- **→ ARCHITECTE** pour générer les fichiers
- **→ CONTRÔLE QC** pour valider
- Envoie l'email via Resend

### Points de fragilité (à corriger)

1. **Bug Score 0** : Cascade Firestore ne trouve rien → "Entreprise Inconnue"
   - **Fix** : Le GREFFIER persiste CHAQUE réponse immédiatement dans Firestore
   - Le VENDEUR REFUSE de générer si données absentes (log CRITICAL)

2. **Perte d'email** : Email capturé dans le chat mais pas persisté avant paiement
   - **Fix** : AYO écrit l'email dans Firestore dès capture (ÉTAT 3)

3. **Double appel webhook** : PaymentHandler + PaymentSuccessModal
   - **Fix** : Fusionner en 1 composant (voir section 20)

---

## 12. EMAILS — 2 formats

### Email PRO (Pack 499 CHF)

**Sections obligatoires** :
1. Header : "Pack Propriétaire (PRO) Activé" + logo
2. Certificat AYA : Entity ID + période validité + lien en ligne
3. Fichiers Sources : liste des 5 fichiers dans le ZIP
4. Scores détaillés par bloc (avec cap transparent si appliqué)
5. Diagnostic des manquements
6. Code ASR JSON complet (`<pre>` copier-coller)
7. Guide d'installation (2 méthodes : `<script>` ou dossier `.ayo/`)
8. Contact hello@ai-visionary.com
9. ZIP en pièce jointe

### Email AYA (Abonnement 19 CHF/mois)

1. Header : "Abonnement AYA Activé"
2. Certificat AYA : lien en ligne
3. Score AIO
4. Avantages : registre actif, priorité IA, MAJ incluses
5. Lien dashboard

### Email Light (Gratuit)

1. Score AIO
2. Diagnostic sommaire
3. Code ASR JSON Light (subset)
4. Guide d'installation simplifié
5. PJ : `asr.json` uniquement

### Corrections requises

1. Email PRO : utiliser les VRAIS scores (fix = persistence Firestore par GREFFIER)
2. Email Light : utiliser les vrais scores du moteur (pas des seuils arbitraires)

---

## 13. SÉCURITÉ — Audit et remédiation

### Déjà corrigé ✅

| Faille | Correction | Fichier |
|--------|-----------|---------|
| Clé Ed25519 hardcodée | `process.env.AYO_SIGNING_KEY` | `lib/ayo-crypto.ts` |
| Webhook Stripe sans vérification | Suppression fallback | `webhooks/checkout-success/route.ts` |
| Password debug hardcodé (`ayo1234`) | `ADMIN_SECRET` + `requireAdmin()` | `debug/clean/route.ts` |
| Pas de rate limiting | `lib/rate-limit.ts` | — |
| Pas de validation input | `lib/validators.ts` (Zod) | — |
| Pas de sanitizer LLM | `lib/sanitize.ts` | — |
| Pas de logger structuré | `lib/logger.ts` | — |

### Encore à faire ❌

#### CRITIQUE

| # | Faille | Action |
|---|--------|--------|
| C1 | Token session basé sur ADMIN_SECRET (fallback) | Exiger `SESSION_SECRET` dédié |
| C2 | Price IDs hardcodés | Déplacer vers env vars |

#### HAUTE

| # | Faille | Action |
|---|--------|--------|
| H1 | Erreurs internes exposées au client | Remplacer `error.message` par "Erreur interne" |
| H2 | `ignoreBuildErrors: true` | Mettre `false` et fixer les erreurs TS |
| H3 | Pas d'anti-SSRF dans le SCANNER | Appeler `isAllowedUrl()` avant fetch |
| H4 | Rate limiting non appliqué | `checkRateLimit()` en début de chaque route |
| H5 | Endpoints debug non protégés | `requireAdmin()` |
| H6 | Validation Zod non appliquée | Schemas Zod en début de route |
| H7 | Stripe Portal SANS authentification | Exiger auth OTP/session |
| H8 | Markdown non-sanitisé dans AyoChat (XSS) | DOMPurify |
| H9 | PaymentHandler + PaymentSuccessModal = double webhook | Fusionner |
| H10 | Gemini API sans validation JSON | try/catch + Zod |
| H11 | Gemini API sans timeout | AbortController 30s |

#### MOYENNE

| # | Faille | Action |
|---|--------|--------|
| M1 | Pas de Content-Security-Policy | Ajouter CSP header |
| M2 | Email en clair dans Stripe metadata | Hasher SHA256 |
| M3 | `dangerouslySetInnerHTML` dans layout | Risque faible (JSON.stringify) |
| M4 | Scanner vérifie AYA dans `analyses` au lieu de `aya_registry` | Corriger |
| M5 | `external-context.ts` : fake rating 4.5 | Supprimer |
| M6 | `robots.txt` n'exclut pas `/admin/`, `/api/` | Corriger |
| M7 | `vercel.json` maxDuration=60s peut être court | Évaluer queue async |
| M8 | Session_id Stripe non validé | Valider format UUID |

#### BASSE

| # | Faille | Action |
|---|--------|--------|
| B1 | Index Firestore manquants | Créer |
| B2 | Code mort (`checkout-success-fix.ts`) | Supprimer |
| B3 | `@ts-ignore` x22 | Typer correctement |
| B4 | Doublon page certificat | Supprimer `app/certificate/` |
| B5 | Types `any[]` dans AyoChat | Typer strictement |
| B6 | 2 variables env pour Gemini API key | Unifier |

---

## 14. CYCLE DE VIE CLIENT

### Vue d'ensemble

```
ACQUISITION                    VIE DU CLIENT                         RENOUVELLEMENT
─────────────                  ───────────────                       ──────────────
Diagnostic AYO                 Inscription AYA active                Expiration approche
→ Paiement Stripe              → Données en ligne                   → Notifications
→ Fichiers livrés              → Bots IA lisent AYA                 → Relance
→ Registre AYA actif           → MAJ annuelle demandée              → Renouvellement ou churn
```

### Mise à jour annuelle

**Notifications** :

| Timing | Email |
|--------|-------|
| J-30 | "Vos données AYA ont 11 mois — mettez-les à jour" |
| J-7 | "⚠️ Mise à jour requise sous 7 jours" |
| J-0 | "🔴 Vos données AYA sont obsolètes" |
| J+30 | Badge "⚠️ Données non vérifiées" dans le registre |

**Processus** : Lien unique → page pré-remplie → mise à jour → re-calcul score → régénération fichiers

### Renouvellement AYA Sub (19 CHF/mois)

Webhooks nécessaires :
- `invoice.payment_failed` → email "mettez à jour votre moyen de paiement"
- `customer.subscription.deleted` → désactiver entité, retirer badge
- `invoice.paid` → logger, pas d'email (pas de spam)

### Renouvellement Pack PRO (après 3 ans)

| Timing | Email |
|--------|-------|
| J-90 | "Votre certification expire dans 3 mois" |
| J-30 | "⚠️ Plus que 30 jours" |
| J-7 | "🔴 Dernière semaine" |
| J-0 | "Votre certification a expiré" |

Options : Renouvellement PRO (499 CHF) / Passage AYA Sub (19 CHF/mois) / Laisser expirer

### Champs Firestore `aya_registry` à ajouter

```typescript
{
  // Mise à jour annuelle
  last_update: string,
  next_review_due: string,
  update_count: number,

  // Abonnement
  pack_type: "AYA_SUB" | "PRO",
  subscription_id: string | null,
  subscription_status: "active" | "past_due" | "canceled" | "expired" | null,
  last_payment_date: string,
  payment_failure_count: number,

  // Expiration PRO
  aya_expiry_date: string,
  aya_status: "active" | "expiring_soon" | "expired",
}
```

### Cron Jobs (Vercel Cron)

| Cron | Fréquence | Action |
|------|-----------|--------|
| `review-reminders` | Quotidien 9h | Rappels MAJ annuelle |
| `expiry-reminders` | Quotidien 9h | Rappels expiration PRO |
| `expire-entities` | Quotidien 1h | Désactiver entités expirées |
| `subscription-sync` | Hebdomadaire | Sync Stripe ↔ Firestore |

---

## 15. PAGE CERTIFICAT AYA + REGISTRE

### Certificat individuel — ✅ EXISTE

**URL** : `https://ai-visionary.com/aya/e/{entityId}`
**Fichier** : `app/aya/e/[id]/page.tsx`

**Ce qui manque** :
- JSON-LD `Organization` dans le HEAD
- Badge AYA téléchargeable
- 7 blocs de score individuels
- Statut visuel : ✅ Actif / ⚠️ Expiring / ❌ Expiré
- Lien vers ASR JSON hébergé

### Registre public — ✅ EXISTE

**URL** : `https://ai-visionary.com/aya`
**Fichier** : `app/aya/page.tsx`

**Ce qui manque** :
- Pagination
- Filtres (secteur, score, localisation)
- JSON-LD `ItemList`
- Tri (score, date, alpha)

### API publique (pour intégrations)

**URL** : `GET /api/aya/registry?q=restaurant+geneve`
- Permet aux IA et services tiers de requêter le registre

---

## 16. HÉBERGEMENT ASR + FICHIERS

### Fichiers ASR hébergés (clients AYA Sub)
- **URL** : `https://ai-visionary.com/api/aya/{entityId}/asr.json`
- MAJ automatiques quand le client met à jour ses données
- **Fichier à créer** : `app/api/aya/[entityId]/asr.json/route.ts`

### Fichiers Pack PRO
- Livrés par email (ZIP)
- Copie dans Firestore `entity_files` pour dashboard + régénération

---

## 17. ANALYTICS + MÉTRIQUES

| Métrique | Source |
|----------|--------|
| Diagnostics lancés | `system_logs` |
| Taux complétion questionnaire | Phase 3 / Phase 1 |
| Conversion diagnostic → paiement | Stripe / diagnostics |
| Score AIO moyen | `analyses` |
| Entités AYA actives | `aya_registry` |
| Churn rate AYA Sub | Stripe |
| Revenue MRR + one-shot | Stripe |

### Dashboard Admin
- KPIs temps réel
- Liste clients avec statuts
- Alertes (paiements échoués, expirations)
- Actions admin (re-scan, rappel manuel)

---

## 18. GESTION DES ERREURS UX

| Cas | Comportement cible |
|-----|-------------------|
| URL inexistante (404) | "Ce site n'est pas accessible. Vérifiez l'URL." |
| URL redirige (301/302) | "J'ai été redirigé vers {url_finale}" |
| Site très lent (>10s) | "Votre site met du temps à répondre..." |
| Site en maintenance | "Votre site semble en maintenance." |
| Site derrière auth | "Le contenu est protégé. Diagnostic basé sur le questionnaire." |
| Quitte en plein questionnaire | Reprise via analysis_id (localStorage) |
| Double paiement | Vérifier paiement actif avant session Stripe |

---

## 19. CONFORMITÉ LÉGALE

### Pages existantes (incomplètes)

| Page | État |
|------|------|
| `app/confidentialite/page.tsx` | ⚠️ RGPD basique, pas de cookies/sous-traitants/rétention |
| `app/mentions/page.tsx` | ⚠️ Pas de responsable publication, pas d'hébergeur |

### À compléter
- **Confidentialité** : données collectées, base légale, durée conservation, droit suppression, sous-traitants (Stripe, Gemini, Firebase, Resend, Vercel), cookies
- **Mentions légales** : responsable publication, hébergeur (Vercel), IDE
- **CGV** (à créer) : propriété fichiers ASR, durées, remboursement

---

## 20. COMPOSANTS UI

### AyoChat.tsx

| Problème | Sévérité | Action |
|----------|----------|--------|
| Types `any[]` | Moyenne | Interfaces typées |
| Markdown non-sanitisé (XSS) | **HAUTE** | DOMPurify |
| Pas de timeout API | Moyenne | AbortController 30s |
| Pas de gestion erreur réseau | Moyenne | Retry + backoff |

### PaymentHandler + PaymentSuccessModal

**Problème critique** : double appel webhook.

**Fix** : Fusionner en 1 composant. Détecter le pack par price_id (pas montant). Valider session_id (UUID).

---

## 21. MODULES SÉMANTIQUES + ASR CRYPTO

### ayo-semantics.ts (132 lignes)
- **Agent cible** : ARCHITECTE
- Fix : unifier env var Gemini, validation JSON, timeout 30s

### external-context.ts (64 lignes)
- **Agent cible** : ARCHITECTE
- Fix : supprimer fake rating 4.5, corriger permissions

### ASR Crypto (asr-emit-mode.ts, asr-seal-spec.ts, asr-compliance-test.ts)
- **PSEUDO-CODE** — pas implémenté
- La vraie signature Ed25519 est dans `lib/ayo-crypto.ts`
- Renommer en `.SPEC.ts` ou ajouter banner

---

## 22. SEO, SITEMAP, ROBOTS

### robots.ts
```
Allow: /
Disallow: /admin/
Disallow: /api/
Disallow: /private/
Disallow: /debug/
Sitemap: https://www.ai-visionary.com/sitemap.xml
```

### sitemap.ts
- **BUG** : `getAllEntityIds()` retourne 2 IDs hardcodées (MOCK)
- Fix : requête Firestore réelle + toutes les pages statiques

### SEO Metadata
Pages sans metadata : `/diagnostic`, `/ai-et-votre-entreprise`, `/aya`, `/aya/e/[id]`

### JSON-LD
- Registre : `ItemList`
- Certificat : `Organization`
- Homepage : `WebSite` + `Organization`

---

## 23. HOMEPAGE + PAGES MARKETING

### Homepage (`app/page.tsx`, 320 lignes)
- 9 sections existantes
- Inline styles → migrer vers Tailwind
- Pas de SEO metadata

### Page marketing (`app/ai-et-votre-entreprise/page.tsx`, 179 lignes)
- Bon contenu, inline styles, pas de SEO

### Page diagnostic (`app/diagnostic/page.tsx`, 36 lignes)
- Layout simple + AyoChat, pas de SEO

---

## 24. ORDRE D'EXÉCUTION (Sprints)

### Sprint 0 — Architecture Multi-Agents (FONDATION) ⭐ NOUVEAU

**Objectif** : Éclater `chat/route.ts` (2800 lignes) en 7 fichiers agents.

| # | Tâche | Fichier(s) |
|---|-------|-----------|
| 0.1 | Créer `lib/agents/ayo-router.ts` — machine à états | Nouveau |
| 0.2 | Créer `lib/agents/scanner.ts` — wrapper aio-scanner.ts | Nouveau |
| 0.3 | Créer `lib/agents/greffier.ts` — prompt questionnaire | Nouveau |
| 0.4 | Créer `lib/agents/analyste.ts` — wrapper score-engine + validation sémantique | Nouveau |
| 0.5 | Créer `lib/agents/vendeur.ts` — tunnel Stripe | Nouveau |
| 0.6 | Créer `lib/agents/architecte.ts` — wrapper generators + crypto | Nouveau |
| 0.7 | Créer `lib/agents/controle-qualite.ts` — validation fichiers | Nouveau |
| 0.8 | Réécrire `app/api/chat/route.ts` pour utiliser les agents | Modifié |
| 0.9 | Tests unitaires par agent | Nouveaux |

### Sprint 1 — Scoring + Questionnaire (URGENT)

| # | Tâche | Agent concerné |
|---|-------|---------------|
| 1.1 | Supprimer "SET q=1" du prompt d'extraction | ANALYSTE |
| 1.2 | Implémenter la validation sémantique (négation/vague/hostile) | ANALYSTE |
| 1.3 | Hard cap transparent (raw_total + cap_reason) | ANALYSTE |
| 1.4 | Questionnaire universel dans le prompt GREFFIER | GREFFIER |
| 1.5 | Bloc 7 (Socle Technique) = 0 questions, 100% scan | SCANNER |
| 1.6 | ASR = AI Singular Record PARTOUT | TOUS |

### Sprint 2 — Persistence + Tunnel (CRITIQUE)

| # | Tâche | Agent concerné |
|---|-------|---------------|
| 2.1 | Persister chaque réponse immédiatement dans Firestore | GREFFIER |
| 2.2 | Persister l'email dès capture | AYO Routeur |
| 2.3 | Encoder `analysis_id` dans `client_reference_id` Stripe | VENDEUR |
| 2.4 | Refuser génération si données absentes (log CRITICAL) | VENDEUR |

### Sprint 3 — Sécurité

| # | Tâche |
|---|-------|
| 3.1 | Anti-SSRF dans le SCANNER |
| 3.2 | Rate limiting toutes les routes |
| 3.3 | Validation Zod toutes les routes |
| 3.4 | Protéger debug endpoints |
| 3.5 | Masquer `e.message` |
| 3.6 | `SESSION_SECRET` dédié |
| 3.7 | CSP header |
| 3.8 | `ignoreBuildErrors: false` |

### Sprint 4 — Qualité fichiers PRO

| # | Tâche | Agent concerné |
|---|-------|---------------|
| 4.1 | Implémenter le CONTRÔLE QC complet | CONTRÔLE QC |
| 4.2 | Boucle ARCHITECTE → QC → correction → retry | ARCHITECTE + QC |
| 4.3 | Supprimer fake data (ratings 4.5) | ARCHITECTE |
| 4.4 | Corriger scanner AYA (`aya_registry` pas `analyses`) | SCANNER |
| 4.5 | Index Firestore | — |
| 4.6 | Supprimer code mort + `@ts-ignore` | — |

### Sprint 5 — Cycle de vie client

| # | Tâche |
|---|-------|
| 5.1 | Champs cycle de vie dans `aya_registry` |
| 5.2 | Webhooks Stripe (payment_failed, subscription.deleted) |
| 5.3 | Cron jobs (rappels MAJ, expiration, désactivation) |
| 5.4 | Page mise à jour client (formulaire pré-rempli) |
| 5.5 | Page renouvellement PRO |
| 5.6 | Config Vercel Cron |

### Sprint 6 — Registre AYA + hébergement

| # | Tâche |
|---|-------|
| 6.1 | Améliorer certificat (JSON-LD, badge, 7 blocs, statut) |
| 6.2 | Améliorer registre (pagination, filtres, tri) |
| 6.3 | API publique registre |
| 6.4 | Hébergement ASR par entité |

### Sprint 7 — Dashboard admin

| # | Tâche |
|---|-------|
| 7.1 | Dashboard KPIs business |
| 7.2 | Liste clients avec statuts |
| 7.3 | Dashboard logs |

### Sprint 8 — Composants UI + UX

| # | Tâche |
|---|-------|
| 8.1 | Fusionner PaymentHandler + PaymentSuccessModal |
| 8.2 | Sanitiser markdown (DOMPurify) |
| 8.3 | Typer strictement les messages chat |
| 8.4 | Cas limites scanner (404, timeout, auth) |
| 8.5 | Reprise de session (localStorage + Firestore) |
| 8.6 | Protection double paiement |

### Sprint 9 — SEO + conformité

| # | Tâche |
|---|-------|
| 9.1 | Fixer robots.ts |
| 9.2 | Fixer sitemap.ts (Firestore, pas mock) |
| 9.3 | Metadata SEO toutes les pages |
| 9.4 | JSON-LD (registre + certificats + homepage) |
| 9.5 | Étoffer confidentialité (RGPD complet) |
| 9.6 | Étoffer mentions légales |
| 9.7 | Créer CGV |
| 9.8 | Supprimer doublon certificat |

### Sprint 10 — Polish + nettoyage

| # | Tâche |
|---|-------|
| 10.1 | Unifier env var Gemini |
| 10.2 | Validation JSON + timeout Gemini |
| 10.3 | Renommer ASR spec files |
| 10.4 | Migrer inline styles → Tailwind |
| 10.5 | Dashboard client (futur, post-MVP) |

---

## RÉSUMÉ FINAL

### Architecture Multi-Agents

| Agent | LLM ? | Fichier | Rôle |
|-------|-------|---------|------|
| AYO (Routeur) | Non | `lib/agents/ayo-router.ts` | Orchestre, parle au client |
| SCANNER | Non | `lib/agents/scanner.ts` | Crawl technique |
| GREFFIER | **Oui** | `lib/agents/greffier.ts` | Questions ciblées |
| ANALYSTE | Non | `lib/agents/analyste.ts` | Score + validation |
| VENDEUR | Non | `lib/agents/vendeur.ts` | Stripe + tunnel |
| ARCHITECTE | **Oui** | `lib/agents/architecte.ts` | Génère 5 fichiers |
| CONTRÔLE QC | Non | `lib/agents/controle-qualite.ts` | Valide avant livraison |

### Chiffres

| Catégorie | Nombre |
|-----------|--------|
| Sprints | **11** (0 à 10) |
| Nouveaux fichiers agents | **7** |
| Fichiers à modifier | **~25** |
| Fichiers à créer (total) | **~22** |
| Failles sécurité restantes | **23** |
| Coût par diagnostic (cible) | **~$0.007** (vs $0.025 aujourd'hui) |

### Ce qui EXISTE et fonctionne
- Moteur de score AIO (→ ANALYSTE)
- Générateurs 5 fichiers (→ ARCHITECTE)
- Signature Ed25519 (→ ARCHITECTE)
- Tunnel Stripe (→ VENDEUR)
- Scanner URL (→ SCANNER)
- Registre AYA public
- Auth OTP
- Logger, rate limiter, validators, sanitizer

### Ce qui est CASSÉ
- 1 fichier de 2800 lignes fait tout (→ 7 agents)
- LLM confond ASR (→ Greffier ne sait pas ce que c'est)
- Scoring LLM non-déterministe (→ Analyste valide)
- Fichiers PRO non validés (→ Contrôle QC)
- Persistence fragile (→ Greffier persiste immédiatement)

### Ce qui MANQUE
- Architecture multi-agents (Sprint 0)
- Cycle de vie client (Sprint 5)
- Dashboard admin (Sprint 7)
- SEO/JSON-LD (Sprint 9)
- CGV/CGU (Sprint 9)
