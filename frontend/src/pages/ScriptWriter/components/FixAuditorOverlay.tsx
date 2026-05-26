import { Check, X, Loader2, ArrowRight } from 'lucide-react';
import { Editor } from '@monaco-editor/react';
import type { PendingFixState } from '../types';

interface FixAuditorOverlayProps {
    originalContent: string;
    pendingFix: PendingFixState;
    onAccept: () => void;
    onDiscard: () => void;
}

export function FixAuditorOverlay({
    originalContent,
    pendingFix,
    onAccept,
    onDiscard
}: FixAuditorOverlayProps) {
    const currentScore = pendingFix.benchmarkScore ?? 0;
    const newScore = pendingFix.critique?.score ?? 0;
    const mode = pendingFix.mode || 'fix';
    const isProposal = mode === 'proposal';
    const auditLines = (pendingFix.auditNotes || '')
        .split('\n')
        .map((line) => line.replace(/^[•*-]\s*/, '').trim())
        .filter((line) => line.length > 0);

    const isDark = typeof document !== 'undefined' && document.documentElement.classList.contains('dark');

    return (
        <div className="absolute inset-0 z-[100] flex flex-col bg-bg-app/98">
            <div className="flex-none h-16 border-b border-subtle-8 bg-surface-elevated flex items-center justify-between px-6 relative z-[60]">
                <div className="flex items-center gap-4">
                    <span className="text-[11px] font-bold text-text-primary tracking-tight">
                        {isProposal ? 'AI Edit Proposal' : 'Suggested Revision'}
                    </span>
                    {currentScore > 0 && !pendingFix.isStreaming && (
                        <div className="flex items-center gap-2 px-3 py-1 rounded-lg bg-subtle-2 border border-subtle-8 text-[9px] font-mono">
                            <span className="text-text-tertiary">{currentScore}</span>
                            <ArrowRight size={10} className="text-text-tertiary" />
                            <span className="text-accent font-bold">{newScore}</span>
                        </div>
                    )}
                </div>

                <div className="flex items-center gap-3">
                    {pendingFix.isStreaming ? (
                        <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-subtle-2 border border-subtle-8">
                            <Loader2 size={14} className="text-accent animate-spin" />
                            <span className="text-[9px] font-bold text-accent uppercase tracking-wider">Generating...</span>
                        </div>
                    ) : (
                        <>
                            <button
                                onClick={onDiscard}
                                className="px-4 py-2 rounded-lg text-[9px] font-bold uppercase tracking-wider text-text-secondary hover:text-text-primary hover:bg-subtle-3 transition-all active:scale-95 focus-ring border border-subtle-8"
                            >
                                <X size={12} className="mr-1.5 inline" />
                                Discard
                            </button>
                            <button
                                onClick={onAccept}
                                className="px-4 py-2 rounded-lg text-[9px] font-bold uppercase tracking-wider text-white transition-all active:scale-95 focus-ring"
                                style={{ backgroundColor: 'var(--accent-soft)' }}
                            >
                                <Check size={12} className="mr-1.5 inline" />
                                {isProposal ? 'Apply' : 'Accept'}
                            </button>
                        </>
                    )}
                </div>
            </div>

            <div className="flex-1 overflow-hidden flex flex-row">
                {auditLines.length > 0 && (
                    <div className="w-72 border-r border-subtle-8 bg-surface-page p-4 flex flex-col gap-3 overflow-y-auto">
                        <span className="text-[8px] font-bold uppercase tracking-wider text-text-tertiary">Editor's Notes</span>
                        <div className="flex flex-col gap-2">
                            {auditLines.map((line, index) => (
                                <div key={`${line}-${index}`} className="p-3 bg-subtle-2 rounded-xl text-[10px] text-text-secondary leading-relaxed italic">
                                    {line}
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                <div className="flex-1 flex flex-col relative bg-bg-app">
                    <div className="flex-1 relative">
                        <Editor
                            value={pendingFix.content}
                            language="markdown"
                            theme={isDark ? 'vs-dark' : 'vs'}
                            options={{
                                readOnly: true,
                                minimap: { enabled: false },
                                scrollBeyondLastLine: false,
                                fontSize: 13,
                                lineNumbers: 'on',
                                wordWrap: 'on',
                                automaticLayout: true,
                                scrollbar: {
                                    verticalScrollbarSize: 8,
                                    horizontalScrollbarSize: 8
                                }
                            }}
                        />
                    </div>
                </div>
            </div>

            <div className="flex-none h-8 bg-surface-elevated border-t border-subtle-8 px-4 flex items-center text-[8px] text-text-tertiary gap-4">
                <span>Preview</span>
                <span className="w-px h-3 bg-subtle-8" />
                <span className="text-accent/60">Proposed Draft</span>
            </div>
        </div>
    );
}
