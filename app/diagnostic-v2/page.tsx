'use client';

import { useState, useCallback } from 'react';
import Link from 'next/link';
import Image from 'next/image';

// Types
type AgentName = 'detect-contact' | 'detect-services' | 'detect-legal' | 'detect-location' | 'detect-security' | 'detect-jsonld' | 'detect-social';
type AgentStatus = 'waiting' | 'running' | 'done' | 'error';
type Phase = 'idle' | 'fetch' | 'agents' | 'score' | 'complete' | 'error';

interface AgentState {
  name: AgentName;
  label: string;
  labelFr: string;
  icon: string;
  description: string;
  status: AgentStatus;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: any;
  durationMs: number;
}

interface ScoreBlock {
  name: string;
  label: string;
  score: number;
  maxScore: number;
}

const AGENTS: Omit<AgentState, 'status' | 'data' | 'durationMs'>[] = [
  { name: 'detect-jsonld', label: 'Structured Data', labelFr: 'Données structurées', icon: '{ }', description: 'JSON-LD schemas' },
  { name: 'detect-contact', label: 'Contact', labelFr: 'Contact', icon: '@', description: 'Email & phone' },
  { name: 'detect-location', label: 'Location', labelFr: 'Localisation', icon: '◎', description: 'City & country' },
  { name: 'detect-services', label: 'Services', labelFr: 'Services', icon: '◆', description: 'Offers & products' },
  { name: 'detect-legal', label: 'Compliance', labelFr: 'Conformité', icon: '§', description: 'Legal & frameworks' },
  { name: 'detect-security', label: 'Security', labelFr: 'Sécurité', icon: '⬡', description: 'Headers & encryption' },
  { name: 'detect-social', label: 'Social', labelFr: 'Réseaux sociaux', icon: '◈', description: 'Social profiles' },
];

