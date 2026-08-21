'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import RenewButtons from './RenewButtons';

// ─── Types ───

interface ScoreBlock {
  name: string;
  label: string;
  score: number;
  maxScore: number;
}

interface AnalysisHistoryEntry {
  id: string;
  score: number;
  created_at: string;
}

interface DashboardProps {
  entityId: string;
  name: string;
  analysisEmail: string;
  contactEmail: string;
  url: string;
  score: number | null;
  blocks: ScoreBlock[];
  packLabel: string;
  expiryDisplay: string;
  isExpired: boolean;
  isActive: boolean;
  expiresSoon: boolean;
  currentPackType: 'PRO' | 'AYA_SUB';
  isCertified: boolean;
  proUrl: string;
  ayaUrl: string;
  hasRequiredInfo: boolean;
  history: AnalysisHistoryEntry[];
  lastScanDate: string | null;
  detectedServices: string[];
  detectedCountry: string;
  updateToken: string;
}

const BLOCK_ICONS: Record<string, string> = {
  identite: '🪪',
  offre: '🎯',
  processus_methodes: '⚙️',
  engagements_conformite: '🛡️',
  indicateurs: '📊',
  contenus_pedagogiques: '📚',
  structure_technique: '🔧',
};

const BLOCK_MAX: Record<string, number> = {
  identite: 10,
  offre: 20,
  processus_methodes: 15,
  engagements_conformite: 15,
  indicateurs: 20,
  contenus_pedagogiques: 10,
  structure_technique: 10,
};

// ─── OTP Gate ───

function OtpGate({ analysisEmail, entityId, children }: { analysisEmail: string; entityId: string; children: React.ReactNode }) {
  const t = useTranslations('dashboard');
  const [step, setStep] = useState<'email' | 'code' | 'verified'>(() => {
    try {
      const verified = typeof window !== 'undefined' && sessionStorage.getItem('ayo_verified_email');
      if (verified && analysisEmail && verified === analysisEmail.trim().toLowerCase()) {
        return 'verified';
      }
    } catch {}
    return 'email';
  });
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Mask the analysis email for hint: "he***@wh***.com"
  const maskedHint = analysisEmail
    ? analysisEmail.replace(/^(.{2})[^@]*(@.{2})[^.]*/, '$1***$2***')
    : '';

  const handleSendOtp = async () => {
    setError('');
    if (!email.trim()) { setError('Email required'); return; }
    // Must match EXACTLY the email used during analysis
    if (email.trim().toLowerCase() !== analysisEmail.toLowerCase()) {
      setError(t('otpError'));
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/auth/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), entityId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to send code');
      setStep('code');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Network error');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    setError('');
    if (!code.trim() || code.trim().length < 4) { setError('Enter the 6-digit code'); return; }
    setLoading(true);
    try {
      const res = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), code: code.trim() }),
      });
      if (!res.ok) throw new Error(t('otpError'));
      // Store verified email so /update page skips OTP
      try { sessionStorage.setItem('ayo_verified_email', email.trim().toLowerCase()); } catch {}
      setStep('verified');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Network error');
    } finally {
      setLoading(false);
    }
  };

  if (step === 'verified') return <>{children}</>;

  return (
    <div style={{
      background: '#fff', borderRadius: '12px', border: '1px solid #e5e7eb',
      padding: '2.5rem 2rem', maxWidth: '450px', margin: '3rem auto', textAlign: 'center',
    }}>
      <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>
        {step === 'email' ? '🔐' : '📧'}
      </div>
      <h2 style={{ color: '#212E53', fontSize: '1.3rem', marginBottom: '0.5rem' }}>
        {t('otpTitle')}
      </h2>
      <p style={{ color: '#6b7280', fontSize: '0.9rem', marginBottom: '1.5rem', lineHeight: 1.5 }}>
        {step === 'email'
          ? `${t('otpSubtitle')}${maskedHint ? ` (${maskedHint})` : ''}`
          : t('otpCodeSent', { email })
        }
      </p>

      {step === 'email' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <input
            type="email" value={email}
            onChange={e => setEmail(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSendOtp()}
            placeholder={t('otpPlaceholder')}
            style={{
              width: '100%', padding: '12px 16px', borderRadius: '8px',
              border: '1px solid #e5e7eb', fontSize: '1rem', color: '#212E53',
              background: '#fff', outline: 'none', boxSizing: 'border-box',
            }}
            autoFocus
          />
          <button
            onClick={handleSendOtp} disabled={loading}
            style={{
              width: '100%', padding: '12px', borderRadius: '8px', border: 'none',
              background: loading ? '#9ca3af' : '#4A919E', color: '#fff',
              fontWeight: 700, fontSize: '0.95rem',
              cursor: loading ? 'wait' : 'pointer',
            }}
          >
            {loading ? t('otpSending') : t('otpSendCode')}
          </button>
        </div>
      )}

      {step === 'code' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <input
            type="text" value={code}
            onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            onKeyDown={e => e.key === 'Enter' && handleVerifyOtp()}
            placeholder="000000"
            style={{
              width: '100%', padding: '12px 16px', borderRadius: '8px',
              border: '1px solid #e5e7eb', fontSize: '1.5rem', color: '#212E53',
              background: '#fff', textAlign: 'center', letterSpacing: '0.3em',
              fontFamily: 'monospace', outline: 'none', boxSizing: 'border-box',
            }}
            autoFocus
          />
          <button
            onClick={handleVerifyOtp} disabled={loading}
            style={{
              width: '100%', padding: '12px', borderRadius: '8px', border: 'none',
              background: loading ? '#9ca3af' : '#4A919E', color: '#fff',
              fontWeight: 700, fontSize: '0.95rem', cursor: loading ? 'wait' : 'pointer',
            }}
          >
            {loading ? t('otpVerifying') : t('otpVerify')}
          </button>
          <button
            onClick={() => { setStep('email'); setCode(''); setError(''); }}
            style={{ background: 'none', border: 'none', color: '#6b7280', fontSize: '0.85rem', cursor: 'pointer', textDecoration: 'underline' }}
          >
            {t('otpResend')}
          </button>
        </div>
      )}

      {error && (
        <div style={{
          background: '#FEE2E2', border: '1px solid #FECACA', color: '#991B1B',
          padding: '10px 14px', borderRadius: '8px', fontSize: '0.85rem', marginTop: '0.75rem',
        }}>
          {error}
        </div>
      )}
    </div>
  );
}

