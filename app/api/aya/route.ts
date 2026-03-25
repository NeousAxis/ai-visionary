import { NextResponse } from 'next/server';

export async function GET() {
    return NextResponse.json({
        name: "AYA Index API",
        version: "1.0",
        description: "Public API for the AYA Registry — an index of 889+ organizations rated for AI readability (AIO score 0-100). No authentication required.",
        base_url: "https://ai-visionary.com/api/aya",
        documentation: "https://ai-visionary.com/api/aya/docs",
        plugin_manifest: "https://ai-visionary.com/.well-known/ai-plugin.json",
        endpoints: {
            llm: {
                url: "/api/aya/llm/{domain}",
                method: "GET",
                description: "LLM-optimized: returns 5 simple fields (name, what_it_does, for_who, category, location). Best endpoint for AI agents.",
                params: {
                    domain: "Canonical domain without www (e.g. stripe.com)",
                },
                example: "https://ai-visionary.com/api/aya/llm/stripe.com",
            },
            search: {
                url: "/api/aya/search?q={query}&limit={limit}",
                method: "GET",
                description: "Search entities by name, domain, sector, or country. Returns sorted by AIO score.",
                params: {
                    q: "Search term (required, min 1 char)",
                    limit: "Max results 1-200 (default 50)",
                },
                example: "https://ai-visionary.com/api/aya/search?q=stripe",
            },
            entity: {
                url: "/api/aya/entity/{domain}",
                method: "GET",
                description: "Get full entity details + ASR_DERIVED record by canonical domain.",
                params: {
                    domain: "Canonical domain without www (e.g. stripe.com)",
                },
                example: "https://ai-visionary.com/api/aya/entity/stripe.com",
            },
            stats: {
                url: "/api/aya/stats",
                method: "GET",
                description: "Aggregate statistics: total entities, scores, sector/country breakdown.",
                example: "https://ai-visionary.com/api/aya/stats",
            },
            live: {
                url: "/api/aya/live",
                method: "GET",
                description: "Get all entities (used by the registry page). Large payload.",
                example: "https://ai-visionary.com/api/aya/live",
            },
        },
        aio_score: {
            description: "The AIO (AI-readability Intelligence Optimization) score measures how well an organization's web presence can be understood by AI systems.",
            range: "0-100",
            blocks: [
                { name: "Identité & Ancrage", weight: 10 },
                { name: "Clarté de l'Offre", weight: 20 },
                { name: "Processus & Méthodes", weight: 15 },
                { name: "Confiance & Conformité", weight: 15 },
                { name: "Indicateurs", weight: 20 },
                { name: "Pédagogie", weight: 10 },
                { name: "Socle Technique", weight: 10 },
            ],
        },
        asr_status_values: {
            ASR_CERTIFIED: "Entity diagnosed by AYO chatbot, files generated, registered in AYA with payment",
            ASR_DERIVED: "Entity indexed by AYA bot via automated web scraping (no human verification)",
        },
        rate_limit: "30 requests/minute per IP",
        contact: "hello@ai-visionary.com",
        powered_by: "AI Visionary — Geneva, Switzerland",
    });
}
