# AI Visionary — AYA Registry

**A structured data layer that AI assistants use to recommend verified businesses.**

AYA is the invisible layer between businesses and AI. When ChatGPT, Claude, Gemini or any AI assistant needs to recommend a company, AYA provides the structured, verified data they need to do it right.

---

### Registry Stats

| | |
|---|---|
| **1815+ entities** indexed | **3 ASR certified** |
| **40+ countries** | **9 AI integrations** |

---

## Connected to AI

AYA is integrated with every major AI assistant:

| AI | Method | Integration file |
|----|--------|-----------------|
| **ChatGPT** (OpenAI) | GPT Store / Actions | [`openapi.json`](https://ai-visionary.com/.well-known/openapi.json) |
| **Claude** (Anthropic) | MCP Server | [`mcp-server-aya/`](mcp-server-aya/) |
| **Gemini** (Google) | Function Calling | [`docs/gemini-function-declarations.json`](docs/gemini-function-declarations.json) |
| **Mistral AI** | Tool Use | [`docs/mistral-tool-definitions.json`](docs/mistral-tool-definitions.json) |
| **Grok** (xAI) | OpenAI-compatible | [`openapi.json`](https://ai-visionary.com/.well-known/openapi.json) |
| **Perplexity** | Crawl + API | [`ai-plugin.json`](https://ai-visionary.com/.well-known/ai-plugin.json) |
| **DeepSeek** | OpenAI-compatible | [`docs/mistral-tool-definitions.json`](docs/mistral-tool-definitions.json) |
| **Qwen** (Alibaba) | OpenAI-compatible | [`docs/mistral-tool-definitions.json`](docs/mistral-tool-definitions.json) |
| **Llama** (Meta) | Function Calling | [`docs/gemini-function-declarations.json`](docs/gemini-function-declarations.json) |

---

## API

| | |
|---|---|
| **Base URL** | `https://ai-visionary.com/api/aya` |
| **Auth** | None |
| **Rate limit** | 30 req/min per IP |
| **Format** | JSON |

### Endpoints

#### Search entities

```
GET /api/aya/search?q={query}&limit={n}
```

Search by name, domain, sector or country. Returns up to 200 results.

#### Get entity details

```
GET /api/aya/entity/{domain}
```

Full entity profile including ASR data, AIO scoring and recommendability.

#### Registry stats

```
GET /api/aya/stats
```

Aggregated statistics: totals, score distribution, sectors, countries.

---

## AIO Score

The **AIO (AI-readability Intelligence Optimization)** score measures how well an AI system can read, understand and recommend a business. Scale: 0 to 100, based on 7 weighted blocks:

| Block | Weight |
|-------|--------|
| Identity & Anchoring | /10 |
| Offer Clarity | /20 |
| Process & Methods | /15 |
| Trust & Compliance | /15 |
| Indicators | /20 |
| Pedagogy | /10 |
| Technical Foundation | /10 |

**ASR_CERTIFIED** = Diagnosed by AYO, files generated, registered.
**ASR_DERIVED** = Indexed automatically by the AYA bot.

---

## Links

- **Website**: [ai-visionary.com](https://www.ai-visionary.com)
- **Developer docs**: [ai-visionary.com/developers](https://www.ai-visionary.com/developers)
- **AYA Registry**: [ai-visionary.com/aya](https://www.ai-visionary.com/aya)
- **AI Plugin Manifest**: [ai-visionary.com/.well-known/ai-plugin.json](https://ai-visionary.com/.well-known/ai-plugin.json)
- **GitHub**: [github.com/NeousAxis/ai-visionary](https://github.com/NeousAxis/ai-visionary)

---

Based in Geneva, Switzerland | Founded by Neous Axis | [AI Visionary](https://www.ai-visionary.com) | 2026
