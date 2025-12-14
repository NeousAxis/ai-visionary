'use client';

import { useState, useEffect, useRef } from 'react';

export default function AyoChat() {
    // UI State
    const [messages, setMessages] = useState<any[]>([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isOpen, setIsOpen] = useState(false);
    const [hasGreeted, setHasGreeted] = useState(false);

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
        if (isOpen && !hasGreeted && messages.length === 0) {
            setHasGreeted(true);
        }
    }, [isOpen, hasGreeted, messages.length]);

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

        try {
            // 2. Manual Network Request
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    messages: [...messages, userMessage]
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

            // 3. READ JSON RESPONSE (Standard fetch, no stream)
            const data = await response.json();

            if (!data.text) throw new Error("Réponse vide de l'IA");

            const botMessageId = (Date.now() + 1).toString();
            setMessages(prev => [...prev, { role: 'assistant', content: data.text, id: botMessageId }]);

        } catch (err: any) {
            console.error("Manual Fetch Error:", err);
            setError(err.message || "Erreur de connexion");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div id="ayo-widget" className={`ayo-widget ${isOpen ? 'open' : ''}`}>

            <div className={`ayo-chat-window ${isOpen ? 'open' : ''}`}>
                <div className="ayo-header">
                    <h4><span className="status-dot"></span> AYO Bot</h4>
                    <button
                        onClick={() => setIsOpen(false)}
                        style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer', fontSize: '1.2rem' }}
                    >✕</button>
                </div>

                <div className="ayo-messages">
                    <div className="message bot-message" style={{ background: 'rgba(255, 255, 255, 0.1)', alignSelf: 'flex-start', borderBottomLeftRadius: '2px' }}>
                        👋 Bonjour, ici AYO. Initialisation du protocole AIO Light.<br /><br />
                        Je vais établir votre <strong>Diagnostic de Visibilité IA (Gratuit)</strong>.<br />
                        Pour cela, répondez à ces 3 questions.<br /><br />
                        <strong>1. Quel est le NOM de votre entreprise ?</strong>
                    </div>

                    {messages.map((m) => (
                        <div
                            key={m.id}
                            className={`message ${m.role === 'user' ? 'user-message' : 'bot-message'}`}
                        >
                            {/* Simple text rendering */}
                            {m.content}
                        </div>
                    ))}

                    {isLoading && (
                        <div className="typing-indicator" style={{ display: 'block' }}>AYO réfléchit...</div>
                    )}

                    {error && (
                        <div style={{ color: '#ef4444', padding: '10px', fontSize: '0.8rem', background: 'rgba(0,0,0,0.5)', marginTop: '5px', borderRadius: '4px' }}>
                            ⚠️ {error}
                        </div>
                    )}

                    <div ref={messagesEndRef} />
                </div>

                <form className="ayo-input-area" onSubmit={handleSubmit} style={{ display: 'flex', gap: '10px' }}>
                    <input
                        className="ayo-input"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        placeholder="Écrivez ici..."
                        disabled={isLoading}
                        autoFocus
                    />
                    <button type="submit" disabled={isLoading || !input.trim()}>
                        ➤
                    </button>
                </form>
            </div>

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
        </div>
    );
}
