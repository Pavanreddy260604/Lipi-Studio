import { useState, useRef, useCallback, useEffect } from 'react';
import { projectApi } from '../../services/project.api';
import type { Bible, BeatSheetStructureInfo } from '../../services/project.api';
import { treatmentApi } from '../../services/treatment.api';
import type { Treatment } from '../../services/treatment.api';
import { useTreatmentStore } from '../../stores/treatmentStore';
import type { ParsedAct } from '../../stores/treatmentStore';
import './BeatSheetGenerator.css';

interface BeatSheetGeneratorProps {
    project: Bible;
    onBack: () => void;
    onRefreshProject: () => void;
}

type GenerationState = 'idle' | 'generating' | 'done' | 'error';

const DEFAULT_STRUCTURES: Record<string, BeatSheetStructureInfo> = {
    save_the_cat: { name: 'Save the Cat (Blake Snyder)', description: '15 specific beats with page targets. Best for commercial genre films.', beatCount: '15 beats' },
    three_act: { name: 'Three-Act Structure (Syd Field)', description: 'Classic Setup → Confrontation → Resolution. Universal and flexible.', beatCount: '8-10 beats' },
    five_act: { name: 'Five-Act Structure (Shakespeare)', description: 'Exposition → Rising Action → Crisis → Climax → Denouement. For complex dramas.', beatCount: '10-12 beats' },
    heros_journey: { name: "Hero's Journey (Campbell/Vogler)", description: '12-stage monomyth. Best for epic, mythic, or transformation stories.', beatCount: '12 beats' },
    story_circle: { name: 'Story Circle (Dan Harmon)', description: '8-step circular structure. Great for TV episodes and short form.', beatCount: '8 beats' },
    sequence: { name: 'Sequence Approach', description: '8-12 self-contained sequences. Manages long second acts.', beatCount: '8-12 sequences' },
    indian_commercial: { name: 'Indian Commercial Cinema', description: 'Hero introduction → Interval Block → Climax. For masala films.', beatCount: '12-14 beats' },
    tv_beat_sheet: { name: 'TV Drama (5-Act)', description: 'Teaser → Act breaks → Tag. For episodic television.', beatCount: '10-12 beats' },
    fictional_pulse: { name: 'Fictional Pulse (4-Part)', description: 'Awake → Tension → Crash → Beat. Rhythm-based alternative.', beatCount: '10-12 beats' },
};

