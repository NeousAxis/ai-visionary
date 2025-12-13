import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Download, RefreshCw, AlertTriangle, Check, Copy, ChevronDown, ChevronUp, Share2 } from 'lucide-react';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';

// Stagger variants for the dashboard
const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
        opacity: 1,
        transition: {
            staggerChildren: 0.1
        }
    }
};

const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: { y: 0, opacity: 1 }
};

export default function Dashboard({ data, target, onReset }) {
    const [activeTab, setActiveTab] = useState('overview'); // overview, actions, content

    const downloadZip = async () => {
        const zip = new JSZip();
        const folder = zip.folder("aio-ready-package");

        // Add Report
        folder.file("aio-report.json", JSON.stringify(data, null, 2));

        // Add Content
        folder.file("json-ld-schema.json", data.content.jsonLd);

        // FAQ
        let faqText = "# AI Optimized FAQ\n\n";
        data.content.faq.forEach(item => faqText += `Q: ${item.q}\nA: ${item.a}\n\n`);
        folder.file("faq.md", faqText);

        // Glossary
        let glossaryText = "# AI Glossary\n\n";
        data.content.glossary.forEach(item => glossaryText += `**${item.term}**: ${item.def}\n\n`);
        folder.file("glossary.md", glossaryText);

        // Descriptions
        let descText = "# Brand Descriptions\n\n";
        descText += `## Short\n${data.content.descriptions.short}\n\n`;
        descText += `## Standard\n${data.content.descriptions.standard}\n\n`;
        descText += `## Long\n${data.content.descriptions.long}\n\n`;
        folder.file("descriptions.md", descText);

        // Generate
        const content = await zip.generateAsync({ type: "blob" });
        saveAs(content, `${target.name.replace(/\s+/g, '-').toLowerCase()}-aio-package.zip`);
    };

    const scoreData = [
        { name: 'Readability', value: data.scores.readability, full: 40 },
        { name: 'Credibility', value: data.scores.credibility, full: 30 },
        { name: 'Authority', value: data.scores.authority, full: 30 },
    ];

    return (
        <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="container min-h-screen py-8"
        >
            {/* Header */}
            <motion.div variants={itemVariants} className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2rem' }}>
                <div>
                    <h1 className="text-3xl font-bold mb-2">{target.name} <span className="title-gradient">Report</span></h1>
                    <p className="text-muted flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></span>
                        {target.url}
                    </p>
                </div>
                <div className="flex gap-4" style={{ display: 'flex', gap: '1rem' }}>
                    <button onClick={onReset} className="glass-panel px-4 py-2 flex items-center gap-2 hover:bg-white/5 transition text-sm" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', color: '#9ca3af' }}>
                        <RefreshCw size={16} /> New Analysis
                    </button>
                    <button onClick={downloadZip} className="btn-primary flex items-center gap-2 hover:scale-105 active:scale-95 transition-transform" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                        <Download size={18} /> Download Package
                    </button>
                </div>
            </motion.div>

            {/* Main Grid */}
            <div className="grid-cols-2 mb-8">

                {/* Score Card - Animated */}
                <motion.div variants={itemVariants} className="glass-panel p-6 flex flex-col items-center justify-center relative overflow-hidden group">
                    {/* Background glow on hover */}
                    <div className="absolute inset-0 bg-primary/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>

                    <h2 className="text-xl font-semibold mb-6 absolute top-6 left-6 flex items-center gap-2">
                        AIO Score
                        <span className="text-xs px-2 py-0.5 rounded bg-white/10 text-muted font-normal">Beta</span>
                    </h2>

                    <div className="relative w-64 h-64 flex items-center justify-center my-4">
                        {/* Chart */}
                        <svg width="200" height="200" viewBox="0 0 100 100" className="transform -rotate-90 origin-center transition-all duration-1000">
                            <circle cx="50" cy="50" r="45" fill="none" stroke="#1e293b" strokeWidth="6" />
                            <motion.circle
                                initial={{ pathLength: 0 }}
                                animate={{ pathLength: data.scores.total / 100 }}
                                transition={{ duration: 1.5, ease: "easeOut" }}
                                cx="50" cy="50" r="45" fill="none" stroke="url(#gradient)" strokeWidth="6"
                                strokeLinecap="round"
                            />
                            <defs>
                                <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                                    <stop offset="0%" stopColor="#6366f1" />
                                    <stop offset="100%" stopColor="#ec4899" />
                                </linearGradient>
                            </defs>
                        </svg>
                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                            <motion.span
                                initial={{ scale: 0.5, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                transition={{ delay: 0.5, type: "spring" }}
                                className="text-6xl font-bold tracking-tighter"
                            >
                                {data.scores.total}
                            </motion.span>
                            <span className="text-sm text-muted">/ 100</span>
                        </div>
                    </div>

                    <div className="w-full mt-2 space-y-4 px-8">
                        {scoreData.map((s, i) => (
                            <motion.div
                                key={s.name}
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: 0.8 + (i * 0.1) }}
                                className="flex justify-between items-center text-sm"
                                style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}
                            >
                                <span className="text-muted">{s.name}</span>
                                <div className="flex-1 mx-4 h-1.5 bg-slate-800 rounded-full overflow-hidden" style={{ flex: 1, margin: '0 1rem', height: '0.375rem', background: '#1e293b', borderRadius: '999px' }}>
                                    <motion.div
                                        initial={{ width: 0 }}
                                        animate={{ width: `${(s.value / s.full) * 100}%` }}
                                        transition={{ duration: 1, delay: 1 }}
                                        className="h-full bg-gradient-to-r from-primary to-purple-500"
                                        style={{ background: 'linear-gradient(to right, var(--color-primary), #a855f7)' }}
                                    />
                                </div>
                                <span className="w-8 text-right font-medium">{s.value}</span>
                            </motion.div>
                        ))}
                    </div>
                </motion.div>

                {/* Quick Actions / Priority - Animated */}
                <motion.div variants={itemVariants} className="glass-panel p-6 flex flex-col">
                    <h2 className="text-xl font-semibold mb-6 flex items-center gap-2">
                        <AlertTriangle size={20} className="text-red-400" />
                        Critical Corrections
                    </h2>
                    <div className="space-y-3 flex-1 overflow-auto custom-scrollbar" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                        {data.actionPlan.slice(0, 3).map((action, idx) => (
                            <motion.div
                                key={action.id}
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: 0.5 + (idx * 0.1) }}
                                className="p-4 rounded-lg bg-surface/50 border border-red-500/10 hover:bg-surface transition-colors cursor-pointer group"
                                style={{ background: 'rgba(255,255,255,0.02)', padding: '1rem', borderRadius: '0.5rem', border: '1px solid rgba(239, 68, 68, 0.1)' }}
                                onClick={() => setActiveTab('actions')}
                            >
                                <div className="flex justify-between items-start mb-1">
                                    <h3 className="font-semibold text-red-100 group-hover:text-red-400 transition-colors">{action.title}</h3>
                                    <span className="text-[10px] uppercase tracking-wider bg-red-500/20 text-red-300 px-2 py-0.5 rounded">
                                        {action.priority}
                                    </span>
                                </div>
                                <p className="text-sm text-muted line-clamp-2">{action.description}</p>
                            </motion.div>
                        ))}
                    </div>

                    <button onClick={() => setActiveTab('actions')} className="mt-4 w-full py-3 rounded-lg border border-white/5 hover:bg-white/5 transition text-sm text-center text-muted hover:text-white" style={{ marginTop: '1rem' }}>
                        View all corrections
                    </button>
                </motion.div>

            </div>

            {/* Tabs */}
            <motion.div variants={itemVariants} className="mb-6 border-b border-white/10 flex gap-8" style={{ marginBottom: '1.5rem', borderBottom: '1px solid rgba(255,255,255,0.1)', display: 'flex', gap: '2rem' }}>
                {['overview', 'actions', 'content'].map(tab => (
                    <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        className="pb-3 relative text-sm font-medium capitalize transition focus:outline-none"
                        style={{
                            paddingBottom: '0.75rem',
                            color: activeTab === tab ? 'var(--color-primary)' : 'var(--color-text-muted)'
                        }}
                    >
                        {tab}
                        {activeTab === tab && (
                            <motion.div
                                layoutId="activeTab"
                                className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary shadow-[0_0_10px_var(--color-primary)]"
                            />
                        )}
                    </button>
                ))}
            </motion.div>

            {/* Tab Content */}
            <AnimatePresence mode="wait">
                <motion.div
                    key={activeTab}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.2 }}
                >
                    {activeTab === 'overview' && (
                        <div className="glass-panel p-8">
                            <div className="max-w-3xl">
                                <h3 className="text-lg font-semibold mb-4 text-white">Executive Summary</h3>
                                <p className="text-muted leading-relaxed text-lg">
                                    The analysis indicates that <strong className="text-white">{target.name}</strong> has a solid technical foundation but lacks the semantic infrastructure required for modern AI search engines.
                                    With an AIO Score of <strong className={`text-${data.scores.total > 50 ? 'primary' : 'red-400'}`}>{data.scores.total}/100</strong>,
                                    it is likely that agents like ChatGPT or Gemini are hallucinating key details about your services due to missing <span className="text-secondary">structured entities</span>.
                                </p>
                            </div>
                            <div className="mt-8 grid grid-cols-2 md:grid-cols-4 gap-4" style={{ marginTop: '2rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                                <StatBox label="JSON-LD Status" value={data.raw.technical.jsonLd ? "Present" : "Missing"} color={data.raw.technical.jsonLd ? "text-green-400" : "text-red-400"} delay={0} />
                                <StatBox label="Mobile Ready" value={data.raw.technical.mobileFriendly ? "Yes" : "No"} color="text-green-400" delay={0.1} />
                                <StatBox label="Speed Score" value={data.raw.technical.speedScore} delay={0.2} />
                                <StatBox label="HTTPS" value="Secure" color="text-green-400" delay={0.3} />
                            </div>
                        </div>
                    )}

                    {activeTab === 'actions' && (
                        <div className="space-y-4" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            {data.actionPlan.map((action, idx) => (
                                <motion.div
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: idx * 0.05 }}
                                    key={idx}
                                    className="glass-panel p-6 flex gap-6 items-start group hover:border-primary/30 transition-all cursor-default"
                                    style={{ padding: '1.5rem', display: 'flex', gap: '1.5rem', alignItems: 'flex-start' }}
                                >
                                    <div className="bg-primary/10 p-3 rounded-lg text-primary mt-1 group-hover:bg-primary group-hover:text-white transition-colors" style={{ background: 'rgba(99,102,241,0.1)', borderRadius: '0.5rem', color: 'var(--color-primary)' }}>
                                        <span className="font-bold font-mono text-lg">0{idx + 1}</span>
                                    </div>
                                    <div className="flex-1">
                                        <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                                            <h4 className="font-semibold text-lg text-white">{action.title}</h4>
                                            <div className="flex gap-2">
                                                <span className={`text-[10px] uppercase font-bold px-2 py-1 rounded bg-white/5 border border-white/10 ${action.priority === 'Critical' ? 'text-red-400 border-red-500/20' : 'text-primary border-primary/20'}`}>{action.priority}</span>
                                            </div>
                                        </div>
                                        <p className="text-muted leading-relaxed">{action.description}</p>
                                    </div>
                                </motion.div>
                            ))}
                        </div>
                    )}

                    {activeTab === 'content' && (
                        <div className="grid-cols-2">
                            <ContentBlock title="JSON-LD Schema (Organization)" content={data.content.jsonLd} lang="json" />
                            <ContentBlock title="Optimized Description (Standard)" content={data.content.descriptions.standard} />

                            <div className="glass-panel p-6 col-span-2 space-y-6" style={{ gridColumn: 'span 2' }}>
                                <div className="flex items-center justify-between">
                                    <h3 className="text-lg font-semibold">AI-Ready FAQ Dataset</h3>
                                    <span className="text-xs text-muted uppercase tracking-wider border border-white/10 px-2 py-1 rounded">Format: Q&A Pairs</span>
                                </div>

                                <div className="grid md:grid-cols-2 gap-4">
                                    {data.content.faq.map((item, i) => (
                                        <div key={i} className="bg-white/5 p-4 rounded-lg border border-white/5 hover:border-primary/30 transition-colors">
                                            <p className="font-medium text-primary mb-2 text-sm">Q: {item.q}</p>
                                            <p className="text-muted text-sm leading-relaxed">A: {item.a}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}
                </motion.div>
            </AnimatePresence>

        </motion.div>
    );
}

function StatBox({ label, value, color = "text-white", delay }) {
    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: delay }}
            className="glass-panel p-4 text-center hover:bg-white/5 transition-colors"
            style={{ padding: '1rem', textAlign: 'center' }}
        >
            <div className="text-xs text-muted uppercase tracking-wider mb-2">{label}</div>
            <div className={`text-2xl font-bold ${color}`} style={{ color: color.startsWith('text-') ? undefined : color }}>{value}</div>
        </motion.div>
    );
}

