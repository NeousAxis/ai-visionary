import React from 'react';
import { ArrowRight, Globe, Cpu, CheckCircle, Zap, Search, Layers, Leaf } from 'lucide-react';
import Hero from './Hero';
import Navbar from './Navbar';

// --- Shared Components ---

const Section = ({ id, children, className = "" }) => (
    <section id={id} className={`section-spacing px-6 max-w-7xl mx-auto ${className}`}>
        {children}
    </section>
);

const Card = ({ title, children, className = "" }) => (
    <div className={`card-clean p-8 ${className}`}>
        {title && <h3 className="text-xl font-bold text-white mb-4">{title}</h3>}
        <div className="text-slate-300">
            {children}
        </div>
    </div>
);

// --- Sections ---

const Problem = () => (
    <Section id="problem" className="text-center">
        <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">
            Le Web est saturé.
        </h2>
        <p className="text-xl text-slate-400 max-w-3xl mx-auto mb-12">
            Entre contenus automatisés, SEO forcé et données incohérentes, Internet devient illisible.
            Les entreprises de qualité disparaissent dans le bruit.
        </p>
        <div className="grid md:grid-cols-3 gap-6 text-left">
            <Card>
                <div className="text-indigo-400 font-bold mb-2">01. Perte de temps</div>
                <p>Les utilisateurs peinent à trouver des résultats fiables.</p>
            </Card>
            <Card>
                <div className="text-indigo-400 font-bold mb-2">02. Invisibilité</div>
                <p>Les vrais experts sont noyés sous le contenu généré par IA.</p>
            </Card>
            <Card>
                <div className="text-indigo-400 font-bold mb-2">03. Incompréhension</div>
                <p>Les nouveaux moteurs de recherche (LLM) ne lisent pas votre site.</p>
            </Card>
        </div>
    </Section>
);

const Solution = ({ onStartAIO }) => (
    <Section id="solution">
        <div className="mb-16">
            <h2 className="text-3xl md:text-5xl font-bold text-white mb-4">La Solution AIO & AYA</h2>
            <p className="text-slate-400 text-lg">Une infrastructure double pour restaurer la confiance.</p>
        </div>

        <div className="grid md:grid-cols-2 gap-8">
            <Card title="AIO — L’Architecte">
                <p className="mb-6 text-slate-400">
                    AIO analyse et restructure vos données (Produits, Services, FAQ) en un format universel que les machines comprennent parfaitement.
                </p>
                <div className="flex items-center gap-2 text-sm text-indigo-400 font-medium">
                    <Cpu size={18} /> <span>Compatible Schema.org & JSON-LD</span>
                </div>
            </Card>

            <Card title="AYA — Le Moteur">
                <p className="mb-6 text-slate-400">
                    Un index de recherche transparent. Si vos données sont claires et vérifiées, vous êtes visible. Plus de "boîte noire" SEO.
                </p>
                <div className="flex items-center gap-2 text-sm text-teal-400 font-medium">
                    <CheckCircle size={18} /> <span>Indexation Garanti</span>
                </div>
            </Card>
        </div>
    </Section>
);

const Process = () => {
    const steps = [
        { title: "1. Scan", desc: "AYA repère votre site web." },
        { title: "2. Structuration", desc: "AIO organise vos données clés." },
        { title: "3. Indexation", desc: "Votre profil de vérité est créé." },
        { title: "4. Visibilité", desc: "Vous apparaissez enfin clairement." },
    ];

    return (
        <Section id="process">
            <h2 className="text-3xl md:text-5xl font-bold text-white text-center mb-16">Comment ça marche</h2>
            <div className="grid md:grid-cols-4 gap-4">
                {steps.map((s, i) => (
                    <div key={i} className="card-clean p-6 text-center">
                        <div className="text-indigo-500 font-bold text-lg mb-2">{s.title}</div>
                        <p className="text-slate-400 text-sm">{s.desc}</p>
                    </div>
                ))}
            </div>
        </Section>
    );
};

const Features = () => (
    <Section>
        <div className="grid md:grid-cols-4 gap-8 text-center">
            {[
                { icon: Zap, title: "Rapidité", desc: "Des réponses immédiates, sans pollution." },
                { icon: Search, title: "Clarté", desc: "Compréhension parfaite par les IA." },
                { icon: Layers, title: "Standard", desc: "Un format de données universel." },
                { icon: Leaf, title: "Durable", desc: "Moins de requêtes inutiles." }
            ].map((item, i) => (
                <div key={i} className="flex flex-col items-center">
                    <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center text-indigo-400 mb-4 border border-white/10">
                        <item.icon size={24} />
                    </div>
                    <h4 className="font-bold text-white mb-2">{item.title}</h4>
                    <p className="text-slate-500 text-sm">{item.desc}</p>
                </div>
            ))}
        </div>
    </Section>
);

