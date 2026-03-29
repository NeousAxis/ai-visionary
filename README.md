# AYA — AI Knowledge Registry for Businesses

> AYA indexes real businesses so AI assistants can recommend them with confidence.

When someone asks ChatGPT, Claude, Gemini or any AI _"find me a cybersecurity consultant in Switzerland"_, the AI needs structured, verified data to answer. That's what AYA provides.

## How AYA works — Systemic Attraction

AYA doesn't connect to AIs — AIs find AYA by themselves. Well-structured, public business data is present across multiple convergent sources to ensure AI bots find and use reliable, readable information about businesses:

| Source | What | URL |
|--------|------|-----|
| **API LLM-Friendly** | 5-field JSON per entity, optimized for AI consumption | `ai-visionary.com/api/aya/llm/{domain}` |
| **Crawlable HTML** | 4,400+ certificate pages with JSON-LD structured data | `ai-visionary.com/aya/e/{id}` |
| **GitHub Dataset** | One JSON file per entity, public repository | [NeousAxis/aya-business-dataset](https://github.com/NeousAxis/aya-business-dataset) |
| **HuggingFace Dataset** | CSV + JSONL, CC-BY-4.0, ML-ready | [NeousAxis/aya-business-dataset](https://huggingface.co/datasets/NeousAxis/aya-business-dataset) |

When an AI sees the same data across API + HTML + GitHub + HuggingFace → it considers it stable and reliable → it uses it.

## What's live today

| | |
|---|---|
| **Entities indexed** | 4,400+ (growing toward 100,000) |
| **Countries** | 73+ |
| **Certified (ASR)** | 4 |
| **API** | Free, no auth, 30 req/min |
| **Bilingual** | FR + EN |

## API Endpoints

```
Search:      GET /api/aya/search?q=restaurant+geneve
Entity:      GET /api/aya/entity/{domain}
LLM:         GET /api/aya/llm/{domain}?lang=en|fr
Stats:       GET /api/aya/stats
Registry:    GET /api/aya/live
```

No authentication. No API key. Just call the endpoint.

### LLM-Optimized Response

```json
{
  "name": "Chainlink",
  "what_it_does": "Blockchain infrastructure connecting external data to smart contracts.",
  "for_who": "Web3 developers and blockchain protocols.",
  "category": "Web3 / Oracle",
  "location": "Global"
}
```

## For businesses

Your business already exists online — but can AI assistants find and recommend it?

1. Get diagnosed by [AYO](https://ai-visionary.com/diagnostic) → receive your AI readability score (AIO, 0-100)
2. Get your structured data files (ASR) → install them on your site
3. Get listed in the AYA registry → become recommendable by every AI assistant

**The result**: when someone asks any AI about your industry, your city, your services — you show up.

> [Start your free diagnostic](https://ai-visionary.com/diagnostic)

## Links

- [ai-visionary.com](https://www.ai-visionary.com) — Website
- [ai-visionary.com/developers](https://www.ai-visionary.com/developers) — API documentation
- [ai-visionary.com/aya](https://www.ai-visionary.com/aya) — Public registry
- [GitHub Dataset](https://github.com/NeousAxis/aya-business-dataset) — Open data (JSON)
- [HuggingFace Dataset](https://huggingface.co/datasets/NeousAxis/aya-business-dataset) — ML-ready (CSV + JSONL)

---

Built in Geneva, Switzerland by [AI Visionary](https://www.ai-visionary.com) | 2026