function ContentBlock({ title, content, lang }) {
    const [copied, setCopied] = useState(false);
    const handleCopy = () => {
        navigator.clipboard.writeText(content);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className="glass-panel p-0 overflow-hidden flex flex-col h-full group" style={{ padding: 0, display: 'flex', flexDirection: 'column', height: '100%' }}>
            <div className="bg-black/20 p-3 flex justify-between items-center border-b border-white/5" style={{ background: 'rgba(0,0,0,0.2)', padding: '0.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-secondary"></div>
                    <span className="font-medium text-sm text-gray-300">{title}</span>
                </div>
                <button onClick={handleCopy} className="text-muted hover:text-white transition bg-white/5 p-1.5 rounded hover:bg-primary/20" style={{ cursor: 'pointer', color: 'var(--color-text-muted)' }}>
                    {copied ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
                </button>
            </div>
            <div className="p-4 bg-[rgba(10,10,10,0.5)] flex-1 overflow-auto max-h-64 custom-scrollbar" style={{ padding: '1rem', flex: 1, overflow: 'auto', maxHeight: '16rem' }}>
                <pre className="text-xs text-gray-400 whitespace-pre-wrap font-mono leading-relaxed" style={{ fontFamily: 'monospace', fontSize: '0.75rem', whiteSpace: 'pre-wrap' }}>
                    {content}
                </pre>
            </div>
        </div>
    );
}
