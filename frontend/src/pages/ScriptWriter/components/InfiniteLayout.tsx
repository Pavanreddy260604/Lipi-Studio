import { useEffect, useRef, useState, useCallback } from 'react';
import type { ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useMobile } from '../../../hooks/useMobile';
import { useScriptWriter } from '../../../contexts/ScriptWriterContext';
import { cn } from '../../../lib/utils';
import { PanelLeft, PanelRight, FileText, Globe, Sparkles } from 'lucide-react';

interface InfiniteLayoutProps {
    leftPanel?: ReactNode;
    rightPanel?: ReactNode;
    beatBoard?: ReactNode;
    children: ReactNode;
    leftPanelOpen: boolean;
    rightPanelOpen: boolean;
    beatBoardOpen: boolean;
    onCloseLeftPanel?: () => void;
    onCloseRightPanel?: () => void;
    onCloseBeatBoard?: () => void;
}

export function InfiniteLayout({
    leftPanel,
    rightPanel,
    beatBoard,
    children,
    leftPanelOpen,
    rightPanelOpen,
    beatBoardOpen,
    onCloseLeftPanel,
    onCloseRightPanel,
    onCloseBeatBoard,
}: InfiniteLayoutProps) {
    const { isMobile } = useMobile();
    const { uiState, setLeftPanelWidth, setRightPanelWidth, setBeatBoardHeight, toggleLeftPanel, toggleRightPanel, toggleBeatBoard, setViewMode } = useScriptWriter();

    const containerRef = useRef<HTMLDivElement>(null);
    const [isResizingLeft, setIsResizingLeft] = useState(false);
    const [isResizingRight, setIsResizingRight] = useState(false);
    const [isResizingBeat, setIsResizingBeat] = useState(false);

    const minWidth = 180;
    const maxWidth = 600;
    const minBeatHeight = 80;
    const maxBeatHeight = 400;

    useEffect(() => {
        if (isMobile && (leftPanelOpen || rightPanelOpen)) {
            const original = document.body.style.overflow;
            document.body.style.overflow = 'hidden';
            return () => { document.body.style.overflow = original; };
        }
    }, [isMobile, leftPanelOpen, rightPanelOpen]);

    const startResizingLeft = useCallback((e: React.MouseEvent) => {
        e.preventDefault();
        setIsResizingLeft(true);
    }, []);

    const startResizingRight = useCallback((e: React.MouseEvent) => {
        e.preventDefault();
        setIsResizingRight(true);
    }, []);

    const startResizingBeat = useCallback((e: React.MouseEvent) => {
        e.preventDefault();
        setIsResizingBeat(true);
    }, []);

    const stopResizing = useCallback(() => {
        setIsResizingLeft(false);
        setIsResizingRight(false);
        setIsResizingBeat(false);
    }, []);

    const resize = useCallback((e: MouseEvent) => {
        if (isResizingLeft) {
            const newWidth = e.clientX;
            if (newWidth < minWidth - 40) {
                if (leftPanelOpen) toggleLeftPanel();
                setIsResizingLeft(false);
            } else {
                setLeftPanelWidth(Math.min(Math.max(newWidth, minWidth), maxWidth));
                if (!leftPanelOpen) toggleLeftPanel();
            }
        } else if (isResizingRight) {
            const newWidth = window.innerWidth - e.clientX;
            if (newWidth < minWidth - 40) {
                if (rightPanelOpen) toggleRightPanel();
                setIsResizingRight(false);
            } else {
                setRightPanelWidth(Math.min(Math.max(newWidth, minWidth), maxWidth));
                if (!rightPanelOpen) toggleRightPanel();
            }
        } else if (isResizingBeat) {
            let newHeight = e.clientY;
            if (containerRef.current) {
                const rect = containerRef.current.getBoundingClientRect();
                newHeight = e.clientY - rect.top;
            }
            setBeatBoardHeight(Math.min(Math.max(newHeight, minBeatHeight), maxBeatHeight));
        }
    }, [isResizingLeft, isResizingRight, isResizingBeat, leftPanelOpen, rightPanelOpen, setLeftPanelWidth, setRightPanelWidth, setBeatBoardHeight, toggleLeftPanel, toggleRightPanel]);

    useEffect(() => {
        if (isResizingLeft || isResizingRight || isResizingBeat) {
            window.addEventListener('mousemove', resize);
            window.addEventListener('mouseup', stopResizing);
            document.body.style.cursor = isResizingBeat ? 'row-resize' : 'col-resize';
        } else {
            window.removeEventListener('mousemove', resize);
            window.removeEventListener('mouseup', stopResizing);
            document.body.style.cursor = '';
        }
        return () => {
            window.removeEventListener('mousemove', resize);
            window.removeEventListener('mouseup', stopResizing);
            document.body.style.cursor = '';
        };
    }, [isResizingLeft, isResizingRight, isResizingBeat, resize, stopResizing]);

    if (isMobile) {
        return (
            <div className="h-full w-full overflow-hidden flex flex-col bg-bg-app text-text-primary absolute inset-0">
                <div className="flex-1 h-full relative overflow-hidden bg-bg-app z-10 flex flex-col pb-[60px]">
                    {children}
                </div>

                {/* Mobile Bottom Navigation */}
                <div className="fixed bottom-0 left-0 right-0 h-[60px] bg-surface-elevated border-t border-subtle-8 z-30 flex items-center justify-around px-2 pb-safe">
                    <button
                        onClick={() => uiState.viewMode !== 'editor' && setViewMode('editor')}
                        className={`flex flex-col items-center justify-center w-full h-full gap-1 transition-colors ${uiState.viewMode === 'editor' ? 'text-accent' : 'text-text-tertiary hover:text-text-secondary'}`}
                    >
                        <FileText size={20} />
                        <span className="text-[10px] font-medium">Editor</span>
                    </button>
                    <button
                        onClick={() => uiState.viewMode !== 'bible' && setViewMode('bible')}
                        className={`flex flex-col items-center justify-center w-full h-full gap-1 transition-colors ${uiState.viewMode === 'bible' ? 'text-accent' : 'text-text-tertiary hover:text-text-secondary'}`}
                    >
                        <Globe size={20} />
                        <span className="text-[10px] font-medium">Bible</span>
                    </button>
                    <button
                        onClick={() => uiState.viewMode !== 'beat-sheet' && setViewMode('beat-sheet')}
                        className={`flex flex-col items-center justify-center w-full h-full gap-1 transition-colors ${uiState.viewMode === 'beat-sheet' ? 'text-accent' : 'text-text-tertiary hover:text-text-secondary'}`}
                    >
                        <Sparkles size={20} />
                        <span className="text-[10px] font-medium">Beat Sheet</span>
                    </button>
                </div>

                <AnimatePresence>
                    {leftPanelOpen && (
                        <motion.div
                            key="mobile-left"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            className="fixed inset-0 z-40"
                        >
                            <button type="button" aria-label="Close" onClick={onCloseLeftPanel} className="absolute inset-0 bg-black/40" />
                            <motion.div
                                initial={{ x: -320, opacity: 0 }}
                                animate={{ x: 0, opacity: 1 }}
                                exit={{ x: -320, opacity: 0 }}
                                transition={{ type: 'spring', damping: 28, stiffness: 300 }}
                                className="bg-surface-elevated border border-subtle-8 rounded-xl shadow-md absolute bottom-2 left-2 top-2 w-[min(86vw,320px)] overflow-y-auto"
                            >
                                {leftPanel}
                            </motion.div>
                        </motion.div>
                    )}
                </AnimatePresence>
                <AnimatePresence>
                    {rightPanelOpen && (
                        <motion.div
                            key="mobile-right"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            className="fixed inset-0 z-40"
                        >
                            <button type="button" aria-label="Close" onClick={onCloseRightPanel} className="absolute inset-0 bg-black/40" />
                            <motion.div
                                initial={{ x: 360, opacity: 0 }}
                                animate={{ x: 0, opacity: 1 }}
                                exit={{ x: 360, opacity: 0 }}
                                transition={{ type: 'spring', damping: 28, stiffness: 300 }}
                                className="bg-surface-elevated border border-subtle-8 rounded-xl shadow-md absolute bottom-2 right-2 top-2 w-[min(88vw,360px)] overflow-y-auto"
                            >
                                {rightPanel}
                            </motion.div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        );
    }

    return (
        <div ref={containerRef} className="flex h-screen w-screen overflow-hidden bg-bg-app text-text-primary selection:bg-brand-soft">
            {/* Left Panel Gutter */}
            {!leftPanelOpen && (
                <div
                    className="w-3 h-full bg-transparent hover:bg-subtle-2 cursor-pointer transition-all border-r border-subtle-8 flex items-center justify-center group z-30"
                    onClick={toggleLeftPanel}
                    title="Show Explorer"
                >
                    <div className="opacity-0 group-hover:opacity-100 text-accent transition-all duration-200 transform scale-75 group-hover:scale-100 bg-surface-elevated border border-subtle-8 p-1.5 rounded-lg shadow-md flex items-center justify-center pointer-events-none">
                        <PanelLeft size={14} />
                    </div>
                </div>
            )}

            <AnimatePresence initial={false}>
                {leftPanelOpen && (
                    <motion.aside
                        key="left-panel"
                        initial={{ width: 0, opacity: 0 }}
                        animate={{ width: uiState.leftPanelWidth, opacity: 1 }}
                        exit={{ width: 0, opacity: 0 }}
                        transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
                        className="h-full flex-shrink-0 relative z-20 overflow-hidden group"
                    >
                        <div className="h-full border-r border-subtle-8 bg-surface-sidebar flex flex-col">
                            {leftPanel}
                        </div>
                        <div
                            onMouseDown={startResizingLeft}
                            className={cn(
                                "absolute top-0 right-0 w-1 h-full cursor-col-resize z-30 transition-colors",
                                isResizingLeft ? "bg-accent" : "hover:bg-accent/30"
                            )}
                        />
                    </motion.aside>
                )}
            </AnimatePresence>

            <main className="flex-1 min-w-0 h-full relative flex flex-col z-10 bg-surface-page">
                {/* Beat Board (top half of the center area) */}
                <AnimatePresence initial={false}>
                    {beatBoardOpen && (
                        <motion.div
                            key="beat-board"
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: uiState.beatBoardHeight, opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                            className="flex-shrink-0 overflow-hidden relative"
                        >
                            {beatBoard}
                            <div
                                onMouseDown={startResizingBeat}
                                className={cn(
                                    "absolute bottom-0 left-0 right-0 h-1 cursor-row-resize z-30 transition-colors",
                                    isResizingBeat ? "bg-accent" : "hover:bg-accent/30"
                                )}
                            />
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Editor (bottom half) */}
                <div className="flex-1 min-h-0 relative flex flex-col">
                    {children}
                </div>
            </main>

            <AnimatePresence initial={false}>
                {rightPanelOpen && (
                    <motion.aside
                        key="right-panel"
                        initial={{ width: 0, opacity: 0 }}
                        animate={{ width: uiState.rightPanelWidth, opacity: 1 }}
                        exit={{ width: 0, opacity: 0 }}
                        transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
                        className="h-full flex-shrink-0 relative z-20 overflow-hidden group"
                    >
                        <div
                            onMouseDown={startResizingRight}
                            className={cn(
                                "absolute top-0 left-0 w-1 h-full cursor-col-resize z-30 transition-colors",
                                isResizingRight ? "bg-accent" : "hover:bg-accent/30"
                            )}
                        />
                        <div className="h-full border-l border-subtle-8 bg-surface-sidebar flex flex-col">
                            {rightPanel}
                        </div>
                    </motion.aside>
                )}
            </AnimatePresence>

            {!rightPanelOpen && (
                <div
                    className="w-3 h-full bg-transparent hover:bg-subtle-2 cursor-pointer transition-all border-l border-subtle-8 flex items-center justify-center group z-30"
                    onClick={toggleRightPanel}
                    title="Show Assistant"
                >
                    <div className="opacity-0 group-hover:opacity-100 text-accent transition-all duration-200 transform scale-75 group-hover:scale-100 bg-surface-elevated border border-subtle-8 p-1.5 rounded-lg shadow-md flex items-center justify-center pointer-events-none">
                        <PanelRight size={14} />
                    </div>
                </div>
            )}
        </div>
    );
}
