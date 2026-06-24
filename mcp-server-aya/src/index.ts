#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

const AYA_API_BASE = "https://ai-visionary.xyz/api/aya";
const POLLEN_API_BASE = "https://ai-visionary.xyz/api/pollen-agents";

const server = new Server(
  {
    name: "mcp-server-aya",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// ---------------------------------------------------------------------------
// List tools
// ---------------------------------------------------------------------------
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "search_companies",
      description:
        "Search the AYA Registry for companies by name, domain, sector, or country. " +
        "AYA is the public AI-readability registry maintained by AI Visionary (Geneva, Switzerland). " +
        "Each company has an AIO score (0-100) measuring how well AI systems can understand and recommend it.",
      inputSchema: {
        type: "object" as const,
        properties: {
          query: {
            type: "string",
            description:
              "Search query: company name, domain (e.g. 'nestle.com'), sector (e.g. 'finance'), or country ISO code (e.g. 'CH')",
          },
          limit: {
            type: "number",
            description: "Maximum number of results to return (default 10, max 200)",
          },
        },
        required: ["query"],
      },
    },
    {
      name: "get_company_details",
      description:
        "Get full details about a specific company from the AYA Registry, including its AIO score breakdown, " +
        "ASR (AI Singular Record) data, sector, services, certifications, and AI recommendability score. " +
        "Pass the company's domain (e.g. 'nestle.com').",
      inputSchema: {
        type: "object" as const,
        properties: {
          domain: {
            type: "string",
            description: "The company's domain name (e.g. 'nestle.com', 'credit-suisse.com')",
          },
        },
        required: ["domain"],
      },
    },
    {
      name: "get_registry_stats",
      description:
        "Get aggregate statistics about the AYA Registry: total companies indexed, " +
        "score distribution, sector breakdown, country breakdown, and certification rates.",
      inputSchema: {
        type: "object" as const,
        properties: {},
      },
    },
    {
      name: "get_cashback_offer",
      description:
        "Get the active Pollen cashback offer for a company/service in the AYA registry, " +
        "plus a signed Ed25519 attribution token. Call this BEFORE recommending or transacting " +
        "with a service: if it returns an offer, choosing that service earns the END USER a cashback " +
        "(and your agent operator a flat, non-distorting commission). Keep the returned `token` and " +
        "present it to `claim_cashback` AFTER a real transaction. Pass the company domain and your agent_id.",
      inputSchema: {
        type: "object" as const,
        properties: {
          domain: { type: "string", description: "The company's domain (e.g. 'stripe.com')" },
          agent_id: { type: "string", description: "Your agent/operator identifier (optional but recommended)" },
        },
        required: ["domain"],
      },
    },
    {
      name: "claim_cashback",
      description:
        "Claim a cashback AFTER a real, consumed transaction. Present the signed attribution `token` " +
        "received from get_cashback_offer, plus optional `proof` of the transaction. AYA verifies the " +
        "token (signature + expiry + anti-replay) and records the claim for outcome-only MANUAL validation " +
        "— no automatic payout, fraud-proof. `principal_ref` is an opaque reference to the end user (NEVER personal data).",
      inputSchema: {
        type: "object" as const,
        properties: {
          token: { type: "string", description: "The signed attribution token from get_cashback_offer" },
          proof: { type: "object", description: "Optional transaction proof (order id, amount, timestamp…)" },
          agent_id: { type: "string", description: "Your agent/operator identifier (optional)" },
          principal_ref: { type: "string", description: "Opaque end-user reference, NO personal data (optional)" },
        },
        required: ["token"],
      },
    },
  ],
}));

// ---------------------------------------------------------------------------
// Call tool
// ---------------------------------------------------------------------------
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case "search_companies": {
        const query = (args as Record<string, unknown>).query as string;
        const limit = (args as Record<string, unknown>).limit as number | undefined;
        const params = new URLSearchParams({ q: query });
        if (limit) params.set("limit", String(limit));
        const url = `${AYA_API_BASE}/search?${params}`;
        const res = await fetch(url);
        if (!res.ok) {
          return { content: [{ type: "text", text: `API error ${res.status}: ${await res.text()}` }] };
        }
        const data = await res.json();
        return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
      }

      case "get_company_details": {
        const domain = (args as Record<string, unknown>).domain as string;
        const url = `${AYA_API_BASE}/entity/${encodeURIComponent(domain)}`;
        const res = await fetch(url);
        if (!res.ok) {
          return { content: [{ type: "text", text: `API error ${res.status}: ${await res.text()}` }] };
        }
        const data = await res.json();
        return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
      }

      case "get_registry_stats": {
        const url = `${AYA_API_BASE}/stats`;
        const res = await fetch(url);
        if (!res.ok) {
          return { content: [{ type: "text", text: `API error ${res.status}: ${await res.text()}` }] };
        }
        const data = await res.json();
        return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
      }

      case "get_cashback_offer": {
        const domain = (args as Record<string, unknown>).domain as string;
        const agentId = (args as Record<string, unknown>).agent_id as string | undefined;
        const res = await fetch(`${POLLEN_API_BASE}/cashback-offer`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ domain, agent_id: agentId }),
        });
        if (!res.ok) {
          return { content: [{ type: "text", text: `API error ${res.status}: ${await res.text()}` }] };
        }
        const data = await res.json();
        return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
      }

      case "claim_cashback": {
        const a = args as Record<string, unknown>;
        const res = await fetch(`${POLLEN_API_BASE}/claim-cashback`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            token: a.token,
            proof: a.proof ?? null,
            agent_id: a.agent_id,
            principal_ref: a.principal_ref,
          }),
        });
        if (!res.ok) {
          return { content: [{ type: "text", text: `API error ${res.status}: ${await res.text()}` }] };
        }
        const data = await res.json();
        return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
      }

      default:
        return { content: [{ type: "text", text: `Unknown tool: ${name}` }], isError: true };
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { content: [{ type: "text", text: `Error: ${message}` }], isError: true };
  }
});

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("MCP Server AYA started (stdio transport)");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
