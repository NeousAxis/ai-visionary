"use client";

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';

function SuccessContent() {
    const searchParams = useSearchParams();
    const sessionId = searchParams.get('session_id');
    const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
    const [errorMessage, setErrorMessage] = useState(''); // State for error messages
    const [manualEmail, setManualEmail] = useState('');
    const [isRetrying, setIsRetrying] = useState(false);

    const handleManualRetry = async () => {
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
                setErrorMessage(errData.error || "Réessai échoué. Contactez le support.");
                setIsRetrying(false);
            }
        } catch (e) {
            setErrorMessage("Erreur réseau lors du réessai.");
            setIsRetrying(false);
        }
    };

    return (
        <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-8 text-center font-sans">
            <div className="max-w-2xl w-full bg-white/5 border border-white/10 rounded-2xl p-10 shadow-2xl backdrop-blur-sm">

                {status === 'loading' && (
                    <>
                        <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-emerald-400 mx-auto mb-6"></div>
                        <h1 className="text-3xl font-bold mb-4">Vérification de votre paiement...</h1>
                        <p className="text-gray-400">Nous sécurisons votre transaction et préparons votre identité IA.</p>
                    </>
                )}

                {status === 'success' && (
                    <>
                        <div className="text-6xl mb-6">✅</div>
                        <h1 className="text-4xl font-bold mb-6 text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-500">
                            Félicitations !
                        </h1>
                        <p className="text-xl mb-8 text-gray-300">
                            Votre commande pour le <strong className="text-white">Pack ASR Essential PRO</strong> est confirmée.
                        </p>

                        <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-6 mb-8 text-left">
                            <h3 className="text-lg font-semibold text-emerald-400 mb-2">🚀 Prochaines étapes :</h3>
                            <ul className="list-disc pl-5 space-y-2 text-gray-300">
                                <li>Votre <strong>ASR Essential PRO (JSON)</strong> a été généré.</li>
                                <li>Il vient d'être envoyé à {manualEmail ? manualEmail : "votre adresse email"}.</li>
                                <li>Consultez vos emails (et spams) d'ici 2 minutes.</li>
                            </ul>
                        </div>

                        <div className="flex flex-col gap-4">
                            <Link href="/" className="inline-block bg-emerald-500 text-white font-bold py-3 px-8 rounded-full hover:bg-emerald-600 transition-colors shadow-lg shadow-emerald-500/20">
                                Retour à l'accueil
                            </Link>
                        </div>
                    </>
                )}

                {status === 'error' && (
                    <>
                        <div className="text-6xl mb-6">⚠️</div>
                        <h1 className="text-3xl font-bold mb-4">Nous n'avons pas pu valider automatiquement</h1>

                        {errorMessage && errorMessage.includes('email') ? (
                            <div className="bg-gray-800 p-6 rounded-lg mb-6 border border-gray-700">
                                <p className="text-yellow-400 mb-4 font-bold">L'email n'a pas été transmis par Stripe.</p>
                                <p className="text-gray-300 mb-4 text-sm">Entrez votre email ci-dessous pour recevoir vos fichiers immédiatement :</p>
                                <div className="flex gap-2">
                                    <input
                                        type="email"
                                        placeholder="votre@email.com"
                                        className="flex-1 p-3 rounded bg-black border border-gray-600 text-white focus:border-emerald-500 focus:outline-none"
                                        value={manualEmail}
                                        onChange={(e) => setManualEmail(e.target.value)}
                                    />
                                    <button
                                        onClick={handleManualRetry}
                                        disabled={isRetrying || !manualEmail}
                                        className="bg-emerald-500 text-white px-6 py-3 rounded font-bold hover:bg-emerald-600 disabled:opacity-50"
                                    >
                                        {isRetrying ? '...' : 'Envoyer'}
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <p className="text-gray-400 mb-6">
                                Si vous avez bien effectué le paiement, pas d'inquiétude. Notre système va réessayer.
                            </p>
                        )}

                        {errorMessage && (
                            <p className="text-red-400 text-sm mt-2 mb-6 font-mono bg-red-900/20 p-3 rounded border border-red-500/30">
                                Détail technique : {errorMessage}
                            </p>
                        )}
                        <div className="flex flex-col gap-4">
                            <a href="mailto:hello@ai-visionary.com?subject=Problème Paiement AYO (Session Error)"
                                className="inline-block bg-white font-bold py-3 px-8 rounded-full hover:bg-gray-200 transition-colors"
                                style={{ color: '#000000' }}>
                                Contacter le support (Email)
                            </a>
                            <Link href="/" className="text-emerald-400 hover:underline text-sm">
                                Retourner à l'accueil
                            </Link>
                        </div>
                    </>
                )}

            </div>
        </div>
    );
}

export default function SuccessPage() {
    return (
        <Suspense fallback={<div className="min-h-screen bg-black text-white flex items-center justify-center">Chargement...</div>}>
            <SuccessContent />
        </Suspense>
    );
}
