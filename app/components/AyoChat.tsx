'use client';

import { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';

interface AyoChatProps {
    mode?: 'widget' | 'fullscreen';
}

interface QuestionBlock {
    type: 'question_block';
    intro?: string;
    questions: {
        id: string;
        text: string;
        options: string[];
        allowCustom?: boolean;
        customLabel?: string;
    }[];
}

export default function AyoChat({ mode = 'widget' }: AyoChatProps) {
    // UI State
    const [messages, setMessages] = useState<any[]>([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Widget Specific State
    const [isOpen, setIsOpen] = useState(mode === 'fullscreen');

    const [hasGreeted, setHasGreeted] = useState(false);
    const [isAnalyzing, setIsAnalyzing] = useState(false);

    const messagesEndRef = useRef<HTMLDivElement>(null);

    // Auto-scroll helper
    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages, isLoading, isOpen]);

    // Initial greeting
    useEffect(() => {
        if ((isOpen || mode === 'fullscreen') && !hasGreeted && messages.length === 0) {
            setHasGreeted(true);
        }
    }, [isOpen, hasGreeted, messages.length, mode]);

    // MANUAL FETCH implementation (Bypassing SDK hook to guarantee sending works)
    const handleSubmit = async (e?: React.FormEvent, overrideInput?: string) => {
        if (e) e.preventDefault();

        const textToSend = overrideInput || input;
        if (!textToSend.trim() || isLoading) return;

        const userMessage = { role: 'user', content: textToSend };

        // 1. Optimistic update
        setMessages(prev => [...prev, { ...userMessage, id: Date.now().toString() }]);
        setInput('');
        setIsLoading(true);
        setError(null);

        const INITIAL_BOT_MESSAGE = {
            role: 'assistant',
            content: `👋 Bonjour, ici AYO. Initialisation du protocole AIO Light.

Je vais établir votre Diagnostic de Visibilité IA (Gratuit).
Pour cela, indiquez-moi simplement l'URL principale de votre site web.

1. Quelle est votre URL ?`
        };

        try {
            // 2. Manual Network Request
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    messages: [INITIAL_BOT_MESSAGE, ...messages, userMessage]
                })
            });

            if (!response.ok) {
                let errorDetails = `Erreur ${response.status}`;
                try {
                    const errorJson = await response.json();
                    if (errorJson.error) errorDetails = errorJson.error;
                } catch (e) {
                    // Ignore parsing error, stick to status code
                }
                throw new Error(errorDetails);
            }

            // 3. READ JSON RESPONSE
            const data = await response.json();

            if (!data.text) throw new Error("Réponse vide de l'IA");

            // CHECK FOR PROGRESSIVE CONTENT (Analysis split by |||)
            if (data.text.includes('|||')) {
                const chunks = data.text.split('|||');
                setIsLoading(false); // Stop standard loading
                setIsAnalyzing(true); // Start analysis mode

                // Helper to add message interactively
                const addChunk = (content: string, delay: number) => {
                    return new Promise<void>(resolve => {
                        setTimeout(() => {
                            setMessages(prev => [...prev, {
                                role: 'assistant',
                                content: content.trim(),
                                id: Date.now().toString() + Math.random() // Unique ID
                            }]);
                            resolve();
                        }, delay);
                    });
                };

                // Display all chunks sequentially with 9s delay each
                for (const chunk of chunks) {
                    if (chunk && chunk.trim()) {
                        await addChunk(chunk, 9000);
                    }
                }

                setIsAnalyzing(false);

            } else {
                // NORMAL FAST RESPONSE (Might be JSON QCM or Text)
                const botMessageId = (Date.now() + 1).toString();
                setMessages(prev => [...prev, { role: 'assistant', content: data.text, id: botMessageId }]);
                setIsLoading(false);
            }

        } catch (err: any) {
            console.error("Manual Fetch Error:", err);
            setError(err.message || "Erreur de connexion");
            setIsLoading(false);
            setIsAnalyzing(false);
        }
    };

    // Helper to render message content (Text or QCM JSON)
    const renderMessageContent = (msg: any) => {
        // Try to parse JSON if it looks like JSON
        let qcmData: QuestionBlock | null = null;
        if (msg.role === 'assistant' && (msg.content.trim().startsWith('{') || msg.content.includes('```json'))) {
            try {
                const cleanJson = msg.content.replace(/```json/g, '').replace(/```/g, '').trim();
                const parsed = JSON.parse(cleanJson);
                if (parsed.type === 'question_block') {
                    qcmData = parsed;
                }
            } catch (e) {
                // Not valid JSON, treat as text
            }
        }

        if (qcmData) {
            return (
                <div className="ay-qcm-container">
                    {qcmData.intro && (
                        <p className="mb-4 font-semibold text-teal-800">{qcmData.intro}</p>
                    )}

                    <div className="flex flex-col gap-6">
                        {qcmData.questions.map((q, idx) => (
                            <div key={q.id || idx} className="qcm-question-box p-4 bg-white/50 rounded-lg border border-slate-200">
                                <p className="mb-3 font-bold text-slate-800">{q.text}</p>
                                <div className="qcm-options-grid grid grid-cols-1 sm:grid-cols-2 gap-2">
                                    {q.options.map((opt, i) => (
                                        <button
                                            key={i}
                                            onClick={() => !isLoading && handleSubmit(undefined, `${q.text} : ${opt}`)}
                                            className="qcm-btn hover:bg-teal-50 text-left px-4 py-3 rounded border border-slate-300 transition-colors text-sm font-medium text-slate-700 hover:border-teal-500 hover:text-teal-700"
                                            disabled={isLoading}
                                        >
                                            {opt}
                                        </button>
                                    ))}
                                    {q.allowCustom && (
                                        <button
                                            onClick={() => setInput(`${q.text} : `)} // Prefill input for custom
                                            className="qcm-btn hover:bg-amber-50 text-left px-4 py-3 rounded border border-dashed border-slate-400 transition-colors text-sm text-slate-600 italic"
                                        >
                                            ✏️ {q.customLabel || "Autre / Préciser..."}
                                        </button>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            );
        }

        // Default Markdown Render
        return (
            <div className="markdown-content">
                <ReactMarkdown
                    components={{
                        a: ({ node, ...props }) => (
                            <a {...props} target="_blank" rel="noopener noreferrer" style={{ color: msg.role === 'user' ? 'white' : 'blue', textDecoration: 'underline' }} />
                        )
                    }}
                >
                    {msg.content}
                </ReactMarkdown>
            </div>
        );
    };

    // If Fullscreen, we render the "App Frame". If Widget, we render the floating logic.
    const isFullscreen = mode === 'fullscreen';

    return (
        <div className={isFullscreen ? 'ayo-chat-container' : `ayo-widget ${isOpen ? 'open' : ''}`}>

            {/* Header only for Widget or Fullscreen Title */}
            <div className="chat-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#4A919E' }}></div>
                    <h4 style={{ margin: 0, color: 'var(--text-main)' }}>AYO Assistant IA</h4>
                </div>
                {!isFullscreen && (
                    <button onClick={() => setIsOpen(false)} style={{ background: 'none', border: 'none', fontSize: '1.2rem', cursor: 'pointer', color: 'var(--text-main)' }}>✕</button>
                )}
            </div>

            <div className="chat-messages-area">
                <div className="msg-bubble msg-ai">
                    👋 Bonjour, ici AYO. Initialisation du protocole AIO Light.<br /><br />
                    Je vais établir votre <strong>Diagnostic de Visibilité IA (Gratuit)</strong>.<br />
                    Pour cela, indiquez-moi simplement l'URL principale de votre site web.<br /><br />
                    <strong>1. Quelle est votre URL ?</strong>
                </div>

                {messages.map((m) => (
                    <div
                        key={m.id}
                        className={`msg-bubble ${m.role === 'user' ? 'msg-user' : 'msg-ai'}`}
                    >
                        {renderMessageContent(m)}
                    </div>
                ))}

                {isLoading && (
                    <div className="msg-bubble msg-ai" style={{ opacity: 0.7 }}>
                        <div className="loader" style={{ borderColor: '#4A919E', borderTopColor: 'transparent', width: '15px', height: '15px', marginRight: '10px' }}></div>
                        AYO réfléchit...
                    </div>
                )}

                {isAnalyzing && (
                    <div className="msg-bubble msg-ai" style={{ borderLeft: '3px solid #CE6A6B' }}>
                        ⚙️ <strong>Analyse en cours...</strong><br />
                        AYO explore votre site, cela peut prendre quelques secondes.
                    </div>
                )}

                {error && (
                    <div style={{ color: '#ef4444', padding: '10px', fontSize: '0.8rem', background: '#FEF2F2', marginTop: '5px', borderRadius: '4px', textAlign: 'center', border: '1px solid #FECACA' }}>
                        ⚠️ {error}
                    </div>
                )}

                <div ref={messagesEndRef} />
            </div>

            <div className="chat-input-area">
                <form onSubmit={(e) => handleSubmit(e)}>
                    <div className="chat-input-wrapper">
                        <input
                            className="chat-input"
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            placeholder="Écrivez votre réponse ici..."
                            disabled={isLoading}
                            autoFocus
                        />
                        <button type="submit" className="chat-send-btn" disabled={isLoading || !input.trim()}>
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <line x1="22" y1="2" x2="11" y2="13"></line>
                                <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
                            </svg>
                        </button>
                    </div>
                </form>
            </div>

            {/* Widget Toggle Button (Only in Widget Mode) */}
            {!isFullscreen && (
                <button
                    id="ayo-toggle"
                    className="ayo-toggle"
                    onClick={() => setIsOpen(true)}
                    style={{ display: isOpen ? 'none' : 'flex', background: 'var(--primary-color)' }}
                >
                    <svg viewBox="0 0 24 24" fill="white" width="24" height="24">
                        <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H6l-2 2V4h16v12z" />
                    </svg>
                </button>
            )}
        </div>
    );
}
