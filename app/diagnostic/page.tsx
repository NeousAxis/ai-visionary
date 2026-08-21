'use client';

import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
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
  // Refs for values needed in compare useEffect closure (state may be stale)
  const industryKeywordsRef = useRef<string[]>([]);
  const detectedSiteTypeRef = useRef('');

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
  // Email domain(s) the scan proves the entity owns (e.g. the contact email the site
  // publishes) — happygreenkids.ch scan → bonjour@happygreenfood.ch → "happygreenfood.ch".
  const [ownerEmailDomains, setOwnerEmailDomains] = useState<string[]>([]);
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
  const [genLoading, setGenLoading] = useState(false);
  const [genError, setGenError] = useState('');
  const [analysisId, setAnalysisId] = useState('');
  const [legalName, setLegalName] = useState('');
  const [legalNameConfirmed, setLegalNameConfirmed] = useState(false);
  const [showFallback, setShowFallback] = useState(false);
  const [pastedHtml, setPastedHtml] = useState('');
  const [uploadedFileName, setUploadedFileName] = useState('');
  const [detectedSiteType, setDetectedSiteType] = useState('');
  const [industryKeywords, setIndustryKeywords] = useState<string[]>([]);

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
              industryKeywords: industryKeywordsRef.current,
              siteName: jsonldName || siteDomain,
              siteUrl: scanUrl,
              siteType: detectedSiteTypeRef.current,
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

  // ─── SSE Stream Reader (shared by startScan + startScanWithHtml) ───
  const processSseStream = useCallback(async (res: Response) => {
    // Une reponse non-SSE (502/504 nginx, redemarrage PM2) n'a aucune ligne "data: " :
    // sans ces gardes, la boucle se terminait proprement et le visiteur restait devant
    // 8 spinners infinis, sans message ni retour possible.
    if (!res.ok) { setError(t('scanFailed')); return; }
    if (!res.body) { setError(t('noResponse')); return; }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let sawTerminal = false;

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
          if (ev.phase === 'complete' || ev.phase === 'error') sawTerminal = true;
          if (ev.phase === 'agent') {
            setAgents(prev => prev.map(a =>
              a.name === ev.agent ? { ...a, status: ev.status, data: ev.data, durationMs: ev.durationMs } : a
            ));
            setTimeout(() => {
              document.getElementById('transition-score')?.scrollIntoView({ behavior: 'smooth', block: 'end' });
            }, 200);
          } else if (ev.phase === 'complete') {
            setTotalDuration(ev.totalDurationMs || 0);
            if (ev.score) {
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
            if (ev.proScore) setProScore(ev.proScore.total ?? null);
            if (ev.analysisId) setAnalysisId(ev.analysisId);
            const eName = ev.extract?.fields?.identite?.name?.value || '';
            const shortName = eName.split(/\s*[|–—]\s*/)[0].trim();
            if (shortName) setDetectedName(shortName);
            // Capture the contact-email domain the scan detected (the email the site itself
            // publishes) so the owner can verify with it even if it differs from the site domain.
            const scanEmail = (ev.extract?.fields?.identite?.contact_email?.value || '').toLowerCase().trim();
            if (scanEmail.includes('@')) {
              const d = scanEmail.split('@')[1];
              // Skip public/free providers (same blocklist as the registry) so a site listing a
              // gmail contact can't let any gmail user claim it.
              const PUBLIC_EMAIL_RE = /^(gmail|googlemail|yahoo|ymail|hotmail|outlook|live|msn|libero|virgilio|aol|gmx|orange|wanadoo|free|laposte|sfr|t-online|bluewin|hispeed|sunrise|icloud|proton|protonmail)\./i;
              if (d && !PUBLIC_EMAIL_RE.test(d)) setOwnerEmailDomains([d]);
            }
            if (ev.is_aya_registered || ev.extract?.meta?.source?.scan?.is_aya_registered) {
              setIsExistingClient(true);
            }
            // Capture business_type + industry keywords for compare endpoint
            const bType = ev.extract?.fields?.identite?.business_type?.value || '';
            if (bType) { setDetectedSiteType(bType); detectedSiteTypeRef.current = bType; }
            const iKw = ev.extract?.source?.scan?.industry_keywords || [];
            if (iKw.length) { setIndustryKeywords(iKw); industryKeywordsRef.current = iKw; }
            if (shortName) setLegalName(shortName);
            setLegalNameConfirmed(false);
            setTimeout(() => {
              document.getElementById('legal-name-prompt')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }, 800);
          } else if (ev.phase === 'error') {
            // 'scan_timeout' et 'scan_incomplete' sont des codes machine emis par le
            // serveur : le visiteur doit lire une phrase traduite, pas le code brut.
            setError(
              ev.message === 'scan_timeout' ? t('scanTimeout')
                : ev.message === 'scan_incomplete' ? t('scanIncomplete')
                  : (ev.message || t('scanFailed')));
            // Show fallback UI if site was blocked/unreachable
            if (ev.statusCode === 403 || ev.statusCode === 429 || ev.statusCode === 503 || ev.message === 'Site unreachable') {
              setShowFallback(true);
              setCurrentStep(1);
            }
          }
        } catch { /* skip */ }
      }
    }
    // Flux termine sans 'complete' ni 'error' : connexion coupee en route.
    if (!sawTerminal) setError(t('scanFailed'));
  }, [t]);

  // ─── Start Scan ───
  const startScan = useCallback(async (skipEmailCheck = false) => {
    if (!url.trim()) return;
    if (!emailVerified && !skipEmailCheck) return;

    setCurrentStep(2);
    setError(null);
    setShowFallback(false);
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
      await processSseStream(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('networkError'));
    }
  }, [url, emailVerified, scrollTo, userEmail, processSseStream, t]);

  // ─── Start Scan with provided HTML (upload fallback) ───
  const startScanWithHtml = useCallback(async (htmlContent: string) => {
    if (!htmlContent.trim() || htmlContent.length < 500) return;

    setCurrentStep(2);
    setError(null);
    setShowFallback(false);
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
        body: JSON.stringify({ url: url.trim(), email: userEmail, htmlContent }),
      });
      await processSseStream(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('networkError'));
    }
  }, [url, userEmail, scrollTo, processSseStream, t]);

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
        // Only re-scan if the scan never completed (e.g. user landed on OTP step
        // without having scanned first). Otherwise the OTP just unlocks payment —
        // the scan results from step 2 are still valid.
        if (!score) {
          startScan(true);
        }
        return;
      } else {
        setOtpError(t('otpError'));
      }
    } catch {
      setOtpError(t('networkError'));
    }
    setOtpLoading(false);
  };

  // ─── Free claim handler: vérifie l'OTP + génère + email + publie sur AYA ───
  const handleClaimAndGenerate = async () => {
    setGenLoading(true);
    setGenError('');
    try {
      const res = await fetch('/api/diagnostic/generate-free', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: userEmail, code: otpCode, analysisId, url: scanUrl, locale }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setCurrentStep(8);
        setTimeout(() => scrollTo('step-8'), 100);
      } else {
        setGenError(
          data.error ||
            (locale === 'fr'
              ? 'Échec. Vérifie le code et réessaie.'
              : 'Failed. Check the code and retry.'),
        );
      }
    } catch {
      setGenError(locale === 'fr' ? 'Erreur réseau.' : 'Network error.');
    }
    setGenLoading(false);
  };

  // ─── Domain match for email verification ───
  const urlDomain = url.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0].toLowerCase();
  const emailDomain = userEmail.split('@')[1]?.toLowerCase() || '';
  // Accept the scanned domain OR an email domain the scan proves the entity owns.
  const acceptedEmailDomains = [urlDomain, ...ownerEmailDomains]
    .filter((d, i, a) => d && a.indexOf(d) === i);
  const domainMatch = emailDomain.length > 0 && acceptedEmailDomains.includes(emailDomain);
  const acceptedDomainsLabel = acceptedEmailDomains.map(d => '@' + d).join(locale === 'fr' ? ' ou ' : ' or ');

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
          <form className="dv2-search-form" onSubmit={async e => {
            e.preventDefault();
            if (!url.trim()) return;
            // Check AYA registry first — redirect to dashboard if entity exists
            try {
              const domain = url.trim().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/.*$/, '');
              if (domain.includes('.') && domain.length >= 4) {
                const res = await fetch(`/api/aya/entity/${encodeURIComponent(domain)}`);
                if (res.ok) {
                  const data = await res.json();
                  const eid = data?.entity?.entity_id;
                  if (eid && data?.scoring?.asr_status === 'ASR_CERTIFIED') {
                    window.location.href = `/dashboard/${eid}`;
                    return;
                  }
                }
              }
            } catch { /* ignore, proceed normally */ }
            startScan(true); // scan ouvert — l'OTP arrive au moment de réclamer les fichiers (step 6)
          }}>
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
              <button type="submit" disabled={currentStep > 1 || !url.trim()} className="dv2-search-btn">
                {currentStep === 2 ? <span className="dv2-spinner" /> : currentStep > 2 ? t('analyzDone') : t('analyzBtn')}
              </button>
            </div>
          </form>

          {/* Email/OTP déplacé au step 6 (réclamation gratuite) — le scan est désormais ouvert */}
          {false && url && !emailVerified && currentStep === 1 && (
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
                  {domainMatch ? t('domainMatch') : t('domainMismatch', { domain: acceptedDomainsLabel })}
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
                    <DataPreview name={agent.name} data={agent.data} t={t} locale={locale} />
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
      {currentStep >= 5 && score && (() => {
        // Detect if the scanned site is AI Visionary itself — no competitors to compare against
        const scannedHost = scanUrl.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0].toLowerCase();
        const isOwnPlatform = scannedHost === 'ai-visionary.xyz' || scannedHost === 'ai-visionary.com' || scannedHost === 'beta.ai-visionary.xyz';

        return (
        <section id="step-5" className={`dv2-step dv2-step-reveal ${currentStep === 5 ? 'dv2-step-active' : ''}`}>
          <div className="dv2-step-num">05</div>
          <h2>{t('compareTitle')}</h2>
          <p className="dv2-step-sub">
            {isOwnPlatform
              ? t('compareSubSelf', { defaultValue: 'AI Visionary est le fournisseur du registre AYA — aucun concurrent à comparer.' })
              : t('compareSub', { count: totalInSector > 0 ? String(totalInSector) : '>4,400' })}
          </p>

          <div className="dv2-compare-card">
            {compareLoading ? (
              <div style={{ textAlign: 'center', padding: '2rem' }}>
                <span className="dv2-dot-pulse" /> {t('compareLoading')}
              </div>
            ) : isOwnPlatform ? (
              <div style={{ textAlign: 'center', padding: '1.5rem' }}>
                <p style={{ fontSize: '1rem', color: 'var(--text-main)', fontWeight: 600, marginBottom: '0.75rem' }}>
                  🏛️ {t('compareSelfTitle', { defaultValue: 'Vous êtes la référence du registre AYA' })}
                </p>
                <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', lineHeight: 1.6 }}>
                  {t('compareSelfDesc', { defaultValue: 'AI Visionary maintient le registre AYA. La section comparative ne s\'applique donc pas — vous êtes à l\'origine du standard.' })}
                </p>
              </div>
            ) : (
              <>
                {/* Your score — always first */}
                <div className="dv2-compare-row">
                  <span className="dv2-compare-label dv2-compare-label--you">⬤ {legalName || detectedName || scanUrl.replace(/^https?:\/\//, '').split('/')[0]}</span>
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
        );
      })()}

      {/* ═══ STEP 6 — CHOOSE PLAN ═══ */}
      {currentStep >= 6 && (
        <section id="step-6" className={`dv2-step dv2-step-reveal ${currentStep === 6 ? 'dv2-step-active' : ''}`}>
          <div className="dv2-step-num">06</div>
          <h2>{locale === 'fr' ? 'Recevez vos 5 fichiers — gratuitement' : 'Get your 5 files — for free'}</h2>
          <p className="dv2-step-sub">
            {locale === 'fr'
              ? 'On vous envoie vos 5 fichiers ASR par email et on publie votre fiche sur AYA. Confirmez votre email : il devient votre accès admin (consulter / mettre à jour / transférer à un collaborateur).'
              : 'We email you your 5 ASR files and publish your record on AYA. Confirm your email: it becomes your admin access (view / update / transfer to a colleague).'}
          </p>

          <div className="dv2-otp-section">
            <input
              type="email"
              value={userEmail}
              onChange={(e) => setUserEmail(e.target.value)}
              placeholder={`you@${urlDomain}`}
              className="dv2-otp-email-input"
              style={{ border: `1px solid ${userEmail && !domainMatch ? '#CE6A6B' : '#ccc'}` }}
            />
            {userEmail.includes('@') && (
              <p className="dv2-otp-domain-badge" style={{ color: domainMatch ? '#4A919E' : '#CE6A6B' }}>
                {domainMatch ? t('domainMatch') : t('domainMismatch', { domain: acceptedDomainsLabel })}
              </p>
            )}
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
            {otpSent && (
              <div style={{ marginTop: '1rem' }}>
                <p className="dv2-otp-code-sent">{t('codeSentTo', { email: otpMaskedEmail || userEmail })}</p>
                <input
                  type="text" inputMode="numeric" maxLength={6}
                  value={otpCode}
                  onChange={e => setOtpCode(e.target.value.replace(/\D/g, ''))}
                  placeholder="000000"
                  className="dv2-otp-code-input"
                  style={{ border: `2px solid ${genError ? '#CE6A6B' : '#ccc'}` }}
                  autoFocus
                />
                {genError && <p className="dv2-otp-error">{genError}</p>}
                <div style={{ marginTop: '1rem' }}>
                  <button
                    onClick={handleClaimAndGenerate}
                    disabled={genLoading || otpCode.length !== 6}
                    className="dv2-search-btn"
                    style={{ width: '100%', maxWidth: 320, opacity: otpCode.length !== 6 ? 0.5 : 1 }}
                  >
                    {genLoading
                      ? (locale === 'fr' ? 'Génération…' : 'Generating…')
                      : (locale === 'fr' ? 'Recevoir mes 5 fichiers' : 'Get my 5 files')}
                  </button>
                </div>
                <button
                  onClick={() => { setOtpCode(''); setGenError(''); setOtpSent(false); }}
                  className="dv2-otp-resend"
                >
                  {t('resendCode')}
                </button>
              </div>
            )}
          </div>

        </section>
      )}

      {/* ═══ STEP 7 — PAYMENT (neutralisé : livraison 100% gratuite, le flux va step 6 → step 8) ═══ */}
      {false && (
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
      {error && !showFallback && (
        <section className="dv2-step dv2-error-box">
          <p>&#x274C; {error}</p>
          <button onClick={() => { setCurrentStep(1); setError(null); }} className="dv2-plan-btn dv2-plan-btn--outline">{t('tryAgain')}</button>
        </section>
      )}

      {/* ─── FALLBACK: HTML Upload (site blocked / unreachable) ─── */}
      {showFallback && !score && (
        <section className="dv2-step dv2-fallback-box" id="fallback-upload">
          <h3>{t('fallbackTitle')}</h3>
          <p className="dv2-step-sub">{t('fallbackDesc')}</p>

          <div className="dv2-fallback-option">
            <label className="dv2-fallback-label">{t('fallbackPaste')}</label>
            <textarea
              className="dv2-fallback-textarea"
              placeholder={t('fallbackPastePlaceholder')}
              value={pastedHtml}
              onChange={e => { setPastedHtml(e.target.value); setUploadedFileName(''); }}
              rows={8}
            />
          </div>

          <div className="dv2-fallback-option">
            <label className="dv2-fallback-label">{t('fallbackUpload')}</label>
            <label className="dv2-search-btn dv2-fallback-upload-btn">
              {t('fallbackUploadBtn')}
              <input
                type="file"
                accept=".html,.htm"
                style={{ display: 'none' }}
                onChange={e => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const reader = new FileReader();
                  reader.onload = (ev) => {
                    const content = ev.target?.result as string;
                    setPastedHtml(content);
                    setUploadedFileName(file.name);
                  };
                  reader.readAsText(file);
                }}
              />
            </label>
            {uploadedFileName && (
              <p className="dv2-fallback-file-info">
                {t('fallbackFileLoaded', { name: uploadedFileName, size: String(Math.round(pastedHtml.length / 1024)) })}
              </p>
            )}
          </div>

          <p className="dv2-otp-hint">{t('fallbackWarning')}</p>

          <button
            className="dv2-search-btn"
            disabled={pastedHtml.trim().length < 500}
            onClick={() => startScanWithHtml(pastedHtml)}
            style={{ marginTop: '1rem' }}
          >
            {t('fallbackSubmit')}
          </button>
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
function DataPreview({ name, data, t, locale }: { name: AgentName; data: any; t: (key: string, values?: Record<string, string>) => string; locale: string }) {
  if (!data) return null;
  const fr = locale === 'fr';
  const ok = (k: string, v: string) => <span key={k} className="dv2-field-ok">{v}</span>;
  const miss = (k: string, v: string) => <span key={k} className="dv2-field-miss">{v}</span>;

  switch (name) {
    case 'detect-contact':
      return <div className="dv2-preview dv2-preview-detail">
        {data.email ? ok('email', data.email) : miss('email', 'Email')}
        {data.phone ? ok('phone', data.phone) : miss('phone', fr ? 'Téléphone' : 'Phone')}
        {data.hasContactForm ? ok('form', fr ? 'Formulaire de contact' : 'Contact form') : miss('form', fr ? 'Formulaire de contact' : 'Contact form')}
      </div>;
    case 'detect-services': {
      const svcs = (data.services || []) as string[];
      const prods = (data.products || []) as string[];
      const audience = data.target_audience as string | undefined;
      const useCases = (data.use_cases || []) as string[];
      const pricing = data.pricing as string | undefined;
      return <div className="dv2-preview dv2-preview-detail">
        {svcs.length > 0 ? svcs.slice(0, 3).map((s: string, i: number) => ok(`svc-${i}`, s)) : miss('svcs', 'Services')}
        {svcs.length > 3 && <span key="svc-more" className="dv2-muted">+{svcs.length - 3}</span>}
        {prods.length > 0 ? prods.slice(0, 2).map((s: string, i: number) => ok(`prod-${i}`, s)) : miss('prods', fr ? 'Produits' : 'Products')}
        {audience ? ok('audience', audience.length > 40 ? audience.substring(0, 40) + '...' : audience) : miss('audience', fr ? 'Public cible' : 'Target audience')}
        {useCases.length > 0 ? ok('usecases', useCases.slice(0, 2).join(', ')) : miss('usecases', fr ? 'Cas d\'usage' : 'Use cases')}
        {pricing ? ok('pricing', pricing.length > 30 ? pricing.substring(0, 30) + '...' : pricing) : miss('pricing', fr ? 'Tarification' : 'Pricing')}
      </div>;
    }
    case 'detect-legal': {
      const policies = (data.policies || []) as string[];
      const frameworks = (data.frameworks || []) as string[];
      const certs = (data.certifications || []) as string[];
      return <div className="dv2-preview dv2-preview-detail">
        {policies.length > 0
          ? ok('pol', `${fr ? 'Politiques' : 'Policies'} (${policies.length}) — ${policies.slice(0, 3).join(', ')}${policies.length > 3 ? '...' : ''}`)
          : miss('pol', fr ? 'Politiques (CGV, mentions légales)' : 'Policies (Terms, Legal)')}
        {frameworks.length > 0
          ? ok('fw', `${fr ? 'Conformité' : 'Compliance'} — ${frameworks.join(', ')}`)
          : miss('fw', fr ? 'Conformité (RGPD, HIPAA...)' : 'Compliance (GDPR, HIPAA...)')}
        {certs.length > 0
          ? ok('cert', `${fr ? 'Certifications' : 'Certifications'} — ${certs.join(', ')}`)
          : miss('cert', fr ? 'Certifications (ISO, SOC2...)' : 'Certifications (ISO, SOC2...)')}
      </div>;
    }
    case 'detect-location':
      return <div className="dv2-preview dv2-preview-detail">
        {data.city ? ok('city', data.city) : miss('city', fr ? 'Ville' : 'City')}
        {data.country ? ok('country', data.country) : miss('country', fr ? 'Pays' : 'Country')}
      </div>;
    case 'detect-security': {
      const m = (data.measures || []) as string[];
      return <div className="dv2-preview dv2-preview-detail">
        {m.length > 0
          ? ok('sec', `${fr ? 'Mesures de sécurité' : 'Security measures'} (${m.length}) — ${m.slice(0, 3).join(', ')}${m.length > 3 ? '...' : ''}`)
          : miss('sec', fr ? 'Aucune mesure détectée' : 'No security measures detected')}
      </div>;
    }
    case 'detect-jsonld':
      return <div className="dv2-preview dv2-preview-detail">
        {data.hasOrganizationType ? ok('org', `${data.type}${data.name ? ` — ${data.name}` : ''}`) : miss('org', fr ? 'Schema Organization' : 'Organization Schema')}
        {data.hasFaqSchema ? ok('faq-schema', 'FAQ Schema') : miss('faq-schema', 'FAQ Schema')}
      </div>;
    case 'detect-social': {
      const p = (data.platforms || []) as string[];
      const expectedPlatforms = ['LinkedIn', 'Facebook', 'Instagram'];
      const missingPlatforms = expectedPlatforms.filter(ep => !p.some((dp: string) => dp.toLowerCase() === ep.toLowerCase()));
      return <div className="dv2-preview dv2-preview-detail">
        {p.map((platform: string, i: number) => ok(`social-${i}`, platform))}
        {missingPlatforms.map((mp, i) => miss(`miss-social-${i}`, mp))}
      </div>;
    }
    case 'detect-pedagogy':
      return <div className="dv2-preview dv2-preview-detail">
        {data.has_faq ? ok('faq', 'FAQ') : miss('faq', 'FAQ')}
        {data.has_glossary ? ok('glossary', fr ? 'Glossaire' : 'Glossary') : miss('glossary', fr ? 'Glossaire' : 'Glossary')}
        {data.has_documentation ? ok('doc', 'Documentation') : miss('doc', 'Documentation')}
      </div>;
    default: return null;
  }
}
