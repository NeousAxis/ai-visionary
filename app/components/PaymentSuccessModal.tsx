"use client";

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';

export default function PaymentSuccessModal() {
    const searchParams = useSearchParams();
    const [showModal, setShowModal] = useState(false);
    const [status, setStatus] = useState<'processing' | 'success' | 'error'>('processing');
    const [packType, setPackType] = useState<'essential' | 'pro'>('essential');

    const [files, setFiles] = useState<{ asr: string, external_context: string } | null>(null);

    useEffect(() => {
        const paymentSuccess = searchParams.get('payment_success');
        const sessionId = searchParams.get('session_id');

        if (sessionId) {
            setShowModal(true);

            // Trigger file generation in background
            const processOrder = async () => {
                try {
                    const res = await fetch('/api/webhooks/checkout-success', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ session_id: sessionId })
                    });

                    if (res.ok) {
                        const data = await res.json();
                        // Determine pack type from amount
                        if (data.amount && data.amount >= 499) {
                            setPackType('pro');
                        }

                        // STORE FILES FOR DIRECT DOWNLOAD
                        if (data.files) {
                            setFiles(data.files);
                        }

                        setStatus('success');
                    } else {
                        setStatus('error');
                    }
                } catch (e) {
                    console.error('Processing error:', e);
                    setStatus('error');
                }
            };

            processOrder();
        }
    }, [searchParams]);

    const handleClose = () => {
        setShowModal(false);
        // Clean URL
        window.history.replaceState({}, '', '/');
    };

    const downloadFile = (filename: string, content: string) => {
        if (!content) return;
        const blob = new Blob([content], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    if (!showModal) return null;

    return (
        <>
            {/* Backdrop */}
            <div
                className="fixed inset-0 bg-black/70 backdrop-blur-md z-[9999] transition-opacity duration-300"
                onClick={handleClose}
            />

            {/* Modal */}
            <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 pointer-events-none">
                <div
                    className="pointer-events-auto bg-gradient-to-br from-[#0f0518] via-[#1a0b2e] to-[#0f0518] border-2 border-purple-500/30 rounded-3xl shadow-2xl max-w-lg w-full p-8 relative overflow-hidden"
                    style={{
                        animation: 'modalSlideIn 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)',
                        boxShadow: '0 0 60px rgba(139, 92, 246, 0.4), 0 0 120px rgba(217, 70, 239, 0.2)'
                    }}
                >
                    {/* Animated background gradient */}
                    <div className="absolute inset-0 opacity-30">
                        <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-purple-600/20 via-transparent to-pink-600/20 animate-pulse"></div>
                    </div>

                    <div className="relative z-10">
                        {status === 'processing' && (
                            <div className="text-center">
                                <div className="w-20 h-20 mx-auto mb-6 relative">
                                    <div className="absolute inset-0 border-4 border-purple-500/30 rounded-full"></div>
                                    <div className="absolute inset-0 border-4 border-purple-500 border-t-transparent rounded-full animate-spin"></div>
                                    <div className="absolute inset-2 border-4 border-pink-500/30 rounded-full"></div>
                                    <div className="absolute inset-2 border-4 border-pink-500 border-b-transparent rounded-full animate-spin" style={{ animationDirection: 'reverse', animationDuration: '1.5s' }}></div>
                                </div>
                                <h2 className="text-2xl font-bold text-white mb-3">Génération en cours...</h2>
                                <p className="text-gray-300">Nous préparons vos fichiers AIO</p>
                                <div className="mt-4 flex justify-center gap-1">
                                    <div className="w-2 h-2 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                                    <div className="w-2 h-2 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                                    <div className="w-2 h-2 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                                </div>
                            </div>
                        )}

                        {status === 'success' && (
                            <div className="text-center">
                                {/* Success Icon with animation */}
                                <div className="relative w-24 h-24 mx-auto mb-6">
                                    <div className="absolute inset-0 rounded-full bg-gradient-to-br from-green-400 to-emerald-600 animate-ping opacity-75"></div>
                                    <div className="relative w-24 h-24 rounded-full bg-gradient-to-br from-green-400 to-emerald-600 flex items-center justify-center shadow-lg shadow-green-500/50">
                                        <svg className="w-12 h-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="3">
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"></path>
                                        </svg>
                                    </div>
                                </div>

                                <h2 className="text-4xl font-bold text-white mb-3 animate-fade-in">
                                    🎉 Paiement validé !
                                </h2>

                                <p className="text-xl text-gray-200 mb-6">
                                    Votre Pack <span className="font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">{packType === 'pro' ? 'PRO' : 'Essential'}</span> est activé
                                </p>

                                {/* FILE DOWNLOAD / EMAIL INFO */}
                                <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6 mb-8 text-left">

                                    {/* DOWNLOAD OPTION */}
                                    {files && (
                                        <div className="mb-6 pb-6 border-b border-white/10">
                                            <h3 className="text-white font-bold mb-3 text-lg flex items-center gap-2">
                                                <svg className="w-5 h-5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                                </svg>
                                                Téléchargement Immédiat
                                            </h3>
                                            <button
                                                onClick={() => downloadFile('asr.json', files.asr)}
                                                className="w-full mb-3 flex items-center justify-center gap-2 bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/50 text-emerald-300 font-bold py-3 px-4 rounded-xl transition-all"
                                            >
                                                📥 Télécharger ASR (asr.json)
                                            </button>
                                            <button
                                                onClick={() => downloadFile('external_context.json', files.external_context)}
                                                className="w-full flex items-center justify-center gap-2 bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/50 text-blue-300 font-bold py-3 px-4 rounded-xl transition-all"
                                            >
                                                📥 Télécharger External Context
                                            </button>
                                        </div>
                                    )}

                                    <div className="flex items-start gap-4">
                                        <div className="mt-1 bg-gradient-to-br from-purple-500 to-pink-500 p-3 rounded-xl shadow-lg">
                                            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path>
                                            </svg>
                                        </div>
                                        <div className="flex-1">
                                            <h3 className="text-white font-bold mb-2 text-lg">📧 Copie par Email</h3>
                                            <p className="text-gray-300 text-sm leading-relaxed">
                                                Une copie a également été envoyée par email.
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                <button
                                    onClick={handleClose}
                                    className="w-full px-8 py-4 bg-gradient-to-r from-purple-600 via-purple-500 to-pink-600 text-white font-bold text-lg rounded-xl hover:from-purple-700 hover:via-purple-600 hover:to-pink-700 transition-all duration-300 shadow-lg shadow-purple-500/50 hover:shadow-purple-500/70 hover:-translate-y-1 transform"
                                >
                                    → Retour à l'accueil
                                </button>
                            </div>
                        )}

                        {status === 'error' && (
                            <div className="text-center">
                                <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-red-500/20 border-2 border-red-500 flex items-center justify-center">
                                    <svg className="w-10 h-10 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path>
                                    </svg>
                                </div>
                                <h2 className="text-2xl font-bold text-white mb-3">Erreur technique</h2>
                                <p className="text-gray-300 mb-6">
                                    Votre paiement a été reçu mais nous rencontrons un problème technique.
                                </p>
                                <a
                                    href="mailto:hello@ai-visionary.com"
                                    className="inline-block px-6 py-3 bg-white/10 hover:bg-white/20 text-white font-medium rounded-lg transition-colors"
                                >
                                    Contacter le support
                                </a>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <style jsx>{`
                @keyframes modalSlideIn {
                    from {
                        opacity: 0;
                        transform: scale(0.8) translateY(50px);
                    }
                    to {
                        opacity: 1;
                        transform: scale(1) translateY(0);
                    }
                }
                @keyframes fade-in {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
                .animate-fade-in {
                    animation: fade-in 0.5s ease-out;
                }
            `}</style>
        </>
    );
}
