import { useState, useRef, useEffect, memo, useCallback } from 'react';
import { MessageSquare, Send, Sparkles, Bot, X, Check, ArrowDown, Plus, Mic, ChevronDown, Volume2, StopCircle, FileText, Image as ImageIcon, Wrench, Gauge } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link, useLocation } from 'react-router-dom';
import { useAI } from '../contexts/AIContext';
import { useChatStore } from '../stores/chatStore';
import { useAuthStore } from '../stores/authStore';
import { type AIModelOption } from '../config/aiModels';
import { useSpeech } from '../hooks/useSpeech';
import { useMobile } from '../hooks/useMobile';
import { cn } from '../lib/utils';
import { AIChatRenderer as AIChatMarkdown } from './chat/AIChatRenderer';
import { getProviderIcon } from './chat/ChatUtils';
import { Button } from './ui/Button';
import { Textarea } from './ui/Textarea';
import { Stack } from './ui/Stack';
import { Badge } from './ui/Badge';

const TEXT_EXTENSIONS = new Set([
    '.txt', '.md', '.markdown', '.json', '.js', '.jsx', '.ts', '.tsx', '.py', '.css', '.scss', '.sass',
    '.html', '.htm', '.xml', '.csv', '.yml', '.yaml', '.toml', '.ini', '.conf', '.log', '.env',
    '.sql', '.sh', '.bash', '.zsh', '.ps1', '.bat', '.cmd',
    '.java', '.kt', '.swift', '.c', '.cpp', '.h', '.hpp', '.go', '.rs', '.rb', '.php', '.lua', '.r'
]);

const TEXT_MIME_TYPES = new Set([
    'application/json',
    'application/javascript',
    'application/x-javascript',
    'application/typescript',
    'application/x-typescript',
    'application/xml',
    'text/xml',
    'text/markdown',
    'text/x-markdown',
    'text/csv',
    'application/csv',
    'application/x-yaml',
    'text/yaml',
    'text/x-yaml',
    'application/x-sh',
    'text/x-shellscript',
]);

const isTextLikeFile = (file: File) => {
    const type = (file.type || '').toLowerCase();
    const name = file.name.toLowerCase();
    const dotIndex = name.lastIndexOf('.');
    const ext = dotIndex !== -1 ? name.slice(dotIndex) : '';
    return type.startsWith('text/') || TEXT_MIME_TYPES.has(type) || (ext && TEXT_EXTENSIONS.has(ext));
};

const isDocFile = (file: File) => {
    const type = (file.type || '').toLowerCase();
    return (
        type === 'application/pdf' ||
        type === 'application/msword' ||
        type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    );
};

