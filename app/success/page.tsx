"use client";

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';

function SuccessContent() {
    const searchParams = useSearchParams();
    const sessionId = searchParams.get('session_id');
    const [status, setStatus] = useState<'loading' | 'success' | 'email_required' | 'error'>('loading');
    const [errorMessage, setErrorMessage] = useState('');
    const [manualEmail, setManualEmail] = useState('');
    const [isRetrying, setIsRetrying] = useState(false);

    useEffect(() => {
        if (!sessionId) {
            return;
        }

        let isActive = true;

        const autoCheck = async () => {
            console.log("Starting Auto-Check for:", sessionId);
            try {
                const res = await fetch('/api/webhooks/checkout-success', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ session_id: sessionId })
                });

                if (!isActive) return;

                if (res.ok) {
                    setStatus('success');
                } else {
                    const err = await res.json().catch(() => ({}));
                    if (err.error && err.error.includes('No email')) {
                        setStatus('email_required');
                    } else {
                        console.error("Verification failed:", err);
                        setErrorMessage(err.error || "Erreur inconnue");
                        setStatus('error');
                    }
                }
            } catch (e) {
                if (!isActive) return;
                console.error("Network Error:", e);
                setErrorMessage("Erreur réseau. Veuillez réessayer.");
                setStatus('error');
            }
        };

        if (status === 'loading') {
            autoCheck();
        }

        return () => { isActive = false; };
    }, [sessionId]);

    const handleManualSubmit = async () => {
        if (!manualEmail.includes('@')) return;
        setIsRetrying(true);
        try {
            const res = await fetch('/api/webhooks/checkout-success', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ session_id: sessionId, force_email: manualEmail })
            });
            if (res.ok) {
                setStatus('success');
            } else {
                const errData = await res.json().catch(() => ({}));
                setErrorMessage(errData.error || "Envoi échoué. Réessayez ou contactez le support.");
                alert("Erreur: " + (errData.error || "Inconnue"));
                setIsRetrying(false);
            }
        } catch (e) {
            alert("Erreur réseau.");
            setIsRetrying(false);
        }
    };

    return (
        <div className="min-h-screen bg-white text-gray-900 flex flex-col items-center justify-center p-6 font-sans">

            <div className="max-w-md w-full text-center">

                {/* STATUS: LOADING */}
                {status === 'loading' && (
                    <div className="flex flex-col items-center">
                        <div className="w-8 h-8 border-2 border-gray-900 border-t-transparent rounded-full animate-spin mb-4"></div>
                        <p className="text-sm font-medium text-gray-500 uppercase tracking-widest">Finalisation...</p>
                    </div>
                )}

                {/* STATUS: SUCCESS */}
                {status === 'success' && (
                    <div className="animate-fade-in">
                        {/* ICON: Pure & Central */}
                        <div className="w-24 h-24 mx-auto mb-10 flex items-center justify-center rounded-full bg-green-50 shadow-sm">
                            <svg className="w-12 h-12 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"></path></svg>
                        </div>

                        <h1 className="text-4xl font-extrabold text-black mb-6 tracking-tight mt-6">
                            Paiement validé.
                        </h1>

                        <p className="text-gray-700 text-xl mb-12 font-light leading-relaxed max-w-lg mx-auto">
                            Nous avons bien reçu votre commande.<br />
                            L'activation de votre certificat ASR est immédiate.
                        </p>

                        {/* INFO BOX: Clean High Contrast */}
                        <div className="bg-gray-50 border border-gray-200 rounded-xl p-8 mb-12 text-left shadow-sm">
                            <div className="flex items-start gap-5">
                                <div className="mt-1 bg-white p-2 rounded-lg border border-gray-100 shadow-sm">
                                    <svg className="w-6 h-6 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path></svg>
                                </div>
                                <div>
                                    <h3 className="text-base font-bold text-black uppercase tracking-wide mb-2">Livraison Email</h3>
                                    <p className="text-base text-gray-800 leading-relaxed">
                                        Vos fichiers <strong>Essential PRO</strong> ont été envoyés à votre adresse. Pensez à vérifier vos spams.
                                    </p>
                                </div>
                            </div>
                        </div>

                        <Link href="/" className="inline-block px-10 py-4 bg-black text-white font-bold text-base rounded-xl hover:bg-gray-800 transition-all shadow-xl hover:shadow-2xl hover:-translate-y-0.5">
                            Retour à l'accueil
                        </Link>
                    </div>
                )}

                {/* STATUS: EMAIL REQUIRED */}
                {status === 'email_required' && (
                    <div className="animate-fade-in text-left">
                        <div className="w-16 h-16 mb-6 flex items-center justify-center rounded-full bg-yellow-50 mx-auto">
                            <svg className="w-8 h-8 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
                        </div>

                        <h1 className="text-2xl font-bold text-gray-900 mb-2 text-center">Paiement Reçu</h1>
                        <p className="text-gray-500 text-center mb-8">Pour finaliser la livraison, confirmez votre email.</p>

                        <div className="flex gap-3">
                            <input
                                type="email"
                                placeholder="votre@email.pro"
                                className="flex-1 border-gray-200 bg-gray-50 text-gray-900 rounded-lg px-4 py-3 focus:ring-2 focus:ring-black focus:border-transparent outline-none transition-all placeholder-gray-400"
                                value={manualEmail}
                                onChange={(e) => setManualEmail(e.target.value)}
                            />
                            <button
                                onClick={handleManualSubmit}
                                disabled={isRetrying || !manualEmail}
                                className="px-6 py-3 bg-black text-white font-medium rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50"
                            >
                                {isRetrying ? '...' : 'Envoyer'}
                            </button>
                        </div>
                    </div>
                )}

                {/* STATUS: ERROR */}
                {status === 'error' && (
                    <div className="animate-fade-in text-center">
                        <h2 className="text-xl font-bold text-gray-900 mb-2">Petit souci technique</h2>
                        <p className="text-gray-500 mb-6">{errorMessage}</p>
                        <a href="mailto:hello@ai-visionary.com" className="text-sm font-medium text-black underline decoration-2 hover:text-gray-600">
                            Contacter le support
                        </a>
                    </div>
                )}
            </div>

            {/* Footer Minimal */}
            <div className="fixed bottom-6 text-center w-full pointer-events-none">
                <p className="text-[10px] text-gray-300 uppercase tracking-widest">AI Visionary Secure Checkout</p>
            </div>
        </div>
    );
}

export default function SuccessPage() {
    return (
        <Suspense fallback={<div className="min-h-screen bg-white text-black flex items-center justify-center">Chargement...</div>}>
            <SuccessContent />
        </Suspense>
    );
}
