import type { AssistantPreferences, IScene, CritiqueResult } from '../../services/project.api';
import type { Character } from '../../services/character.api';
import type { ScriptRequest } from '../../services/scriptWriter.api';

export type { CritiqueResult };

export type SaveState = 'saved' | 'saving' | 'unsaved' | 'error';
export type InspectorTab = 'project' | 'scene';
export type StudioMode = 'write' | 'generate' | 'cast' | 'story';
export type EditorSelection = {
    start: number;
    end: number;
    text: string;
    lineStart: number;
    lineEnd: number;
    lineCount: number;
    charCount: number;
    preview: string;
};

// Legacy types (kept for backward compatibility with existing utility functions)
export type AssistantIntent = 'chat' | 'selection_edit' | 'scene_edit' | 'ambiguous';
export type AssistantScope = 'scene' | 'selection';

export type CommandGroup = 'write' | 'edit' | 'analyze' | 'structure' | 'character' | 'version' | 'export' | 'system';
export type StudioCommand = {
    id: string;
    label: string;
    description: string;
    group: CommandGroup;
    icon?: string;
    shortcut?: string;
    requiresScene?: boolean;
    requiresSelection?: boolean;
    action: 'generate' | 'rewrite' | 'expand' | 'critique' | 'analyze_dialogue' | 'analyze_structure' | 'analyze_rhythm' | 'new_scene' | 'new_beat' | 'reorder' | 'character_arc' | 'version_snapshot' | 'version_branch' | 'version_compare' | 'export' | 'transliterate' | 'settings' | 'view_editor' | 'view_bible' | 'view_beat_sheet';
};

export type PendingFixState = {
    content: string;
    critique?: IScene['critique'];
    auditNotes?: string;
    isSuperior?: boolean;
    benchmarkScore?: number;
    mode?: 'fix' | 'proposal';
    isStreaming?: boolean;
    proposalMessageId?: string;
    commitProposal?: () => Promise<void>;
    discardProposal?: () => Promise<void>;
};

export type ProjectForm = {
    title: string;
    logline: string;
    genre: string;
    tone: string;
    language: string;
    transliteration: boolean;
    intendedRuntime?: number;
    targetSceneCount?: number;
    assistantPreferences: AssistantPreferences;
    initialResourceTitle?: string;
    initialResourceContent?: string;
    selectedResourceFile?: File | null;
};

export type CharacterForm = {
    name: string;
    role: Character['role'];
    voiceDescription: string;
    voiceAccent: string;
    traits: string;
    motivation: string;
};

export type GenerationOptions = {
    style: string;
    format: string;
    sceneLength: ScriptRequest['sceneLength'];
    language: string;
    transliteration: boolean;
    speedMode?: boolean;
};


export type VersionSnapshot = {
    id: string;
    label: string;
    timestamp: number;
    branch: string;
    sceneCount: number;
    description?: string;
};

export type CharacterArcPoint = {
    sceneId: string;
    sceneNumber: number;
    sceneTitle: string;
    characterId: string;
    characterName: string;
    emotionalState: string;
    status: 'suggested' | 'approved' | 'modified';
    notes?: string;
};

// Flexible beat markers — not tied to scene numbers. Writers can assign
// any beat label to any scene via the scene form or chat command.
export const STRUCTURAL_TEMPLATES: Record<string, Record<number, string>> = {
    "Save The Cat": {
        1: 'Opening Image', 5: 'Catalyst', 7: 'Break into Two',
        10: 'B Story', 15: 'Midpoint', 19: 'All Is Lost',
        21: 'Break into Three', 25: 'Final Image',
    },
    "Indian Commercial Cinema": {
        1: 'Hero Introduction', 3: 'Hero Song Setup', 5: 'Conflict Introduction',
        7: 'Villain Establishment', 10: 'Interval Block - First Half Climax',
        12: 'Interval', 15: 'Second Half Opening', 18: 'Pre-Climax Fight',
        20: 'Climax Confrontation', 22: 'Resolution & Family Sentiment',
        25: 'Climax Song / Celebration',
    },
    "Hero's Journey": {
        1: 'Ordinary World', 3: 'Call to Adventure', 5: 'Refusal',
        7: 'Meeting the Mentor', 10: 'Crossing the Threshold',
        13: 'Tests and Enemies', 16: 'Supreme Ordeal',
        19: 'Reward', 22: 'Road Back', 25: 'Return with Elixir',
    },
};

export type BeatCard = {
    sceneId: string;
    sequenceNumber: number;
    act?: number;
    beatLabel?: string;
    sequence?: number;
    title: string;
    slugline: string;
    summary: string;
    status: IScene['status'];
    characterCount: number;
    wordCount: number;
    hasCritique: boolean;
    critiqueScore?: number;
    notes?: string;
};

