'use client';

import React from 'react';
import AyoChat from '../components/AyoChat';

export default function DiagnosticPage() {
    return (
        <div className="diagnostic-container">
            <div className="diagnostic-frame">
                {/* 
                  We mount AyoChat here. 
                  Note: AyoChat component needs to be updated to support full-frame mode 
                  and remove the "Matrix" styling classes. 
                  I will update AyoChat.tsx next. 
                */}
                <AyoChat mode="fullscreen" />
            </div>

            {/* Footer / Copyright specific to this focused page */}
            <div style={{ position: 'absolute', bottom: '20px', color: '#64748B', fontSize: '0.8rem' }}>
                © 2026 AI Visionary • Powered by AYO V4
            </div>
        </div>
    );
}
