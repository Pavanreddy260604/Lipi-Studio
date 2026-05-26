import { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, PanelRight, Brain, Zap, Compass, Sparkles, Check, ChevronDown, Paperclip, Image as ImageIcon } from 'lucide-react';
import { useScriptWriter } from '../../../contexts/ScriptWriterContext';
import type { ChatMessage } from '../types';
import { StructuredMessage } from './StructuredMessage';

const MODELS = [
    {
        id: 'instant',
        label: 'Gemini 2.5 Flash',
        variant: 'Instant',
        desc: 'Ultra-fast, lightweight drafting & quick edits',
        icon: Zap,
        iconColor: 'text-amber-500',
        iconBg: 'bg-amber-500/10',
        badges: [
            { text: '⚡ Ultra-Fast', style: 'bg-amber-500/10 text-amber-500 border border-amber-500/20' },
            { text: 'Text Only', style: 'bg-subtle-3 text-text-tertiary border border-subtle-8' }
        ]
    },
    {
        id: 'balanced',
        label: 'Gemini 2.5 Flash',
        variant: 'Balanced',
        desc: 'Balanced drafting, vision & web searching',
        icon: Compass,
        iconColor: 'text-indigo-500',
        iconBg: 'bg-indigo-500/10',
        badges: [
            { text: '👁️ Vision & Image Search', style: 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20' },
            { text: '🌐 Web Search', style: 'bg-blue-500/10 text-blue-400 border border-blue-500/20' }
        ]
    },
    {
        id: 'thinking',
        label: 'Gemini 2.5 Pro',
        variant: 'Thinking',
        desc: 'Advanced reasoning, deep logic & screenwriting rules',
        icon: Brain,
        iconColor: 'text-emerald-500',
        iconBg: 'bg-emerald-500/10',
        badges: [
            { text: '🧠 Advanced Reasoner', style: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' },
            { text: '👁️ Vision & Image Search', style: 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20' }
        ]
    },
    {
        id: 'deep',
        label: 'Gemini 2.5 Pro',
        variant: 'Deep',
        desc: 'Ultimate analysis, deep search & context comprehension',
        icon: Sparkles,
        iconColor: 'text-purple-500',
        iconBg: 'bg-purple-500/10',
        badges: [
            { text: '🌟 Ultimate Intelligence', style: 'bg-purple-500/10 text-purple-400 border border-purple-500/20' },
            { text: '👁️ Vision & Image Search', style: 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20' }
        ]
    }
];

interface AssistantChatProps {
    isGenerating: boolean;
    isCritiquing: boolean;
    onCritique: () => void;
    onGenerate: () => void;
    onFix: () => void;
    onTreatment: () => void;
    onExport: (format?: string) => void;
    onAnalyzeDialogue: () => void;
    onAnalyzeStructure: () => void;
    onSendMessage: (message: string, model?: string, images?: string[]) => void;
    messages: ChatMessage[];
    aiModel: string;
    onAiModelChange: (model: string) => void;
    isAiThinking?: boolean;
    aiStatus?: string;
}

function DynamicThinkingStream({ streamContent, actionType }: { streamContent?: string; actionType?: string }) {
    const content = streamContent || '';
    const hasThinking = content.includes('<THINKING>');
    const thinkingClosed = content.includes('</THINKING>');
    const hasToolCall = content.includes('__TOOL_CALL__:');

    let toolLabel = '';
    if (hasToolCall) {
        if (content.includes('__TOOL_CALL__:query_lore:')) toolLabel = '📚 Querying Lore Database...';
        else if (content.includes('__TOOL_CALL__:critique_scene')) toolLabel = '🔍 Running Scene Critique...';
        else if (content.includes('__TOOL_CALL__:propose_edit:')) toolLabel = '✏️ Proposing Script Edit...';
        else if (content.includes('__TOOL_CALL__:generate_outline')) toolLabel = '📋 Generating Story Outline...';
    }

    let phaseLabel = 'Connecting to AI...';
    if (content.length > 0) {
        if (hasThinking && !thinkingClosed) phaseLabel = 'Reasoning...';
        else if (toolLabel) phaseLabel = toolLabel;
        else if (thinkingClosed) phaseLabel = 'Composing response...';
        else phaseLabel = 'Generating...';
    }

    const phaseColor = hasThinking && !thinkingClosed
        ? 'text-[var(--accent)]'
        : toolLabel
            ? 'text-[var(--status-warning)]'
            : 'text-text-tertiary';

    return (
        <div className="flex flex-col gap-2 w-full max-w-[280px]">
            <div className="flex items-center gap-2">
                <span className="relative flex h-1.5 w-1.5 flex-shrink-0">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--accent)] opacity-75" />
                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-[var(--accent)]" />
                </span>
                <span className={`text-[10px] font-semibold ${phaseColor} transition-colors duration-300`}>
                    {phaseLabel}
                </span>
            </div>
            {hasThinking && !thinkingClosed && content.length > 20 && (
                <div className="text-[9px] text-text-tertiary font-mono leading-relaxed opacity-70 max-h-16 overflow-hidden pl-3.5" style={{ maskImage: 'linear-gradient(to bottom, black 60%, transparent)' }}>
                    {content.replace(/<THINKING>/gi, '').replace(/<\/THINKING>/gi, '').slice(-200)}
                </div>
            )}
        </div>
    );
}


export function AssistantChat({
    isGenerating,
    isCritiquing,
    onCritique,
    onGenerate,
    onFix,
    onTreatment,
    onExport,
    onAnalyzeDialogue,
    onAnalyzeStructure,
    onSendMessage,
    messages,
    aiModel,
    onAiModelChange,
    isAiThinking,
    aiStatus,
}: AssistantChatProps) {
    const { toggleRightPanel } = useScriptWriter();
    const [input, setInput] = useState('');
    const [attachedImages, setAttachedImages] = useState<string[]>([]);
    const scrollRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);
    const [dropdownOpen, setDropdownOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const activeModelInfo = MODELS.find(m => m.id === (aiModel || 'balanced'));

    useEffect(() => {
        if (scrollRef.current) {
            const el = scrollRef.current;
            const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
            if (nearBottom || messages[messages.length - 1]?.streaming) {
                el.scrollTop = el.scrollHeight;
            }
        }
    }, [messages]);

    const handleSend = () => {
        if ((!input.trim() && attachedImages.length === 0) || isGenerating || isCritiquing) return;
        onSendMessage(input.trim(), aiModel, attachedImages);
        setInput('');
        setAttachedImages([]);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files) return;
        
        Array.from(files).forEach(file => {
            const reader = new FileReader();
            reader.onloadend = () => {
                if (typeof reader.result === 'string') {
                    setAttachedImages(prev => [...prev, reader.result as string]);
                }
            };
            reader.readAsDataURL(file);
        });
        
        e.target.value = '';
    };

    const removeAttachedImage = (index: number) => {
        setAttachedImages(prev => prev.filter((_, i) => i !== index));
    };

    const isBusy = isGenerating || isCritiquing;

    return (
        <div className="flex flex-col h-full border-l border-subtle-8 bg-surface-sidebar">
            <div className="flex items-center justify-between px-3 py-2 border-b border-subtle-8">
                <div className="flex items-center gap-2">
                    <Bot size={13} className="text-intelligence" />
                    <span className="text-xs font-semibold text-text-primary">Assistant</span>
                </div>
                <div className="flex items-center gap-2">
                    {/* Active Gemini Model Profile Selector */}
                    <div ref={dropdownRef} className="relative select-none flex items-center">
                        <button
                            onClick={() => setDropdownOpen(!dropdownOpen)}
                            className="flex items-center gap-1 pl-5 pr-2 py-0.5 rounded-md border border-subtle-10 text-text-primary text-[9px] font-semibold bg-surface-elevated shadow-sm cursor-pointer outline-none hover:bg-subtle-3 hover:border-subtle-20 transition-all duration-120 focus-ring whitespace-nowrap"
                        >
                            <span className="whitespace-nowrap">
                                {activeModelInfo?.id === 'instant' || activeModelInfo?.id === 'balanced' ? 'Flash' : 'Pro'} <span className="opacity-60 font-normal">({activeModelInfo?.variant})</span>
                            </span>
                            <ChevronDown size={8} className={`transition-transform duration-200 text-text-tertiary ${dropdownOpen ? 'rotate-180' : ''}`} />
                        </button>
                        <span className="absolute left-1.5 top-1/2 -translate-y-1/2 flex h-1.5 w-1.5 pointer-events-none">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-accent"></span>
                        </span>

                        {dropdownOpen && (
                            <div className="absolute top-full right-0 mt-2 z-[200] bg-surface-elevated border border-subtle-8 rounded-xl p-1.5 shadow-xl min-w-[280px] animate-scale-in">
                                <div className="px-2.5 py-1 text-[9px] font-bold text-text-tertiary uppercase tracking-wider border-b border-subtle-8 mb-1">
                                    AI Model Assistant Profile
                                </div>
                                <div className="space-y-1">
                                    {MODELS.map(m => {
                                        const SelectedIcon = m.icon;
                                        const isSelected = (aiModel || 'balanced') === m.id;
                                        return (
                                            <button
                                                key={m.id}
                                                type="button"
                                                onClick={() => {
                                                    onAiModelChange?.(m.id);
                                                    setDropdownOpen(false);
                                                }}
                                                className={`w-full text-left p-2 rounded-lg transition-all focus-ring flex flex-col gap-1.5 ${
                                                    isSelected
                                                        ? 'bg-accent/5 border border-accent/15'
                                                        : 'border border-transparent hover:bg-subtle-2'
                                                }`}
                                            >
                                                <div className="flex items-start gap-2.5 w-full">
                                                    <div className={`p-1.5 rounded-lg ${m.iconBg} ${m.iconColor} flex-shrink-0`}>
                                                        <SelectedIcon size={13} />
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center justify-between">
                                                            <span className="text-[11px] font-semibold text-text-primary">
                                                                {m.label} <span className="opacity-60 font-normal">({m.variant})</span>
                                                            </span>
                                                            {isSelected && <Check size={11} className="text-accent flex-shrink-0" />}
                                                        </div>
                                                        <p className="text-[9px] text-text-tertiary leading-normal mt-0.5">
                                                            {m.desc}
                                                        </p>
                                                    </div>
                                                </div>
                                                <div className="flex flex-wrap gap-1 pl-7">
                                                    {m.badges.map((b, bi) => (
                                                        <span
                                                            key={bi}
                                                            className={`px-1.5 py-0.5 rounded text-[8px] font-medium leading-none ${b.style}`}
                                                        >
                                                            {b.text}
                                                        </span>
                                                    ))}
                                                </div>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </div>
                    <button onClick={toggleRightPanel} className="p-1 rounded-lg hover:bg-subtle-3 text-text-tertiary transition-colors focus-ring">
                        <PanelRight size={13} />
                    </button>
                </div>
            </div>

            <div ref={scrollRef} className="flex-1 overflow-y-auto scrollbar-hide p-3 space-y-3">
                {messages.length === 0 && !isAiThinking && !isBusy ? (
                    <div className="flex flex-col items-center justify-center h-full text-center px-4">
                        <div className="bg-surface-elevated border border-subtle-8 rounded-2xl p-2.5 shadow-sm text-accent bg-accent/5 mb-3">
                            <Bot size={22} className="opacity-80" />
                        </div>
                        <h3 className="text-xs font-semibold text-text-primary mb-1">Creative Assistant</h3>
                        <p className="text-[11px] text-text-tertiary leading-relaxed max-w-[200px] mb-3">
                            Your AI co-writer and script supervisor. Choose an option or write a message.
                        </p>
                        <div className="space-y-1.5 w-full max-w-[210px]">
                            {[
                                { text: 'Generate a scene from the summary', label: '🪄 Draft Scene' },
                                { text: 'Critique this scene for quality', label: '🔍 Critique Script' },
                                { text: 'Analyze dialogue rhythm', label: '🎭 Analyze Rhythm' }
                            ].map(hint => (
                                <button
                                    key={hint.text}
                                    onClick={() => { onSendMessage(hint.text); }}
                                    className="w-full text-left px-3 py-2 rounded-xl text-[11px] font-medium text-text-secondary bg-surface-elevated border border-subtle-8 hover:border-accent/30 hover:bg-accent/5 hover:text-accent transition-all duration-120 active:scale-[0.98] focus-ring shadow-sm flex items-center justify-between"
                                >
                                    <span>{hint.label}</span>
                                    <span className="text-[9px] text-text-tertiary opacity-70 font-normal">→</span>
                                </button>
                            ))}
                        </div>
                    </div>
                ) : (
                    <>
                        {messages.map(msg => (
                            <div key={msg.id} className={`flex gap-2 ${msg.role === 'user' ? 'justify-end' : ''}`}>
                                {msg.role === 'assistant' && (
                                    <div className="flex-shrink-0 mt-1">
                                        <Bot size={14} className="text-intelligence/70" />
                                    </div>
                                )}
                                <div className={`max-w-[85%] ${msg.role === 'user' ? 'order-1' : ''}`}>
                                    <div className={`rounded-xl px-3 py-2 text-sm leading-relaxed ${
                                        msg.role === 'user'
                                            ? 'bg-intelligence-soft text-text-primary'
                                            : msg.type === 'error'
                                                ? 'bg-status-error/5 text-status-error border border-status-error/10'
                                                : 'bg-subtle-2 border border-subtle-8 text-text-secondary'
                                    }`}>
                                        {msg.streaming && (!msg.content || msg.content.trim() === '') ? (
                                            <DynamicThinkingStream streamContent={msg.rawContent || msg.content} />
                                        ) : msg.role === 'user' ? (
                                            <div className="space-y-2">
                                                {msg.images && msg.images.length > 0 && (
                                                    <div className="flex flex-wrap gap-1.5 mb-1">
                                                        {msg.images.map((img, idx) => (
                                                            <img key={idx} src={img} alt="uploaded reference" className="max-w-[120px] max-h-[120px] object-cover rounded border border-subtle-8 shadow-sm" />
                                                        ))}
                                                    </div>
                                                )}
                                                <span className="whitespace-pre-wrap">{msg.content}</span>
                                            </div>
                                        ) : (
                                            <div className="relative">
                                                <StructuredMessage content={msg.content} isStreaming={msg.streaming} />
                                                {msg.streaming && (
                                                    <span className="inline-block w-1.5 h-3 ml-1 bg-accent/60 align-middle animate-pulse" />
                                                )}
                                            </div>
                                        )}
                                    </div>
                                    {msg.meta && msg.meta.score !== undefined && (
                                        <div className="mt-2 space-y-2">
                                            {msg.meta.details && msg.meta.details.length > 0 && (
                                                <div className="space-y-1">
                                                    {msg.meta.details.map((cat, ci) => cat.items.length > 0 && (
                                                        <div key={ci} className="text-xs text-text-secondary space-y-0.5">
                                                            <span className="text-[10px] font-bold text-text-tertiary uppercase tracking-wider block">{cat.label}</span>
                                                            {cat.items.slice(0, 3).map((item, ii) => (
                                                                <div key={ii} className="pl-2 leading-relaxed">{item}</div>
                                                            ))}
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                                {msg.role === 'user' && (
                                    <div className="flex-shrink-0 mt-1">
                                        <User size={14} className="text-text-tertiary" />
                                    </div>
                                )}
                            </div>
                        ))}
                        {(isBusy || isAiThinking) && messages[messages.length - 1]?.role !== 'assistant' && (
                            <div className="flex gap-2 animate-fade-in">
                                <Bot size={14} className="text-intelligence/70 flex-shrink-0 mt-1 animate-pulse" />
                                <div className="bg-subtle-2 border border-subtle-8 rounded-xl px-3 py-2">
                                    <DynamicThinkingStream />
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>

            {isAiThinking && aiStatus && (
                <div className="px-3 py-1.5 border-t border-subtle-8 bg-surface-elevated flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse flex-shrink-0" />
                    <span className="text-[10px] font-medium text-accent truncate">{aiStatus}</span>
                </div>
            )}

            <div className="border-t border-subtle-8 p-3">
                <div className="relative flex flex-col bg-surface-page border border-subtle-8 rounded-xl focus-within:border-accent/40 focus-within:ring-1 focus-within:ring-accent/10 transition-all duration-180 p-1">
                    {/* Attached Image Previews if any */}
                    {attachedImages.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 p-1.5 border-b border-subtle-5">
                            {attachedImages.map((img, idx) => (
                                <div key={idx} className="relative w-10 h-10 rounded border border-subtle-8 overflow-hidden group">
                                    <img src={img} alt="attached" className="w-full h-full object-cover" />
                                    <button
                                        onClick={() => removeAttachedImage(idx)}
                                        className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white text-[8px] font-bold transition-opacity duration-100 cursor-pointer border-0"
                                    >
                                        Remove
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}

                    <textarea
                        ref={inputRef}
                        value={input}
                        onChange={e => setInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="Ask the assistant..."
                        rows={1}
                        className="flex-1 px-3 py-2 text-sm bg-transparent border-0 text-text-primary placeholder:text-text-tertiary outline-none resize-none leading-relaxed min-h-[36px] max-h-24 w-full"
                        style={{ fieldSizing: 'content' }}
                    />
                    <div className="flex items-center justify-between px-2 pb-1 pt-0.5">
                        <div className="flex items-center gap-2">
                            {/* Hidden file input */}
                            <input
                                type="file"
                                id="assistant-image-input"
                                accept="image/*"
                                className="hidden"
                                onChange={handleImageUpload}
                                multiple
                            />
                            <label
                                htmlFor="assistant-image-input"
                                className="p-1 rounded text-text-tertiary hover:text-text-secondary hover:bg-subtle-3 transition-colors cursor-pointer flex items-center justify-center"
                                title="Attach reference image"
                            >
                                <Paperclip size={12} />
                            </label>
                            <span className="text-[9px] text-text-tertiary font-semibold">
                                Enter to send
                            </span>
                        </div>
                        <button
                            onClick={handleSend}
                            disabled={(!input.trim() && attachedImages.length === 0) || isBusy}
                            className="p-1.5 rounded-lg bg-intelligence text-white hover:bg-intelligence/90 transition-colors duration-120 active:scale-[0.95] focus-ring disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center cursor-pointer border-0"
                        >
                            <Send size={12} />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
