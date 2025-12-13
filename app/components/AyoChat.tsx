'use client';

import { useChat } from '@ai-sdk/react';
import { useState, useEffect, useRef } from 'react';

export default function AyoChat() {
    const { messages, input, handleInputChange, handleSubmit, isLoading } = useChat();
    const [isOpen, setIsOpen] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const toggleChat = () => setIsOpen(!isOpen);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    // Initial greeting
    const [hasGreeted, setHasGreeted] = useState(false);
    useEffect(() => {
        if (isOpen && !hasGreeted && messages.length === 0) {
            // We can simulate an initial message or just wait for user
            // Ideally we start empty or with a static bubble
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
                            👋 Bonjour ! Je suis AYO. Je peux analyser votre entreprise pour voir si elle est visible par les IA (ChatGPT, Gemini, etc.). Tapez "Analyse" ou posez-moi une question.
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

                    <form className="ayo-input-area" onSubmit={handleSubmit}>
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
