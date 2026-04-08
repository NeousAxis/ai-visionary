# AYA API Integration Guide for Google Gemini

> Use the AYA registry API with Gemini function calling to let your AI application search companies, retrieve AI readability scores, and access structured business data.

## Overview

**AYA** is a public index of organizations rated for AI readability. Each entity has an **AIO score** (0-100) measuring how well its website's structured data can be understood by AI systems. Higher scores mean AI agents can more reliably recommend and describe the entity.

- **Base URL**: `https://ai-visionary.xyz/api/aya`
- **Authentication**: None required (public API)
- **Rate limit**: 30 requests/minute per IP

## Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/aya/search?q={query}&limit={n}` | GET | Search entities by name, domain, sector, or country |
| `/api/aya/entity/{domain}` | GET | Get full details for a specific entity |
| `/api/aya/stats` | GET | Get aggregate index statistics |

## Function Declarations

Paste these declarations into `genai.GenerativeModel(tools=...)` or your Vertex AI tool config.

```json
[
  {
    "name": "search_aya_companies",
    "description": "Search the AYA registry for companies by name, domain, sector or country. AYA is a public index of organizations rated for AI readability (AIO score 0-100). Returns matching entities with their AIO scores, sectors, countries, and certification status. Use this when a user asks about companies, wants to find businesses in a specific sector or country, or wants to check AI readability ratings.",
    "parameters": {
      "type": "object",
      "properties": {
        "query": {
          "type": "string",
          "description": "Search term: company name (e.g. 'Nestle'), domain (e.g. 'adobe.com'), sector (e.g. 'technology'), or country (e.g. 'Switzerland'). Case-insensitive, partial match supported."
        },
        "limit": {
          "type": "integer",
          "description": "Maximum number of results to return (1-200). Default: 50."
        }
      },
      "required": ["query"]
    }
  },
  {
    "name": "get_aya_entity",
    "description": "Get detailed information about a specific company from the AYA registry by its domain name. Returns full entity details including identity, AIO scoring breakdown (7 blocks), ASR derived structured data (services, compliance, indicators), and recommendability signals. Use this when a user wants in-depth AI readability information about one specific company.",
    "parameters": {
      "type": "object",
      "properties": {
        "domain": {
          "type": "string",
          "description": "Canonical domain of the entity (e.g. 'adobe.com', 'nestle.com'). Do not include 'www.' or 'https://'."
        }
      },
      "required": ["domain"]
    }
  },
  {
    "name": "get_aya_stats",
    "description": "Get aggregate statistics about the AYA registry: total number of indexed entities, certified vs bot-indexed breakdown, AIO score distribution (average, min, max, median), and breakdowns by sector and country. Use this to provide context about the overall index or when comparing a company's score to the average.",
    "parameters": {
      "type": "object",
      "properties": {}
    }
  }
]
```

## Python Example with google-generativeai SDK

### Setup

```bash
pip install google-generativeai requests
```

### Full Working Example

