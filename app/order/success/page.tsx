'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Footer from '../../components/Footer';

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

        // ⏱️ CLIENT-SIDE SAFETY TIMEOUT (25s)
        const timeout = setTimeout(() => {
            if (status === 'loading') {
                console.warn("Client-side timeout reached");
                setStatus('error');
            }
        }, 25000);

        const fetchOrder = async () => {
            try {
                const res = await fetch('/api/generate-order', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ session_id: sessionId })
                });

                if (res.ok) {
                    const data = await res.json();
                    if (data.files) {
                        setFiles(data.files);
                        setStatus('success');
                        if (data.amount && data.amount >= 450) setPackType('PRO'); // Consistent with API
                    } else {
                        setStatus('error');
                    }
                } else {
                    // Even if API returns 500/504, the email might have been sent
                    setStatus('error');
                }
            } catch (e) {
                console.error("Fetch Error:", e);
                setStatus('error');
            } finally {
                clearTimeout(timeout);
            }
        };

        if (status === 'loading') {
            fetchOrder();
        }

        return () => clearTimeout(timeout);
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
        <div className="min-h-screen bg-[#F5F9F8] text-[#212E53] flex flex-col">
            <header className="p-6 border-b border-[#D4E0DC] text-center bg-white shadow-sm">
                <img src="/logo-v2.png" alt="AI Visionary" className="h-16 mx-auto logo-tinted" />
            </header>

            <main className="flex-1 container mx-auto px-4 py-12 max-w-2xl">
                {status === 'loading' && (
                    <div className="text-center py-20 bg-white border border-[#D4E0DC] rounded-3xl shadow-xl">
                        <div className="w-12 h-12 border-4 border-[#4A919E] border-t-transparent rounded-full animate-spin mx-auto mb-6"></div>
                        <h1 className="text-2xl font-bold mb-2 text-[#212E53]">Génération de vos fichiers...</h1>
                        <p className="text-[#64748B] px-6">L'intelligence artificielle prépare vos certificats personnalisés. Ne fermez pas cette page.</p>
                    </div>
                )}

                {status === 'error' && (
                    <div className="flex-1 flex flex-col justify-center items-center w-full">
                        <div className="bg-white border border-[#D4E0DC] rounded-[2rem] p-12 shadow-2xl text-center max-w-2xl w-full mx-auto relative overflow-hidden">
                            <div className="absolute top-0 left-0 w-full h-2 bg-amber-400"></div>

                            <div className="mb-6 text-6xl">📬</div>

                            <h1 className="text-3xl font-extrabold text-[#212E53] mb-4">
                                Vérifiez vos emails !
                            </h1>

                            <p className="text-[#64748B] text-lg mb-8 leading-relaxed">
                                La génération a pris un peu de temps sur cette page, mais <b>votre pack a probablement déjà été envoyé par email</b> (vérifiez aussi vos spams).
                            </p>

                            <div className="flex flex-col gap-6 items-center w-full">
                                <button
                                    onClick={() => window.location.reload()}
                                    className="px-10 py-4 bg-[#4A919E] text-white font-bold rounded-full hover:bg-[#356D76] transition-all shadow-lg flex items-center justify-center gap-2"
                                >
                                    <span>🔄</span> Réessayer d'afficher ici
                                </button>

                                <div className="pt-8 border-t border-slate-100 w-full">
                                    <p className="text-[10px] text-[#94A3B8] font-bold uppercase tracking-widest mb-2">Référence de Commande</p>
                                    <code className="text-xs bg-slate-50 p-3 rounded-lg block mb-4 border border-slate-100 select-all font-mono">{sessionId}</code>
                                    <p className="text-sm text-slate-500">
                                        Un problème ? Contactez-nous : <br />
                                        <a href={`mailto:hello@ai-visionary.com?subject=Support ${sessionId}`} className="text-[#4A919E] font-bold underline decoration-2 underline-offset-4">
                                            hello@ai-visionary.com
                                        </a>
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {status === 'success' && files && (
                    <div className="animate-fade-in">
                        <div className="text-center mb-10">
                            <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-6 border border-emerald-200 shadow-md">
                                <svg className="w-10 h-10 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                            </div>
                            <h1 className="text-4xl font-extrabold mb-2 text-[#212E53]">Commande Validée !</h1>
                            <p className="text-[#324066] text-xl">Votre Pack <span className="text-[#4A919E] font-bold">{packType}</span> est prêt.</p>
                        </div>

                        <div className="bg-white border border-[#D4E0DC] rounded-2xl p-8 shadow-lg">
                            <h2 className="text-xl font-bold mb-6 flex items-center gap-3 text-[#212E53]">
                                <svg className="w-6 h-6 text-[#4A919E]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                                Téléchargement de vos fichiers
                            </h2>

                            <div className="space-y-4">
                                <button
                                    onClick={() => downloadFile('asr.json', files.asr)}
                                    className="w-full flex items-center justify-between p-5 bg-[#F8FAFC] hover:bg-[#F1F5F9] border border-[#E2E8F0] hover:border-[#4A919E] rounded-xl transition-all group duration-200"
                                >
                                    <div className="flex items-center gap-4">
                                        <div className="bg-[#4A919E]/10 p-3 rounded-lg text-[#4A919E] font-mono text-sm font-bold border border-[#4A919E]/20">JSON</div>
                                        <div className="text-left">
                                            <div className="font-bold text-[#212E53] group-hover:text-[#4A919E] transition-colors text-lg">Fichier ASR Certifié</div>
                                            <div className="text-sm text-[#64748B]">asr.json • Identité & Conformité</div>
                                        </div>
                                    </div>
                                    <div className="w-10 h-10 rounded-full bg-white border border-[#E2E8F0] flex items-center justify-center group-hover:border-[#4A919E] group-hover:bg-[#4A919E] transition-all">
                                        <svg className="w-5 h-5 text-[#64748B] group-hover:text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                                    </div>
                                </button>

                                <button
                                    onClick={() => downloadFile('external_context.json', files.external_context)}
                                    className="w-full flex items-center justify-between p-5 bg-[#F8FAFC] hover:bg-[#F1F5F9] border border-[#E2E8F0] hover:border-[#3B82F6] rounded-xl transition-all group duration-200"
                                >
                                    <div className="flex items-center gap-4">
                                        <div className="bg-blue-50 p-3 rounded-lg text-blue-600 font-mono text-sm font-bold border border-blue-100">JSON</div>
                                        <div className="text-left">
                                            <div className="font-bold text-[#212E53] group-hover:text-blue-600 transition-colors text-lg">External Context</div>
                                            <div className="text-sm text-[#64748B]">external_context.json • Signaux Marché</div>
                                        </div>
                                    </div>
                                    <div className="w-10 h-10 rounded-full bg-white border border-[#E2E8F0] flex items-center justify-center group-hover:border-blue-500 group-hover:bg-blue-500 transition-all">
                                        <svg className="w-5 h-5 text-[#64748B] group-hover:text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                                    </div>
                                </button>
                            </div>

                            <div className="mt-8 pt-6 border-t border-[#E2E8F0]">
                                <h3 className="text-xs font-bold text-[#94A3B8] uppercase mb-4 tracking-wider">Prochaines étapes</h3>
                                <div className="text-sm text-[#475569] space-y-2 bg-[#F1F5F9] p-4 rounded-lg border border-[#E2E8F0]">
                                    <p className="flex items-start gap-2"><span className="text-[#4A919E] font-bold">1.</span> Copiez ces fichiers à la racine de votre site (dossier .ayo recommandé).</p>
                                    <p className="flex items-start gap-2"><span className="text-[#4A919E] font-bold">2.</span> Vous recevrez également une copie par email (vérifiez vos spams).</p>
                                </div>
                            </div>
                        </div>

                        <div className="mt-10 text-center">
                            <Link href="/" className="text-[#64748B] hover:text-[#4A919E] font-medium transition-colors">
                                ← Retour à l'accueil
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
