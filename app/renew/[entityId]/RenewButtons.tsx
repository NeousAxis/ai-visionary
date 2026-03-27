'use client';

import { useState } from 'react';

interface RenewButtonsProps {
    email: string;
    url: string;
    entityId: string;
    hasRequiredInfo: boolean;
}

function useCheckout(email: string, url: string, entityId: string) {
    const [loading, setLoading] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    async function checkout(packType: 'PRO' | 'AYA_SUB') {
        if (!email || !url) {
            window.location.href = '/diagnostic';
            return;
        }
        setLoading(packType);
        setError(null);
        try {
            const res = await fetch('/api/create-checkout', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, url, packType, analysisId: entityId }),
            });
            const data = await res.json();
            if (!res.ok || !data.url) {
                throw new Error(data.error || 'Erreur lors de la creation du paiement');
            }
            window.location.href = data.url;
        } catch (e: unknown) {
            setError(e instanceof Error ? e.message : 'Erreur inattendue. Veuillez reessayer.');
            setLoading(null);
        }
    }

    return { loading, error, checkout };
}

export default function RenewButtons({ email, url, entityId, hasRequiredInfo }: RenewButtonsProps) {
    const { loading, error, checkout } = useCheckout(email, url, entityId);

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
                        Contactez-nous si le probleme persiste
                    </a>
                </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                {/* PRO */}
                <div className="card" style={{ position: 'relative', border: '2px solid #D97706' }}>
                    <div style={{
                        position: 'absolute', top: '-12px', left: '50%', transform: 'translateX(-50%)',
                        background: '#D97706', color: 'white', padding: '4px 12px', borderRadius: '20px',
                        fontSize: '0.75rem', fontWeight: 'bold', whiteSpace: 'nowrap',
                    }}>
                        RECOMMANDE
                    </div>
                    <div style={{ textAlign: 'center', paddingTop: '1rem' }}>
                        <h4 style={{ color: 'var(--text-main)', marginBottom: '0.25rem', fontSize: '1.2rem' }}>Pack PRO</h4>
                        <p style={{ fontSize: '2rem', fontWeight: 'bold', color: '#D97706', marginBottom: '0.25rem' }}>499 CHF</p>
                        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>paiement unique</p>
                        <ul style={{ textAlign: 'left', fontSize: '0.85rem', color: 'var(--text-body)', listStyle: 'none', padding: '0', marginBottom: '1.5rem' }}>
                            {['5 fichiers ASR complets', '3 ans de registre AYA inclus', 'Propriete totale des fichiers', 'Score AIO recalcule'].map(item => (
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
                                {loading === 'PRO' ? 'Redirection...' : 'Renouveler Pack PRO'}
                            </button>
                        ) : (
                            <a href="/diagnostic" style={{ ...btnBase, background: '#D97706', textDecoration: 'none', display: 'block' }}>
                                Faire un diagnostic
                            </a>
                        )}
                    </div>
                </div>

                {/* AYA Sub */}
                <div className="card" style={{ border: '2px solid var(--primary-color)' }}>
                    <div style={{ textAlign: 'center', paddingTop: '1rem' }}>
                        <h4 style={{ color: 'var(--text-main)', marginBottom: '0.25rem', fontSize: '1.2rem' }}>Abonnement AYA</h4>
                        <p style={{ fontSize: '2rem', fontWeight: 'bold', color: 'var(--primary-color)', marginBottom: '0.25rem' }}>19 CHF</p>
                        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>par mois</p>
                        <ul style={{ textAlign: 'left', fontSize: '0.85rem', color: 'var(--text-body)', listStyle: 'none', padding: '0', marginBottom: '1.5rem' }}>
                            {["Registre AYA actif", "ASR heberge par AI Visionary", "Mises a jour incluses", "Priorite IA"].map(item => (
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
                                {loading === 'AYA_SUB' ? 'Redirection...' : "S\u2019abonner a AYA"}
                            </button>
                        ) : (
                            <a href="/diagnostic" style={{ ...btnBase, background: 'var(--primary-color)', textDecoration: 'none', display: 'block' }}>
                                Faire un diagnostic
                            </a>
                        )}
                    </div>
                </div>
            </div>
        </>
    );
}