```python
import google.generativeai as genai
import requests
import json

# Configure Gemini
genai.configure(api_key="YOUR_GEMINI_API_KEY")

# ── AYA API helper ──────────────────────────────────────────────
AYA_BASE = "https://ai-visionary.xyz/api/aya"

def call_aya_api(function_name: str, args: dict) -> dict:
    """Route a Gemini function call to the correct AYA endpoint."""
    if function_name == "search_aya_companies":
        params = {"q": args["query"]}
        if "limit" in args:
            params["limit"] = args["limit"]
        resp = requests.get(f"{AYA_BASE}/search", params=params, timeout=10)

    elif function_name == "get_aya_entity":
        domain = args["domain"]
        resp = requests.get(f"{AYA_BASE}/entity/{domain}", timeout=10)

    elif function_name == "get_aya_stats":
        resp = requests.get(f"{AYA_BASE}/stats", timeout=10)

    else:
        return {"error": f"Unknown function: {function_name}"}

    resp.raise_for_status()
    return resp.json()


# ── Define tools for Gemini ─────────────────────────────────────
search_tool = genai.protos.Tool(
    function_declarations=[
        genai.protos.FunctionDeclaration(
            name="search_aya_companies",
            description=(
                "Search the AYA registry for companies by name, domain, sector "
                "or country. Returns AI readability scores and structured data."
            ),
            parameters=genai.protos.Schema(
                type=genai.protos.Type.OBJECT,
                properties={
                    "query": genai.protos.Schema(
                        type=genai.protos.Type.STRING,
                        description="Search term (company name, domain, sector, or country)",
                    ),
                    "limit": genai.protos.Schema(
                        type=genai.protos.Type.INTEGER,
                        description="Max results 1-200, default 50",
                    ),
                },
                required=["query"],
            ),
        ),
        genai.protos.FunctionDeclaration(
            name="get_aya_entity",
            description=(
                "Get detailed AI readability information about a specific "
                "company by domain name."
            ),
            parameters=genai.protos.Schema(
                type=genai.protos.Type.OBJECT,
                properties={
                    "domain": genai.protos.Schema(
                        type=genai.protos.Type.STRING,
                        description="Domain (e.g. 'adobe.com'). No www or https.",
                    ),
                },
                required=["domain"],
            ),
        ),
        genai.protos.FunctionDeclaration(
            name="get_aya_stats",
            description=(
                "Get aggregate statistics about the AYA registry: total "
                "entities, score distribution, sector and country breakdowns."
            ),
            parameters=genai.protos.Schema(
                type=genai.protos.Type.OBJECT,
                properties={},
            ),
        ),
    ]
)

# ── Create model with tools ─────────────────────────────────────
model = genai.GenerativeModel(
    "gemini-2.0-flash",
    tools=[search_tool],
    system_instruction=(
        "You have access to the AYA registry, a public index of companies "
        "rated for AI readability (AIO score 0-100). Use the provided "
        "functions to look up companies and answer questions about their "
        "AI readability. Always cite the AIO score when discussing a company."
    ),
)

# ── Chat loop with automatic function calling ───────────────────
chat = model.start_chat()

user_message = "What companies in Switzerland have high AI readability?"
print(f"User: {user_message}\n")

response = chat.send_message(user_message)

# Handle function calls (may require multiple rounds)
while response.candidates[0].content.parts:
    part = response.candidates[0].content.parts[0]

    # If it's a function call, execute it and send result back
    if part.function_call:
        fc = part.function_call
        print(f"  [Gemini calls {fc.name}({dict(fc.args)})]")

        api_result = call_aya_api(fc.name, dict(fc.args))

        response = chat.send_message(
            genai.protos.Content(
                parts=[
                    genai.protos.Part(
                        function_response=genai.protos.FunctionResponse(
                            name=fc.name,
                            response={"result": api_result},
                        )
                    )
                ]
            )
        )
    else:
        # Final text response
        print(f"Gemini: {part.text}")
        break
```

### Expected Output

```
User: What companies in Switzerland have high AI readability?

  [Gemini calls search_aya_companies({'query': 'Switzerland', 'limit': 10})]

Gemini: Here are some Swiss companies with notable AI readability scores
from the AYA registry:

1. **Nestle** (nestle.com) - AIO Score: 48 | Sector: Food & Beverage
2. **Rolex** (rolex.com) - AIO Score: 45 | Sector: Retail
3. **UBS** (ubs.com) - AIO Score: 42 | Sector: Finance
...

The average AIO score across the index is around 35, so these companies
are above average in how well AI systems can understand their websites.
```

## Vertex AI (Google Cloud) Example

For production deployments on Vertex AI, use the same function declarations with the Vertex SDK:

