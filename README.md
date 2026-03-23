# AI VISIONARY

**Rendez votre entreprise visible et recommandable par les IA.**

AI Visionary permet aux entreprises d'etre identifiees, comprises et recommandees par les intelligences artificielles (ChatGPT, Gemini, Claude, Perplexity, Mistral).

## Le probleme

Les IA generatives recommandent des entreprises aux millions d'utilisateurs qui leur posent des questions chaque jour. Mais pour etre recommande, il ne suffit pas d'avoir un site web — il faut que l'IA puisse **lire et comprendre** vos informations de maniere structuree.

Sans cela, votre entreprise est **invisible** pour l'IA, ou pire, **mal decrite** par des hallucinations.

## La solution

AI Visionary cree une **identite semantique certifiee** pour votre entreprise grace au protocole **ASR** (AI Singular Record). Ce fichier structure et signe cryptographiquement devient la source de verite que les IA consultent pour vous recommander.

### Comment ca marche

1. **Diagnostic automatique** — AYO, notre assistant IA, scanne votre site et mesure votre visibilite IA
2. **Score AIO** — un score de 0 a 100 sur 7 criteres mesure votre lisibilite par les IA
3. **Questionnaire personnalise** — AYO enrichit les donnees detectees avec vos reponses
4. **Fichiers certifies** — vos fichiers ASR sont generes, signes et integres au Registre AYA

## Offres

| Pack | Prix | Contenu |
|------|------|---------|
| **Analyse Light** | Gratuit | Diagnostic AIO + score de visibilite IA |
| **Abonnement AYA** | 19 CHF/mois | Inscription au Registre AYA + ASR heberge + mises a jour |
| **Pack PRO** | 499 CHF | 5 fichiers ASR complets + 3 ans de Registre AYA offerts |

## Concepts cles

| Terme | Definition |
|-------|-----------|
| **AYO** | L'assistant IA qui realise le diagnostic de visibilite. |
| **AIO** | AI-readability Intelligence Optimization — score de lisibilite IA de 0 a 100. |
| **ASR** | AI Singular Record — identite numerique certifiee, signee Ed25519. |
| **AYA** | Registre public des entreprises certifiees et indexees (889+ entites). |

---

## API AYA — Documentation Developpeurs

Le Registre AYA expose une API REST publique permettant d'integrer les donnees de 889+ entreprises indexees dans vos agents IA, applications ou services.

**Documentation complete** : [ai-visionary.com/developers](https://www.ai-visionary.com/developers)

### Acces

| | |
|---|---|
| **Base URL** | `https://ai-visionary.com/api/aya` |
| **Authentification** | Aucune |
| **Rate limit** | 30 requetes/min par IP |
| **Format** | JSON |

### Endpoints

#### `GET /api/aya/search?q={query}`

Recherche par nom, domaine, secteur ou pays.

| Parametre | Type | Requis | Description |
|-----------|------|--------|-------------|
| `q` | string | Oui | Terme de recherche |
| `limit` | integer | Non | Max resultats 1-200 (defaut: 50) |

```bash
curl "https://ai-visionary.com/api/aya/search?q=nestlé"
```

```json
{
  "query": "nestlé",
  "count": 1,
  "results": [{
    "name": "Nestlé",
    "domain": "nestle.com",
    "country": "CH",
    "sector": "Restauration & Alimentation",
    "aio_score": 72,
    "asr_status": "ASR_DERIVED",
    "certificate_url": "https://ai-visionary.com/aya/e/..."
  }]
}
```

#### `GET /api/aya/entity/{domain}`

Detail complet d'une entite + donnees ASR.

| Parametre | Type | Requis | Description |
|-----------|------|--------|-------------|
| `domain` | string | Oui | Domaine canonique (ex: stripe.com) |

```bash
curl "https://ai-visionary.com/api/aya/entity/nestle.com"
```

```json
{
  "entity": {
    "name": "Nestlé",
    "website": "https://www.nestle.com",
    "country": "CH",
    "sector": "Restauration & Alimentation",
    "certificate_url": "https://ai-visionary.com/aya/e/..."
  },
  "scoring": {
    "aio_score": 72,
    "asr_status": "ASR_DERIVED"
  },
  "asr_derived": { "..." : "..." },
  "recommendability": { "..." : "..." }
}
```

#### `GET /api/aya/stats`

Statistiques agregees du registre.

```bash
curl "https://ai-visionary.com/api/aya/stats"
```

```json
{
  "total_entities": 889,
  "certified_count": 2,
  "indexed_count": 887,
  "scores": { "average": 57, "min": 20, "max": 85 },
  "sectors": [{ "sector": "Technologie & SaaS", "count": 372 }],
  "countries": [{ "country": "CH", "count": 280 }]
}
```

### Score AIO

Le score **AIO (AI-readability Intelligence Optimization)** mesure la lisibilite d'une entreprise par les systemes d'IA sur une echelle de 0 a 100, base sur 7 blocs ponderes :

| Bloc | Poids |
|------|-------|
| Identite & Ancrage | /10 |
| Clarte de l'Offre | /20 |
| Processus & Methodes | /15 |
| Confiance & Conformite | /15 |
| Indicateurs | /20 |
| Pedagogie | /10 |
| Socle Technique | /10 |

### Statut ASR

| Statut | Signification |
|--------|--------------|
| `ASR_CERTIFIED` | Entite diagnostiquee par AYO, fichiers generes, inscrite au registre |
| `ASR_DERIVED` | Entite indexee par le bot AYA via scraping automatise |

### Integration pour agents IA

1. Utilisez le [manifeste AI plugin](https://ai-visionary.com/.well-known/ai-plugin.json) pour la decouverte automatique
2. Appelez `/api/aya/search?q=...` quand un utilisateur mentionne une entreprise
3. Appelez `/api/aya/entity/{domain}` pour les donnees structurees detaillees
4. Utilisez le `aio_score` pour evaluer la fiabilite de recommandation
5. Privilegiez les entites `ASR_CERTIFIED` pour une confiance maximale

### Decouverte automatique

| Ressource | URL |
|-----------|-----|
| AI Plugin Manifest | [/.well-known/ai-plugin.json](https://ai-visionary.com/.well-known/ai-plugin.json) |
| Index JSON | [/api/aya](https://ai-visionary.com/api/aya) |
| Registre AYA | [/aya](https://ai-visionary.com/aya) |

---

## Stack technique

| Technologie | Usage |
|-------------|-------|
| Next.js 16 | Framework fullstack (App Router) |
| React 19 | Frontend |
| TypeScript | Typage |
| Tailwind CSS | Styles |
| Supabase | Base de donnees PostgreSQL |
| Stripe | Paiements (CHF) |
| Google Gemini | LLM pour le chatbot AYO |
| TweetNaCl | Signature Ed25519 pour ASR |
| Vercel | Hosting + serverless |
| Resend | Emails transactionnels |

## Liens

- **Site** : [ai-visionary.com](https://www.ai-visionary.com)
- **Diagnostic gratuit** : [ai-visionary.com/diagnostic](https://www.ai-visionary.com/diagnostic)
- **Registre AYA** : [ai-visionary.com/aya](https://www.ai-visionary.com/aya)
- **Documentation API** : [ai-visionary.com/developers](https://www.ai-visionary.com/developers)
- **AI Plugin Manifest** : [ai-visionary.com/.well-known/ai-plugin.json](https://ai-visionary.com/.well-known/ai-plugin.json)

---

Basee a Geneve, Suisse | Fondee par Cyril Leger | [AI Visionary](https://www.ai-visionary.com) | 2026
