import React, { useState } from 'react';
import { Copy, Check, Sparkles, RotateCcw, Volume2, VolumeX, Bot, User, FileText } from 'lucide-react';
import { cn } from '../../../lib/utils';
import { AIChatRenderer } from '../AIChatRenderer';
import { getLoadingVisual } from '../LoadingStatusLabel';

interface MessageRowProps {
    msg: any;
    idx: number;
    isLoading: boolean;
    isLast: boolean;
    handleCopyCode: (code: string, id: string) => void;
    copiedBlockId: string | null;
    onSpeak: (text: string) => void;
    isSpeakingThis: boolean;
    onRegenerate?: () => void;
}

export const MessageRow = React.memo(({
    msg,
    idx,
    isLoading,
    isLast,
    handleCopyCode,
    copiedBlockId,
    onSpeak,
    isSpeakingThis,
    onRegenerate,
}: MessageRowProps) => {
    const isAssistantStreaming = isLoading && isLast && msg.role === 'assistant';
    const loadingVisual = getLoadingVisual(msg);
    const [copied, setCopied] = useState(false);

    const handleCopyMessage = () => {
        if (!msg.content) return;
        navigator.clipboard.writeText(msg.content).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
        });
    };

    const showActions = msg.role === 'assistant' && !isAssistantStreaming && msg.content;

    return (
        <div
            className={cn(
                "flex flex-col border-b border-subtle-5 group/row w-full animate-fade-in py-8",
                isAssistantStreaming && "is-streaming"
            )}
            style={{ animationDelay: `${Math.min(idx * 60, 600)}ms`, animationFillMode: 'both' }}
        >
            <div className="flex items-start gap-6 w-full">
                <div className="shrink-0 mt-1">
                    <div className={cn(
                        "w-9 h-9 rounded-2xl border flex items-center justify-center shadow-sm transition-transform group-hover/row:scale-105",
                        msg.role === 'user' 
                            ? "bg-subtle-2 border-subtle-8 text-text-secondary" 
                            : "bg-surface-elevated border-accent/20 text-accent"
                    )}>
                        {msg.role === 'user' ? <User size={16} /> : <Bot size={16} />}
                    </div>
                </div>

                <div className="flex-1 flex flex-col min-w-0">
                    <div className="flex items-center gap-3 mb-2">
                        <span className={cn(
                            "text-[10px] font-black uppercase tracking-widest",
                            msg.role === 'user' ? "text-text-muted" : "text-accent"
                        )}>
                            {msg.role === 'user' ? 'Operator' : 'Assistant.System'}
                        </span>
                        <span className="text-[10px] font-mono text-text-muted opacity-40">
                            [{msg.timestamp ? new Date(msg.timestamp).toLocaleTimeString([], { hour12: false }) : ''}]
                        </span>
                    </div>

                    {msg.attachments && msg.attachments.length > 0 && (
                        <div className="flex flex-wrap gap-2 mb-4">
                            {msg.attachments.map((file: any, i: number) => (
                                <div key={i} className="bg-subtle-2 border border-subtle-8 rounded-lg flex items-center gap-2 px-3 py-1.5 text-[9px] font-mono text-text-secondary">
                                    <FileText size={12} className="text-text-muted" />
                                    <span className="truncate max-w-[160px] uppercase">{file.name}</span>
                                </div>
                            ))}
                        </div>
                    )}

                    <div className={cn(
                        "text-[14px] leading-relaxed",
                        msg.role === 'assistant' ? "font-mono text-text-primary" : "text-text-secondary font-medium",
                        msg.status === 'failed' && "text-status-error",
                    )}>
                        <AIChatRenderer
                            content={msg.content}
                            isLoading={isLoading}
                            isLast={isLast}
                            handleCopyCode={handleCopyCode}
                            copiedBlockId={copiedBlockId}
                            modelUsed={msg.modelUsed}
                        />
                    </div>

                    {showActions && (
                        <div className="flex items-center gap-4 mt-6 opacity-0 group-hover/row:opacity-100 transition-opacity">
                            <button
                                onClick={handleCopyMessage}
                                className="flex items-center gap-2 text-[9px] font-black uppercase tracking-widest text-text-muted hover:text-text-primary transition-colors"
                            >
                                {copied ? <Check size={12} className="text-status-success" /> : <Copy size={12} />}
                                <span>Copy</span>
                            </button>
                            {onRegenerate && (
                                <button
                                    onClick={onRegenerate}
                                    className="flex items-center gap-2 text-[9px] font-black uppercase tracking-widest text-text-muted hover:text-text-primary transition-colors"
                                >
                                    <RotateCcw size={12} />
                                    <span>Sync</span>
                                </button>
                            )}
                            <button
                                onClick={() => onSpeak(msg.content)}
                                className="flex items-center gap-2 text-[9px] font-black uppercase tracking-widest text-text-muted hover:text-text-primary transition-colors"
                            >
                                {isSpeakingThis ? <VolumeX size={12} className="text-accent" /> : <Volume2 size={12} />}
                                <span>Speak</span>
                            </button>
                        </div>
                    )}

                    {isAssistantStreaming && !msg.content && (
                        <div className="flex items-center gap-3 mt-2 font-mono text-[10px] text-accent/60 uppercase tracking-widest">
                            <div className="flex gap-1">
                                <span className="w-1 h-1 rounded-full bg-accent animate-pulse" />
                                <span className="w-1 h-1 rounded-full bg-accent animate-pulse [animation-delay:200ms]" />
                                <span className="w-1 h-1 rounded-full bg-accent animate-pulse [animation-delay:400ms]" />
                            </div>
                            <span>Inference Process: {loadingVisual.title}</span>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
});
