"use client";

// Formulaire « Contacter via AYA » : message, email, code de vérification,
// puis transmission à l'adresse vérifiée de l'entreprise (voir lib/aya/contact.ts).

import { useState } from 'react';
import { useTranslations } from 'next-intl';

const SUBJECTS = ['devis', 'question', 'commande'] as const;

export default function AyaContact({ entityId, companyName, query }: { entityId: string; companyName: string; query: string }) {
    const t = useTranslations('ayaAsk');
    const [subject, setSubject] = useState<(typeof SUBJECTS)[number]>('devis');
    const [message, setMessage] = useState(query ? t('cMsgDefault', { query: query.charAt(0).toLowerCase() + query.slice(1) }) : '');
    const [email, setEmail] = useState('');
    const [token, setToken] = useState<string | null>(null);
    const [code, setCode] = useState('');
    const [step, setStep] = useState<'form' | 'code' | 'sent'>('form');
    const [busy, setBusy] = useState(false);
    const [err, setErr] = useState<string | null>(null);

    const call = async (payload: Record<string, unknown>) => {
        const res = await fetch('/api/aya/contact', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
        return res.json().catch(() => ({ ok: false, error: 'send' }));
    };
    const errText = (e: string) => t(e === 'rate' ? 'cErrRate' : e === 'code' ? 'cErrCode' : e === 'invalid' ? 'cErrInvalid' : 'cErrSend');

    const start = async () => {
        setBusy(true); setErr(null);
        const r = await call({ step: 'start', entity_id: entityId, email, subject, message });
        setBusy(false);
        if (!r.ok) return setErr(errText(r.error));
        setToken(r.token);
        if (r.dev_code) setCode(r.dev_code);
        setStep('code');
    };
    const confirm = async () => {
        setBusy(true); setErr(null);
        const r = await call({ step: 'confirm', entity_id: entityId, email, subject, message, token, code });
        setBusy(false);
        if (!r.ok) return setErr(errText(r.error));
        setStep('sent');
    };

    const field: React.CSSProperties = { boxSizing: 'border-box', width: '100%', border: '1px solid var(--border-light)', borderRadius: 12, padding: '12px 14px', fontSize: 15, color: 'var(--text-main)', background: '#fff', fontFamily: 'inherit' };
    const primary: React.CSSProperties = { border: 0, borderRadius: 12, background: 'var(--primary-hover)', color: '#fff', fontWeight: 700, padding: '0 20px', height: 48, cursor: busy ? 'wait' : 'pointer' };
    const label: React.CSSProperties = { fontSize: 13, fontWeight: 600, color: 'var(--text-muted)' };

    return (
        <div style={{ background: 'var(--bg-main)', border: '1px solid var(--border-light)', borderRadius: 20, padding: 22, display: 'flex', flexDirection: 'column', gap: 14 }}>
            {step === 'sent' ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <h4 style={{ margin: 0, fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: 20, color: 'var(--text-main)' }}>{t('cSentTitle', { name: companyName })}</h4>
                    <p style={{ margin: 0 }}>{t('cSentBody')}</p>
                    <button type="button" onClick={() => { setStep('form'); setToken(null); setCode(''); }} style={{ alignSelf: 'flex-start', border: 0, background: 'transparent', color: 'var(--primary-hover)', fontWeight: 600, padding: 0, cursor: 'pointer', textDecoration: 'underline' }}>{t('cAgain')}</button>
                </div>
            ) : (
                <>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <h4 style={{ margin: 0, fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: 20, color: 'var(--text-main)' }}>{t('cTitle', { name: companyName })}</h4>
                        <p style={{ margin: 0, fontSize: 14, color: 'var(--text-muted)' }}>{t('cIntro')}</p>
                    </div>
                    <div role="group" aria-label={t('cSubject')} style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                        {SUBJECTS.map((s) => (
                            <button key={s} type="button" aria-pressed={subject === s} disabled={step === 'code'} onClick={() => setSubject(s)}
                                style={{ fontSize: 14, fontWeight: 600, padding: '8px 14px', borderRadius: 999, cursor: 'pointer', border: `1px solid ${subject === s ? 'var(--primary-hover)' : 'var(--border-light)'}`, background: subject === s ? 'var(--primary-hover)' : '#fff', color: subject === s ? '#fff' : 'var(--text-body)' }}>
                                {t(s === 'devis' ? 'cSubjDevis' : s === 'question' ? 'cSubjQuestion' : 'cSubjCommande')}
                            </button>
                        ))}
                    </div>
                    <label htmlFor={`m-${entityId}`} style={label}>{t('cMessage')}</label>
                    <textarea id={`m-${entityId}`} rows={4} value={message} onChange={(e) => setMessage(e.target.value)} readOnly={step === 'code'} maxLength={3000} style={{ ...field, resize: 'vertical' }} />
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'flex-end' }}>
                        <div style={{ flex: '999 1 240px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
                            <label htmlFor={`e-${entityId}`} style={label}>{t('cEmail')}</label>
                            <input id={`e-${entityId}`} type="email" value={email} onChange={(e) => setEmail(e.target.value)} readOnly={step === 'code'} placeholder="vous@entreprise.ch" style={{ ...field, height: 48 }} />
                        </div>
                        {step === 'form' && <button type="button" onClick={start} disabled={busy} style={{ ...primary, flex: '1 1 200px' }}>{t('cGetCode')}</button>}
                    </div>
                    {step === 'code' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            <p style={{ margin: 0, fontSize: 14 }}>{t('cCodeSent', { email })}</p>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'flex-end' }}>
                                <div style={{ flex: '1 1 160px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                                    <label htmlFor={`c-${entityId}`} style={label}>{t('cCode')}</label>
                                    <input id={`c-${entityId}`} inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} style={{ ...field, height: 48, letterSpacing: 4, fontWeight: 700 }} />
                                </div>
                                <button type="button" onClick={confirm} disabled={busy || code.length !== 6} style={{ ...primary, flex: '1 1 200px' }}>{t('cSend')}</button>
                            </div>
                        </div>
                    )}
                    {err && <p role="alert" style={{ margin: 0, color: 'var(--accent-color)', fontWeight: 600 }}>{err}</p>}
                </>
            )}
        </div>
    );
}
