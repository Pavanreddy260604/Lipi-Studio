import { createContext, useContext, useState, useMemo, useEffect } from 'react';
import type { ReactNode } from 'react';
import type { IScene, Bible } from '../services/project.api';

interface ScriptWriterUIState {
    leftPanelOpen: boolean;
    rightPanelOpen: boolean;
    beatBoardOpen: boolean;
    beatBoardHeight: number;
    viewMode: 'editor' | 'bible' | 'beat-sheet' | 'admin-health';
    activeTool: 'cast' | 'settings' | 'story' | 'character_arc' | 'versions' | 'reference' | null;
    focusMode: boolean;
    leftPanelWidth: number;
    rightPanelWidth: number;
    screenplayMode: 'slug' | 'action' | 'character' | 'dialogue' | 'parenthetical' | 'transition';
    lineLanguage: string;
}

interface ScriptWriterContextType {
    activeProject: Bible | null;
    activeScene: IScene | null;
    editorContent: string;
    isGenerating: boolean;
    setIsGenerating: (generating: boolean) => void;
    generationProgress: number;
    setGenerationProgress: (progress: number) => void;
    isCritiquing: boolean;
    setIsCritiquing: (critiquing: boolean) => void;
    isAiThinking: boolean;
    setIsAiThinking: (thinking: boolean) => void;
    aiStatus: string;
    setAiStatus: (status: string) => void;
    aiProgress: number;
    setAiProgress: (progress: number) => void;
    hasUnsavedChanges: boolean;
    setHasUnsavedChanges: (hasChanges: boolean) => void;
    setActiveProject: (project: Bible | null) => void;
    setActiveScene: (scene: IScene | null) => void;
    setEditorContent: (content: string) => void;

    uiState: ScriptWriterUIState;
    toggleLeftPanel: () => void;
    toggleRightPanel: () => void;
    toggleBeatBoard: () => void;
    setBeatBoardHeight: (height: number) => void;
    setRightPanelTool: (tool: ScriptWriterUIState['activeTool']) => void;
    setViewMode: (mode: 'editor' | 'bible' | 'beat-sheet' | 'admin-health') => void;
    toggleFocusMode: () => void;
    setLeftPanelWidth: (width: number) => void;
    setRightPanelWidth: (width: number) => void;
    setScreenplayMode: (mode: ScriptWriterUIState['screenplayMode']) => void;
    setLineLanguage: (lang: string) => void;
}

const ScriptWriterContext = createContext<ScriptWriterContextType | undefined>(undefined);

