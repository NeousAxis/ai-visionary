'use client';

import { useState, useCallback, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';

// ─── Types ───
type AgentName = 'detect-contact' | 'detect-services' | 'detect-legal' | 'detect-location' | 'detect-security' | 'detect-jsonld' | 'detect-social';
type AgentStatus = 'waiting' | 'running' | 'done' | 'error';

interface AgentState {
  name: AgentName;
  label: string;
  icon: string;
  desc: string;
  status: AgentStatus;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: any;
  durationMs: number;
}

interface ScoreBlock { name: string; label: string; score: number; maxScore: number; }

const AGENTS: Omit<AgentState, 'status' | 'data' | 'durationMs'>[] = [
  { name: 'detect-jsonld', label: 'Structured Data', icon: '{ }', desc: 'Parsing JSON-LD schemas...' },
  { name: 'detect-contact', label: 'Contact Info', icon: '@', desc: 'Finding email & phone...' },
  { name: 'detect-location', label: 'Location', icon: '◎', desc: 'Detecting city & country...' },
  { name: 'detect-services', label: 'Services', icon: '◆', desc: 'Extracting offers & products...' },
  { name: 'detect-legal', label: 'Compliance', icon: '§', desc: 'Checking legal & frameworks...' },
  { name: 'detect-security', label: 'Security', icon: '⬡', desc: 'Analyzing headers & encryption...' },
  { name: 'detect-social', label: 'Social', icon: '◈', desc: 'Scanning social profiles...' },
];

const FILES = [
  { name: 'ASR-Protocol.json', desc: 'Digital identity — Ed25519 signed' },
  { name: 'manifest.json', desc: 'Structured business profile' },
  { name: 'faq.json', desc: 'AI-ready FAQ schema' },
  { name: 'glossary.json', desc: 'Industry terminology' },
  { name: 'external_context.json', desc: 'Ecosystem & recommendations' },
];

// ─── Step tracking ───
type Step = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

export default function DiagnosticV2Page() {
  const [url, setUrl] = useState('');
  const [currentStep, setCurrentStep] = useState<Step>(1);
  const [agents, setAgents] = useState<AgentState[]>(
    AGENTS.map(a => ({ ...a, status: 'waiting' as const, data: null, durationMs: 0 }))
  );
  const [score, setScore] = useState<{ total: number; blocks: ScoreBlock[] } | null>(null);
  const [totalDuration, setTotalDuration] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [scanUrl, setScanUrl] = useState('');
  const [filesRevealed, setFilesRevealed] = useState<number>(0);
  const [scoreRevealed, setScoreRevealed] = useState(false);

  const scrollTo = useCallback((id: string) => {
    setTimeout(() => {
      document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 300);
  }, []);

  // Step 4: Animate file reveals one by one
  useEffect(() => {
    if (currentStep === 4 && filesRevealed < FILES.length) {
      const timer = setTimeout(() => setFilesRevealed(f => f + 1), 600);
      return () => clearTimeout(timer);
    }
    if (currentStep === 4 && filesRevealed === FILES.length) {
      // Auto-advance to step 5 after all files shown
      setTimeout(() => { setCurrentStep(5); scrollTo('step-5'); }, 1000);
    }
  }, [currentStep, filesRevealed, scrollTo]);

  // Step 3: Animate score reveal
  useEffect(() => {
    if (currentStep === 3 && score && !scoreRevealed) {
      const timer = setTimeout(() => {
        setScoreRevealed(true);
        // Auto-advance to step 4
        setTimeout(() => { setCurrentStep(4); scrollTo('step-4'); }, 1500);
      }, 800);
      return () => clearTimeout(timer);
    }
  }, [currentStep, score, scoreRevealed, scrollTo]);

  // ─── Start Scan ───
  const startScan = useCallback(async () => {
    if (!url.trim()) return;
    setCurrentStep(2);
    setError(null);
    setScore(null);
    setScoreRevealed(false);
    setFilesRevealed(0);
    setScanUrl(url.trim());
    setAgents(AGENTS.map(a => ({ ...a, status: 'running', data: null, durationMs: 0 })));
    scrollTo('step-2');

    try {
      const res = await fetch('/api/diagnostic/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim() }),
      });
      if (!res.body) { setError('No response'); return; }

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
              setAgents(prev => prev.map(a =>
                a.name === ev.agent ? { ...a, status: ev.status, data: ev.data, durationMs: ev.durationMs } : a
              ));
            } else if (ev.phase === 'complete') {
              setTotalDuration(ev.totalDurationMs || 0);
              if (ev.score) {
                setScore({
                  total: ev.score.score ?? ev.score.total ?? 0,
                  blocks: ev.score.blocks || ev.score.audit?.blocks || [],
                });
              }
              // Move to step 3 (scoring)
              setTimeout(() => { setCurrentStep(3); scrollTo('step-3'); }, 500);
            } else if (ev.phase === 'error') {
              setError(ev.message || 'Scan failed');
            }
          } catch { /* skip */ }
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error');
    }
  }, [url, scrollTo]);

  const agentsDone = agents.filter(a => a.status === 'done').length;

  return (
    <div className="dv2">
      {/* ─── HEADER ─── */}
      <header className="dv2-header">
        <Link href="/" className="dv2-logo-link">
          <Image src="/logo-v2.png" alt="AI Visionary" width={28} height={28} />
          <span className="dv2-logo-text">AYO</span>
        </Link>
        <div className="dv2-header-right">
          <span className="dv2-version-badge">V2 — Micro-Agents</span>
          <Link href="/diagnostic" className="dv2-link-v1">V1 Classic →</Link>
        </div>
      </header>

      {/* ═══ STEP 1 — URL INPUT ═══ */}
      <section id="step-1" className="dv2-step">
        <div className="dv2-step-num">01</div>
        <div className="dv2-hero-content">
          <h1>
            Analyze how AI reads <span className="dv2-accent">your website</span>
          </h1>
          <p className="dv2-hero-sub">
            7 deterministic micro-agents scan your site in real-time.<br />
            Every data point is verified. Nothing is invented.
          </p>
          <form className="dv2-search-form" onSubmit={e => { e.preventDefault(); startScan(); }}>
            <div className="dv2-search-box">
              <input
                type="text"
                placeholder="yourcompany.com"
                value={url}
                onChange={e => setUrl(e.target.value)}
                disabled={currentStep > 1}
                className="dv2-search-input"
                autoFocus
              />
              <button type="submit" disabled={currentStep > 1 || !url.trim()} className="dv2-search-btn">
                {currentStep > 1 ? <span className="dv2-spinner" /> : 'Analyze →'}
              </button>
            </div>
          </form>
        </div>
      </section>

      {/* ═══ STEP 2 — LIVE SCAN ═══ */}
      {currentStep >= 2 && (
        <section id="step-2" className={`dv2-step dv2-step-reveal ${currentStep === 2 ? 'dv2-step-active' : ''}`}>
          <div className="dv2-step-num">02</div>
          <div className="dv2-step-header">
            <h2>Live Scan — Micro-Agents</h2>
            <div className="dv2-step-meta">
              <span className="dv2-chip">{scanUrl}</span>
              {currentStep === 2 && <span className="dv2-chip dv2-chip-teal">{agentsDone}/{AGENTS.length} agents</span>}
              {totalDuration > 0 && <span className="dv2-chip dv2-chip-teal">⚡ {(totalDuration / 1000).toFixed(1)}s</span>}
            </div>
          </div>

          {currentStep === 2 && (
            <div className="dv2-progress-bar">
              <div className="dv2-progress-fill" style={{ width: `${(agentsDone / AGENTS.length) * 100}%` }} />
            </div>
          )}

          <div className="dv2-agents-grid">
            {agents.map(agent => (
              <div key={agent.name} className={`dv2-agent dv2-agent--${agent.status}`}>
                <div className="dv2-agent-top">
                  <span className="dv2-agent-icon">{agent.icon}</span>
                  <div className="dv2-agent-info">
                    <span className="dv2-agent-label">{agent.label}</span>
                    <span className="dv2-agent-desc">
                      {agent.status === 'running' ? agent.desc : agent.status === 'done' ? 'Complete' : agent.status === 'error' ? 'Failed' : '—'}
                    </span>
                  </div>
                  <span className={`dv2-agent-badge dv2-badge-${agent.status}`}>
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

      {/* ═══ STEP 3 — SCORING ═══ */}
      {currentStep >= 3 && score && (
        <section id="step-3" className={`dv2-step dv2-step-reveal ${currentStep === 3 ? 'dv2-step-active' : ''}`}>
          <div className="dv2-step-num">03</div>
          <h2>AIO Score Calculation</h2>
          <p className="dv2-step-sub">Computing score across 7 weighted blocks...</p>

          <div className="dv2-score-panel">
            <div className="dv2-score-ring">
              <svg viewBox="0 0 120 120" className="dv2-ring-svg">
                <circle cx="60" cy="60" r="52" fill="none" stroke="#E2EFE9" strokeWidth="8" />
                <circle cx="60" cy="60" r="52" fill="none" stroke="url(#sg)" strokeWidth="8" strokeLinecap="round"
                  strokeDasharray={scoreRevealed ? `${(score.total / 100) * 327} 327` : '0 327'}
                  transform="rotate(-90 60 60)" style={{ transition: 'stroke-dasharray 1.2s ease-out' }} />
                <defs><linearGradient id="sg" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#4A919E" /><stop offset="100%" stopColor="#356D76" />
                </linearGradient></defs>
              </svg>
              <div className="dv2-score-num">
                <span className="dv2-score-big">{scoreRevealed ? Math.round(score.total) : '—'}</span>
                <span className="dv2-score-of">/100</span>
              </div>
            </div>

            {score.blocks?.length > 0 && (
              <div className="dv2-blocks">
                {score.blocks.map((b, i) => {
                  const pct = b.maxScore > 0 ? (b.score / b.maxScore) * 100 : 0;
                  return (
                    <div key={i} className="dv2-block-row" style={{ animationDelay: `${i * 120}ms` }}>
                      <span className="dv2-block-name">{b.label || b.name}</span>
                      <div className="dv2-block-track">
                        <div className={`dv2-block-fill ${pct >= 70 ? 'dv2-fill-good' : pct >= 40 ? 'dv2-fill-mid' : 'dv2-fill-low'}`}
                          style={{ width: scoreRevealed ? `${pct}%` : '0%', transition: `width 0.8s ease-out ${i * 120}ms` }} />
                      </div>
                      <span className="dv2-block-val">{scoreRevealed ? `${b.score?.toFixed?.(1) ?? 0}/${b.maxScore}` : '—'}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </section>
      )}

      {/* ═══ STEP 4 — FILE GENERATION ═══ */}
      {currentStep >= 4 && (
        <section id="step-4" className={`dv2-step dv2-step-reveal ${currentStep === 4 ? 'dv2-step-active' : ''}`}>
          <div className="dv2-step-num">04</div>
          <h2>Generating ASR Files</h2>
          <p className="dv2-step-sub">Creating your 5 AI-readable identity files...</p>

          <div className="dv2-files-list">
            {FILES.map((file, i) => {
              const revealed = i < filesRevealed;
              return (
                <div key={file.name} className={`dv2-file-row ${revealed ? 'dv2-file-done' : 'dv2-file-pending'}`}>
                  <span className="dv2-file-icon">{revealed ? '✓' : currentStep === 4 && i === filesRevealed ? '◌' : '—'}</span>
                  <div className="dv2-file-info">
                    <span className="dv2-file-name">{file.name}</span>
                    <span className="dv2-file-desc">{file.desc}</span>
                  </div>
                  {revealed && <span className="dv2-file-check">Ready</span>}
                  {currentStep === 4 && i === filesRevealed && <span className="dv2-file-generating"><span className="dv2-dot-pulse" /> Generating...</span>}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* ═══ STEP 5 — SUBSCRIPTION CHOICE ═══ */}
      {currentStep >= 5 && (
        <section id="step-5" className={`dv2-step dv2-step-reveal ${currentStep === 5 ? 'dv2-step-active' : ''}`}>
          <div className="dv2-step-num">05</div>
          <h2>Choose Your Plan</h2>
          <p className="dv2-step-sub">Activate your AI identity and join the AYA Trust Registry.</p>

          <div className="dv2-plans">
            <div className="dv2-plan" onClick={() => { setCurrentStep(6); scrollTo('step-6'); }}>
              <div className="dv2-plan-name">AYA Subscription</div>
              <div className="dv2-plan-price">19 <span>CHF/mo</span></div>
              <ul className="dv2-plan-list">
                <li>AYA Trust Registry listing</li>
                <li>Hosted ASR file</li>
                <li>Monthly updates</li>
                <li>Public certificate page</li>
              </ul>
              <button className="dv2-plan-btn dv2-plan-btn--outline">Select AYA →</button>
            </div>
            <div className="dv2-plan dv2-plan--pro" onClick={() => { setCurrentStep(6); scrollTo('step-6'); }}>
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
              <button className="dv2-plan-btn dv2-plan-btn--solid">Select PRO →</button>
            </div>
          </div>
        </section>
      )}

      {/* ═══ STEP 6 — PAYMENT ═══ */}
      {currentStep >= 6 && (
        <section id="step-6" className={`dv2-step dv2-step-reveal ${currentStep === 6 ? 'dv2-step-active' : ''}`}>
          <div className="dv2-step-num">06</div>
          <h2>Payment</h2>
          <div className="dv2-payment-box">
            <p>You will be redirected to Stripe for secure payment.</p>
            <button className="dv2-search-btn" onClick={() => { setCurrentStep(7); scrollTo('step-7'); }}>
              Proceed to Payment →
            </button>
            <p className="dv2-payment-note">🔒 Secure checkout powered by Stripe</p>
          </div>
        </section>
      )}

      {/* ═══ STEP 7 — CONFIRMATION ═══ */}
      {currentStep >= 7 && (
        <section id="step-7" className={`dv2-step dv2-step-reveal ${currentStep === 7 ? 'dv2-step-active' : ''}`}>
          <div className="dv2-step-num">07</div>
          <h2>Confirmation</h2>
          <div className="dv2-confirm-box">
            <div className="dv2-confirm-icon">✓</div>
            <h3>Your AI identity is being activated</h3>
            <p>You will receive an email with your files and certificate link.</p>
            <ul className="dv2-confirm-list">
              <li>📧 Confirmation email sent</li>
              <li>📁 ASR files attached (PRO) or hosted (AYA)</li>
              <li>🏛️ AYA Registry entry activated</li>
              <li>🔗 Public certificate page live</li>
            </ul>
            <button className="dv2-plan-btn dv2-plan-btn--solid" onClick={() => { setCurrentStep(8); scrollTo('step-8'); }}>
              See how you compare →
            </button>
          </div>
        </section>
      )}

      {/* ═══ STEP 8 — COMPARE ═══ */}
      {currentStep >= 8 && score && (
        <section id="step-8" className={`dv2-step dv2-step-reveal ${currentStep === 8 ? 'dv2-step-active' : ''}`}>
          <div className="dv2-step-num">08</div>
          <h2>Your Position in the AI Ecosystem</h2>
          <p className="dv2-step-sub">See how your AI readability compares to {'>'}4,400 entities in the AYA Registry.</p>

          <div className="dv2-compare-card">
            <div className="dv2-compare-row">
              <span className="dv2-compare-label">Your site</span>
              <div className="dv2-compare-track"><div className="dv2-compare-fill dv2-compare-fill--you" style={{ width: `${Math.min(score.total, 100)}%` }} /></div>
              <span className="dv2-compare-val dv2-val-you">{Math.round(score.total)}</span>
            </div>
            <div className="dv2-compare-row">
              <span className="dv2-compare-label">Registry avg.</span>
              <div className="dv2-compare-track"><div className="dv2-compare-fill dv2-compare-fill--avg" style={{ width: '32%' }} /></div>
              <span className="dv2-compare-val">32</span>
            </div>
            <div className="dv2-compare-row">
              <span className="dv2-compare-label">With PRO</span>
              <div className="dv2-compare-track"><div className="dv2-compare-fill dv2-compare-fill--pro" style={{ width: `${Math.min(score.total + 20, 100)}%` }} /></div>
              <span className="dv2-compare-val dv2-val-pro">{Math.min(Math.round(score.total) + 20, 100)}</span>
            </div>
            <p className="dv2-compare-msg">
              {score.total >= 50
                ? '🎉 Your site is already more AI-readable than most businesses!'
                : '💡 With ASR files and AYA registration, your AI discoverability would significantly increase.'}
            </p>
          </div>
        </section>
      )}

      {/* ─── ERROR ─── */}
      {error && (
        <section className="dv2-step dv2-error-box">
          <p>❌ {error}</p>
          <button onClick={() => { setCurrentStep(1); setError(null); }} className="dv2-plan-btn dv2-plan-btn--outline">Try again</button>
        </section>
      )}

      {/* ─── FOOTER ─── */}
      <footer className="dv2-footer">
        <p>AI Visionary — Geneva, Switzerland · <Link href="/aya">AYA Registry</Link> · {'>'}4,400 entities indexed</p>
      </footer>
    </div>
  );
}

// ─── Data Preview ───
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function DataPreview({ name, data }: { name: AgentName; data: any }) {
  if (!data) return null;
  switch (name) {
    case 'detect-contact':
      return <div className="dv2-preview">{data.email && <span>📧 {data.email}</span>}{data.phone && <span>📞 {data.phone}</span>}{!data.email && !data.phone && <span className="dv2-muted">No contact found</span>}</div>;
    case 'detect-services': {
      const all = [...(data.services || []), ...(data.products || [])];
      return <div className="dv2-preview">{all.length > 0 ? all.slice(0, 3).map((s: string, i: number) => <span key={i}>• {s}</span>) : <span className="dv2-muted">None detected</span>}{all.length > 3 && <span className="dv2-muted">+{all.length - 3} more</span>}</div>;
    }
    case 'detect-legal': {
      const items = [...(data.policies || []), ...(data.frameworks || []), ...(data.certifications || [])];
      return <div className="dv2-preview">{items.length > 0 ? items.slice(0, 3).map((s: string, i: number) => <span key={i}>• {s}</span>) : <span className="dv2-muted">None detected</span>}</div>;
    }
    case 'detect-location':
      return <div className="dv2-preview">{(data.city || data.country) ? <span>{[data.city, data.country].filter(Boolean).join(', ')}</span> : <span className="dv2-muted">Not found</span>}</div>;
    case 'detect-security': {
      const m = (data.measures || []) as string[];
      return <div className="dv2-preview">{m.length > 0 ? m.slice(0, 4).map((s: string, i: number) => <span key={i}>{s}</span>) : <span className="dv2-muted">No headers</span>}</div>;
    }
    case 'detect-jsonld':
      return <div className="dv2-preview">{data.hasOrganizationType ? <span>✓ {data.type}{data.name ? ` — ${data.name}` : ''}</span> : data.schemas?.length > 0 ? <span>⚠ JSON-LD but no Org type</span> : <span className="dv2-muted">Not found</span>}</div>;
    case 'detect-social': {
      const p = (data.platforms || []) as string[];
      return <div className="dv2-preview">{p.length > 0 ? <span>{p.join(' · ')}</span> : <span className="dv2-muted">None found</span>}</div>;
    }
    default: return null;
  }
}
