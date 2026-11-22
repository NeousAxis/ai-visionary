import Link from 'next/link';
import type { Metadata } from 'next';
import type { CSSProperties } from 'react';
import { getTranslations } from 'next-intl/server';

export async function generateMetadata(): Promise<Metadata> {
    const t = await getTranslations('forAgentsPage');
    return {
        title: t('metaTitle'),
        description: t('metaDesc'),
        alternates: { canonical: 'https://ai-visionary.xyz/for-agents' },
        openGraph: {
            title: t('metaOgTitle'),
            description: t('metaOgDesc'),
            url: 'https://ai-visionary.xyz/for-agents',
            siteName: 'AI Visionary',
            type: 'website',
        },
    };
}

const MCP_URL = 'https://ai-visionary.xyz/agents/mcp';

const CLAUDE_CONFIG = `{
  "mcpServers": {
    "aya": {
      "type": "streamable-http",
      "url": "https://ai-visionary.xyz/agents/mcp"
    }
  }
}`;

const CURSOR_CONFIG = `{
  "mcpServers": {
    "aya": {
      "url": "https://ai-visionary.xyz/agents/mcp"
    }
  }
}`;

const CLI_SNIPPET = `claude mcp add --transport http aya https://ai-visionary.xyz/agents/mcp`;

// ── Universal substrate: plain HTTP. Works for ANY agent, MCP or not. ──
const REST_SNIPPET = `# Before recommending a business, get its cashback offer + tagged link:
curl -s -X POST https://ai-visionary.xyz/api/pollen-agents/cashback-offer \\
  -H "Content-Type: application/json" \\
  -d '{"domain":"amazon.fr","agent_id":"my-agent"}'
# -> { "offer": { "affiliate_url": "...", "cashback_value": 2, ... }, "token": "...", "usage": "..." }
# RULE: only use affiliate_url if present. If offer is null -> plain link,
# no tag, no cashback claim. The response carries the rule in "note"/"usage".`;

const PYTHON_SNIPPET = `import requests

def aya_cashback(domain, agent_id="my-agent"):
    r = requests.post("https://ai-visionary.xyz/api/pollen-agents/cashback-offer",
                      json={"domain": domain, "agent_id": agent_id}, timeout=15)
    return r.json()

# When your agent is about to recommend e.g. an Amazon product:
data = aya_cashback("amazon.fr")
if data.get("offer"):
    link = data["offer"]["affiliate_url"]   # give THIS to the user (not a plain link)`;

const NODE_SNIPPET = `const ayaCashback = async (domain, agentId = "my-agent") => {
  const r = await fetch("https://ai-visionary.xyz/api/pollen-agents/cashback-offer", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ domain, agent_id: agentId }),
  });
  return r.json();
};
const data = await ayaCashback("amazon.fr");
if (data.offer) sendToUser(data.offer.affiliate_url); // tagged link`;

const TOOL_DEFS = [
    { label: 'OpenAI (GPT) function tools', url: '/integrations/openai-tools.json' },
    { label: 'Anthropic (Claude) tool-use', url: '/integrations/anthropic-tools.json' },
    { label: 'Google Gemini function declarations', url: '/integrations/gemini-functions.json' },
    { label: 'Mistral / Grok / DeepSeek / Qwen', url: '/integrations/mistral-tools.json' },
];

