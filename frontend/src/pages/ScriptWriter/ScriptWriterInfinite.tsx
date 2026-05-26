import { useEffect, useState, useRef, useCallback } from 'react';
import { ErrorBoundary } from '../../components/ErrorBoundary';

const LocalPanelFallback = ({ name }: { name: string }) => (
    <div className="p-6 border border-subtle-8 bg-surface-elevated text-text-secondary text-xs rounded-2xl m-3 flex flex-col gap-2">
        <span className="font-semibold text-text-primary">Panel Error ({name})</span>
        <span>An unexpected error occurred in this workspace panel.</span>
        <button
            onClick={() => window.location.reload()}
            className="px-3 py-1.5 rounded bg-subtle-3 hover:bg-subtle-5 border border-subtle-10 text-accent text-[11px] font-medium transition-all active:scale-95 focus-ring mt-2 self-start"
        >
            Reload workspace
        </button>
    </div>
);
import { useParams, useNavigate } from 'react-router-dom';
import { ScriptWriterProvider, useScriptWriter } from '../../contexts/ScriptWriterContext';
import { InfiniteLayout } from './components/InfiniteLayout';
import { BeatBoard } from './components/BeatBoard';
import { StudioEditor } from './StudioEditor';
import { StudioStatusbar } from './StudioStatusbar';
import { ActionToolbar } from './components/ActionToolbar';
import { CommandPalette } from './components/CommandPalette';
import { CastingCallModal, type ProposedCharacter } from './components/CastingCallModal';
import { detectNewCharacters } from './utils';
import { getLevenshteinDistance } from '../../lib/utils';
import { characterApi } from '../../services/character.api';
import { useScriptWriterProjects } from './useScriptWriterProjects';
import { useScriptWriterSceneEditor } from './useScriptWriterSceneEditor';
import { useScriptWriterCharacters } from './useScriptWriterCharacters';
import { useScriptWriterTreatments } from './useScriptWriterTreatments';
import { StructurePanel } from './components/StructurePanel';
import { AssistantChat } from './components/AssistantChat';
import { InfiniteTopbar } from './components/InfiniteTopbar';
import { BiblePortal } from './components/BiblePortal';
import { AdminRlhfPortal } from './components/AdminRlhfPortal';
import { ReferencePanel } from './components/ReferencePanel';
import { FixAuditorOverlay } from './components/FixAuditorOverlay';

import { ScriptVersionExplorer } from './components/ScriptVersionExplorer';
import BeatSheetGenerator from './BeatSheetGenerator';
import { projectApi } from '../../services/project.api';
import { baseApi } from '../../services/base.api';
import { scriptWriterApi } from '../../services/scriptWriter.api';
import { treatmentApi } from '../../services/treatment.api';
import { LayoutGrid } from 'lucide-react';
import { extractStructuredAssistantSections, applySurgicalPatch, parseAssistantProposal, cleanAssistantStreamingContent } from '../../utils/assistantParser';
import type { StudioCommand, CharacterArcPoint, ChatMessage, VersionSnapshot } from './types';
import type { StudioEditorHandle } from './StudioEditor';
import { LANGUAGES, type ScreenplayMode } from './constants';

const mapLanguageNameToCode = (name: string): string => {
    const lower = name?.toLowerCase() || '';
    if (lower.includes('telugu')) return 'te';
    if (lower.includes('hindi')) return 'hi';
    if (lower.includes('tamil')) return 'ta';
    if (lower.includes('kannada')) return 'kn';
    if (lower.includes('malayalam')) return 'ml';
    if (lower.includes('spanish')) return 'es';
    if (lower.includes('french')) return 'fr';
    return '';
};

const mapLanguageCodeToName = (code: string, fallback: string = 'English'): string => {
    switch (code) {
        case 'te': return 'Telugu';
        case 'hi': return 'Hindi';
        case 'ta': return 'Tamil';
        case 'kn': return 'Kannada';
        case 'ml': return 'Malayalam';
        case 'es': return 'Spanish';
        case 'fr': return 'French';
        default: return fallback;
    }
};

