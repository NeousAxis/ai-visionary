'use client';

import React from 'react';
import Link from 'next/link';
import AyoChat from '../components/AyoChat';

export default function DiagnosticPage() {
    return (
        <div className="diagnostic-container" style={{ flexDirection: 'column', padding: '20px' }}>

            {/* Nav Header */}
            <div className="diagnostic-header" style={{
                width: '100%',
                maxWidth: '1200px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '20px'
            }}>
                <Link href="/" className="btn btn-secondary" style={{ padding: '0.6rem 1.2rem', fontSize: '0.9rem' }}>
                    ← Retour à l'accueil
                </Link>
                <img src="/logo.png" alt="AI Visionary" className="logo-tinted" style={{ height: '50px' }} />
                <div style={{ width: '140px' }}></div> {/* Spacer for alignment */}
            </div>

            {/* Chat Frame */}
            <div className="diagnostic-frame" style={{
                boxShadow: '0 20px 60px rgba(74, 145, 158, 0.15)',
                border: '1px solid rgba(74, 145, 158, 0.2)'
            }}>
                <AyoChat mode="fullscreen" />
            </div>

            <div style={{ marginTop: '20px', color: '#64748B', fontSize: '0.8rem' }}>
                © 2026 AI Visionary • Powered by AYO V4
            </div>
        </div>
    );
}
