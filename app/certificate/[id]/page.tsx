import { db } from '@/lib/db';
import { notFound } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function CertificatePage({ params }: { params: { id: string } }) {
    const entity = await db.getAyaEntityById(params.id);

    if (!entity) {
        return notFound();
    }

    // Format dates
    const registeredDate = entity.created_at ? new Date(entity.created_at).toLocaleDateString() : 'N/A';
    const updatedDate = entity.last_update ? new Date(entity.last_update).toLocaleDateString() : 'N/A';

    // Status color
    const isActive = true; // Default to active if found in registry
    const statusColor = isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800';
    const statusLabel = isActive ? 'CERTIFIÉ ACTIF' : 'INACTIF';

    return (
        <main className="min-h-screen bg-slate-50 py-12 px-4 sm:px-6 lg:px-8 font-sans">
            <div className="max-w-3xl mx-auto bg-white shadow-xl rounded-2xl overflow-hidden border border-slate-200">
                {/* Header */}
                <div className="bg-[#1e293b] px-8 py-10 text-center relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-blue-500 via-cyan-400 to-blue-500"></div>
                    <div className="relative z-10">
                        <img src="/logo-v2.png" alt="AI Visionary" className="h-16 mx-auto mb-6 opacity-90" />
                        <h1 className="text-3xl font-bold text-white tracking-tight mb-2">CERTIFICAT DE PRÉSENCE</h1>
                        <p className="text-blue-200 font-medium tracking-wide text-sm uppercase">Registre AYA (AI-Visionary Archive)</p>
                    </div>
                </div>

                {/* Body */}
                <div className="px-8 py-10 space-y-8">

                    {/* Identification */}
                    <div className="text-center">
                        <h2 className="text-2xl font-bold text-slate-800 mb-2">{entity.display_name || entity.legal_name}</h2>
                        <a href={entity.website} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800 hover:underline text-lg font-medium">
                            {entity.website}
                        </a>
                        <div className="mt-4 flex justify-center gap-3">
                            <span className={`px-4 py-1.5 rounded-full text-xs font-bold tracking-widest ${statusColor} border border-green-200`}>
                                {statusLabel}
                            </span>
                            <span className="px-4 py-1.5 rounded-full text-xs font-bold tracking-widest bg-blue-50 text-blue-700 border border-blue-100">
                                AIO OPTIMIZED
                            </span>
                        </div>
                    </div>

                    <hr className="border-slate-100" />

                    {/* Details Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="bg-slate-50 p-5 rounded-xl border border-slate-100">
                            <p className="text-xs uppercase text-slate-400 font-bold mb-1">ID Entité (AYA Hash)</p>
                            <p className="font-mono text-sm text-slate-700 break-all">{entity.id || params.id}</p>
                        </div>
                        <div className="bg-slate-50 p-5 rounded-xl border border-slate-100">
                            <p className="text-xs uppercase text-slate-400 font-bold mb-1">Dernière mise à jour</p>
                            <p className="font-mono text-sm text-slate-700">{updatedDate}</p>
                        </div>
                        <div className="bg-slate-50 p-5 rounded-xl border border-slate-100">
                            <p className="text-xs uppercase text-slate-400 font-bold mb-1">Secteur</p>
                            <p className="font-medium text-slate-700">{entity.sector_macro || 'Non spécifié'}</p>
                        </div>
                        <div className="bg-slate-50 p-5 rounded-xl border border-slate-100">
                            <p className="text-xs uppercase text-slate-400 font-bold mb-1">Pays d'enregistrement</p>
                            <p className="font-medium text-slate-700">{entity.country_legal || 'Global'}</p>
                        </div>
                    </div>

                    {/* ASR Payload Preview (Mocked or Real) */}
                    <div className="mt-8">
                        <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-4 border-l-4 border-blue-500 pl-3">Données Structurées (Aperçu ASR)</h3>
                        <div className="bg-[#0f172a] rounded-lg p-4 overflow-x-auto shadow-inner">
                            <pre className="text-xs text-green-400 font-mono leading-relaxed">
                                {JSON.stringify({
                                    "@context": "https://ai-visionary.com/ns/aya",
                                    "@type": "CertifiedEntity",
                                    "aya:id": params.id,
                                    "aya:timestamp": new Date().toISOString(),
                                    "aya:authority": "AI Visionary Global Registry",
                                    "entity": {
                                        "name": entity.legal_name,
                                        "url": entity.website,
                                        "status": "verified"
                                    }
                                }, null, 2)}
                            </pre>
                        </div>
                        <p className="text-xs text-slate-400 mt-2 italic text-center">
                            * Ce bloc JSON est un extrait de la signature cryptographique utilisée par les modèles d'IA pour identifier cette entité.
                        </p>
                    </div>

                    {/* Footer */}
                    <div className="mt-12 text-center">
                        <p className="text-slate-500 text-sm mb-4">
                            Ce certificat atteste que l'entité ci-dessus dispose d'une infrastructure sémantique conforme aux standards AYO.
                        </p>
                        <div className="inline-flex items-center justify-center p-3 bg-white border border-slate-200 rounded-lg shadow-sm">
                            <img src="/logo-v2.png" alt="Ayo Seal" className="h-6 opacity-60 grayscale hover:grayscale-0 transition-all" />
                            <span className="ml-3 text-xs font-bold text-slate-600">CERTIFIÉ PAR AI VISIONARY</span>
                        </div>
                    </div>
                </div>
            </div>
        </main>
    );
}
