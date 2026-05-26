// LEGACY: Duplicate of AIChatRenderer.tsx. This component is no longer imported/used.
// Kept for reference. Use AIChatRenderer instead.
import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { Copy, Check } from 'lucide-react';

interface AIChatMarkdownProps {
    content: string;
    isLoading: boolean;
    isLast: boolean;
    handleCopyCode: (code: string, id: string) => void;
    copiedBlockId: string | null;
    modelUsed?: string;
}

export const AIChatMarkdown = React.memo(({
    content,
    handleCopyCode,
    copiedBlockId,
}: AIChatMarkdownProps) => {
    if (!content) return null;

    return (
        <div className="prose prose-invert prose-sm max-w-none">
            <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                    code: ({ node, inline, className, children, ...props }: any) => {
                        const match = /language-(\w+)/.exec(className || '');
                        const codeContent = String(children).replace(/\n$/, '');

                        if (!inline && match) {
                            const blockId = `code-${content.length}-${match[1]}`;
                            return (
                                <div className="my-4 rounded-xl overflow-hidden bg-surface-elevated border border-subtle-8">
                                    <div className="flex items-center justify-between px-4 py-2 bg-subtle-2 border-b border-subtle-8">
                                        <span className="text-[10px] font-bold text-[var(--text-tertiary)] uppercase tracking-widest">{match[1]}</span>
                                        <button
                                            onClick={() => handleCopyCode(codeContent, blockId)}
                                            className="text-[var(--text-tertiary)] hover:text-[var(--brand-primary)] transition-colors"
                                        >
                                            {copiedBlockId === blockId ? <Check size={14} /> : <Copy size={14} />}
                                        </button>
                                    </div>
                                    <SyntaxHighlighter
                                        {...props}
                                        children={codeContent}
                                        style={vscDarkPlus}
                                        language={match[1]}
                                        PreTag="div"
                                        customStyle={{
                                            margin: 0,
                                            padding: '1rem',
                                            background: 'transparent',
                                            fontSize: '13px'
                                        }}
                                    />
                                </div>
                            );
                        }
                        return (
                            <code className="px-1.5 py-0.5 rounded bg-[var(--brand-soft)] text-[var(--brand-primary)] font-medium" {...props}>
                                {children}
                            </code>
                        );
                    }
                }}
            >
                {Array.isArray(content) ? content.join('\n') : String(content || '')}
            </ReactMarkdown>
        </div>
    );
});
