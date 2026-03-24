# Integrating the AYA API with Mistral AI Tool Use

This guide explains how to connect the **AYA public index** to Mistral AI models via tool use (function calling), so Mistral can look up companies, retrieve their AI-readability data, and answer user questions with live data from the AYA registry.

## What is AYA?

AYA is a public index of 889+ organizations rated for **AI readability** using the AIO score (0--100). The AIO score measures how well a website's structured data can be understood by AI systems. Higher scores mean AI agents can more reliably recommend and describe the entity.

- **No authentication required** -- the API is fully public
- **Rate limit**: 30 requests/minute per IP
- **Base URL**: `https://ai-visionary.com/api/aya`

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/aya/search?q={query}&limit={n}` | GET | Search entities by name, domain, sector, or country |
| `/api/aya/entity/{domain}` | GET | Get full details for a specific entity |
| `/api/aya/stats` | GET | Get aggregate index statistics |

## Tool Definitions

Below are the three tool definitions in the format expected by the Mistral API. They are also available as a standalone JSON file at [`mistral-tool-definitions.json`](./mistral-tool-definitions.json).

```json
[
  {
    "type": "function",
    "function": {
      "name": "search_aya_companies",
      "description": "Search the AYA public index of organizations rated for AI readability. Returns companies matching the query by name, domain, sector, or country, sorted by AIO score (0-100). The AIO score measures how well a website's structured data can be understood by AI systems.",
      "parameters": {
        "type": "object",
        "properties": {
          "query": {
            "type": "string",
            "description": "Search term: company name, domain, sector, or country. Case-insensitive, partial match."
          },
          "limit": {
            "type": "integer",
            "description": "Maximum results to return (1-200). Default: 50.",
            "default": 50
          }
        },
        "required": ["query"]
      }
    }
  },
  {
    "type": "function",
    "function": {
      "name": "get_aya_entity",
      "description": "Get the full AYA record for a specific entity by its canonical domain. Returns identity, AIO scoring with all 7 block scores, ASR_DERIVED structured data, and recommendability signals.",
      "parameters": {
        "type": "object",
        "properties": {
          "domain": {
            "type": "string",
            "description": "Canonical domain (e.g. 'adobe.com'). Do not include 'www.' or 'https://'."
          }
        },
        "required": ["domain"]
      }
    }
  },
  {
    "type": "function",
    "function": {
      "name": "get_aya_stats",
      "description": "Get aggregate statistics about the AYA index: total entities, certified vs indexed breakdown, score distribution, and sector/country breakdowns.",
      "parameters": {
        "type": "object",
        "properties": {}
      }
    }
  }
]
```

## Python Implementation

### Prerequisites

```bash
pip install mistralai httpx
```

### Complete Example

```python
import json
import httpx
from mistralai import Mistral

AYA_BASE = "https://ai-visionary.com/api/aya"

# --- AYA API helpers ---

def search_aya_companies(query: str, limit: int = 50) -> dict:
    """Call the AYA search endpoint."""
    resp = httpx.get(f"{AYA_BASE}/search", params={"q": query, "limit": limit}, timeout=15)
    resp.raise_for_status()
    return resp.json()

def get_aya_entity(domain: str) -> dict:
    """Call the AYA entity endpoint."""
    resp = httpx.get(f"{AYA_BASE}/entity/{domain}", timeout=15)
    resp.raise_for_status()
    return resp.json()

def get_aya_stats() -> dict:
    """Call the AYA stats endpoint."""
    resp = httpx.get(f"{AYA_BASE}/stats", timeout=15)
    resp.raise_for_status()
    return resp.json()

# Map tool names to handler functions
TOOL_HANDLERS = {
    "search_aya_companies": lambda args: search_aya_companies(**args),
    "get_aya_entity": lambda args: get_aya_entity(**args),
    "get_aya_stats": lambda args: get_aya_stats(**args),
}

# --- Tool definitions ---

TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "search_aya_companies",
            "description": "Search the AYA public index of organizations rated for AI readability.",
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {
                        "type": "string",
                        "description": "Search term: company name, domain, sector, or country.",
                    },
                    "limit": {
                        "type": "integer",
                        "description": "Max results (1-200). Default: 50.",
                        "default": 50,
                    },
                },
                "required": ["query"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_aya_entity",
            "description": "Get full AYA record for a specific entity by domain.",
            "parameters": {
                "type": "object",
                "properties": {
                    "domain": {
                        "type": "string",
                        "description": "Canonical domain (e.g. 'adobe.com').",
                    }
                },
                "required": ["domain"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_aya_stats",
            "description": "Get aggregate statistics about the AYA index.",
            "parameters": {"type": "object", "properties": {}},
        },
    },
]

# --- Mistral chat loop with tool use ---