export type SceneForm = {
    title: string;
    slugline: string;
    summary: string;
    goal: string;
    status: IScene['status'];
    notes?: string;
    images?: string[];
    comments?: SceneComment[];
};

export type SceneComment = {
    id: string;
    author: string;
    text: string;
    timestamp: number;
    resolved?: boolean;
};

export type ChatMessage = {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    rawContent?: string;
    type: 'text' | 'critique' | 'edit' | 'analysis' | 'error';
    streaming?: boolean;
    timestamp: number;
    meta?: {
        score?: number;
        grade?: string;
        summary?: string;
        details?: Array<{ label: string; items: string[] }>;
    };
    images?: string[];
};

export const DEFAULT_SCENE_FORM: SceneForm = {
    title: '',
    slugline: '',
    summary: '',
    goal: '',
    status: 'planned'
};

export const DEFAULT_PROJECT_FORM: ProjectForm = {
    title: '',
    logline: '',
    genre: 'Drama',
    tone: 'Cinematic',
    language: 'English',
    transliteration: false,
    targetSceneCount: 60,
    assistantPreferences: {
        defaultMode: 'ask',
        savedDirectives: []
    },
    initialResourceTitle: '',
    initialResourceContent: ''
};

export const DEFAULT_CHARACTER_FORM: CharacterForm = {
    name: '',
    role: 'supporting',
    voiceDescription: '',
    voiceAccent: '',
    traits: '',
    motivation: ''
};

export const DEFAULT_GENERATION: GenerationOptions = {
    style: 'classic',
    format: 'film',
    sceneLength: 'medium',
    language: 'English',
    transliteration: false,
    speedMode: false
};

export const DEFAULT_NEW_PROJECT: ProjectForm = {
    title: 'Untitled Script',
    logline: '',
    genre: 'Drama',
    tone: 'Cinematic',
    language: 'English',
    transliteration: false,
    intendedRuntime: 120,
    targetSceneCount: 60,
    assistantPreferences: {
        defaultMode: 'ask',
        savedDirectives: []
    },
    initialResourceTitle: '',
    initialResourceContent: '',
    selectedResourceFile: null
};

export const STUDIO_COMMANDS: StudioCommand[] = [
    { id: 'generate', label: 'Generate Scene', description: 'Generate full scene content from summary', group: 'write', action: 'generate', requiresScene: true },
    { id: 'rewrite', label: 'Rewrite Scene', description: 'Rewrite scene with new style or direction', group: 'edit', action: 'rewrite', requiresScene: true },
    { id: 'expand', label: 'Expand Selection', description: 'Expand selected lines with more detail', group: 'edit', action: 'expand', requiresScene: true, requiresSelection: true },
    { id: 'critique', label: 'Critique Scene', description: 'Analyze scene for quality, pacing, dialogue', group: 'analyze', action: 'critique', requiresScene: true },
    { id: 'analyze_dialogue', label: 'Dialogue Rhythm', description: 'Analyze dialogue pacing and character voice', group: 'analyze', action: 'analyze_dialogue', requiresScene: true },
    { id: 'analyze_structure', label: 'Structure Check', description: 'Validate story structure against conventions', group: 'analyze', action: 'analyze_structure', requiresScene: true },
    { id: 'new_scene', label: 'New Scene', description: 'Add a new scene to the project', group: 'structure', action: 'new_scene' },
    { id: 'new_beat', label: 'New Beat', description: 'Add a story beat to the outline', group: 'structure', action: 'new_beat' },
    { id: 'character_arc', label: 'Character Arc', description: 'View and manage character arcs', group: 'character', action: 'character_arc', requiresScene: true },
    { id: 'version_snapshot', label: 'Save Snapshot', description: 'Save a version snapshot of the script', group: 'version', action: 'version_snapshot' },
    { id: 'version_compare', label: 'Compare Versions', description: 'Compare two script versions', group: 'version', action: 'version_compare' },
    { id: 'export', label: 'Export Script', description: 'Export in Fountain, PDF, or TXT', group: 'export', action: 'export' },
    { id: 'transliterate', label: 'Toggle Transliteration', description: 'Toggle Romanized script output', group: 'write', action: 'transliterate' },
    { id: 'view_editor', label: 'Open Editor', description: 'Switch to the Script Editor view', group: 'system', action: 'view_editor', shortcut: 'E' },
    { id: 'view_bible', label: 'Open Bible', description: 'Switch to the Project Bible view', group: 'system', action: 'view_bible', shortcut: 'B' },
    { id: 'view_beat_sheet', label: 'Open Beat Sheet', description: 'Switch to the Beat Sheet view', group: 'system', action: 'view_beat_sheet' },

    { id: 'settings', label: 'System Settings', description: 'Open application settings', group: 'system', action: 'settings', shortcut: ',' }
];
