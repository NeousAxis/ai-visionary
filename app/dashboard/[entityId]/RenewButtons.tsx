'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';

interface RenewButtonsProps {
    email: string;
    url: string;
    entityId: string;
    hasRequiredInfo: boolean;
    proUrl?: string;
    ayaUrl?: string;
    isActive: boolean;
    expiresSoon: boolean;
    currentPackType: 'PRO' | 'AYA_SUB';
}

function useCheckout(email: string, url: string, entityId: string, proUrl?: string, ayaUrl?: string) {
    const [loading, setLoading] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    async function checkout(packType: 'PRO' | 'AYA_SUB') {
        if (!email || !url) {
            window.location.href = '/diagnostic';
            return;
        }
        setLoading(packType);
        setError(null);

        // Prefer direct Payment Link redirect (no Stripe API call needed)
        const directUrl = packType === 'PRO' ? proUrl : ayaUrl;
        if (directUrl) {
            window.location.href = directUrl;
            return;
        }

        // Fallback: create checkout session via API
        try {
            const res = await fetch('/api/create-checkout', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, url, packType, analysisId: entityId }),
            });
            const data = await res.json();
            if (!res.ok || !data.url) {
                throw new Error(data.error || 'Error');
            }
            window.location.href = data.url;
        } catch (e: unknown) {
            setError(e instanceof Error ? e.message : 'Error');
            setLoading(null);
        }
    }

    return { loading, error, checkout };
}

export default function RenewButtons({ email, url, entityId, hasRequiredInfo, proUrl, ayaUrl, isActive, expiresSoon, currentPackType }: RenewButtonsProps) {
    const t = useTranslations('renew');
    const { loading, error, checkout } = useCheckout(email, url, entityId, proUrl, ayaUrl);

    const btnBase: React.CSSProperties = {
        display: 'block',
        width: '100%',
        padding: '12px',
        color: 'white',
        border: 'none',
        borderRadius: 'var(--radius-sm)',
        fontSize: '0.95rem',
        fontWeight: 'bold',
        textAlign: 'center',
        cursor: loading ? 'wait' : 'pointer',
        opacity: loading ? 0.7 : 1,
    };

    const proFeatures = [
        t('proFeature1'),
        t('proFeature2'),
        t('proFeature3'),
        t('proFeature4'),
    ];

    const ayaFeatures = [
        t('ayaFeature1'),
        t('ayaFeature2'),
        t('ayaFeature3'),
        t('ayaFeature4'),
    ];

    // Pack active and not expiring soon: hide all buttons
    if (isActive && !expiresSoon) {
        return null;
    }

    // PRO active (expiring soon or not): hide AYA option (no downgrade)
    const hideAya = currentPackType === 'PRO' && isActive;

    return (
        <>
            {error && (
                <div style={{
                    background: '#FEE2E2',
                    border: '1px solid #FECACA',
                    color: '#991B1B',
                    padding: '12px 16px',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: '0.85rem',
                    marginBottom: '1rem',
                    textAlign: 'center',
                }}>
                    {error}
                    <br />
                    <a href="mailto:hello@ai-visionary.com" style={{ color: '#991B1B', fontWeight: 'bold' }}>
                        {t('contactError')}
                    </a>
                </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: hideAya ? '1fr' : '1fr 1fr', gap: '1.5rem', maxWidth: hideAya ? '400px' : undefined, margin: hideAya ? '0 auto' : undefined }}>
                {/* PRO */}
                <div className="card" style={{ position: 'relative', border: '2px solid #D97706' }}>
                    <div style={{
                        position: 'absolute', top: '-12px', left: '50%', transform: 'translateX(-50%)',
                        background: '#D97706', color: 'white', padding: '4px 12px', borderRadius: '20px',
                        fontSize: '0.75rem', fontWeight: 'bold', whiteSpace: 'nowrap',
                    }}>
                        {t('recommended')}
                    </div>
                    <div style={{ textAlign: 'center', paddingTop: '1rem' }}>
                        <h4 style={{ color: 'var(--text-main)', marginBottom: '0.25rem', fontSize: '1.2rem' }}>{t('proTitle')}</h4>
                        <p style={{ fontSize: '2rem', fontWeight: 'bold', color: '#D97706', marginBottom: '0.25rem' }}>{t('proPrice')}</p>
                        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>{t('proUnit')}</p>
                        <ul style={{ textAlign: 'left', fontSize: '0.85rem', color: 'var(--text-body)', listStyle: 'none', padding: '0', marginBottom: '1.5rem' }}>
                            {proFeatures.map(item => (
                                <li key={item} style={{ marginBottom: '8px', display: 'flex', alignItems: 'start', gap: '8px' }}>
                                    <span style={{ color: 'var(--primary-color)', flexShrink: 0 }}>&#10003;</span>
                                    {item}
                                </li>
                            ))}
                        </ul>
                        {hasRequiredInfo ? (
                            <button
                                onClick={() => checkout('PRO')}
                                disabled={!!loading}
                                style={{ ...btnBase, background: '#D97706' }}
                            >
                                {loading === 'PRO' ? t('redirecting') : t('renewPro')}
                            </button>
                        ) : (
                            <a href="/diagnostic" style={{ ...btnBase, background: '#D97706', textDecoration: 'none', display: 'block' }}>
                                {t('doDiagnostic')}
                            </a>
                        )}
                    </div>
                </div>

                {/* AYA Sub — hidden if PRO active (no downgrade) */}
                {!hideAya && (
                <div className="card" style={{ border: '2px solid var(--primary-color)' }}>
                    <div style={{ textAlign: 'center', paddingTop: '1rem' }}>
                        <h4 style={{ color: 'var(--text-main)', marginBottom: '0.25rem', fontSize: '1.2rem' }}>{t('ayaSubTitle')}</h4>
                        <p style={{ fontSize: '2rem', fontWeight: 'bold', color: 'var(--primary-color)', marginBottom: '0.25rem' }}>{t('ayaSubPrice')}</p>
                        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>{t('ayaSubUnit')}</p>
                        <ul style={{ textAlign: 'left', fontSize: '0.85rem', color: 'var(--text-body)', listStyle: 'none', padding: '0', marginBottom: '1.5rem' }}>
                            {ayaFeatures.map(item => (
                                <li key={item} style={{ marginBottom: '8px', display: 'flex', alignItems: 'start', gap: '8px' }}>
                                    <span style={{ color: 'var(--primary-color)', flexShrink: 0 }}>&#10003;</span>
                                    {item}
                                </li>
                            ))}
                        </ul>
                        {hasRequiredInfo ? (
                            <button
                                onClick={() => checkout('AYA_SUB')}
                                disabled={!!loading}
                                style={{ ...btnBase, background: 'var(--primary-color)' }}
                            >
                                {loading === 'AYA_SUB' ? t('redirecting') : t('renewAya')}
                            </button>
                        ) : (
                            <a href="/diagnostic" style={{ ...btnBase, background: 'var(--primary-color)', textDecoration: 'none', display: 'block' }}>
                                {t('doDiagnostic')}
                            </a>
                        )}
                    </div>
                </div>
                )}
            </div>
        </>
    );
}
