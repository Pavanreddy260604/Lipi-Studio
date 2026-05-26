import { useState, useRef, useEffect, memo } from 'react';
import { Plus, X, Mic, Check, ArrowUp, Square, FileText, Image as ImageIcon, Wrench, Gauge, AlertTriangle } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { cn } from '../../../lib/utils';
import { useAI } from '../../../contexts/AIContext';
import { useChatStore } from '../../../stores/chatStore';
import { AI_MODELS, type AIModelOption } from '../../../config/aiModels';
import { getProviderIcon } from '../ChatUtils';
import { isDocFile, isTextLikeFile } from '../../../lib/chatUtils';
import { Textarea } from '../../../components/ui/Textarea';

interface ChatInputProps {
    isLoading: boolean;
    handleSend: (content: string, attachments: any[]) => void;
    handleStop: () => void;
    initialValue?: string;
    speech: any;
}

export const ChatInput = memo(({
    isLoading,
    handleSend,
    handleStop,
    initialValue = "",
    speech
}: ChatInputProps) => {
    const [localInput, setLocalInput] = useState(initialValue);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [attachments, setAttachments] = useState<any[]>([]);
    const { 
        isListening, 
        transcript, 
        startListening, 
        stopListening, 
        error: speechError
    } = speech;

    const [showModelMenu, setShowModelMenu] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);

    const selectedModel = useChatStore((s) => s.selectedModel);
    const setSelectedModel = useChatStore((s) => s.setSelectedModel);
    const { AI_MODELS, indexAttachment, ensureChatConversation } = useAI();
    const currentModel = AI_MODELS.find((m) => m.id === selectedModel);
    const isIndexing = attachments.some((att: any) => att.status === 'indexing' || att.status === 'pending');
    const supportsImages = currentModel?.supportsImages ?? false;

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
        if (initialValue) setLocalInput(initialValue);
    }, [initialValue]);

    const onSendClick = () => {
        if ((!localInput.trim() && attachments.length === 0) || isLoading || isIndexing) return;
        handleSend(localInput.trim(), attachments);
        setLocalInput('');
        setAttachments([]);
    };

    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files) return;

        const newFiles = Array.from(files).map(file => {
            const isImage = file.type.startsWith('image/');
            const isDoc = isDocFile(file);
            const isText = isTextLikeFile(file);
            const shouldIndex = !isImage && (isDoc || isText);
            const localId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

            if (isImage && !supportsImages) return null;
            if (!isImage && !isDoc && !isText) return null;

            return {
                localId,
                file,
                name: file.name,
                type: file.type,
                isImage,
                isBinary: isDoc,
                isText,
                shouldIndex,
                status: shouldIndex ? 'pending' : 'completed',
                preview: isImage ? URL.createObjectURL(file) : null
            };
        }).filter(Boolean) as any[];

        setAttachments(prev => [...prev, ...newFiles]);

        for (const att of newFiles) {
            if (att.isImage || att.isText) {
                const reader = new FileReader();
                reader.onload = (event) => {
                    setAttachments(prev => prev.map(a =>
                        a.localId === att.localId
                            ? { ...a, content: event.target?.result as string }
                            : a
                    ));
                };
                if (att.isImage) reader.readAsDataURL(att.file);
                else reader.readAsText(att.file);
            }

            if (att.shouldIndex) {
                try {
                    const activeConvId = await ensureChatConversation();
                    await indexAttachment(activeConvId, att, (patch) => {
                        setAttachments(prev => prev.map(a =>
                            a.localId === att.localId ? { ...a, ...patch } : a
                        ));
                    });
                } catch (err) {
                    console.error('Immediate indexing failed', err);
                }
            }
        }

        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const removeAttachment = (index: number) => {
        setAttachments(prev => prev.filter((_, i) => i !== index));
    };

    const renderCapabilityBadge = (model: AIModelOption) => {
        const speedTone = model.speedTier === 'fast'
            ? 'text-[var(--status-ok)]'
            : model.speedTier === 'deep'
                ? 'text-[var(--status-warning)]'
                : 'text-[var(--brand-primary)]';

        return (
            <div className="mt-1.5 flex flex-wrap items-center gap-1">
                <span className={cn("inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider border-subtle-8", speedTone)}>
                    <Gauge size={9} />
                    {model.speedTier}
                </span>
                {model.supportsFiles && (
                    <span className="inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider border-subtle-8 text-[var(--text-secondary)]">
                        <FileText size={9} />
                        Files
                    </span>
                )}
                {model.supportsImages && (
                    <span className="inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider border-subtle-8 text-[var(--text-secondary)]">
                        <ImageIcon size={9} />
                        Vision
                    </span>
                )}
                {model.supportsTools && (
                    <span className="inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider border-subtle-8 text-[var(--text-secondary)]">
                        <Wrench size={9} />
                        Tools
                    </span>
                )}
            </div>
        );
    };

    return (
        <div className="w-full flex justify-center px-4 pb-4 pt-2" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 12px)' }}>
            <div className="flex flex-col w-full max-w-4xl gap-2">
                <div className="bg-surface-elevated border border-subtle-8 shadow-[var(--shadow-md)] w-full flex flex-row items-center gap-3 px-3 py-2 rounded-2xl">
                    <div className="relative shrink-0" ref={menuRef}>
                        <button
                            onClick={() => setShowModelMenu(!showModelMenu)}
                            className={cn(
                                "flex items-center justify-center w-9 h-9 rounded-xl transition-all duration-300 hover:bg-subtle-3 text-secondary",
                                showModelMenu && "ring-2 ring-accent bg-subtle-3 text-primary"
                            )}
                            title={currentModel?.name}
                        >
                            {getProviderIcon(currentModel?.provider, 18)}
                        </button>

                        <AnimatePresence>
                            {showModelMenu && (
                                <motion.div
                                    initial={{ opacity: 0, y: 8, scale: 0.95 }}
                                    animate={{ opacity: 1, y: 0, scale: 1 }}
                                    exit={{ opacity: 0, y: 8, scale: 0.95 }}
                                    className="absolute bottom-full left-0 mb-3 w-[260px] max-w-[calc(100vw-32px)] rounded-2xl bg-surface-elevated border border-subtle-8 shadow-[var(--shadow-xl)] p-2 z-[100]"
                                >
                                    <div className="max-h-[320px] overflow-y-auto custom-scrollbar">
                                        {Array.from(new Set(AI_MODELS.map((m) => m.provider))).map((provider) => {
                                            const providerModels = AI_MODELS.filter((m) => m.provider === provider);
                                            return (
                                                <div key={provider} className="mb-2 last:mb-0">
                                                    <div className="px-2 py-1 flex items-center gap-2 border-b border-subtle-8 mb-1">
                                                        {getProviderIcon(provider, 12)}
                                                        <span className="text-[10px] font-black uppercase tracking-widest text-[var(--text-tertiary)]">
                                                            {provider}
                                                        </span>
                                                    </div>
                                                    <div className="flex flex-col gap-1.5">
                                                        {providerModels.map((model) => (
                                                            <button
                                                                key={model.id}
                                                                onClick={() => {
                                                                    setSelectedModel(model.id);
                                                                    setShowModelMenu(false);
                                                                }}
                                                                className={cn(
                                                                    "w-full flex items-center justify-between px-2 py-1.5 rounded-xl transition-all duration-150 group/item",
                                                                    selectedModel === model.id 
                                                                        ? "bg-accent/10 text-accent" 
                                                                        : "hover:bg-subtle-3 text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                                                                )}
                                                            >
                                                                <div className="flex flex-col items-start min-w-0">
                                                                    <span className="text-[10px] font-semibold truncate w-full flex items-center gap-1.5">
                                                                        {model.name}
                                                                    </span>
                                                                    <span className="text-[7px] opacity-50 truncate w-full text-left">
                                                                        {model.category}
                                                                    </span>
                                                                    {renderCapabilityBadge(model)}
                                                                </div>
                                                                {selectedModel === model.id && <Check size={10} className="shrink-0" />}
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>

                    <div className="flex-1 flex flex-col min-w-0 min-h-[44px] justify-center ml-1">
                        {attachments.length > 0 && (
                            <div className="flex flex-wrap gap-1.5 py-1.5 border-b border-subtle-8 mb-1.5 animate-fade-in">
                                {attachments.map((file, i) => (
                                    <div key={file.localId || i} className={cn(
                                        "flex items-center gap-1.5 px-2 py-1 rounded-lg border text-[10px] transition-all duration-300 group/chip relative overflow-hidden",
                                        file.status === 'indexing' || file.status === 'pending'
                                            ? "bg-accent/10 border-accent/20 text-accent"
                                            : file.status === 'failed'
                                                ? "bg-[var(--status-error)]/5 border-[var(--status-error)]/20 text-[var(--status-error)]"
                                                : "bg-subtle-2 border-subtle-8 text-secondary"
                                    )}>
                                        {(file.status === 'indexing' || file.status === 'pending') && (
                                            <motion.div
                                                initial={{ x: '-100%' }}
                                                animate={{ x: '100%' }}
                                                transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }}
                                                className="absolute inset-0 bg-gradient-to-r from-transparent via-brand-primary/10 to-transparent pointer-events-none"
                                            />
                                        )}

                                        <div className="shrink-0">
                                            {file.status === 'indexing' || file.status === 'pending' ? (
                                                <div className="w-3 h-3 border-2 border-brand-primary/30 border-t-[var(--brand-primary)] rounded-full animate-spin" />
                                            ) : file.status === 'completed' ? (
                                                <Check size={12} className="text-[var(--status-ok)]" />
                                            ) : file.status === 'failed' ? (
                                                <AlertTriangle size={12} />
                                            ) : (
                                                <FileText size={12} />
                                            )}
                                        </div>

                                        <span className="truncate max-w-[120px] font-medium z-10">{file.name}</span>
                                        
                                        {(file.status === 'indexing' || file.status === 'pending') && (
                                            <span className="text-[9px] opacity-70 italic animate-pulse">Indexing...</span>
                                        )}

                                        <button onClick={() => removeAttachment(i)} className="p-0.5 rounded-md hover:bg-[var(--status-error)]/10 hover:text-[var(--status-error)] transition-colors z-10">
                                            <X size={12} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                        {isIndexing && <div className="text-[10px] text-[var(--text-secondary)] px-1 mb-1">Indexing attachments...</div>}

                        <Textarea
                            value={localInput}
                            onChange={(e) => setLocalInput(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && !e.shiftKey) {
                                    e.preventDefault();
                                    if (!isIndexing) onSendClick();
                                }
                            }}
                            placeholder={isListening ? "Listening..." : "Ask anything"}
                            rows={1}
                            disabled={isLoading || isIndexing}
                            autoResize={true}
                            className={cn(
                                "w-full max-h-[200px] border-none bg-transparent !p-0 shadow-none focus-within:ring-0 focus-ring-0 transition-all",
                                isListening && "placeholder:text-accent animate-pulse"
                            )}
                        />
                        {speechError && <div className="mt-1 px-1 text-[10px] text-[var(--status-error)]">{speechError}</div>}
                    </div>

                    <div className="flex items-center gap-1 sm:gap-2 shrink-0 self-end mb-1">
                        <input
                            type="file"
                            ref={fileInputRef}
                            onChange={handleFileSelect}
                            multiple
                            className="hidden"
                            accept={`${supportsImages ? 'image/*,' : ''}.pdf,.doc,.docx,.txt,.md,.markdown,.js,.jsx,.ts,.tsx,.py,.css,.scss,.html,.htm,.json,.yml,.yaml,.toml,.csv,.xml,.sql,.sh,.bash,.zsh,.ps1,.bat,.cmd,.java,.kt,.c,.cpp,.h,.hpp,.go,.rs,.rb,.php,.lua,.xlsx,.xls`}
                        />
                        <button onClick={() => fileInputRef.current?.click()} className="w-9 h-9 p-0 flex items-center justify-center rounded-xl text-secondary hover:bg-subtle-4 transition-colors shrink-0">
                            <Plus size={18} />
                        </button>
                        <button onClick={toggleRecording} className={cn("w-9 h-9 p-0 flex items-center justify-center rounded-xl shrink-0 transition-colors", isListening ? "text-accent bg-accent/10" : "text-secondary hover:bg-subtle-4")}>
                            <Mic size={18} />
                        </button>
                        
                        {isLoading ? (
                            <button onClick={handleStop} className="w-9 h-9 flex items-center justify-center rounded-xl bg-[var(--status-error)]/10 text-[var(--status-error)] hover:bg-[var(--status-error)]/20 transition-all">
                                <Square size={16} fill="currentColor" />
                            </button>
                        ) : (
                            <button onClick={onSendClick} disabled={(!localInput.trim() && attachments.length === 0) || isIndexing} className={cn("w-9 h-9 flex items-center justify-center rounded-xl transition-all", (!localInput.trim() && attachments.length === 0) || isIndexing ? "bg-subtle-2 text-[var(--text-muted)] cursor-not-allowed border border-subtle-8" : "bg-[var(--text-primary)] text-black hover:opacity-90")}>
                                <ArrowUp size={20} strokeWidth={2.5} />
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
});
