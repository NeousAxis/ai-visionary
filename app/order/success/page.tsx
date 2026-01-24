'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Footer from '../../../components/Footer';

function SuccessContent() {
    const searchParams = useSearchParams();
    const sessionId = searchParams.get('session_id');
    const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
    const [files, setFiles] = useState<{ asr: string, external_context: string } | null>(null);
    const [packType, setPackType] = useState('ESSENTIAL');

    useEffect(() => {
        if (!sessionId) {
            setStatus('error');
            return;
        }

        const fetchOrder = async () => {
            try {
                // On appelle l'API pour récupérer/générer les fichiers basés sur la session
                const res = await fetch('/api/webhooks/checkout-success', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ session_id: sessionId })
                });

                if (res.ok) {
                    const data = await res.json();
                    if (data.files) {
                        setFiles(data.files);
                        setStatus('success');
                        if (data.amount && data.amount >= 499) setPackType('PRO');
                    } else {
                        setStatus('error'); // Paiement ok mais fichiers non générés
                    }
                } else {
                    // Retry logic simple (si le webhook backend est lent)
                    setTimeout(fetchOrder, 2000);
                }
            } catch (e) {
                console.error(e);
                setStatus('error');
            }
        };

        fetchOrder();
    }, [sessionId]);

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

    return (
        <div className="min-h-screen bg-[#0f0518] text-white flex flex-col">
            <header className="p-6 border-b border-white/10 text-center">
                <img src="/logo-v2.png" alt="AI Visionary" className="h-12 mx-auto" />
            </header>

            <main className="flex-1 container mx-auto px-4 py-12 max-w-2xl">
                {status === 'loading' && (
                    <div className="text-center py-20">
                        <div className="w-16 h-16 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-6"></div>
                        <h1 className="text-2xl font-bold mb-2">Finalisation de votre commande...</h1>
                        <p className="text-gray-400">Nous générons vos certificats ASR sécurisés. Cela peut prendre quelques secondes.</p>
                    </div>
                )}

                {status === 'error' && (
                    <div className="text-center py-20 bg-red-900/10 border border-red-500/30 rounded-2xl">
                        <h1 className="text-2xl font-bold text-red-500 mb-2">Une erreur est survenue</h1>
                        <p className="text-gray-400 mb-6">Nous ne parvenons pas à récupérer votre commande automatiquement.</p>
                        <p className="text-sm">Si vous avez été débité, contactez le support : <a href="mailto:hello@ai-visionary.com" className="underline">hello@ai-visionary.com</a></p>
                    </div>
                )}

                {status === 'success' && files && (
                    <div className="animate-fade-in">
                        <div className="text-center mb-10">
                            <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-6 border border-green-500/50">
                                <svg className="w-10 h-10 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                            </div>
                            <h1 className="text-3xl font-bold mb-2">Commande Validée !</h1>
                            <p className="text-gray-300 text-lg">Votre Pack <span className="text-purple-400 font-bold">{packType}</span> est prêt.</p>
                        </div>

                        <div className="bg-white/5 border border-white/10 rounded-2xl p-8 shadow-2xl">
                            <h2 className="text-xl font-bold mb-6 flex items-center gap-3">
                                <svg className="w-6 h-6 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                                Téléchargement de vos fichiers
                            </h2>

                            <div className="space-y-4">
                                <button
                                    onClick={() => downloadFile('asr.json', files.asr)}
                                    className="w-full flex items-center justify-between p-4 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-purple-500/50 rounded-xl transition-all group"
                                >
                                    <div className="flex items-center gap-4">
                                        <div className="bg-purple-500/20 p-2 rounded-lg text-purple-400 font-mono text-sm">JSON</div>
                                        <div className="text-left">
                                            <div className="font-bold text-white group-hover:text-purple-300 transition-colors">Fichier ASR Certifié</div>
                                            <div className="text-xs text-gray-500">asr.json • Identité & Conformité</div>
                                        </div>
                                    </div>
                                    <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                                </button>

                                <button
                                    onClick={() => downloadFile('external_context.json', files.external_context)}
                                    className="w-full flex items-center justify-between p-4 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-blue-500/50 rounded-xl transition-all group"
                                >
                                    <div className="flex items-center gap-4">
                                        <div className="bg-blue-500/20 p-2 rounded-lg text-blue-400 font-mono text-sm">JSON</div>
                                        <div className="text-left">
                                            <div className="font-bold text-white group-hover:text-blue-300 transition-colors">External Context</div>
                                            <div className="text-xs text-gray-500">external_context.json • Signaux Marché</div>
                                        </div>
                                    </div>
                                    <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                                </button>
                            </div>

                            <div className="mt-8 pt-6 border-t border-white/10">
                                <h3 className="text-sm font-bold text-gray-400 uppercase mb-4">Prochaines étapes</h3>
                                <div className="text-sm text-gray-300 space-y-2">
                                    <p>1. Copiez ces fichiers à la racine de votre site (dossier .ayo recommandé).</p>
                                    <p>2. Vous recevrez également une copie par email (vérifiez vos spams).</p>
                                </div>
                            </div>
                        </div>

                        <div className="mt-10 text-center">
                            <Link href="/" className="text-gray-400 hover:text-white underline text-sm">
                                Retour à l'accueil
                            </Link>
                        </div>
                    </div>
                )}
            </main>
            <Footer />
        </div>
    );
}

export default function OrderSuccessPage() {
    return (
        <Suspense fallback={<div className="min-h-screen bg-[#0f0518]"></div>}>
            <SuccessContent />
        </Suspense>
    );
}
