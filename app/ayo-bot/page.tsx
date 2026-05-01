import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'AYOBot — AI Visionary Web Crawler',
  description: 'AYOBot is the official web crawler for AI Visionary\'s AYO diagnostic. Learn how to whitelist it.',
  openGraph: {
    title: 'AYOBot — AI Visionary Web Crawler',
    description: 'AYOBot is the official web crawler for AI Visionary\'s AYO diagnostic. Learn how to whitelist it.',
    url: 'https://ai-visionary.xyz/ayo-bot',
    siteName: 'AI Visionary',
    type: 'website',
  },
};

export default function AyoBotPage() {
  return (
    <main style={{ maxWidth: 720, margin: '0 auto', padding: '3rem 1.5rem', fontFamily: 'var(--font-main, system-ui, sans-serif)', color: '#1a1a2e' }}>
      <h1 style={{ fontSize: '2rem', fontWeight: 800, marginBottom: '0.5rem' }}>AYOBot/2.0</h1>
      <p style={{ fontSize: '1.1rem', color: '#555', marginBottom: '2rem' }}>
        The official web crawler for <strong>AI Visionary</strong>&apos;s AYO AI-readability diagnostic.
      </p>

      <section style={{ marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '1.3rem', fontWeight: 700, marginBottom: '0.5rem' }}>What is AYOBot?</h2>
        <p>
          AYOBot scans websites to evaluate their AI-readability (AIO Score). It extracts publicly
          available structured data (JSON-LD, meta tags, text content) to assess how well AI systems
          can understand and recommend a business.
        </p>
      </section>

      <section style={{ marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '1.3rem', fontWeight: 700, marginBottom: '0.5rem' }}>User-Agent String</h2>
        <code style={{ display: 'block', background: '#f4f4f5', padding: '0.75rem 1rem', borderRadius: 8, fontSize: '0.9rem', wordBreak: 'break-all' }}>
          AYOBot/2.0 (+https://ai-visionary.xyz/ayo-bot)
        </code>
      </section>

      <section style={{ marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '1.3rem', fontWeight: 700, marginBottom: '0.5rem' }}>Crawl Behavior</h2>
        <ul style={{ paddingLeft: '1.25rem', lineHeight: 1.8 }}>
          <li><strong>Polite crawler</strong> — one request per scan, not a spider</li>
          <li><strong>On-demand only</strong> — triggered by a user submitting a URL for diagnostic</li>
          <li><strong>Read-only</strong> — never submits forms, creates accounts, or modifies data</li>
          <li><strong>Respects robots.txt</strong> — honors <code>User-agent: AYOBot</code> directives</li>
          <li><strong>No personal data collection</strong> — only extracts publicly visible business information</li>
        </ul>
      </section>

      <section style={{ marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '1.3rem', fontWeight: 700, marginBottom: '0.5rem' }}>How to Whitelist AYOBot</h2>

        <h3 style={{ fontSize: '1rem', fontWeight: 600, marginTop: '1rem', marginBottom: '0.25rem' }}>Cloudflare</h3>
        <p>
          Go to <strong>Security &gt; WAF &gt; Custom Rules</strong>. Create a rule:
        </p>
        <code style={{ display: 'block', background: '#f4f4f5', padding: '0.75rem 1rem', borderRadius: 8, fontSize: '0.85rem', margin: '0.5rem 0' }}>
          (http.user_agent contains &quot;AYOBot&quot;) &rarr; Action: Skip
        </code>

        <h3 style={{ fontSize: '1rem', fontWeight: 600, marginTop: '1rem', marginBottom: '0.25rem' }}>robots.txt</h3>
        <code style={{ display: 'block', background: '#f4f4f5', padding: '0.75rem 1rem', borderRadius: 8, fontSize: '0.85rem', margin: '0.5rem 0', whiteSpace: 'pre' }}>
{`User-agent: AYOBot
Allow: /`}
        </code>
      </section>

      <section style={{ marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '1.3rem', fontWeight: 700, marginBottom: '0.5rem' }}>Contact</h2>
        <p>
          Questions or abuse reports: <a href="mailto:hello@ai-visionary.xyz" style={{ color: '#4A919E', textDecoration: 'underline' }}>hello@ai-visionary.xyz</a>
        </p>
        <p style={{ marginTop: '0.5rem' }}>
          <a href="https://ai-visionary.xyz" style={{ color: '#4A919E', textDecoration: 'underline' }}>AI Visionary</a> — Geneva, Switzerland
        </p>
      </section>
    </main>
  );
}
