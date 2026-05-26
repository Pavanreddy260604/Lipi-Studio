import { useRef, useState, useCallback, memo } from 'react';
import { ArrowDown, ArrowUp, ChevronsDown, ChevronsUp, Bot } from 'lucide-react';
import { Virtuoso, type VirtuosoHandle } from 'react-virtuoso';
import { MessageRow } from './MessageRow';

interface MessageListProps {
    messages: any[];
    isLoading: boolean;
    isChatActive: boolean;
    isAtBottom: boolean;
    shouldAutoScroll: boolean;
    copiedBlockId: string | null;
    speakingMessageId: string | null;
    handleMessagesScroll: () => void;
    handleInteraction: () => void;
    handleCopyCode: (code: string, id: string) => void;
    handleSpeak: (text: string, id: string) => void;
    scrollToBottom: (behavior?: ScrollBehavior) => void;
    setShouldAutoScroll: (auto: boolean) => void;
    setInput: (content: string) => void;
    setIsAtBottom: (atBottom: boolean) => void;
    messagesContainerRef: React.RefObject<HTMLDivElement | null>;
    onRegenerate?: () => void;
}

const MessageJumper = memo(({
    show,
    virtuosoRef,
    totalItems,
}: {
    show: boolean;
    virtuosoRef: React.RefObject<VirtuosoHandle | null>;
    totalItems: number;
}) => {
    const jumpToTop = useCallback(() => virtuosoRef.current?.scrollToIndex({ index: 0, behavior: 'smooth' }), [virtuosoRef]);
    const jumpUp = useCallback(() => {
        virtuosoRef.current?.scrollBy({ top: -400, behavior: 'smooth' });
    }, [virtuosoRef]);
    const jumpDown = useCallback(() => {
        virtuosoRef.current?.scrollBy({ top: 400, behavior: 'smooth' });
    }, [virtuosoRef]);
    const jumpToBottom = useCallback(() => virtuosoRef.current?.scrollToIndex({ index: totalItems - 1, behavior: 'smooth' }), [virtuosoRef, totalItems]);

    if (!show) return null;

    return (
        <div className="absolute right-4 top-1/2 -translate-y-1/2 flex flex-col gap-1 z-20">
            <div className="bg-surface-elevated border border-subtle-8 shadow-[var(--shadow-md)] flex flex-col p-1 rounded-xl gap-0.5">
                <button onClick={jumpToTop} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-subtle-3 text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-all" title="Scroll to top">
                    <ChevronsUp size={16} />
                </button>
                <button onClick={jumpUp} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-subtle-3 text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-all" title="Scroll up">
                    <ArrowUp size={16} />
                </button>
                <button onClick={jumpDown} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-subtle-3 text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-all" title="Scroll down">
                    <ArrowDown size={16} />
                </button>
                <button onClick={jumpToBottom} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-subtle-3 text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-all" title="Scroll to bottom">
                    <ChevronsDown size={16} />
                </button>
            </div>
        </div>
    );
});

const ScrollBottomFab = memo(({ visible, onClick }: { visible: boolean; onClick: () => void }) => (
    <button
        onClick={onClick}
        className={`fixed bottom-28 right-8 z-20 bg-surface-elevated border border-subtle-8 text-primary hover:bg-subtle-2 w-12 h-12 p-0 flex items-center justify-center rounded-full shadow-[var(--shadow-lg)] transition-all duration-300 focus-ring ${visible ? 'opacity-100 scale-100' : 'opacity-0 scale-75 pointer-events-none'}`}
        aria-label="Scroll to bottom"
    >
        <ArrowDown size={20} />
    </button>
));

