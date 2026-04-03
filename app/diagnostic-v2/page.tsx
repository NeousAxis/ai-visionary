'use client';

import { useState, useRef, useCallback } from 'react';
import Link from 'next/link';
import Image from 'next/image';

// Types for SSE events
type AgentName = 'detect-contact' | 'detect-services' | 'detect-legal' | 'detect-location' | 'detect-security' | 'detect-jsonld' | 'detect-social';
type AgentStatus = 'waiting' | 'running' | 'done' | 'error';
type Phase = 'idle' | 'fetch' | 'agents' | 'score' | 'complete' | 'error';

interface AgentState {
  name: AgentName;
  label: string;
  icon: string;
  status: AgentStatus;
  data: Record<string, unknown> | null;
  durationMs: number;
}

interface ScoreBlock {
  name: string;
  label: string;
  score: number;
  maxScore: number;
}

const AGENT_DEFS: Omit<AgentState, 'status' | 'data' | 'durationMs'>[] = [
  { name: 'detect-jsonld', label: 'Structured Data', icon: '🔗' },
  { name: 'detect-contact', label: 'Contact Info', icon: '📧' },
  { name: 'detect-location', label: 'Location', icon: '📍' },
  { name: 'detect-services', label: 'Services & Products', icon: '🛠️' },
  { name: 'detect-legal', label: 'Legal & Compliance', icon: '⚖️' },
  { name: 'detect-security', label: 'Security', icon: '🔒' },
  { name: 'detect-social', label: 'Social Media', icon: '🌐' },
];

