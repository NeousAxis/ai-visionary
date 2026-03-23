# AI VISIONARY

**Rendez votre entreprise visible et recommandable par les IA.**

AI Visionary est une plateforme SaaS qui permet aux entreprises d'optimiser leur **visibilite aupres des intelligences artificielles** (ChatGPT, Gemini, Claude, Perplexity, Mistral). Grace a un diagnostic automatise et des fichiers structures certifies, les IA peuvent identifier, comprendre et recommander votre entreprise de maniere fiable.

## Le probleme

Les IA generatives (ChatGPT, Gemini, Claude...) recommandent des entreprises aux millions d'utilisateurs qui leur posent des questions. Mais pour etre recommande, il ne suffit pas d'avoir un site web — il faut que l'IA puisse **lire et comprendre** vos donnees de maniere structuree. Sans cela, votre entreprise est invisible pour l'IA, ou pire, mal decrite (hallucinations).

## La solution

AI Visionary cree une **identite semantique certifiee** pour votre entreprise via le protocole **ASR** (AI Singular Record) — un fichier JSON-LD signe cryptographiquement que les IA consultent comme source de verite.

### Comment ca marche

1. **AYO scanne votre site** — detection automatique de 15+ signaux (nom, services, tarifs, certifications...)
2. **Questionnaire intelligent** — AYO pose des questions ciblees pour enrichir les donnees detectees
3. **Score AIO** — un score de 0 a 100 mesure votre lisibilite IA sur 7 blocs ponderes
4. **Fichiers ASR generes** — 5 fichiers structures et signes cryptographiquement (Ed25519)
5. **Registre AYA** — inscription dans le registre public des entites certifiees

### Les 7 blocs du Score AIO

| Bloc | Poids |
|------|-------|
| Identite & Ancrage | /10 |
| Clarte de l'Offre | /20 |
| Processus & Methodes | /15 |
| Confiance & Conformite | /15 |
| Indicateurs & Metriques | /20 |
| Pedagogie & Supports | /10 |
| Socle Technique AIO | /10 |

## Offres

| Pack | Prix | Contenu |
|------|------|---------|
| **Analyse Light** | Gratuit | Diagnostic AIO + score de visibilite IA |
| **Abonnement AYA** | 19 CHF/mois | Inscription au Registre AYA + ASR heberge + mises a jour |
| **Pack PRO** | 499 CHF | 5 fichiers ASR complets + 3 ans de Registre AYA offerts |

### Les 5 fichiers du Pack PRO

| Fichier | Role |
|---------|------|
| `ASR-Protocol.json` | Identite semantique certifiee (JSON-LD signe Ed25519) |
| `manifest.json` | Conditions de recommandation pour les IA |
| `faq.json` | FAQ structuree (Schema.org FAQPage) |
| `glossary.json` | Vocabulaire metier officiel (Schema.org DefinedTermSet) |
| `external_context.json` | Signaux externes, mots-cles et intentions de recherche |

## Concepts cles

| Terme | Definition |
|-------|-----------|
| **AYO** | Le chatbot IA qui realise le diagnostic de visibilite. Utilise Google Gemini comme LLM. |
| **AIO** | Artificial Intelligence Optimization — la discipline d'optimisation de la lisibilite IA. |
| **AIO Score** | Score de 0 a 100 mesurant la lisibilite semantique d'une entite par les IA generatives. |
| **ASR** | AI Singular Record — fichier JSON-LD signe Ed25519, identite numerique de l'entite. |
| **AYA** | Registre public des entites certifiees AYO (AYO Authority Registry). |

## Stack technique

| Technologie | Usage |
|-------------|-------|
| Next.js 16 | Framework fullstack (App Router) |
| React 19 | Frontend |
| TypeScript | Typage |
| Tailwind CSS | Styles |
| Supabase | Base de donnees PostgreSQL |
| Google Gemini | LLM pour le chatbot AYO |
| Stripe | Paiements (CHF) |
| Vercel | Hosting + serverless |
| TweetNaCl | Signature Ed25519 pour ASR |
| Resend | Emails transactionnels |

## Architecture

```
app/
  api/
    chat/route.ts          # Coeur — chatbot AYO (questionnaire + scoring)
    webhooks/               # Stripe webhook post-paiement
    create-checkout/        # Creation session Stripe
  diagnostic/page.tsx       # Page chat AYO
  aya/page.tsx              # Registre AYA public
  aya/e/[id]/page.tsx       # Certificat AYA individuel

lib/
  aio-score-engine.ts       # Moteur de score deterministe (7 blocs)
  aio-scanner.ts            # Scanner URL (HTML, JSON-LD, ASR, AYA)
  ayo-crypto.ts             # Signature Ed25519 + generation ASR
  ayo-generators.ts         # Generateurs des 5 fichiers Pack PRO
  db.ts                     # Operations Supabase
  agents/
    greffier.ts             # Templates de questions statiques
    scanner.ts              # Agent de scan web

aya/
  generator.py              # Pipeline d'import d'entites dans AYA
  scraper.py                # Scraper de sites web
```

## Developpement

```bash
# Installation
npm install

# Serveur local
npm run dev

# Build production
npm run build

# Deploiement
vercel --prod
```

### Variables d'environnement requises

```
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
GOOGLE_GENERATIVE_AI_API_KEY
STRIPE_SECRET_KEY
STRIPE_WEBHOOK_SECRET
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
RESEND_API_KEY
ADMIN_SECRET
AYO_SIGNING_KEY
NEXT_PUBLIC_BASE_URL
```

## Liens

- **Site** : [ai-visionary.com](https://www.ai-visionary.com)
- **Diagnostic gratuit** : [ai-visionary.com/diagnostic](https://www.ai-visionary.com/diagnostic)
- **Registre AYA** : [ai-visionary.com/aya](https://www.ai-visionary.com/aya)

---

Basee a Geneve, Suisse | Fondee par Cyril Leger | 2026
