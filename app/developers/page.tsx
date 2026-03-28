import Link from 'next/link';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

export async function generateMetadata(): Promise<Metadata> {
    const t = await getTranslations('developersPage');
    return {
        title: t('metaTitle'),
        description: t('metaDesc'),
        openGraph: {
            title: t('metaOgTitle'),
            description: t('metaOgDesc'),
            url: 'https://ai-visionary.com/developers',
            siteName: 'AI Visionary',
            type: 'website',
        },
    };
}

export default async function DevelopersPage() {
    const t = await getTranslations('developersPage');

    const endpoints = [
        {
            method: 'GET',
            path: '/api/aya/search?q={query}',
            description: t('searchDesc'),
            params: [
                { name: 'q', type: 'string', required: true, desc: t('searchParamQ') },
                { name: 'limit', type: 'integer', required: false, desc: t('searchParamLimit') },
            ],
            example: '/api/aya/search?q=nestl\u00e9',
            response: `{
  "query": "nestl\u00e9",
  "count": 1,
  "results": [{
    "name": "Nestl\u00e9",
    "domain": "nestle.com",
    "country": "CH",
    "sector": "Restauration & Alimentation",
    "aio_score": 72,
    "asr_status": "ASR_DERIVED",
    "certificate_url": "https://ai-visionary.com/aya/e/..."
  }]
}`,
        },
        {
            method: 'GET',
            path: '/api/aya/entity/{domain}',
            description: t('entityDesc'),
            params: [
                { name: 'domain', type: 'string', required: true, desc: t('entityParamDomain') },
            ],
            example: '/api/aya/entity/nestle.com',
            response: `{
  "entity": {
    "name": "Nestl\u00e9",
    "website": "https://www.nestle.com",
    "country": "CH",
    "sector": "Restauration & Alimentation",
    "certificate_url": "https://ai-visionary.com/aya/e/..."
  },
  "scoring": {
    "aio_score": 72,
    "asr_status": "ASR_DERIVED"
  },
  "asr_derived": { ... },
  "recommendability": { ... }
}`,
        },
        {
            method: 'GET',
            path: '/api/aya/stats',
            description: t('statsDesc'),
            params: [],
            example: '/api/aya/stats',
            response: `{
  "total_entities": 1815,
  "certified_count": 3,
  "indexed_count": 1812,
  "scores": { "average": 57, "min": 20, "max": 85 },
  "sectors": [{ "sector": "Technologie & SaaS", "count": 620 }, ...],
  "countries": [{ "country": "CH", "count": 380 }, ...]
}`,
        },
    ];

    const aioBlocks = [
        { name: t('aioBlock1'), weight: 10 },
        { name: t('aioBlock2'), weight: 20 },
        { name: t('aioBlock3'), weight: 15 },
        { name: t('aioBlock4'), weight: 15 },
        { name: t('aioBlock5'), weight: 20 },
        { name: t('aioBlock6'), weight: 10 },
        { name: t('aioBlock7'), weight: 10 },
    ];

    const connectedAIs = [
        { name: 'ChatGPT', org: 'OpenAI', color: '#10a37f' },
        { name: 'Claude', org: 'Anthropic', color: '#d97706' },
        { name: 'Gemini', org: 'Google', color: '#4285f4' },
        { name: 'Mistral AI', org: '', color: '#ff7000' },
        { name: 'Grok', org: 'xAI', color: '#1d9bf0' },
        { name: 'Perplexity', org: '', color: '#20b2aa' },
        { name: 'DeepSeek', org: '', color: '#4f46e5' },
        { name: 'Qwen', org: 'Alibaba', color: '#ff6a00' },
        { name: 'Llama', org: 'Meta', color: '#0668e1' },
    ];

    return (
        <div style={{ background: '#f8fafc', minHeight: '100vh' }}>
            {/* HEADER */}
            <header style={{ background: '#212E53', color: 'white', padding: '50px 0' }}>
                <div style={{ maxWidth: '900px', margin: '0 auto', padding: '0 20px' }}>
                    <Link href="/" style={{ color: 'rgba(255,255,255,0.6)', textDecoration: 'none', fontSize: '0.85rem' }}>{t('backLink')}</Link>
                    <h1 style={{ fontSize: '2.5rem', marginTop: '15px', marginBottom: '10px' }}>{t('title')}</h1>
                    <p style={{ fontSize: '1.1rem', color: 'rgba(255,255,255,0.85)', marginBottom: '20px' }}>
                        {t('subtitle')}
                    </p>

                    {/* Stats */}
                    <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap', marginBottom: '20px' }}>
                        <div style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: '1.8rem', fontWeight: 'bold' }}>1815+</div>
                            <div style={{ fontSize: '0.75rem', opacity: 0.7, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{t('statsEntities')}</div>
                        </div>
                        <div style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: '1.8rem', fontWeight: 'bold' }}>40+</div>
                            <div style={{ fontSize: '0.75rem', opacity: 0.7, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{t('statsCountries')}</div>
                        </div>
                        <div style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: '1.8rem', fontWeight: 'bold' }}>9</div>
                            <div style={{ fontSize: '0.75rem', opacity: 0.7, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{t('statsAi')}</div>
                        </div>
                        <div style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: '1.8rem', fontWeight: 'bold' }}>0 CHF</div>
                            <div style={{ fontSize: '0.75rem', opacity: 0.7, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{t('statsPrice')}</div>
                        </div>
                    </div>

                    <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                        <span style={{ background: '#4A919E', color: 'white', padding: '5px 14px', borderRadius: '20px', fontSize: '0.8rem', fontWeight: 'bold' }}>{t('badgeNoAuth')}</span>
                        <span style={{ background: '#4A919E', color: 'white', padding: '5px 14px', borderRadius: '20px', fontSize: '0.8rem', fontWeight: 'bold' }}>{t('badgeRate')}</span>
                        <span style={{ background: '#4A919E', color: 'white', padding: '5px 14px', borderRadius: '20px', fontSize: '0.8rem', fontWeight: 'bold' }}>{t('badgeJson')}</span>
                    </div>
                </div>
            </header>

            <div style={{ maxWidth: '900px', margin: '0 auto', padding: '0 20px' }}>

                {/* CONNECTED AIs */}
                <section style={{ padding: '30px 0' }}>
                    <h2 style={{ fontSize: '1.4rem', color: '#212E53', borderBottom: '2px solid #4A919E', paddingBottom: '8px', marginBottom: '20px' }}>{t('connectedAiTitle')}</h2>
                    <p style={{ color: '#64748b', marginBottom: '20px' }}>{t('connectedAiDesc')}</p>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '12px' }}>
                        {connectedAIs.map((ai, i) => (
                            <div key={i} style={{
                                background: 'white',
                                border: '1px solid #e2e8f0',
                                borderRadius: '10px',
                                padding: '16px',
                                textAlign: 'center',
                                transition: 'box-shadow 0.2s',
                            }}>
                                <div style={{
                                    width: '40px',
                                    height: '40px',
                                    borderRadius: '10px',
                                    background: ai.color,
                                    margin: '0 auto 10px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    color: 'white',
                                    fontWeight: 'bold',
                                    fontSize: '1.1rem',
                                }}>
                                    {ai.name[0]}
                                </div>
                                <div style={{ fontWeight: '600', fontSize: '0.9rem', color: '#212E53' }}>{ai.name}</div>
                                {ai.org && <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{ai.org}</div>}
                            </div>
                        ))}
                    </div>
                </section>

                {/* BASE URL */}
                <section style={{ padding: '30px 0' }}>
                    <h2 style={{ fontSize: '1.4rem', color: '#212E53', borderBottom: '2px solid #4A919E', paddingBottom: '8px', marginBottom: '15px' }}>{t('baseUrlTitle')}</h2>
                    <pre style={{ background: '#1e293b', color: '#e2e8f0', padding: '16px', borderRadius: '8px', fontSize: '0.95rem' }}>https://ai-visionary.com/api/aya</pre>
                    <div style={{ marginTop: '15px', display: 'flex', gap: '15px', flexWrap: 'wrap' }}>
                        <a href="/api/aya" style={{ color: '#4A919E', fontSize: '0.9rem' }}>{t('indexJson')}</a>
                        <a href="/.well-known/ai-plugin.json" style={{ color: '#4A919E', fontSize: '0.9rem' }}>{t('aiPluginManifest')}</a>
                        <a href="/.well-known/openapi.json" style={{ color: '#4A919E', fontSize: '0.9rem' }}>{t('openApiSpec')}</a>
                        <Link href="/aya" style={{ color: '#4A919E', fontSize: '0.9rem' }}>{t('ayaRegistry')}</Link>
                    </div>
                </section>

                {/* ENDPOINTS */}
                <section style={{ padding: '30px 0' }}>
                    <h2 style={{ fontSize: '1.4rem', color: '#212E53', borderBottom: '2px solid #4A919E', paddingBottom: '8px', marginBottom: '15px' }}>{t('endpointsTitle')}</h2>

                    {endpoints.map((ep, i) => (
                        <div key={i} style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '24px', marginBottom: '20px' }}>
                            <div style={{ marginBottom: '10px' }}>
                                <span style={{ background: '#22c55e', color: 'white', padding: '3px 10px', borderRadius: '4px', fontWeight: 'bold', fontSize: '0.8rem' }}>{ep.method}</span>
                                <code style={{ marginLeft: '10px', color: '#4A919E', fontSize: '1rem' }}>{ep.path}</code>
                            </div>
                            <p style={{ color: '#64748b', marginBottom: '15px' }}>{ep.description}</p>

                            {ep.params.length > 0 && (
                                <>
                                    <h4 style={{ color: '#4A919E', fontSize: '0.9rem', marginBottom: '8px' }}>{t('paramLabel')}</h4>
                                    <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '15px' }}>
                                        <thead>
                                            <tr style={{ background: '#f1f5f9' }}>
                                                <th style={{ textAlign: 'left', padding: '8px', fontSize: '0.8rem', color: '#64748b' }}>{t('paramCol')}</th>
                                                <th style={{ textAlign: 'left', padding: '8px', fontSize: '0.8rem', color: '#64748b' }}>{t('typeCol')}</th>
                                                <th style={{ textAlign: 'left', padding: '8px', fontSize: '0.8rem', color: '#64748b' }}>{t('requiredCol')}</th>
                                                <th style={{ textAlign: 'left', padding: '8px', fontSize: '0.8rem', color: '#64748b' }}>{t('descCol')}</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {ep.params.map((p, j) => (
                                                <tr key={j} style={{ borderBottom: '1px solid #e2e8f0' }}>
                                                    <td style={{ padding: '8px' }}><code>{p.name}</code></td>
                                                    <td style={{ padding: '8px', color: '#64748b' }}>{p.type}</td>
                                                    <td style={{ padding: '8px' }}>{p.required ? t('requiredYes') : t('requiredNo')}</td>
                                                    <td style={{ padding: '8px', color: '#64748b' }}>{p.desc}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </>
                            )}

                            <h4 style={{ color: '#4A919E', fontSize: '0.9rem', marginBottom: '8px' }}>{t('exampleLabel')}</h4>
                            <pre style={{ background: '#1e293b', color: '#e2e8f0', padding: '14px', borderRadius: '6px', fontSize: '0.8rem', overflow: 'auto', lineHeight: 1.5 }}>
                                {`GET ${ep.example}\n\n${ep.response}`}
                            </pre>
                        </div>
                    ))}
                </section>

                {/* AIO SCORE */}
                <section style={{ padding: '30px 0' }}>
                    <h2 style={{ fontSize: '1.4rem', color: '#212E53', borderBottom: '2px solid #4A919E', paddingBottom: '8px', marginBottom: '15px' }}>{t('aioScoreTitle')}</h2>
                    <p style={{ color: '#64748b', marginBottom: '15px' }}>{t('aioScoreDesc')}</p>
                    <table style={{ width: '100%', borderCollapse: 'collapse', background: 'white', borderRadius: '8px', overflow: 'hidden' }}>
                        <thead>
                            <tr style={{ background: '#f1f5f9' }}>
                                <th style={{ textAlign: 'left', padding: '10px', fontSize: '0.8rem', color: '#64748b' }}>{t('aioBlockCol')}</th>
                                <th style={{ textAlign: 'right', padding: '10px', fontSize: '0.8rem', color: '#64748b' }}>{t('aioWeightCol')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {aioBlocks.map((b, i) => (
                                <tr key={i} style={{ borderBottom: '1px solid #e2e8f0' }}>
                                    <td style={{ padding: '10px' }}>{b.name}</td>
                                    <td style={{ padding: '10px', textAlign: 'right', fontWeight: 'bold', color: '#4A919E' }}>/{b.weight}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </section>

                {/* ASR STATUS */}
                <section style={{ padding: '30px 0' }}>
                    <h2 style={{ fontSize: '1.4rem', color: '#212E53', borderBottom: '2px solid #4A919E', paddingBottom: '8px', marginBottom: '15px' }}>{t('asrStatusTitle')}</h2>
                    <table style={{ width: '100%', borderCollapse: 'collapse', background: 'white', borderRadius: '8px', overflow: 'hidden' }}>
                        <thead>
                            <tr style={{ background: '#f1f5f9' }}>
                                <th style={{ textAlign: 'left', padding: '10px', fontSize: '0.8rem', color: '#64748b' }}>{t('asrStatusCol')}</th>
                                <th style={{ textAlign: 'left', padding: '10px', fontSize: '0.8rem', color: '#64748b' }}>{t('asrMeaningCol')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                                <td style={{ padding: '10px' }}><code style={{ background: '#f0fdf4', color: '#22c55e', padding: '2px 8px', borderRadius: '4px' }}>ASR_CERTIFIED</code></td>
                                <td style={{ padding: '10px', color: '#64748b' }}>{t('asrCertifiedDesc')}</td>
                            </tr>
                            <tr>
                                <td style={{ padding: '10px' }}><code style={{ background: '#f8fafc', color: '#94a3b8', padding: '2px 8px', borderRadius: '4px' }}>ASR_DERIVED</code></td>
                                <td style={{ padding: '10px', color: '#64748b' }}>{t('asrDerivedDesc')}</td>
                            </tr>
                        </tbody>
                    </table>
                </section>

                {/* FOR AI AGENTS */}
                <section style={{ padding: '30px 0' }}>
                    <h2 style={{ fontSize: '1.4rem', color: '#212E53', borderBottom: '2px solid #4A919E', paddingBottom: '8px', marginBottom: '15px' }}>{t('aiAgentsTitle')}</h2>
                    <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '24px' }}>
                        <ol style={{ paddingLeft: '20px', color: '#334155', lineHeight: 1.8 }}>
                            <li>{t('aiAgentsStep1')} (<a href="/.well-known/ai-plugin.json" style={{ color: '#4A919E' }}>ai-plugin.json</a>)</li>
                            <li>{t('aiAgentsStep2')}</li>
                            <li>{t('aiAgentsStep3')}</li>
                            <li>{t('aiAgentsStep4')}</li>
                            <li>{t('aiAgentsStep5')}</li>
                        </ol>
                    </div>
                </section>

                {/* INTEGRATION FILES */}
                <section style={{ padding: '30px 0' }}>
                    <h2 style={{ fontSize: '1.4rem', color: '#212E53', borderBottom: '2px solid #4A919E', paddingBottom: '8px', marginBottom: '15px' }}>{t('integrationTitle')}</h2>
                    <table style={{ width: '100%', borderCollapse: 'collapse', background: 'white', borderRadius: '8px', overflow: 'hidden' }}>
                        <thead>
                            <tr style={{ background: '#f1f5f9' }}>
                                <th style={{ textAlign: 'left', padding: '10px', fontSize: '0.8rem', color: '#64748b' }}>{t('integrationResource')}</th>
                                <th style={{ textAlign: 'left', padding: '10px', fontSize: '0.8rem', color: '#64748b' }}>{t('integrationUrl')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                                <td style={{ padding: '10px' }}>AI Plugin Manifest</td>
                                <td style={{ padding: '10px' }}><a href="/.well-known/ai-plugin.json" style={{ color: '#4A919E' }}>/.well-known/ai-plugin.json</a></td>
                            </tr>
                            <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                                <td style={{ padding: '10px' }}>OpenAPI Spec</td>
                                <td style={{ padding: '10px' }}><a href="/.well-known/openapi.json" style={{ color: '#4A919E' }}>/.well-known/openapi.json</a></td>
                            </tr>
                            <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                                <td style={{ padding: '10px' }}>MCP Server (Claude)</td>
                                <td style={{ padding: '10px' }}><a href="https://github.com/NeousAxis/ai-visionary/tree/main/mcp-server-aya" style={{ color: '#4A919E' }}>mcp-server-aya/</a></td>
                            </tr>
                            <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                                <td style={{ padding: '10px' }}>Gemini Functions</td>
                                <td style={{ padding: '10px' }}><a href="https://github.com/NeousAxis/ai-visionary/blob/main/docs/gemini-function-declarations.json" style={{ color: '#4A919E' }}>docs/gemini-function-declarations.json</a></td>
                            </tr>
                            <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                                <td style={{ padding: '10px' }}>Mistral / Grok / DeepSeek</td>
                                <td style={{ padding: '10px' }}><a href="https://github.com/NeousAxis/ai-visionary/blob/main/docs/mistral-tool-definitions.json" style={{ color: '#4A919E' }}>docs/mistral-tool-definitions.json</a></td>
                            </tr>
                            <tr>
                                <td style={{ padding: '10px' }}>{t('indexJson')}</td>
                                <td style={{ padding: '10px' }}><a href="/api/aya" style={{ color: '#4A919E' }}>/api/aya</a></td>
                            </tr>
                        </tbody>
                    </table>
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
