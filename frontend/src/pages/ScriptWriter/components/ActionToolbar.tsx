import { User, Languages, ChevronDown, Info, GitBranch, MessageSquare } from 'lucide-react';
import { useState } from 'react';
import { useScriptWriter } from '../../../contexts/ScriptWriterContext';
import { MODE_ORDER, MODE_CONFIG, LANGUAGES, type ScreenplayMode } from '../constants';
import type { StudioCommand } from '../types';

interface ActionToolbarProps {
    hasActiveScene: boolean;
    hasSelection: boolean;
    isGenerating: boolean;
    isCritiquing: boolean;
    onCommand: (command: StudioCommand) => void;
    onToggleCommandPalette: () => void;
    onToggleCharacterArcs?: () => void;
    onToggleContext?: () => void;
    onApplyMode?: (mode: ScreenplayMode, lang?: string) => void;
    currentTab?: 'context' | 'arcs';
}

export function ActionToolbar({
    hasActiveScene,
    isGenerating,
    isCritiquing,
    onCommand,
    onToggleCommandPalette,
    onToggleCharacterArcs,
    onToggleContext,
    onApplyMode,
    currentTab,
}: ActionToolbarProps) {
    const { activeProject, uiState, setScreenplayMode, setLineLanguage, setRightPanelTool } = useScriptWriter();
    const [showLangPicker, setShowLangPicker] = useState(false);

    if (!activeProject || uiState.viewMode !== 'editor') return null;

    const currentMode = uiState.screenplayMode;
    const currentLang = uiState.lineLanguage;

    return (
        <div className="flex items-center gap-1.5 px-4 h-11 border-b border-subtle-8 bg-surface-page select-none">
            {/* Screenplay Modes */}
            <div className="flex items-center bg-subtle-2 border border-subtle-8 p-0.5 rounded-lg mr-2 overflow-x-auto scrollbar-hide max-w-[140px] sm:max-w-none flex-shrink-0">
                {MODE_ORDER.map((item) => {
                    const Icon = MODE_CONFIG[item].icon;
                    const active = currentMode === item;
                    return (
                        <button
                            key={item}
                            type="button"
                            className={`p-1 rounded-md transition-all active:scale-[0.94] focus-ring ${active ? 'text-accent bg-surface-elevated shadow-sm' : 'text-text-tertiary hover:text-text-secondary hover:bg-subtle-3'}`}
                            onMouseDown={(e) => {
                                e.preventDefault();
                                setScreenplayMode(item);
                                onApplyMode?.(item);
                            }}
                            title={MODE_CONFIG[item].label}
                        >
                            <Icon size={11} />
                        </button>
                    );
                })}
            </div>
 
            <div className="w-px h-3 bg-subtle-8 mx-1" />
 
            {/* Language Picker */}
            <div className="relative ml-1">
                <button
                    onMouseDown={(e) => {
                        e.preventDefault();
                        setShowLangPicker(!showLangPicker);
                    }}
                    className={'flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold transition-all active:scale-[0.94] focus-ring ' + (currentLang ? 'text-accent bg-accent/10 border border-accent/20' : 'text-text-tertiary hover:text-text-secondary hover:bg-subtle-2 border border-transparent')}
                    title="Set line language"
                >
                    <Languages size={11} />
                    <span className="uppercase text-[10px] font-semibold">{LANGUAGES.find(l => l.code === currentLang)?.code || 'EN'}</span>
                    <ChevronDown size={8} className={`transition-transform duration-200 ${showLangPicker ? 'rotate-180' : ''}`} />
                </button>
                {showLangPicker && (
                    <div className="absolute top-full left-0 mt-1.5 z-[100] bg-surface-elevated border border-subtle-8 rounded-xl p-1 shadow-xl min-w-[120px] animate-scale-in">
                        {LANGUAGES.map(l => (
                            <button
                                key={l.code}
                                onMouseDown={(e) => {
                                    e.preventDefault();
                                    setLineLanguage(l.code);
                                    setShowLangPicker(false);
                                    onApplyMode?.(currentMode, l.code);
                                }}
                                className={'w-full text-left px-2.5 py-1.5 text-[10px] rounded-lg transition-colors focus-ring ' + (currentLang === l.code ? 'bg-accent/10 text-accent font-bold' : 'text-text-secondary hover:bg-subtle-3')}
                            >
                                {l.label}
                            </button>
                        ))}
                    </div>
                )}
            </div>

            <div className="flex-1" />

            {/* Navigation & Panels */}
            <div className="flex items-center gap-1">
                <button
                    onClick={onToggleContext || (() => setRightPanelTool('reference'))}
                    className={`flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold transition-all focus-ring ${uiState.activeTool === 'reference' && currentTab === 'context' ? 'text-accent bg-accent/10 border border-accent/20' : 'text-text-tertiary hover:text-text-secondary hover:bg-subtle-3 border border-transparent'}`}
                    title="Scene Reference"
                >
                    <Info size={11} />
                    <span className="hidden md:inline">Context</span>
                </button>

                {onToggleCharacterArcs && (
                    <button
                        onClick={onToggleCharacterArcs}
                        className={`flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold transition-all focus-ring ${uiState.activeTool === 'reference' && currentTab === 'arcs' ? 'text-accent bg-accent/10 border border-accent/20' : 'text-text-tertiary hover:text-text-secondary hover:bg-subtle-3 border border-transparent'}`}
                        title="Character Arcs"
                    >
                        <User size={11} />
                        <span className="hidden md:inline">Arcs</span>
                    </button>
                )}

                <button
                    onClick={() => setRightPanelTool('versions')}
                    className={`flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold transition-all focus-ring ${uiState.activeTool === 'versions' ? 'text-accent bg-accent/10 border border-accent/20' : 'text-text-tertiary hover:text-text-secondary hover:bg-subtle-3 border border-transparent'}`}
                    title="Version History & Snapshots"
                >
                    <GitBranch size={11} />
                    <span className="hidden md:inline">Versions</span>
                </button>

                <button
                    onClick={() => setRightPanelTool(null)}
                    className={`flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold transition-all focus-ring ${!uiState.activeTool || (uiState.activeTool !== 'reference' && uiState.activeTool !== 'versions') ? 'text-accent bg-accent/10 border border-accent/20' : 'text-text-tertiary hover:text-text-secondary hover:bg-subtle-3 border border-transparent'}`}
                    title="Assistant Chat"
                >
                    <MessageSquare size={11} />
                    <span className="hidden md:inline">Assistant</span>
                </button>

                <button
                    onClick={onToggleCommandPalette}
                    className="flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold transition-all active:scale-[0.96] focus-ring text-text-tertiary hover:text-text-secondary hover:bg-subtle-3 border border-transparent"
                    title="Command Palette"
                >
                    <span className="hidden md:inline">Commands</span>
                    <kbd className="hidden md:inline text-[8px] font-mono border border-subtle-10 bg-subtle-2 rounded px-1 opacity-70">⌘K</kbd>
                </button>
            </div>
        </div>
    );
}
