"use client";

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';

function SuccessContent() {
    const searchParams = useSearchParams();
    const sessionId = searchParams.get('session_id');
    const [isProcessing, setIsProcessing] = useState(true);

    useEffect(() => {
        if (!sessionId) return;

        // Déclenchement discret de la génération (API)
        // On ne bloque pas l'utilisateur s'il veut partir, mais on assure le coup.
        const triggerGeneration = async () => {
            try {
                await fetch('/api/webhooks/checkout-success', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ session_id: sessionId })
                });
                setIsProcessing(false);
            } catch (e) {
                console.error(e);
                setIsProcessing(false);
            }
        };

        triggerGeneration();
    }, [sessionId]);

    return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-[#0a0a0a] text-white p-6 font-sans">
            <div className="max-w-md w-full text-center space-y-8">

                {/* Icône de Validation Simple */}
                <div className="w-20 h-20 mx-auto rounded-full bg-green-900/30 border border-green-500/50 flex items-center justify-center">
                    <svg className="w-10 h-10 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"></path>
                    </svg>
                </div>

                <div className="space-y-4">
                    <h1 className="text-3xl font-bold tracking-tight">Paiement Validé</h1>
                    <p className="text-gray-400 text-lg">
                        Votre commande est bien enregistrée.
                    </p>
                </div>

                {/* Bloc d'info Email */}
                <div className="bg-white/5 border border-white/10 rounded-lg p-6 text-left">
                    <div className="flex gap-4">
                        <div className="text-2xl">📧</div>
                        <div>
                            <h3 className="font-semibold text-white">Vérifiez vos emails</h3>
                            <p className="text-sm text-gray-400 mt-1">
                                Vos fichiers ASR et votre certification ont été envoyés à l'adresse indiquée lors du paiement.
                            </p>
                        </div>
                    </div>
                </div>

                {/* Bouton Simple de Retour */}
                <div className="pt-4">
                    <Link
                        href="/"
                        className="inline-flex items-center justify-center px-8 py-3 text-sm font-medium text-white bg-white/10 border border-white/10 rounded-full hover:bg-white/20 transition-all"
                    >
                        ← Retour sur ai-visionary.com
                    </Link>
                </div>
            </div>
        </div>
    );
}

export default function SuccessPage() {
    return (
        <Suspense fallback={<div className="min-h-screen bg-[#0a0a0a]" />}>
            <SuccessContent />
        </Suspense>
    );
}
