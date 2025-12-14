'use client';

import { useChat } from '@ai-sdk/react';
import { useState, useEffect, useRef } from 'react';

export default function AyoChat() {
    // 1. Standard Vercel AI SDK hook
    const { messages, append, isLoading, error } = useChat();

    // 2. UI State
    const [isOpen, setIsOpen] = useState(false);
    const [hasGreeted, setHasGreeted] = useState(false);
    const [localInput, setLocalInput] = useState(''); // Local state for input buffer
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // 3. Helper to scroll to bottom
    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages, isLoading, isOpen]);

    // 4. Initial greeting logic (Client-side effect only)
    useEffect(() => {
        if (isOpen && !hasGreeted && messages.length === 0) {
            setHasGreeted(true);
        }
    }, [isOpen, hasGreeted, messages.length]);

    // 5. Secure Send Handler
    const handleSend = async () => {
        if (!localInput.trim() || isLoading) return;

        const messageToSend = localInput;
        setLocalInput(''); // Clear immediately for UX

        try {
            await append({
                role: 'user',
                content: messageToSend
            });
        } catch (err) {
            console.error("Failed to send message:", err);
            setLocalInput(messageToSend); // Restore if failed
        }
    };

    return (
        <div id="ayo-widget" className={`ayo-widget ${isOpen ? 'open' : ''}`}>

            {/* Main Chat Window */}
            <div className={`ayo-chat-window ${isOpen ? 'open' : ''}`}>

                {/* Header */}
                <div className="ayo-header">
                    <h4><span className="status-dot"></span> AYO Bot</h4>
                    <button
                        onClick={() => setIsOpen(false)}
                        style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer', fontSize: '1.2rem' }}
                    >
                        ✕
                    </button>
                </div>

                {/* Messages Container */}
                <div className="ayo-messages">
                    {/* Static Intro Message */}
                    <div className="message bot-message" style={{ background: 'rgba(255, 255, 255, 0.1)', alignSelf: 'flex-start', borderBottomLeftRadius: '2px' }}>
                        👋 Bonjour, ici AYO. Initialisation du protocole AIO Light.<br /><br />
                        Je vais établir votre <strong>Diagnostic de Visibilité IA (Gratuit)</strong>.<br />
                        Pour cela, répondez à ces 3 questions.<br /><br />
                        <strong>1. Quel est le NOM de votre entreprise ?</strong>
                    </div>

                    {/* Dynamic Messages Loop - SAFEGUARDED */}
                    {Array.isArray(messages) && messages.map((m: any) => (
                        <div
                            key={m.id}
                            className={`message ${m.role === 'user' ? 'user-message' : 'bot-message'}`}
                        >
                            {/* Simple text rendering */}
                            {m.content}
                        </div>
                    ))}

                    {/* Typing Indicator */}
                    {isLoading && (
                        <div className="typing-indicator" style={{ display: 'block' }}>
                            AYO réfléchit...
                        </div>
                    )}

                    {/* Error Feedback */}
                    {error && (
                        <div style={{ color: '#ef4444', padding: '10px', fontSize: '0.8rem', background: 'rgba(0,0,0,0.5)', marginTop: '5px', borderRadius: '4px' }}>
                            ⚠️ Erreur: Impossible de joindre AYO. (Vérifiez la clé API)
                        </div>
                    )}

                    <div ref={messagesEndRef} />
                </div>

                {/* Input Area */}
                <div className="ayo-input-area" style={{ display: 'flex', gap: '10px' }}>
                    <input
                        className="ayo-input"
                        value={localInput}
                        onChange={(e) => setLocalInput(e.target.value)}
                        placeholder="Écrivez ici..."
                        disabled={isLoading}
                        autoFocus
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                                console.log('[AYO Debug] Enter Key Pressed');
                                e.preventDefault();
                                handleSend();
                            }
                        }}
                    />
                    <button
                        onClick={handleSend}
                        disabled={isLoading || !localInput.trim()}
                    >
                        ➤
                    </button>
                </div>
            </div>

            {/* Toggle Button (Floating Action Button) */}
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
