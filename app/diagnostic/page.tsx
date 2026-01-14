'use client';

import React from 'react';
import Link from 'next/link';
import AyoChat from '../components/AyoChat';

export default function DiagnosticPage() {
    return (
        <div className="diagnostic-container">

            {/* Header */}
            <header className="diagnostic-header">
                <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Link href="/" className="btn btn-secondary" style={{ padding: '0.6rem 1.2rem', fontSize: '0.9rem' }}>
                        ← Retour à l'accueil
                    </Link>

                    <img src="/logo.svg" alt="AI Visionary" style={{ height: '70px', width: 'auto' }} />
                </div>
            </header>

            {/* Chat Content */}
            <div style={{ flex: 1, display: 'flex', justifyContent: 'center', padding: '0 20px' }}>
                <div className="diagnostic-frame">
                    <AyoChat mode="fullscreen" />
                </div>
            </div>

            {/* Footer Text */}
            <div style={{ textAlign: 'center', paddingBottom: '20px', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                © 2026 AI Visionary • Powered by AYO V4
            </div>
        </div>
    );
}