const AIChatInput = memo(({
    isLoading,
    handleSend,
    speech
}: {
    isLoading: boolean,
    handleSend: (content: string, attachments: any[]) => void,
    speech: any
}) => {
    const [localInput, setLocalInput] = useState('');
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [attachments, setAttachments] = useState<any[]>([]);
    const [showModelMenu, setShowModelMenu] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);

    const { 
        isListening, 
        transcript, 
        startListening, 
        stopListening,
        volume,
        error
    } = speech;

    const selectedModel = useChatStore((s) => s.selectedModel);
    const setSelectedModel = useChatStore((s) => s.setSelectedModel);
    const { AI_MODELS } = useAI();
    const currentModel = AI_MODELS.find((m) => m.id === selectedModel);
    const supportsImages = currentModel?.supportsImages ?? false;
    const isIndexing = attachments.some((att: any) => att.status === 'indexing');

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setShowModelMenu(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const [baseInputBeforeVoice, setBaseInputBeforeVoice] = useState('');

    useEffect(() => {
        if (isListening && transcript) {
            setLocalInput(baseInputBeforeVoice + transcript);
        }
    }, [transcript, isListening, baseInputBeforeVoice]);

    const toggleRecording = () => {
        if (isListening) {
            stopListening();
        } else {
            setBaseInputBeforeVoice(localInput.trim() ? localInput.trim() + ' ' : '');
            startListening();
        }
    };

    useEffect(() => {
        const textarea = textareaRef.current;
        if (textarea) {
            textarea.style.height = 'auto';
            textarea.style.height = `${Math.min(textarea.scrollHeight, 160)}px`;
        }
    }, [localInput]);

    const onSendClick = (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        if ((!localInput.trim() && attachments.length === 0) || isLoading || isIndexing) return;
        handleSend(localInput.trim(), attachments);
        setLocalInput('');
        setAttachments([]);
    };

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files) return;

        Array.from(files).forEach(file => {
            const isImage = file.type.startsWith('image/');
            const isVideo = file.type.startsWith('video/');
            const isDoc = isDocFile(file);
            const isText = isTextLikeFile(file);
            const shouldIndex = !isImage && (isDoc || isText);
            const localId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

            if (isImage && !supportsImages) {
                if (import.meta.env.DEV) console.warn(`[AI Chat] Skipping image attachment (model does not support images): ${file.name}`);
                return;
            }
            if (isVideo) {
                if (import.meta.env.DEV) console.warn(`[AI Chat] Video attachments are not supported yet: ${file.name}`);
                return;
            }
            if (!isImage && !isDoc && !isText) {
                if (import.meta.env.DEV) console.warn(`[AI Chat] Unsupported attachment type: ${file.name}`);
                return;
            }

            setAttachments(prev => [...prev, {
                localId,
                name: file.name,
                type: file.type,
                file,
                isImage,
                isBinary: isDoc,
                isText,
                shouldIndex,
                status: shouldIndex ? 'pending' : 'completed'
            }]);

            if (isImage || isText) {
                const reader = new FileReader();
                reader.onload = (ev) => {
                    setAttachments(prev => prev.map(att => att.localId === localId
                        ? { ...att, content: ev.target?.result as string }
                        : att
                    ));
                };

                if (isImage) {
                    reader.readAsDataURL(file);
                } else {
                    reader.readAsText(file);
                }
            }
        });
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const removeAttachment = (index: number) => {
        setAttachments(prev => prev.filter((_, i) => i !== index));
    };

    return (
        <Stack direction="vertical" gap={2} className="shrink-0 z-10 w-full px-4 pb-4 pt-2 border-t border-subtle bg-surface-overlay">
            <Stack direction="horizontal" justify="center" className="relative mb-1" ref={menuRef}>
                <Button
                    variant="secondary"
                    size="sm"
                    onClick={(e) => {
                        e.stopPropagation();
                        setShowModelMenu(!showModelMenu);
                    }}
                    className={cn(
                        "h-6 px-2 rounded-lg transition-all duration-150",
                        showModelMenu ? "bg-subtle-10 text-accent border-accent" : "bg-transparent text-text-secondary border-subtle hover:bg-subtle-5"
                    )}
                >
                    <Stack direction="horizontal" align="center" gap={1} className="min-w-0">
                        {getProviderIcon(currentModel?.provider, 12)}
                        <span className="text-[9px] font-bold uppercase tracking-wider truncate max-w-[100px]">
                            {currentModel?.name}
                        </span>
                    </Stack>
                    <ChevronDown size={8} className={cn("transition-transform ml-1", showModelMenu && "rotate-180")} />
                </Button>

                <AnimatePresence>
                    {showModelMenu && (
                        <motion.div
                            initial={{ opacity: 0, y: 8, scale: 0.98 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: 8, scale: 0.98 }}
                            className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-[240px] rounded-xl p-1.5 z-50 shadow-2xl bg-surface-elevated border border-subtle"
                        >
                            <div className="max-h-[320px] overflow-y-auto custom-scrollbar">
                                {Array.from(new Set(AI_MODELS.map((m) => m.provider))).map((provider) => {
                                    const providerModels = AI_MODELS.filter((m) => m.provider === provider);
                                    if (providerModels.length === 0) return null;
                                    
                                    return (
                                        <div key={provider} className="mb-2 last:mb-0">
                                            <div className="px-2 py-1 flex items-center gap-1.5 border-b border-subtle mb-1">
                                                {getProviderIcon(provider)}
                                                <span className="text-[9px] font-black uppercase tracking-widest text-text-tertiary">
                                                    {provider}
                                                </span>
                                            </div>
                                            <Stack direction="vertical" gap={1}>
                                                {providerModels.map((model) => (
                                                    <Button
                                                        key={model.id}
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => {
                                                            setSelectedModel(model.id);
                                                            setShowModelMenu(false);
                                                        }}
                                                        className={cn(
                                                            "w-full justify-between px-2 py-1 h-auto",
                                                            selectedModel === model.id 
                                                                ? "bg-subtle-10 text-accent" 
                                                                : "text-text-secondary hover:text-text-primary"
                                                        )}>
                                                        <Stack direction="vertical" align="start" className="min-w-0">
                                                            <span className="text-[9px] font-bold truncate w-full text-left">
                                                                {model.name}
                                                            </span>
                                                            <span className="text-[7px] opacity-60 truncate w-full text-left">
                                                                {model.category}
                                                            </span>
                                                            {renderCapabilityBadge(model)}
                                                        </Stack>
                                                        {selectedModel === model.id && (
                                                            <Check size={12} className="shrink-0" />
                                                        )}
                                                    </Button>
                                                ))}
                                            </Stack>
                                        </div>
                                    );
                                })}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </Stack>

            <div className="w-full flex flex-col gap-2 p-3 rounded-xl shadow-lg bg-surface-elevated border border-subtle">
                {attachments.length > 0 && (
                    <div className="flex flex-wrap gap-2 pb-2 border-b border-subtle mb-1">
                        {attachments.map((file, i) => (
                            <div 
                                key={i} 
                                className="flex items-center gap-1.5 px-2 py-1 rounded-md border border-subtle bg-surface-overlay text-[10px] text-text-secondary"
                            >
                                <span className="truncate max-w-[120px]">{file.name}</span>
                                <Button variant="ghost" size="sm" onClick={() => removeAttachment(i)} className="h-4 w-4 p-0 hover:text-status-error">
                                    <X size={12} />
                                </Button>
                            </div>
                        ))}
                    </div>
                )}
                
                <Stack direction="horizontal" align="center" gap={3}>
                    <Button 
                        variant="secondary"
                        size="sm"
                        onClick={() => fileInputRef.current?.click()}
                        className="w-9 h-9 p-0 rounded-lg border border-subtle"
                        aria-label="Add attachment"
                    >
                        <Plus size={20} />
                    </Button>
                    
                    <input 
                        type="file" 
                        ref={fileInputRef} 
                        className="hidden" 
                        multiple 
                        accept={`${supportsImages ? 'image/*,' : ''}.pdf,.doc,.docx,.txt,.md,.markdown,.js,.jsx,.ts,.tsx,.py,.css,.scss,.html,.htm,.json,.yml,.yaml,.toml,.csv,.xml,.sql,.sh,.bash,.zsh,.ps1,.bat,.cmd,.java,.kt,.c,.cpp,.h,.hpp,.go,.rs,.rb,.php,.lua`}
                        onChange={handleFileSelect}
                    />

                    <Textarea
                        ref={textareaRef as any}
                        value={localInput}
                        onChange={(e) => setLocalInput(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                if (!isIndexing) onSendClick();
                            }
                        }}
                        placeholder={isListening ? "Listening..." : "Command..."}
                        disabled={isLoading || isIndexing}
                        rows={1}
                        className={cn(
                            "flex-1 border-none bg-transparent py-2 min-h-0 h-auto focus:ring-0 text-sm resize-none scrollbar-hide max-h-32 text-text-primary placeholder:text-text-tertiary shadow-none",
                            isListening && "animate-pulse"
                        )}
                    />

                    <Stack direction="horizontal" align="center" gap={1}>
                        <Button 
                            variant="secondary"
                            size="sm"
                            onClick={toggleRecording}
                            className={cn(
                                "w-9 h-9 p-0 rounded-lg border relative overflow-hidden",
                                isListening 
                                    ? "border-accent text-accent bg-subtle-10" 
                                    : "border-subtle text-text-secondary"
                            )} 
                            aria-label="Voice"
                        >
                            <Mic size={20} className={cn("z-10", isListening && "animate-pulse")} />
                            {isListening && (
                                <motion.div
                                    className="absolute inset-0 bg-accent/10 rounded-full"
                                    animate={{ scale: [1, 2], opacity: [0.5, 0] }}
                                    transition={{ duration: 1, repeat: Infinity, ease: "easeOut" }}
                                />
                            )}
                        </Button>
                        <Button
                            variant="primary"
                            size="sm"
                            onClick={() => onSendClick()}
                            disabled={isLoading || isIndexing || (!localInput.trim() && attachments.length === 0)}
                            className="w-9 h-9 p-0 rounded-lg shadow-lg"
                        >
                            <Send size={18} />
                        </Button>
                    </Stack>
                </Stack>
            </div>
        </Stack>
    );
});

