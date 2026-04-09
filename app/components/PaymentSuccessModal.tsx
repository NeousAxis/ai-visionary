"use client";

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';

export default function PaymentSuccessModal() {
    const searchParams = useSearchParams();
    const t = useTranslations('payment');
    const [showModal, setShowModal] = useState(false);
    const [status, setStatus] = useState<'processing' | 'success' | 'error'>('processing');
    const [packType, setPackType] = useState<'plateforme' | 'pro'>('plateforme');

    useEffect(() => {
        const sessionId = searchParams.get('session_id');
        const pack = searchParams.get('pack');

        // M8: Validate session_id format (Stripe session IDs start with cs_)
        const isValidSessionId = sessionId && /^cs_(test_|live_)[a-zA-Z0-9]{10,}$/.test(sessionId);

        if (isValidSessionId) {
            setShowModal(true);
            if (pack === 'pro') setPackType('pro');
            else setPackType('plateforme');

            // The REAL order processing is done by Stripe's webhook (with signature verification).
            // This modal is purely UX — show a brief "processing" animation, then success.
            // We do NOT call the webhook from the browser (it requires Stripe signature).
            const timer = setTimeout(() => {
                setStatus('success');
                // Clean URL (remove session_id and pack from browser bar)
                window.history.replaceState({}, '', window.location.pathname);
            }, 2000);

            return () => clearTimeout(timer);
        }
    }, [searchParams]);

    const handleClose = () => {
        setShowModal(false);
        window.history.replaceState({}, '', '/');
    };

    if (!showModal) return null;

    return (
        <>
            {/* Backdrop */}
            <div
                className="fixed inset-0 z-[9999] transition-opacity duration-300"
                style={{ background: 'rgba(33, 46, 83, 0.6)', backdropFilter: 'blur(8px)' }}
                onClick={handleClose}
            />

            {/* Modal */}
            <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 pointer-events-none">
                <div
                    className="pointer-events-auto w-full"
                    style={{
                        maxWidth: '480px',
                        background: '#FFFFFF',
                        borderRadius: '24px',
                        border: '1px solid #D4E0DC',
                        boxShadow: '0 25px 60px rgba(33, 46, 83, 0.18), 0 8px 20px rgba(33, 46, 83, 0.08)',
                        animation: 'modalSlideIn 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)',
                        overflow: 'hidden',
                    }}
                >
                    {/* Teal header bar */}
                    <div style={{
                        background: 'linear-gradient(135deg, #4A919E 0%, #356D76 100%)',
                        padding: '28px 32px',
                        textAlign: 'center',
                    }}>
                        {status === 'processing' && (
                            <>
                                <div style={{
                                    width: '56px', height: '56px', margin: '0 auto 16px',
                                    border: '3px solid rgba(255,255,255,0.3)', borderTop: '3px solid #fff',
                                    borderRadius: '50%', animation: 'spin 1s linear infinite',
                                }} />
                                <h2 style={{ color: '#fff', fontSize: '1.5rem', fontWeight: 700, margin: 0, letterSpacing: '-0.02em' }}>
                                    {t('processingTitle')}
                                </h2>
                                <p style={{ color: 'rgba(255,255,255,0.8)', fontSize: '0.95rem', marginTop: '6px' }}>
                                    {t('processingSubtitle')}
                                </p>
                            </>
                        )}
                        {status === 'success' && (
                            <>
                                <div style={{
                                    width: '64px', height: '64px', margin: '0 auto 16px',
                                    background: 'rgba(255,255,255,0.2)', borderRadius: '50%',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                }}>
                                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M5 13l4 4L19 7" />
                                    </svg>
                                </div>
                                <h2 style={{ color: '#fff', fontSize: '1.6rem', fontWeight: 800, margin: 0, letterSpacing: '-0.02em' }}>
                                    {t('successTitle')}
                                </h2>
                                <p style={{ color: 'rgba(255,255,255,0.85)', fontSize: '1rem', marginTop: '8px', fontWeight: 500 }}>
                                    {t('packActivated', { pack: packType === 'pro' ? 'PRO' : 'Plateforme' })}
                                </p>
                            </>
                        )}
                        {status === 'error' && (
                            <>
                                <div style={{
                                    width: '64px', height: '64px', margin: '0 auto 16px',
                                    background: 'rgba(255,255,255,0.2)', borderRadius: '50%',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                }}>
                                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                    </svg>
                                </div>
                                <h2 style={{ color: '#fff', fontSize: '1.5rem', fontWeight: 700, margin: 0 }}>
                                    {t('errorTitle')}
                                </h2>
                            </>
                        )}
                    </div>

                    {/* Body */}
                    <div style={{ padding: '28px 32px 32px' }}>
                        {status === 'processing' && (
                            <div style={{ textAlign: 'center' }}>
                                <div style={{ display: 'flex', justifyContent: 'center', gap: '6px', marginTop: '8px' }}>
                                    {[0, 150, 300].map((delay) => (
                                        <div key={delay} style={{
                                            width: '8px', height: '8px', borderRadius: '50%',
                                            background: '#4A919E',
                                            animation: `bounce 1.4s infinite ease-in-out`,
                                            animationDelay: `${delay}ms`,
                                        }} />
                                    ))}
                                </div>
                            </div>
                        )}

                        {status === 'success' && (
                            <>
                                {/* Files info card */}
                                <div style={{
                                    background: '#F5F9F8',
                                    border: '1px solid #D4E0DC',
                                    borderRadius: '16px',
                                    padding: '20px 24px',
                                    marginBottom: '24px',
                                }}>
                                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px' }}>
                                        <div style={{
                                            width: '42px', height: '42px', borderRadius: '12px', flexShrink: 0,
                                            background: '#4A919E', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        }}>
                                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                <path d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                            </svg>
                                        </div>
                                        <div style={{ flex: 1 }}>
                                            <h3 style={{ color: '#212E53', fontSize: '1rem', fontWeight: 700, margin: '0 0 6px 0' }}>
                                                {t('filesSentTitle')}
                                            </h3>
                                            {packType === 'pro' ? (
                                                <>
                                                    <p style={{ color: '#324066', fontSize: '0.9rem', margin: '0 0 10px 0', lineHeight: 1.5 }}>
                                                        {t('proFilesSent')}
                                                    </p>
                                                    <div style={{
                                                        display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 12px',
                                                        fontSize: '0.82rem', fontFamily: 'monospace', color: '#64748B', lineHeight: 1.7,
                                                    }}>
                                                        <span>1. ASR-Protocol.json</span>
                                                        <span>2. external_context.json</span>
                                                        <span>3. faq.json</span>
                                                        <span>4. glossary.json</span>
                                                        <span>5. manifest.json</span>
                                                    </div>
                                                </>
                                            ) : (
                                                <p style={{ color: '#324066', fontSize: '0.9rem', margin: 0, lineHeight: 1.5 }}>
                                                    {t('platformFileSent')}
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Spam reminder */}
                                <p style={{
                                    textAlign: 'center', color: '#64748B', fontSize: '0.85rem',
                                    marginBottom: '24px', fontStyle: 'italic',
                                }}>
                                    {t('spamReminder')}
                                </p>

                                {/* CTA button */}
                                <button
                                    onClick={handleClose}
                                    style={{
                                        width: '100%', padding: '14px 24px',
                                        background: '#4A919E', color: '#fff',
                                        fontSize: '1rem', fontWeight: 600,
                                        border: 'none', borderRadius: '50px', cursor: 'pointer',
                                        boxShadow: '0 4px 14px rgba(74, 145, 158, 0.3)',
                                        transition: 'all 0.2s ease',
                                        letterSpacing: '0.02em', textTransform: 'uppercase',
                                    }}
                                    onMouseEnter={(e) => {
                                        e.currentTarget.style.background = '#356D76';
                                        e.currentTarget.style.transform = 'translateY(-2px)';
                                        e.currentTarget.style.boxShadow = '0 6px 20px rgba(74, 145, 158, 0.4)';
                                    }}
                                    onMouseLeave={(e) => {
                                        e.currentTarget.style.background = '#4A919E';
                                        e.currentTarget.style.transform = 'translateY(0)';
                                        e.currentTarget.style.boxShadow = '0 4px 14px rgba(74, 145, 158, 0.3)';
                                    }}
                                >
                                    {t('backHome')}
                                </button>
                            </>
                        )}

                        {status === 'error' && (
                            <div style={{ textAlign: 'center' }}>
                                <p style={{ color: '#324066', fontSize: '0.95rem', lineHeight: 1.6, marginBottom: '20px' }}>
                                    {t('errorBody')}
                                </p>
                                <a
                                    href="mailto:hello@ai-visionary.xyz"
                                    style={{
                                        display: 'inline-block', padding: '12px 28px',
                                        background: '#F5F9F8', border: '1px solid #D4E0DC',
                                        borderRadius: '50px', color: '#212E53', fontWeight: 600,
                                        fontSize: '0.95rem', textDecoration: 'none',
                                        transition: 'all 0.2s',
                                    }}
                                >
                                    {t('contactSupport')}
                                </a>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <style jsx>{`
                @keyframes modalSlideIn {
                    from { opacity: 0; transform: scale(0.95) translateY(20px); }
                    to { opacity: 1; transform: scale(1) translateY(0); }
                }
                @keyframes spin {
                    to { transform: rotate(360deg); }
                }
                @keyframes bounce {
                    0%, 80%, 100% { transform: scale(0); }
                    40% { transform: scale(1); }
                }
            `}</style>
        </>
    );
}
