'use client';

import { useState, useCallback, useEffect } from 'react';

// ============================================================
// Admin — LinkedIn Drafts Viewer
// Auth: ADMIN_SECRET (query param or input)
// Source: Postgres VPS table linkedin_posts (only works on VPS)
// ============================================================

interface DraftRow {
  id: string;
  entity_id: string;
  entity_domain: string;
  entity_name: string;
  current_score: number;
  projected_score: number;
  post_text: string;
  post_locale: string;
  status: string;
  linkedin_post_url: string | null;
  error_message: string | null;
  scheduled_at: string;
  published_at: string | null;
  visibility_check: string | null;
}

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-yellow-100 text-yellow-800',
  approved: 'bg-blue-100 text-blue-800',
  published: 'bg-green-100 text-green-800',
  failed: 'bg-red-100 text-red-800',
  skipped: 'bg-gray-100 text-gray-700',
};

export default function LinkedinDraftsPage() {
  const [secret, setSecret] = useState('');
  const [authenticated, setAuthenticated] = useState(false);
  const [drafts, setDrafts] = useState<DraftRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [visibilityResults, setVisibilityResults] = useState<Record<string, { provider: string; visible: boolean; position?: number; cited_companies: string[]; query: string; error?: string }>>({});
  const [visibilityLoading, setVisibilityLoading] = useState<string | null>(null);

  // Try to load secret on mount : (1) URL query (?secret=...), (2) localStorage
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const fromUrl = params.get('secret');
    if (fromUrl) {
      setSecret(fromUrl);
      setAuthenticated(true);
      try { localStorage.setItem('linkedin_admin_secret', fromUrl); } catch {}
      return;
    }
    try {
      const stored = localStorage.getItem('linkedin_admin_secret');
      if (stored) {
        setSecret(stored);
        setAuthenticated(true);
      }
    } catch {}
  }, []);

  const fetchDrafts = useCallback(async () => {
    if (!secret) return;
    setLoading(true);
    setError('');
    try {
      const url = new URL('/api/admin/linkedin-drafts/list', window.location.origin);
      url.searchParams.set('secret', secret);
      url.searchParams.set('limit', '100');
      if (statusFilter) url.searchParams.set('status', statusFilter);

      const res = await fetch(url.toString());
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Erreur de chargement');
        if (res.status === 401) {
          // Secret invalide : le retirer de localStorage et forcer re-login
          try { localStorage.removeItem('linkedin_admin_secret'); } catch {}
          setAuthenticated(false);
        }
        return;
      }
      setDrafts(data.drafts || []);
      setTotal(data.total || 0);
    } catch (e: any) {
      setError(e?.message || 'Erreur reseau');
    } finally {
      setLoading(false);
    }
  }, [secret, statusFilter]);

  useEffect(() => {
    if (authenticated) fetchDrafts();
  }, [authenticated, fetchDrafts]);

  const handleVisibilityCheck = async (id: string, provider: 'gemini' | 'chatgpt') => {
    setVisibilityLoading(`${id}-${provider}`);
    try {
      const url = new URL(`/api/admin/linkedin-drafts/${id}/visibility`, window.location.origin);
      url.searchParams.set('secret', secret);
      url.searchParams.set('provider', provider);
      const res = await fetch(url.toString());
      const data = await res.json();
      setVisibilityResults(prev => ({ ...prev, [`${id}-${provider}`]: data }));
    } catch (e: any) {
      setVisibilityResults(prev => ({ ...prev, [`${id}-${provider}`]: { provider, visible: true, cited_companies: [], query: '', error: e?.message || 'network error' } }));
    } finally {
      setVisibilityLoading(null);
    }
  };

  const handleAction = async (id: string, action: 'approve' | 'unapprove' | 'reject' | 'publish_now') => {
    if (action === 'publish_now' && !confirm('Publier ce post sur LinkedIn maintenant ?')) return;
    setActionLoading(id);
    try {
      const url = new URL(`/api/admin/linkedin-drafts/${id}`, window.location.origin);
      url.searchParams.set('secret', secret);
      const res = await fetch(url.toString(), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'Erreur');
      } else if (action === 'publish_now' && data.success) {
        alert('Publie ! ' + (data.linkedin_post_url || ''));
      }
      await fetchDrafts();
    } finally {
      setActionLoading(null);
    }
  };

  // ── LOGIN SCREEN ──
  if (!authenticated) {
    return (
      <div style={{ maxWidth: 480, margin: '6rem auto', padding: '2rem', background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#212E53', marginBottom: '0.5rem' }}>
          🔐 LinkedIn Drafts — Admin
        </h1>
        <p style={{ color: '#6b7280', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
          Saisir le ADMIN_SECRET pour acceder.
        </p>
        <input
          type="password"
          value={secret}
          onChange={e => setSecret(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && setAuthenticated(true)}
          placeholder="ADMIN_SECRET"
          style={{
            width: '100%', padding: '12px 16px', borderRadius: 8,
            border: '1px solid #e5e7eb', fontSize: '1rem', marginBottom: '0.75rem',
            boxSizing: 'border-box',
          }}
          autoFocus
        />
        <button
          onClick={() => {
            try { localStorage.setItem('linkedin_admin_secret', secret); } catch {}
            setAuthenticated(true);
          }}
          disabled={!secret}
          style={{
            width: '100%', padding: '12px', borderRadius: 8, border: 'none',
            background: '#4A919E', color: '#fff', fontWeight: 700,
            cursor: secret ? 'pointer' : 'not-allowed',
            opacity: secret ? 1 : 0.5,
          }}
        >
          Se connecter
        </button>
      </div>
    );
  }

  // ── DASHBOARD ──
  return (
    <div style={{ maxWidth: 1200, margin: '2rem auto', padding: '0 1rem 4rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '0.75rem' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#212E53' }}>
          📰 LinkedIn Drafts ({total})
        </h1>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #e5e7eb', fontSize: '0.9rem' }}
          >
            <option value="">Tous statuts</option>
            <option value="draft">Drafts</option>
            <option value="approved">Approuves (queue)</option>
            <option value="published">Publies</option>
            <option value="failed">Failed</option>
            <option value="skipped">Rejetes / Skipped</option>
          </select>
          <button
            onClick={fetchDrafts}
            disabled={loading}
            style={{
              padding: '8px 16px', borderRadius: 8, border: '1px solid #e5e7eb',
              background: '#fff', cursor: loading ? 'wait' : 'pointer', fontSize: '0.9rem',
            }}
          >
            {loading ? '...' : '🔄 Refresh'}
          </button>
          <button
            onClick={() => {
              if (!confirm('Se deconnecter ? Le secret sera efface du navigateur.')) return;
              try { localStorage.removeItem('linkedin_admin_secret'); } catch {}
              setSecret('');
              setDrafts([]);
              setTotal(0);
              setVisibilityResults({});
              setAuthenticated(false);
              // Strip ?secret=... de l'URL pour eviter qu'il reste visible
              try { window.history.replaceState({}, '', window.location.pathname); } catch {}
            }}
            title="Efface le secret du navigateur et retourne a l'ecran de login"
            style={{
              padding: '8px 16px', borderRadius: 8, border: '1px solid #FECACA',
              background: '#FEF2F2', color: '#991B1B', cursor: 'pointer', fontSize: '0.9rem', fontWeight: 600,
            }}
          >
            🔒 Deconnexion
          </button>
        </div>
      </div>

      {error && (
        <div style={{ background: '#FEE2E2', border: '1px solid #FECACA', color: '#991B1B', padding: '12px 16px', borderRadius: 8, marginBottom: '1rem' }}>
          {error}
        </div>
      )}

      {drafts.length === 0 && !loading && !error && (
        <div style={{ textAlign: 'center', padding: '3rem', color: '#9ca3af' }}>
          Aucun draft (filtre : {statusFilter || 'tous'}).
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {drafts.map(d => (
          <div key={d.id} style={{
            background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb',
            padding: '1.25rem 1.5rem',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
              <div>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#212E53' }}>
                  {d.entity_name}{' '}
                  <a href={`https://${d.entity_domain}`} target="_blank" rel="noopener noreferrer"
                     style={{ fontSize: '0.85rem', fontWeight: 400, color: '#4A919E', textDecoration: 'none' }}>
                    {d.entity_domain} ↗
                  </a>
                </h3>
                <p style={{ fontSize: '0.78rem', color: '#9ca3af', marginTop: 4 }}>
                  Score : <strong>{d.current_score}/100</strong> → projete <strong>{d.projected_score}/100</strong> · Locale : {d.post_locale.toUpperCase()} · {new Date(d.scheduled_at).toLocaleString('fr-CH')}
                </p>
              </div>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                <span style={{
                  fontSize: '0.75rem', fontWeight: 600, padding: '4px 12px', borderRadius: 9999,
                }} className={STATUS_COLORS[d.status] || 'bg-gray-100 text-gray-700'}>
                  {d.status}
                </span>
                {d.visibility_check === 'passed' && (
                  <span title="Verifie via Gemini : entite NON citee par les LLM, publication recommandee" style={{
                    fontSize: '0.7rem', fontWeight: 600, padding: '4px 10px', borderRadius: 9999,
                    background: '#D1FAE5', color: '#065F46', border: '1px solid #6EE7B7',
                  }}>
                    ✓ testé
                  </span>
                )}
                {d.visibility_check === 'skipped_visible' && (
                  <span title="Cite par Gemini — pas pour publication" style={{
                    fontSize: '0.7rem', fontWeight: 600, padding: '4px 10px', borderRadius: 9999,
                    background: '#FEE2E2', color: '#991B1B', border: '1px solid #FECACA',
                  }}>
                    déjà cité
                  </span>
                )}
              </div>
            </div>

            <pre style={{
              background: '#f9fafb', padding: '12px 16px', borderRadius: 8,
              fontSize: '0.85rem', whiteSpace: 'pre-wrap', wordBreak: 'break-word',
              lineHeight: 1.5, color: '#374151', marginBottom: '0.75rem',
              fontFamily: 'inherit',
            }}>
              {d.post_text}
            </pre>

            {d.error_message && (d.status === 'failed' || d.status === 'skipped') && (
              <div style={{ background: '#FEE2E2', color: '#991B1B', padding: '8px 12px', borderRadius: 6, fontSize: '0.8rem', marginBottom: '0.75rem' }}>
                ❌ {d.error_message}
              </div>
            )}

            {d.linkedin_post_url && (
              <a href={d.linkedin_post_url} target="_blank" rel="noopener noreferrer" style={{ fontSize: '0.85rem', color: '#4A919E', display: 'block', marginBottom: '0.75rem' }}>
                ↗ Voir sur LinkedIn
              </a>
            )}

            {(d.status === 'draft' || d.status === 'approved') && (
              <>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  {d.status === 'draft' && (
                    <button
                      onClick={() => handleAction(d.id, 'approve')}
                      disabled={actionLoading === d.id}
                      title="Ajouter ce post a la queue de publication automatique (cron 3x/jour)"
                      style={{
                        padding: '6px 14px', borderRadius: 6, border: 'none',
                        background: '#1E40AF', color: '#fff', fontWeight: 700, fontSize: '0.85rem',
                        cursor: actionLoading === d.id ? 'wait' : 'pointer',
                      }}
                    >
                      {actionLoading === d.id ? '...' : '✓ Approuver (auto)'}
                    </button>
                  )}
                  {d.status === 'approved' && (
                    <button
                      onClick={() => handleAction(d.id, 'unapprove')}
                      disabled={actionLoading === d.id}
                      style={{
                        padding: '6px 14px', borderRadius: 6, border: '1px solid #1E40AF',
                        background: '#fff', color: '#1E40AF', fontWeight: 600, fontSize: '0.85rem',
                        cursor: actionLoading === d.id ? 'wait' : 'pointer',
                      }}
                    >
                      ↺ Retirer de la queue
                    </button>
                  )}
                  <button
                    onClick={() => handleAction(d.id, 'publish_now')}
                    disabled={actionLoading === d.id}
                    title="Publier immediatement (sans attendre le cron)"
                    style={{
                      padding: '6px 14px', borderRadius: 6, border: 'none',
                      background: '#4A919E', color: '#fff', fontWeight: 600, fontSize: '0.85rem',
                      cursor: actionLoading === d.id ? 'wait' : 'pointer',
                    }}
                  >
                    {actionLoading === d.id ? '...' : '🚀 Publier maintenant'}
                  </button>
                  <button
                    onClick={() => handleAction(d.id, 'reject')}
                    disabled={actionLoading === d.id}
                    style={{
                      padding: '6px 14px', borderRadius: 6, border: '1px solid #e5e7eb',
                      background: '#fff', color: '#991B1B', fontWeight: 600, fontSize: '0.85rem',
                      cursor: actionLoading === d.id ? 'wait' : 'pointer',
                    }}
                  >
                    ✗ Rejeter
                  </button>
                  <button
                    onClick={() => handleVisibilityCheck(d.id, 'gemini')}
                    disabled={visibilityLoading === `${d.id}-gemini`}
                    style={{
                      padding: '6px 14px', borderRadius: 6, border: '1px solid #e5e7eb',
                      background: '#EEF2FF', color: '#3730A3', fontWeight: 600, fontSize: '0.85rem',
                      cursor: visibilityLoading === `${d.id}-gemini` ? 'wait' : 'pointer',
                    }}
                  >
                    {visibilityLoading === `${d.id}-gemini` ? '...' : '🔬 Tester Gemini'}
                  </button>
                  <button
                    onClick={() => handleVisibilityCheck(d.id, 'chatgpt')}
                    disabled={visibilityLoading === `${d.id}-chatgpt`}
                    style={{
                      padding: '6px 14px', borderRadius: 6, border: '1px solid #e5e7eb',
                      background: '#F0FDF4', color: '#166534', fontWeight: 600, fontSize: '0.85rem',
                      cursor: visibilityLoading === `${d.id}-chatgpt` ? 'wait' : 'pointer',
                    }}
                  >
                    {visibilityLoading === `${d.id}-chatgpt` ? '...' : '🔬 Tester ChatGPT'}
                  </button>
                </div>
                {(['gemini', 'chatgpt'] as const).map(prov => {
                  const r = visibilityResults[`${d.id}-${prov}`];
                  if (!r) return null;
                  const bg = r.error ? '#FEF3C7' : (r.visible ? '#FEE2E2' : '#D1FAE5');
                  const color = r.error ? '#92400E' : (r.visible ? '#991B1B' : '#065F46');
                  return (
                    <div key={prov} style={{ background: bg, color, padding: '8px 12px', borderRadius: 6, fontSize: '0.78rem', marginTop: 8, lineHeight: 1.5 }}>
                      <strong>{prov === 'gemini' ? 'Gemini' : 'ChatGPT'}</strong> · query: « {r.query} »<br />
                      {r.error
                        ? `⚠️ ${r.error}`
                        : r.visible
                          ? `❌ Cité en position ${r.position} dans : ${r.cited_companies.join(', ')}`
                          : `✓ NON cité. Top 5 : ${r.cited_companies.join(', ')}`}
                    </div>
                  );
                })}
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