export function GlobalAIWidget() {
    const isOpen = useChatStore((s) => s.isOpen);
    const messages = useChatStore((s) => s.messages);
    const isLoading = useChatStore((s) => s.isLoading);
    const toggleOpen = useChatStore((s) => s.toggleOpen);
    const { sendMessage } = useAI();
    const { isMobile } = useMobile();
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const messagesContainerRef = useRef<HTMLDivElement>(null);
    const [shouldAutoScroll, setShouldAutoScroll] = useState(true);
    const [isAtBottom, setIsAtBottom] = useState(true);
    const userInteractionRef = useRef<number>(0);

    const location = useLocation();

    const hasBottomNav = !['/login', '/register', '/chat', '/script-writer'].some(p => location.pathname.startsWith(p));
    const navOffset = (hasBottomNav && !isMobile) ? 'var(--bottom-nav-height, 72px)' : '0px';

    const scrollToBottom = useCallback((behavior: ScrollBehavior = 'smooth') => {
        if (messagesContainerRef.current) {
            const isUserInteracting = Date.now() - userInteractionRef.current < 1500;
            if (isUserInteracting && !isAtBottom) return;

            const { scrollHeight, clientHeight } = messagesContainerRef.current;
            messagesContainerRef.current.scrollTo({
                top: scrollHeight - clientHeight,
                behavior
            });
        }
    }, [isAtBottom]);

    const { isSpeaking, speak, stopSpeaking, volume, isListening, transcript, startListening, stopListening, error } = useSpeech();
    const speech = { isSpeaking, speak, stopSpeaking, volume, isListening, transcript, startListening, stopListening, error };
    const [speakingMessageId, setSpeakingMessageId] = useState<string | null>(null);

    const handleSpeak = useCallback((text: string, msgId: string) => {
        if (speakingMessageId === msgId) {
            stopSpeaking();
            setSpeakingMessageId(null);
        } else {
            setSpeakingMessageId(msgId);
            speak(text);
        }
    }, [speakingMessageId, speak, stopSpeaking]);

    useEffect(() => {
        if (!isSpeaking) setSpeakingMessageId(null);
    }, [isSpeaking]);

    const handleInteraction = useCallback(() => {
        userInteractionRef.current = Date.now();
    }, []);

    const handleMessagesScroll = useCallback(() => {
        const container = messagesContainerRef.current;
        if (!container) return;
        const { scrollTop, scrollHeight, clientHeight } = container;
        const distanceFromBottom = scrollHeight - scrollTop - clientHeight;

        const currentlyAtBottom = distanceFromBottom < 10;
        const userHasScrolledUpSignificantly = distanceFromBottom > 60;

        setIsAtBottom(currentlyAtBottom);
        if (userHasScrolledUpSignificantly && shouldAutoScroll) {
            setShouldAutoScroll(false);
        } else if (currentlyAtBottom && !shouldAutoScroll) {
            setShouldAutoScroll(true);
        }
    }, [shouldAutoScroll]);

    useEffect(() => {
        if (isLoading && shouldAutoScroll) {
            scrollToBottom('auto');
        }
    }, [isLoading, shouldAutoScroll, scrollToBottom]);

    const handleSend = useCallback(async (content: string, attachments: any[] = []) => {
        if ((!content.trim() && attachments.length === 0) || isLoading) return;
        setShouldAutoScroll(true);
        await sendMessage(content.trim(), attachments, () => {
            if (shouldAutoScroll) {
                requestAnimationFrame(() => scrollToBottom('auto'));
            }
        });
    }, [isLoading, sendMessage, shouldAutoScroll, scrollToBottom]);

    return (
        <AnimatePresence>
            {isOpen && (
                <div
                    className="fixed inset-0 z-[10000] flex items-center justify-center sm:items-end sm:justify-end sm:p-6 pointer-events-none"
                    style={{ '--current-nav-offset': navOffset } as React.CSSProperties}
                >
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 20 }}
                        transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                        className="w-full sm:max-w-[440px] h-dvh sm:h-[720px] max-h-dvh sm:max-h-[85vh] flex flex-col overflow-hidden pointer-events-auto rounded-t-2xl sm:rounded-xl shadow-2xl bg-surface-elevated border border-subtle"
                    >
                        <Stack direction="horizontal" align="center" justify="between" className="shrink-0 px-4 h-12 border-b border-subtle bg-surface-overlay">
                            <Stack direction="horizontal" align="center" gap={3} className="overflow-hidden">
                                <div className="p-1.5 rounded-lg" style={{ color: 'var(--ai-accent)' }}>
                                    <Bot size={20} />
                                </div>
                                <Stack direction="vertical" gap={0} className="min-w-0">
                                    <span className="font-semibold text-sm truncate text-text-primary">AI Assistant</span>
                                    <span className="text-[10px] font-medium text-text-tertiary uppercase tracking-wider">System Node 01</span>
                                </Stack>
                            </Stack>
                            <Stack direction="horizontal" align="center" gap={1}>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={toggleOpen}
                                    className="p-2 h-auto rounded-lg text-text-secondary"
                                    aria-label="Close"
                                >
                                    <X size={18} />
                                </Button>
                            </Stack>
                        </Stack>

                        <div
                            ref={messagesContainerRef}
                            onScroll={handleMessagesScroll}
                            onWheel={handleInteraction}
                            onTouchStart={handleInteraction}
                            onTouchMove={handleInteraction}
                            onMouseDown={handleInteraction}
                            className="flex-1 overflow-y-auto p-0 scroll-smooth relative custom-scrollbar bg-surface-page"
                            style={{ 
                                overflowAnchor: 'auto', 
                                scrollBehavior: 'auto',
                            } as any}
                        >
                            {messages.length === 0 ? (
                                <Stack direction="vertical" align="center" justify="center" className="h-full p-8 text-center animate-fade-in">
                                    <div className="w-16 h-16 rounded-xl flex items-center justify-center mb-6 border border-subtle bg-surface-overlay" style={{ color: 'var(--ai-accent)' }}>
                                        <Sparkles size={32} />
                                    </div>
                                    <h3 className="text-lg font-bold tracking-tight text-text-primary mb-1">Intelligence Layer</h3>
                                    <p className="text-[10px] font-bold text-text-tertiary uppercase tracking-[0.2em] max-w-[240px] leading-relaxed">
                                        Active Research & Strategy Support
                                    </p>
                                </Stack>
                            ) : (
                                <div className="flex flex-col">
                                    {messages.map((msg) => (
                                        <div
                                            key={msg.id}
                                            className={cn(
                                                "px-6 py-8 border-b border-subtle-8",
                                                msg.role === 'user' ? "bg-subtle-2" : "bg-transparent"
                                            )}
                                        >
                                            <Stack direction="vertical" className="w-full">
                                                <Stack direction="horizontal" align="center" gap={2} className="mb-4">
                                                    <span className="text-[10px] font-black uppercase tracking-widest" style={{ color: msg.role === 'user' ? 'var(--text-secondary)' : 'var(--ai-accent)' }}>
                                                        {msg.role === 'user' ? 'User' : 'Assistant'}
                                                    </span>
                                                    <div className="h-[1px] flex-1 bg-subtle" />
                                                </Stack>

                                                <div className="w-full overflow-hidden">
                                                    {msg.role === 'user' && msg.attachments && msg.attachments.length > 0 && (
                                                        <div className="flex flex-wrap gap-2 mb-4">
                                                            {msg.attachments.map((file: any, i: number) => (
                                                                <div 
                                                                    key={i} 
                                                                    className="flex items-center gap-2 px-2 py-1 rounded-md border border-subtle bg-surface-overlay text-[10px] text-text-secondary"
                                                                >
                                                                    <FileText size={12} />
                                                                    <span className="truncate max-w-[120px]">{file.name}</span>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}

                                                    <div className={cn(
                                                        "w-full text-text-primary",
                                                        isLoading && msg.role === 'assistant' && !msg.content && "animate-pulse"
                                                    )}>
                                                        {msg.role === 'assistant' && !msg.content ? (
                                                            <Stack direction="horizontal" align="center" gap={2} className="h-6">
                                                                <motion.div animate={{ opacity: [0.4, 1, 0.4] }} transition={{ repeat: Infinity, duration: 1.2 }} className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: 'var(--ai-accent)' }} />
                                                                <motion.div animate={{ opacity: [0.4, 1, 0.4] }} transition={{ repeat: Infinity, duration: 1.2, delay: 0.2 }} className="w-1.5 h-1.5 opacity-60 rounded-full" style={{ backgroundColor: 'var(--ai-accent)' }} />
                                                                <motion.div animate={{ opacity: [0.4, 1, 0.4] }} transition={{ repeat: Infinity, duration: 1.2, delay: 0.4 }} className="w-1.5 h-1.5 opacity-30 rounded-full" style={{ backgroundColor: 'var(--ai-accent)' }} />
                                                            </Stack>
                                                        ) : (
                                                            <AIChatMarkdown content={msg.content} isLoading={isLoading} isLast={msg.id === messages[messages.length-1].id} modelUsed={msg.modelUsed} />
                                                        )}
                                                    </div>
                                                </div>
                                            </Stack>
                                        </div>
                                    ))}
                                    <div ref={messagesEndRef} className="h-4 shrink-0" />
                                </div>
                            )}
                            {!isAtBottom && (
                                <Button
                                    variant="secondary"
                                    size="sm"
                                    onClick={() => {
                                        scrollToBottom('smooth');
                                        setShouldAutoScroll(true);
                                    }}
                                    className="absolute right-6 bottom-24 flex items-center justify-center w-10 h-10 rounded-full z-50 shadow-xl border border-subtle bg-surface-elevated text-text-primary"
                                    aria-label="Scroll to bottom"
                                >
                                    <ArrowDown size={18} />
                                </Button>
                            )}
                        </div>

                        <AIChatInput
                            isLoading={isLoading}
                            handleSend={handleSend}
                            speech={speech}
                        />

                        <div className="text-[8px] font-bold text-text-tertiary uppercase tracking-[0.2em] text-center pb-3 opacity-50 border-t border-subtle pt-2 bg-surface-overlay">
                            Crystal Engine / Intelligence Node
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}

export function GlobalAIWidgetWithAuth() {
    const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
    if (!isAuthenticated) return null;
    return <GlobalAIWidget />;
}

const renderCapabilityBadge = (model: AIModelOption) => {
    return (
        <div className="mt-1 flex flex-wrap items-center gap-1.5">
            <Badge variant="secondary" className="px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider border-subtle bg-surface-overlay text-text-tertiary gap-1">
                <Gauge size={8} />
                {model.speedTier}
            </Badge>
            {model.supportsFiles && (
                <Badge variant="secondary" className="px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider border-subtle bg-surface-overlay text-text-tertiary gap-1">
                    <FileText size={8} />
                    Files
                </Badge>
            )}
            {model.supportsImages && (
                <Badge variant="secondary" className="px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider border-subtle bg-surface-overlay text-text-tertiary gap-1">
                    <ImageIcon size={8} />
                    Vision
                </Badge>
            )}
            {model.supportsTools && (
                <Badge variant="secondary" className="px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider border-subtle bg-surface-overlay text-text-tertiary gap-1">
                    <Wrench size={8} />
                    Tools
                </Badge>
            )}
        </div>
    );
};