def chat_with_aya(user_message: str, api_key: str, model: str = "mistral-large-latest"):
    """
    Send a user message to Mistral with AYA tools available.
    Handles the tool-call round-trip automatically.
    """
    client = Mistral(api_key=api_key)

    messages = [
        {
            "role": "system",
            "content": (
                "You have access to the AYA index -- a public registry of organizations "
                "rated for AI readability (AIO score 0-100). Use the provided tools to "
                "look up companies, retrieve their structured data, and answer questions "
                "about their AI readability. Always cite the AIO score when available."
            ),
        },
        {"role": "user", "content": user_message},
    ]

    # Step 1 -- initial request with tools
    response = client.chat.complete(
        model=model,
        messages=messages,
        tools=TOOLS,
    )

    assistant_message = response.choices[0].message
    messages.append(assistant_message)

    # Step 2 -- if the model called one or more tools, execute them
    if assistant_message.tool_calls:
        for tool_call in assistant_message.tool_calls:
            fn_name = tool_call.function.name
            fn_args = json.loads(tool_call.function.arguments)

            print(f"[Tool call] {fn_name}({fn_args})")

            handler = TOOL_HANDLERS.get(fn_name)
            if handler:
                try:
                    result = handler(fn_args)
                except httpx.HTTPStatusError as exc:
                    result = {"error": str(exc)}
            else:
                result = {"error": f"Unknown tool: {fn_name}"}

            # Append tool result
            messages.append(
                {
                    "role": "tool",
                    "name": fn_name,
                    "content": json.dumps(result, ensure_ascii=False),
                    "tool_call_id": tool_call.id,
                }
            )

        # Step 3 -- let the model synthesize the final answer
        response = client.chat.complete(
            model=model,
            messages=messages,
            tools=TOOLS,
        )
        assistant_message = response.choices[0].message

    return assistant_message.content


# --- Usage ---

if __name__ == "__main__":
    import os

    api_key = os.environ["MISTRAL_API_KEY"]

    # Example 1: Search for a company
    print(chat_with_aya("Is Nestle in the AYA index? What is their AI readability score?", api_key))
    print("---")

    # Example 2: Compare companies in a sector
    print(chat_with_aya("Find the top 5 Swiss finance companies by AI readability.", api_key))
    print("---")

    # Example 3: Get index stats
    print(chat_with_aya("How many companies are in the AYA index and what is the average score?", api_key))
```

### How It Works

1. The user asks a question (e.g., "What is the AI readability score of nestle.com?").
2. Mistral receives the message along with the three AYA tool definitions.
3. The model decides which tool to call and returns a `tool_calls` response.
4. Your code executes the corresponding HTTP request to the AYA API.
5. The tool result is sent back to Mistral as a `tool` message.
6. Mistral generates a final natural-language answer incorporating the live data.

### Handling Multiple Tool Calls

Mistral may call multiple tools in a single turn (e.g., `search_aya_companies` followed by `get_aya_entity`). The example above handles this by iterating over `assistant_message.tool_calls` and appending each result before making the follow-up request.

## Response Format

### Search Results

Each result in the `search` response includes:

| Field | Description |
|-------|-------------|
| `name` | Display name of the entity |
| `domain` | Canonical domain (e.g. `nestle.com`) |
| `country` | ISO country code (e.g. `CH`) |
| `sector` | Business sector (e.g. `food_bev`) |
| `aio_score` | AI-readability score 0--100 |
| `asr_status` | `ASR_CERTIFIED` (verified client) or `ASR_DERIVED` (bot-indexed) |
| `certificate_url` | Link to the AYA certificate page |

### Entity Details

The `entity` endpoint returns the full record:

- **entity** -- identity fields (name, legal_name, domain, website, country, sector, contact_email)
- **scoring** -- AIO score, ASR status, data origin
- **asr_derived** -- structured AI Singular Record with services, compliance, indicators
- **recommendability** -- signals indicating how reliably AI agents can recommend the entity

### Stats

The `stats` endpoint returns:

- `total_entities`, `certified_count`, `indexed_count`
- `scores` -- average, min, max, median
- `sectors` -- entity count per sector
- `countries` -- entity count per country

## Error Handling

| Status | Meaning |
|--------|---------|
| 400 | Missing or invalid parameter |
| 404 | Entity not found (for `/entity/{domain}`) |
| 429 | Rate limit exceeded (30 req/min) |
| 500 | Server error |

Errors return `{"error": "..."}`. In the tool handler, catch HTTP errors and return them as tool results so the model can inform the user gracefully.

## OpenAPI Spec

The full OpenAPI 3.0 specification is available at:

```
https://ai-visionary.com/.well-known/openapi.json
```

## Links

- **AYA Index**: https://ai-visionary.com/aya
- **API Documentation**: https://ai-visionary.com/developers
- **AI Plugin Manifest**: https://ai-visionary.com/.well-known/ai-plugin.json
- **GitHub**: https://github.com/NeousAxis/ai-visionary
- **Contact**: hello@ai-visionary.com