export default function DiagnosticV2Page() {
  const [url, setUrl] = useState('');
  const [phase, setPhase] = useState<Phase>('idle');
  const [agents, setAgents] = useState<AgentState[]>(
    AGENTS.map(a => ({ ...a, status: 'waiting' as const, data: null, durationMs: 0 }))
  );
  const [score, setScore] = useState<{ total: number; blocks: ScoreBlock[] } | null>(null);
  const [totalDuration, setTotalDuration] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [scanUrl, setScanUrl] = useState('');

  const scrollTo = useCallback((id: string) => {
    setTimeout(() => {
      document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 400);
  }, []);

  const startScan = useCallback(async () => {
    if (!url.trim()) return;
    setPhase('fetch');
    setError(null);
    setScore(null);
    setScanUrl(url.trim());
    setAgents(AGENTS.map(a => ({ ...a, status: 'running', data: null, durationMs: 0 })));
    scrollTo('step-agents');

    try {
      const res = await fetch('/api/diagnostic/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim() }),
      });

      if (!res.body) { setError('No response'); setPhase('error'); return; }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const ev = JSON.parse(line.slice(6));
            if (ev.phase === 'agent') {
              setPhase('agents');
              setAgents(prev => prev.map(a =>
                a.name === ev.agent ? { ...a, status: ev.status, data: ev.data, durationMs: ev.durationMs } : a
              ));
            } else if (ev.phase === 'score' && ev.status === 'done' && ev.data) {
              setScore({ total: ev.data.score ?? ev.data.total ?? 0, blocks: ev.data.blocks || ev.data.audit?.blocks || [] });
            } else if (ev.phase === 'complete') {
              setPhase('complete');
              setTotalDuration(ev.totalDurationMs || 0);
              scrollTo('step-score');
              if (ev.score) {
                setScore({ total: ev.score.score ?? ev.score.total ?? 0, blocks: ev.score.blocks || ev.score.audit?.blocks || [] });
              }
            } else if (ev.phase === 'error') {
              setError(ev.message || 'Scan failed');
              setPhase('error');
            }
          } catch { /* skip */ }
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error');
      setPhase('error');
    }
  }, [url, scrollTo]);

  const isScanning = phase === 'fetch' || phase === 'agents';
  const isDone = phase === 'complete';
  const agentsDone = agents.filter(a => a.status === 'done').length;
  const agentsTotal = agents.length;

  return (
    <div className="dv2">
      {/* ─── HEADER ─── */}
      <header className="dv2-header">
        <Link href="/" className="dv2-logo-link">
          <Image src="/logo-v2.png" alt="AI Visionary" width={32} height={32} />
          <span className="dv2-logo-text">AYO</span>
        </Link>
        <div className="dv2-header-right">
          <span className="dv2-version-badge">V2 — Micro-Agents</span>
          <Link href="/diagnostic" className="dv2-link-v1">V1 Classic →</Link>
        </div>
      </header>

      {/* ─── HERO ─── */}
      <section className="dv2-hero">
        <div className="dv2-hero-glow" />
        <div className="dv2-hero-content">
          <div className="dv2-hero-tag">Zero AI Hallucination</div>
          <h1>
            See how AI reads<br />
            <span className="dv2-gradient-text">your website</span>
          </h1>
          <p className="dv2-hero-sub">
            7 deterministic agents scan your site in real-time.<br />
            Every data point is verified — nothing is invented.
          </p>
          <form className="dv2-search-form" onSubmit={e => { e.preventDefault(); startScan(); }}>
            <div className="dv2-search-box">
              <span className="dv2-search-icon">⌕</span>
              <input
                type="text"
                placeholder="yourcompany.com"
                value={url}
                onChange={e => setUrl(e.target.value)}
                disabled={isScanning}
                className="dv2-search-input"
                autoFocus
              />
              <button type="submit" disabled={isScanning || !url.trim()} className="dv2-search-btn">
                {isScanning ? <span className="dv2-spinner" /> : 'Analyze'}
              </button>
            </div>
          </form>
        </div>
      </section>

      {/* ─── AGENTS PANEL ─── */}
      {phase !== 'idle' && (
        <section id="step-agents" className="dv2-section">
          <div className="dv2-section-top">
            <h2>Live Scan</h2>
            <div className="dv2-meta">
              <span className="dv2-url-chip">{scanUrl}</span>
              {isScanning && <span className="dv2-progress-text">{agentsDone}/{agentsTotal} agents</span>}
              {totalDuration > 0 && <span className="dv2-time-chip">⚡ {(totalDuration / 1000).toFixed(1)}s</span>}
            </div>
          </div>

          {/* Progress bar */}
          {isScanning && (
            <div className="dv2-progress-bar">
              <div className="dv2-progress-fill" style={{ width: `${(agentsDone / agentsTotal) * 100}%` }} />
            </div>
          )}

          <div className="dv2-agents-grid">
            {agents.map(agent => (
              <div key={agent.name} className={`dv2-agent dv2-agent--${agent.status}`}>
                <div className="dv2-agent-top">
                  <span className="dv2-agent-icon">{agent.icon}</span>
                  <div className="dv2-agent-info">
                    <span className="dv2-agent-label">{agent.label}</span>
                    <span className="dv2-agent-desc">{agent.description}</span>
                  </div>
                  <span className="dv2-agent-badge">
                    {agent.status === 'waiting' && '—'}
                    {agent.status === 'running' && <span className="dv2-dot-pulse" />}
                    {agent.status === 'done' && '✓'}
                    {agent.status === 'error' && '✗'}
                  </span>
                </div>
                {agent.status === 'done' && agent.data && (
                  <div className="dv2-agent-data">
                    <DataPreview name={agent.name} data={agent.data} />
                    {agent.durationMs > 0 && <span className="dv2-agent-ms">{agent.durationMs}ms</span>}
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ─── SCORE ─── */}
      {score && (
        <section id="step-score" className="dv2-section">
          <h2>AIO Score</h2>
          <div className="dv2-score-panel">
            <div className="dv2-score-ring">
              <svg viewBox="0 0 120 120" className="dv2-ring-svg">
                <circle cx="60" cy="60" r="52" fill="none" stroke="rgba(74,145,158,0.15)" strokeWidth="8" />
                <circle
                  cx="60" cy="60" r="52"
                  fill="none" stroke="url(#scoreGrad)" strokeWidth="8"
                  strokeLinecap="round"
                  strokeDasharray={`${(score.total / 100) * 327} 327`}
                  transform="rotate(-90 60 60)"
                  className="dv2-ring-progress"
                />
                <defs>
                  <linearGradient id="scoreGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#4A919E" />
                    <stop offset="100%" stopColor="#356D76" />
                  </linearGradient>
                </defs>
              </svg>
              <div className="dv2-score-num">
                <span className="dv2-score-big">{Math.round(score.total)}</span>
                <span className="dv2-score-of">/100</span>
              </div>
            </div>

            {score.blocks && score.blocks.length > 0 && (
              <div className="dv2-blocks">
                {score.blocks.map((b, i) => {
                  const pct = b.maxScore > 0 ? (b.score / b.maxScore) * 100 : 0;
                  return (
                    <div key={i} className="dv2-block-row">
                      <span className="dv2-block-name">{b.label || b.name}</span>
                      <div className="dv2-block-track">
                        <div
                          className={`dv2-block-fill ${pct >= 70 ? 'dv2-fill-good' : pct >= 40 ? 'dv2-fill-mid' : 'dv2-fill-low'}`}
                          style={{ width: `${pct}%`, animationDelay: `${i * 100}ms` }}
                        />
                      </div>
                      <span className="dv2-block-val">{b.score?.toFixed?.(1) ?? 0}/{b.maxScore}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </section>
      )}

      {/* ─── PLANS ─── */}
      {isDone && score && (
        <section id="step-plans" className="dv2-section">
          <h2>Boost your AI Readability</h2>
          <p className="dv2-section-sub">Get your ASR identity files and join the AYA Trust Registry.</p>
          <div className="dv2-plans">
            <div className="dv2-plan">
              <div className="dv2-plan-name">AYA Subscription</div>
              <div className="dv2-plan-price">19 <span>CHF/mo</span></div>
              <ul className="dv2-plan-list">
                <li>AYA Trust Registry listing</li>
                <li>Hosted ASR file</li>
                <li>Monthly updates</li>
                <li>Public certificate page</li>
              </ul>
              <button className="dv2-plan-btn dv2-plan-btn--outline">Subscribe</button>
            </div>
            <div className="dv2-plan dv2-plan--pro">
              <div className="dv2-plan-tag">RECOMMENDED</div>
              <div className="dv2-plan-name">PRO Pack</div>
              <div className="dv2-plan-price">499 <span>CHF</span></div>
              <ul className="dv2-plan-list">
                <li>Everything in AYA</li>
                <li>5 ASR identity files</li>
                <li>3 years Registry included</li>
                <li>Ed25519 digital signature</li>
                <li>Score boost up to +20pts</li>
              </ul>
              <button className="dv2-plan-btn dv2-plan-btn--solid">Get PRO Pack</button>
            </div>
          </div>
        </section>
      )}

      {/* ─── COMPARE ─── */}
      {isDone && score && (
        <section id="step-compare" className="dv2-section">
          <h2>Your Position</h2>
          <div className="dv2-compare-card">
            <div className="dv2-compare-row">
              <span className="dv2-compare-label">Your site</span>
              <div className="dv2-compare-track">
                <div className="dv2-compare-fill dv2-compare-fill--you" style={{ width: `${Math.min(score.total, 100)}%` }} />
              </div>
              <span className="dv2-compare-val dv2-compare-val--you">{Math.round(score.total)}</span>
            </div>
            <div className="dv2-compare-row">
              <span className="dv2-compare-label">AYA avg.</span>
              <div className="dv2-compare-track">
                <div className="dv2-compare-fill dv2-compare-fill--avg" style={{ width: '32%' }} />
              </div>
              <span className="dv2-compare-val">32</span>
            </div>
            <div className="dv2-compare-row">
              <span className="dv2-compare-label">With PRO</span>
              <div className="dv2-compare-track">
                <div className="dv2-compare-fill dv2-compare-fill--pro" style={{ width: `${Math.min(score.total + 20, 100)}%` }} />
              </div>
              <span className="dv2-compare-val dv2-compare-val--pro">{Math.min(Math.round(score.total) + 20, 100)}</span>
            </div>
            <p className="dv2-compare-msg">
              {score.total >= 50
                ? '🎉 You are already more AI-readable than most businesses in the registry!'
                : '💡 With ASR files and AYA registration, you could significantly outperform your competitors.'}
            </p>
          </div>
        </section>
      )}

      {/* ─── ERROR ─── */}
      {error && (
        <section className="dv2-section dv2-error-box">
          <p>❌ {error}</p>
          <button onClick={() => { setPhase('idle'); setError(null); }} className="dv2-plan-btn dv2-plan-btn--outline">
            Try again
          </button>
        </section>
      )}

      {/* ─── FOOTER ─── */}
      <footer className="dv2-footer">
        <p>AI Visionary — Geneva, Switzerland · <Link href="/aya">AYA Registry</Link> · {'>'}4,400 entities indexed</p>
      </footer>
    </div>
  );
}

// ─── DATA PREVIEW ───
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function DataPreview({ name, data }: { name: AgentName; data: any }) {
  if (!data) return null;

  switch (name) {
    case 'detect-contact':
      return <div className="dv2-preview">
        {data.email && <span>📧 {data.email}</span>}
        {data.phone && <span>📞 {data.phone}</span>}
        {!data.email && !data.phone && <span className="dv2-muted">—</span>}
      </div>;

    case 'detect-services': {
      const all = [...(data.services || []), ...(data.products || [])];
      return <div className="dv2-preview">
        {all.length > 0
          ? all.slice(0, 3).map((s: string, i: number) => <span key={i}>• {s}</span>)
          : <span className="dv2-muted">—</span>}
        {all.length > 3 && <span className="dv2-muted">+{all.length - 3} more</span>}
      </div>;
    }

    case 'detect-legal': {
      const items = [...(data.policies || []), ...(data.frameworks || []), ...(data.certifications || [])];
      return <div className="dv2-preview">
        {items.length > 0 ? items.slice(0, 3).map((s: string, i: number) => <span key={i}>• {s}</span>) : <span className="dv2-muted">—</span>}
      </div>;
    }

    case 'detect-location':
      return <div className="dv2-preview">
        {(data.city || data.country)
          ? <span>{[data.city, data.country].filter(Boolean).join(', ')}</span>
          : <span className="dv2-muted">—</span>}
      </div>;

    case 'detect-security': {
      const m = (data.measures || []) as string[];
      return <div className="dv2-preview">
        {m.length > 0 ? m.slice(0, 4).map((s: string, i: number) => <span key={i}>{s}</span>) : <span className="dv2-muted">—</span>}
      </div>;
    }

    case 'detect-jsonld':
      return <div className="dv2-preview">
        {data.hasOrganizationType
          ? <span>✓ {data.type || 'Organization'}{data.name ? ` — ${data.name}` : ''}</span>
          : (data.schemas?.length > 0 ? <span>⚠ JSON-LD found, no Org type</span> : <span className="dv2-muted">—</span>)}
      </div>;

    case 'detect-social': {
      const p = (data.platforms || []) as string[];
      return <div className="dv2-preview">
        {p.length > 0 ? <span>{p.join(' · ')}</span> : <span className="dv2-muted">—</span>}
      </div>;
    }

    default: return null;
  }
}
