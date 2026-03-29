# AYA — The AI Knowledge Layer for Businesses

> AYA indexes real businesses so AI assistants can recommend them with confidence.

When someone asks ChatGPT, Claude, Gemini or any AI _"find me a cybersecurity consultant in Switzerland"_, the AI needs structured, verified data to answer. That's what AYA provides.

## How it works

```
User asks AI a question about a business
        ↓
AI crawls the web → finds AYA data (JSON-LD on 3000+ pages)
        ↓
AI returns verified, structured recommendations
```

Every entity page on AYA embeds **JSON-LD structured data** — the standard format that AI systems read when they crawl the web. This makes AYA a systemic attraction layer: data is present across so many convergent sources (API, HTML pages, GitHub, HuggingFace) that AI assistants inevitably find and use it, without any manual integration.

## What's live today

| | |
|---|---|
| **Entities indexed** | 1,800+ (growing to 5,000+) |
| **Countries** | 40+ |
| **Certified (ASR)** | 3 |
| **API** | Free, no auth, 30 req/min |
| **JSON-LD pages** | 1,800+ (crawlable by any AI) |

## Connected to 9 AI assistants

| AI | Method | Integration |
|----|--------|-------------|
| **ChatGPT** (OpenAI) | GPT Store + Actions | [`openapi.json`](https://ai-visionary.com/.well-known/openapi.json) |
| **Claude** (Anthropic) | MCP Server | [`mcp-server-aya/`](mcp-server-aya/) |
| **Gemini** (Google) | Function Calling | [`docs/gemini-function-declarations.json`](docs/gemini-function-declarations.json) |
| **Mistral AI** | Tool Use | [`docs/mistral-tool-definitions.json`](docs/mistral-tool-definitions.json) |
| **Grok** (xAI) | OpenAI-compatible | [`openapi.json`](https://ai-visionary.com/.well-known/openapi.json) |
| **Perplexity** | Web crawl + API | [`ai-plugin.json`](https://ai-visionary.com/.well-known/ai-plugin.json) |
| **DeepSeek** | OpenAI-compatible | [`docs/mistral-tool-definitions.json`](docs/mistral-tool-definitions.json) |
| **Qwen** (Alibaba) | OpenAI-compatible | [`docs/mistral-tool-definitions.json`](docs/mistral-tool-definitions.json) |
| **Llama** (Meta) | Function Calling | [`docs/gemini-function-declarations.json`](docs/gemini-function-declarations.json) |

## For AI agents

```
Discovery:   /.well-known/ai-plugin.json
OpenAPI:     /.well-known/openapi.json
Search:      GET /api/aya/search?q=restaurant+geneve
Entity:      GET /api/aya/entity/{domain}
Stats:       GET /api/aya/stats
MCP Server:  mcp-server-aya/
```

No authentication. No API key. Just call the endpoint.

## For businesses

Your business already exists online — but can AI assistants find and recommend it?

1. Get diagnosed by [AYO](https://ai-visionary.com/diagnostic) → receive your AI readability score
2. Get your structured data files (ASR) → install them on your site
3. Get listed in the AYA registry → become recommendable by every AI assistant

**The result**: when someone asks any AI about your industry, your city, your services — you show up.

→ [Start your free diagnostic](https://ai-visionary.com/diagnostic)

## Links

- [ai-visionary.com](https://www.ai-visionary.com) — Website
- [ai-visionary.com/developers](https://www.ai-visionary.com/developers) — API documentation
- [ai-visionary.com/aya](https://www.ai-visionary.com/aya) — Public registry
- [ChatGPT GPT](https://chatgpt.com/g/g-69c2588b04588191b9c410e299f0d2d1-aya-registre-ia-des-entreprises) — AYA on ChatGPT

---

Built in Geneva, Switzerland by Neous Axis | [AI Visionary](https://www.ai-visionary.com) | 2026