export default function DiagnosticV2Page() {
  const [url, setUrl] = useState('');
  const [phase, setPhase] = useState<Phase>('idle');
  const [agents, setAgents] = useState<AgentState[]>(
    AGENT_DEFS.map(a => ({ ...a, status: 'waiting', data: null, durationMs: 0 }))
  );
  const [score, setScore] = useState<{ total: number; blocks: ScoreBlock[] } | null>(null);
  const [totalDuration, setTotalDuration] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [scanUrl, setScanUrl] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  const scrollToStep = useCallback((id: string) => {
    setTimeout(() => {
      document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 300);
  }, []);

  const startScan = useCallback(async () => {
    if (!url.trim()) return;

    // Reset state
    setPhase('fetch');
    setError(null);
    setScore(null);
    setScanUrl(url.trim());
    setAgents(AGENT_DEFS.map(a => ({ ...a, status: 'running', data: null, durationMs: 0 })));
    scrollToStep('step-agents');

    try {
      const response = await fetch('/api/diagnostic/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim() }),
      });

      if (!response.body) {
        setError('No response from server');
        setPhase('error');
        return;
      }

      const reader = response.body.getReader();
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
            const event = JSON.parse(line.slice(6));

            if (event.phase === 'agent') {
              setPhase('agents');
              setAgents(prev =>
                prev.map(a =>
                  a.name === event.agent
                    ? { ...a, status: event.status, data: event.data, durationMs: event.durationMs }
                    : a
                )
              );
            } else if (event.phase === 'score' && event.status === 'done' && event.data) {
              scrollToStep('step-score');
              const s = event.data;
              setScore({
                total: s.score ?? s.total ?? 0,
                blocks: s.blocks || s.audit?.blocks || [],
              });
            } else if (event.phase === 'complete') {
              setPhase('complete');
              setTotalDuration(event.totalDurationMs || 0);
              scrollToStep('step-score');

              // Extract score from complete event if not yet set
              if (event.score && !score) {
                setScore({
                  total: event.score.score ?? event.score.total ?? 0,
                  blocks: event.score.blocks || event.score.audit?.blocks || [],
                });
              }
            } else if (event.phase === 'error') {
              setError(event.message || 'Scan failed');
              setPhase('error');
            }
          } catch {
            // Skip parse errors
          }
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error');
      setPhase('error');
    }
  }, [url, scrollToStep, score]);

  const isScanning = phase === 'fetch' || phase === 'agents';
  const isDone = phase === 'complete';

  return (
    <div className="diagnostic-v2" ref={containerRef}>
      {/* Header */}
      <header className="diagnostic-v2-header">
        <div className="diagnostic-v2-header-inner">
          <Link href="/" className="diagnostic-v2-logo">
            <Image src="/images/ayo-logo.webp" alt="AYO" width={36} height={36} />
            <span>AYO</span>
          </Link>
          <span className="diagnostic-v2-badge">Micro-Agents V2</span>
        </div>
      </header>

      {/* Step 1: URL Input */}
      <section id="step-url" className="diagnostic-v2-section diagnostic-v2-hero">
        <h1>Analyze your website&apos;s AI readability</h1>
        <p className="diagnostic-v2-subtitle">
          7 specialized agents scan your site in real-time. No AI hallucination — only verified data.
        </p>
        <form
          className="diagnostic-v2-input-group"
          onSubmit={(e) => { e.preventDefault(); startScan(); }}
        >
          <input
            type="text"
            placeholder="Enter your website URL (e.g. example.com)"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            disabled={isScanning}
            className="diagnostic-v2-url-input"
          />
          <button
            type="submit"
            disabled={isScanning || !url.trim()}
            className="diagnostic-v2-btn-primary"
          >
            {isScanning ? (
              <><span className="diagnostic-v2-spinner" /> Scanning...</>
            ) : (
              '🔍 Analyze'
            )}
          </button>
        </form>
      </section>

      {/* Step 2: Agent Panel */}
      {phase !== 'idle' && (
        <section id="step-agents" className="diagnostic-v2-section">
          <div className="diagnostic-v2-section-header">
            <h2>🤖 Micro-Agents Scanning</h2>
            {scanUrl && <span className="diagnostic-v2-url-tag">{scanUrl}</span>}
            {totalDuration > 0 && (
              <span className="diagnostic-v2-duration">
                Completed in {(totalDuration / 1000).toFixed(1)}s
              </span>
            )}
          </div>
          <div className="diagnostic-v2-agents-grid">
            {agents.map((agent) => (
              <AgentCard key={agent.name} agent={agent} />
            ))}
          </div>
        </section>
      )}

      {/* Step 3: Score */}
      {score && (
        <section id="step-score" className="diagnostic-v2-section">
          <h2>📊 AIO Score</h2>
          <div className="diagnostic-v2-score-container">
            <div className="diagnostic-v2-score-circle">
              <span className="diagnostic-v2-score-value">{Math.round(score.total)}</span>
              <span className="diagnostic-v2-score-max">/100</span>
            </div>
            {score.blocks && score.blocks.length > 0 && (
              <div className="diagnostic-v2-blocks">
                {score.blocks.map((block: ScoreBlock, i: number) => (
                  <div key={i} className="diagnostic-v2-block-row">
                    <span className="diagnostic-v2-block-label">
                      {block.label || block.name}
                    </span>
                    <div className="diagnostic-v2-block-bar-bg">
                      <div
                        className="diagnostic-v2-block-bar-fill"
                        style={{
                          width: `${block.maxScore > 0 ? (block.score / block.maxScore) * 100 : 0}%`,
                          animationDelay: `${i * 150}ms`,
                        }}
                      />
                    </div>
                    <span className="diagnostic-v2-block-score">
                      {block.score?.toFixed?.(1) ?? '0'}/{block.maxScore}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      )}

      {/* Step 5: Plans */}
      {isDone && score && (
        <section id="step-plans" className="diagnostic-v2-section">
          <h2>🚀 Boost your AI Readability</h2>
          <p className="diagnostic-v2-subtitle">
            Get listed in the AYA Trust Registry and receive your ASR identity files.
          </p>
          <div className="diagnostic-v2-plans-grid">
            <div className="diagnostic-v2-plan-card">
              <div className="diagnostic-v2-plan-badge">AYA Subscription</div>
              <div className="diagnostic-v2-plan-price">19 CHF<span>/month</span></div>
              <ul>
                <li>✅ AYA Trust Registry listing</li>
                <li>✅ Hosted ASR file</li>
                <li>✅ Monthly updates</li>
                <li>✅ Public certificate page</li>
              </ul>
              <a
                href={`${process.env.NEXT_PUBLIC_STRIPE_LINK_AYA_SUB || '#'}`}
                className="diagnostic-v2-btn-secondary"
              >
                Subscribe
              </a>
            </div>
            <div className="diagnostic-v2-plan-card diagnostic-v2-plan-featured">
              <div className="diagnostic-v2-plan-badge-pro">PRO Pack</div>
              <div className="diagnostic-v2-plan-price">499 CHF<span> one-time</span></div>
              <ul>
                <li>✅ Everything in AYA</li>
                <li>✅ 5 ASR identity files</li>
                <li>✅ 3 years Registry included</li>
                <li>✅ Ed25519 digital signature</li>
                <li>✅ Score boost</li>
              </ul>
              <a
                href={`${process.env.NEXT_PUBLIC_STRIPE_LINK_PRO || '#'}`}
                className="diagnostic-v2-btn-primary"
              >
                Get PRO Pack
              </a>
            </div>
          </div>
        </section>
      )}

      {/* Step 8: Compare */}
      {isDone && score && (
        <section id="step-compare" className="diagnostic-v2-section">
          <h2>📈 How you compare</h2>
          <p className="diagnostic-v2-subtitle">
            Your score vs the average in the AYA Registry ({'>'}4,400 entities indexed).
          </p>
          <div className="diagnostic-v2-compare">
            <div className="diagnostic-v2-compare-bar">
              <div className="diagnostic-v2-compare-label">Your site</div>
              <div className="diagnostic-v2-compare-bar-bg">
                <div
                  className="diagnostic-v2-compare-bar-fill diagnostic-v2-compare-you"
                  style={{ width: `${Math.min(score.total, 100)}%` }}
                />
              </div>
              <span className="diagnostic-v2-compare-value">{Math.round(score.total)}/100</span>
            </div>
            <div className="diagnostic-v2-compare-bar">
              <div className="diagnostic-v2-compare-label">Registry avg.</div>
              <div className="diagnostic-v2-compare-bar-bg">
                <div
                  className="diagnostic-v2-compare-bar-fill diagnostic-v2-compare-avg"
                  style={{ width: '32%' }}
                />
              </div>
              <span className="diagnostic-v2-compare-value">32/100</span>
            </div>
            <p className="diagnostic-v2-compare-message">
              {score.total >= 50
                ? `🎉 Your site is already more AI-readable than most businesses!`
                : `With ASR files and AYA registration, you could reach 70+ and outperform most competitors.`}
            </p>
          </div>
        </section>
      )}

      {/* Error */}
      {error && (
        <section className="diagnostic-v2-section diagnostic-v2-error">
          <p>❌ {error}</p>
          <button onClick={() => { setPhase('idle'); setError(null); }} className="diagnostic-v2-btn-secondary">
            Try again
          </button>
        </section>
      )}

      {/* Footer */}
      <footer className="diagnostic-v2-footer">
        <p>AI Visionary — Geneva, Switzerland | <Link href="/aya">AYA Registry</Link></p>
      </footer>
    </div>
  );
}

// --- Agent Card Component ---

function AgentCard({ agent }: { agent: AgentState }) {
  const statusIcon = {
    waiting: '⏳',
    running: '🔄',
    done: '✅',
    error: '❌',
  }[agent.status];

  return (
    <div className={`diagnostic-v2-agent-card diagnostic-v2-agent-${agent.status}`}>
      <div className="diagnostic-v2-agent-header">
        <span className="diagnostic-v2-agent-icon">{agent.icon}</span>
        <span className="diagnostic-v2-agent-name">{agent.label}</span>
        <span className="diagnostic-v2-agent-status">{statusIcon}</span>
      </div>
      {agent.status === 'running' && (
        <div className="diagnostic-v2-agent-running">
          <div className="diagnostic-v2-agent-pulse" />
          Scanning...
        </div>
      )}
      {agent.status === 'done' && agent.data && (
        <div className="diagnostic-v2-agent-results">
          <AgentDataPreview name={agent.name} data={agent.data} />
          {agent.durationMs > 0 && (
            <span className="diagnostic-v2-agent-time">{agent.durationMs}ms</span>
          )}
        </div>
      )}
      {agent.status === 'error' && (
        <div className="diagnostic-v2-agent-error-msg">Failed to extract</div>
      )}
    </div>
  );
}

// --- Data Preview per Agent ---

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function AgentDataPreview({ name, data }: { name: AgentName; data: any }) {
  switch (name) {
    case 'detect-contact':
      return (
        <div className="diagnostic-v2-data-preview">
          {data.email && <div>📧 {String(data.email)}</div>}
          {data.phone && <div>📞 {String(data.phone)}</div>}
          {!data.email && !data.phone && <div className="text-muted">No contact found</div>}
        </div>
      );
    case 'detect-services': {
      const services = (data.services as string[]) || [];
      const products = (data.products as string[]) || [];
      const all = [...services, ...products];
      return (
        <div className="diagnostic-v2-data-preview">
          {all.length > 0
            ? all.slice(0, 3).map((s, i) => <div key={i}>• {s}</div>)
            : <div className="text-muted">No services detected</div>}
          {all.length > 3 && <div className="text-muted">+{all.length - 3} more</div>}
        </div>
      );
    }
    case 'detect-legal': {
      const items = [
        ...((data.policies as string[]) || []),
        ...((data.frameworks as string[]) || []),
        ...((data.certifications as string[]) || []),
      ];
      return (
        <div className="diagnostic-v2-data-preview">
          {items.length > 0
            ? items.slice(0, 4).map((s, i) => <div key={i}>• {s}</div>)
            : <div className="text-muted">No legal info found</div>}
        </div>
      );
    }
    case 'detect-location':
      return (
        <div className="diagnostic-v2-data-preview">
          {(data.city || data.country)
            ? <div>📍 {[data.city, data.country].filter(Boolean).join(', ')}</div>
            : <div className="text-muted">No location found</div>}
        </div>
      );
    case 'detect-security': {
      const measures = (data.measures as string[]) || [];
      return (
        <div className="diagnostic-v2-data-preview">
          {measures.length > 0
            ? measures.slice(0, 4).map((s, i) => <div key={i}>🔒 {s}</div>)
            : <div className="text-muted">No security headers</div>}
        </div>
      );
    }
    case 'detect-jsonld':
      return (
        <div className="diagnostic-v2-data-preview">
          {data.hasOrganizationType
            ? <div>✅ {String(data.type || 'Organization')} — {String(data.name || 'Found')}</div>
            : data.schemas && (data.schemas as unknown[]).length > 0
              ? <div>⚠️ JSON-LD found but no Organization type</div>
              : <div className="text-muted">No JSON-LD found</div>}
        </div>
      );
    case 'detect-social': {
      const platforms = (data.platforms as string[]) || [];
      return (
        <div className="diagnostic-v2-data-preview">
          {platforms.length > 0
            ? <div>{platforms.join(' • ')}</div>
            : <div className="text-muted">No social links found</div>}
        </div>
      );
    }
    default:
      return null;
  }
}
