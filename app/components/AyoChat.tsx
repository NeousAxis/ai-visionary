'use client';

import { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';

interface AyoChatProps {
    mode?: 'widget' | 'fullscreen';
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
    const handleSubmit = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        if (!input.trim() || isLoading) return;

        const userMessage = { role: 'user', content: input };

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
                // NORMAL FAST RESPONSE
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

    // If Fullscreen, we render the "App Frame". If Widget, we render the floating logic.
    const isFullscreen = mode === 'fullscreen';

    return (
        <div className={isFullscreen ? 'ayo-chat-container' : `ayo-widget ${isOpen ? 'open' : ''}`}>

            {/* Header only for Widget or Fullscreen Title */}
            <div className="chat-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#10B981' }}></div>
                    <h4 style={{ margin: 0 }}>AYO Assistant IA</h4>
                </div>
                {!isFullscreen && (
                    <button onClick={() => setIsOpen(false)} style={{ background: 'none', border: 'none', fontSize: '1.2rem', cursor: 'pointer' }}>✕</button>
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
                        <div className="markdown-content">
                            <ReactMarkdown
                                components={{
                                    a: ({ node, ...props }) => (
                                        <a {...props} target="_blank" rel="noopener noreferrer" style={{ color: m.role === 'user' ? 'white' : 'blue', textDecoration: 'underline' }} />
                                    )
                                }}
                            >
                                {m.content}
                            </ReactMarkdown>
                        </div>
                    </div>
                ))}

                {isLoading && (
                    <div className="msg-bubble msg-ai" style={{ opacity: 0.7 }}>
                        <div className="loader" style={{ borderColor: '#2563EB', borderTopColor: 'transparent', width: '15px', height: '15px', marginRight: '10px' }}></div>
                        AYO réfléchit...
                    </div>
                )}

                {isAnalyzing && (
                    <div className="msg-bubble msg-ai" style={{ borderLeft: '3px solid #F59E0B' }}>
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
                {/* QCM Placeholder (Will be dynamically activated later) */}
                {/* 
                 <div className="qcm-options-grid mb-4">
                     <button className="qcm-btn">Option A (Exemple)</button>
                     <button className="qcm-btn">Option B (Exemple)</button>
                 </div> 
                 */}

                <form onSubmit={handleSubmit} style={{ display: 'flex', gap: '10px' }}>
                    <input
                        className="chat-input"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        placeholder="Écrivez votre réponse ici..."
                        disabled={isLoading}
                        autoFocus
                    />
                    <button type="submit" className="btn btn-primary" disabled={isLoading || !input.trim()}>
                        Envoyer ➤
                    </button>
                </form>
            </div>

            {/* Widget Toggle Button (Only in Widget Mode) */}
            {!isFullscreen && (
                <button
                    id="ayo-toggle"
                    className="ayo-toggle"
                    onClick={() => setIsOpen(true)}
                    style={{ display: isOpen ? 'none' : 'flex' }}
                >
                    <svg viewBox="0 0 24 24" fill="white" width="24" height="24">
                        <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H6l-2 2V4h16v12z" />
                    </svg>
                </button>
            )}
        </div>
    );
}