export default function BeatSheetGenerator({ project, onBack, onRefreshProject }: BeatSheetGeneratorProps) {
    const activeGen = useTreatmentStore(state => state.activeGeneration);
    const generateBeatAgentOutlineStream = useTreatmentStore(state => state.generateBeatAgentOutlineStream);

    const [selectedStructure, setSelectedStructure] = useState<string>('save_the_cat');
    const [sceneCount, setSceneCount] = useState<number>(project.targetSceneCount || 60);
    const [customInstructions, setCustomInstructions] = useState('');

    // Local overrides when loading saved beat sheets
    const [loadedActs, setLoadedActs] = useState<ParsedAct[] | null>(null);
    const [loadedState, setLoadedState] = useState<GenerationState | null>(null);
    const [loadedError, setLoadedError] = useState('');

    const [saving, setSaving] = useState(false);
    const [saveSuccess, setSaveSuccess] = useState(false);
    const [converting, setConverting] = useState(false);
    const [savedTreatments, setSavedTreatments] = useState<Treatment[]>([]);
    const [activeTreatmentId, setActiveTreatmentId] = useState<string | null>(null);
    const outputRef = useRef<HTMLDivElement>(null);
    const abortControllerRef = useRef<AbortController | null>(null);

    // Clean up abort controller on unmount
    useEffect(() => {
        return () => {
            if (abortControllerRef.current) {
                abortControllerRef.current.abort();
            }
        };
    }, []);

    // Bind state from store, falling back to local overrides if loading a saved treatment
    const generationState: GenerationState = loadedState || (activeGen ? activeGen.state : 'idle');
    const rawOutput = activeGen ? activeGen.rawOutput : '';
    const parsedActs = loadedActs || (activeGen ? activeGen.parsedActs : []);
    const error = loadedError || (activeGen ? (activeGen.error || '') : '');

    // Sync selected structure & scene count if returning to an active generation
    useEffect(() => {
        if (activeGen && activeGen.bibleId === project._id) {
            setSelectedStructure(activeGen.selectedStructure);
            setSceneCount(activeGen.sceneCount);
        }
    }, [activeGen, project._id]);

    const loadSavedTreatments = useCallback(async () => {
        try {
            const data = await treatmentApi.getTreatments(project._id);
            setSavedTreatments(data);
        } catch (e) {
            console.error("Failed to load treatments", e);
        }
    }, [project._id]);

    useEffect(() => {
        void loadSavedTreatments();
    }, [loadSavedTreatments]);

    const handleGenerate = useCallback(async () => {
        if (!project.logline?.trim()) {
            setLoadedState('error');
            setLoadedError('Project Logline / Sequence Hook is required to generate a beat sheet. Please specify it in project details.');
            return;
        }

        // Abort previous stream if still in-progress
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
        }

        const controller = new AbortController();
        abortControllerRef.current = controller;

        setLoadedActs(null);
        setLoadedState(null);
        setLoadedError('');

        try {
            await generateBeatAgentOutlineStream(
                project._id,
                project.logline.trim(),
                selectedStructure,
                sceneCount,
                customInstructions || undefined,
                controller.signal
            );
        } catch (err: any) {
            if (err instanceof Error && err.name === 'AbortError') {
                console.log("[BeatSheet] Generation request was aborted cleanly.");
            } else {
                console.error("Failed to trigger background generator", err);
            }
        }
    }, [project._id, project.logline, selectedStructure, sceneCount, customInstructions, generateBeatAgentOutlineStream]);

    const handleSaveTreatment = useCallback(async () => {
        if (parsedActs.length === 0) return;
        setSaving(true);
        setSaveSuccess(false);
        try {
            const saved = await treatmentApi.saveTreatment(
                project._id,
                (project.logline || '').trim(),
                parsedActs,
                DEFAULT_STRUCTURES[selectedStructure]?.name || 'Custom'
            );
            setSaving(false);
            setSaveSuccess(true);
            setActiveTreatmentId(saved._id);
            void loadSavedTreatments();
            setTimeout(() => setSaveSuccess(false), 3000);
        } catch {
            setSaving(false);
        }
    }, [parsedActs, project._id, project.logline, selectedStructure, loadSavedTreatments]);

    const handleConvertToScenes = useCallback(async () => {
        if (parsedActs.length === 0) return;
        setConverting(true);
        try {
            await treatmentApi.syncBeatAgentOutline(project._id);
            onRefreshProject();
            setConverting(false);
            onBack();
        } catch {
            setConverting(false);
        }
    }, [parsedActs, project._id, onRefreshProject, onBack]);

    const totalBeats = parsedActs.reduce((sum, act) => sum + act.beats.length, 0);

    return (
        <div className="beat-sheet-generator">
            <header className="bsg-header">
                <button className="bsg-back-btn focus-ring" onClick={onBack} id="beat-sheet-back">
                    ← Back to Studio
                </button>
                <div className="bsg-header-info">
                    <h1 className="bsg-title">Beat Sheet Generator</h1>
                    <span className="bsg-subtitle">{project.title} — {project.genre}</span>
                </div>
            </header>

            <div className="bsg-layout">
                {/* Left: Configuration Panel */}
                <aside className="bsg-config">
                    <div className="bsg-config-scroll">
                        <section className="bsg-section">
                            <h2 className="bsg-section-title">Project Logline</h2>
                            <div className="bsg-logline-display">
                                &ldquo;{project.logline || 'No logline defined.'}&rdquo;
                            </div>
                        </section>

                        <section className="bsg-section">
                            <h2 className="bsg-section-title">Structure Type</h2>
                            <div className="bsg-structure-grid">
                                {Object.entries(DEFAULT_STRUCTURES).map(([key, info]) => (
                                    <button
                                        key={key}
                                        className={`bsg-structure-card focus-ring ${selectedStructure === key ? 'active' : ''}`}
                                        onClick={() => setSelectedStructure(key)}
                                        id={`structure-${key}`}
                                    >
                                        <span className="bsg-structure-name">{info.name}</span>
                                        <span className="bsg-structure-desc">{info.description}</span>
                                        <span className="bsg-structure-beats">{info.beatCount}</span>
                                    </button>
                                ))}
                            </div>
                        </section>

                        <section className="bsg-section">
                            <h2 className="bsg-section-title">Scene Count</h2>
                            <div className="bsg-scene-count">
                                <input
                                    type="number"
                                    className="bsg-input focus-ring"
                                    value={sceneCount}
                                    onChange={(e) => setSceneCount(Math.max(1, Math.min(300, Number(e.target.value))))}
                                    min={1}
                                    max={300}
                                    id="scene-count-input"
                                />
                                <span className="bsg-scene-hint">From project: {project.targetSceneCount || 60} scenes</span>
                            </div>
                        </section>

                        <section className="bsg-section">
                            <h2 className="bsg-section-title">Custom Instructions</h2>
                            <textarea
                                className="bsg-textarea focus-ring"
                                placeholder="Optional: Add specific directions for the AI..."
                                value={customInstructions}
                                onChange={(e) => setCustomInstructions(e.target.value)}
                                rows={4}
                                id="custom-instructions"
                            />
                        </section>

                        {savedTreatments.length > 0 && (
                            <section className="bsg-section">
                                <h2 className="bsg-section-title">Saved Beat Sheets</h2>
                                <div className="bsg-saved-list">
                                    {savedTreatments.map((treatment) => (
                                        <button
                                            key={treatment._id}
                                            className={`bsg-saved-item focus-ring ${activeTreatmentId === treatment._id ? 'active' : ''}`}
                                            onClick={() => {
                                                const mappedActs: ParsedAct[] = treatment.acts.map(act => ({
                                                    name: act.name,
                                                    beats: act.beats.map(beat => ({
                                                        name: beat.name,
                                                        title: (beat as any).title || '',
                                                        slugline: (beat as any).slugline || '',
                                                        description: beat.description
                                                    }))
                                                }));
                                                setLoadedActs(mappedActs);
                                                setActiveTreatmentId(treatment._id);
                                                setLoadedState('done');
                                                setLoadedError('');
                                            }}
                                            type="button"
                                        >
                                            <div className="bsg-saved-info">
                                                <span className="bsg-saved-title">{treatment.style}</span>
                                                <span className="bsg-saved-meta">
                                                    {treatment.acts.reduce((acc, act) => acc + act.beats.length, 0)} scenes
                                                </span>
                                            </div>
                                            <span className="bsg-saved-arrow">→</span>
                                        </button>
                                    ))}
                                </div>
                            </section>
                        )}
                    </div>

                    {/* Fixed Sidebar Footer for Pinned Generate Button */}
                    <div className="bsg-config-footer">
                        <button
                            className="bsg-generate-btn focus-ring"
                            onClick={handleGenerate}
                            disabled={generationState === 'generating'}
                            id="generate-beat-sheet-btn"
                        >
                            {generationState === 'generating' ? (
                                <>Generating with Mistral Large...</>
                            ) : (
                                <>Generate Beat Sheet ({sceneCount} scenes)</>
                            )}
                        </button>
                    </div>
                </aside>

                {/* Right: Output */}
                <main className="bsg-output" ref={outputRef}>
                    {generationState === 'idle' && (
                        <div className="bsg-empty-state">
                            <div className="bsg-empty-icon">🎬</div>
                            <h2>Ready to Generate</h2>
                            <p>Select a structure type, set your scene count, and hit generate.</p>
                            <p className="bsg-empty-hint">The AI will use your project's logline, characters, rules, and any story resources uploaded in the Bible.</p>
                        </div>
                    )}

                    {generationState === 'generating' && parsedActs.length === 0 && (
                        <div className="bsg-streaming">
                            <div className="bsg-streaming-indicator">
                                <span className="bsg-pulse" />
                                <span>Initializing the AI Brain and streaming Scene 1...</span>
                            </div>
                        </div>
                    )}

                    {generationState === 'error' && (
                        <div className="bsg-error">
                            <h3>Generation Failed</h3>
                            <p>{error}</p>
                            <button className="bsg-btn-primary focus-ring" onClick={handleGenerate}>
                                Retry
                            </button>
                        </div>
                    )}

                    {parsedActs.length > 0 && (
                        <div className="bsg-results">
                            {generationState === 'generating' && (
                                <div className="bsg-advanced-loader">
                                    <div className="bsg-loader-glow-orb">
                                        <div className="bsg-loader-ping" />
                                        <div className="bsg-loader-dot" />
                                    </div>
                                    <div className="bsg-loader-content">
                                        <div className="bsg-loader-top">
                                            <span className="bsg-loader-status-badge">Mistral AI Engine</span>
                                            <span className="bsg-loader-activity-tag">Active Stream</span>
                                        </div>
                                        <div className="bsg-loader-main-text">
                                            Streaming scene beat generation...
                                        </div>
                                        <div className="bsg-loader-subtext">
                                            Synthesizing screenplay acts, action lines, and character dialogues in real-time.
                                        </div>
                                        <div className="bsg-visualizer-container">
                                            <span className="bsg-vis-bar" style={{ animationDelay: '0.1s' }} />
                                            <span className="bsg-vis-bar" style={{ animationDelay: '0.3s' }} />
                                            <span className="bsg-vis-bar" style={{ animationDelay: '0.5s' }} />
                                            <span className="bsg-vis-bar" style={{ animationDelay: '0.2s' }} />
                                            <span className="bsg-vis-bar" style={{ animationDelay: '0.4s' }} />
                                            <span className="bsg-vis-bar" style={{ animationDelay: '0.6s' }} />
                                            <span className="bsg-vis-bar" style={{ animationDelay: '0.3s' }} />
                                            <span className="bsg-vis-bar" style={{ animationDelay: '0.1s' }} />
                                        </div>
                                    </div>
                                </div>
                            )}

                            {generationState === 'done' && (
                                <div className="bsg-success-acknowledgement animate-fade-in">
                                    <span className="bsg-success-icon">✓</span>
                                    <span className="bsg-success-text">
                                        <strong>Beat Sheet Completed!</strong> All acts and scene cards have been generated. You can now save or convert them.
                                    </span>
                                </div>
                            )}

                            <div className="bsg-results-header">
                                <h2>{DEFAULT_STRUCTURES[selectedStructure]?.name || 'Beat Sheet'}</h2>
                                <span className="bsg-results-stats">
                                    {parsedActs.length} acts · {totalBeats} beats · {sceneCount} target scenes
                                </span>
                                <div className="bsg-results-actions">
                                    <button
                                        className={`bsg-btn-secondary focus-ring ${saveSuccess ? 'save-success-glow' : ''}`}
                                        onClick={handleSaveTreatment}
                                        disabled={saving || generationState === 'generating'}
                                        id="save-treatment-btn"
                                    >
                                        {saving ? 'Saving...' : saveSuccess ? '✓ Saved!' : 'Save as Treatment'}
                                    </button>
                                    <button
                                        className="bsg-btn-primary focus-ring"
                                        onClick={handleConvertToScenes}
                                        disabled={converting || generationState === 'generating'}
                                        id="convert-scenes-btn"
                                    >
                                        {converting ? 'Converting...' : 'Convert to Scenes'}
                                    </button>
                                </div>
                            </div>

                            {parsedActs.map((act, actIndex) => (
                                <div key={actIndex} className="bsg-act">
                                    <h3 className="bsg-act-name">{act.name}</h3>
                                    <div className="bsg-beats-grid">
                                        {act.beats.map((beat, beatIndex) => (
                                            <div key={beatIndex} className="bsg-beat-card">
                                                <div className="bsg-beat-header">
                                                    <span className="bsg-beat-number">
                                                        {parsedActs.slice(0, actIndex).reduce((sum, a) => sum + a.beats.length, 0) + beatIndex + 1}
                                                    </span>
                                                    <span className="bsg-beat-name">{beat.name}</span>
                                                </div>
                                                {beat.title && beat.title !== '...' && (
                                                    <h4 className="bsg-beat-title">{beat.title}</h4>
                                                )}
                                                {beat.slugline && (
                                                    <span className="bsg-beat-slugline">{beat.slugline}</span>
                                                )}
                                                <p className="bsg-beat-desc">{beat.description || beat.summary}</p>
                                            </div>
                                        ))}
                                        {generationState === 'generating' && actIndex === parsedActs.length - 1 && (
                                            <div className="bsg-beat-card loading-card">
                                                <div className="bsg-beat-header">
                                                    <span className="bsg-pulse" />
                                                    <span className="bsg-beat-name">Drafting Next Scenes...</span>
                                                </div>
                                                <h4 className="bsg-beat-title italic">Writer is busy doing your work</h4>
                                                <p className="bsg-beat-desc text-text-tertiary">
                                                    The system is preparing the next narrative beats block. Please stand by...
                                                </p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {generationState === 'done' && parsedActs.length === 0 && rawOutput && (
                        <div className="bsg-raw-results">
                            <h3>Raw Output (Could not parse as structured beats)</h3>
                            <pre className="bsg-raw-output">{rawOutput}</pre>
                        </div>
                    )}
                </main>
            </div>
        </div>
    );
}
