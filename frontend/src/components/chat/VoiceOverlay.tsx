import { motion, AnimatePresence } from 'framer-motion';
import { X, Mic, Volume2 } from 'lucide-react';
import { useEffect } from 'react';
import { cn } from '../../lib/utils';
import { VoiceVisualizer } from './VoiceVisualizer';

interface VoiceOverlayProps {
    isOpen: boolean;
    onClose: () => void;
    onSend?: () => void;
    transcript: string;
    volume: number;
    isSpeaking: boolean;
    isListening: boolean;
    error?: string | null;
}

export function VoiceOverlay({ 
    isOpen, 
    onClose, 
    onSend,
    transcript, 
    volume, 
    isSpeaking, 
    isListening,
    error
}: VoiceOverlayProps) {
    // Escape key handler
    useEffect(() => {
        if (!isOpen) return;
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, onClose]);

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    key="voice-overlay-backdrop"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={onClose}
                    className="fixed inset-0 z-[11000] flex items-center justify-center bg-[var(--bg-app)] p-6 cursor-pointer"
                >
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            onClose();
                        }}
                        className="absolute top-8 right-8 p-3 rounded-full bg-console-surface hover:bg-console-surface-2 transition-colors text-text-primary z-[11001]"
                    >
                        <X size={24} />
                    </button>

                    <div 
                        className="max-w-xl w-full flex flex-col items-center gap-12 cursor-default"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex flex-col items-center gap-4 text-center">
                            <motion.div
                                animate={{ 
                                    scale: isListening ? [1, 1.05, 1] : 1,
                                    borderColor: error ? 'var(--status-error)' : (isListening ? 'var(--accent-primary)' : 'var(--border-subtle)')
                                }}
                                transition={{ repeat: Infinity, duration: 2 }}
                                className="w-20 h-20 rounded-full border-2 flex items-center justify-center bg-console-surface shadow-2xl"
                            >
                                {isSpeaking ? <Volume2 size={32} className="text-accent-primary" /> : <Mic size={32} className={cn(error ? "text-status-error" : "text-accent-primary")} />}
                            </motion.div>
                            <h2 className={cn("text-2xl font-bold tracking-tight", error ? "text-status-error" : "text-text-primary")}>
                                {error || (isSpeaking ? "AI is speaking..." : isListening ? "Listening..." : "Paused")}
                            </h2>
                        </div>

                        <VoiceVisualizer 
                            volume={volume} 
                            isSpeaking={isSpeaking} 
                            isListening={isListening} 
                        />

                        <div className="w-full min-h-[120px] bg-console-surface rounded-3xl p-8 border border-border-subtle shadow-inner">
                            <p className="text-xl text-text-primary/90 leading-relaxed font-medium">
                                {transcript || (isListening ? "Say something..." : "")}
                            </p>
                        </div>

                        {!isSpeaking && isListening && (
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    if (onSend) onSend(); else onClose();
                                }}
                                className="px-8 py-4 rounded-2xl bg-accent-primary text-console-bg font-bold hover:bg-accent-primary-dark transition-all shadow-xl shadow-accent-primary/20 active:scale-95"
                            >
                                Send Prompt
                            </button>
                        )}
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
