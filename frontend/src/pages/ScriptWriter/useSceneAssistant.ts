import { useState } from 'react';
import type { IScene as Scene, Bible } from '../../services/project.api';
import { projectApi } from '../../services/project.api';
import { scriptWriterApi } from '../../services/scriptWriter.api';
import { parseAssistantProposal } from '../../utils/assistantParser';
import type { EditorSelection, PendingFixState } from './types';
import { getErrorMessage } from './utils';

import { useScriptWriter } from '../../contexts/ScriptWriterContext';
import { useChatStore } from '../../stores/chatStore';

interface UseSceneAssistantProps {
    activeScene: Scene | null;
    activeProjectId: string | null;
    editorContent: string;
    editorSelection: EditorSelection | null;
    setError: (message: string | null) => void;
    setPendingFix: (fix: PendingFixState | null) => void;
    activeProject?: Bible | null;
    updateSceneInState?: (scene: Scene, projectId: string | null) => void;
}

export function useSceneAssistant({
    activeScene,
    activeProjectId,
    editorContent,
    editorSelection,
    setError,
    setPendingFix,
    activeProject,
    updateSceneInState
}: UseSceneAssistantProps) {
    const { isAiThinking, setIsAiThinking, aiStatus, setAiStatus, aiProgress, setAiProgress } = useScriptWriter();

    const handleAiCommand = async (commandId: string, prompt: string) => {
        if (!activeScene) return;

        setIsAiThinking(true);
        setAiStatus('Connecting...');
        setAiProgress(5);
        setError(null);

        let fullStreamedText = '';
        const abortController = new AbortController();

        try {
            // Determine the instruction based on commandId
            let instruction = prompt;
            if (commandId === 'expand') instruction = 'Expand the scene with more sensory detail and subtext.';
            if (commandId === 'dialogue') instruction = 'Refine the dialogue to be more natural and sharp.';
            if (commandId === 'action') instruction = 'Intensify the action beats and physical descriptions.';
            if (commandId === 'rewrite') instruction = prompt || 'Rewrite the following section as described.';

            const target = editorSelection ? 'selection' : 'scene';
            const selectionData = editorSelection ? {
                text: editorSelection.text,
                start: editorSelection.start,
                end: editorSelection.end,
                lineStart: editorSelection.lineStart,
                lineEnd: editorSelection.lineEnd,
                charCount: editorSelection.charCount
            } : undefined;

            const selectedModel = useChatStore.getState().selectedModel;

            await scriptWriterApi.assistedEditStream(
                activeScene._id,
                instruction,
                (chunk) => {
                    fullStreamedText += chunk;
                    
                    // Real-time status updates based on section detection
                    if (fullStreamedText.includes('RESEARCH_DISCLOSURE')) {
                        setAiStatus('Researching context...');
                        setAiProgress(20);
                    }
                    if (fullStreamedText.includes('SCENE_PLAN') || fullStreamedText.includes('CREATIVE_PLAN')) {
                        setAiStatus('Planning rewrite...');
                        setAiProgress(40);
                    }
                    if (fullStreamedText.includes('SCENE_SCRIPT')) {
                        setAiStatus('Drafting proposal...');
                        setAiProgress(70);
                    }
                },
                {
                    mode: 'edit',
                    target,
                    selection: selectionData,
                    currentContent: editorContent,
                    transliteration: activeProject?.transliteration || false,
                    model: selectedModel || 'balanced'
                },
                abortController.signal
            );

            setAiProgress(100);
            setAiStatus('Parsing proposal...');

            const proposal = parseAssistantProposal(fullStreamedText, editorContent);
            
            if (!proposal.script) {
                throw new Error('AI failed to generate a script proposal.');
            }

            let finalProposedContent = proposal.script;

            // Handle selection replacement fallback if no SEARCH/REPLACE markers were returned
            const hasMarkers = fullStreamedText.includes('<<<SEARCH>>>') && fullStreamedText.includes('<<<REPLACE>>>');
            if (!hasMarkers && target === 'selection' && editorSelection) {
                const before = editorContent.slice(0, editorSelection.start);
                const after = editorContent.slice(editorSelection.end);
                finalProposedContent = `${before}${proposal.script}${after}`;
            }

            if (activeScene) {
                const updatedScene = await projectApi.updateScene(activeScene._id, {
                    pendingContent: finalProposedContent
                });
                if (updateSceneInState) {
                    updateSceneInState(updatedScene, activeProjectId);
                }
            }

            setPendingFix({
                content: finalProposedContent,
                auditNotes: proposal.explanation || undefined,
                mode: 'proposal',
                isStreaming: false,
                benchmarkScore: activeScene.highScore?.critique?.score || 0
            });

        } catch (err) {
            if (err instanceof Error && err.name === 'AbortError') return;
            setError(getErrorMessage(err, 'AI Assistant failed'));
        } finally {
            setIsAiThinking(false);
            setAiStatus('');
            setAiProgress(0);
        }
    };

    return {
        isAiThinking,
        aiStatus,
        aiProgress,
        handleAiCommand
    };
}
