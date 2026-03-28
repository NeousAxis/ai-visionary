'use client';

import { useState, useCallback } from 'react';
import type { BlockDefinition, FieldDefinition } from '@/lib/update-form-config';

interface UpdateFormProps {
  entityId: string;
  entityName: string;
  packType: string | null;
  entityEmail: string;
  entityWebsite: string;
  ownerEmailMasked?: string;
  currentScore: number | null;
  initialValues: Record<string, Record<string, any>>;
  blockDefinitions: BlockDefinition[];
  updateToken: string;
  adminAccount?: { nom: string; prenom: string; email_pro: string };
}

interface SubmitResult {
  newScore: number;
  oldScore: number;
  entityId: string;
  filesEmailSent?: boolean;
}

export default function UpdateFormClient({
  entityId,
  entityName,
  packType,
  entityEmail,
  entityWebsite,
  ownerEmailMasked,
  currentScore,
  initialValues,
  blockDefinitions,
  updateToken,
  adminAccount,
}: UpdateFormProps) {
  const [activeTab, setActiveTab] = useState(0);
  const [formData, setFormData] = useState<Record<string, Record<string, any>>>(initialValues);
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [result, setResult] = useState<SubmitResult | null>(null);
  const [regenerating, setRegenerating] = useState(false);
  const [regenSuccess, setRegenSuccess] = useState(false);
  const [regenError, setRegenError] = useState('');
  // Track which url_locked fields are unlocked for editing
  const [unlockedUrls, setUnlockedUrls] = useState<Set<string>>(new Set());
  // Track which fields the user has actually modified (dirty tracking)
  const [dirtyFields, setDirtyFields] = useState<Set<string>>(new Set());
  // Track fields marked as "Non applicable" by the user
  const [naFields, setNaFields] = useState<Set<string>>(new Set());

  // ---- helpers ----

  const getBlockValue = useCallback(
    (blockKey: string, fieldName: string) => formData[blockKey]?.[fieldName] ?? '',
    [formData],
  );

  const setBlockValue = useCallback(
    (blockKey: string, fieldName: string, value: unknown) => {
      setDirtyFields(prev => new Set(prev).add(`${blockKey}.${fieldName}`));
      setFormData(prev => ({
        ...prev,
        [blockKey]: { ...prev[blockKey], [fieldName]: value },
      }));
    },
    [],
  );

  /** Count how many fields in a block have a non-empty value */
  const filledCount = (block: BlockDefinition): number => {
    const vals = formData[block.key] || {};
    return block.fields.filter(f => {
      const v = vals[f.name];
      if (v === undefined || v === null) return false;
      // Bug 8 fix: for boolean fields, false IS a valid filled value
      if (f.type === 'boolean') return typeof v === 'boolean';
      if (v === '' || v === false) return false;
      if (Array.isArray(v) && v.length === 0) return false;
      return true;
    }).length;
  };

  /** Handle ASR file regeneration (Bug 1 fix: proper POST instead of GET redirect) */
  const handleRegenerate = async () => {
    setRegenerating(true);
    setRegenError('');
    try {
      const res = await fetch('/api/regenerate-files', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entityId, token: updateToken }),
      });
      const data = await res.json();
      if (data.success) {
        setRegenSuccess(true);
      } else {
        setRegenError(data.error || 'Erreur lors de la regeneration');
      }
    } catch {
      setRegenError('Erreur reseau');
    } finally {
      setRegenerating(false);
    }
  };

  // ---- submit ----

  const handleSubmit = async () => {
    setStatus('loading');
    setErrorMessage('');

    // Build payload: ONLY include fields whose VALUE actually changed
    // Compare current value with initial value to detect real changes
    const blocks: Record<string, Record<string, unknown>> = {};
    for (const block of blockDefinitions) {
      const vals = formData[block.key] || {};
      const initVals = initialValues[block.key] || {};
      const cleaned: Record<string, unknown> = {};
      let hasChanges = false;
      for (const field of block.fields) {
        if (field.type === 'readonly') continue;

        // Fields marked "Non applicable" → send __NA__ marker to server.
        // The scoring engine will exclude this field from the denominator (neutral, not a penalty).
        const naKey = `${block.key}.${field.name}`;
        if (naFields.has(naKey)) {
          hasChanges = true;
          cleaned[field.name] = '__NA__';
          continue;
        }

        let v = vals[field.name];
        const initV = initVals[field.name];

        // Normalize array values for comparison
        if (field.type === 'array' && typeof v === 'string') {
          v = v.split('\n').map((s: string) => s.trim()).filter(Boolean);
        }
        let initNorm = initV;
        if (field.type === 'array' && typeof initV === 'string') {
          initNorm = initV.split('\n').map((s: string) => s.trim()).filter(Boolean);
        }

        // Compare: skip if value hasn't actually changed
        const vStr = JSON.stringify(v ?? '');
        const iStr = JSON.stringify(initNorm ?? '');
        if (vStr === iStr) continue;

        cleaned[field.name] = v;
        hasChanges = true;
      }
      if (hasChanges) {
        blocks[block.key] = cleaned;
      }
    }

    try {
      const res = await fetch('/api/update-entity', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entityId, blocks, token: updateToken }),
      });

      const data = await res.json().catch(() => ({ error: 'Erreur inconnue' }));

      if (!res.ok) {
        throw new Error(data.error || `Erreur ${res.status}`);
      }

      setResult({
        newScore: data.newScore ?? data.score ?? 0,
        oldScore: currentScore ?? 0,
        entityId,
        filesEmailSent: data.filesEmailSent ?? false,
      });
      setStatus('success');
    } catch (err: unknown) {
      setStatus('error');
      setErrorMessage(err instanceof Error ? err.message : 'Une erreur est survenue.');
    }
  };

  // ---- success panel ----

  if (status === 'success' && result) {
    const delta = result.newScore - result.oldScore;
    const deltaColor = delta > 0 ? '#16a34a' : delta < 0 ? '#CE6A6B' : '#4A919E';
    const isPro = packType === 'pro' || packType === 'PRO';

    return (
      <div style={{
        background: '#fff',
        borderRadius: '12px',
        border: '1px solid #e5e7eb',
        padding: '3rem 2rem',
        textAlign: 'center',
        maxWidth: '600px',
        margin: '0 auto',
      }}>
        <div style={{ fontSize: '3.5rem', marginBottom: '0.5rem' }}>&#10003;</div>
        <h2 style={{ color: '#212E53', fontSize: '1.5rem', marginBottom: '0.75rem' }}>
          Donnees mises a jour !
        </h2>

        {/* Score comparison */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '1rem',
          margin: '1.5rem 0',
          flexWrap: 'wrap',
        }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '0.75rem', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Ancien score</div>
            <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#9ca3af' }}>{result.oldScore}/100</div>
          </div>
          <div style={{ fontSize: '1.5rem', color: deltaColor }}>&#8594;</div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '0.75rem', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Nouveau score</div>
            <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#4A919E' }}>{result.newScore}/100</div>
          </div>
          {delta !== 0 && (
            <div style={{
              background: delta > 0 ? '#dcfce7' : '#fee2e2',
              color: deltaColor,
              padding: '4px 12px',
              borderRadius: '999px',
              fontWeight: 'bold',
              fontSize: '0.9rem',
            }}>
              {delta > 0 ? '+' : ''}{delta}
            </div>
          )}
        </div>

        <p style={{ color: '#6b7280', fontSize: '0.95rem', marginBottom: result.filesEmailSent ? '0.75rem' : '1.5rem' }}>
          Votre certificat AYA et vos donnees dans le registre ont ete mis a jour.
        </p>

        {result.filesEmailSent && (
          <div style={{
            background: '#f0fdf4',
            border: '1px solid #86efac',
            borderRadius: '8px',
            padding: '12px 16px',
            marginBottom: '1.5rem',
            fontSize: '0.9rem',
            color: '#166534',
          }}>
            &#128386; {isPro
              ? 'Vos nouveaux fichiers ASR ont ete regeneres et envoyes par email.'
              : 'Un email de confirmation a ete envoye a votre adresse.'}
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', alignItems: 'center' }}>
          <a
            href={`/aya/e/${entityId}`}
            style={{
              display: 'inline-block',
              background: '#4A919E',
              color: 'white',
              padding: '12px 28px',
              borderRadius: '8px',
              textDecoration: 'none',
              fontWeight: 'bold',
              fontSize: '0.95rem',
            }}
          >
            Voir mon certificat AYA
          </a>

          {isPro && !regenSuccess && (
            <button
              onClick={handleRegenerate}
              disabled={regenerating}
              style={{
                background: regenerating ? '#9ca3af' : '#212E53',
                color: 'white',
                padding: '12px 28px',
                borderRadius: '8px',
                border: 'none',
                fontWeight: 'bold',
                fontSize: '0.95rem',
                cursor: regenerating ? 'wait' : 'pointer',
              }}
            >
              {regenerating ? 'Regeneration en cours...' : 'Regenerer mes fichiers ASR'}
            </button>
          )}
          {regenSuccess && (
            <p style={{ color: '#16a34a', fontSize: '0.9rem', fontWeight: '600' }}>
              Fichiers regeneres et envoyes par email !
            </p>
          )}
          {regenError && (
            <p style={{ color: '#991b1b', fontSize: '0.9rem' }}>
              {regenError}
            </p>
          )}
        </div>
      </div>
    );
  }

  // ---- styles ----

  const tabBarStyle: React.CSSProperties = {
    display: 'flex',
    overflowX: 'auto',
    gap: '4px',
    borderBottom: '2px solid #e5e7eb',
    marginBottom: '1.5rem',
    paddingBottom: '0',
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '10px 14px',
    borderRadius: '8px',
    border: '1px solid #e5e7eb',
    fontSize: '0.95rem',
    color: '#212E53',
    background: '#fff',
    outline: 'none',
    boxSizing: 'border-box' as const,
  };

  const labelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: '0.85rem',
    fontWeight: '600',
    color: '#6b7280',
    marginBottom: '6px',
  };

  const hintStyle: React.CSSProperties = {
    fontSize: '0.75rem',
    color: '#9ca3af',
    marginTop: '4px',
    fontStyle: 'italic',
  };

  const fieldWrapStyle: React.CSSProperties = {
    marginBottom: '1.25rem',
  };

  // ---- render ----

  const currentBlock = blockDefinitions[activeTab];

  return (
    <div style={{
      background: '#fff',
      borderRadius: '12px',
      border: '1px solid #e5e7eb',
    }}>
      {/* Header */}
      <div style={{
        background: '#212E53',
        color: 'white',
        padding: '1.25rem 1.5rem',
      }}>
        <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: '600' }}>
          Mise a jour — {entityName}
        </h3>
        <p style={{ margin: '0.25rem 0 0', fontSize: '0.8rem', opacity: 0.7 }}>
          {entityEmail} {currentScore !== null && `| Score actuel : ${currentScore}/100`}
        </p>
      </div>

      {/* Tab bar */}
      <div style={tabBarStyle}>
        {blockDefinitions.map((block, i) => {
          const isActive = i === activeTab;
          const filled = filledCount(block);
          const total = block.fields.length;

          return (
            <button
              key={block.key}
              onClick={() => setActiveTab(i)}
              style={{
                flex: '0 0 auto',
                padding: '10px 14px',
                background: 'transparent',
                border: 'none',
                borderBottom: isActive ? '3px solid #4A919E' : '3px solid transparent',
                color: isActive ? '#4A919E' : '#6b7280',
                fontWeight: isActive ? '700' : '500',
                fontSize: '0.8rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                whiteSpace: 'nowrap',
                transition: 'all 0.15s',
              }}
            >
              <span>{block.icon}</span>
              <span>{block.title}</span>
              <span style={{
                background: filled === total ? '#dcfce7' : '#f3f4f6',
                color: filled === total ? '#16a34a' : '#6b7280',
                fontSize: '0.65rem',
                fontWeight: '700',
                padding: '2px 6px',
                borderRadius: '999px',
              }}>
                {filled}/{total}
              </span>
            </button>
          );
        })}
      </div>

      {/* Block content */}
      <div style={{ padding: '1.5rem' }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '1.25rem',
          paddingBottom: '0.75rem',
          borderBottom: '1px solid #f3f4f6',
        }}>
          <div>
            <h4 style={{ margin: 0, color: '#212E53', fontSize: '1rem' }}>
              {currentBlock.icon} {currentBlock.title}
            </h4>
            <span style={{ fontSize: '0.75rem', color: '#9ca3af' }}>
              Poids dans le score : {currentBlock.weight}/100
            </span>
          </div>
        </div>

        {currentBlock.fields.map(field => {
          const blockKey = currentBlock.key;
          const value = getBlockValue(blockKey, field.name);

          // -- readonly --
          if (field.type === 'readonly') {
            return (
              <div key={field.name} style={fieldWrapStyle}>
                <label style={labelStyle}>{field.label}</label>
                <div style={{
                  ...inputStyle,
                  background: '#f9fafb',
                  color: '#9ca3af',
                  cursor: 'not-allowed',
                }}>
                  {value ? 'Oui (detecte)' : 'Non detecte'}
                </div>
                {field.hint && <p style={hintStyle}>{field.hint}</p>}
              </div>
            );
          }

          // -- url_locked (grayed out by default, toggle to edit) --
          if (field.type === 'url_locked') {
            const urlKey = `${blockKey}.${field.name}`;
            const isUnlocked = unlockedUrls.has(urlKey);
            return (
              <div key={field.name} style={fieldWrapStyle}>
                <label style={labelStyle}>{field.label}</label>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <input
                    type="url"
                    value={value || ''}
                    onChange={e => setBlockValue(blockKey, field.name, e.target.value)}
                    disabled={!isUnlocked}
                    style={{
                      ...inputStyle,
                      flex: 1,
                      background: isUnlocked ? '#fff' : '#f3f4f6',
                      color: isUnlocked ? '#212E53' : '#9ca3af',
                      cursor: isUnlocked ? 'text' : 'not-allowed',
                    }}
                    placeholder={field.placeholder}
                  />
                  <button
                    type="button"
                    title={isUnlocked ? 'Verrouiller' : 'Modifier le lien'}
                    onClick={() => {
                      setUnlockedUrls(prev => {
                        const next = new Set(prev);
                        if (next.has(urlKey)) next.delete(urlKey);
                        else next.add(urlKey);
                        return next;
                      });
                    }}
                    style={{
                      width: '36px',
                      height: '36px',
                      borderRadius: '8px',
                      border: '1px solid #e5e7eb',
                      background: isUnlocked ? '#4A919E' : '#fff',
                      color: isUnlocked ? '#fff' : '#6b7280',
                      cursor: 'pointer',
                      fontSize: '1rem',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    {isUnlocked ? '🔓' : '✏️'}
                  </button>
                </div>
                {field.hint && <p style={hintStyle}>{field.hint}</p>}
              </div>
            );
          }

          // -- boolean --
          if (field.type === 'boolean') {
            return (
              <div key={field.name} style={{ ...fieldWrapStyle, display: 'flex', alignItems: 'center', gap: '12px' }}>
                <button
                  type="button"
                  onClick={() => setBlockValue(blockKey, field.name, !value)}
                  style={{
                    width: '44px',
                    height: '24px',
                    borderRadius: '12px',
                    border: 'none',
                    background: value ? '#4A919E' : '#d1d5db',
                    cursor: 'pointer',
                    position: 'relative',
                    transition: 'background 0.2s',
                    flexShrink: 0,
                  }}
                >
                  <div style={{
                    width: '18px',
                    height: '18px',
                    borderRadius: '50%',
                    background: '#fff',
                    position: 'absolute',
                    top: '3px',
                    left: value ? '23px' : '3px',
                    transition: 'left 0.2s',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                  }} />
                </button>
                <div>
                  <span style={{ fontSize: '0.9rem', color: '#212E53', fontWeight: '500' }}>{field.label}</span>
                  {field.hint && <p style={{ ...hintStyle, marginTop: '2px' }}>{field.hint}</p>}
                </div>
              </div>
            );
          }

          // -- select (sector or country) --
          if (field.type === 'select') {
            const options = field.options ?? [];

            return (
              <div key={field.name} style={fieldWrapStyle}>
                <label style={labelStyle}>{field.label}</label>
                <select
                  value={value || ''}
                  onChange={e => setBlockValue(blockKey, field.name, e.target.value)}
                  style={inputStyle}
                >
                  <option value="">-- Selectionner --</option>
                  {options.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
                {field.hint && <p style={hintStyle}>{field.hint}</p>}
              </div>
            );
          }

          // -- date --
          if (field.type === 'date') {
            return (
              <div key={field.name} style={fieldWrapStyle}>
                <label style={labelStyle}>{field.label}</label>
                <input
                  type="date"
                  value={value || ''}
                  onChange={e => setBlockValue(blockKey, field.name, e.target.value)}
                  style={inputStyle}
                />
                {field.hint && <p style={hintStyle}>{field.hint}</p>}
              </div>
            );
          }

          // -- array (textarea, one item per line) --
          if (field.type === 'array') {
            const naKey = `${blockKey}.${field.name}`;
            const isNA = naFields.has(naKey);
            const textValue = isNA ? '' : (Array.isArray(value) ? value.join('\n') : (value || ''));
            return (
              <div key={field.name} style={fieldWrapStyle}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <label style={{ ...labelStyle, marginBottom: 0 }}>{field.label}</label>
                  <button
                    type="button"
                    onClick={() => {
                      setNaFields(prev => {
                        const next = new Set(prev);
                        if (next.has(naKey)) {
                          next.delete(naKey);
                        } else {
                          next.add(naKey);
                          // Clear the field value when marking N/A
                          setBlockValue(blockKey, field.name, []);
                        }
                        return next;
                      });
                    }}
                    style={{
                      fontSize: '0.7rem',
                      fontWeight: '600',
                      padding: '2px 8px',
                      borderRadius: '4px',
                      border: isNA ? '1px solid #4A919E' : '1px solid #d1d5db',
                      background: isNA ? '#E0F2F1' : '#fff',
                      color: isNA ? '#4A919E' : '#9ca3af',
                      cursor: 'pointer',
                    }}
                  >
                    {isNA ? '✓ Non applicable' : 'Non applicable'}
                  </button>
                </div>
                {isNA ? (
                  <div style={{
                    ...inputStyle,
                    background: '#f9fafb',
                    color: '#9ca3af',
                    fontStyle: 'italic',
                    padding: '12px 14px',
                  }}>
                    Ce champ ne s'applique pas a votre activite.
                  </div>
                ) : (
                  <textarea
                    value={textValue}
                    onChange={e => setBlockValue(blockKey, field.name, e.target.value)}
                    rows={4}
                    style={{ ...inputStyle, resize: 'vertical' }}
                    placeholder={field.placeholder || 'Un element par ligne'}
                  />
                )}
                {!isNA && field.hint && <p style={hintStyle}>{field.hint}</p>}
              </div>
            );
          }

          // -- textarea --
          if (field.type === 'textarea') {
            const naKey = `${blockKey}.${field.name}`;
            const isNA = naFields.has(naKey);
            return (
              <div key={field.name} style={fieldWrapStyle}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <label style={{ ...labelStyle, marginBottom: 0 }}>{field.label}</label>
                  <button
                    type="button"
                    onClick={() => {
                      setNaFields(prev => {
                        const next = new Set(prev);
                        if (next.has(naKey)) next.delete(naKey);
                        else { next.add(naKey); setBlockValue(blockKey, field.name, ''); }
                        return next;
                      });
                    }}
                    style={{
                      fontSize: '0.7rem', fontWeight: '600', padding: '2px 8px', borderRadius: '4px',
                      border: isNA ? '1px solid #4A919E' : '1px solid #d1d5db',
                      background: isNA ? '#E0F2F1' : '#fff',
                      color: isNA ? '#4A919E' : '#9ca3af', cursor: 'pointer',
                    }}
                  >
                    {isNA ? '✓ Non applicable' : 'Non applicable'}
                  </button>
                </div>
                {isNA ? (
                  <div style={{ ...inputStyle, background: '#f9fafb', color: '#9ca3af', fontStyle: 'italic' }}>
                    Ce champ ne s'applique pas a votre activite.
                  </div>
                ) : (
                  <textarea
                    value={value || ''}
                    onChange={e => setBlockValue(blockKey, field.name, e.target.value)}
                    rows={3}
                    style={{ ...inputStyle, resize: 'vertical' }}
                    placeholder={field.placeholder}
                  />
                )}
                {!isNA && field.hint && <p style={hintStyle}>{field.hint}</p>}
              </div>
            );
          }

          // -- text (default) --
          return (
            <div key={field.name} style={fieldWrapStyle}>
              <label style={labelStyle}>{field.label}</label>
              <input
                type="text"
                value={value || ''}
                onChange={e => setBlockValue(blockKey, field.name, e.target.value)}
                style={inputStyle}
                placeholder={field.placeholder}
                required={field.required}
              />
              {field.hint && <p style={hintStyle}>{field.hint}</p>}
            </div>
          );
        })}
      </div>

      {/* Footer: nav + submit */}
      <div style={{
        padding: '1rem 1.5rem',
        borderTop: '1px solid #e5e7eb',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '0.75rem',
      }}>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            type="button"
            disabled={activeTab === 0}
            onClick={() => setActiveTab(i => i - 1)}
            style={{
              padding: '8px 18px',
              borderRadius: '8px',
              border: '1px solid #e5e7eb',
              background: activeTab === 0 ? '#f9fafb' : '#fff',
              color: activeTab === 0 ? '#d1d5db' : '#212E53',
              cursor: activeTab === 0 ? 'not-allowed' : 'pointer',
              fontWeight: '500',
              fontSize: '0.85rem',
            }}
          >
            Precedent
          </button>
          {activeTab < blockDefinitions.length - 1 ? (
            <button
              type="button"
              onClick={() => setActiveTab(i => i + 1)}
              style={{
                padding: '8px 18px',
                borderRadius: '8px',
                border: '1px solid #4A919E',
                background: '#4A919E',
                color: '#fff',
                cursor: 'pointer',
                fontWeight: '500',
                fontSize: '0.85rem',
              }}
            >
              Suivant
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={status === 'loading'}
              style={{
                padding: '8px 24px',
                borderRadius: '8px',
                border: 'none',
                background: status === 'loading' ? '#9ca3af' : '#212E53',
                color: '#fff',
                cursor: status === 'loading' ? 'wait' : 'pointer',
                fontWeight: '700',
                fontSize: '0.9rem',
              }}
            >
              {status === 'loading' ? 'Enregistrement...' : 'Enregistrer les modifications'}
            </button>
          )}
        </div>

        <span style={{ fontSize: '0.75rem', color: '#9ca3af' }}>
          Bloc {activeTab + 1} / {blockDefinitions.length}
        </span>
      </div>

      {/* Error banner */}
      {status === 'error' && (
        <div style={{
          background: '#FEE2E2',
          border: '1px solid #FECACA',
          color: '#991B1B',
          padding: '10px 14px',
          margin: '0 1.5rem 1rem',
          borderRadius: '8px',
          fontSize: '0.9rem',
        }}>
          {errorMessage}
        </div>
      )}

      {/* Admin account section */}
      <AdminAccountSection
        entityId={entityId}
        entityWebsite={entityWebsite}
        initialAdmin={adminAccount || { nom: '', prenom: '', email_pro: '' }}
        updateToken={updateToken}
      />

      {/* Delegation section */}
      <DelegateAccess
        entityId={entityId}
        ownerEmailMasked={ownerEmailMasked || ''}
        updateToken={updateToken}
      />
    </div>
  );
}

/* --- Admin Account Section --- */
function AdminAccountSection({ entityId, entityWebsite, initialAdmin, updateToken }: {
  entityId: string;
  entityWebsite: string;
  initialAdmin: { nom: string; prenom: string; email_pro: string };
  updateToken: string;
}) {
  const [admin, setAdmin] = useState(initialAdmin);
  const [adminStatus, setAdminStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [adminError, setAdminError] = useState('');

  // Extract domain from entity website
  let entityDomain = '';
  try {
    const url = new URL(entityWebsite.startsWith('http') ? entityWebsite : `https://${entityWebsite}`);
    entityDomain = url.hostname.replace(/^www\./, '').toLowerCase();
  } catch { /* ignore */ }

  const validateEmailDomain = (email: string): boolean => {
    if (!email.trim()) return true; // empty is OK (not required yet)
    const domain = email.trim().toLowerCase().split('@')[1] || '';
    return domain === entityDomain;
  };

  const handleSaveAdmin = async () => {
    setAdminError('');

    if (admin.email_pro.trim() && !validateEmailDomain(admin.email_pro)) {
      setAdminError(`L'email professionnel doit appartenir au domaine ${entityDomain}`);
      return;
    }

    setAdminStatus('loading');
    try {
      const res = await fetch('/api/update-entity', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entityId,
          blocks: {},
          adminAccount: {
            admin_nom: admin.nom.trim(),
            admin_prenom: admin.prenom.trim(),
            admin_email_pro: admin.email_pro.trim().toLowerCase(),
          },
          token: updateToken,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erreur');
      setAdminStatus('success');
      setTimeout(() => setAdminStatus('idle'), 3000);
    } catch (err: unknown) {
      setAdminError(err instanceof Error ? err.message : 'Erreur');
      setAdminStatus('error');
    }
  };

  const emailValid = !admin.email_pro.trim() || validateEmailDomain(admin.email_pro);

  return (
    <div style={{ padding: '1.25rem 1.5rem', borderTop: '1px solid #e5e7eb' }}>
      <h4 style={{ margin: '0 0 1rem', fontSize: '0.95rem', color: '#212E53', fontWeight: '600' }}>
        👤 Administrateur du compte
      </h4>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
        <div>
          <label style={{ fontSize: '0.8rem', color: '#6b7280', display: 'block', marginBottom: '4px' }}>Nom</label>
          <input
            type="text"
            value={admin.nom}
            onChange={e => setAdmin({ ...admin, nom: e.target.value })}
            placeholder="Nom"
            style={{
              width: '100%', padding: '8px 12px', borderRadius: '6px',
              border: '1px solid #d1d5db', fontSize: '0.85rem', boxSizing: 'border-box',
            }}
          />
        </div>
        <div>
          <label style={{ fontSize: '0.8rem', color: '#6b7280', display: 'block', marginBottom: '4px' }}>Prenom</label>
          <input
            type="text"
            value={admin.prenom}
            onChange={e => setAdmin({ ...admin, prenom: e.target.value })}
            placeholder="Prenom"
            style={{
              width: '100%', padding: '8px 12px', borderRadius: '6px',
              border: '1px solid #d1d5db', fontSize: '0.85rem', boxSizing: 'border-box',
            }}
          />
        </div>
      </div>

      <div style={{ marginTop: '0.75rem' }}>
        <label style={{ fontSize: '0.8rem', color: '#6b7280', display: 'block', marginBottom: '4px' }}>
          Email professionnel <span style={{ color: '#9ca3af' }}>(@{entityDomain})</span>
        </label>
        <input
          type="email"
          value={admin.email_pro}
          onChange={e => setAdmin({ ...admin, email_pro: e.target.value })}
          placeholder={`votre-email@${entityDomain}`}
          style={{
            width: '100%', padding: '8px 12px', borderRadius: '6px',
            border: `1px solid ${emailValid ? '#d1d5db' : '#ef4444'}`, fontSize: '0.85rem',
            boxSizing: 'border-box',
          }}
        />
        {!emailValid && (
          <p style={{ color: '#ef4444', fontSize: '0.75rem', margin: '4px 0 0' }}>
            L&apos;email doit appartenir au domaine {entityDomain}
          </p>
        )}
      </div>

      <div style={{ marginTop: '1rem', display: 'flex', alignItems: 'center', gap: '12px' }}>
        <button
          onClick={handleSaveAdmin}
          disabled={adminStatus === 'loading' || !emailValid}
          style={{
            padding: '8px 20px', borderRadius: '6px', border: 'none',
            background: adminStatus === 'loading' ? '#9ca3af' : '#4A919E',
            color: '#fff', fontWeight: '600', fontSize: '0.85rem',
            cursor: adminStatus === 'loading' || !emailValid ? 'not-allowed' : 'pointer',
          }}
        >
          {adminStatus === 'loading' ? 'Enregistrement...' : 'Enregistrer'}
        </button>
        {adminStatus === 'success' && (
          <span style={{ color: '#16a34a', fontSize: '0.8rem' }}>✅ Enregistre</span>
        )}
      </div>

      {adminError && (
        <p style={{ color: '#991B1B', fontSize: '0.8rem', marginTop: '0.5rem' }}>{adminError}</p>
      )}
    </div>
  );
}

/* --- Delegate Access Section --- */
function DelegateAccess({ entityId, ownerEmailMasked, updateToken }: {
  entityId: string;
  ownerEmailMasked: string;
  updateToken: string;
}) {
  const [open, setOpen] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [delegateStatus, setDelegateStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [delegateError, setDelegateError] = useState('');

  const handleDelegate = async () => {
    if (!newEmail.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail.trim())) {
      setDelegateError('Format email invalide.');
      return;
    }

    if (!confirm(`Transferer l'acces de gestion a ${newEmail.trim()} ?\n\nL'ancien proprietaire ne pourra plus se connecter.`)) {
      return;
    }

    setDelegateStatus('loading');
    setDelegateError('');

    try {
      const res = await fetch('/api/update-owner-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entityId, newOwnerEmail: newEmail.trim(), token: updateToken }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erreur');
      setDelegateStatus('success');
    } catch (err: unknown) {
      setDelegateError(err instanceof Error ? err.message : 'Erreur');
      setDelegateStatus('error');
    }
  };

  return (
    <div style={{ padding: '1rem 1.5rem', borderTop: '1px solid #e5e7eb' }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          background: 'none', border: 'none', color: '#6b7280', fontSize: '0.8rem',
          cursor: 'pointer', textDecoration: 'underline', padding: 0,
        }}
      >
        {open ? 'Masquer' : 'Transferer l\'acces a un autre email'}
      </button>

      {open && (
        <div style={{ marginTop: '0.75rem' }}>
          {delegateStatus === 'success' ? (
            <div style={{ background: '#dcfce7', padding: '10px 14px', borderRadius: '8px', color: '#166534', fontSize: '0.85rem' }}>
              Acces transfere avec succes. Le nouveau proprietaire pourra se connecter avec son email.
            </div>
          ) : (
            <>
              <p style={{ fontSize: '0.8rem', color: '#6b7280', margin: '0 0 0.5rem' }}>
                Proprietaire actuel : <strong>{ownerEmailMasked}</strong>
              </p>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  type="email"
                  value={newEmail}
                  onChange={e => setNewEmail(e.target.value)}
                  placeholder="nouvel-email@exemple.com"
                  style={{
                    flex: 1, padding: '8px 12px', borderRadius: '6px',
                    border: '1px solid #d1d5db', fontSize: '0.85rem',
                  }}
                />
                <button
                  onClick={handleDelegate}
                  disabled={delegateStatus === 'loading'}
                  style={{
                    padding: '8px 16px', borderRadius: '6px', border: 'none',
                    background: delegateStatus === 'loading' ? '#9ca3af' : '#CE6A6B',
                    color: '#fff', fontWeight: '600', fontSize: '0.85rem',
                    cursor: delegateStatus === 'loading' ? 'wait' : 'pointer',
                  }}
                >
                  {delegateStatus === 'loading' ? '...' : 'Transferer'}
                </button>
              </div>
              {delegateError && (
                <p style={{ color: '#991B1B', fontSize: '0.8rem', marginTop: '0.5rem' }}>{delegateError}</p>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
