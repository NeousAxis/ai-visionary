'use client';

import { useState } from 'react';

interface OtpGateProps {
  entityId: string;
  entityEmail: string;
  entityName: string;
  entityWebsite: string;
  children: React.ReactNode;
}

export default function OtpGate({ entityId, entityEmail, entityName, entityWebsite, children }: OtpGateProps) {
  const [step, setStep] = useState<'email' | 'code' | 'verified'>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Mask the entity email for display: only show domain extension
  // e.g. "info@eclore-asso.org" → "****@****.org"
  const maskedEmail = entityEmail
    ? entityEmail.replace(/^.+@.+(\.\w+)$/, '****@****$1')
    : '';

  const handleSendOtp = async () => {
    setError('');
    if (!email.trim()) {
      setError('Veuillez entrer votre email.');
      return;
    }

    // Check email matches entity (case-insensitive)
    if (email.trim().toLowerCase() !== entityEmail.toLowerCase()) {
      setError('Cet email ne correspond pas a celui enregistre pour cette entite.');
      return;
    }

    setLoading(true);
    try {
      // Send OTP directly to the verified email address
      const res = await fetch('/api/auth/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), entityId }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Erreur lors de l\'envoi du code.');
      }
      setStep('code');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erreur reseau.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    setError('');
    if (!code.trim() || code.trim().length < 4) {
      setError('Veuillez entrer le code recu par email.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), code: code.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Code invalide ou expire.');
      }
      setStep('verified');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erreur reseau.');
    } finally {
      setLoading(false);
    }
  };

  // Once verified, show the form
  if (step === 'verified') {
    return <>{children}</>;
  }

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '12px 16px',
    borderRadius: '8px',
    border: '1px solid #e5e7eb',
    fontSize: '1rem',
    color: '#212E53',
    background: '#fff',
    outline: 'none',
    boxSizing: 'border-box',
  };

  const btnStyle: React.CSSProperties = {
    width: '100%',
    padding: '12px',
    borderRadius: '8px',
    border: 'none',
    background: loading ? '#9ca3af' : '#4A919E',
    color: '#fff',
    fontWeight: '700',
    fontSize: '0.95rem',
    cursor: loading ? 'wait' : 'pointer',
  };

  return (
    <div style={{
      background: '#fff',
      borderRadius: '12px',
      border: '1px solid #e5e7eb',
      padding: '2.5rem 2rem',
      maxWidth: '450px',
      margin: '0 auto',
      textAlign: 'center',
    }}>
      <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>
        {step === 'email' ? '🔐' : '📧'}
      </div>

      <h2 style={{ color: '#212E53', fontSize: '1.3rem', marginBottom: '0.5rem' }}>
        {step === 'email' ? 'Verification d\'identite' : 'Entrez le code recu'}
      </h2>

      <p style={{ color: '#6b7280', fontSize: '0.9rem', marginBottom: '1.5rem', lineHeight: '1.5' }}>
        {step === 'email'
          ? <>Pour modifier les donnees de <strong>{entityName}</strong>, veuillez confirmer votre email{maskedEmail ? <> ({maskedEmail})</> : ''}.</>
          : <>Un code a 6 chiffres a ete envoye a <strong>{email}</strong>. Verifiez votre boite de reception.</>
        }
      </p>

      {step === 'email' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSendOtp()}
            placeholder="votre@email.com"
            style={inputStyle}
            autoFocus
          />
          <button onClick={handleSendOtp} disabled={loading} style={btnStyle}>
            {loading ? 'Envoi en cours...' : 'Envoyer le code de verification'}
          </button>
        </div>
      )}

      {step === 'code' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <input
            type="text"
            value={code}
            onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            onKeyDown={e => e.key === 'Enter' && handleVerifyOtp()}
            placeholder="000000"
            style={{ ...inputStyle, textAlign: 'center', fontSize: '1.5rem', letterSpacing: '0.3em' }}
            autoFocus
          />
          <button onClick={handleVerifyOtp} disabled={loading} style={btnStyle}>
            {loading ? 'Verification...' : 'Verifier'}
          </button>
          <button
            onClick={() => { setStep('email'); setCode(''); setError(''); }}
            style={{ background: 'none', border: 'none', color: '#6b7280', fontSize: '0.85rem', cursor: 'pointer', textDecoration: 'underline' }}
          >
            Renvoyer le code
          </button>
        </div>
      )}

      {error && (
        <div style={{
          background: '#FEE2E2',
          border: '1px solid #FECACA',
          color: '#991B1B',
          padding: '10px 14px',
          borderRadius: '8px',
          fontSize: '0.85rem',
          marginTop: '0.75rem',
        }}>
          {error}
        </div>
      )}
    </div>
  );
}
