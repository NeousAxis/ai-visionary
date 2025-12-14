'use client';

import { useChat } from '@ai-sdk/react';
import { useState, useEffect, useRef } from 'react';

export default function AyoChat() {
    // Standard Vercel AI SDK implementation
    const { messages, input, handleInputChange, handleSubmit, isLoading, error } = useChat() as any;

    // UI State
    const [isOpen, setIsOpen] = useState(false);
    const [hasGreeted, setHasGreeted] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // Auto-scroll to bottom of chat
    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages, isLoading]);

    // Initial greeting logic
    useEffect(() => {
        if (isOpen && !hasGreeted && messages.length === 0) {
            setHasGreeted(true);
        }
    }, [isOpen, hasGreeted, messages.length]);

    return (
        <div id="ayo-widget" className={`ayo-widget ${isOpen ? 'open' : ''}`}>

            {/* Main Chat Interface */}
            {isOpen && (
                <div className={`ayo-chat-window ${isOpen ? 'open' : ''}`}>

                    {/* Header */}
                    <div className="ayo-header">
                        <h4><span className="status-dot"></span> AYO Bot</h4>
                        <button
                            onClick={() => setIsOpen(false)}
                            className="close-btn"
                            style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer', fontSize: '1.2rem' }}
                        >
                            ✕
                        </button>
                    </div>

                    {/* Messages Area */}
                    <div className="ayo-messages">
                        {/* Static Welcome Message */}
                        <div className="message bot-message" style={{ background: 'rgba(255, 255, 255, 0.1)', alignSelf: 'flex-start', borderBottomLeftRadius: '2px' }}>
                            👋 Bonjour, ici AYO. Initialisation du protocole AIO Light.<br /><br />
                            Je vais établir votre <strong>Diagnostic de Visibilité IA (Gratuit)</strong>.<br />
                            Pour cela, répondez à ces 3 questions.<br /><br />
                            <strong>1. Quel est le NOM de votre entreprise ?</strong>
                        </div>

                        {/* Dynamic Messages */}
                        {messages.map((m) => (
                            <div
                                key={m.id}
                                className={`message ${m.role === 'user' ? 'user-message' : 'bot-message'}`}
                                style={m.role === 'user' ?
                                    { background: 'var(--primary-color)', color: 'white', alignSelf: 'flex-end', borderBottomRightRadius: '2px' } :
                                    { background: 'rgba(255, 255, 255, 0.1)', alignSelf: 'flex-start', borderBottomLeftRadius: '2px' }
                                }
                            >
                                <span dangerouslySetInnerHTML={{ __html: m.content.replace(/\n/g, '<br/>') }} />
                            </div>
                        ))}

                        {/* Loading Indicator */}
                        {isLoading && (
                            <div className="typing-indicator" style={{ display: 'block', padding: '10px', fontSize: '0.8rem', color: '#a1a1aa' }}>
                                AYO réfléchit...
                            </div>
                        )}

                        {/* Error Display */}
                        {error && (
                            <div className="error-message" style={{ color: '#ef4444', padding: '10px', fontSize: '0.8rem', background: 'rgba(0,0,0,0.5)', borderRadius: '4px', margin: '5px 0' }}>
                                ⚠️ Erreur: Impossible de joindre AYO. (Vérifiez la clé API)
                            </div>
                        )}

                        <div ref={messagesEndRef} />
                    </div>

                    {/* Input Area - Standard Form */}
                    <form className="ayo-input-area" onSubmit={handleSubmit} style={{ padding: '15px', borderTop: '1px solid rgba(255,255,255,0.1)', display: 'flex', gap: '10px' }}>
                        <input
                            className="ayo-input"
                            value={input}
                            onChange={handleInputChange}
                            placeholder="Écrivez ici..."
                            disabled={isLoading}
                            autoFocus
                            style={{ flex: 1, padding: '10px', borderRadius: '20px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)', color: 'white' }}
                        />
                        <button
                            type="submit"
                            disabled={isLoading || !input.trim()}
                            style={{
                                background: 'var(--primary-color)',
                                border: 'none',
                                width: '35px',
                                height: '35px',
                                borderRadius: '50%',
                                color: 'white',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                opacity: (isLoading || !input.trim()) ? 0.5 : 1
                            }}
                        >
                            ➤
                        </button>
                    </form>
                </div>
            )}

            {/* Toggle Trigger Button */}
            {!isOpen && (
                <button
                    id="ayo-toggle"
                    className="ayo-toggle"
                    onClick={() => setIsOpen(true)}
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: '60px',
                        height: '60px',
                        borderRadius: '50%',
                        background: 'var(--primary-color)',
                        border: 'none',
                        cursor: 'pointer',
                        boxShadow: '0 4px 15px rgba(139, 92, 246, 0.4)'
                    }}
                >
                    <svg viewBox="0 0 24 24" fill="white" width="24" height="24">
                        <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H6l-2 2V4h16v12z" />
                    </svg>
                </button>
            )}
        </div>
    );
}
