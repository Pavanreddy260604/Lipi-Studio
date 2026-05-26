
import { useState } from 'react';
import type { IScene as Scene, Bible } from '../../services/project.api';
import { projectApi } from '../../services/project.api';
import type { GenerationOptions, PendingFixState } from './types';
import { getErrorMessage } from './utils';
import { parseAssistantProposal } from '../../utils/assistantParser';

import { useScriptWriter } from '../../contexts/ScriptWriterContext';

interface UseSceneGenerationProps {
    activeScene: Scene | null;
    activeProjectId: string | null;
    updateSceneInState: (scene: Scene, projectId: string | null) => void;
    setError: (message: string | null) => void;
    setEditorContent: (content: string) => void;
    setHasUnsavedChanges: (val: boolean) => void;
    setSaveState: (state: any) => void;
    setPendingFix: (fix: PendingFixState | null) => void;
}

export function useSceneGeneration({
    activeScene,
    activeProjectId,
    updateSceneInState,
    setError,
    setEditorContent,
    setHasUnsavedChanges,
    setSaveState,
    setPendingFix
}: UseSceneGenerationProps) {
    const { isGenerating, setIsGenerating, generationProgress, setGenerationProgress } = useScriptWriter();

    const handleGenerateScene = async (options: GenerationOptions, characterIds: string[]) => {
        if (!activeScene) return;
        setIsGenerating(true);
        setGenerationProgress(5);
        setError(null);
        setHasUnsavedChanges(true);

        // Simulated progress for thinking phase
        let progress = 5;
        const thinkingInterval = setInterval(() => {
            if (progress < 40) progress += 2.5;
            else if (progress < 50) progress += 0.5;
            setGenerationProgress(progress);
        }, 800);

        try {
            const stream = await projectApi.generateScene(activeScene._id, 'current', {
                style: options.style,
                format: options.format,
                sceneLength: options.sceneLength,
                language: options.language,
                characterIds: characterIds,
                transliteration: options.transliteration
            });
            
            clearInterval(thinkingInterval);
            setGenerationProgress(55);

            const reader = stream.getReader();
            const decoder = new TextDecoder();
            let fullText = '';
            
            const cleanStreamText = (text: string) => {
                let clean = text;
                // 1. Strip raw HTML-like tag wrappers (e.g. <center>, </center>, etc.)
                // Loop to handle nested or reconstructed tags after initial removal
                let prev = '';
                while (prev !== clean) {
                    prev = clean;
                    clean = clean.replace(/<\/?[A-Z_0-9]+>/gi, '');
                }
                // 2. Clean Fountain dialogue parentheticals and formatting leaks (e.g. > Dialogue -> Dialogue)
                clean = clean.replace(/^\s*>\s*/gm, '');
                return clean;
            };

            let streamProgress = 55;
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                fullText += decoder.decode(value, { stream: true });
                
                if (streamProgress < 98) {
                    streamProgress += 0.2;
                    setGenerationProgress(streamProgress);
                }
            }
            
            const proposal = parseAssistantProposal(fullText, activeScene.content || '');
            const finalScript = proposal.script || cleanStreamText(fullText);
            
            const updatedScene = await projectApi.updateScene(activeScene._id, {
                pendingContent: finalScript,
                status: 'drafted'
            });
            
            setGenerationProgress(100);
            updateSceneInState(updatedScene, activeProjectId);
            
            setPendingFix({
                content: finalScript,
                auditNotes: proposal.explanation || undefined,
                mode: 'proposal',
                isStreaming: false,
                benchmarkScore: activeScene.highScore?.critique?.score || 0
            });

            localStorage.removeItem(`scene_draft_${activeScene._id}`);
            setSaveState('saved');
            setHasUnsavedChanges(false);
        } catch (err) {
            setError(getErrorMessage(err, 'Generation failed'));
            setSaveState('error');
            setHasUnsavedChanges(true);
        } finally {
            clearInterval(thinkingInterval);
            setTimeout(() => {
                setIsGenerating(false);
                setGenerationProgress(0);
            }, 1000);
        }
    };

    return {
        isGenerating,
        generationProgress,
        handleGenerateScene
    };
}