export function ScriptWriterProvider({ children }: { children: ReactNode }) {
    const [activeProject, setActiveProject] = useState<Bible | null>(null);
    const [activeScene, setActiveScene] = useState<IScene | null>(null);
    const [editorContent, setEditorContent] = useState<string>('');
    const [isGenerating, setIsGenerating] = useState(false);
    const [generationProgress, setGenerationProgress] = useState(0);
    const [isCritiquing, setIsCritiquing] = useState(false);
    const [isAiThinking, setIsAiThinking] = useState(false);
    const [aiStatus, setAiStatus] = useState('');
    const [aiProgress, setAiProgress] = useState(0);
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

    const [uiState, setUiState] = useState<ScriptWriterUIState>({
        leftPanelOpen: true,
        rightPanelOpen: true,
        beatBoardOpen: true,
        beatBoardHeight: 200,
        viewMode: 'editor',
        activeTool: null,
        focusMode: false,
        leftPanelWidth: Number(localStorage.getItem('studio_left_width')) || 260,
        rightPanelWidth: Number(localStorage.getItem('studio_right_width')) || 340,
        screenplayMode: 'action',
        lineLanguage: '',
    });


    useEffect(() => {
        const handler = (e: BeforeUnloadEvent) => {
            if (isGenerating || isCritiquing || isAiThinking || hasUnsavedChanges) {
                e.preventDefault();
                e.returnValue = ''; // Standard for modern browsers
            }
        };
        window.addEventListener('beforeunload', handler);
        return () => window.removeEventListener('beforeunload', handler);
    }, [isGenerating, isCritiquing, isAiThinking, hasUnsavedChanges]);

    const cleanupActiveProcesses = () => {
        setIsGenerating(false);
        setGenerationProgress(0);
        setIsCritiquing(false);
        setIsAiThinking(false);
        setAiStatus('');
        setAiProgress(0);
    };

    const handleSetActiveScene = (scene: IScene | null) => {
        if (activeScene === scene) {
            return;
        }
        if (activeScene && scene && activeScene._id === scene._id) {
            if (activeScene !== scene) {
                setActiveScene(scene);
            }
            return;
        }
        
        if (isGenerating || isCritiquing || isAiThinking || hasUnsavedChanges) {
            const confirmed = window.confirm('You have an active process or unsaved changes. Switching scenes now may result in data loss. Continue?');
            if (!confirmed) return;
        }

        cleanupActiveProcesses();
        setActiveScene(scene);
        if (scene) {
            setUiState(prev => ({ ...prev, viewMode: 'editor' }));
        }
    };

    const toggleLeftPanel = () => {
        setUiState(prev => ({ ...prev, leftPanelOpen: !prev.leftPanelOpen }));
    };

    const toggleRightPanel = () => {
        setUiState(prev => ({ ...prev, rightPanelOpen: !prev.rightPanelOpen }));
    };

    const toggleBeatBoard = () => {
        setUiState(prev => ({ ...prev, beatBoardOpen: !prev.beatBoardOpen }));
    };

    const setBeatBoardHeight = (height: number) => {
        setUiState(prev => ({ ...prev, beatBoardHeight: Math.max(100, Math.min(400, height)) }));
    };

    const setRightPanelTool = (tool: ScriptWriterUIState['activeTool']) => {
        setUiState(prev => {
            if (prev.activeTool === tool) {
                if (!prev.rightPanelOpen) return { ...prev, rightPanelOpen: true };
                return { ...prev, rightPanelOpen: true };
            }
            return { ...prev, activeTool: tool, rightPanelOpen: true };
        });
    };

    const setViewMode = (mode: 'editor' | 'bible' | 'beat-sheet' | 'admin-health') => setUiState(prev => ({ ...prev, viewMode: mode }));

    const toggleFocusMode = () => {
        setUiState(prev => {
            const newFocus = !prev.focusMode;
            return {
                ...prev,
                focusMode: newFocus,
                leftPanelOpen: newFocus ? false : true,
                rightPanelOpen: newFocus ? false : true,
                beatBoardOpen: newFocus ? false : true,
            };
        });
    };

    const setLeftPanelWidth = (width: number) => {
        setUiState(prev => ({ ...prev, leftPanelWidth: width }));
        localStorage.setItem('studio_left_width', width.toString());
    };

    const setRightPanelWidth = (width: number) => {
        setUiState(prev => ({ ...prev, rightPanelWidth: width }));
        localStorage.setItem('studio_right_width', width.toString());
    };

    const setScreenplayMode = (mode: ScriptWriterUIState['screenplayMode']) => setUiState(prev => ({ ...prev, screenplayMode: mode }));

    const setLineLanguage = (lang: string) => setUiState(prev => ({ ...prev, lineLanguage: lang }));

    const value = useMemo(() => ({
        activeProject,
        activeScene,
        editorContent,
        isGenerating,
        setIsGenerating,
        generationProgress,
        setGenerationProgress,
        isCritiquing,
        setIsCritiquing,
        isAiThinking,
        setIsAiThinking,
        aiStatus,
        setAiStatus,
        aiProgress,
        setAiProgress,
        hasUnsavedChanges,
        setHasUnsavedChanges,
        setActiveProject,
        setActiveScene: handleSetActiveScene,
        setEditorContent,
        uiState,
        toggleLeftPanel,
        toggleRightPanel,
        toggleBeatBoard,
        setBeatBoardHeight,
        setRightPanelTool,
        setViewMode,
        toggleFocusMode,
        setLeftPanelWidth,
        setRightPanelWidth,
        setScreenplayMode,
        setLineLanguage,
    }), [activeProject, activeScene, editorContent, uiState, isGenerating, generationProgress, isCritiquing, isAiThinking, aiStatus, aiProgress, hasUnsavedChanges]);

    return (
        <ScriptWriterContext.Provider value={value}>
            {children}
        </ScriptWriterContext.Provider>
    );
}

export function useScriptWriter() {
    const context = useContext(ScriptWriterContext);
    if (context === undefined) {
        throw new Error('useScriptWriter must be used within a ScriptWriterProvider');
    }
    return context;
}