export const MessageList = memo(({
    messages,
    isLoading,
    isChatActive,
    isAtBottom,
    shouldAutoScroll,
    copiedBlockId,
    speakingMessageId,
    handleMessagesScroll,
    handleInteraction,
    handleCopyCode,
    handleSpeak,
    scrollToBottom,
    setShouldAutoScroll,
    setInput,
    setIsAtBottom,
    messagesContainerRef,
    onRegenerate,
}: MessageListProps) => {
    const virtuosoRef = useRef<VirtuosoHandle>(null);
    const [isRecentScroll, setIsRecentScroll] = useState(false);
    const scrollTimeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);

    const markRecentScroll = useCallback(() => {
        setIsRecentScroll(true);
        clearTimeout(scrollTimeoutRef.current);
        scrollTimeoutRef.current = setTimeout(() => setIsRecentScroll(false), 2500);
    }, []);

    const lastMessage = messages[messages.length - 1];
    const isLastAssistant = lastMessage?.role === 'assistant' && !isLoading && !!lastMessage?.content;

    if (!isChatActive) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center text-center gap-6 max-w-3xl mx-auto px-4 animate-fade-in">
                <div className="bg-surface-elevated border border-subtle-8 w-20 h-20 rounded-2xl flex items-center justify-center shadow-[var(--shadow-sm)]">
                    <Bot size={40} className="text-accent opacity-90" />
                </div>
                <div className="flex flex-col gap-4">
                    <h1 className="text-3xl font-semibold text-[var(--text-primary)] tracking-tight">Crystal OS</h1>
                    <p className="text-[var(--text-tertiary)] text-sm font-medium max-w-[480px] mx-auto">Ask, inspect, and keep momentum without leaving your workspace.</p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 w-full mt-6 max-w-2xl">
                    {["Deep Audit Codebase", "Analyze System Architecture", "Performance Optimization", "Security Vulnerability Scan"].map((prompt) => (
                        <button
                            key={prompt}
                            onClick={() => setInput(prompt)}
                            className="bg-surface-elevated border border-subtle-8 rounded-2xl shadow-[var(--shadow-sm)] text-left px-5 py-5 transition-all hover:border-accent hover:bg-subtle-2 focus-ring"
                        >
                            <div className="flex flex-col gap-1.5">
                                <span className="text-[14px] font-semibold tracking-tight text-[var(--text-primary)]">{prompt}</span>
                                <span className="text-[11px] font-medium text-[var(--text-tertiary)] opacity-80">
                                    {prompt === "Deep Audit Codebase" ? "Full structural analysis" :
                                        prompt === "Analyze System Architecture" ? "Pattern & dependency mapping" :
                                            prompt === "Performance Optimization" ? "Bottleneck identification" :
                                                "Hardening & threat modeling"}
                                </span>
                            </div>
                        </button>
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div className="flex-1 relative min-h-0 flex flex-col">
            <Virtuoso
                ref={virtuosoRef}
                scrollerRef={(ref) => {
                    if (ref) (messagesContainerRef as any).current = ref;
                }}
                data={messages}
                className="flex-1 custom-scrollbar"
                style={{ height: '100%', outline: 'none' }}
                components={{
                    Header: () => <div className="h-20 sm:h-32" />
                }}
                initialTopMostItemIndex={messages.length - 1}
                increaseViewportBy={1000}
                overscan={1200}
                computeItemKey={(index, msg) => msg.id || `${index}`}
                itemContent={(index, msg) => (
                    <div className="px-4 py-1 w-full flex justify-center">
                        <div className="w-full max-w-4xl">
                        <MessageRow
                            msg={msg}
                            idx={index}
                            isLoading={isLoading && index === messages.length - 1}
                            isLast={index === messages.length - 1}
                            handleCopyCode={handleCopyCode}
                            copiedBlockId={copiedBlockId}
                            onSpeak={(text: string) => handleSpeak(text, msg.id || `${index}`)}
                            isSpeakingThis={speakingMessageId === (msg.id || `${index}`)}
                            onRegenerate={index === messages.length - 1 && msg.role === 'assistant' ? onRegenerate : undefined}
                        />
                        </div>
                    </div>
                )}
                followOutput={(isAtBottom) => {
                    return shouldAutoScroll ? 'auto' : false;
                }}
                atBottomStateChange={(atBottom) => {
                    setIsAtBottom(atBottom);
                    if (atBottom && !shouldAutoScroll) {
                        setShouldAutoScroll(true);
                    }
                }}
                atBottomThreshold={80}
                onWheel={(e) => {
                    if (e.deltaY < 0 && shouldAutoScroll) {
                        setShouldAutoScroll(false);
                    }
                    markRecentScroll();
                }}
                onTouchStart={() => {
                    if (shouldAutoScroll) setShouldAutoScroll(false);
                    markRecentScroll();
                }}
                isScrolling={(scrolling) => {
                    if (scrolling) markRecentScroll();
                }}
            />

            <ScrollBottomFab
                visible={!isAtBottom && !shouldAutoScroll}
                onClick={() => {
                    setShouldAutoScroll(true);
                    virtuosoRef.current?.scrollToIndex({ index: messages.length - 1, behavior: 'smooth' });
                }}
            />

            <MessageJumper
                show={isRecentScroll && !isAtBottom}
                virtuosoRef={virtuosoRef}
                totalItems={messages.length}
            />
        </div>
    );
});
