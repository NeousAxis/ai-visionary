"use client";

import { useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';

function SuccessRedirect() {
    const searchParams = useSearchParams();
    const sessionId = searchParams.get('session_id');

    useEffect(() => {
        if (sessionId) {
            // Redirect to home with session_id parameter to trigger popup
            window.location.href = `/?payment_success=true&session_id=${sessionId}`;
        } else {
            // No session, just go home
            window.location.href = '/';
        }
    }, [sessionId]);

    return (
        <div className="min-h-screen bg-gradient-to-br from-[#0f0518] to-[#1a0b2e] flex items-center justify-center">
            <div className="text-center">
                <div className="w-16 h-16 mx-auto mb-4 relative">
                    <div className="absolute inset-0 border-4 border-purple-500/30 rounded-full"></div>
                    <div className="absolute inset-0 border-4 border-purple-500 border-t-transparent rounded-full animate-spin"></div>
                </div>
                <p className="text-white text-lg">Redirection...</p>
            </div>
        </div>
    );
}

export default function SuccessPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen bg-gradient-to-br from-[#0f0518] to-[#1a0b2e] flex items-center justify-center">
                <div className="text-center">
                    <div className="w-16 h-16 mx-auto mb-4 relative">
                        <div className="absolute inset-0 border-4 border-purple-500/30 rounded-full"></div>
                        <div className="absolute inset-0 border-4 border-purple-500 border-t-transparent rounded-full animate-spin"></div>
                    </div>
                    <p className="text-white text-lg">Chargement...</p>
                </div>
            </div>
        }>
            <SuccessRedirect />
        </Suspense>
    );
}