const Pricing = ({ onStartScan }) => (
    <Section id="pricing">
        <h2 className="text-3xl md:text-5xl font-bold text-white text-center mb-16">Offres</h2>
        <div className="grid md:grid-cols-3 gap-8">
            <Card className="border-indigo-500/50">
                <div className="text-indigo-400 text-sm font-bold mb-2">POUR LES SITES</div>
                <h3 className="text-3xl font-bold text-white mb-4">99 CHF</h3>
                <p className="text-sm text-slate-400 mb-6 pb-6 border-b border-white/10">Audit & Optimisation AIO</p>
                <ul className="space-y-3 text-sm mb-8">
                    <li className="flex gap-2"><CheckCircle size={16} className="text-indigo-500" /> Audit Sémantique</li>
                    <li className="flex gap-2"><CheckCircle size={16} className="text-indigo-500" /> Génération JSON-LD</li>
                </ul>
                <button onClick={onStartScan} className="w-full btn-primary">Lancer l'audit</button>
            </Card>

            <Card>
                <div className="text-white text-sm font-bold mb-2">VISIBILITÉ</div>
                <h3 className="text-3xl font-bold text-white mb-4">Gratuit</h3>
                <p className="text-sm text-slate-400 mb-6 pb-6 border-b border-white/10">Indexation dans AYA</p>
                <ul className="space-y-3 text-sm mb-8 text-slate-400">
                    <li className="flex gap-2"><CheckCircle size={16} /> Profil Documentaire</li>
                    <li className="flex gap-2"><CheckCircle size={16} /> Recherche Équitable</li>
                </ul>
                <button className="w-full py-3 rounded-lg border border-white/20 hover:bg-white/5 text-white font-medium transition-colors">Vérifier mon statut</button>
            </Card>

            <Card>
                <div className="text-white text-sm font-bold mb-2">ENTREPRISE</div>
                <h3 className="text-3xl font-bold text-white mb-4">Sur Mesure</h3>
                <p className="text-sm text-slate-400 mb-6 pb-6 border-b border-white/10">Pour les grands comptes</p>
                <ul className="space-y-3 text-sm mb-8 text-slate-400">
                    <li className="flex gap-2"><CheckCircle size={16} /> API Indexation</li>
                    <li className="flex gap-2"><CheckCircle size={16} /> Synchro CRM</li>
                </ul>
                <button className="w-full py-3 rounded-lg border border-white/20 hover:bg-white/5 text-white font-medium transition-colors">Nous contacter</button>
            </Card>
        </div>
    </Section>
);

const Footer = () => (
    <footer className="border-t border-white/10 py-12 bg-[#020202] text-slate-500 text-sm">
        <div className="max-w-7xl mx-auto px-6 grid md:grid-cols-4 gap-8">
            <div className="col-span-1 md:col-span-2">
                <h5 className="text-white font-bold mb-4">AYA & AIO</h5>
                <p className="max-w-xs mb-4">Le standard de données pour l'ère de l'Intelligence Artificielle.</p>
            </div>
            <div>
                <h5 className="text-white font-bold mb-4">Produit</h5>
                <ul className="space-y-2">
                    <li><a href="#" className="hover:text-white">Manifeste</a></li>
                    <li><a href="#" className="hover:text-white">Technologie</a></li>
                </ul>
            </div>
            <div>
                <h5 className="text-white font-bold mb-4">Légal</h5>
                <ul className="space-y-2">
                    <li><a href="#" className="hover:text-white">Mentions Légales</a></li>
                    <li><a href="#" className="hover:text-white">Confidentialité</a></li>
                </ul>
            </div>
        </div>
        <div className="max-w-7xl mx-auto px-6 mt-12 pt-8 border-t border-white/5 text-xs flex justify-between">
            <p>© 2025 AYA Search Console</p>
            <p>Made in Switzerland</p>
        </div>
    </footer>
);

export default function LandingPage({ onStartScan }) {
    return (
        <div className="bg-[#050507] min-h-screen text-slate-300 font-sans">
            <Navbar />
            <div id="hero-form">
                <Hero onStart={onStartScan} />
            </div>

            <Problem />
            <Solution onStartAIO={onStartScan} />
            <Process />
            <Features />
            <Pricing onStartScan={onStartScan} />

            <Section className="text-center py-20">
                <h2 className="text-3xl font-bold text-white mb-8">Prêt à structurer votre avenir ?</h2>
                <button onClick={onStartScan} className="btn-primary text-lg px-8 py-4">Commencer l'audit gratuit</button>
            </Section>

            <Footer />
        </div>
    );
}