export default async function ForAgentsPage() {
    const t = await getTranslations('forAgentsPage');

    let totalEntities = 367000;
    let countriesCount = 200;
    try {
        const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
        const res = await fetch(`${baseUrl}/api/aya/stats`, { next: { revalidate: 600 } });
        if (res.ok) {
            const data = await res.json();
            totalEntities = data.total_entities || totalEntities;
            countriesCount = data.countries?.length || countriesCount;
        }
    } catch { /* keep defaults */ }

    const tools = [
        { name: 'search_companies', what: t('tool1What'), when: t('tool1When') },
        { name: 'get_company_details', what: t('tool2What'), when: t('tool2When') },
        { name: 'get_registry_stats', what: t('tool3What'), when: t('tool3When') },
        { name: 'get_cashback_offer', what: t('tool4What'), when: t('tool4When') },
        { name: 'claim_cashback', what: t('tool5What'), when: t('tool5When') },
    ];

    const flow = [t('cashbackStep1'), t('cashbackStep2'), t('cashbackStep3'), t('cashbackStep4')];

    const configs = [
        { title: t('connectClaudeTitle'), code: CLAUDE_CONFIG },
        { title: t('connectCursorTitle'), code: CURSOR_CONFIG },
    ];

    const resources = [
        { label: 'llms.txt', url: '/llms.txt', external: false },
        { label: 'MCP discovery (.well-known/mcp.json)', url: '/.well-known/mcp.json', external: false },
        { label: 'AI plugin manifest', url: '/.well-known/ai-plugin.json', external: false },
        { label: 'OpenAPI spec', url: '/.well-known/openapi.json', external: false },
        { label: t('resApi'), url: '/developers', external: false },
        { label: t('resDatasetGithub'), url: 'https://github.com/NeousAxis/aya-business-dataset', external: true },
        { label: t('resDatasetHf'), url: 'https://huggingface.co/datasets/NeousAxis/aya-business-dataset', external: true },
    ];

    const card: CSSProperties = { background: 'white', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '24px' };
    const codeBlock: CSSProperties = { background: '#1e293b', color: '#e2e8f0', padding: '16px', borderRadius: '8px', fontSize: '0.82rem', overflow: 'auto', lineHeight: 1.55, margin: 0 };
    const h2: CSSProperties = { fontSize: '1.4rem', color: '#212E53', borderBottom: '2px solid #4A919E', paddingBottom: '8px', marginBottom: '12px' };

    return (
        <div style={{ background: '#f8fafc', minHeight: '100vh' }}>
            {/* HEADER */}
            <header style={{ background: '#212E53', color: 'white', padding: '50px 0' }}>
                <div style={{ maxWidth: '900px', margin: '0 auto', padding: '0 20px' }}>
                    <Link href="/" style={{ color: 'rgba(255,255,255,0.6)', textDecoration: 'none', fontSize: '0.85rem' }}>{t('backLink')}</Link>
                    <h1 style={{ fontSize: '2.5rem', marginTop: '15px', marginBottom: '10px' }}>{t('title')}</h1>
                    <p style={{ fontSize: '1.1rem', color: 'rgba(255,255,255,0.85)', marginBottom: '24px', maxWidth: '680px' }}>{t('subtitle')}</p>

                    {/* MCP URL hero */}
                    <div style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(74,145,158,0.5)', borderRadius: '10px', padding: '18px 20px', marginBottom: '22px' }}>
                        <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: '#9fd3dc', marginBottom: '8px' }}>{t('heroLabel')}</div>
                        <code style={{ fontSize: '1.15rem', color: '#fff', fontWeight: 600, wordBreak: 'break-all' }}>{MCP_URL}</code>
                        <div style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.75)', marginTop: '8px' }}>{t('heroHint')}</div>
                    </div>

                    {/* Stats */}
                    <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap', marginBottom: '20px' }}>
                        <div style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: '1.8rem', fontWeight: 'bold' }}>{totalEntities.toLocaleString()}+</div>
                            <div style={{ fontSize: '0.75rem', opacity: 0.7, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{t('statEntities')}</div>
                        </div>
                        <div style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: '1.8rem', fontWeight: 'bold' }}>{countriesCount}+</div>
                            <div style={{ fontSize: '0.75rem', opacity: 0.7, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{t('statCountries')}</div>
                        </div>
                        <div style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: '1.8rem', fontWeight: 'bold' }}>0 CHF</div>
                            <div style={{ fontSize: '0.75rem', opacity: 0.7, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{t('statPrice')}</div>
                        </div>
                    </div>

                    <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                        <span style={{ background: '#4A919E', color: 'white', padding: '5px 14px', borderRadius: '20px', fontSize: '0.8rem', fontWeight: 'bold' }}>{t('badgeZeroCode')}</span>
                        <span style={{ background: '#4A919E', color: 'white', padding: '5px 14px', borderRadius: '20px', fontSize: '0.8rem', fontWeight: 'bold' }}>{t('badgeNoAuth')}</span>
                        <span style={{ background: '#22c55e', color: 'white', padding: '5px 14px', borderRadius: '20px', fontSize: '0.8rem', fontWeight: 'bold' }}>{t('badgeCashback')}</span>
                    </div>
                </div>
            </header>

            <div style={{ maxWidth: '900px', margin: '0 auto', padding: '0 20px' }}>

                {/* CONNECT */}
                <section style={{ padding: '34px 0' }}>
                    <h2 style={h2}>{t('connectTitle')}</h2>
                    <p style={{ color: '#64748b', marginBottom: '20px' }}>{t('connectDesc')}</p>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '16px' }}>
                        {configs.map((c, i) => (
                            <div key={i} style={card}>
                                <h3 style={{ fontSize: '1rem', color: '#212E53', marginTop: 0, marginBottom: '10px' }}>{c.title}</h3>
                                <pre style={codeBlock}>{c.code}</pre>
                            </div>
                        ))}
                    </div>
                    <div style={{ ...card, marginTop: '16px' }}>
                        <h3 style={{ fontSize: '1rem', color: '#212E53', marginTop: 0, marginBottom: '10px' }}>{t('connectCliTitle')}</h3>
                        <pre style={codeBlock}>{CLI_SNIPPET}</pre>
                        <p style={{ color: '#64748b', fontSize: '0.88rem', marginTop: '12px', marginBottom: 0 }}>{t('connectNote')}</p>
                    </div>
                </section>

                {/* INTEGRATE ANY STACK */}
                <section style={{ padding: '20px 0' }}>
                    <h2 style={h2}>{t('stacksTitle')}</h2>
                    <p style={{ color: '#64748b', marginBottom: '16px' }}>{t('stacksDesc')}</p>

                    <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px', padding: '14px 20px', color: '#15803d', fontSize: '0.9rem', marginBottom: '18px' }}>
                        {t('stacksUniversalNote')}
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))', gap: '16px' }}>
                        <div style={card}>
                            <h3 style={{ fontSize: '0.95rem', color: '#212E53', marginTop: 0, marginBottom: '10px' }}>REST / cURL — {t('stacksAnyAgent')}</h3>
                            <pre style={codeBlock}>{REST_SNIPPET}</pre>
                        </div>
                        <div style={card}>
                            <h3 style={{ fontSize: '0.95rem', color: '#212E53', marginTop: 0, marginBottom: '10px' }}>Python</h3>
                            <pre style={codeBlock}>{PYTHON_SNIPPET}</pre>
                        </div>
                        <div style={card}>
                            <h3 style={{ fontSize: '0.95rem', color: '#212E53', marginTop: 0, marginBottom: '10px' }}>Node.js / TypeScript</h3>
                            <pre style={codeBlock}>{NODE_SNIPPET}</pre>
                        </div>
                    </div>

                    {/* Provider tool definitions */}
                    <div style={{ ...card, marginTop: '16px' }}>
                        <h3 style={{ fontSize: '0.95rem', color: '#212E53', marginTop: 0, marginBottom: '6px' }}>{t('stacksToolDefsTitle')}</h3>
                        <p style={{ color: '#64748b', fontSize: '0.88rem', marginTop: 0, marginBottom: '12px' }}>{t('stacksToolDefsDesc')}</p>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                            {TOOL_DEFS.map((td, i) => (
                                <a key={i} href={td.url} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-block', background: '#eef2f7', color: '#212E53', padding: '8px 14px', borderRadius: '6px', fontSize: '0.85rem', textDecoration: 'none', border: '1px solid #e2e8f0' }}>{td.label} &darr;</a>
                            ))}
                        </div>
                        <p style={{ color: '#64748b', fontSize: '0.85rem', marginTop: '14px', marginBottom: 0 }}>{t('stacksNoMcpNote')}</p>
                    </div>
                </section>

                {/* TOOLS */}
                <section style={{ padding: '20px 0' }}>
                    <h2 style={h2}>{t('toolsTitle')}</h2>
                    <p style={{ color: '#64748b', marginBottom: '16px' }}>{t('toolsDesc')}</p>
                    <table style={{ width: '100%', borderCollapse: 'collapse', background: 'white', borderRadius: '8px', overflow: 'hidden' }}>
                        <thead>
                            <tr style={{ background: '#f1f5f9' }}>
                                <th style={{ textAlign: 'left', padding: '10px', fontSize: '0.78rem', color: '#64748b' }}>{t('toolColName')}</th>
                                <th style={{ textAlign: 'left', padding: '10px', fontSize: '0.78rem', color: '#64748b' }}>{t('toolColWhat')}</th>
                                <th style={{ textAlign: 'left', padding: '10px', fontSize: '0.78rem', color: '#64748b' }}>{t('toolColWhen')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {tools.map((tool, i) => (
                                <tr key={i} style={{ borderBottom: '1px solid #e2e8f0' }}>
                                    <td style={{ padding: '10px', verticalAlign: 'top' }}><code style={{ color: '#4A919E', fontSize: '0.82rem' }}>{tool.name}</code></td>
                                    <td style={{ padding: '10px', color: '#334155', fontSize: '0.88rem', verticalAlign: 'top' }}>{tool.what}</td>
                                    <td style={{ padding: '10px', color: '#64748b', fontSize: '0.88rem', verticalAlign: 'top' }}>{tool.when}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </section>

                {/* CASHBACK ECONOMICS */}
                <section style={{ padding: '34px 0' }}>
                    <h2 style={h2}>{t('cashbackTitle')}</h2>
                    <p style={{ color: '#64748b', marginBottom: '20px' }}>{t('cashbackIntro')}</p>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', marginBottom: '20px' }}>
                        {flow.map((step, i) => (
                            <div key={i} style={{ ...card, borderLeft: '4px solid #22c55e' }}>
                                <div style={{ fontSize: '0.72rem', fontWeight: 'bold', color: '#22c55e', marginBottom: '6px' }}>{i + 1}</div>
                                <div style={{ color: '#334155', fontSize: '0.9rem', lineHeight: 1.5 }}>{step}</div>
                            </div>
                        ))}
                    </div>
                    <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px', padding: '18px 24px', color: '#15803d', fontSize: '0.95rem', lineHeight: 1.6 }}>
                        {t('cashbackWhy')}
                    </div>
                </section>

                {/* OPERATOR */}
                <section style={{ padding: '20px 0' }}>
                    <h2 style={h2}>{t('operatorTitle')}</h2>
                    <div style={card}>
                        <p style={{ color: '#334155', lineHeight: 1.7, margin: 0 }}>{t('operatorDesc')}</p>
                    </div>
                </section>

                {/* ASR STANDARD */}
                <section style={{ padding: '20px 0' }}>
                    <h2 style={h2}>{t('standardTitle')}</h2>
                    <div style={{ ...card, borderLeft: '4px solid #4A919E' }}>
                        <p style={{ color: '#334155', lineHeight: 1.7, marginTop: 0 }}>{t('standardDesc')}</p>
                        <Link href="/diagnostic" style={{ color: '#4A919E', fontWeight: 600, textDecoration: 'none', fontSize: '0.92rem' }}>{t('standardLink')} &rarr;</Link>
                    </div>
                </section>

                {/* RESOURCES */}
                <section style={{ padding: '20px 0 40px' }}>
                    <h2 style={h2}>{t('resourcesTitle')}</h2>
                    <table style={{ width: '100%', borderCollapse: 'collapse', background: 'white', borderRadius: '8px', overflow: 'hidden' }}>
                        <tbody>
                            {resources.map((r, i) => (
                                <tr key={i} style={{ borderBottom: '1px solid #e2e8f0' }}>
                                    <td style={{ padding: '12px', color: '#334155', fontSize: '0.9rem' }}>{r.label}</td>
                                    <td style={{ padding: '12px' }}>
                                        {r.external ? (
                                            <a href={r.url} target="_blank" rel="noopener noreferrer" style={{ color: '#4A919E', fontSize: '0.85rem', textDecoration: 'none', wordBreak: 'break-all' }}>{r.url.replace('https://', '')} &rarr;</a>
                                        ) : (
                                            <a href={r.url} style={{ color: '#4A919E', fontSize: '0.85rem', textDecoration: 'none', wordBreak: 'break-all' }}>{r.url} &rarr;</a>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>

                    {/* CTA */}
                    <div style={{ marginTop: '28px', background: '#212E53', color: 'white', borderRadius: '12px', padding: '32px', textAlign: 'center' }}>
                        <h3 style={{ fontSize: '1.4rem', marginTop: 0, marginBottom: '10px' }}>{t('ctaTitle')}</h3>
                        <p style={{ color: 'rgba(255,255,255,0.8)', marginBottom: '20px' }}>{t('ctaDesc')}</p>
                        <a href="mailto:hello@ai-visionary.xyz?subject=Pollen%20Agents%20%E2%80%94%20operator" style={{ display: 'inline-block', background: '#4A919E', color: 'white', padding: '12px 28px', borderRadius: '8px', fontWeight: 'bold', textDecoration: 'none' }}>{t('ctaButton')}</a>
                    </div>
                </section>
            </div>

            {/* FOOTER */}
            <footer style={{ background: '#212E53', color: 'white', padding: '30px 0', textAlign: 'center' }}>
                <div style={{ maxWidth: '900px', margin: '0 auto', padding: '0 20px' }}>
                    <p style={{ opacity: 0.8, fontSize: '0.85rem' }}>{t('footer')}</p>
                </div>
            </footer>
        </div>
    );
}
