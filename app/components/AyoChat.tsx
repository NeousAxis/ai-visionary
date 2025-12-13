'use client';

import { useChat } from '@ai-sdk/react';
import { useState, useEffect, useRef } from 'react';

export default function AyoChat() {
    // Cast to any to avoid temporary type mismatches with the latest SDK
    const { messages, input, handleInputChange, handleSubmit, isLoading } = useChat() as any;
    const [isOpen, setIsOpen] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const toggleChat = () => setIsOpen(!isOpen);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    // Secure submit handler to prevent page reload
    const onFormSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        handleSubmit(e);
    };

    // Initial greeting
    const [hasGreeted, setHasGreeted] = useState(false);
    useEffect(() => {
        if (isOpen && !hasGreeted && messages.length === 0) {
            setHasGreeted(true);
        }
    }, [isOpen, hasGreeted, messages.length]);


    return (
        <>
            <div id="ayo-widget" className={`ayo-widget ${isOpen ? 'open' : ''}`}>

                {/* Chat Window */}
                <div className={`ayo-chat-window ${isOpen ? 'open' : ''}`}>
                    <div className="ayo-header">
                        <h4><span className="status-dot"></span> AYO Bot</h4>
                        <button onClick={toggleChat} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer' }}>✕</button>
                    </div>

                    <div className="ayo-messages">
                        {/* Intro Message */}
                        <div className="message bot-message">
                            👋 Bonjour, ici AYO. Initialisation du protocole AIO.<br /><br />
                            Je vais établir votre <strong>Diagnostic de Visibilité IA (Gratuit)</strong>.<br />
                            Pour cela, répondez à ces 3 questions.<br /><br />
                            <strong>1. Quel est le NOM de votre entreprise ?</strong>
                        </div>

                        {messages.map((m: any) => (
                            <div key={m.id} className={`message ${m.role === 'user' ? 'user-message' : 'bot-message'}`}>
                                {m.content}
                            </div>
                        ))}

                        {isLoading && (
                            <div className="typing-indicator" style={{ display: 'block' }}>AYO réfléchit...</div>
                        )}
                        <div ref={messagesEndRef} />
                    </div>

                    <form className="ayo-input-area" onSubmit={onFormSubmit}>
                        <input
                            className="ayo-input"
                            value={input}
                            onChange={handleInputChange}
                            placeholder="Écrivez ici..."
                        />
                        <button type="submit">➤</button>
                    </form>
                </div>

                {/* Toggle Button */}
                <button id="ayo-toggle" className="ayo-toggle" onClick={toggleChat} style={{ display: isOpen ? 'none' : 'flex' }}>
                    <svg viewBox="0 0 24 24" fill="white" width="24" height="24">
                        <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H6l-2 2V4h16v12z" />
                    </svg>
                </button>
            </div>
        </>
    );
}
