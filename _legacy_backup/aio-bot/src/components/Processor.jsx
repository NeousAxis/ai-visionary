import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, CheckCircle2, Search, Database, Calculator, FileText, Package, Cpu, Terminal, ShieldCheck, Binary } from 'lucide-react';
import { generateAIOReport } from '../utils/generator';

const steps = [
    { id: 1, label: 'Crawling Website Structure...', icon: Search, detail: "Detecting H1, Meta, Schema..." },
    { id: 2, label: 'Querying Public Knowledge Graphs...', icon: Database, detail: "Wikidata, Google KG, OpenStreetMap..." },
    { id: 3, label: 'Evaluating AI Readability...', icon: Binary, detail: "Tokenizing content for LLMs..." },
    { id: 4, label: 'Calculating AIO Score...', icon: Calculator, detail: "Aggregating 30+ data points..." },
    { id: 5, label: 'Generating Optimization Core...', icon: Cpu, detail: "Building JSON-LD & FAQ datasets..." },
    { id: 6, label: 'Finalizing Package...', icon: Package, detail: "Compressing assets..." },
];

const logVariants = {
    initial: { opacity: 0, x: -10 },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0 }
};

export default function Processor({ target, onComplete }) {
    const [currentStep, setCurrentStep] = useState(0);
    const [logs, setLogs] = useState([]);

    useEffect(() => {
        let step = 0;

        const interval = setInterval(() => {
            // Add fake logs for "matrix" feel
            const newLog = `> [${new Date().toLocaleTimeString()}] ${steps[step] ? steps[step].detail : 'Processing...'}`;
            setLogs(prev => [...prev.slice(-4), newLog]);

            step++;
            if (step < steps.length) {
                setCurrentStep(step);
            } else {
                clearInterval(interval);
                setTimeout(() => {
                    generateAIOReport(target.name, target.url, target.sector).then(data => {
                        onComplete(data);
                    });
                }, 1000);
            }
        }, 1500); // Slower, more deliberate pace

        return () => clearInterval(interval);
    }, []);

    return (
        <div className="container flex flex-col items-center justify-center min-h-screen relative overflow-hidden">

            {/* Background Scanning Beam */}
            <motion.div
                initial={{ top: "-10%" }}
                animate={{ top: "110%" }}
                transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                className="absolute left-0 right-0 h-1 bg-primary/50 shadow-[0_0_50px_var(--color-primary)] z-0 pointer-events-none"
            />

            <div className="glass-panel p-8 w-full max-w-2xl relative z-10 grid md:grid-cols-2 gap-8" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '2rem' }}>

                {/* Left Col: Steps */}
                <div className="space-y-6" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    <div className="flex items-center gap-3 mb-4 border-b border-white/10 pb-4">
                        <Loader2 className="animate-spin text-primary" />
                        <h2 className="text-xl font-bold tracking-wide">AIO ENGINE ACTIVE</h2>
                    </div>

                    {steps.map((step, index) => {
                        const Icon = step.icon;
                        const isActive = index === currentStep;
                        const isCompleted = index < currentStep;
                        const isPending = index > currentStep;

                        return (
                            <motion.div
                                key={step.id}
                                initial={{ opacity: 0.5 }}
                                animate={{ opacity: isPending ? 0.3 : 1, x: isActive ? 10 : 0 }}
                                className="flex items-center gap-4"
                                style={{ opacity: isPending ? 0.3 : 1, transform: isActive ? 'translateX(10px)' : 'none', transition: 'all 0.3s ease' }}
                            >
                                <div className={`
                        w-8 h-8 rounded-full flex items-center justify-center border
                        ${isCompleted ? 'bg-green-500/20 border-green-500 text-green-400' :
                                        isActive ? 'bg-primary/20 border-primary text-primary shadow-[0_0_15px_rgba(99,102,241,0.5)]' :
                                            'border-white/10 text-muted'}
                    `} style={{
                                        width: '2rem', height: '2rem', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', borderWidth: '1px',
                                        background: isCompleted ? 'rgba(74, 222, 128, 0.2)' : isActive ? 'rgba(99,102,241,0.2)' : 'transparent',
                                        borderColor: isCompleted ? '#4ade80' : isActive ? 'var(--color-primary)' : 'rgba(255,255,255,0.1)',
                                        color: isCompleted ? '#4ade80' : isActive ? 'var(--color-primary)' : 'var(--color-text-muted)',
                                        boxShadow: isActive ? '0 0 15px rgba(99,102,241,0.5)' : 'none'
                                    }}>
                                    {isCompleted ? <CheckCircle2 size={16} /> : <Icon size={16} />}
                                </div>
                                <div className="flex-1">
                                    <div className={`text-sm font-medium ${isActive ? 'text-white' : 'text-muted'}`}>{step.label}</div>
                                    {isActive && (
                                        <motion.div
                                            layoutId="active-bar"
                                            className="h-0.5 bg-primary mt-1 rounded-full w-full"
                                            initial={{ width: 0 }}
                                            animate={{ width: "100%" }}
                                            transition={{ duration: 1.5 }}
                                            style={{ height: '2px', background: 'var(--color-primary)', borderRadius: '99px' }}
                                        />
                                    )}
                                </div>
                            </motion.div>
                        );
                    })}
                </div>

                {/* Right Col: Terminal Output */}
                <div className="hidden md:flex flex-col rounded-lg bg-black/50 border border-white/10 font-mono text-xs p-4 h-full relative overflow-hidden" style={{ background: 'rgba(0,0,0,0.6)' }}>
                    <div className="flex items-center gap-2 text-muted mb-4 border-b border-white/10 pb-2">
                        <Terminal size={14} />
                        <span>Runtime Logs</span>
                    </div>

                    <div className="space-y-2 flex-1 relative">
                        <AnimatePresence mode='popLayout'>
                            {logs.map((log, i) => (
                                <motion.div
                                    key={i}
                                    variants={logVariants}
                                    initial="initial"
                                    animate="animate"
                                    className="text-primary/80"
                                    style={{ color: 'rgba(99,102,241, 0.8)' }}
                                >
                                    {log}
                                </motion.div>
                            ))}
                        </AnimatePresence>

                        {/* Blinking Cursor */}
                        <motion.div
                            animate={{ opacity: [0, 1, 0] }}
                            transition={{ repeat: Infinity, duration: 0.8 }}
                            className="w-2 h-4 bg-primary mt-2"
                        />
                    </div>

                    {/* Decorative background grid */}
                    <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:20px_20px] pointer-events-none z-0" style={{ backgroundSize: '20px 20px', backgroundImage: 'linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)' }}></div>
                </div>

            </div>
        </div>
    );
}
