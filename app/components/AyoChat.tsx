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
        if (!isOpen && mode === 'widget') return;

        const lastMsg = messages[messages.length - 1];

        // LOGIC: If it's an AI message, we want to ensure the user sees the START of it.
        // Especially for long marketing pitches.
        if (lastMsg && lastMsg.role === 'assistant' && !isLoading) {
            // Slight delay to allow DOM render
            setTimeout(() => {
                const bubble = document.getElementById(`msg-${lastMsg.id}`);
                if (bubble) {
                    // "start" aligns the top of the element to the top of the visible area
                    // ensuring we read from the top.
                    bubble.scrollIntoView({ behavior: "smooth", block: "start" });
                }
            }, 100);
        } else {
            // For user messages or while loading, stick to bottom to show progress
            scrollToBottom();
        }
    }, [messages, isLoading, isOpen, isAnalyzing, mode]);

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

                // Display all chunks sequentially with 0.9s delay each
                for (const chunk of chunks) {
                    if (chunk && chunk.trim()) {
                        await addChunk(chunk, 900);
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

    // Check if we can go back (at least one user answer exists)
    const canGoBack = messages.filter(m => m.role === 'user').length >= 1;

    // Progress Bar Component (Workflow Steps)
    const ProgressBar = () => {
        // Determine current workflow step based on conversation history
        let currentStep = 1; // Default: Questionnaire

        const lastAiMsg = messages.filter(m => m.role === 'assistant').pop()?.content || "";
        const allContent = messages.map(m => m.content).join(" ");

        if (allContent.includes("Envoi en cours") || allContent.includes("dossier est prêt")) {
            currentStep = 5; // Livraison
        } else if (lastAiMsg.includes("email professionnel") || lastAiMsg.includes("Adresse email")) {
            currentStep = 4; // Finalisation (Email/Payment)
        } else if (lastAiMsg.includes("PACK LIGHT") || lastAiMsg.includes("PACK ESSENTIAL") || lastAiMsg.includes("PACK PRO") || lastAiMsg.includes("Score AIO")) {
            currentStep = 3; // Choix ASR
        } else if (lastAiMsg.includes("Analyse AIO Finale") || lastAiMsg.includes("SCAN TERMINÉ")) {
            currentStep = 2; // Analyse
        }

        const steps = [
            { num: 1, label: "Questionnaire" },
            { num: 2, label: "Analyse" },
            { num: 3, label: "Choix ASR" },
            { num: 4, label: "Finalisation" },
            { num: 5, label: "Livraison" }
        ];

        return (
            <div className="w-full bg-slate-50 border-b border-slate-200 relative z-20" style={{ padding: '30px 60px 60px 60px', marginTop: '20px', marginBottom: '20px' }}>
                <div className="flex justify-between items-center w-full relative">
                    {/* Connecting Line */}
                    <div className="absolute top-3 left-0 w-full h-0.5 bg-slate-200 -z-0"></div>

                    {steps.map((step, index) => {
                        const isActive = currentStep === step.num;
                        const isCompleted = currentStep > step.num;

                        // Force alignment with inline styles to override any CSS issues
                        const alignStyle = index === 0 ? { alignItems: 'flex-start' } : index === steps.length - 1 ? { alignItems: 'flex-end' } : { alignItems: 'center' };

                        return (
                            <div
                                key={step.num}
                                className="flex flex-col gap-2 z-10 relative"
                                style={alignStyle}
                            >
                                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold border-2 transition-all duration-300
                                    ${isActive ? 'bg-[#4A919E] border-[#4A919E] text-white scale-110 shadow-sm' :
                                        isCompleted ? 'bg-emerald-500 border-emerald-500 text-white' :
                                            'bg-white border-slate-300 text-slate-400'}`}>
                                    {isCompleted ? '✓' : step.num}
                                </div>
                                <span
                                    className={`text-[9px] uppercase tracking-wider font-semibold transition-colors duration-300 whitespace-nowrap
                                    ${isActive ? 'text-[#4A919E]' :
                                            isCompleted ? 'text-emerald-600' :
                                                'text-slate-400'}`}>
                                    {step.label}
                                </span>
                            </div>
                        );
                    })}
                </div>
            </div>
        );

    };

    // (Effect removed as stepCount logic is replaced by content detection)

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
                    const isSelecting = !current.includes(option);

                    // UX HANDLING FOR "AUTRE" OPTION
                    if (option === '__AUTRE__') {
                        if (isSelecting) {
                            // If selecting "Autre", pre-fill the main input and focus it
                            setInput((prevInput) => prevInput ? prevInput : "Autre : ");
                            // Try to focus main input (dirty but effective)
                            setTimeout(() => {
                                const mainInput = document.querySelector('textarea, input[type="text"].chat-input') as HTMLElement;
                                if (mainInput) mainInput.focus();
                            }, 50);
                        } else {
                            // If deselecting "Autre", clear input only if it looks like the default label
                            setInput((prevInput) => prevInput.startsWith("Autre :") ? "" : prevInput);
                        }
                    }

                    if (!isSelecting) {
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
                                    {/* Question Header & Badge */}
                                    <div className="mb-5">
                                        <p className="font-bold text-slate-800 text-lg leading-snug mb-2">
                                            {q.text}
                                        </p>
                                        {forceMultiple && (
                                            <div className="flex">
                                                <span className="text-xs font-semibold text-teal-700 bg-teal-50/80 px-3 py-1.5 rounded-full border border-teal-200/60 inline-flex items-center gap-1.5">
                                                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                                    </svg>
                                                    Plusieurs choix possibles
                                                </span>
                                            </div>
                                        )}
                                    </div>

                                    {/* CHECKBOX MODE - LARGE BUBBLE DESIGN */}
                                    {forceMultiple ? (
                                        <div className="flex flex-col gap-4">
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                                {filteredOptions.map((opt, i) => {
                                                    const isSelected = currentSelections.includes(opt);
                                                    return (
                                                        <div
                                                            key={i}
                                                            onClick={() => !isLoading && toggleMultipleSelection(questionId, opt)}
                                                            className={`flex items-center !gap-6 w-full !px-6 !py-5 !rounded-2xl cursor-pointer transition-all duration-200 border shadow-sm select-none group ${isSelected
                                                                ? 'bg-[#4A919E] border-[#4A919E] transform scale-[1.01]'
                                                                : 'bg-white border-slate-200 hover:border-[#4A919E]/50 hover:bg-slate-50'
                                                                }`}
                                                        >
                                                            {/* Checkbox Visual - LARGE & SPACED */}
                                                            <div className={`flex-shrink-0 w-6 h-6 rounded-lg flex items-center justify-center border-2 transition-all ${isSelected
                                                                ? 'bg-white/20 border-white/50'
                                                                : 'bg-white border-slate-300 group-hover:border-[#4A919E]'
                                                                }`}>
                                                                {isSelected && (
                                                                    <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                                                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                                                    </svg>
                                                                )}
                                                            </div>

                                                            {/* Text Label - LARGER */}
                                                            <span className={`text-[16px] font-medium leading-relaxed flex-1 ${isSelected ? 'text-white' : 'text-[#212E53]'}`}>
                                                                {opt}
                                                            </span>

                                                            {/* Hidden Native Input */}
                                                            <input
                                                                type="checkbox"
                                                                checked={isSelected}
                                                                readOnly
                                                                className="hidden"
                                                            />
                                                        </div>
                                                    );
                                                })}

                                                {/* OPTION "AUTRE" - Large Bubble */}
                                                <div
                                                    onClick={() => !isLoading && toggleMultipleSelection(questionId, '__AUTRE__')}
                                                    className={`flex items-center !gap-6 w-full !px-6 !py-5 !rounded-2xl cursor-pointer transition-all duration-200 border col-span-full select-none shadow-sm group ${currentSelections.includes('__AUTRE__')
                                                        ? 'bg-[#4A919E] border-[#4A919E] transform scale-[1.01]'
                                                        : 'bg-white border-dashed border-slate-300 hover:border-[#4A919E]/50 hover:bg-slate-50'
                                                        }`}
                                                >
                                                    <div className={`flex-shrink-0 w-6 h-6 rounded-lg flex items-center justify-center border-2 transition-all ${currentSelections.includes('__AUTRE__')
                                                        ? 'bg-white/20 border-white/50'
                                                        : 'bg-white border-slate-300 group-hover:border-[#4A919E]'
                                                        }`}>
                                                        {currentSelections.includes('__AUTRE__') ? (
                                                            <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                                            </svg>
                                                        ) : (
                                                            <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                                                            </svg>
                                                        )}
                                                    </div>

                                                    <span className={`text-[16px] font-medium leading-relaxed flex-1 ${currentSelections.includes('__AUTRE__') ? 'text-white' : 'text-[#212E53] italic'}`}>
                                                        Autre...
                                                    </span>

                                                    <input
                                                        type="checkbox"
                                                        checked={currentSelections.includes('__AUTRE__')}
                                                        readOnly
                                                        className="hidden"
                                                    />
                                                </div>
                                            </div>



                                            {/* Validate Button */}
                                            <button
                                                onClick={() => {
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
                                                className={`mt-2 !px-8 !py-4 !rounded-xl font-bold text-[16px] text-white transition-all ${(currentSelections.filter(s => s !== '__AUTRE__').length > 0 || (currentSelections.includes('__AUTRE__') && input.trim()))
                                                    ? 'bg-teal-600 hover:bg-teal-700 shadow-md transform hover:-translate-y-0.5'
                                                    : 'bg-slate-300 cursor-not-allowed'
                                                    }`}
                                            >
                                                ✓ Valider
                                            </button>
                                        </div>
                                    ) : (
                                        /* BUTTON MODE (Single Select) - LARGE BUBBLE STYLE FORCED */
                                        <div className="flex flex-col gap-4">
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                                {filteredOptions.map((opt, i) => (
                                                    <button
                                                        key={i}
                                                        onClick={() => !isLoading && handleSubmit(undefined, `${q.text} : ${opt}`)}
                                                        disabled={isLoading}
                                                        className="group flex items-center !gap-6 w-full !px-6 !py-5 !rounded-2xl border border-slate-200 hover:border-[#4A919E] bg-white hover:bg-[#4A919E] transition-all duration-200 shadow-sm text-left relative overflow-hidden"
                                                    >
                                                        <span className="text-[16px] font-medium text-[#212E53] group-hover:text-white flex-1 relative z-10 transition-colors leading-relaxed">
                                                            {opt}
                                                        </span>
                                                        <div className="w-6 h-6 rounded-full border-2 border-slate-200 group-hover:border-white group-hover:bg-white/20 flex items-center justify-center relative z-10 transition-colors flex-shrink-0">
                                                            <svg className="w-3.5 h-3.5 text-white opacity-0 group-hover:opacity-100 transition-opacity" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                                                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                                                            </svg>
                                                        </div>
                                                    </button>
                                                ))}

                                                {/* OPTION "AUTRE" SINGLE SELECT */}
                                                {!isOwnershipQuestion && q.allowCustom !== false && (
                                                    <button
                                                        onClick={() => {
                                                            setInput("Autre : ");
                                                            setTimeout(() => {
                                                                const mainInput = document.querySelector('.chat-input') as HTMLElement;
                                                                if (mainInput) mainInput.focus();
                                                            }, 50);
                                                        }}
                                                        className="group flex items-center justify-between !gap-6 w-full !px-6 !py-5 !rounded-2xl border border-dashed border-slate-300 hover:border-amber-400 bg-white hover:bg-amber-50 transition-all duration-200 shadow-sm text-left col-span-full"
                                                    >
                                                        <span className="text-[16px] font-medium text-slate-500 italic group-hover:text-amber-700 transition-colors">
                                                            Autre réponse / Préciser...
                                                        </span>
                                                        <svg className="w-5 h-5 text-slate-300 group-hover:text-amber-500 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                                            <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                                        </svg>
                                                    </button>
                                                )}
                                            </div>
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
                        id={`msg-${m.id}`}
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
