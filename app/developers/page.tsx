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
            url: 'https://ai-visionary.xyz/developers',
            siteName: 'AI Visionary',
            type: 'website',
        },
    };
}

export default async function DevelopersPage() {
    const t = await getTranslations('developersPage');

    let totalEntities = 4400;
    let countriesCount = 73;
    try {
        const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
        const res = await fetch(`${baseUrl}/api/aya/stats`, { next: { revalidate: 600 } });
        if (res.ok) {
            const data = await res.json();
            totalEntities = data.total_entities || totalEntities;
            countriesCount = data.countries?.length || countriesCount;
        }
    } catch { /* keep defaults */ }

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
    "certificate_url": "https://ai-visionary.xyz/aya/e/..."
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
    "certificate_url": "https://ai-visionary.xyz/aya/e/..."
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
  "total_entities": ${totalEntities},
  "certified_count": 3,
  "indexed_count": ${totalEntities - 3},
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

    const dataSources = [
        {
            title: t('dataSource1Title'),
            desc: t('dataSource1Desc'),
            color: '#4A919E',
            url: 'https://ai-visionary.xyz/api/aya/llm/{domain}',
            linkHref: '/api/aya/llm/stripe.com',
            external: false,
        },
        {
            title: t('dataSource2Title'),
            desc: t('dataSource2Desc'),
            color: '#22c55e',
            url: 'ai-visionary.xyz/aya',
            linkHref: '/aya',
            external: false,
        },
        {
            title: t('dataSource3Title'),
            desc: t('dataSource3Desc'),
            color: '#333',
            url: 'github.com/NeousAxis/aya-business-dataset',
            linkHref: 'https://github.com/NeousAxis/aya-business-dataset',
            external: true,
        },
        {
            title: t('dataSource4Title'),
            desc: t('dataSource4Desc'),
            color: '#ff9d00',
            url: 'huggingface.co/datasets/NeousAxis/aya-business-dataset',
            linkHref: 'https://huggingface.co/datasets/NeousAxis/aya-business-dataset',
            external: true,
        },
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
                            <div style={{ fontSize: '1.8rem', fontWeight: 'bold' }}>{totalEntities.toLocaleString()}+</div>
                            <div style={{ fontSize: '0.75rem', opacity: 0.7, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{t('statsEntities')}</div>
                        </div>
                        <div style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: '1.8rem', fontWeight: 'bold' }}>{countriesCount}+</div>
                            <div style={{ fontSize: '0.75rem', opacity: 0.7, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{t('statsCountries')}</div>
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

                {/* HOW AIs FIND AYA DATA */}
                <section style={{ padding: '30px 0' }}>
                    <h2 style={{ fontSize: '1.4rem', color: '#212E53', borderBottom: '2px solid #4A919E', paddingBottom: '8px', marginBottom: '10px' }}>{t('dataLayerTitle')}</h2>
                    <p style={{ color: '#64748b', marginBottom: '20px' }}>{t('dataLayerDesc')}</p>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))', gap: '16px' }}>
                        {dataSources.map((ds, i) => (
                            <div key={i} style={{
                                background: 'white',
                                border: '1px solid #e2e8f0',
                                borderLeft: `4px solid ${ds.color}`,
                                borderRadius: '10px',
                                padding: '24px',
                            }}>
                                <h3 style={{ fontSize: '1.05rem', color: '#212E53', marginBottom: '6px', marginTop: 0 }}>{ds.title}</h3>
                                <p style={{ color: '#64748b', fontSize: '0.9rem', marginBottom: '10px', lineHeight: 1.5 }}>{ds.desc}</p>
                                <code style={{ fontSize: '0.8rem', color: ds.color, wordBreak: 'break-all' }}>{ds.url}</code>
                                <div style={{ marginTop: '10px' }}>
                                    {ds.external ? (
                                        <a href={ds.linkHref} target="_blank" rel="noopener noreferrer" style={{ color: '#4A919E', fontSize: '0.85rem', textDecoration: 'none' }}>
                                            {ds.linkHref.replace('https://', '')} &rarr;
                                        </a>
                                    ) : (
                                        <Link href={ds.linkHref} style={{ color: '#4A919E', fontSize: '0.85rem', textDecoration: 'none' }}>
                                            {ds.linkHref} &rarr;
                                        </Link>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Scale statement */}
                    <div style={{
                        marginTop: '24px',
                        background: '#f0fdfa',
                        border: '1px solid #99f6e4',
                        borderRadius: '8px',
                        padding: '18px 24px',
                        color: '#0f766e',
                        fontSize: '0.95rem',
                        lineHeight: 1.6,
                    }}>
                        {t('scaleStatement', { count: totalEntities.toLocaleString(), countries: String(countriesCount) })}
                    </div>
                </section>

                {/* GITHUB & HUGGINGFACE DETAILS */}
                <section style={{ padding: '20px 0 30px' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))', gap: '16px' }}>
                        {/* GitHub */}
                        <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '24px' }}>
                            <h3 style={{ fontSize: '1.1rem', color: '#212E53', marginTop: 0, marginBottom: '8px' }}>{t('githubTitle')}</h3>
                            <p style={{ color: '#64748b', fontSize: '0.9rem', lineHeight: 1.5, marginBottom: '12px' }}>{t('githubDesc')}</p>
                            <a
                                href="https://github.com/NeousAxis/aya-business-dataset"
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{
                                    display: 'inline-block',
                                    background: '#24292f',
                                    color: 'white',
                                    padding: '6px 16px',
                                    borderRadius: '6px',
                                    fontSize: '0.85rem',
                                    fontWeight: '600',
                                    textDecoration: 'none',
                                }}
                            >
                                {t('githubLink')} &rarr;
                            </a>
                        </div>
                        {/* HuggingFace */}
                        <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '24px' }}>
                            <h3 style={{ fontSize: '1.1rem', color: '#212E53', marginTop: 0, marginBottom: '8px' }}>{t('huggingfaceTitle')}</h3>
                            <p style={{ color: '#64748b', fontSize: '0.9rem', lineHeight: 1.5, marginBottom: '12px' }}>{t('huggingfaceDesc')}</p>
                            <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                                <a
                                    href="https://huggingface.co/datasets/NeousAxis/aya-business-dataset"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    style={{
                                        display: 'inline-block',
                                        background: '#ff9d00',
                                        color: 'white',
                                        padding: '6px 16px',
                                        borderRadius: '6px',
                                        fontSize: '0.85rem',
                                        fontWeight: '600',
                                        textDecoration: 'none',
                                    }}
                                >
                                    {t('huggingfaceLink')} &rarr;
                                </a>
                                <span style={{
                                    background: '#fef3c7',
                                    color: '#92400e',
                                    padding: '3px 10px',
                                    borderRadius: '4px',
                                    fontSize: '0.75rem',
                                    fontWeight: 'bold',
                                }}>
                                    {t('licenseBadge')}
                                </span>
                            </div>
                        </div>
                    </div>
                </section>

                {/* BASE URL */}
                <section style={{ padding: '30px 0' }}>
                    <h2 style={{ fontSize: '1.4rem', color: '#212E53', borderBottom: '2px solid #4A919E', paddingBottom: '8px', marginBottom: '15px' }}>{t('baseUrlTitle')}</h2>
                    <pre style={{ background: '#1e293b', color: '#e2e8f0', padding: '16px', borderRadius: '8px', fontSize: '0.95rem' }}>https://ai-visionary.xyz/api/aya</pre>
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
                                <td style={{ padding: '10px' }}>{t('integrationLlmApi')}</td>
                                <td style={{ padding: '10px' }}><a href="/api/aya/llm/stripe.com" style={{ color: '#4A919E' }}>/api/aya/llm/&#123;domain&#125;</a></td>
                            </tr>
                            <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                                <td style={{ padding: '10px' }}>{t('integrationGithub')}</td>
                                <td style={{ padding: '10px' }}><a href="https://github.com/NeousAxis/aya-business-dataset" target="_blank" rel="noopener noreferrer" style={{ color: '#4A919E' }}>github.com/NeousAxis/aya-business-dataset</a></td>
                            </tr>
                            <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                                <td style={{ padding: '10px' }}>{t('integrationHuggingface')}</td>
                                <td style={{ padding: '10px' }}><a href="https://huggingface.co/datasets/NeousAxis/aya-business-dataset" target="_blank" rel="noopener noreferrer" style={{ color: '#4A919E' }}>huggingface.co/datasets/NeousAxis/aya-business-dataset</a></td>
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
