
import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import type { Bible, IScene as Scene } from '../../services/project.api';
import { projectApi } from '../../services/project.api';
import type { EditorSelection, GenerationOptions, SceneForm } from './types';
import { DEFAULT_GENERATION, DEFAULT_SCENE_FORM, type SaveState } from './types';
import { getErrorMessage } from './utils';
import { useSceneCritique } from './useSceneCritique';
import { useSceneGeneration } from './useSceneGeneration';
import { useSceneAssistant } from './useSceneAssistant';
import { useScriptWriter } from '../../contexts/ScriptWriterContext';

interface UseScriptWriterSceneEditorProps {
    activeScene: Scene | null;
    activeProject: Bible | null;
    activeProjectId: string | null;
    updateSceneInState: (scene: Scene, projectId: string | null) => void;
    setError: (message: string | null) => void;
    chatMessages?: any[];
}

function isDraftInputFocused(): boolean {
    const active = document.activeElement as HTMLElement | null;
    return Boolean(
        active &&
        (active.tagName === 'TEXTAREA' || active.tagName === 'INPUT' || active.isContentEditable)
    );
}

export function useScriptWriterSceneEditor({
    activeScene,
    activeProject,
    activeProjectId,
    updateSceneInState,
    setError,
    chatMessages = []
}: UseScriptWriterSceneEditorProps) {
    const { 
        editorContent, 
        setEditorContent,
        isGenerating,
        generationProgress,
        isCritiquing,
        isAiThinking,
        aiStatus,
        aiProgress,
        hasUnsavedChanges,
        setHasUnsavedChanges
    } = useScriptWriter();
    const [sceneForm, setSceneForm] = useState<SceneForm>(DEFAULT_SCENE_FORM);
    const [saveState, setSaveState] = useState<SaveState>('saved');
    
    const chatMessagesRef = useRef(chatMessages);
    useEffect(() => {
        chatMessagesRef.current = chatMessages;
    }, [chatMessages]);
    const [generationOptions, setGenerationOptions] = useState<GenerationOptions>(DEFAULT_GENERATION);
    const [selectedSceneCharacterIds, setSelectedSceneCharacterIds] = useState<string[]>([]);
    const [editorSelection, setEditorSelection] = useState<EditorSelection | null>(null);
    const [isOffline, setIsOffline] = useState(!navigator.onLine);
    const [retryAttempt, setRetryAttempt] = useState(0);

    const saveTimer = useRef<number | null>(null);
    const lastSyncedSceneId = useRef<string | null>(null);
    const isTyping = useRef(false);
    const typingTimer = useRef<number | null>(null);
    const isSaving = useRef(false);
    const hasPendingSave = useRef(false);
    const lastSavedContent = useRef<string | null>(null);
    const justSaved = useRef(false);
    const [wordCount, setWordCount] = useState(0);

    useEffect(() => {
        const timer = window.setTimeout(() => {
            if (!editorContent.trim()) {
                setWordCount(0);
                return;
            }
            setWordCount(editorContent.trim().split(/\s+/).length);
        }, 500); // 500ms delay for stats
        return () => window.clearTimeout(timer);
    }, [editorContent]);

    // 1. Critique Hook
    const {
        critique,
        pendingFix,
        setPendingFix,
        isCritiqueStale,
        handleCritiqueScene,
        handleFixScene,
        handleAcceptFix,
        handleDiscardFix
    } = useSceneCritique({
        activeScene,
        activeProjectId,
        editorContent,
        updateSceneInState,
        setError,
        setSceneForm,
        setEditorContent,
        setHasUnsavedChanges,
        setSaveState
    });

    // 2. Generation Hook
    const { handleGenerateScene: generateSceneInner } = useSceneGeneration({
        activeScene,
        activeProjectId,
        updateSceneInState,
        setError,
        setEditorContent,
        setHasUnsavedChanges,
        setSaveState,
        setPendingFix
    });

    // 3. Assistant Hook
    const {
        handleAiCommand
    } = useSceneAssistant({
        activeScene,
        activeProjectId,
        editorContent,
        editorSelection,
        setError,
        setPendingFix,
        activeProject,
        updateSceneInState
    });

    // EFFECT: Hydration & Switch Detection
    useEffect(() => {
        return () => {
            if (saveTimer.current) window.clearTimeout(saveTimer.current);
            if (typingTimer.current) window.clearTimeout(typingTimer.current);
        };
    }, []);

    useEffect(() => {
        if (!activeScene) {
            setEditorContent('');
            lastSyncedSceneId.current = null;
            return;
        }

        const isActualSceneSwitch = lastSyncedSceneId.current !== activeScene._id;

        if (isActualSceneSwitch) {
            if (import.meta.env.DEV) console.debug('[Editor] Scene switch detected. Hydrating full state.');
            if (saveTimer.current) window.clearTimeout(saveTimer.current);
            if (typingTimer.current) window.clearTimeout(typingTimer.current);
            isTyping.current = false;
            setSceneForm({
                title: activeScene.title || '',
                slugline: activeScene.slugline || '',
                summary: activeScene.summary || '',
                goal: activeScene.goal || '',
                status: activeScene.status || 'planned'
            });
            
            // Rehydrate from local draft if it exists and differs from database
            const localDraft = localStorage.getItem(`scene_draft_${activeScene._id}`);
            const contentVal = (localDraft && localDraft !== activeScene.content) ? localDraft : (activeScene.content || '');
            setEditorContent(contentVal);
            lastSavedContent.current = activeScene.content || '';
            justSaved.current = false;
            
            if (localDraft && localDraft !== activeScene.content) {
                if (import.meta.env.DEV) {
                    console.debug(`[Editor] Recovered local unsaved draft for scene ${activeScene._id}`);
                }
                setSaveState('unsaved');
                setHasUnsavedChanges(true);
            } else {
                setSaveState('saved');
                setHasUnsavedChanges(false);
            }
            setSelectedSceneCharacterIds([]);
            setEditorSelection(null);
            lastSyncedSceneId.current = activeScene._id;
        } else if (!isTyping.current && !hasUnsavedChanges && saveState === 'saved' && !isSaving.current && !isDraftInputFocused()) {
            // Background sync (structure panel rename, scene log edits, AI) while idle
            const nextContent = activeScene.content || '';
            
            // Stale Propagation Gate:
            // If we just saved successfully, ignore incoming backend content until it matches our newly saved content
            if (justSaved.current) {
                if (nextContent === lastSavedContent.current) {
                    justSaved.current = false;
                } else {
                    // Stale content detected from lagging state propagation. Ignore it.
                    return;
                }
            }

            const nextForm = {
                title: activeScene.title || '',
                slugline: activeScene.slugline || '',
                summary: activeScene.summary || '',
                goal: activeScene.goal || '',
                status: activeScene.status || 'planned',
            };
            setSceneForm((prev) => {
                if (
                    prev.title === nextForm.title &&
                    prev.slugline === nextForm.slugline &&
                    prev.summary === nextForm.summary &&
                    prev.goal === nextForm.goal &&
                    prev.status === nextForm.status
                ) {
                    return prev;
                }
                return nextForm;
            });

            if (nextContent !== editorContent && nextContent !== lastSavedContent.current) {
                if (import.meta.env.DEV) console.debug('[Editor] Background sync. User is idle.');
                setEditorContent(nextContent);
            }
        }
    }, [activeScene, hasUnsavedChanges, editorContent, saveState]);

    useEffect(() => {
        const lang = activeProject?.language;
        if (lang && lang !== 'English') {
            setGenerationOptions(prev => {
                if (prev.language === 'English' || !prev.language) {
                    return { ...prev, language: lang };
                }
                return prev;
            });
        }
    }, [activeProject?.language]);

    useEffect(() => {
        if (activeProject) {
            setGenerationOptions(prev => ({
                ...prev,
                transliteration: activeProject.transliteration || false
            }));
        }
    }, [activeProject?.transliteration]);

    // Centralized Save Function
    const triggerForceSave = useCallback(async (): Promise<boolean> => {
        if (!activeScene || isOffline || isGenerating || isCritiquing) return false;
        
        if (isSaving.current) {
            hasPendingSave.current = true;
            return false;
        }

        if (saveTimer.current) window.clearTimeout(saveTimer.current);
        isSaving.current = true;
        setSaveState('saving');
        setError(null);
        
        try {
            const assistantChatHistory = (chatMessagesRef.current || []).map((msg: any) => ({
                role: msg.role === 'user' ? 'user' : 'assistant',
                type: msg.type === 'edit' ? 'proposal' : msg.type === 'critique' ? 'proposal' : msg.type === 'error' ? 'chat' : 'chat',
                content: msg.content || '',
                timestamp: msg.timestamp ? new Date(msg.timestamp) : new Date()
            }));

            const updated = await projectApi.updateScene(activeScene._id, {
                ...sceneForm,
                content: editorContent,
                assistantChatHistory
            });
            lastSavedContent.current = editorContent;
            justSaved.current = true;
            updateSceneInState(updated, activeProjectId);
            localStorage.removeItem(`scene_draft_${activeScene._id}`);
            setSaveState('saved');
            setHasUnsavedChanges(false);
            return true;
        } catch (err) {
            if (import.meta.env.DEV) console.error('[Editor] Save failed:', err);
            setSaveState('error');
            setError(getErrorMessage(err, 'Failed to save scene'));
            return false;
        } finally {
            isSaving.current = false;
            if (hasPendingSave.current) {
                hasPendingSave.current = false;
                window.setTimeout(() => {
                    void triggerForceSave();
                }, 50);
            }
        }
    }, [activeScene, isOffline, isGenerating, isCritiquing, sceneForm, editorContent, updateSceneInState, activeProjectId, setError]);

    // EFFECT: Online Reconnection auto-trigger save
    useEffect(() => {
        const handleOnline = () => {
            setIsOffline(false);
            if (hasUnsavedChanges && saveState !== 'saving') {
                void triggerForceSave();
            }
        };
        const handleOffline = () => {
            setIsOffline(true);
        };
        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);
        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, [hasUnsavedChanges, saveState, triggerForceSave]);

    // EFFECT: Autosave with Typing Awareness & Connection Awareness
    useEffect(() => {
        if (!activeScene || !hasUnsavedChanges || activeScene._id !== lastSyncedSceneId.current || isGenerating || isCritiquing || isOffline) return;
        
        if (saveTimer.current) window.clearTimeout(saveTimer.current);

        // Keep background saves out of the hot typing path.
        const debounceMs = isTyping.current ? 10000 : 3000;

        saveTimer.current = window.setTimeout(async () => {
            void triggerForceSave();
        }, debounceMs);

        return () => {
            if (saveTimer.current) window.clearTimeout(saveTimer.current);
        };
    }, [editorContent, sceneForm, hasUnsavedChanges, isGenerating, isCritiquing, isOffline, activeScene, triggerForceSave]);

    // EFFECT: Auto-Retry save with exponential backoff when in error state
    useEffect(() => {
        if (saveState !== 'error' || isOffline || !hasUnsavedChanges || isGenerating || isCritiquing) {
            setRetryAttempt(0);
            return;
        }

        const maxRetries = 100;
        if (retryAttempt >= maxRetries) {
            if (import.meta.env.DEV) {
                console.log('[Editor] Max save retries exceeded. Stopping auto-retry.');
            }
            return;
        }

        // Calculate backoff delay capped at 30s
        const delay = Math.min(Math.pow(2, retryAttempt + 1) * 1000, 30000);

        const retryTimer = window.setTimeout(async () => {
            if (import.meta.env.DEV) {
                console.debug(`[Editor] Auto-retry save attempt ${retryAttempt + 1}/${maxRetries} after ${delay}ms...`);
            }
            const success = await triggerForceSave();
            if (success) {
                setRetryAttempt(0);
            } else {
                setRetryAttempt(prev => prev + 1);
            }
        }, delay);

        return () => {
            window.clearTimeout(retryTimer);
        };
    }, [saveState, retryAttempt, isOffline, hasUnsavedChanges, isGenerating, isCritiquing, triggerForceSave]);

    const handleSceneFormChange = <K extends keyof SceneForm>(field: K, value: SceneForm[K]) => {
        if (sceneForm[field] === value) return;
        setSceneForm((prev) => ({ ...prev, [field]: value }));
        justSaved.current = false;
        setHasUnsavedChanges(true);
        setSaveState('unsaved');
    };

    const handleContentChange = (value: string) => {
        if (value === editorContent) return;
        isTyping.current = true;
        if (typingTimer.current) window.clearTimeout(typingTimer.current);
        typingTimer.current = window.setTimeout(() => {
            isTyping.current = false;
        }, 1000);

        setEditorContent(value);
        if (activeScene) {
            localStorage.setItem(`scene_draft_${activeScene._id}`, value);
        }
        justSaved.current = false;
        setHasUnsavedChanges(true);
        setSaveState('unsaved');
    };

    const handleGenerateScene = () => generateSceneInner(generationOptions, selectedSceneCharacterIds);

    return {
        sceneForm,
        editorContent,
        saveState,
        wordCount,
        hasUnsavedChanges,
        isGenerating,
        generationProgress,
        isCritiquing,
        critique,
        generationOptions,
        editorSelection,
        selectedSceneCharacterIds,
        setSelectedSceneCharacterIds,
        handleSceneFormChange,
        handleContentChange,
        handleSelectionChange: setEditorSelection,
        handleGenerationOptionChange: (field: any, value: any) => setGenerationOptions(prev => ({ ...prev, [field]: value })),
        handleGenerateScene,
        handleCritiqueScene,
        handleFixScene,
        handleAcceptFix: () => handleAcceptFix(sceneForm),
        handleDiscardFix,
        toggleSceneCharacter: (id: string) => setSelectedSceneCharacterIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]),
        pendingFix,
        setPendingFix,
        isCritiqueStale,
        eliteHighScore: activeScene?.highScore?.critique?.score || 0,
        isAiThinking,
        aiStatus,
        aiProgress,
        handleAiCommand,
        isOffline,
        handleForceSave: triggerForceSave
    };
}