function ScriptWriterInfiniteContent() {
    const { projectId, sceneId: urlSceneId } = useParams<{ projectId: string; sceneId: string }>();
    const navigate = useNavigate();

    const {
        uiState,
        setActiveProject,
        setActiveScene,
        setEditorContent,
        setLineLanguage,
        toggleLeftPanel,
        toggleRightPanel,
        setRightPanelTool,
        activeProject: contextActiveProject,
        activeScene: contextActiveScene,
        setViewMode,
        isGenerating,
        generationProgress,
        isCritiquing,
        isAiThinking,
        aiStatus,
        aiProgress,
        setIsAiThinking,
        setAiStatus,
        setAiProgress
    } = useScriptWriter();

    const [error, setError] = useState<string | null>(null);
    const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);

    const handleSetActiveProjectId = useCallback((id: string | null) => {
        if (!id) {
            navigate('/script-writer');
        } else {
            navigate(`/script-writer/${id}`);
        }
    }, [navigate]);

    const handleSetActiveSceneId = useCallback((id: string | null) => {
        if (!id) {
            if (projectId) {
                navigate(`/script-writer/${projectId}`);
            } else {
                navigate('/script-writer');
            }
        } else if (projectId) {
            navigate(`/script-writer/${projectId}/${id}`);
        }
    }, [projectId, navigate]);

    const {
        projects,
        loadingProjects,
        projectScenes,
        handleUpdateProject,
        handleDeleteProject,
        handleNewScene,
        handleUpdateScene,
        handleDeleteScene,
        handleReorderScenes,
        loadScenes,
        updateSceneInState,
    } = useScriptWriterProjects({
        activeProjectId: projectId || null,
        setActiveProjectId: handleSetActiveProjectId,
        activeSceneId: urlSceneId || null,
        setActiveSceneId: handleSetActiveSceneId,
        setError
    });

    useEffect(() => {
        if (!loadingProjects && projects.length > 0 && projectId) {
            const project = projects.find(p => p._id === projectId);
            if (project) {
                setActiveProject(project);
            } else {
                navigate('/script-writer');
            }
        }
    }, [projectId, projects, loadingProjects, setActiveProject, navigate]);

    useEffect(() => {
        if (contextActiveProject?.language) {
            const targetCode = mapLanguageNameToCode(contextActiveProject.language);
            if (uiState.lineLanguage !== targetCode) {
                setLineLanguage(targetCode);
            }
        } else if (uiState.lineLanguage !== '') {
            setLineLanguage('');
        }
    }, [contextActiveProject, uiState.lineLanguage, setLineLanguage]);

    const activeProjectId = projectId || null;
    const activeProject = contextActiveProject;
    const activeScene = contextActiveScene;

    const editorRef = useRef<StudioEditorHandle>(null);

    useEffect(() => {
        if (!activeProjectId || !urlSceneId) {
            setActiveScene(null);
            return;
        }
        const freshScene = projectScenes[activeProjectId]?.find(s => s._id === urlSceneId);
        if (!freshScene) return;
        if (
            contextActiveScene &&
            freshScene._id === contextActiveScene._id &&
            freshScene.content === contextActiveScene.content &&
            freshScene.title === contextActiveScene.title &&
            freshScene.slugline === contextActiveScene.slugline &&
            freshScene.summary === contextActiveScene.summary &&
            freshScene.status === contextActiveScene.status &&
            freshScene.pendingContent === contextActiveScene.pendingContent &&
            JSON.stringify(freshScene.critique) === JSON.stringify(contextActiveScene.critique)
        ) {
            return;
        }
        setActiveScene(freshScene);
    }, [projectScenes, activeProjectId, urlSceneId, contextActiveScene, setActiveScene]);

    const [isCastingModalOpen, setIsCastingModalOpen] = useState(false);
    const [proposedCharacters, setProposedCharacters] = useState<ProposedCharacter[]>([]);
    const [pendingGenerationCallback, setPendingGenerationCallback] = useState<((rejectedNames: string[], locations?: string[], extras?: string[]) => void) | null>(null);



    const handleCastingApprove = async (
        approved: ProposedCharacter[], 
        ignoredNames: string[], 
        locations: string[], 
        extras: string[]
    ) => {
        setIsCastingModalOpen(false);
        
        try {
            if (activeProjectId) {
                await characterApi.bulkCasting(activeProjectId, {
                    approvedCharacters: approved.map(c => ({
                        name: c.name,
                        role: c.role,
                        traits: c.traits,
                        motivation: c.motivation,
                        voiceDescription: c.voiceDescription,
                        sampleLines: c.sampleLines
                    })),
                    ignoredNames,
                    locations,
                    extras
                });
                await loadCharacters(activeProjectId);
            }
        } catch (err) {
            console.error('Failed bulk casting submission:', err);
        }

        // Trigger the callback with classifications to proceed with generation
        if (pendingGenerationCallback) {
            pendingGenerationCallback(ignoredNames, locations, extras);
            setPendingGenerationCallback(null);
        }
    };

    const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);

    const {
        editorContent,
        editorSelection,
        saveState,
        wordCount,
        critique,
        sceneForm,
        generationOptions,
        handleContentChange,
        handleSelectionChange,
        handleCritiqueScene,
        handleGenerateScene,
        handleFixScene,
        handleAcceptFix,
        handleDiscardFix,
        handleSceneFormChange,
        handleGenerationOptionChange,
        isCritiqueStale,
        pendingFix,
        setPendingFix,
        handleAiCommand,
        isOffline,
        handleForceSave,
    } = useScriptWriterSceneEditor({
        activeScene,
        activeProject,
        activeProjectId,
        updateSceneInState,
        setError,
        chatMessages
    });

    // Global keyboard shortcut listener for manual save (Ctrl + S / Cmd + S)
    useEffect(() => {
        const handleGlobalKeyDown = (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
                e.preventDefault();
                void handleForceSave();
            }
        };
        window.addEventListener('keydown', handleGlobalKeyDown);
        return () => window.removeEventListener('keydown', handleGlobalKeyDown);
    }, [handleForceSave]);

    const {
        characters,
        loadCharacters,
        characterForm,
        isSavingCharacter,
        isGeneratingCharacter,
        handleCreateCharacter,
        handleUpdateCharacter,
        handleDeleteCharacter,
        handleCharacterSelect,
        activeCharacterId,
        handleCharacterFormChange,
        ingestingCharacterIds,
        voiceStatus,
        handleVoiceIngest,
        handleGenerateCharacterProfile
    } = useScriptWriterCharacters({ activeProjectId, setError });

    const handleAcceptFixWithCasting = async () => {
        const fixContent = pendingFix?.content;
        await handleAcceptFix();
        if (fixContent && activeProjectId) {
            setIsAiThinking(true);
            setAiStatus('Auditing cast in generated content...');
            setAiProgress(30);
            try {
                const sceneGoal = activeScene?.summary || activeScene?.goal || 'Dramatic screenplay scene generation';
                const auditRes = await characterApi.auditSceneCast(activeProjectId, sceneGoal, fixContent);
                setIsAiThinking(false);
                setAiStatus('');
                setAiProgress(0);
                if (auditRes.newCharactersNeeded && auditRes.newCharactersNeeded.length > 0) {
                    const existingNames = (characters || []).map(c => (c.name || '').toUpperCase().trim());
                    const filteredNewChars = auditRes.newCharactersNeeded.filter(newChar => {
                        const newNameUpper = (newChar.name || '').toUpperCase().trim();
                        if (!newNameUpper) return false;
                        if (existingNames.includes(newNameUpper)) return false;
                        for (const existingName of existingNames) {
                            const dist = getLevenshteinDistance(newNameUpper, existingName);
                            if (dist <= 2) return false; // Auto-merge phonetic similar names
                        }
                        return true;
                    });
                    if (filteredNewChars.length > 0) {
                        const mappedProps = filteredNewChars.map(char => ({
                            name: char.name || 'UNKNOWN',
                            age: char.age || 30,
                            role: char.role || 'supporting',
                            traits: char.traits || [],
                            motivation: char.motivation || '',
                            voiceDescription: char.voiceDescription || char.voice || '',
                            sampleLines: char.sampleLines || []
                        }));
                        setProposedCharacters(mappedProps);
                        setPendingGenerationCallback(null); // No post-generation resume needed
                        setIsCastingModalOpen(true);
                    }
                }
            } catch (err) {
                setIsAiThinking(false);
                setAiStatus('');
                setAiProgress(0);
                console.error('[CastingAudit] Post-generation audit failed:', err);
            }
        }
    };

    const handleTriggerProactiveCasting = useCallback(async () => {
        if (!activeProjectId) return;
        setIsAiThinking(true);
        setAiStatus('Scanning story resources for characters...');
        setAiProgress(30);
        try {
            const proposed = await characterApi.generateProactiveCasting(activeProjectId);
            setIsAiThinking(false);
            setAiStatus('');
            setAiProgress(0);
            if (proposed && proposed.length > 0) {
                const existingNames = (characters || []).map(c => (c.name || '').toUpperCase().trim());
                const filtered = proposed.filter(p => {
                    const nameUpper = (p.name || '').toUpperCase().trim();
                    if (!nameUpper) return false;
                    if (existingNames.includes(nameUpper)) return false;
                    for (const existingName of existingNames) {
                        const dist = getLevenshteinDistance(nameUpper, existingName);
                        if (dist <= 2) return false;
                    }
                    return true;
                });
                if (filtered.length > 0) {
                    const mappedProps = filtered.map(char => ({
                        name: char.name || 'UNKNOWN',
                        age: char.age || 30,
                        role: char.role || 'supporting',
                        traits: char.traits || [],
                        motivation: char.motivation || '',
                        voiceDescription: char.voiceDescription || char.voice || '',
                        sampleLines: char.sampleLines || []
                    }));
                    setProposedCharacters(mappedProps);
                    setPendingGenerationCallback(null);
                    setIsCastingModalOpen(true);
                } else {
                    setError("No new characters found that aren't already cast.");
                }
            } else {
                setError("No new characters found in story resources.");
            }
        } catch (err) {
            setIsAiThinking(false);
            setAiStatus('');
            setAiProgress(0);
            setError("Failed to run story resources casting scan.");
        }
    }, [activeProjectId, characters, setIsAiThinking, setAiStatus, setAiProgress, setProposedCharacters, setPendingGenerationCallback, setIsCastingModalOpen, setError]);

    // Global keyboard shortcut listener for 'o' / 'O' to Scan Resources
    useEffect(() => {
        const handleGlobalKeyDown = (e: KeyboardEvent) => {
            // Press 'o' / 'O' to Scan Resources (only when not typing in form controls or editor)
            if (e.key.toLowerCase() === 'o' && !e.ctrlKey && !e.metaKey && !e.altKey) {
                const target = e.target as HTMLElement;
                if (
                    target.tagName === 'INPUT' ||
                    target.tagName === 'TEXTAREA' ||
                    target.isContentEditable
                ) {
                    return;
                }
                e.preventDefault();
                void handleTriggerProactiveCasting();
            }
        };
        window.addEventListener('keydown', handleGlobalKeyDown);
        return () => window.removeEventListener('keydown', handleGlobalKeyDown);
    }, [handleTriggerProactiveCasting]);

    const currentSceneIdRef = useRef<string | null>(null);
    const [aiModel, setAiModel] = useState('balanced');
    const [inspectorTab, setInspectorTab] = useState<'context' | 'arcs'>('context');
    const [characterArcs, setCharacterArcs] = useState<CharacterArcPoint[]>(() => {
        try {
            const saved = localStorage.getItem('sw_arcs_' + (activeProjectId || ''));
            return saved ? JSON.parse(saved) : [];
        } catch { return []; }
    });
    const [beatTemplate, setBeatTemplate] = useState('Save The Cat');

    // Versions and Snapshots state
    const [snapshots, setSnapshots] = useState<VersionSnapshot[]>([]);
    const [branches, setBranches] = useState<string[]>([]);
    const [activeBranch, setActiveBranch] = useState<string>('main');
    const [loadingSnapshots, setLoadingSnapshots] = useState(false);


    const loadSnapshots = useCallback(async () => {
        if (!activeProjectId) return;
        setLoadingSnapshots(true);
        try {
            const list = await scriptWriterApi.listSnapshots(activeProjectId, activeBranch);
            setSnapshots(list.map((s: any) => ({
                id: s._id || s.id,
                label: s.label,
                timestamp: new Date(s.timestamp || s.createdAt).getTime(),
                branch: s.branch || 'main',
                sceneCount: s.sceneCount || 0,
                description: s.description
            })));
            const branchList = await scriptWriterApi.listBranches(activeProjectId);
            setBranches(branchList && branchList.length > 0 ? branchList : ['main']);
        } catch (err) {
            console.error('Failed to load snapshots:', err);
        } finally {
            setLoadingSnapshots(false);
        }
    }, [activeProjectId, activeBranch]);

    useEffect(() => {
        if (uiState.activeTool === 'versions' && activeProjectId) {
            void loadSnapshots();
        }
    }, [uiState.activeTool, activeProjectId, activeBranch, loadSnapshots]);

    const handleSaveSnapshot = async (label: string, description?: string) => {
        if (!activeProjectId) return;
        setLoadingSnapshots(true);
        try {
            await scriptWriterApi.saveSnapshot(activeProjectId, {
                label,
                description,
                branch: activeBranch
            });
            await loadSnapshots();
        } catch (err) {
            console.error('Failed to save snapshot:', err);
            setError('Failed to save snapshot. Please try again.');
        } finally {
            setLoadingSnapshots(false);
        }
    };

    const handleSwitchBranch = (branch: string) => {
        setActiveBranch(branch);
    };

    const handleCreateBranch = async (name: string) => {
        if (!activeProjectId) return;
        setLoadingSnapshots(true);
        try {
            await scriptWriterApi.saveSnapshot(activeProjectId, {
                label: `Branch ${name} Created`,
                description: `Initial checkpoint for branch ${name}`,
                branch: name
            });
            setActiveBranch(name);
            await loadSnapshots();
        } catch (err) {
            console.error('Failed to create branch:', err);
            setError('Failed to create branch.');
        } finally {
            setLoadingSnapshots(false);
        }
    };

    const handleCompare = async (snapshotA: string, snapshotB: string) => {
        setRightPanelTool(null); // Switch to Chat
        const snapA = snapshots.find(s => s.id === snapshotA);
        const snapB = snapshots.find(s => s.id === snapshotB);
        const labelA = snapA ? `"${snapA.label}"` : snapshotA;
        const labelB = snapB ? `"${snapB.label}"` : snapshotB;
        await handleChatSendMessage(`Compare version snapshot ${labelA} with snapshot ${labelB} and explain structural and dialogue differences.`);
    };

    const handleRestore = async (snapshotId: string) => {
        const confirmed = window.confirm('Are you sure you want to restore the script from this snapshot? All current scene content will be overwritten.');
        if (!confirmed) return;
        setLoadingSnapshots(true);
        try {
            await scriptWriterApi.restoreSnapshot(snapshotId);
            if (activeProjectId) {
                await loadScenes(activeProjectId);
                setViewMode('editor');
                if (urlSceneId) {
                    navigate(`/script-writer/${activeProjectId}/${urlSceneId}`);
                }
            }
        } catch (err) {
            console.error('Failed to restore snapshot:', err);
            setError('Failed to restore snapshot.');
        } finally {
            setLoadingSnapshots(false);
        }
    };


    // Load active scene's chat history (prioritizes database, falls back to scene-specific localStorage)
    useEffect(() => {
        // Save current messages to the actual scene they belong to before switching
        if (currentSceneIdRef.current && chatMessages.length > 0) {
            localStorage.setItem('sw_chat_' + currentSceneIdRef.current, JSON.stringify(chatMessages));
        }

        if (!activeScene?._id) {
            setChatMessages([]);
            currentSceneIdRef.current = null;
            return;
        }

        currentSceneIdRef.current = activeScene._id;

        // Try loading from localStorage first to preserve critique cards and audits
        try {
            const saved = localStorage.getItem('sw_chat_' + activeScene._id);
            if (saved) {
                const parsed = JSON.parse(saved);
                if (Array.isArray(parsed) && parsed.length > 0) {
                    setChatMessages(parsed);
                    return;
                }
            }
        } catch {}

        // Fall back to activeScene.assistantChatHistory if localStorage is empty
        if (activeScene.assistantChatHistory && activeScene.assistantChatHistory.length > 0) {
            const mapped: ChatMessage[] = activeScene.assistantChatHistory.map((m: any) => ({
                id: m.id || m._id || `chat-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                role: m.role === 'user' ? 'user' : 'assistant',
                content: m.content || '',
                type: m.type === 'chat' || m.type === 'instruction' ? 'text' : m.type === 'proposal' ? 'edit' : m.type || 'text',
                timestamp: m.timestamp ? new Date(m.timestamp).getTime() : Date.now(),
                streaming: false
            }));
            setChatMessages(mapped);
            return;
        }

        setChatMessages([]);
    }, [activeScene?._id]);

    // Persist chat and arcs to localStorage when typing/chatting within the active scene
    useEffect(() => {
        if (activeScene?._id && currentSceneIdRef.current === activeScene._id && chatMessages.length > 0) {
            localStorage.setItem('sw_chat_' + activeScene._id, JSON.stringify(chatMessages));
        }
    }, [chatMessages, activeScene?._id]);

    useEffect(() => {
        if (activeProjectId) {
            localStorage.setItem('sw_arcs_' + activeProjectId, JSON.stringify(characterArcs));
        }
    }, [characterArcs, activeProjectId]);

    const addChatMessage = (msg: Omit<ChatMessage, 'id' | 'timestamp'>) => {
        const id = `chat-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
        setChatMessages(prev => [...prev, { ...msg, id, timestamp: Date.now() }]);
    };

    const addStreamingMessage = (text?: string) => {
        const id = `chat-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
        const msg = { id, role: 'assistant' as const, content: text || '', type: 'text' as const, streaming: true as const, timestamp: Date.now() };
        setChatMessages(prev => [...prev, msg]);
        return id;
    };

    const updateStreamingMessage = (id: string, content: string, streaming = false, extra: Partial<ChatMessage> = {}) => {
        setChatMessages(prev => prev.map(m => m.id === id ? { ...m, content, streaming, ...extra } : m));
    };

    const handleChatSendMessage = async (text: string, model?: string, images?: string[], existingMid?: string) => {
        if (!existingMid) {
            addChatMessage({ role: 'user', content: text, type: 'text', images });
        }

        // Relax activeScene validation. If activeScene is null but activeProjectId is active, run project assistant
        if (!activeScene?._id) {
            if (!activeProjectId) {
                if (existingMid) {
                    updateStreamingMessage(existingMid, 'Select a project first to use the assistant.', false, { type: 'error' as const });
                } else {
                    addChatMessage({ role: 'assistant', content: 'Select a project first to use the assistant.', type: 'text' });
                }
                return;
            }

            const mid = existingMid || addStreamingMessage();
            setIsAiThinking(true);
            setAiStatus('Connecting to AI...');
            try {
                let acc = '';
                const target = editorSelection ? 'selection' : 'scene';
                const selectionData = editorSelection ? {
                    text: editorSelection.text,
                    start: editorSelection.start,
                    end: editorSelection.end,
                    lineStart: editorSelection.lineStart,
                    lineEnd: editorSelection.lineEnd,
                    charCount: editorSelection.charCount
                } : undefined;

                await scriptWriterApi.projectAssistantStream(activeProjectId, text, (chunk) => {
                    acc += chunk;
                    const cleanText = cleanAssistantStreamingContent(acc, editorContent);
                    updateStreamingMessage(mid, cleanText, true, { rawContent: acc });

                    // Dynamic status from stream phases
                    if (acc.includes('<THINKING>') && !acc.includes('</THINKING>')) {
                        setAiStatus('Reasoning...');
                    } else if (acc.includes('__TOOL_CALL__:query_lore:')) {
                        setAiStatus('Querying lore database...');
                    } else if (acc.includes('__TOOL_CALL__:critique_scene')) {
                        setAiStatus('Running scene critique...');
                    } else if (acc.includes('__TOOL_CALL__:propose_edit:')) {
                        setAiStatus('Proposing script edit...');
                    } else if (acc.includes('__TOOL_CALL__:generate_outline')) {
                        setAiStatus('Generating story outline...');
                    } else if (acc.includes('</THINKING>')) {
                        setAiStatus('Composing response...');
                    }
                }, {
                    mode: 'agent', target, currentContent: editorContent,
                    selection: selectionData,
                    language: mapLanguageCodeToName(uiState.lineLanguage, activeProject?.language || 'English'), 
                    model: model || aiModel,
                    images,
                    transliteration: generationOptions.transliteration
                });

                const proposal = parseAssistantProposal(acc, editorContent);
                if (proposal.script && proposal.script.trim() && setPendingFix) {
                    const projectScenes = Object.values(scenes).filter(s => s.bibleId === activeProjectId);
                    const fallbackScene = projectScenes.sort((a, b) => new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime())[0];
                    if (fallbackScene && fallbackScene._id) {
                        const updatedScene = await projectApi.updateScene(fallbackScene._id, {
                            pendingContent: proposal.script
                        });
                        updateSceneInState(updatedScene, activeProjectId);

                        setPendingFix({
                            content: proposal.script,
                            auditNotes: proposal.explanation || undefined,
                            mode: 'proposal',
                            isStreaming: false,
                            benchmarkScore: fallbackScene.highScore?.critique?.score || 0
                        });
                        updateStreamingMessage(mid, proposal.explanation || 'Script revision proposed.', false);
                    } else {
                        updateStreamingMessage(mid, acc, false);
                    }
                } else {
                    updateStreamingMessage(mid, acc, false);
                }
            } catch (err: any) {
                const status = err?.status || err?.response?.status;
                const errText = (err?.message || err?.response?.data?.error || err?.response?.data?.message || '').toLowerCase();
                const isRateLimit = status === 429 || 
                                    errText.includes('429') || 
                                    errText.includes('rate limit') || 
                                    errText.includes('too many requests') || 
                                    errText.includes('resource_exhausted') || 
                                    errText.includes('quota');

                const msg = status === 403
                    ? "You don't have access to this project. It may belong to a different account."
                    : status === 404
                        ? "The project was not found."
                        : isRateLimit
                            ? "Please try again in 1 minute, your rate limit has been reached. You can switch to a faster model (Instant/Balanced) to bypass this."
                            : !navigator.onLine
                                ? "You appear to be offline. Check your connection and try again."
                                : "The AI service is temporarily unavailable due to a server-side error. Please try again in a moment.";
                updateStreamingMessage(mid, msg, false, { type: 'error' as const });
            } finally {
                setIsAiThinking(false);
                setAiStatus(undefined);
            }
            return;
        }

        const mid = existingMid || addStreamingMessage();
        setIsAiThinking(true);
        setAiStatus('Connecting to AI...');
        try {
            let acc = '';
            const selectionData = editorSelection ? {
                text: editorSelection.text,
                start: editorSelection.start,
                end: editorSelection.end,
                lineStart: editorSelection.lineStart,
                lineEnd: editorSelection.lineEnd,
                charCount: editorSelection.charCount
            } : undefined;
            const target = editorSelection ? 'selection' : 'scene';
            await scriptWriterApi.assistedEditStream(activeScene._id, text, (chunk) => {
                acc += chunk;
                const cleanText = cleanAssistantStreamingContent(acc, editorContent);
                updateStreamingMessage(mid, cleanText, true, { rawContent: acc });

                // Dynamic status from stream phases
                if (acc.includes('<THINKING>') && !acc.includes('</THINKING>')) {
                    setAiStatus('Reasoning...');
                } else if (acc.includes('__TOOL_CALL__:query_lore:')) {
                    setAiStatus('Querying lore database...');
                } else if (acc.includes('__TOOL_CALL__:critique_scene')) {
                    setAiStatus('Running scene critique...');
                } else if (acc.includes('__TOOL_CALL__:propose_edit:')) {
                    setAiStatus('Proposing script edit...');
                } else if (acc.includes('__TOOL_CALL__:generate_outline')) {
                    setAiStatus('Generating story outline...');
                } else if (acc.includes('</THINKING>')) {
                    setAiStatus('Composing response...');
                }
            }, {
                mode: 'agent', target, currentContent: editorContent,
                selection: selectionData,
                language: mapLanguageCodeToName(uiState.lineLanguage, activeProject?.language || 'English'), 
                model: model || aiModel,
                images,
                transliteration: generationOptions.transliteration
            });
            const proposal = parseAssistantProposal(acc, editorContent);
            if (proposal.script && proposal.script.trim() && setPendingFix) {
                const updatedScene = await projectApi.updateScene(activeScene._id, {
                    pendingContent: proposal.script
                });
                updateSceneInState(updatedScene, activeProjectId);

                setPendingFix({
                    content: proposal.script,
                    auditNotes: proposal.explanation || undefined,
                    mode: 'proposal',
                    isStreaming: false,
                    benchmarkScore: activeScene.highScore?.critique?.score || 0
                });
                updateStreamingMessage(mid, proposal.explanation || 'Script revision proposed.', false);
            } else {
                updateStreamingMessage(mid, acc, false);
            }
        } catch (err: any) {
            const status = err?.status || err?.response?.status;
            const errText = (err?.message || err?.response?.data?.error || err?.response?.data?.message || '').toLowerCase();
            const isRateLimit = status === 429 || 
                                errText.includes('429') || 
                                errText.includes('rate limit') || 
                                errText.includes('too many requests') || 
                                errText.includes('resource_exhausted') || 
                                errText.includes('quota');

            const msg = status === 403
                ? "You don't have access to this project. It may belong to a different account."
                : status === 404
                    ? "The scene or project was not found. It might have been deleted."
                    : isRateLimit
                        ? "Please try again in 1 minute, your rate limit has been reached. You can switch to a faster model (Instant/Balanced) to bypass this."
                        : !navigator.onLine
                            ? "You appear to be offline. Check your connection and try again."
                            : "The AI service is temporarily unavailable due to a server-side error. Please try again in a moment.";
            updateStreamingMessage(mid, msg, false, { type: 'error' as const });
        } finally {
            setIsAiThinking(false);
            setAiStatus(undefined);
        }
    };

    const handleChatCritique = () => {
        addChatMessage({ role: 'user', content: 'Critique this scene for quality.', type: 'text' });
        handleCritiqueScene();
        const mid = addStreamingMessage();
        setChatMessages(prev => prev.map(m => m.id === mid ? { ...m, type: 'critique' as const } : m));
    };

    const handleChatGenerate = async () => {
        addChatMessage({ role: 'user', content: 'Generate scene content.', type: 'text' });
        if (!activeScene?._id) { handleGenerateScene(); return; }
        const mid = addStreamingMessage();
        try {
            let acc = '';
            await scriptWriterApi.assistedEditStream(activeScene._id, 'Write the full scene based on: ' + (activeScene.summary || ''), (chunk) => {
                acc += chunk;
                const cleanText = cleanAssistantStreamingContent(acc, editorContent);
                updateStreamingMessage(mid, cleanText || 'Composing response...', true);
            }, {
                mode: 'agent', target: 'scene', currentContent: editorContent,
                language: mapLanguageCodeToName(uiState.lineLanguage, activeProject?.language || 'English'),
                transliteration: generationOptions.transliteration
            });
            const proposal = parseAssistantProposal(acc, editorContent);
            if (proposal.script && proposal.script.trim() && setPendingFix) {
                const updatedScene = await projectApi.updateScene(activeScene._id, {
                    pendingContent: proposal.script
                });
                updateSceneInState(updatedScene, activeProjectId);

                setPendingFix({
                    content: proposal.script,
                    auditNotes: proposal.explanation || undefined,
                    mode: 'proposal',
                    isStreaming: false,
                    benchmarkScore: activeScene.highScore?.critique?.score || 0
                });
                updateStreamingMessage(mid, proposal.explanation || 'Script revision proposed.', false);
            } else {
                updateStreamingMessage(mid, acc, false);
            }
        } catch (err: any) {
            const status = err?.status || err?.response?.status;
            const errText = (err?.message || err?.response?.data?.error || err?.response?.data?.message || '').toLowerCase();
            const isRateLimit = status === 429 || 
                                errText.includes('429') || 
                                errText.includes('rate limit') || 
                                errText.includes('too many requests') || 
                                errText.includes('resource_exhausted') || 
                                errText.includes('quota');

            const msg = status === 403 ? "You don't have access to this scene." :
                isRateLimit ? "Please try again in 1 minute, your rate limit has been reached. You can switch to a faster model (Instant/Balanced) to bypass this." :
                "An error occurred on our side. I wasn't able to generate the scene. Please try again in a moment, or ensure the scene summary is not empty.";
            updateStreamingMessage(mid, msg, false, { type: 'error' as const });
        }
    };

    const handleChatFixScene = async () => {
        addChatMessage({ role: 'user', content: 'Fix this scene based on critique.', type: 'text' });
        if (!activeScene?._id || !editorContent?.trim()) {
            addChatMessage({ role: 'assistant', content: 'Select a scene with content and run a critique first.', type: 'text' });
            return;
        }
        const mid = addStreamingMessage();
        try {
            const result = await scriptWriterApi.fixScene(activeScene._id, editorContent, 'Improve the scene based on critique feedback.');
            updateStreamingMessage(mid, result.content, false);
            setEditorContent(result.content);
            if (setPendingFix) {
                setPendingFix({ content: result.content, mode: 'fix', isStreaming: false });
            }
        } catch (err: any) {
            const status = err?.status || err?.response?.status;
            const errText = (err?.message || err?.response?.data?.error || err?.response?.data?.message || '').toLowerCase();
            const isRateLimit = status === 429 || 
                                errText.includes('429') || 
                                errText.includes('rate limit') || 
                                errText.includes('too many requests') || 
                                errText.includes('resource_exhausted') || 
                                errText.includes('quota');

            const msg = status === 400
                ? "This scene hasn't been critiqued yet. Run Critique first — I'll analyze it and then suggest fixes for whatever issues are found."
                : isRateLimit
                    ? "Please try again in 1 minute, your rate limit has been reached. You can switch to a faster model (Instant/Balanced) to bypass this."
                    : "An internal server error occurred on our side. I need a critique to work from — please try running Critique again first.";
            updateStreamingMessage(mid, msg, false, { type: 'error' as const });
        }
    };

    const handleChatGenerateTreatment = async (text: string) => {
        addChatMessage({ role: 'user', content: text, type: 'text' });
        if (!activeProjectId) {
            addChatMessage({ role: 'assistant', content: 'Open a project first to generate treatments.', type: 'text' });
            return;
        }
        const mid = addStreamingMessage();
        try {
            const logline = activeProject?.logline || text.replace(/generate treatment|outline|beat sheet/i, '').trim() || 'A compelling story';
            const acts = await treatmentApi.generateTreatment(logline, 'Save The Cat', 60, characters, activeProjectId);
            const preview = acts.map((act, i) => `Act ${i + 1}: ${act.name}\n` + act.beats.map(b => `  • ${b.name}: ${b.description}`).join('\n')).join('\n\n');
            updateStreamingMessage(mid, '**Treatment Generated**\n\n' + preview, false);
            // Save automatically
            await treatmentApi.saveTreatment(activeProjectId, logline, acts, 'Save The Cat');
        } catch (err: any) {
            const status = err?.status || err?.response?.status;
            const errText = (err?.message || err?.response?.data?.error || err?.response?.data?.message || '').toLowerCase();
            const isRateLimit = status === 429 || 
                                errText.includes('429') || 
                                errText.includes('rate limit') || 
                                errText.includes('too many requests') || 
                                errText.includes('resource_exhausted') || 
                                errText.includes('quota');

            const msg = status === 400
                ? "I need a logline to generate a treatment. Add one in the project settings — the treatment is built from the central conflict."
                : isRateLimit
                    ? "Please try again in 1 minute, your rate limit has been reached."
                    : "An error occurred on our side. I couldn't generate a treatment — check that your project has a logline, and try again in a moment.";
            updateStreamingMessage(mid, msg, false, { type: 'error' as const });
        }
    };

    const handleChatExport = async (format: string = 'fountain') => {
        addChatMessage({ role: 'user', content: 'Export ' + format + '.', type: 'text' });
        if (!activeProjectId) {
            addChatMessage({ role: 'assistant', content: 'Open a project first to export.', type: 'text' });
            return;
        }
        try {
            await projectApi.exportProject(activeProjectId, format as 'fountain' | 'txt' | 'json' | 'pdf');
            const helperText = format === 'pdf' 
                ? 'PDF download completed. The script is formatted in standard Hollywood Courier 12pt with proper margins.'
                : `Script exported in ${format} format.`;
            addChatMessage({ role: 'assistant', content: helperText, type: 'text' });
        } catch (err: any) {
            const status = err?.status || err?.response?.status;
            const msg = status === 404
                ? "No scenes found to export. Write some scenes first."
                : "I couldn't export the script right now. Try again in a moment.";
            addChatMessage({ role: 'assistant', content: msg, type: 'error' as const });
        }
    };

    const handleChatExportPDF = () => handleChatExport('pdf');
    const handleChatExportFountain = () => handleChatExport('fountain');

    const handleChatCharacterArcs = async () => {
        addChatMessage({ role: 'user', content: 'Analyze character arcs across all scenes.', type: 'text' });
        if (characters.length === 0) {
            addChatMessage({ role: 'assistant', content: "I need characters to analyze arcs. Add characters in the project settings first.", type: 'text' });
            return;
        }
        const sceneList = projectScenes[activeProjectId || ''] || [];
        if (sceneList.length === 0) {
            addChatMessage({ role: 'assistant', content: "I need scenes to analyze arcs. Generate some scenes first.", type: 'text' });
            return;
        }

        const mid = addStreamingMessage();
        try {
            const charContext = characters.map(c => `${c.name} (${c.role})`).join(', ');
            const sceneContext = sceneList.map(s =>
                `Scene ${s.sequenceNumber}: ${s.slugline || s.title || 'Untitled'}` +
                (s.summary ? `\n  Summary: ${s.summary}` : '') +
                `\n  Content preview: ${(s.content || '').slice(0, 250)}`
            ).join('\n\n');

            const prompt = `Analyze character arcs in this screenplay. Output ONLY valid JSON in a \`\`\`json code block.

For each character, list their emotional state in each scene they appear. Track emotional trajectory across scenes.

Required JSON format:
{
  "arcs": [
    {
      "characterName": "CHARACTER NAME",
      "sceneNumber": NUMBER,
      "emotionalState": "BRIEF STATE",
      "arcDirection": "rising" | "falling" | "static",
      "trajectory": "One sentence describing how this moment fits the character's journey"
    }
  ]
}

Rules:
- Only include scenes where the character demonstrably appears
- emotionalState should be 1-3 words
- arcDirection describes trajectory FROM THE PREVIOUS scene
- If you can't determine a character's state, do NOT invent it — leave them out

Characters: ${charContext}

Scenes:
${sceneContext}`;

            let accumulated = '';
            await scriptWriterApi.assistedEditStream(activeScene?._id || sceneList[0]._id, prompt, (chunk) => {
                accumulated += chunk;
                updateStreamingMessage(mid, accumulated, true);
            }, {
                mode: 'ask', target: 'scene',
                currentContent: '',
                language: 'English',
            });

            // Parse JSON from response — try multiple extraction strategies
            const extractedArcs: CharacterArcPoint[] = [];
            let jsonStr: string | null = null;

            // Strategy 1: Extract ```json ... ``` block
            const jsonBlockMatch = accumulated.match(/```json\s*([\s\S]*?)```/);
            if (jsonBlockMatch) jsonStr = jsonBlockMatch[1];

            // Strategy 2: Fallback — find top-level { ... } object
            if (!jsonStr) {
                const firstBrace = accumulated.indexOf('{');
                const lastBrace = accumulated.lastIndexOf('}');
                if (firstBrace !== -1 && lastBrace > firstBrace) {
                    jsonStr = accumulated.slice(firstBrace, lastBrace + 1);
                }
            }

            if (jsonStr) {
                try {
                    const parsed = JSON.parse(jsonStr);
                    const arcs = parsed.arcs || parsed;
                    if (Array.isArray(arcs)) {
                        for (const entry of arcs) {
                            const charName = entry.characterName || '';
                            const sceneNum = entry.sceneNumber || 0;
                            const emotion = entry.emotionalState || 'Present';
                            const character = characters.find(c => c.name.toLowerCase() === charName.toLowerCase());
                            const scene = sceneList.find(s => s.sequenceNumber === sceneNum);
                            if (character && scene) {
                                extractedArcs.push({
                                    sceneId: scene._id,
                                    sceneNumber: sceneNum,
                                    sceneTitle: scene.title || scene.slugline || `Scene ${sceneNum}`,
                                    characterId: character._id,
                                    characterName: character.name,
                                    emotionalState: emotion,
                                    status: 'suggested',
                                    notes: entry.trajectory || entry.arcDirection,
                                });
                            }
                        }
                    }
                } catch {
                    // JSON parse failed — fall through to partial extraction
                }
            }

            // Strategy 3: Fallback — line-by-line extraction for partially-structured output
            if (extractedArcs.length === 0) {
                const lines = accumulated.split('\n');
                for (const line of lines) {
                    const sceneMatch = line.match(/Scene\s*#?(\d+)/i);
                    const charMatch = line.match(/[:.}]\s*([A-Za-z\s]{2,30}?)\s*(?:[:=]|→|is|→)/);
                    const emotionMatch = line.match(/→\s*([A-Za-z][A-Za-z\s-]{1,20})/);
                    if (sceneMatch && charMatch && emotionMatch) {
                        const sceneNum = parseInt(sceneMatch[1]);
                        const charName = charMatch[1].trim();
                        const emotion = emotionMatch[1].trim();
                        const character = characters.find(c => c.name.toLowerCase() === charName.toLowerCase());
                        const scene = sceneList.find(s => s.sequenceNumber === sceneNum);
                        if (character && scene) {
                            extractedArcs.push({
                                sceneId: scene._id, sceneNumber: sceneNum,
                                sceneTitle: scene.title || scene.slugline || `Scene ${sceneNum}`,
                                characterId: character._id, characterName: character.name,
                                emotionalState: emotion, status: 'suggested',
                            });
                        }
                    }
                }
            }

            if (extractedArcs.length === 0) {
                // Show the raw AI response so the user can see what happened, rather than hiding failure
                updateStreamingMessage(mid, accumulated.slice(0, 1000) + (accumulated.length > 1000 ? '...' : ''), false);
                addChatMessage({
                    role: 'assistant', type: 'text',
                    content: "I couldn't extract structured arc data from the AI response. The analysis above shows what the AI returned. Try generating more dialogue-driven scenes, then run this analysis again. Character arcs work best when characters actively interact.",
                });
                return;
            }

            setCharacterArcs(extractedArcs);
            setInspectorTab('arcs');
            setRightPanelTool('reference');
            const charCount = new Set(extractedArcs.map(a => a.characterName)).size;
            const sceneCount = new Set(extractedArcs.map(a => a.sceneNumber)).size;
            const validScenes = sceneList.filter(s => extractedArcs.some(a => a.sceneNumber === s.sequenceNumber));
            const hasTrajectory = extractedArcs.some(a => a.notes);
            updateStreamingMessage(mid,
                `Character arc analysis complete. Tracked ${extractedArcs.length} states for ${charCount} characters across ${sceneCount} scenes.` +
                (hasTrajectory ? ' Trajectory data (rising/falling/static) is available per character.' : '') +
                ` Open the arc panel to review.`,
            false);
        } catch (err: any) {
            const status = err?.status || err?.response?.status;
            const msg = status === 429
                ? "Too many requests. Wait a moment and try again."
                : "I couldn't analyze character arcs right now. Try again with fewer scenes or characters.";
            updateStreamingMessage(mid, msg, false, { type: 'error' as const });
        }
    };

    const handleChatSaveSnapshot = async () => {
        addChatMessage({ role: 'user', content: 'Save a version snapshot.', type: 'text' });
        if (!activeProjectId) {
            addChatMessage({ role: 'assistant', content: 'Open a project first to save a snapshot.', type: 'text' });
            return;
        }
        const mid = addStreamingMessage();
        try {
            const label = `Snapshot ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
            await baseApi.request(`/script/snapshot/bible/${activeProjectId}`, {
                method: 'POST',
                body: JSON.stringify({ label, branch: 'main' }),
            });
            updateStreamingMessage(mid, `Snapshot saved: "${label}". You can view all snapshots in the project to restore or compare versions.`, false);
        } catch (err: any) {
            const status = err?.status || err?.response?.status;
            const msg = status === 429
                ? "Too many requests. Wait a moment."
                : "I couldn't save the snapshot right now. The server might be under load — try again in a moment.";
            updateStreamingMessage(mid, msg, false, { type: 'error' as const });
        }
    };

    const handleChatSubtextAnalysis = async (text: string) => {
        addChatMessage({ role: 'user', content: text, type: 'text' });
        if (!activeScene?._id || !editorContent?.trim()) {
            addChatMessage({ role: 'assistant', content: "Select a scene with dialogue to analyze for subtext.", type: 'text' });
            return;
        }
        const mid = addStreamingMessage();
        try {
            const prompt = `Analyze the subtext in this scene. For each line of dialogue, identify:
1. What the character SAYS (the surface meaning)
2. What the character actually MEANS or FEELS (the subtext)
3. Whether the dialogue is too "on the nose" (characters saying exactly what they mean)

Format as:
- Line X: "[dialogue]" — Subtext: [what they really mean] — Verdict: [on-the-nose / subtle / good]

If there are multiple on-the-nose lines, suggest rewrites for the worst three.

Scene content:
${editorContent}`;

            let accumulated = '';
            await scriptWriterApi.assistedEditStream(activeScene._id, prompt, (chunk) => {
                accumulated += chunk;
                updateStreamingMessage(mid, accumulated, true);
            }, { mode: 'ask', target: 'scene', currentContent: editorContent, language: 'English' });
            updateStreamingMessage(mid, accumulated, false);
        } catch {
            updateStreamingMessage(mid, "I couldn't analyze subtext right now. Try again with a shorter scene.", false, { type: 'error' as const });
        }
    };

    const handleChatAddImage = async (text: string) => {
        addChatMessage({ role: 'user', content: text, type: 'text' });
        if (!activeScene?._id) { addChatMessage({ role: 'assistant', content: "Select a scene first to attach an image.", type: 'text' }); return; }
        const urlMatch = text.match(/https?:\/\/[^\s]+/);
        if (!urlMatch) { addChatMessage({ role: 'assistant', content: "I need an image URL. Try: 'Add reference image https://example.com/shot.jpg'", type: 'text' }); return; }
        try {
            const scene = await scriptWriterApi.getScene(activeScene._id);
            const images = [...(scene.images || []), urlMatch[0]];
            await projectApi.updateScene(activeScene._id, { images } as any);
            addChatMessage({ role: 'assistant', content: "Reference image added to this scene. You'll see it below the editor.", type: 'text' });
        } catch {
            addChatMessage({ role: 'assistant', content: "I couldn't add the image right now.", type: 'error' as const });
        }
    };

    const handleChatAddComment = async (text: string) => {
        addChatMessage({ role: 'user', content: text, type: 'text' });
        if (!activeScene?._id) { addChatMessage({ role: 'assistant', content: "Select a scene first to add a note.", type: 'text' }); return; }
        try {
            const comment = { id: `c-${Date.now()}`, author: 'Writer', text: text.replace(/^(comment|note|suggestion)\s*/i, '').trim(), timestamp: Date.now(), resolved: false };
            const scene = await scriptWriterApi.getScene(activeScene._id);
            const comments = [...(scene.comments || []), comment];
            await projectApi.updateScene(activeScene._id, { comments } as any);
            addChatMessage({ role: 'assistant', content: `Note added: "${comment.text}"`, type: 'text' });
        } catch {
            addChatMessage({ role: 'assistant', content: "I couldn't add the note.", type: 'error' as const });
        }
    };

    const handleChatAnalyzeDialogue = async () => {
        addChatMessage({ role: 'user', content: 'Analyze dialogue rhythm.', type: 'text' });
        if (!activeScene?._id) { addChatMessage({ role: 'assistant', content: 'Select a scene first.', type: 'text' }); return; }
        const mid = addStreamingMessage();
        try {
            const result = await scriptWriterApi.critiqueScene(activeScene._id, editorContent);
            updateStreamingMessage(mid, result.summary, false, {
                type: 'analysis' as const,
                meta: {
                    score: result.score, grade: result.grade, summary: result.summary,
                    details: [
                        { label: 'Dialogue', items: result.dialogueIssues.slice(0, 3) },
                        { label: 'Pacing', items: result.pacingIssues.slice(0, 3) },
                    ],
                },
            });
        } catch (err: any) {
            const status = err?.status || err?.response?.status;
            const msg = status === 400
                ? "The scene is empty. Write some dialogue first, then analyze."
                : "I couldn't analyze the dialogue. The scene might be empty — write some dialogue first, then try analysis.";
            updateStreamingMessage(mid, msg, false, { type: 'error' as const });
        }
    };

    const handleChatAnalyzeStructure = async () => {
        addChatMessage({ role: 'user', content: 'Check story structure.', type: 'text' });
        if (!activeProjectId) { addChatMessage({ role: 'assistant', content: 'Open a project first.', type: 'text' }); return; }
        const mid = addStreamingMessage();
        try {
            const data: any = await baseApi.request(`/script/snapshot/analyze/structure/${activeProjectId}`, { method: 'POST' });
            const summary = data?.summary || data?.data?.summary;
            if (summary) {
                updateStreamingMessage(mid, summary, false);
            } else {
                updateStreamingMessage(mid, "I checked the structure but found incomplete data. The analysis service returned no details — this can happen with very new projects. Try generating more scenes first.", false, { type: 'error' as const });
            }
        } catch (err: any) {
            const status = err?.status || err?.response?.status;
            const msg = status === 429
                ? "Too many requests. Try again in a moment."
                : "I couldn't complete the structure analysis right now. The service might be under load — try again in a moment.";
            updateStreamingMessage(mid, msg, false, { type: 'error' as const });
        }
    };

    const handleChatAnalyzeCharacterArcs = async () => {
        addChatMessage({ role: 'user', content: 'Check character arc consistency.', type: 'text' });
        if (!activeScene?._id) { addChatMessage({ role: 'assistant', content: 'Select a scene first.', type: 'text' }); return; }
        const defined = characterArcs.filter(a => a.sceneNumber === activeScene.sequenceNumber || a.sceneId === activeScene._id);
        if (defined.length === 0) {
            addChatMessage({ role: 'assistant', content: "You haven't defined any emotional targets for characters in this scene yet. Please define their emotional target in the sidebar first, then run AI Check.", type: 'text' });
            return;
        }
        const mid = addStreamingMessage();
        try {
            const arcsSummary = defined.map(a => `- ${a.characterName}: Target emotion: "${a.emotionalState}"${a.notes ? ` (Notes: ${a.notes})` : ''}`).join('\n');
            const prompt = `You are a professional screenwriting script doctor. Analyze the current scene script content for emotional consistency.
The characters have specific emotional arc targets defined for this scene:
${arcsSummary}

Analyze each character's dialogue, actions, and beats in the scene below:
1. Explain if their dialogue and subtext portray their target emotional state.
2. Flag any out-of-character lines or actions that contradict their target emotion.
3. Suggest 2-3 specific, high-fidelity script updates (line rewrites) to align their dialogue with their emotional targets.

Scene script content:
${editorContent}`;

            let accumulated = '';
            await scriptWriterApi.assistedEditStream(activeScene._id, prompt, (chunk) => {
                accumulated += chunk;
                updateStreamingMessage(mid, accumulated, true);
            }, { mode: 'ask', target: 'scene', currentContent: editorContent, language: 'English' });
            updateStreamingMessage(mid, accumulated, false);
        } catch {
            updateStreamingMessage(mid, "I couldn't analyze character arc consistency right now. Try again in a moment.", false, { type: 'error' as const });
        }
    };

    // Sync critique results into chat
    useEffect(() => {
        if (critique) {
            setChatMessages(prev => {
                if (!prev.some(m => m.type === 'critique' && m.streaming)) return prev;
                return prev.map(m =>
                    m.type === 'critique' && m.streaming
                        ? {
                            ...m,
                            content: critique.summary,
                            streaming: false,
                            meta: {
                                score: critique.score,
                                grade: critique.grade,
                                summary: critique.summary,
                                details: [
                                    { label: 'Formatting', items: critique.formattingIssues },
                                    { label: 'Dialogue', items: critique.dialogueIssues },
                                    { label: 'Pacing', items: critique.pacingIssues },
                                    { label: 'Suggestions', items: critique.suggestions },
                                ],
                            },
                        }
                        : m
                );
            });
        }
    }, [critique]);

    // Global keyboard shortcut for command palette
    // Skip when the editor textarea is focused — StudioEditor handles Ctrl+K itself.
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
                const active = document.activeElement as HTMLElement | null;
                if (active?.tagName === 'TEXTAREA') return; // Let StudioEditor handle it
                e.preventDefault();
                setCommandPaletteOpen(prev => {
                    const next = !prev;
                    if (next) {
                        setRightPanelTool(null);
                    }
                    return next;
                });
            }
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [setRightPanelTool]);

    // Warn on unsaved changes before leaving
    useEffect(() => {
        const handler = (e: BeforeUnloadEvent) => {
            if (isGenerating || isCritiquing || isAiThinking || saveState !== 'saved') {
                e.preventDefault();
            }
        };
        window.addEventListener('beforeunload', handler);
        return () => window.removeEventListener('beforeunload', handler);
    }, [isGenerating, isCritiquing, isAiThinking, saveState]);

    const onCommand = (command: StudioCommand) => {
        if (isAiThinking || isGenerating || isCritiquing) {
            setError("An AI operation is already in progress. Please wait for the current action to finish.");
            return;
        }

        setRightPanelTool(null);

        switch (command.action) {
            case 'generate':
                handleChatGenerate();
                break;
            case 'critique':
                handleChatCritique();
                break;
            case 'new_scene':
                if (activeProjectId) handleNewScene(activeProjectId);
                break;
            case 'analyze_dialogue':
                handleChatSendMessage('Analyze the dialogue pace, character voice, and rhythm in this scene.');
                break;
            case 'analyze_structure':
                handleChatSendMessage('Run a structure check on this scene to validate story conventions.');
                break;
            case 'rewrite':
                handleChatSendMessage('Rewrite this scene to improve its flow and tone.');
                break;
            case 'expand':
                if (editorSelection?.text?.trim()) {
                    handleChatSendMessage(`Expand this selection with more sensory detail: "${editorSelection.text}"`);
                } else {
                    handleChatSendMessage('Expand this scene with more detail and subtext.');
                }
                break;
            case 'new_beat':
                handleChatSendMessage('Analyze the current story structure, character dynamics, and themes. Please make tool calls to insert a new dramatic beat directly into this scene, and identify a narrative extension point where a new scene should be added to expand the story.');
                break;
            case 'character_arc':
                handleChatCharacterArcs();
                break;
            case 'version_snapshot':
                handleForceSave();
                break;
            case 'version_compare':
                handleChatSendMessage('Compare current scene content with the last saved snapshot.');
                break;
            case 'export':
                handleChatExport('pdf');
                break;
            case 'transliterate':
                const nextVal = !generationOptions.transliteration;
                handleGenerationOptionChange('transliteration', nextVal);
                if (activeProject?._id) {
                    handleUpdateProject(activeProject._id, { transliteration: nextVal });
                }
                break;
            case 'view_editor':
                setViewMode('editor');
                break;
            case 'view_bible':
                setViewMode('bible');
                break;
            case 'view_beat_sheet':
                setViewMode('beat-sheet');
                break;
            case 'settings':
                navigate('/settings');
                break;
        }
        setCommandPaletteOpen(false); // Auto-close palette on action
    };

    const scenes = activeProjectId ? (projectScenes[activeProjectId] || []) : [];
    const sceneCount = scenes.length;
    const hasSelection = !!editorSelection?.text?.trim();

    if (loadingProjects) {
        return (
            <div className="flex flex-col items-center justify-center h-screen bg-bg-app">
                <div className="w-8 h-8 rounded-full border-2 border-border-strong border-t-accent animate-spin" />
                <div className="mt-4 text-xs font-medium tracking-tight text-text-tertiary">Loading workspace...</div>
            </div>
        );
    }

    if (!activeProjectId || !activeProject) {
        return (
            <div className="flex flex-col items-center justify-center h-screen bg-bg-app">
                <div className="p-3 bg-bg-panel rounded-2xl border border-border-strong shadow-sm">
                    <LayoutGrid size={24} className="text-text-muted" />
                </div>
                <div className="mt-4 text-xs font-medium tracking-tight text-text-tertiary">Opening project...</div>
            </div>
        );
    }

    return (
        <InfiniteLayout
            leftPanelOpen={uiState.leftPanelOpen}
            rightPanelOpen={uiState.rightPanelOpen}
            beatBoardOpen={uiState.beatBoardOpen}
            onCloseLeftPanel={toggleLeftPanel}
            onCloseRightPanel={toggleRightPanel}
            beatBoard={
                <ErrorBoundary fallback={<LocalPanelFallback name="Beat Board" />}>
                    <BeatBoard
                        scenes={scenes}
                        onNewScene={handleNewScene}
                        onDeleteScene={handleDeleteScene}
                        onReorderScenes={async (reordered) => {
                            if (activeProjectId) {
                                await handleReorderScenes(activeProjectId, reordered);
                            }
                        }}
                        onGenerateScene={(sceneId) => {
                            const scene = scenes.find(s => s._id === sceneId);
                            if (scene) {
                                if (activeProjectId) {
                                    navigate(`/script-writer/${activeProjectId}/${sceneId}`);
                                }
                                handleGenerateScene();
                            }
                        }}
                        beatTemplate={beatTemplate}
                        onBeatTemplateChange={setBeatTemplate}
                    />
                </ErrorBoundary>
            }
            leftPanel={
                <ErrorBoundary fallback={<LocalPanelFallback name="Structure" />}>
                    <StructurePanel
                        scenes={scenes}
                        onNewScene={handleNewScene}
                        onDeleteScene={handleDeleteScene}
                        onUpdateScene={async (sceneId, updates) => {
                            if (!activeProjectId) return;
                            const updated = await handleUpdateScene(activeProjectId, sceneId, updates);
                            if (updated && urlSceneId === sceneId) {
                                setActiveScene(updated);
                            }
                        }}
                        onReorderScenes={async (reordered) => {
                            if (activeProjectId) {
                                await handleReorderScenes(activeProjectId, reordered);
                            }
                        }}
                    />
                </ErrorBoundary>
            }
            rightPanel={
                uiState.activeTool === 'reference' ? (
                    <ErrorBoundary fallback={<LocalPanelFallback name="Reference Inspector" />}>
                        <ReferencePanel
                            activeScene={activeScene}
                            isOpen={uiState.rightPanelOpen}
                            onClose={() => setRightPanelTool(null)}
                            arcs={characterArcs}
                            characters={characters}
                            onDefineArc={(entry) => setCharacterArcs(prev => {
                                const idx = prev.findIndex(a => a.characterId === entry.characterId && a.sceneNumber === entry.sceneNumber);
                                if (idx >= 0) {
                                    const next = [...prev];
                                    next[idx] = { ...next[idx], emotionalState: entry.emotionalState, notes: entry.notes };
                                    return next;
                                }
                                const scene = scenes.find(s => s.sequenceNumber === entry.sceneNumber);
                                return [...prev, { ...entry, sceneId: scene?._id || entry.characterId, sceneTitle: scene?.title || scene?.slugline || `Scene ${entry.sceneNumber}`, status: 'approved' as const }];
                            })}
                            onRemoveArc={(charId, sceneNum) => setCharacterArcs(prev => prev.filter(a => !(a.characterId === charId && a.sceneNumber === sceneNum)))}
                            onAiCheck={handleChatAnalyzeCharacterArcs}
                            onUpdateScene={(updated) => updateSceneInState(updated, activeProjectId)}
                            defaultTab={inspectorTab}
                        />
                    </ErrorBoundary>
                ) : uiState.activeTool === 'versions' ? (
                    <ErrorBoundary fallback={<LocalPanelFallback name="Versions" />}>
                        <ScriptVersionExplorer
                            snapshots={snapshots}
                            branches={branches}
                            activeBranch={activeBranch}
                            onSaveSnapshot={handleSaveSnapshot}
                            onSwitchBranch={handleSwitchBranch}
                            onCreateBranch={handleCreateBranch}
                            onCompare={handleCompare}
                            onRestore={handleRestore}
                            loading={loadingSnapshots}
                        />
                    </ErrorBoundary>
                ) : (
                    <ErrorBoundary fallback={<LocalPanelFallback name="Assistant Chat" />}>
                        <AssistantChat
                            isGenerating={isGenerating}
                            isCritiquing={isCritiquing}
                            onCritique={handleChatCritique}
                            onGenerate={() => {
                                handleChatGenerate();
                            }}
                            onFix={handleChatFixScene}
                            onTreatment={() => handleChatGenerateTreatment('Generate a treatment')}
                            onExport={() => handleChatExport('fountain')}
                            onAnalyzeDialogue={handleChatAnalyzeDialogue}
                            onAnalyzeStructure={handleChatAnalyzeStructure}
                            onSendMessage={(msg, model, images) => {
                                addChatMessage({ role: 'user', content: msg, type: 'text', images });
                                const mid = addStreamingMessage();
                                handleChatSendMessage(msg, model || aiModel, images, mid);
                            }}
                            messages={chatMessages}
                            aiModel={aiModel}
                            onAiModelChange={setAiModel}
                            isAiThinking={isAiThinking}
                            aiStatus={aiStatus}
                        />
                    </ErrorBoundary>
                )
            }
        >
            <div className="flex-1 flex flex-col h-full relative">
                <InfiniteTopbar />

                <ActionToolbar
                    hasActiveScene={!!activeScene}
                    hasSelection={hasSelection}
                    isGenerating={isGenerating}
                    isCritiquing={isCritiquing}
                    onCommand={onCommand}
                    onToggleCommandPalette={() => {
                        setCommandPaletteOpen(true);
                        setRightPanelTool(null);
                    }}
                    onToggleContext={() => {
                        setInspectorTab('context');
                        setRightPanelTool('reference');
                    }}
                    onToggleCharacterArcs={() => {
                        setInspectorTab('arcs');
                        setRightPanelTool('reference');
                    }}
                    onApplyMode={(mode, lang) => editorRef.current?.applyMode(mode, lang)}
                    currentTab={inspectorTab}
                />

                <CommandPalette
                    isOpen={commandPaletteOpen}
                    onClose={() => setCommandPaletteOpen(false)}
                    onCommand={onCommand}
                    hasActiveScene={!!activeScene}
                    hasSelection={hasSelection}
                    isAiBusy={isAiThinking || isGenerating || isCritiquing}
                />

                <div
                    className="flex-1 w-full overflow-hidden relative flex flex-col"
                    style={{ isolation: 'isolate' }}
                >
                    {uiState.viewMode === 'editor' ? (
                        <div className="flex-1 min-h-0 relative">

                            <StudioEditor
                                ref={editorRef}
                                activeProject={activeProject}
                                activeScene={activeScene}
                                editorContent={editorContent}
                                editorSelection={editorSelection}
                                onContentChange={handleContentChange}
                                onSelectionChange={handleSelectionChange}
                                saveState={saveState}
                                onSave={handleForceSave}
                                wordCount={wordCount}
                                sceneCount={sceneCount}
                                characterCount={characters.length}
                                isGenerating={isGenerating}
                                generationProgress={generationProgress}
                                isCritiquing={isCritiquing}
                                isLoading={Boolean(urlSceneId && activeScene?._id !== urlSceneId)}
                                isAiThinking={isAiThinking}
                                aiStatus={aiStatus}
                                aiProgress={aiProgress}
                                onAiCommand={(command, prompt) => {
                                    handleAiCommand(command, prompt);
                                }}
                            />
                            </div>
                    ) : uiState.viewMode === 'beat-sheet' ? (
                        <ErrorBoundary fallback={<LocalPanelFallback name="Beat Sheet Generator" />}>
                            {activeProject ? (
                                <BeatSheetGenerator
                                    project={activeProject}
                                    onBack={() => setViewMode('editor')}
                                    onRefreshProject={async () => {
                                        if (activeProjectId) {
                                            const updated = await projectApi.getProject(activeProjectId);
                                            setActiveProject(updated);
                                            await loadScenes(activeProjectId);
                                        }
                                    }}
                                />
                            ) : (
                                <div className="p-6 text-center text-text-tertiary">Please select a project first.</div>
                            )}
                        </ErrorBoundary>
                    ) : uiState.viewMode === 'admin-health' ? (
                        <ErrorBoundary fallback={<LocalPanelFallback name="RLHF Health" />}>
                            <AdminRlhfPortal activeProject={activeProject} />
                        </ErrorBoundary>
                    ) : (
                        <BiblePortal
                            activeProject={activeProject}
                            characters={characters}
                            onUpdateProject={handleUpdateProject}
                            onDeleteProject={handleDeleteProject}
                            characterForm={characterForm}
                            isSavingCharacter={isSavingCharacter}
                            onCreateCharacter={handleCreateCharacter}
                            onUpdateCharacter={handleUpdateCharacter}
                            onDeleteCharacter={handleDeleteCharacter}
                            onCharacterSelect={handleCharacterSelect}
                            activeCharacterId={activeCharacterId}
                            onCharacterFormChange={handleCharacterFormChange}
                            ingestingCharacterIds={ingestingCharacterIds}
                            voiceStatus={voiceStatus}
                            onVoiceIngest={handleVoiceIngest}
                            isGeneratingCharacter={isGeneratingCharacter}
                            onGenerateCharacterProfile={handleGenerateCharacterProfile}
                            onTriggerProactiveCasting={handleTriggerProactiveCasting}
                            isCastingScan={isAiThinking}
                        />
                    )}

                    {pendingFix && (
                        <FixAuditorOverlay
                            originalContent={editorContent}
                            pendingFix={pendingFix}
                            onAccept={handleAcceptFixWithCasting}
                            onDiscard={handleDiscardFix}
                        />
                    )}

                    <CastingCallModal
                        isOpen={isCastingModalOpen}
                        proposedCharacters={proposedCharacters}
                        bibleId={activeProjectId!}
                        onClose={() => {
                            setIsCastingModalOpen(false);
                            setPendingGenerationCallback(null);
                        }}
                        onApprove={handleCastingApprove}
                    />
                </div>

                <StudioStatusbar
                    projectCount={projects.length}
                    activeProject={activeProject}
                    activeScene={activeScene}
                    saveState={saveState}
                    error={error}
                    isOffline={isOffline}
                    onRetrySave={handleForceSave}
                />
            </div>
        </InfiniteLayout>
    );
}

export function ScriptWriterInfinite() {
    return (
        <ScriptWriterInfiniteContent />
    );
}
