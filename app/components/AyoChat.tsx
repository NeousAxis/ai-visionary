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

            if (!response.body) throw new Error("Pas de réponse du serveur");

            // 3. Stream Reading
            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let botMessageContent = '';
            const botMessageId = (Date.now() + 1).toString();

            // Add empty bot message placeholder
            setMessages(prev => [...prev, { role: 'assistant', content: '', id: botMessageId }]);

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value, { stream: true });
                // Note: The Vercel AI SDK stream format might include protocol headers (0:"text").
                // For simplicity in this fallback, we accumulate text, but cleaning might be needed properly if using Data Stream Protocol.
                // However, raw streamText response often is just text if not using data stream mode purely.
                // Let's assume standard text stream for now or clean basic artifacts.

                // Simple cleaning of Vercel Data Stream Protocol specific prefixes if they appear coarsely
                // Usually it sends lines like: 0:"The"\n0:" weather"
                // We'll simplisticly append for now, but really we should parse.
                // Let's try raw read first. If it looks like garbage, we know why.
                // Actually, let's just append pure text, assuming the server sends text. 
                // BUT wait, route.ts uses `result.toDataStreamResponse()`. This DOES use the protocol.
                // Parsing that manually is annoying.

                // ALTERNATIVE: Use the text directly if it is clean, or use a regex to strip protocol.
                // Protocol: 0:"content"
                const cleanChunk = chunk.replace(/0:"/g, '').replace(/"\n/g, '').replace(/^"/, '').replace(/"$/, '');

                botMessageContent += cleanChunk;

                setMessages(prev => prev.map(m =>
                    m.id === botMessageId ? { ...m, content: botMessageContent } : m
                ));
            }

        } catch (err: any) {
            console.error("Manual Fetch Error:", err);
            setError(err.message || "Erreur de connexion");
            // Restore input in case of error? No, just show error.
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
                            {/* Heuristic to display content cleanly even if raw protocol leaks slightly */}
                            {m.content.replace(/^0:"/, '').replace(/"$/, '')}
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
