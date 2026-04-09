'use client';

import { useState, useCallback, useEffect, useMemo } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useTranslations, useLocale } from 'next-intl';

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

const AGENT_ICONS: Record<AgentName, string> = {
  'detect-jsonld': '{ }',
  'detect-contact': '@',
  'detect-location': '◎',
  'detect-services': '◆',
  'detect-legal': '§',
  'detect-security': '⬡',
  'detect-social': '◈',
  'detect-pedagogy': '?',
};

const AGENT_NAMES: AgentName[] = [
  'detect-jsonld', 'detect-contact', 'detect-location', 'detect-services',
  'detect-legal', 'detect-security', 'detect-social', 'detect-pedagogy',
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

const FILE_NAMES = [
  'ASR-Protocol.json',
  'manifest.json',
  'faq.json',
  'glossary.json',
  'external_context.json',
];

const FILE_DESC_KEYS = [
  'fileAsr',
  'fileManifest',
  'fileFaq',
  'fileGlossary',
  'fileExternal',
];

// ─── Step tracking ───
type Step = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

export default function DiagnosticV2Page() {
  const [url, setUrl] = useState('');
  const [currentStep, setCurrentStep] = useState<Step>(1);
  const [agents, setAgents] = useState<AgentState[]>([]);
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
  const [analysisId, setAnalysisId] = useState('');
  const [legalName, setLegalName] = useState('');
  const [legalNameConfirmed, setLegalNameConfirmed] = useState(false);

  const t = useTranslations('diagnostic');
  const locale = useLocale();

  const AGENT_LABEL_KEYS: Record<AgentName, string> = {
    'detect-jsonld': 'agentJsonld',
    'detect-contact': 'agentContact',
    'detect-location': 'agentLocation',
    'detect-services': 'agentServices',
    'detect-legal': 'agentLegal',
    'detect-security': 'agentSecurity',
    'detect-social': 'agentSocial',
    'detect-pedagogy': 'agentPedagogy',
  };

  const AGENT_DESC_KEYS: Record<AgentName, string> = {
    'detect-jsonld': 'agentJsonldDesc',
    'detect-contact': 'agentContactDesc',
    'detect-location': 'agentLocationDesc',
    'detect-services': 'agentServicesDesc',
    'detect-legal': 'agentLegalDesc',
    'detect-security': 'agentSecurityDesc',
    'detect-social': 'agentSocialDesc',
    'detect-pedagogy': 'agentPedagogyDesc',
  };

  const AGENTS: Omit<AgentState, 'status' | 'data' | 'durationMs'>[] = useMemo(() =>
    AGENT_NAMES.map(name => ({
      name,
      label: t(AGENT_LABEL_KEYS[name] as Parameters<typeof t>[0]),
      icon: AGENT_ICONS[name],
      desc: t(AGENT_DESC_KEYS[name] as Parameters<typeof t>[0]),
    })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [t]
  );

  const FILES = useMemo(() =>
    FILE_NAMES.map((name, i) => ({
      name,
      desc: t(FILE_DESC_KEYS[i] as Parameters<typeof t>[0]),
    })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [t]
  );

  // Initialize agents state when AGENTS definition is ready
  useEffect(() => {
    setAgents(prev => {
      if (prev.length > 0) return prev; // already initialized, don't reset
      return AGENTS.map(a => ({ ...a, status: 'waiting' as const, data: null, durationMs: 0 }));
    });
  }, [AGENTS]);

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
      const timer = setTimeout(() => setFilesRevealed(f => f + 1), 1200);
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

  // Legal name confirmed → advance to step 3
  useEffect(() => {
    if (legalNameConfirmed && currentStep === 2 && score) {
      setTimeout(() => { setCurrentStep(3); scrollTo('step-3'); }, 500);
    }
  }, [legalNameConfirmed, currentStep, score, scrollTo]);

  // Step 3: Animate score reveal
  useEffect(() => {
    if (currentStep === 3 && score && !scoreRevealed) {
      const timer = setTimeout(() => {
        setScoreRevealed(true);
        // Auto-advance to step 4
        setTimeout(() => { setCurrentStep(4); scrollTo('step-4'); }, 3500);
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [currentStep, score, scoreRevealed, scrollTo]);

  // ─── Start Scan ───
  const startScan = useCallback(async (skipEmailCheck = false) => {
    if (!url.trim()) return;
    if (!emailVerified && !skipEmailCheck) return;
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
        body: JSON.stringify({ url: url.trim(), email: userEmail }),
      });
      if (!res.body) { setError(t('noResponse')); return; }

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
              // Keep spinner visible as cards grow
              setTimeout(() => {
                document.getElementById('transition-score')?.scrollIntoView({ behavior: 'smooth', block: 'end' });
              }, 200);
            } else if (ev.phase === 'complete') {
              setTotalDuration(ev.totalDurationMs || 0);
              if (ev.score) {
                // Score engine returns blocks as object {identite: 3.5, offre: 8.2}
                // Convert to array [{name, label, score, maxScore}]
                const BLOCK_LABEL_KEYS: Record<string, [string, number]> = {
                  identite: ['blockIdentite', 10],
                  offre: ['blockOffre', 20],
                  processus_methodes: ['blockProcessus', 15],
                  engagements_conformite: ['blockEngagements', 15],
                  indicateurs: ['blockIndicateurs', 20],
                  contenus_pedagogiques: ['blockPedagogie', 10],
                  structure_technique: ['blockTechnique', 10],
                };
                const blocksObj = ev.score.blocks || {};
                const blocksArr = Object.entries(blocksObj).map(([key, val]) => ({
                  name: key,
                  label: BLOCK_LABEL_KEYS[key] ? t(BLOCK_LABEL_KEYS[key][0] as Parameters<typeof t>[0]) : key,
                  score: typeof val === 'number' ? val : 0,
                  maxScore: BLOCK_LABEL_KEYS[key]?.[1] || 10,
                }));
                setScore({
                  total: ev.score.total ?? 0,
                  blocks: blocksArr,
                });
              }
              // Capture PRO score + site name + analysis ID
              if (ev.proScore) setProScore(ev.proScore.total ?? null);
              if (ev.analysisId) setAnalysisId(ev.analysisId);
              // Get detected name — prefer short name, not full title
              const eName = ev.extract?.fields?.identite?.name?.value || '';
              // Strip " | subtitle" from title-based names
              const shortName = eName.split(/\s*[|–—]\s*/)[0].trim();
              if (shortName) setDetectedName(shortName);
              // Check if already registered in AYA
              if (ev.is_aya_registered || ev.extract?.meta?.source?.scan?.is_aya_registered) {
                setIsExistingClient(true);
              }
              // Pre-fill legal name with detected name
              if (shortName) setLegalName(shortName);
              setLegalNameConfirmed(false);
              // Scroll to legal name input (between step 2 and step 3)
              setTimeout(() => {
                document.getElementById('legal-name-prompt')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
              }, 800);
            } else if (ev.phase === 'error') {
              setError(ev.message || t('scanFailed'));
            }
          } catch { /* skip */ }
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t('networkError'));
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
        setOtpError(data.error || t('failedSendCode'));
      }
    } catch {
      setOtpError(t('networkError'));
    }
    setOtpLoading(false);
  };

  const handleVerifyAndScan = async () => {
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
        setOtpLoading(false);
        // Auto-trigger scan immediately after verification
        startScan(true);
        return;
      } else {
        setOtpError(t('otpError'));
      }
    } catch {
      setOtpError(t('networkError'));
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
          <span className="dv2-version-badge">Agentic System</span>
        </div>
      </header>

      {/* ═══ STEP 1 — URL INPUT ═══ */}
      <section id="step-1" className="dv2-step">
        <div className="dv2-step-num">01</div>
        <div className="dv2-hero-content">
          <h1>
            {t('heroTitle1')} <span className="dv2-accent">{t('heroTitle2')}</span>
          </h1>
          <p className="dv2-hero-sub">
            {t('heroSub1')}<br />
            {t('heroSub2')}
          </p>
          <form className="dv2-search-form" onSubmit={e => { e.preventDefault(); startScan(); }}>
            <div className="dv2-search-box">
              <input
                type="text"
                placeholder={t('placeholder')}
                value={url}
                onChange={e => setUrl(e.target.value)}
                disabled={currentStep > 1}
                className="dv2-search-input"
                autoFocus
              />
              <button type="submit" disabled={currentStep > 1 || !url.trim() || !emailVerified} className="dv2-search-btn">
                {currentStep === 2 ? <span className="dv2-spinner" /> : currentStep > 2 ? t('analyzDone') : t('analyzBtn')}
              </button>
            </div>
          </form>

          {/* ─── Email Verification (appears after URL is entered) ─── */}
          {url && !emailVerified && currentStep === 1 && (
            <div className="dv2-otp-section">
              <div className="dv2-otp-title">{t('otpTitle')}</div>
              <p className="dv2-otp-desc">{t('otpDesc')}</p>
              <p className="dv2-otp-hint">
                {t('otpEmailHint', { domain: url.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0] })}
              </p>

              {/* Email input */}
              <input
                type="email"
                value={userEmail}
                onChange={(e) => setUserEmail(e.target.value)}
                placeholder={`you@${url.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0]}`}
                className="dv2-otp-email-input"
                style={{ border: `1px solid ${userEmail && !domainMatch ? '#CE6A6B' : '#ccc'}` }}
              />

              {/* Domain validation badge */}
              {userEmail.includes('@') && (
                <p className="dv2-otp-domain-badge" style={{ color: domainMatch ? '#4A919E' : '#CE6A6B' }}>
                  {domainMatch ? t('domainMatch') : t('domainMismatch', { domain: urlDomain })}
                </p>
              )}

              {/* Send OTP button (only if domain matches) */}
              {domainMatch && !otpSent && (
                <button
                  onClick={handleSendOtp}
                  disabled={otpLoading}
                  className="dv2-search-btn"
                  style={{ marginTop: '1rem', width: '100%', maxWidth: 300 }}
                >
                  {otpLoading ? t('sending') : t('sendCode')}
                </button>
              )}

              {/* OTP code input (after send) */}
              {otpSent && !otpVerified && (
                <div style={{ marginTop: '1rem' }}>
                  <p className="dv2-otp-code-sent">
                    {t('codeSentTo', { email: otpMaskedEmail || userEmail })}
                  </p>
                  <input
                    type="text" inputMode="numeric" maxLength={6}
                    value={otpCode}
                    onChange={e => setOtpCode(e.target.value.replace(/\D/g, ''))}
                    placeholder="000000"
                    className="dv2-otp-code-input"
                    style={{ border: `2px solid ${otpError ? '#CE6A6B' : '#ccc'}` }}
                    autoFocus
                  />
                  {otpError && <p className="dv2-otp-error">{otpError}</p>}
                  <div style={{ marginTop: '1rem' }}>
                    <button
                      onClick={handleVerifyAndScan}
                      disabled={otpLoading || otpCode.length !== 6}
                      className="dv2-search-btn"
                      style={{ width: '100%', maxWidth: 240, opacity: otpCode.length !== 6 ? 0.5 : 1 }}
                    >
                      {otpLoading ? t('verifying') : t('analyzBtn')}
                    </button>
                  </div>
                  <button
                    onClick={() => { setOtpCode(''); setOtpError(''); setOtpSent(false); }}
                    className="dv2-otp-resend"
                  >
                    {t('resendCode')}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Verified badge + Analyze becomes active */}
          {emailVerified && currentStep === 1 && (
            <div className="dv2-otp-verified">
              <span>{t('verifiedAs', { email: userEmail })}</span>
            </div>
          )}
        </div>
      </section>

      {/* ═══ STEP 2 — LIVE SCAN ═══ */}
      {currentStep >= 2 && (
        <section id="step-2" className={`dv2-step dv2-step-reveal ${currentStep === 2 ? 'dv2-step-active' : ''}`}>
          <div className="dv2-step-num">02</div>
          <div className="dv2-step-header">
            <h2>{t('liveScan')}</h2>
            <div className="dv2-step-meta">
              <span className="dv2-chip">{scanUrl}</span>
              {currentStep === 2 && <span className="dv2-chip dv2-chip-teal">{agentsDone}/{AGENTS.length} {t('agents')}</span>}
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
                      {agent.status === 'running' ? agent.desc : agent.status === 'done' ? t('complete') : agent.status === 'error' ? t('failed') : '—'}
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
                    <DataPreview name={agent.name} data={agent.data} t={t} />
                    {agent.durationMs > 0 && <span className="dv2-agent-ms">{agent.durationMs}ms</span>}
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ═══ TRANSITION — Computing score spinner (only while agents still running) ═══ */}
      {currentStep === 2 && !score && (
        <div id="transition-score" className="dv2-transition-panel">
          <div className="dv2-transition-spinner" />
          <h3>{t('transitionTitle')}</h3>
          <p>{t('transitionSub')}</p>
        </div>
      )}

      {/* ═══ LEGAL NAME PROMPT — after scan, before score ═══ */}
      {currentStep === 2 && score && !legalNameConfirmed && (
        <div id="legal-name-prompt" className="dv2-legal-name-panel">
          <h3>{locale === 'fr' ? 'Dernière étape avant votre score' : 'One last step before your score'}</h3>
          <p style={{ color: '#666', marginBottom: '1rem' }}>
            {locale === 'fr'
              ? 'Merci d\'indiquer le nom légal de votre entreprise (tel qu\'enregistré au registre du commerce) :'
              : 'Please enter your company\'s legal name (as registered) :'}
          </p>
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', maxWidth: '500px', margin: '0 auto' }}>
            <input
              type="text"
              value={legalName}
              onChange={(e) => setLegalName(e.target.value)}
              placeholder={locale === 'fr' ? 'Ex: Régénère Plus Sàrl' : 'Ex: Regenere Plus Ltd'}
              style={{ flex: 1, padding: '0.75rem 1rem', fontSize: '1.05rem', border: '2px solid #4A919E', borderRadius: '10px', outline: 'none', fontFamily: 'var(--font-body)', color: 'var(--text-main)', background: '#fff' }}
            />
            <button
              onClick={() => { if (legalName.trim()) setLegalNameConfirmed(true); }}
              disabled={!legalName.trim()}
              className="dv2-search-btn"
              style={{ whiteSpace: 'nowrap' }}
            >
              {locale === 'fr' ? 'Confirmer' : 'Confirm'}
            </button>
          </div>
        </div>
      )}

      {/* ═══ STEP 3 — SCORING (7 individual blocks + total) ═══ */}
      {currentStep >= 3 && score && (
        <section id="step-3" className={`dv2-step dv2-step-reveal ${currentStep === 3 ? 'dv2-step-active' : ''}`}>
          <div className="dv2-step-num">03</div>
          <h2>{t('scoreTitle')}</h2>
          <p className="dv2-step-sub">{t('scoreSub')}</p>

          {/* 7 individual score cards */}
          <div className="dv2-score-grid">
            {(score.blocks || []).map((b, i) => {
              const pct = b.maxScore > 0 ? (b.score / b.maxScore) * 100 : 0;
              const icon = BLOCK_ICONS[b.name] || '◆';
              return (
                <div
                  key={i}
                  className="dv2-score-card"
                  style={{ animationDelay: `${i * 250}ms` }}
                >
                  <div className="dv2-score-card-header">
                    <span className="dv2-score-card-icon">{icon}</span>
                    <span className="dv2-score-card-label">{b.label || b.name}</span>
                  </div>
                  <div className="dv2-score-card-bar">
                    <div
                      className={`dv2-score-card-fill ${pct >= 70 ? 'dv2-fill-good' : pct >= 40 ? 'dv2-fill-mid' : 'dv2-fill-low'}`}
                      style={{ width: scoreRevealed ? `${pct}%` : '0%', transition: `width 1.6s ease-out ${i * 250}ms` }}
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
              <span className="dv2-total-label">{t('globalScore')}</span>
              <span className="dv2-total-sub">{t('globalScoreSub')}</span>
            </div>
            <div className="dv2-total-ring">
              <svg viewBox="0 0 100 100" className="dv2-ring-svg">
                <circle cx="50" cy="50" r="42" fill="none" stroke="#E2EFE9" strokeWidth="7" />
                <circle cx="50" cy="50" r="42" fill="none" stroke="url(#sg)" strokeWidth="7" strokeLinecap="round"
                  strokeDasharray={scoreRevealed ? `${(score.total / 100) * 264} 264` : '0 264'}
                  transform="rotate(-90 50 50)" style={{ transition: 'stroke-dasharray 2.5s ease-out 1.5s' }} />
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
          <h2>{t('genFiles')}</h2>
          <p className="dv2-step-sub">{t('genFilesSub')}</p>

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
                  {revealed && <span className="dv2-file-check">{t('fileReady')}</span>}
                  {isGenerating && <span className="dv2-file-generating"><span className="dv2-dot-pulse" /> {t('fileGenerating')}</span>}
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
          <h2>{t('compareTitle')}</h2>
          <p className="dv2-step-sub">
            {t('compareSub', { count: totalInSector > 0 ? String(totalInSector) : '>4,400' })}
          </p>

          <div className="dv2-compare-card">
            {compareLoading ? (
              <div style={{ textAlign: 'center', padding: '2rem' }}>
                <span className="dv2-dot-pulse" /> {t('compareLoading')}
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
                    {t('noCompetitors')}
                  </p>
                )}

                {/* Sector average */}
                {avgScore > 0 && (
                  <div className="dv2-compare-row" style={{ borderTop: '1px solid var(--border-light)', paddingTop: '0.75rem', marginTop: '0.25rem' }}>
                    <span className="dv2-compare-label">{t('sectorAverage')}</span>
                    <div className="dv2-compare-track"><div className="dv2-compare-fill dv2-compare-fill--avg" style={{ width: `${avgScore}%` }} /></div>
                    <span className="dv2-compare-val">{avgScore}/100</span>
                  </div>
                )}

                {/* With AYO PRO — real calculated projection */}
                {proScore !== null && (
                  <div className="dv2-compare-row" style={{ borderTop: '1px solid var(--border-light)', paddingTop: '0.75rem', marginTop: '0.25rem' }}>
                    <span className="dv2-compare-label dv2-compare-label--pro">{t('withPro')}</span>
                    <div className="dv2-compare-track"><div className="dv2-compare-fill dv2-compare-fill--pro" style={{ width: `${Math.min(proScore, 100)}%` }} /></div>
                    <span className="dv2-compare-val dv2-val-pro">{Math.round(proScore)}/100</span>
                  </div>
                )}

                <p className="dv2-compare-msg">
                  {proScore !== null && proScore > score.total
                    ? `🚀 ${t('proBoost', { from: String(Math.round(score.total)), to: String(Math.round(proScore)), delta: String(Math.round(proScore - score.total)) })}`
                    : competitors.length > 0
                      ? score.total > avgScore
                        ? `🎉 ${t('aboveAverage')}`
                        : `💡 ${t('belowAverage', { count: String(competitors.filter(c => c.score > score.total).length) })}`
                      : `💡 ${t('joinRegistry')}`}
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
          <h2>{t('choosePlan')}</h2>
          <p className="dv2-step-sub">
            {isExistingClient
              ? t('existingClient')
              : t('newClient')}
          </p>

          <div className="dv2-plans">
            <div
              className={`dv2-plan${selectedPlan === 'aya_sub' ? ' dv2-plan--selected' : ''}`}
              onClick={() => handleSelectPlan('aya_sub')}
            >
              <div className="dv2-plan-name">{t('ayaName')}</div>
              <div className="dv2-plan-price">{t('ayaPrice')} <span>{t('ayaPriceUnit')}</span></div>
              <ul className="dv2-plan-list">
                <li>{t('ayaFeature1')}</li>
                <li>{t('ayaFeature2')}</li>
                <li>{t('ayaFeature3')}</li>
                <li>{t('ayaFeature4')}</li>
              </ul>
              <button className="dv2-plan-btn dv2-plan-btn--outline">
                {selectedPlan === 'aya_sub' ? t('selected') : t('selectAya')}
              </button>
            </div>
            <div
              className={`dv2-plan dv2-plan--pro${selectedPlan === 'pro' ? ' dv2-plan--selected' : ''}`}
              onClick={() => handleSelectPlan('pro')}
            >
              <div className="dv2-plan-tag">{t('proTag')}</div>
              <div className="dv2-plan-name">{t('proName')}</div>
              <div className="dv2-plan-price">{t('proPrice')} <span>{t('proPriceUnit')}</span></div>
              <ul className="dv2-plan-list">
                <li>{t('proFeature1')}</li>
                <li>{t('proFeature2')}</li>
                <li>{t('proFeature3')}</li>
                <li>{t('proFeature4')}</li>
              </ul>
              <button className="dv2-plan-btn dv2-plan-btn--solid">
                {selectedPlan === 'pro' ? t('selected') : t('selectPro')}
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
            <h2 className="dv2-payment-title">{t('payment')}</h2>
            <p className="dv2-payment-verified">
              {t('verifiedAs', { email: userEmail })}
            </p>
              <div className="dv2-payment-summary">
                <div className="dv2-payment-row">
                  <span className="dv2-payment-row-label">{t('planLabel')}</span>
                  <span className="dv2-payment-row-value">
                    {selectedPlan === 'pro' ? t('proPackPrice') : t('ayaSubPrice')}
                  </span>
                </div>
                <div className="dv2-payment-row">
                  <span className="dv2-payment-row-label">{t('emailLabel')}</span>
                  <span className="dv2-payment-row-email">{userEmail}</span>
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
                        locale,
                        analysisId,
                        legalName: legalName.trim() || undefined,
                      }),
                    });
                    const data = await res.json();
                    if (data.url) {
                      window.location.href = data.url;
                    } else {
                      setError(data.error || t('checkoutFailed'));
                      setPaymentLoading(false);
                    }
                  } catch {
                    setError(t('networkErrorRetry'));
                    setPaymentLoading(false);
                  }
                }}
                disabled={paymentLoading}
                className="dv2-search-btn"
                style={{ width: '100%', opacity: paymentLoading ? 0.7 : 1 }}
              >
                {paymentLoading ? (
                  <><span className="dv2-spinner" style={{ marginRight: 8 }} /> {t('redirectingStripe')}</>
                ) : (
                  t('proceedPayment')
                )}
              </button>
              <p className="dv2-payment-secure">{t('secureCheckout')}</p>
          </div>
        </section>
      )}

      {/* ═══ STEP 8 — CONFIRMATION ═══ */}
      {currentStep >= 8 && (
        <section id="step-8" className={`dv2-step dv2-step-reveal ${currentStep === 8 ? 'dv2-step-active' : ''}`}>
          <div className="dv2-step-num">08</div>
          <h2>{t('confirmation')}</h2>
          <div className="dv2-confirm-box">
            <div className="dv2-confirm-checkmark">
              <svg viewBox="0 0 52 52" className="dv2-confirm-svg">
                <circle cx="26" cy="26" r="24" fill="none" stroke="#4A919E" strokeWidth="3" />
                <path fill="none" stroke="#4A919E" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" d="M14 27l8 8 16-16" className="dv2-confirm-check-path" />
              </svg>
            </div>
            <h3>{t('confirmTitle')}</h3>
            <p className="dv2-confirm-sub">{t('confirmSub')}</p>

            <div className="dv2-confirm-steps">
              <div className="dv2-confirm-step-item">
                <span className="dv2-confirm-step-icon">📧</span>
                <span>{t('confirmEmail')}</span>
              </div>
              <div className="dv2-confirm-step-item">
                <span className="dv2-confirm-step-icon">📄</span>
                <span>{t('confirmFiles')}</span>
              </div>
              <div className="dv2-confirm-step-item">
                <span className="dv2-confirm-step-icon">🌍</span>
                <span>{t('confirmRegistry')}</span>
              </div>
              <div className="dv2-confirm-step-item">
                <span className="dv2-confirm-step-icon">🔗</span>
                <span>{t('confirmCert')}</span>
              </div>
            </div>

            <div className="dv2-confirm-next">
              <h4>{t('confirmNext')}</h4>
              <ul>
                <li>{t('confirmNext1')}</li>
                <li>{t('confirmNext2')}</li>
                <li>{t('confirmNext3')}</li>
              </ul>
            </div>

            <div className="dv2-confirm-actions">
              <Link href="/" className="dv2-plan-btn dv2-plan-btn--outline">{t('confirmBackHome')}</Link>
              <Link href="/aya" className="dv2-plan-btn dv2-plan-btn--solid">{t('confirmViewRegistry')}</Link>
            </div>
          </div>
        </section>
      )}

      {/* ─── ERROR ─── */}
      {error && (
        <section className="dv2-step dv2-error-box">
          <p>❌ {error}</p>
          <button onClick={() => { setCurrentStep(1); setError(null); }} className="dv2-plan-btn dv2-plan-btn--outline">{t('tryAgain')}</button>
        </section>
      )}

      {/* ─── FOOTER ─── */}
      <footer className="dv2-footer">
        <p>{t('footerCopyright')}</p>
      </footer>
    </div>
  );
}

