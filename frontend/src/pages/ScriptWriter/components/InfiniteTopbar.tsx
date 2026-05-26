import { ChevronRight, Save, Home, FileText, Globe, Maximize2, Minimize2, LayoutGrid, Sparkles, ShieldCheck, PanelLeft, PanelRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useScriptWriter } from '../../../contexts/ScriptWriterContext';
import { useAuthStore } from '../../../stores/authStore';

export function InfiniteTopbar() {
    const navigate = useNavigate();
    const user = useAuthStore((s) => s.user);
    const isAdmin = user?.role === 'admin' || user?.email === 'pavanreddynalla1959@gmail.com';
    const {
        activeProject,
        activeScene,
        setActiveProject,
        uiState,
        setViewMode,
        toggleFocusMode,
        toggleLeftPanel,
        toggleRightPanel
    } = useScriptWriter();

    const handleBackToDashboard = () => {
        setActiveProject(null);
        navigate('/script-writer');
    };

    return (
        <div className="flex min-h-12 flex-wrap items-center justify-between gap-2 px-3 py-2 select-none sm:h-12 sm:min-h-0 sm:flex-nowrap sm:px-4 sm:py-0 bg-surface-elevated border-b border-subtle-8 shadow-[var(--shadow-sm)]">
            {/* Left Control Group */}
            <div className="flex min-w-0 items-center gap-2 sm:gap-3">
                <button
                    onClick={handleBackToDashboard}
                    className="flex items-center justify-center min-w-[44px] min-h-[44px] rounded-lg transition-colors text-text-tertiary hover:text-text-primary hover:bg-subtle-3 focus-ring"
                    title="Back to Dashboard"
                >
                    <Home size={18} />
                </button>

                <div className="w-px h-4 bg-subtle-8 mx-1" />

                {/* Breadcrumbs */}
                <div className="flex min-w-0 items-center overflow-x-auto whitespace-nowrap text-xs">
                    <span className="hidden font-medium text-text-tertiary sm:inline">Script</span>
                    <ChevronRight size={12} className="mx-2 hidden text-text-muted sm:inline-flex" />
                    <span className={`hidden sm:inline truncate ${activeProject ? 'text-text-secondary' : 'text-text-tertiary italic'}`}>
                        {activeProject?.title || 'No Project'}
                    </span>
                    <ChevronRight size={12} className="hidden sm:inline text-text-muted mx-2" />
                    <AnimatePresence mode="wait">
                        <motion.span
                            key={activeScene?._id || 'empty'}
                            initial={{ opacity: 0, x: -4 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.15 }}
                            className={`truncate font-medium ${activeScene ? 'text-accent' : 'text-text-tertiary italic'}`}
                        >
                            {activeScene?.slugline || 'Select a Scene'}
                        </motion.span>
                    </AnimatePresence>
                </div>
            </div>

            {/* Right Control Group */}
            <div className="flex w-full items-center justify-between gap-2 sm:w-auto sm:justify-end sm:gap-3">
                <div className="flex items-center gap-2">
                    <motion.button
                        whileTap={{ scale: 0.92 }}
                        onClick={toggleFocusMode}
                        className={`hidden sm:flex items-center justify-center min-w-[44px] min-h-[44px] rounded-lg transition-all focus-ring ${uiState.focusMode ? 'bg-accent/10 text-accent' : 'text-text-muted hover:text-text-secondary hover:bg-subtle-3'}`}
                        title={uiState.focusMode ? 'Exit Focus Mode' : 'Enter Focus Mode'}
                    >
                        {uiState.focusMode ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
                    </motion.button>

                    <div className="hidden sm:flex bg-subtle-2 border border-subtle-8 p-0.5 rounded-lg">
                        <button
                            onClick={() => setViewMode('editor')}
                            className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-semibold transition-all focus-ring ${uiState.viewMode === 'editor' ? 'bg-surface-elevated text-accent shadow-sm' : 'text-text-secondary hover:text-text-primary'}`}
                        >
                            <FileText size={11} />
                            <span>Editor</span>
                        </button>
                        <button
                            onClick={() => setViewMode('bible')}
                            className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-semibold transition-all focus-ring ${uiState.viewMode === 'bible' ? 'bg-surface-elevated text-accent shadow-sm' : 'text-text-secondary hover:text-text-primary'}`}
                        >
                            <Globe size={11} />
                            <span>Bible</span>
                        </button>
                        <button
                            onClick={() => setViewMode('beat-sheet')}
                            className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-semibold transition-all focus-ring ${uiState.viewMode === 'beat-sheet' ? 'bg-surface-elevated text-accent shadow-sm' : 'text-text-secondary hover:text-text-primary'}`}
                            id="view-mode-beat-sheet"
                        >
                            <Sparkles size={11} />
                            <span>Beat Sheet</span>
                        </button>
                        {isAdmin && (
                            <button
                                onClick={() => setViewMode('admin-health' as any)}
                                className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-semibold transition-all focus-ring ${uiState.viewMode === 'admin-health' ? 'bg-surface-elevated text-status-warning shadow-sm' : 'text-text-secondary hover:text-text-primary'}`}
                            >
                                <ShieldCheck size={11} className={uiState.viewMode === 'admin-health' ? 'text-status-warning' : 'text-text-tertiary'} />
                                <span>RLHF Health</span>
                            </button>
                        )}
                    </div>

                    {/* Desktop Panel Toggles */}
                    <div className="hidden sm:flex gap-1 ml-1 border-l border-subtle-8 pl-3">
                         <button 
                            onClick={toggleLeftPanel}
                            className={`flex items-center justify-center min-w-[44px] min-h-[44px] rounded-lg transition-all focus-ring ${uiState.leftPanelOpen ? 'bg-accent/10 text-accent' : 'text-text-muted hover:text-text-secondary hover:bg-subtle-3'}`}
                            title={uiState.leftPanelOpen ? 'Hide Explorer' : 'Show Explorer'}
                         >
                            <PanelLeft size={18} />
                         </button>
                         <button 
                            onClick={toggleRightPanel}
                            className={`flex items-center justify-center min-w-[44px] min-h-[44px] rounded-lg transition-all focus-ring ${uiState.rightPanelOpen ? 'bg-accent/10 text-accent' : 'text-text-muted hover:text-text-secondary hover:bg-subtle-3'}`}
                            title={uiState.rightPanelOpen ? 'Hide Assistant' : 'Show Assistant'}
                         >
                            <PanelRight size={18} />
                         </button>
                    </div>

                    {/* Mobile Panel Toggles */}
                    <div className="flex sm:hidden gap-1 ml-1">
                         <button 
                            onClick={toggleLeftPanel}
                            className={`flex items-center justify-center min-w-[44px] min-h-[44px] rounded-lg border transition-all ${uiState.leftPanelOpen ? 'bg-accent/10 border-accent/40 text-accent' : 'bg-subtle-3 border-subtle-8 text-text-muted'}`}
                         >
                            <LayoutGrid size={18} />
                         </button>
                         <button 
                            onClick={toggleRightPanel}
                            className={`flex items-center justify-center min-w-[44px] min-h-[44px] rounded-lg border transition-all ${uiState.rightPanelOpen ? 'bg-accent/10 border-accent/40 text-accent' : 'bg-subtle-3 border-subtle-8 text-text-muted'}`}
                         >
                            <Sparkles size={18} />
                         </button>
                    </div>
                </div>

                <div className="mr-1 hidden items-center gap-2 text-xs text-text-tertiary sm:flex sm:mr-2">
                    <Save size={14} className="text-status-success/60" />
                    <span className="font-medium">Saved</span>
                </div>
            </div>
        </div>
    );
}
