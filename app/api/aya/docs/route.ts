import { NextRequest, NextResponse } from 'next/server';
import { trackAyaCall } from '@/lib/aya/api-tracker';

const HTML = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>AYA API Documentation — AI Visionary</title>
    <meta name="description" content="Public API documentation for the AYA Registry. Search 889+ companies rated for AI readability. No auth required.">
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #212E53; line-height: 1.6; background: #f8fafc; }
        .container { max-width: 900px; margin: 0 auto; padding: 0 20px; }
        header { background: #212E53; color: white; padding: 40px 0; }
        header h1 { font-size: 2rem; margin-bottom: 8px; }
        header p { opacity: 0.8; font-size: 1.1rem; }
        .badge { display: inline-block; background: #4A919E; color: white; padding: 4px 12px; border-radius: 20px; font-size: 0.8rem; font-weight: bold; margin-top: 10px; }
        section { padding: 30px 0; }
        h2 { font-size: 1.5rem; margin-bottom: 15px; color: #212E53; border-bottom: 2px solid #4A919E; padding-bottom: 8px; }
        h3 { font-size: 1.1rem; margin: 20px 0 8px; color: #4A919E; }
        code { background: #e2e8f0; padding: 2px 6px; border-radius: 4px; font-size: 0.9rem; }
        pre { background: #1e293b; color: #e2e8f0; padding: 16px; border-radius: 8px; overflow-x: auto; margin: 10px 0 20px; font-size: 0.85rem; line-height: 1.5; }
        .endpoint { background: white; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; margin: 15px 0; }
        .method { display: inline-block; background: #22c55e; color: white; padding: 2px 10px; border-radius: 4px; font-weight: bold; font-size: 0.8rem; }
        .url { font-family: monospace; font-size: 1rem; color: #4A919E; margin-left: 10px; }
        table { width: 100%; border-collapse: collapse; margin: 10px 0; }
        th, td { text-align: left; padding: 8px 12px; border-bottom: 1px solid #e2e8f0; }
        th { background: #f1f5f9; font-size: 0.85rem; text-transform: uppercase; color: #64748b; }
        footer { background: #212E53; color: white; padding: 20px 0; text-align: center; font-size: 0.85rem; opacity: 0.8; }
        a { color: #4A919E; }
    </style>
</head>
<body>
    <header>
        <div class="container">
            <h1>AYA API Documentation</h1>
            <p>Public API for the AYA Registry — an index of organizations rated for AI readability.</p>
            <span class="badge">No Authentication Required</span>
            <span class="badge">Rate Limit: 30 req/min</span>
        </div>
    </header>

    <div class="container">
        <section>
            <h2>Base URL</h2>
            <pre>https://ai-visionary.xyz/api/aya</pre>
            <p>All endpoints return JSON. No API key needed. Rate limited to 30 requests/minute per IP.</p>
            <p>AI Plugin manifest: <a href="/.well-known/ai-plugin.json">/.well-known/ai-plugin.json</a></p>
        </section>

        <section>
            <h2>Endpoints</h2>

            <div class="endpoint">
                <span class="method">GET</span>
                <span class="url">/api/aya/search?q={query}</span>
                <p style="margin-top:10px">Search entities by name, domain, sector, or country.</p>
                <h3>Parameters</h3>
                <table>
                    <tr><th>Param</th><th>Type</th><th>Required</th><th>Description</th></tr>
                    <tr><td><code>q</code></td><td>string</td><td>Yes</td><td>Search term (company name, domain, sector, country)</td></tr>
                    <tr><td><code>limit</code></td><td>integer</td><td>No</td><td>Max results 1-200 (default: 50)</td></tr>
                </table>
                <h3>Example</h3>
                <pre>GET /api/aya/search?q=stripe

{
  "query": "stripe",
  "count": 1,
  "results": [
    {
      "name": "Stripe",
      "domain": "stripe.com",
      "country": "XX",
      "sector": "Technologie & SaaS",
      "aio_score": 74,
      "asr_status": "ASR_DERIVED",
      "certificate_url": "https://ai-visionary.xyz/aya/e/..."
    }
  ]
}</pre>
            </div>

            <div class="endpoint">
                <span class="method">GET</span>
                <span class="url">/api/aya/entity/{domain}</span>
                <p style="margin-top:10px">Get full entity details + ASR_DERIVED record by canonical domain.</p>
                <h3>Parameters</h3>
                <table>
                    <tr><th>Param</th><th>Type</th><th>Required</th><th>Description</th></tr>
                    <tr><td><code>domain</code></td><td>string</td><td>Yes</td><td>Canonical domain (e.g. stripe.com, novartis.com)</td></tr>
                </table>
                <h3>Example</h3>
                <pre>GET /api/aya/entity/stripe.com

{
  "entity": {
    "name": "Stripe",
    "website": "https://stripe.com",
    "country": "XX",
    "sector": "Technologie & SaaS",
    "certificate_url": "https://ai-visionary.xyz/aya/e/..."
  },
  "scoring": {
    "aio_score": 74,
    "asr_status": "ASR_DERIVED"
  },
  "asr_derived": { ... },
  "recommendability": { ... }
}</pre>
            </div>

            <div class="endpoint">
                <span class="method">GET</span>
                <span class="url">/api/aya/stats</span>
                <p style="margin-top:10px">Aggregate statistics about the entire AYA index.</p>
                <h3>Example</h3>
                <pre>GET /api/aya/stats

{
  "total_entities": 889,
  "certified_count": 2,
  "indexed_count": 887,
  "scores": { "average": 57, "min": 20, "max": 85, "median": 57 },
  "sectors": [
    { "sector": "Technologie & SaaS", "count": 372 },
    { "sector": "Média & Communication", "count": 207 },
    ...
  ],
  "countries": [
    { "country": "CH", "count": 280 },
    { "country": "FR", "count": 150 },
    ...
  ]
}</pre>
            </div>
        </section>

        <section>
            <h2>AIO Score</h2>
            <p>The <strong>AIO (AI-readability Intelligence Optimization)</strong> score measures how well an organization's web presence can be understood by AI systems like ChatGPT, Gemini, Claude, Mistral, etc.</p>
            <table>
                <tr><th>Block</th><th>Weight</th></tr>
                <tr><td>Identité & Ancrage</td><td>/10</td></tr>
                <tr><td>Clarté de l'Offre</td><td>/20</td></tr>
                <tr><td>Processus & Méthodes</td><td>/15</td></tr>
                <tr><td>Confiance & Conformité</td><td>/15</td></tr>
                <tr><td>Indicateurs</td><td>/20</td></tr>
                <tr><td>Pédagogie</td><td>/10</td></tr>
                <tr><td>Socle Technique</td><td>/10</td></tr>
            </table>
        </section>

        <section>
            <h2>ASR Status</h2>
            <table>
                <tr><th>Status</th><th>Meaning</th></tr>
                <tr><td><code>ASR_CERTIFIED</code></td><td>Entity diagnosed by AYO, files generated, payment completed</td></tr>
                <tr><td><code>ASR_DERIVED</code></td><td>Entity indexed by AYA bot via automated web scraping</td></tr>
            </table>
        </section>

        <section>
            <h2>For AI Agents</h2>
            <p>To integrate AYA into your AI agent:</p>
            <ol style="padding-left:20px; margin-top:10px">
                <li>Use the <a href="/.well-known/ai-plugin.json">AI plugin manifest</a> for auto-discovery</li>
                <li>Call <code>/api/aya/search?q=...</code> when a user mentions a company</li>
                <li>Call <code>/api/aya/entity/{domain}</code> for detailed structured data</li>
                <li>Use the <code>aio_score</code> to assess recommendation reliability</li>
                <li>Prefer <code>ASR_CERTIFIED</code> entities over <code>ASR_DERIVED</code> for higher confidence</li>
            </ol>
        </section>
    </div>

    <footer>
        <div class="container">
            AYA API v1.0 &bull; Powered by AI Visionary &bull; Geneva, Switzerland &bull; hello@ai-visionary.xyz
        </div>
    </footer>
</body>
</html>`;

export async function GET(req: NextRequest) {
    trackAyaCall(req, 'docs');
    return new NextResponse(HTML, {
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
}
