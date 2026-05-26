import { useState, useMemo, useEffect, useRef } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { IScene as Scene } from '../../services/project.api';
import { projectApi } from '../../services/project.api';
import { scriptWriterApi } from '../../services/scriptWriter.api';
import type { CritiqueResult, PendingFixState, SceneForm } from './types';
import { getErrorMessage } from './utils';

import { useScriptWriter } from '../../contexts/ScriptWriterContext';

interface UseSceneCritiqueProps {
    activeScene: Scene | null;
    activeProjectId: string | null;
    editorContent: string;
    updateSceneInState: (scene: Scene, projectId: string | null) => void;
    setError: (message: string | null) => void;
    setSceneForm: Dispatch<SetStateAction<SceneForm>>;
    setEditorContent: (content: string) => void;
    setHasUnsavedChanges: (val: boolean) => void;
    setSaveState: (state: any) => void;
}

export function useSceneCritique({
    activeScene,
    activeProjectId,
    editorContent,
    updateSceneInState,
    setError,
    setSceneForm,
    setEditorContent,
    setHasUnsavedChanges,
    setSaveState
}: UseSceneCritiqueProps) {
    const { isCritiquing, setIsCritiquing } = useScriptWriter();
    const [critique, setCritique] = useState<CritiqueResult | null>(null);
    const [pendingFix, setPendingFix] = useState<PendingFixState | null>(null);
    const pendingFixRef = useRef<PendingFixState | null>(null);
    const lastSceneIdRef = useRef<string | null>(null);

    useEffect(() => {
        pendingFixRef.current = pendingFix;
    }, [pendingFix]);

    // Sync critique from activeScene when it changes
    useEffect(() => {
        if (activeScene?.critique) {
            setCritique(activeScene.critique);
        } else {
            setCritique(null);
        }
    }, [activeScene?._id, activeScene?.critique]);

    // Sync pendingFix with activeScene.pendingContent
    useEffect(() => {
        // Guard 1: Do not overwrite or wipe out active local Critique-based fixes
        if (pendingFixRef.current && pendingFixRef.current.mode === 'fix') {
            lastSceneIdRef.current = activeScene?._id || null;
            return;
        }

        const sceneChanged = lastSceneIdRef.current !== activeScene?._id;
        lastSceneIdRef.current = activeScene?._id || null;

        if (activeScene?.pendingContent) {
            // Guard 2: Prevent redundant updates if the proposal is already set
            if (
                pendingFixRef.current &&
                pendingFixRef.current.content === activeScene.pendingContent &&
                pendingFixRef.current.mode === 'proposal'
            ) {
                return;
            }

            // Find the last assistant proposal in activeScene?.assistantChatHistory to recover explanation/notes
            const lastProposalMsg = [...(activeScene.assistantChatHistory || [])]
                .reverse()
                .find(m => m.role === 'assistant' && (m.type === 'proposal' || m.content?.includes('propose_edit') || m.metadata?.explanation));
            
            const explanation = lastProposalMsg?.metadata?.explanation 
                ? (Array.isArray(lastProposalMsg.metadata.explanation) ? lastProposalMsg.metadata.explanation.join('\n') : String(lastProposalMsg.metadata.explanation))
                : lastProposalMsg?.content || undefined;

            setPendingFix({
                content: activeScene.pendingContent,
                mode: 'proposal',
                isStreaming: false,
                benchmarkScore: activeScene.highScore?.critique?.score || 0,
                auditNotes: explanation
            });
        } else {
            // Prevent race condition: Only clear pending proposal if the user actually switched scenes
            if (sceneChanged && pendingFixRef.current && pendingFixRef.current.mode === 'proposal') {
                setPendingFix(null);
            }
        }
    }, [activeScene?._id, activeScene?.pendingContent]);

    const isCritiqueStale = useMemo(() => {
        if (!critique || !activeScene) return false;
        return activeScene.lastCritiqueContent !== editorContent;
    }, [critique, activeScene, editorContent]);

    const handleCritiqueScene = async () => {
        if (!activeScene) return;
        setIsCritiquing(true);
        setError(null);
        try {
            const result = await scriptWriterApi.critiqueScene(activeScene._id, editorContent);
            setCritique(result);
            
            const updated = await projectApi.updateScene(activeScene._id, {
                critique: result,
                lastCritiqueContent: editorContent
            });
            updateSceneInState(updated, activeProjectId);
        } catch (err) {
            setError(getErrorMessage(err, 'Critique failed'));
        } finally {
            setIsCritiquing(false);
        }
    };

    const handleFixScene = async (instruction: string = 'Apply all suggested fixes.') => {
        if (!activeScene) return;
        setIsCritiquing(true);
        setError(null);
        try {
            const fix = await scriptWriterApi.fixScene(activeScene._id, editorContent, instruction);
            setPendingFix({
                content: fix.content,
                critique: fix.critique,
                auditNotes: fix.auditNotes,
                isSuperior: fix.isSuperior,
                benchmarkScore: fix.benchmarkScore,
                mode: 'fix',
                isStreaming: false
            });
        } catch (err) {
            setError(getErrorMessage(err, 'Failed to generate fix'));
        } finally {
            setIsCritiquing(false);
        }
    };

    const handleAcceptFix = async (currentForm: SceneForm) => {
        if (!activeScene || !pendingFix || !activeProjectId) return;
        
        setIsCritiquing(true);
        const newContent = pendingFix.content;
        const isProposal = pendingFix.mode === 'proposal';
        
        try {
            let updated: any;

            if (isProposal) {
                // For AI assistant proposals: the backend already stored pendingContent.
                // Try commitEdit first (atomic pendingContent → content move).
                // If pendingContent is empty (e.g. frontend-only proposal), fall back to direct content update.
                try {
                    await scriptWriterApi.commitEdit(activeScene._id);
                    updated = { ...activeScene, content: newContent, pendingContent: undefined };
                } catch {
                    // Fallback: direct content update without form fields that trigger validation
                    updated = await projectApi.updateScene(activeScene._id, {
                        content: newContent
                    } as any);
                }
            } else {
                // For critique-based fixes: update content + critique score
                updated = await projectApi.updateScene(activeScene._id, {
                    content: newContent,
                    critique: pendingFix.critique
                } as any);
            }
            
            setEditorContent(newContent);
            updateSceneInState(updated, activeProjectId);
            setHasUnsavedChanges(false);
            setSaveState('saved');
            setPendingFix(null);
            setCritique(pendingFix.critique || null);
        } catch (err) {
            setError(getErrorMessage(err, 'Failed to apply and save fix'));
        } finally {
            setIsCritiquing(false);
        }
    };

    const handleDiscardFix = async () => {
        setPendingFix(null);
        if (activeScene?._id && activeProjectId) {
            try {
                const updated = await projectApi.updateScene(activeScene._id, {
                    pendingContent: ''
                });
                updateSceneInState(updated, activeProjectId);
            } catch (err) {
                console.error('[CritiqueHook] Failed to clear pending content on backend:', err);
            }
        }
    };

    return {
        isCritiquing,
        critique,
        pendingFix,
        setPendingFix,
        isCritiqueStale,
        handleCritiqueScene,
        handleFixScene,
        handleAcceptFix,
        handleDiscardFix
    };
}