// ─── Data Preview ───
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function DataPreview({ name, data, t }: { name: AgentName; data: any; t: (key: string, values?: Record<string, string>) => string }) {
  if (!data) return null;
  switch (name) {
    case 'detect-contact':
      return <div className="dv2-preview">
        {data.email && <span>📧 {data.email}</span>}
        {data.phone && <span>📞 {data.phone}</span>}
        {data.hasContactForm && <span>📋 {t('contactFormDetected')}</span>}
        {!data.email && !data.phone && !data.hasContactForm && <span className="dv2-muted">{t('noContactFound')}</span>}
      </div>;
    case 'detect-services': {
      const all = [...(data.services || []), ...(data.products || [])];
      return <div className="dv2-preview">{all.length > 0 ? all.slice(0, 3).map((s: string, i: number) => <span key={i}>• {s}</span>) : <span className="dv2-muted">{t('noneDetected')}</span>}{all.length > 3 && <span className="dv2-muted">{t('more', { count: String(all.length - 3) })}</span>}</div>;
    }
    case 'detect-legal': {
      const items = [...(data.policies || []), ...(data.frameworks || []), ...(data.certifications || [])];
      return <div className="dv2-preview">{items.length > 0 ? items.slice(0, 3).map((s: string, i: number) => <span key={i}>• {s}</span>) : <span className="dv2-muted">{t('noneDetected')}</span>}</div>;
    }
    case 'detect-location':
      return <div className="dv2-preview">{(data.city || data.country) ? <span>{[data.city, data.country].filter(Boolean).join(', ')}</span> : <span className="dv2-muted">{t('notFound')}</span>}</div>;
    case 'detect-security': {
      const m = (data.measures || []) as string[];
      return <div className="dv2-preview">{m.length > 0 ? m.slice(0, 4).map((s: string, i: number) => <span key={i}>{s}</span>) : <span className="dv2-muted">{t('noHeaders')}</span>}</div>;
    }
    case 'detect-jsonld':
      return <div className="dv2-preview">{data.hasOrganizationType ? <span>✓ {data.type}{data.name ? ` — ${data.name}` : ''}</span> : data.schemas?.length > 0 ? <span>⚠ {t('jsonldNoOrg')}</span> : <span className="dv2-muted">{t('notFound')}</span>}</div>;
    case 'detect-social': {
      const p = (data.platforms || []) as string[];
      return <div className="dv2-preview">{p.length > 0 ? <span>{p.join(' · ')}</span> : <span className="dv2-muted">{t('noneFound')}</span>}</div>;
    }
    case 'detect-pedagogy': {
      const items = [data.has_faq && t('pedagoFaq'), data.has_glossary && t('pedagoGlossary'), data.has_documentation && t('pedagoDoc')].filter(Boolean);
      return <div className="dv2-preview">{items.length > 0 ? <span>{items.join(' · ')}</span> : <span className="dv2-muted">{t('noneFound')}</span>}</div>;
    }
    default: return null;
  }
}
