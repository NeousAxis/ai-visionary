'use client';

import { useState, useCallback, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';

// ─── Types ───
type AgentName = 'detect-contact' | 'detect-services' | 'detect-legal' | 'detect-location' | 'detect-security' | 'detect-jsonld' | 'detect-social' | 'detect-pedagogy';
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
  { name: 'detect-pedagogy', label: 'Learning Content', icon: '?', desc: 'Detecting FAQ, glossary & docs...' },
];

const BLOCK_ICONS: Record<string, string> = {
  identite: '🪪',
  offre: '🎯',
  processus_methodes: '⚙️',
  engagements_conformite: '🛡️',
  indicateurs: '📊',
  contenus_pedagogiques: '📚',
  structure_technique: '🔧',
};

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
  const [proScore, setProScore] = useState<number | null>(null);
  const [detectedName, setDetectedName] = useState('');
  const [competitors, setCompetitors] = useState<{ name: string; score: number; country: string; certified?: boolean }[]>([]);
  const [avgScore, setAvgScore] = useState(0);
  const [totalInSector, setTotalInSector] = useState(0);
  const [compareLoading, setCompareLoading] = useState(false);
  const [userEmail, setUserEmail] = useState('');
  const [selectedPlan, setSelectedPlan] = useState<'aya_sub' | 'pro' | null>(null);
  const [isExistingClient, setIsExistingClient] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [otpVerified, setOtpVerified] = useState(false);
  const [otpError, setOtpError] = useState('');
  const [otpLoading, setOtpLoading] = useState(false);
  const [otpMaskedEmail, setOtpMaskedEmail] = useState('');
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [emailVerified, setEmailVerified] = useState(false);

  // Handle return from Stripe checkout (redirect with session_id)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('session_id')) {
      setCurrentStep(8);
    }
  }, []);

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
      // Auto-advance to step 5 (Compare) + fetch competitors
      setTimeout(async () => {
        setCurrentStep(5);
        scrollTo('step-5');
        setCompareLoading(true);
        try {
          // Get services detected by agents for sector matching
          const detectedServices = agents.find(a => a.name === 'detect-services')?.data?.services || [];
          const siteDomain = scanUrl.replace(/^https?:\/\//, '').split('/')[0];
          const jsonldName = agents.find(a => a.name === 'detect-jsonld')?.data?.name || '';

          const r = await fetch('/api/diagnostic/compare', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              country: agents.find(a => a.name === 'detect-location')?.data?.country || '',
              services: detectedServices,
              siteName: jsonldName || siteDomain,
              siteUrl: scanUrl,
            }),
          });
          const data = await r.json();
          if (data.competitors?.length) setCompetitors(data.competitors);
          if (data.averageScore) setAvgScore(data.averageScore);
          if (data.totalInSector) setTotalInSector(data.totalInSector);
        } catch { /* ignore */ }
        setCompareLoading(false);
        // Auto-advance to step 6 (Plans) after compare loaded
        setTimeout(() => { setCurrentStep(6); scrollTo('step-6'); }, 2000);
      }, 1000);
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
    if (!emailVerified) return;
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
                // Score engine returns blocks as object {identite: 3.5, offre: 8.2}
                // Convert to array [{name, label, score, maxScore}]
                const BLOCK_LABELS: Record<string, [string, number]> = {
                  identite: ['Identity & Presence', 10],
                  offre: ['Offer Clarity', 20],
                  processus_methodes: ['Process & Methods', 15],
                  engagements_conformite: ['Trust & Compliance', 15],
                  indicateurs: ['Key Indicators', 20],
                  contenus_pedagogiques: ['Educational Content', 10],
                  structure_technique: ['Technical Foundation', 10],
                };
                const blocksObj = ev.score.blocks || {};
                const blocksArr = Object.entries(blocksObj).map(([key, val]) => ({
                  name: key,
                  label: BLOCK_LABELS[key]?.[0] || key,
                  score: typeof val === 'number' ? val : 0,
                  maxScore: BLOCK_LABELS[key]?.[1] || 10,
                }));
                setScore({
                  total: ev.score.total ?? 0,
                  blocks: blocksArr,
                });
              }
              // Capture PRO score + site name
              if (ev.proScore) setProScore(ev.proScore.total ?? null);
              // Get detected name — prefer short name, not full title
              const eName = ev.extract?.fields?.identite?.name?.value || '';
              // Strip " | subtitle" from title-based names
              const shortName = eName.split(/\s*[|–—]\s*/)[0].trim();
              if (shortName) setDetectedName(shortName);
              // Check if already registered in AYA
              if (ev.is_aya_registered || ev.extract?.meta?.source?.scan?.is_aya_registered) {
                setIsExistingClient(true);
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
  }, [url, emailVerified, scrollTo]);

  const agentsDone = agents.filter(a => a.status === 'done').length;

  // ─── OTP Handlers ───
  const handleSendOtp = async () => {
    setOtpLoading(true);
    setOtpError('');
    try {
      const res = await fetch('/api/auth/send-otp-v2', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim(), email: userEmail }),
      });
      const data = await res.json();
      if (res.ok) {
        setOtpSent(true);
        if (data.maskedEmail) setOtpMaskedEmail(data.maskedEmail);
      } else {
        setOtpError(data.error || 'Failed to send code');
      }
    } catch {
      setOtpError('Network error');
    }
    setOtpLoading(false);
  };

  const handleVerifyOtp = async () => {
    setOtpLoading(true);
    setOtpError('');
    try {
      const res = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: userEmail, code: otpCode }),
      });
      if (res.ok) {
        setOtpVerified(true);
        setEmailVerified(true);
      } else {
        setOtpError('Invalid or expired code');
      }
    } catch {
      setOtpError('Network error');
    }
    setOtpLoading(false);
  };

  // ─── Plan selection handler ───
  const handleSelectPlan = (plan: 'aya_sub' | 'pro') => {
    setSelectedPlan(plan);
    setCurrentStep(7);
    scrollTo('step-7');
  };

  // ─── Domain match for email verification ───
  const urlDomain = url.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0].toLowerCase();
  const emailDomain = userEmail.split('@')[1]?.toLowerCase() || '';
  const domainMatch = emailDomain === urlDomain && urlDomain.length > 0;

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
            8 super agents scan your site in real-time.<br />
            Every data point is structured to be optimized for AI.
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
              <button type="submit" disabled={currentStep > 1 || !url.trim() || !emailVerified} className="dv2-search-btn">
                {currentStep === 2 ? <span className="dv2-spinner" /> : currentStep > 2 ? '✓ Done' : 'Analyze →'}
              </button>
            </div>
          </form>

          {/* ─── Email Verification (appears after URL is entered) ─── */}
          {url && !emailVerified && currentStep === 1 && (
            <div style={{ maxWidth: 520, margin: '2rem auto 0', textAlign: 'center' }}>
              <div style={{ fontSize: '1.1rem', fontWeight: 600, color: '#212E53', marginBottom: '0.75rem' }}>
                🔐 Verify your identity
              </div>
              <p style={{ color: '#555', fontSize: '0.9rem', marginBottom: '0.5rem' }}>
                To protect your data from competitors, we verify that you belong to the company before running the analysis.
              </p>
              <p style={{ color: '#555', fontSize: '0.9rem', marginBottom: '1rem' }}>
                Enter your <strong>@{url.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0]}</strong> professional email below.
              </p>

              {/* Email input */}
              <input
                type="email"
                value={userEmail}
                onChange={(e) => setUserEmail(e.target.value)}
                placeholder={`you@${url.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0]}`}
                style={{
                  width: '100%', padding: '12px 16px', borderRadius: 8,
                  border: `1px solid ${userEmail && !domainMatch ? '#CE6A6B' : '#ccc'}`,
                  fontSize: '1rem', outline: 'none',
                }}
              />

              {/* Domain validation badge */}
              {userEmail.includes('@') && (
                <p style={{
                  color: domainMatch ? '#4A919E' : '#CE6A6B',
                  fontSize: '0.85rem', marginTop: '0.5rem'
                }}>
                  {domainMatch ? '✓ Domain matches' : `✗ Email must be @${urlDomain}`}
                </p>
              )}

              {/* Send OTP button (only if domain matches) */}
              {domainMatch && !otpSent && (
                <button
                  onClick={handleSendOtp}
                  disabled={otpLoading}
                  className="dv2-search-btn"
                  style={{ marginTop: '1rem', minWidth: 240 }}
                >
                  {otpLoading ? 'Sending...' : 'Send verification code'}
                </button>
              )}

              {/* OTP code input (after send) */}
              {otpSent && !otpVerified && (
                <div style={{ marginTop: '1rem' }}>
                  <p style={{ color: '#555', fontSize: '0.9rem', marginBottom: '0.75rem' }}>
                    Code sent to <strong>{otpMaskedEmail || userEmail}</strong>
                  </p>
                  <input
                    type="text" inputMode="numeric" maxLength={6}
                    value={otpCode}
                    onChange={e => setOtpCode(e.target.value.replace(/\D/g, ''))}
                    placeholder="000000"
                    style={{
                      fontSize: '1.75rem', textAlign: 'center', letterSpacing: '0.5rem',
                      width: 220, padding: '12px 16px', borderRadius: 8,
                      border: `2px solid ${otpError ? '#CE6A6B' : '#ccc'}`,
                      fontFamily: 'monospace',
                    }}
                    autoFocus
                  />
                  {otpError && <p style={{ color: '#CE6A6B', fontSize: '0.85rem', marginTop: '0.5rem' }}>{otpError}</p>}
                  <div style={{ marginTop: '1rem' }}>
                    <button
                      onClick={handleVerifyOtp}
                      disabled={otpLoading || otpCode.length !== 6}
                      className="dv2-search-btn"
                      style={{ minWidth: 200, opacity: otpCode.length !== 6 ? 0.5 : 1 }}
                    >
                      {otpLoading ? 'Verifying...' : 'Verify →'}
                    </button>
                  </div>
                  <button
                    onClick={() => { setOtpCode(''); setOtpError(''); setOtpSent(false); }}
                    style={{ marginTop: '0.75rem', background: 'none', border: 'none', color: '#4A919E', cursor: 'pointer', fontSize: '0.85rem', textDecoration: 'underline' }}
                  >
                    Resend code
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Verified badge + Analyze becomes active */}
          {emailVerified && currentStep === 1 && (
            <div style={{ textAlign: 'center', marginTop: '1rem' }}>
              <span style={{ color: '#4A919E', fontWeight: 600, fontSize: '0.95rem' }}>
                ✓ Verified as {userEmail}
              </span>
            </div>
          )}
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
                    {agent.status === 'running' && <span className="dv2-agent-spinner" />}
                    {agent.status === 'done' && '✓'}
                    {agent.status === 'error' && '✗'}
                  </span>
                </div>
                {agent.status === 'running' && (
                  <div className="dv2-agent-data dv2-agent-scanning">
                    <span className="dv2-scanning-text">{agent.desc}</span>
                  </div>
                )}
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

      {/* ═══ STEP 3 — SCORING (7 individual blocks + total) ═══ */}
      {currentStep >= 3 && score && (
        <section id="step-3" className={`dv2-step dv2-step-reveal ${currentStep === 3 ? 'dv2-step-active' : ''}`}>
          <div className="dv2-step-num">03</div>
          <h2>AIO Score — 7 Dimensions</h2>
          <p className="dv2-step-sub">Each dimension is scored individually, then combined into your global AIO score.</p>

          {/* 7 individual score cards */}
          <div className="dv2-score-grid">
            {(score.blocks || []).map((b, i) => {
              const pct = b.maxScore > 0 ? (b.score / b.maxScore) * 100 : 0;
              const icon = BLOCK_ICONS[b.name] || '◆';
              return (
                <div
                  key={i}
                  className="dv2-score-card"
                  style={{ animationDelay: `${i * 120}ms` }}
                >
                  <div className="dv2-score-card-header">
                    <span className="dv2-score-card-icon">{icon}</span>
                    <span className="dv2-score-card-label">{b.label || b.name}</span>
                  </div>
                  <div className="dv2-score-card-bar">
                    <div
                      className={`dv2-score-card-fill ${pct >= 70 ? 'dv2-fill-good' : pct >= 40 ? 'dv2-fill-mid' : 'dv2-fill-low'}`}
                      style={{ width: scoreRevealed ? `${pct}%` : '0%', transition: `width 0.8s ease-out ${i * 120}ms` }}
                    />
                  </div>
                  <div className="dv2-score-card-value">
                    <span className={`dv2-score-card-num ${pct >= 70 ? 'dv2-num-good' : pct >= 40 ? 'dv2-num-mid' : 'dv2-num-low'}`}>
                      {scoreRevealed ? b.score?.toFixed?.(1) ?? '0' : '—'}
                    </span>
                    <span className="dv2-score-card-max">/{b.maxScore}</span>
                  </div>
                  <span className={`dv2-score-card-pct ${pct >= 70 ? 'dv2-num-good' : pct >= 40 ? 'dv2-num-mid' : 'dv2-num-low'}`}>
                    {scoreRevealed ? `${Math.round(pct)}%` : ''}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Global total */}
          <div className={`dv2-total-panel ${scoreRevealed ? 'dv2-total-revealed' : ''}`}>
            <div className="dv2-total-left">
              <span className="dv2-total-label">Global AIO Score</span>
              <span className="dv2-total-sub">Combined from 7 dimensions • Max 100</span>
            </div>
            <div className="dv2-total-ring">
              <svg viewBox="0 0 100 100" className="dv2-ring-svg">
                <circle cx="50" cy="50" r="42" fill="none" stroke="#E2EFE9" strokeWidth="7" />
                <circle cx="50" cy="50" r="42" fill="none" stroke="url(#sg)" strokeWidth="7" strokeLinecap="round"
                  strokeDasharray={scoreRevealed ? `${(score.total / 100) * 264} 264` : '0 264'}
                  transform="rotate(-90 50 50)" style={{ transition: 'stroke-dasharray 1.5s ease-out 1s' }} />
                <defs><linearGradient id="sg" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#4A919E" /><stop offset="100%" stopColor="#356D76" />
                </linearGradient></defs>
              </svg>
              <div className="dv2-total-num">
                <span className="dv2-total-big">{scoreRevealed ? Math.round(score.total) : '—'}</span>
                <span className="dv2-total-of">/100</span>
              </div>
            </div>
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
              const isGenerating = currentStep === 4 && i === filesRevealed;
              return (
                <div key={file.name} className={`dv2-file-row ${revealed ? 'dv2-file-done' : isGenerating ? 'dv2-file-active' : 'dv2-file-pending'}`}>
                  <span className="dv2-file-icon">{revealed ? '✓' : isGenerating ? '◌' : '—'}</span>
                  <div className="dv2-file-info">
                    <span className="dv2-file-name">{file.name}</span>
                    <span className="dv2-file-desc">{file.desc}</span>
                    {isGenerating && (
                      <div className="dv2-file-progress">
                        <div className="dv2-file-progress-bar" />
                      </div>
                    )}
                  </div>
                  {revealed && <span className="dv2-file-check">✓ Ready</span>}
                  {isGenerating && <span className="dv2-file-generating"><span className="dv2-dot-pulse" /> Generating...</span>}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* ═══ STEP 5 — COMPARE (auto-displayed after files) ═══ */}
      {currentStep >= 5 && score && (
        <section id="step-5" className={`dv2-step dv2-step-reveal ${currentStep === 5 ? 'dv2-step-active' : ''}`}>
          <div className="dv2-step-num">05</div>
          <h2>Your Position vs Competitors</h2>
          <p className="dv2-step-sub">
            How your AI readability compares to {totalInSector > 0 ? totalInSector : '>4,400'} entities in the AYA Registry.
          </p>

          <div className="dv2-compare-card">
            {compareLoading ? (
              <div style={{ textAlign: 'center', padding: '2rem' }}>
                <span className="dv2-dot-pulse" /> Loading competitors from AYA Registry...
              </div>
            ) : (
              <>
                {/* Your score — always first */}
                <div className="dv2-compare-row">
                  <span className="dv2-compare-label dv2-compare-label--you">⬤ {detectedName || scanUrl.replace(/^https?:\/\//, '').split('/')[0]}</span>
                  <div className="dv2-compare-track"><div className="dv2-compare-fill dv2-compare-fill--you" style={{ width: `${Math.min(score.total, 100)}%` }} /></div>
                  <span className="dv2-compare-val dv2-val-you">{Math.round(score.total)}/100</span>
                </div>

                {/* Real competitors from AYA registry */}
                {competitors.length > 0 ? competitors.map((c, i) => (
                  <div key={i} className="dv2-compare-row">
                    <span className="dv2-compare-label">
                      {c.name.length > 18 ? c.name.substring(0, 18) + '…' : c.name}
                      {c.certified && <span className="dv2-compare-certified"> ✦</span>}
                    </span>
                    <div className="dv2-compare-track"><div className="dv2-compare-fill dv2-compare-fill--competitor" style={{ width: `${Math.min(c.score, 100)}%` }} /></div>
                    <span className="dv2-compare-val">{Math.round(c.score)}/100</span>
                  </div>
                )) : (
                  <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.88rem', padding: '0.75rem 0' }}>
                    No indexed competitors currently visible in the AYA Registry for your sector.
                  </p>
                )}

                {/* Sector average */}
                {avgScore > 0 && (
                  <div className="dv2-compare-row" style={{ borderTop: '1px solid var(--border-light)', paddingTop: '0.75rem', marginTop: '0.25rem' }}>
                    <span className="dv2-compare-label">Sector average</span>
                    <div className="dv2-compare-track"><div className="dv2-compare-fill dv2-compare-fill--avg" style={{ width: `${avgScore}%` }} /></div>
                    <span className="dv2-compare-val">{avgScore}/100</span>
                  </div>
                )}

                {/* With AYO PRO — real calculated projection */}
                {proScore !== null && (
                  <div className="dv2-compare-row" style={{ borderTop: '1px solid var(--border-light)', paddingTop: '0.75rem', marginTop: '0.25rem' }}>
                    <span className="dv2-compare-label dv2-compare-label--pro">With AYO PRO ✦</span>
                    <div className="dv2-compare-track"><div className="dv2-compare-fill dv2-compare-fill--pro" style={{ width: `${Math.min(proScore, 100)}%` }} /></div>
                    <span className="dv2-compare-val dv2-val-pro">{Math.round(proScore)}/100</span>
                  </div>
                )}

                <p className="dv2-compare-msg">
                  {proScore !== null && proScore > score.total
                    ? `🚀 With AYO PRO files (ASR, FAQ, glossary, documentation), your score would jump from ${Math.round(score.total)} to ${Math.round(proScore)}/100 — a +${Math.round(proScore - score.total)} point boost!`
                    : competitors.length > 0
                      ? score.total > avgScore
                        ? '🎉 You are above the sector average!'
                        : `💡 ${competitors.filter(c => c.score > score.total).length} entities in your sector score higher.`
                      : '💡 Join the AYA Registry to benchmark against your sector.'}
                </p>
              </>
            )}
          </div>
        </section>
      )}

      {/* ═══ STEP 6 — CHOOSE PLAN ═══ */}
      {currentStep >= 6 && (
        <section id="step-6" className={`dv2-step dv2-step-reveal ${currentStep === 6 ? 'dv2-step-active' : ''}`}>
          <div className="dv2-step-num">06</div>
          <h2>Choose Your Plan</h2>
          <p className="dv2-step-sub">
            {isExistingClient
              ? 'Your site is already in the AYA Registry. Upgrade or manage your account below.'
              : 'Activate your AI identity and join the AYA Trust Registry.'}
          </p>

          <div className="dv2-plans">
            <div
              className={`dv2-plan${selectedPlan === 'aya_sub' ? ' dv2-plan--selected' : ''}`}
              onClick={() => handleSelectPlan('aya_sub')}
            >
              <div className="dv2-plan-name">AYA Subscription</div>
              <div className="dv2-plan-price">19 <span>CHF/mo</span></div>
              <ul className="dv2-plan-list">
                <li>AYA Trust Registry listing</li>
                <li>Hosted ASR file</li>
                <li>Monthly updates</li>
                <li>Public certificate page</li>
              </ul>
              <button className="dv2-plan-btn dv2-plan-btn--outline">
                {selectedPlan === 'aya_sub' ? '✓ Selected' : 'Select AYA →'}
              </button>
            </div>
            <div
              className={`dv2-plan dv2-plan--pro${selectedPlan === 'pro' ? ' dv2-plan--selected' : ''}`}
              onClick={() => handleSelectPlan('pro')}
            >
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
              <button className="dv2-plan-btn dv2-plan-btn--solid">
                {selectedPlan === 'pro' ? '✓ Selected' : 'Select PRO →'}
              </button>
            </div>
          </div>

        </section>
      )}

      {/* ═══ STEP 7 — PAYMENT ═══ */}
      {currentStep >= 7 && (
        <section id="step-7" className={`dv2-step dv2-step-reveal ${currentStep === 7 ? 'dv2-step-active' : ''}`}>
          <div className="dv2-step-num">07</div>

          <div className="dv2-payment-box">
            <h2 style={{ color: '#212E53', marginBottom: '0.5rem' }}>Payment</h2>
            <p style={{ color: '#4A919E', fontWeight: 600, fontSize: '0.9rem', marginBottom: '1rem' }}>
              ✓ Verified as {userEmail}
            </p>
              <div style={{
                background: '#f8fafb',
                borderRadius: 10,
                padding: '1.25rem 1.5rem',
                marginBottom: '1.5rem',
                border: '1px solid #e2efe9',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                  <span style={{ color: '#555', fontSize: '0.9rem' }}>Plan</span>
                  <span style={{ fontWeight: 700, color: '#212E53' }}>
                    {selectedPlan === 'pro' ? 'PRO Pack — 499 CHF' : 'AYA Subscription — 19 CHF/mo'}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#555', fontSize: '0.9rem' }}>Email</span>
                  <span style={{ color: '#212E53' }}>{userEmail}</span>
                </div>
              </div>
              <button
                onClick={async () => {
                  setPaymentLoading(true);
                  setError(null);
                  try {
                    const res = await fetch('/api/create-checkout', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        email: userEmail,
                        url: scanUrl,
                        packType: selectedPlan === 'pro' ? 'PRO' : 'AYA_SUB',
                        locale: 'en',
                      }),
                    });
                    const data = await res.json();
                    if (data.url) {
                      window.location.href = data.url;
                    } else {
                      setError(data.error || 'Failed to create checkout session');
                      setPaymentLoading(false);
                    }
                  } catch {
                    setError('Network error — please try again');
                    setPaymentLoading(false);
                  }
                }}
                disabled={paymentLoading}
                className="dv2-search-btn"
                style={{ width: '100%', opacity: paymentLoading ? 0.7 : 1 }}
              >
                {paymentLoading ? (
                  <><span className="dv2-spinner" style={{ marginRight: 8 }} /> Redirecting to Stripe...</>
                ) : (
                  'Proceed to Payment →'
                )}
              </button>
              <p style={{ fontSize: '0.8rem', color: '#888', marginTop: '0.75rem', textAlign: 'center' }}>
                Secure checkout powered by Stripe
              </p>
          </div>
        </section>
      )}

      {/* ═══ STEP 8 — CONFIRMATION ═══ */}
      {currentStep >= 8 && (
        <section id="step-8" className={`dv2-step dv2-step-reveal ${currentStep === 8 ? 'dv2-step-active' : ''}`}>
          <div className="dv2-step-num">08</div>
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
      return <div className="dv2-preview">
        {data.email && <span>📧 {data.email}</span>}
        {data.phone && <span>📞 {data.phone}</span>}
        {data.hasContactForm && <span>📋 Contact form detected</span>}
        {!data.email && !data.phone && !data.hasContactForm && <span className="dv2-muted">No contact found</span>}
      </div>;
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
    case 'detect-pedagogy': {
      const items = [data.has_faq && 'FAQ', data.has_glossary && 'Glossary', data.has_documentation && 'Documentation'].filter(Boolean);
      return <div className="dv2-preview">{items.length > 0 ? <span>{items.join(' · ')}</span> : <span className="dv2-muted">None found</span>}</div>;
    }
    default: return null;
  }
}