```python
from vertexai.generative_models import (
    GenerativeModel,
    FunctionDeclaration,
    Tool,
)

search_fn = FunctionDeclaration(
    name="search_aya_companies",
    description="Search the AYA registry for companies by name, domain, sector or country.",
    parameters={
        "type": "object",
        "properties": {
            "query": {
                "type": "string",
                "description": "Search term (company name, domain, sector, or country)",
            },
            "limit": {
                "type": "integer",
                "description": "Max results 1-200, default 50",
            },
        },
        "required": ["query"],
    },
)

entity_fn = FunctionDeclaration(
    name="get_aya_entity",
    description="Get detailed AI readability information about a specific company by domain.",
    parameters={
        "type": "object",
        "properties": {
            "domain": {
                "type": "string",
                "description": "Domain name (e.g. 'adobe.com'). No www or https.",
            },
        },
        "required": ["domain"],
    },
)

stats_fn = FunctionDeclaration(
    name="get_aya_stats",
    description="Get aggregate statistics about the AYA registry.",
    parameters={"type": "object", "properties": {}},
)

aya_tool = Tool(function_declarations=[search_fn, entity_fn, stats_fn])

model = GenerativeModel("gemini-2.0-flash", tools=[aya_tool])
chat = model.start_chat()

# Then use the same call_aya_api() function from above to handle responses
```

## Response Schemas

### Search Response (`search_aya_companies`)

```json
{
  "query": "Switzerland",
  "count": 42,
  "results": [
    {
      "name": "Nestle",
      "domain": "nestle.com",
      "website": "https://www.nestle.com",
      "country": "CH",
      "sector": "food_bev",
      "aio_score": 48,
      "asr_status": "ASR_DERIVED",
      "entity_type": "company",
      "entity_id": "aya-nestle-com",
      "certificate_url": "https://ai-visionary.xyz/aya/e/aya-nestle-com"
    }
  ]
}
```

### Entity Response (`get_aya_entity`)

```json
{
  "entity": {
    "name": "Nestle",
    "domain": "nestle.com",
    "website": "https://www.nestle.com",
    "country": "CH",
    "sector": "food_bev",
    "entity_type": "company",
    "contact_email": "info@nestle.com",
    "entity_id": "aya-nestle-com",
    "certificate_url": "https://ai-visionary.xyz/aya/e/aya-nestle-com"
  },
  "scoring": {
    "aio_score": 48,
    "asr_status": "ASR_DERIVED",
    "data_origin": "AYA-BOT"
  },
  "asr_derived": { "..." : "full structured data" },
  "recommendability": { "..." : "recommendability signals" }
}
```

### Stats Response (`get_aya_stats`)

```json
{
  "total_entities": 889,
  "certified_count": 3,
  "indexed_count": 886,
  "scores": { "average": 35, "min": 20, "max": 78, "median": 33 },
  "sectors": [
    { "sector": "technology", "count": 187 },
    { "sector": "finance", "count": 124 }
  ],
  "countries": [
    { "country": "CH", "count": 312 },
    { "country": "US", "count": 156 }
  ],
  "last_updated": "2026-03-24T12:00:00Z"
}
```

## Use Cases

| User Question | Function to Call |
|---------------|-----------------|
| "What's the AI readability of adobe.com?" | `get_aya_entity(domain="adobe.com")` |
| "Find tech companies in France" | `search_aya_companies(query="France technology")` |
| "Which Swiss banks are AI-ready?" | `search_aya_companies(query="Switzerland finance")` |
| "How many companies are in the registry?" | `get_aya_stats()` |
| "Compare Nestle and Rolex AI scores" | `get_aya_entity` twice, one per domain |

## Error Handling

| HTTP Status | Meaning | Action |
|-------------|---------|--------|
| 200 | Success | Parse JSON response |
| 400 | Missing/invalid parameter | Check query or domain format |
| 404 | Entity not found | Domain is not in the AYA index |
| 429 | Rate limit exceeded | Wait and retry (30 req/min) |
| 500 | Server error | Retry after a short delay |

## Links

- **API Index**: https://ai-visionary.xyz/api/aya
- **OpenAPI Spec**: https://ai-visionary.xyz/.well-known/openapi.json
- **AI Plugin Manifest**: https://ai-visionary.xyz/.well-known/ai-plugin.json
- **AYA Registry (web)**: https://ai-visionary.xyz/aya
- **Developer Docs**: https://ai-visionary.xyz/developers
- **GitHub**: https://github.com/NeousAxis/ai-visionary
