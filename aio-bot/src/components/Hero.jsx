import React, { useState } from 'react';
import { ArrowRight, AppWindow, Globe, Briefcase } from 'lucide-react';

export default function Hero({ onStart }) {
    const [formData, setFormData] = useState({
        companyName: '',
        websiteUrl: '',
        industry: ''
    });

    const handleSubmit = (e) => {
        e.preventDefault();
        if (formData.companyName && formData.websiteUrl) {
            onStart({
                name: formData.companyName,
                url: formData.websiteUrl,
                sector: formData.industry || 'General'
            });
        }
    };

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    return (
        <div className="relative flex flex-col items-center justify-center pt-32 pb-20 px-6">

            <div className="text-center max-w-4xl mx-auto mb-12">
                <div className="inline-flex items-center gap-2 mb-8 border border-indigo-500/30 bg-indigo-500/10 px-4 py-1.5 rounded-full text-indigo-400 text-sm font-medium">
                    <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
                    <span>AYA & AIO : L'Écosystème de la Donnée</span>
                </div>

                <h1 className="text-5xl md:text-7xl font-bold text-white mb-6 leading-tight tracking-tight">
                    Un Internet lisible. <br />
                    <span className="text-indigo-500">Une visibilité durable.</span>
                </h1>

                <p className="text-xl text-slate-400 max-w-2xl mx-auto leading-relaxed">
                    AYA est le moteur de recherche centré sur la qualité. <br className="hidden md:block" />
                    AIO structure vos données pour les rendre intelligibles.
                </p>
            </div>

            {/* Professional Input Card */}
            <div className="w-full max-w-lg card-clean p-1">
                <form onSubmit={handleSubmit} className="bg-transparent p-6 space-y-5">

                    <div className="space-y-4">
                        <div className="group">
                            <label className="block text-xs font-semibold text-slate-500 mb-2 uppercase tracking-wider">Nom de l'entreprise</label>
                            <div className="relative">
                                <AppWindow size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                                <input
                                    type="text"
                                    name="companyName"
                                    required
                                    placeholder="e.g. Acme Innovations"
                                    className="w-full bg-[#1A1D26] border border-[#2E3245] rounded-lg py-3 pl-10 pr-4 text-white text-sm focus:outline-none focus:border-indigo-500 transition-colors placeholder:text-slate-600"
                                    value={formData.companyName}
                                    onChange={handleInputChange}
                                />
                            </div>
                        </div>

                        <div className="group">
                            <label className="block text-xs font-semibold text-slate-500 mb-2 uppercase tracking-wider">URL du site web</label>
                            <div className="relative">
                                <Globe size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                                <input
                                    type="url"
                                    name="websiteUrl"
                                    required
                                    placeholder="https://example.com"
                                    className="w-full bg-[#1A1D26] border border-[#2E3245] rounded-lg py-3 pl-10 pr-4 text-white text-sm focus:outline-none focus:border-indigo-500 transition-colors placeholder:text-slate-600"
                                    value={formData.websiteUrl}
                                    onChange={handleInputChange}
                                />
                            </div>
                        </div>

                        <div className="group">
                            <label className="block text-xs font-semibold text-slate-500 mb-2 uppercase tracking-wider">Secteur d'activité</label>
                            <div className="relative">
                                <Briefcase size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                                <select
                                    name="industry"
                                    className="w-full bg-[#1A1D26] border border-[#2E3245] rounded-lg py-3 pl-10 pr-4 text-white text-sm focus:outline-none focus:border-indigo-500 transition-colors appearance-none cursor-pointer"
                                    value={formData.industry}
                                    onChange={handleInputChange}
                                >
                                    <option value="" disabled className="text-slate-500">Sélectionner un secteur...</option>
                                    <option value="SaaS" className="bg-slate-900">SaaS / Technologie</option>
                                    <option value="E-commerce" className="bg-slate-900">E-commerce</option>
                                    <option value="Finance" className="bg-slate-900">Finance & Fintech</option>
                                    <option value="Healthcare" className="bg-slate-900">Santé</option>
                                    <option value="Local Business" className="bg-slate-900">Commerce Local</option>
                                    <option value="Other" className="bg-slate-900">Autre</option>
                                </select>
                            </div>
                        </div>
                    </div>

                    <button
                        type="submit"
                        className="w-full btn-primary py-4 flex items-center justify-center gap-2 group"
                    >
                        <span>Générer l'audit AIO</span>
                        <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                    </button>

                    <p className="text-center text-xs text-slate-600">
                        100% Automatisé • Pas d'inscription requise
                    </p>

                </form>
            </div>
        </div>
    );
}