// ─── Score Ring ───

function ScoreRing({ total }: { total: number }) {
  const pct = total / 100;
  const color = total >= 70 ? '#4A919E' : total >= 40 ? '#D97706' : '#CE6A6B';
  return (
    <div style={{ position: 'relative', width: 120, height: 120 }}>
      <svg viewBox="0 0 100 100" style={{ width: '100%', height: '100%' }}>
        <circle cx="50" cy="50" r="42" fill="none" stroke="#E2EFE9" strokeWidth="7" />
        <circle cx="50" cy="50" r="42" fill="none" stroke={color} strokeWidth="7" strokeLinecap="round"
          strokeDasharray={`${pct * 264} 264`}
          transform="rotate(-90 50 50)"
          style={{ transition: 'stroke-dasharray 1.2s ease-out' }}
        />
      </svg>
      <div style={{
        position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
      }}>
        <span style={{ fontSize: '1.8rem', fontWeight: 800, color: '#212E53', lineHeight: 1 }}>{Math.round(total)}</span>
        <span style={{ fontSize: '0.75rem', color: '#6b7280' }}>/100</span>
      </div>
    </div>
  );
}

// ─── Main Dashboard ───

export default function DashboardClient(props: DashboardProps) {
  const t = useTranslations('dashboard');
  const [rescanLoading, setRescanLoading] = useState(false);
  const [rescanScore, setRescanScore] = useState<number | null>(null);
  const [rescanBlocks, setRescanBlocks] = useState<ScoreBlock[] | null>(null);
  const [rescanError, setRescanError] = useState<string | null>(null);
  // Les codes machine scan_timeout / scan_incomplete sont traduits dans le namespace
  // diagnostic (les cles y vivent deja pour la page publique).
  const tDiag = useTranslations('diagnostic');
  const [competitors, setCompetitors] = useState<{ name: string; score: number; country: string; certified?: boolean }[]>([]);
  const [avgScore, setAvgScore] = useState(0);
  const [compareLoading, setCompareLoading] = useState(false);

  const displayScore = rescanScore ?? props.score;
  const displayBlocks = rescanBlocks ?? props.blocks;

  // ─── Load competitors on mount ───
  useEffect(() => {
    if (!props.url || !props.detectedServices.length) return;
    setCompareLoading(true);
    const domain = props.url.replace(/^https?:\/\//, '').split('/')[0];
    fetch('/api/diagnostic/compare', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        country: props.detectedCountry,
        services: props.detectedServices,
        siteName: props.name,
        siteUrl: props.url,
      }),
    })
      .then(r => r.json())
      .then(data => {
        if (data.competitors?.length) setCompetitors(data.competitors);
        if (data.averageScore) setAvgScore(data.averageScore);
      })
      .catch(() => {})
      .finally(() => setCompareLoading(false));
  }, []);

  // ─── Re-scan handler (SSE like diagnostic-v2) ───
  const handleRescan = async () => {
    if (rescanLoading) return;
    setRescanLoading(true);
    setRescanScore(null);
    setRescanBlocks(null);
    setRescanError(null);
    try {
      const res = await fetch('/api/diagnostic/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: props.url }),
      });
      if (!res.ok || !res.body) { setRescanError(tDiag('scanFailed')); setRescanLoading(false); return; }

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
            if (ev.phase === 'complete' && ev.score) {
              const blocksObj = ev.score.blocks || {};
              const blocksArr = Object.entries(blocksObj).map(([key, val]) => ({
                name: key,
                label: t(`block${key.charAt(0).toUpperCase() + key.slice(1).replace(/_([a-z])/g, (_, c: string) => c.toUpperCase())}` as any) || key,
                score: typeof val === 'number' ? val : 0,
                maxScore: BLOCK_MAX[key] || 10,
              }));
              // Score protection: never show a LOWER score than what the user already has
              const newTotal = ev.score.total ?? 0;
              const currentTotal = props.score ?? 0;
              setRescanScore(Math.max(newTotal, currentTotal));
              setRescanBlocks(blocksArr);
            } else if (ev.phase === 'error') {
              setRescanError(
                ev.message === 'scan_timeout' ? tDiag('scanTimeout')
                  : ev.message === 'scan_incomplete' ? tDiag('scanIncomplete')
                    : (ev.message || tDiag('scanFailed')));
            }
          } catch { /* skip */ }
        }
      }
      if (!sawTerminal) setRescanError(tDiag('scanFailed'));
    } catch { /* ignore */ }
    setRescanLoading(false);
  };

  const dashboard = (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: '0 1rem 4rem' }}>

      {/* ─── HEADER ─── */}
      <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
        <p style={{ color: '#4A919E', fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', fontSize: '0.85rem', marginBottom: '0.5rem' }}>
          {t('title')}
        </p>
        <h1 style={{ fontSize: 'clamp(1.6rem, 4vw, 2.2rem)', color: '#212E53', marginBottom: '0.25rem' }}>
          {props.name}
        </h1>
        <p style={{ color: '#6b7280', fontSize: '0.95rem' }}>{t('subtitle')}</p>
      </div>

      {/* ─── SCORE OVERVIEW ─── */}
      {displayScore !== null && (
        <div style={{
          background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb',
          padding: '2rem', marginBottom: '1.5rem',
        }}>
          <h3 style={{ color: '#212E53', fontSize: '1.1rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: 8 }}>
            📊 {t('scoreTitle')}
          </h3>

          {/* Ring + blocks side by side */}
          <div style={{ display: 'flex', gap: '2rem', alignItems: 'flex-start', flexWrap: 'wrap' }}>
            {/* Ring */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 140 }}>
              <ScoreRing total={displayScore} />
              <span style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: 8 }}>{t('globalScore')}</span>
              {props.lastScanDate && (
                <span style={{ fontSize: '0.7rem', color: '#9ca3af', marginTop: 4 }}>
                  {t('lastScan')}: {new Date(props.lastScanDate).toLocaleDateString()}
                </span>
              )}
            </div>

            {/* 7 bloc bars */}
            <div style={{ flex: 1, minWidth: 280 }}>
              {displayBlocks.length > 0 ? displayBlocks.map((b) => {
                const pct = b.maxScore > 0 ? (b.score / b.maxScore) * 100 : 0;
                const icon = BLOCK_ICONS[b.name] || '◆';
                const barColor = pct >= 70 ? '#4A919E' : pct >= 40 ? '#D97706' : '#CE6A6B';
                return (
                  <div key={b.name} style={{ marginBottom: 10 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 }}>
                      <span style={{ fontSize: '0.8rem', color: '#374151' }}>
                        {icon} {b.label}
                      </span>
                      <span style={{ fontSize: '0.8rem', fontWeight: 600, color: barColor }}>
                        {b.score?.toFixed?.(1) ?? '0'}/{b.maxScore}
                      </span>
                    </div>
                    <div style={{ background: '#E2EFE9', borderRadius: 4, height: 6, overflow: 'hidden' }}>
                      <div style={{
                        height: '100%', borderRadius: 4, background: barColor,
                        width: `${Math.min(pct, 100)}%`, transition: 'width 0.8s ease-out',
                      }} />
                    </div>
                  </div>
                );
              }) : (
                <p style={{ color: '#9ca3af', fontSize: '0.85rem', textAlign: 'center', padding: '1rem 0' }}>
                  No detailed breakdown available. Run a re-scan to get full block scores.
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ─── COMPETITORS ─── */}
      {(competitors.length > 0 || compareLoading) && (
        <div style={{
          background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb',
          padding: '1.5rem 2rem', marginBottom: '1.5rem',
        }}>
          <h3 style={{ color: '#212E53', fontSize: '1.1rem', marginBottom: '1rem' }}>
            🏆 {t('competitorsTitle')}
          </h3>
          {compareLoading ? (
            <p style={{ color: '#9ca3af', fontSize: '0.85rem', textAlign: 'center' }}>{t('competitorsLoading')}</p>
          ) : (
            <>
              {/* Your position */}
              {displayScore !== null && avgScore > 0 && (
                <div style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '12px 16px', background: '#f0fdf4', borderRadius: 8, marginBottom: 12,
                  border: '1px solid #6EE7B7',
                }}>
                  <span style={{ fontWeight: 700, color: '#065F46' }}>
                    {props.name.split(/\s*[|–—]\s*/)[0]}
                  </span>
                  <span style={{ fontWeight: 700, color: '#4A919E', fontSize: '1.1rem' }}>
                    {Math.round(displayScore)}/100
                  </span>
                </div>
              )}
              {/* Competitor list */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {competitors.slice(0, 5).map((c, i) => (
                  <div key={i} style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '8px 16px', background: '#f9fafb', borderRadius: 6, fontSize: '0.85rem',
                  }}>
                    <span style={{ color: '#374151' }}>
                      {c.name} {c.certified && <span style={{ fontSize: '0.7rem', color: '#4A919E' }}>✓</span>}
                    </span>
                    <span style={{
                      fontWeight: 600,
                      color: c.score >= 70 ? '#4A919E' : c.score >= 40 ? '#D97706' : '#CE6A6B',
                    }}>
                      {c.score}/100
                    </span>
                  </div>
                ))}
              </div>
              {avgScore > 0 && (
                <p style={{ fontSize: '0.78rem', color: '#9ca3af', marginTop: 8, textAlign: 'center' }}>
                  {t('competitorsAvg')}: {Math.round(avgScore)}/100
                </p>
              )}
            </>
          )}
        </div>
      )}

      {/* ─── QUICK ACTIONS ─── */}
      <div style={{
        background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb',
        padding: '1.5rem 2rem', marginBottom: '1.5rem',
      }}>
        <h3 style={{ color: '#212E53', fontSize: '1.1rem', marginBottom: '1rem' }}>
          ⚡ {t('actions')}
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
          {/* Re-scan */}
          <button
            onClick={handleRescan}
            disabled={rescanLoading}
            style={{
              display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 4,
              padding: '1rem', borderRadius: 8, border: '1px solid #e5e7eb',
              background: rescanLoading ? '#f3f4f6' : '#fff', cursor: rescanLoading ? 'wait' : 'pointer',
              textAlign: 'left', transition: 'border-color 0.2s',
            }}
            onMouseEnter={e => { if (!rescanLoading) (e.currentTarget as HTMLButtonElement).style.borderColor = '#4A919E'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = '#e5e7eb'; }}
          >
            <span style={{ fontSize: '1.2rem' }}>🔄</span>
            <span style={{ fontWeight: 600, color: '#212E53', fontSize: '0.9rem' }}>
              {rescanLoading ? t('rescanRunning') : t('rescan')}
            </span>
            <span style={{ fontSize: '0.78rem', color: '#6b7280' }}>{t('rescanDesc')}</span>
            {rescanError && (
              <span style={{ fontSize: '0.78rem', color: '#b91c1c' }}>{rescanError}</span>
            )}
          </button>

          {/* Regenerate files — only active for PRO pack */}
          <button
            onClick={async () => {
              if (props.currentPackType !== 'PRO') return;
              try {
                const res = await fetch('/api/regenerate-files', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ entityId: props.entityId, token: props.updateToken }),
                });
                if (res.ok) alert('Files regenerated and sent to your email!');
                else alert('Error regenerating files. Please try again.');
              } catch { alert('Network error. Please try again.'); }
            }}
            disabled={props.currentPackType !== 'PRO'}
            style={{
              display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 4,
              padding: '1rem', borderRadius: 8, border: '1px solid #e5e7eb',
              background: props.currentPackType !== 'PRO' ? '#f3f4f6' : '#fff',
              cursor: props.currentPackType !== 'PRO' ? 'not-allowed' : 'pointer',
              textAlign: 'left', transition: 'border-color 0.2s',
              opacity: props.currentPackType !== 'PRO' ? 0.5 : 1,
            }}
            onMouseEnter={e => { if (props.currentPackType === 'PRO') (e.currentTarget as HTMLButtonElement).style.borderColor = '#4A919E'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = '#e5e7eb'; }}
          >
            <span style={{ fontSize: '1.2rem' }}>📄</span>
            <span style={{ fontWeight: 600, color: props.currentPackType !== 'PRO' ? '#9ca3af' : '#212E53', fontSize: '0.9rem' }}>{t('regenFiles')}</span>
            <span style={{ fontSize: '0.78rem', color: '#6b7280' }}>
              {props.currentPackType !== 'PRO' ? t('regenProOnly') : t('regenDesc')}
            </span>
          </button>

          {/* Update data */}
          <Link
            href={`/update/${props.entityId}`}
            style={{
              display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 4,
              padding: '1rem', borderRadius: 8, border: '1px solid #e5e7eb',
              background: '#fff', textDecoration: 'none', transition: 'border-color 0.2s',
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.borderColor = '#4A919E'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.borderColor = '#e5e7eb'; }}
          >
            <span style={{ fontSize: '1.2rem' }}>✏️</span>
            <span style={{ fontWeight: 600, color: '#212E53', fontSize: '0.9rem' }}>{t('updateData')}</span>
            <span style={{ fontSize: '0.78rem', color: '#6b7280' }}>{t('updateDesc')}</span>
          </Link>
        </div>
      </div>

      {/* ─── ACCOUNT INFO ─── */}
      <div style={{
        background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb',
        padding: '1.5rem 2rem', marginBottom: '1.5rem',
      }}>
        <h3 style={{ color: '#212E53', fontSize: '1.1rem', marginBottom: '1rem' }}>
          👤 {t('accountTitle')}
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
          <div>
            <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: '#9ca3af', letterSpacing: '0.05em' }}>{t('packLabel')}</span>
            <p style={{ fontWeight: 600, color: '#212E53', fontSize: '1rem', marginTop: 2 }}>{props.packLabel}</p>
          </div>
          <div>
            <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: '#9ca3af', letterSpacing: '0.05em' }}>{t('expirationLabel')}</span>
            <p style={{
              fontWeight: 600, fontSize: '1rem', marginTop: 2,
              color: props.isExpired ? '#991B1B' : '#4A919E',
            }}>{props.expiryDisplay}</p>
          </div>
          <div>
            <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: '#9ca3af', letterSpacing: '0.05em' }}>{t('emailLabel')}</span>
            <p style={{ fontWeight: 600, color: '#212E53', fontSize: '0.9rem', marginTop: 2, wordBreak: 'break-all' }}>{props.analysisEmail || props.contactEmail || '—'}</p>
          </div>
          <div>
            <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: '#9ca3af', letterSpacing: '0.05em' }}>{t('urlLabel')}</span>
            <p style={{ fontWeight: 600, fontSize: '0.9rem', marginTop: 2 }}>
              <a href={props.url.startsWith('http') ? props.url : `https://${props.url}`}
                target="_blank" rel="noopener noreferrer"
                style={{ color: '#4A919E', textDecoration: 'none' }}
              >{props.url}</a>
            </p>
          </div>
        </div>

        {/* Lifecycle status */}
        {props.isExpired && (
          <div style={{
            background: '#FEE2E2', border: '1px solid #FECACA', color: '#991B1B',
            padding: '10px 14px', borderRadius: 8, fontSize: '0.85rem', marginTop: '1rem', textAlign: 'center',
          }}>
            Certification expired. Renew to maintain AI visibility.
          </div>
        )}
        {props.isActive && props.expiresSoon && (
          <div style={{
            background: '#FEF3C7', border: '1px solid #FCD34D', color: '#92400E',
            padding: '10px 14px', borderRadius: 8, fontSize: '0.85rem', marginTop: '1rem', textAlign: 'center',
          }}>
            Pack expires soon. Renew now to maintain your certification.
          </div>
        )}
        {props.isActive && !props.expiresSoon && (
          <div style={{
            background: '#D1FAE5', border: '1px solid #6EE7B7', color: '#065F46',
            padding: '10px 14px', borderRadius: 8, fontSize: '0.85rem', marginTop: '1rem', textAlign: 'center',
          }}>
            ✓ Your pack is active
          </div>
        )}
      </div>

      {/* ─── SCAN HISTORY ─── */}
      {props.history.length > 0 && (
        <div style={{
          background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb',
          padding: '1.5rem 2rem', marginBottom: '1.5rem',
        }}>
          <h3 style={{ color: '#212E53', fontSize: '1.1rem', marginBottom: '1rem' }}>
            📋 {t('historyTitle')}
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {props.history.map((entry, i) => (
              <div key={entry.id || i} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '8px 12px', background: i === 0 ? '#f0fdf4' : '#f9fafb',
                borderRadius: 6, fontSize: '0.85rem',
              }}>
                <span style={{ color: '#374151' }}>
                  {new Date(entry.created_at).toLocaleDateString(undefined, {
                    year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
                  })}
                </span>
                <span style={{
                  fontWeight: 700,
                  color: entry.score >= 70 ? '#4A919E' : entry.score >= 40 ? '#D97706' : '#CE6A6B',
                }}>
                  {entry.score}/100
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ─── OFFERS — always visible for upgrade/renew ─── */}
      <div style={{ marginBottom: '2rem' }}>
        <h3 style={{ color: '#212E53', fontSize: '1.1rem', marginBottom: '1rem', textAlign: 'center' }}>
          💳 {t('offersTitle')}
        </h3>
        <RenewButtons
          email={props.contactEmail}
          url={props.url}
          entityId={props.entityId}
          hasRequiredInfo={props.hasRequiredInfo}
          proUrl={props.proUrl}
          ayaUrl={props.ayaUrl}
          isActive={props.isActive}
          expiresSoon={props.expiresSoon}
          currentPackType={props.currentPackType}
        />
      </div>

      {/* Footer */}
      <div style={{ textAlign: 'center', marginTop: '2rem' }}>
        <p style={{ fontSize: '0.85rem', color: '#9ca3af' }}>
          Questions?{' '}
          <a href="mailto:hello@ai-visionary.xyz" style={{ color: '#4A919E', fontWeight: 600 }}>
            hello@ai-visionary.xyz
          </a>
        </p>
      </div>
    </div>
  );

  return (
    <OtpGate analysisEmail={props.analysisEmail} entityId={props.entityId}>
      {dashboard}
    </OtpGate>
  );
}
