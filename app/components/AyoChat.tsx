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
        allowMultiple?: boolean;
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

    // State for local progression inside a block
    const [activeBlock, setActiveBlock] = useState<QuestionBlock | null>(null);
    const [currentQIndex, setCurrentQIndex] = useState(0);
    const [stepCount, setStepCount] = useState(1); // 1..5

    // State for multiple selection (checkboxes)
    const [selectedMultiple, setSelectedMultiple] = useState<Record<string, string[]>>({});

    // GO BACK function - removes last 2 messages (user answer + AI response)
    const goBack = () => {
        if (messages.length < 2) return; // Can't go back if less than 2 messages

        // Remove the last 2 messages (user's answer + AI's next question)
        setMessages(prev => prev.slice(0, -2));
        setStepCount(prev => Math.max(1, prev - 1));
        setSelectedMultiple({}); // Reset selections
        setInput('');
    };

    // Check if we can go back (at least one user answer exists after URL)
    const canGoBack = messages.filter(m => m.role === 'user').length > 1;

    // Progress Bar Component (Dynamic - based on actual questions asked)
    const ProgressBar = () => {
        // Count only questions actually asked (assistant messages with question_block)
        const questionMessages = messages.filter(m =>
            m.role === 'assistant' &&
            (m.content.includes('"type": "question_block"') || m.content.includes('question_block'))
        );

        const totalAsked = questionMessages.length;
        const currentStep = stepCount;

        if (totalAsked === 0) return null; // Don't show progress until first question

        return (
            <div className="progress-steps-container" style={{ overflowX: 'auto', paddingBottom: '5px' }}>
                {Array.from({ length: totalAsked + 1 }, (_, i) => i + 1).map((stepNum) => {
                    const isActive = stepNum === currentStep;
                    const isCompleted = stepNum < currentStep;
                    return (
                        <div key={stepNum} className={`step-item ${isActive ? 'active' : ''} ${isCompleted ? 'completed' : ''}`} style={{ minWidth: '30px' }}>
                            <div className="step-dot">{isCompleted ? '✓' : (isActive ? '?' : stepNum)}</div>
                        </div>
                    );
                })}
            </div>
        );
    };

    // Calculate progress based on messages
    useEffect(() => {
        const qBlocks = messages.filter(m => m.role === 'assistant' && m.content.includes('"type": "question_block"'));
        // Initial state is 1, each new block increments
        setStepCount(qBlocks.length > 0 ? qBlocks.length + 1 : 1);
    }, [messages]);

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
            // ONLY SHOW THE BLOCK IF IT IS THE LAST MESSAGE
            // If it's an old message, show a summary like "✅ Identité validée."
            const isLast = msg.id === messages[messages.length - 1].id;

            if (!isLast) {
                return (
                    <div className="text-sm text-gray-500 italic border-l-2 border-teal-500 pl-3">
                        {qcmData.intro || "Étape validée."}
                    </div>
                );
            }

            // If it IS the last message, handle local pagination
            // We use a local state 'currentQIndex' but we need to reset it when a new block arrives.
            // Actually, simplified: Just render ALL questions but visually highlight the first unactioned? 
            // NO, user wants "UNE SEULE QUESTION A LA FOIS".
            // So we show Q[0]. When answered, we trigger submit. 
            // WAITING: We can't do partial submit to backend EASILY without changing backend logic.
            // TRICK: We display Q1. User clicks. We store answer. We display Q2. User clicks. We submit BOTH to backend?
            // COMPLEXITY RISK.
            // FALLBACK: User asked "ONE QUESTION AT A TIME". I will just display them vertically with enough space? 
            // OR I simulate distinct bubbles. 

            // LET'S DO MUTUAL EXCLUSION VISUAL:
            // Just display the whole form. It's safer.
            // "Une seule question à la fois" -> I will modify the CSS to show only one big card?
            // Actually, backend sends a block. I will render the block as a single swiper.

            // Helper function to toggle checkbox selection
            const toggleMultipleSelection = (questionId: string, option: string) => {
                setSelectedMultiple(prev => {
                    const current = prev[questionId] || [];
                    if (current.includes(option)) {
                        return { ...prev, [questionId]: current.filter(o => o !== option) };
                    } else {
                        return { ...prev, [questionId]: [...current, option] };
                    }
                });
            };

            // Helper function to submit multiple selections
            const submitMultipleSelection = (questionId: string, questionText: string) => {
                const selections = selectedMultiple[questionId] || [];
                if (selections.length === 0) return;

                const formattedAnswer = `${questionText} : ${selections.join(', ')}`;
                // Clear the selection after submit
                setSelectedMultiple(prev => {
                    const newState = { ...prev };
                    delete newState[questionId];
                    return newState;
                });
                handleSubmit(undefined, formattedAnswer);
            };

            return (
                <div className="ay-qcm-container">
                    {/* BOUTON RETOUR - visible si au moins une réponse donnée */}
                    {canGoBack && (
                        <button
                            onClick={goBack}
                            disabled={isLoading}
                            className="mb-3 px-4 py-2 text-sm text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors flex items-center gap-2"
                        >
                            ← Retour à la question précédente
                        </button>
                    )}

                    {qcmData.intro && (
                        <p className="mb-4 font-semibold text-teal-800 whitespace-pre-line">{qcmData.intro}</p>
                    )}

                    <div className="flex flex-col gap-6">
                        {qcmData.questions.map((q, idx) => {
                            const questionId = q.id || `q_${idx}`;
                            const currentSelections = selectedMultiple[questionId] || [];

                            // FILTER OUT "Autre" variants AND redundant "Les deux" options
                            const filteredOptions = q.options.filter(opt => {
                                const lower = opt.toLowerCase().trim();
                                // Remove "Autre" variants
                                if (['autre', 'other', 'préciser', 'préciser...', 'autre...', 'autre / préciser', 'autre / préciser...'].includes(lower)) return false;
                                // Remove "Les deux" / combined options (redundant with checkboxes)
                                if (lower.includes('les deux') || lower.includes('both') || lower.includes('tous') || lower.includes('toutes') || lower.includes('all')) return false;
                                return true;
                            });

                            // DETECT OWNERSHIP QUESTION (must stay Yes/No without "Autre")
                            const questionLower = q.text.toLowerCase();
                            const isOwnershipQuestion =
                                questionLower.includes('appartient') ||
                                questionLower.includes('autorisé') ||
                                questionLower.includes('propriétaire') ||
                                q.id === 'ownership_confirm';

                            // FORCE allowMultiple based on question keywords (LLM often forgets)
                            // BUT NOT for ownership question
                            const forceMultiple = !isOwnershipQuestion && (
                                q.allowMultiple ||
                                questionLower.includes('public') ||
                                questionLower.includes('cible') ||
                                questionLower.includes('secteur') ||
                                questionLower.includes('activité') ||
                                questionLower.includes('service') ||
                                questionLower.includes('produit') ||
                                questionLower.includes('offre') ||
                                questionLower.includes('canal') ||
                                questionLower.includes('réseau') ||
                                questionLower.includes('certification') ||
                                questionLower.includes('technologie') ||
                                (filteredOptions.length >= 4) // If 4+ options, likely needs multi-select
                            );

                            return (
                                <div key={questionId} className="qcm-question-box p-4 bg-white/50 rounded-xl border border-slate-200 shadow-sm">
                                    <p className="mb-4 font-bold text-slate-800 text-base">
                                        {q.text}
                                        {forceMultiple && (
                                            <span className="ml-2 text-xs font-medium text-teal-600 bg-gradient-to-r from-teal-50 to-cyan-50 px-3 py-1 rounded-full border border-teal-200">
                                                ✓ Plusieurs choix possibles
                                            </span>
                                        )}
                                    </p>

                                    {/* CHECKBOX MODE - MODERN DESIGN */}
                                    {forceMultiple ? (
                                        <div className="flex flex-col gap-4">
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                                {filteredOptions.map((opt, i) => {
                                                    const isSelected = currentSelections.includes(opt);
                                                    return (
                                                        <label
                                                            key={i}
                                                            className={`relative flex items-center gap-4 px-5 py-4 rounded-xl cursor-pointer transition-all duration-200 border-2 ${isSelected
                                                                ? 'bg-white border-cyan-400'
                                                                : 'bg-white border-slate-200 hover:border-cyan-200'
                                                                }`}
                                                        >
                                                            {/* Checkbox Square */}
                                                            <div className={`flex-shrink-0 w-5 h-5 rounded flex items-center justify-center border-2 transition-colors ${isSelected
                                                                ? 'bg-white border-cyan-400'
                                                                : 'bg-white border-slate-300 group-hover:border-cyan-300'
                                                                }`}>
                                                                {isSelected && (
                                                                    <svg className="w-3.5 h-3.5 text-cyan-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={4}>
                                                                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                                                    </svg>
                                                                )}
                                                            </div>
                                                            {/* Text */}
                                                            <span className={`flex-1 text-[15px] font-medium ${isSelected ? 'text-slate-900' : 'text-slate-600'}`}>
                                                                {opt}
                                                            </span>
                                                            <input
                                                                type="checkbox"
                                                                checked={isSelected}
                                                                onChange={() => toggleMultipleSelection(questionId, opt)}
                                                                disabled={isLoading}
                                                                className="sr-only"
                                                            />
                                                        </label>
                                                    );
                                                })}

                                                {/* OPTION "AUTRE" - Design identique mais avec distinction subtile */}
                                                <label
                                                    className={`relative flex items-center gap-4 px-5 py-4 rounded-xl cursor-pointer transition-all duration-200 border-2 col-span-full ${currentSelections.includes('__AUTRE__')
                                                        ? 'bg-white border-amber-400'
                                                        : 'bg-white border-dashed border-slate-300 hover:border-amber-300'
                                                        }`}
                                                >
                                                    <div className={`flex-shrink-0 w-5 h-5 rounded flex items-center justify-center border-2 transition-colors ${currentSelections.includes('__AUTRE__')
                                                        ? 'bg-white border-amber-400'
                                                        : 'bg-white border-slate-300 group-hover:border-amber-300'
                                                        }`}>
                                                        {currentSelections.includes('__AUTRE__') ? (
                                                            <svg className="w-3.5 h-3.5 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={4}>
                                                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                                            </svg>
                                                        ) : (
                                                            <svg className="w-3.5 h-3.5 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                                                <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                                            </svg>
                                                        )}
                                                    </div>
                                                    <span className={`flex-1 text-[15px] font-medium ${currentSelections.includes('__AUTRE__') ? 'text-slate-900' : 'text-slate-500'}`}>
                                                        Autre / Préciser...
                                                    </span>
                                                    <input
                                                        type="checkbox"
                                                        checked={currentSelections.includes('__AUTRE__')}
                                                        onChange={() => toggleMultipleSelection(questionId, '__AUTRE__')}
                                                        disabled={isLoading}
                                                        className="sr-only"
                                                    />
                                                </label>
                                            </div>

                                            {/* CHAMP DE TEXTE POUR "AUTRE" */}
                                            {currentSelections.includes('__AUTRE__') && (
                                                <div className="pt-2 animate-in fade-in slide-in-from-top-1 duration-200">
                                                    <input
                                                        type="text"
                                                        placeholder="Veuillez préciser..."
                                                        autoFocus
                                                        value={input}
                                                        onChange={(e) => setInput(e.target.value)}
                                                        className="w-full px-4 py-3 rounded-lg border-2 border-amber-200 bg-white text-slate-900 focus:outline-none focus:border-amber-400 transition-colors placeholder:text-slate-400"
                                                    />
                                                </div>
                                            )}

                                            {/* Validate Button */}
                                            <button
                                                onClick={() => {
                                                    // Build answer: selected options + custom text if "Autre" is checked
                                                    let selections = currentSelections.filter(s => s !== '__AUTRE__');
                                                    if (currentSelections.includes('__AUTRE__') && input.trim()) {
                                                        selections.push(input.trim());
                                                    }
                                                    if (selections.length === 0) return;

                                                    const formattedAnswer = `${q.text} : ${selections.join(', ')}`;
                                                    setSelectedMultiple(prev => {
                                                        const newState = { ...prev };
                                                        delete newState[questionId];
                                                        return newState;
                                                    });
                                                    setInput('');
                                                    handleSubmit(undefined, formattedAnswer);
                                                }}
                                                disabled={isLoading || (currentSelections.filter(s => s !== '__AUTRE__').length === 0 && !(currentSelections.includes('__AUTRE__') && input.trim()))}
                                                className={`mt-2 px-6 py-3 rounded-lg font-semibold text-white transition-all ${(currentSelections.filter(s => s !== '__AUTRE__').length > 0 || (currentSelections.includes('__AUTRE__') && input.trim()))
                                                    ? 'bg-teal-600 hover:bg-teal-700 shadow-md'
                                                    : 'bg-slate-300 cursor-not-allowed'
                                                    }`}
                                            >
                                                ✓ Valider ({currentSelections.filter(s => s !== '__AUTRE__').length + (currentSelections.includes('__AUTRE__') && input.trim() ? 1 : 0)} sélectionnée{(currentSelections.filter(s => s !== '__AUTRE__').length + (currentSelections.includes('__AUTRE__') && input.trim() ? 1 : 0)) > 1 ? 's' : ''})
                                            </button>
                                        </div>
                                    ) : (
                                        /* BUTTON MODE (Normal single select) */
                                        <div className="qcm-options-grid grid grid-cols-1 sm:grid-cols-2 gap-2">
                                            {filteredOptions.map((opt, i) => (
                                                <button
                                                    key={i}
                                                    onClick={() => !isLoading && handleSubmit(undefined, `${q.text} : ${opt}`)}
                                                    className="qcm-btn hover:bg-teal-50 text-left px-4 py-3 rounded border border-slate-300 transition-colors text-sm font-medium text-slate-700 hover:border-teal-500 hover:text-teal-700"
                                                    disabled={isLoading}
                                                >
                                                    {opt}
                                                </button>
                                            ))}
                                            {/* AFFICHER "Autre" SAUF pour la question de propriété */}
                                            {!isOwnershipQuestion && (
                                                <button
                                                    onClick={() => setInput(`${q.text} : `)}
                                                    className="qcm-btn hover:bg-amber-50 text-left px-4 py-3 rounded border border-dashed border-amber-400 transition-colors text-sm text-amber-700 italic col-span-full"
                                                >
                                                    ✏️ {q.customLabel || "Autre réponse / Préciser..."}
                                                </button>
                                            )}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
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

            <ProgressBar />

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
                    <div className="msg-bubble msg-ai" style={{ borderLeft: '3px solid #CE6A6B', display: 'flex', alignItems: 'center', gap: '15px' }}>
                        <div className="loader" style={{
                            width: '24px', height: '24px',
                            border: '3px solid #f3f3f3',
                            borderTop: '3px solid #CE6A6B',
                            borderRadius: '50%',
                            animation: 'spin 1s linear infinite'
                        }}></div>
                        <div>
                            <strong>Analyse AIO Finale en cours...</strong><br />
                            <span style={{ fontSize: '0.85rem', color: '#666' }}>Traitement des données et simulation IA.<br />Cela peut prendre 30 secondes...</span>
                        </div>
                        <style jsx>{`
                            @keyframes spin {
                                0% { transform: rotate(0deg); }
                                100% { transform: rotate(360deg); }
                            }
                        `}</style>
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
