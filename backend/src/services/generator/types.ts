import { FORMAT_TEMPLATES, STYLE_PROMPTS } from '../../prompts/hollywood/index.js';

export interface ScriptRequest {
    userId: string;
    idea: string;
    format: keyof typeof FORMAT_TEMPLATES;
    style: keyof typeof STYLE_PROMPTS;
    genre?: string;
    tone?: string;
    language?: string;
    transliteration?: boolean;
    bibleId?: string;
    sceneId?: string;
    sceneSequenceNumber?: number;
    sceneSlugline?: string;
    sceneSummary?: string;
    sceneGoal?: string;
    characterIds?: string[];
    previousContext?: string;
    sceneLength?: 'short' | 'medium' | 'long' | 'extended';
    era?: string;
    polarityShift?: string;
    centralTactic?: string;
    internalRhythm?: 'slow' | 'fast' | 'staccato' | 'fluid';
    useAdvancedCoherence?: boolean;
    model?: string;
    speedMode?: boolean;
    sceneLocations?: string[];
    genericExtras?: string[];
}

export interface AssistedEditSelection {
    text: string;
    start?: number;
    end?: number;
    lineStart?: number;
    lineEnd?: number;
    lineCount?: number;
    charCount?: number;
    preview?: string;
}

export interface AssistedEditOptions {
    language?: string;
    mode?: 'ask' | 'edit' | 'agent';
    target?: 'scene' | 'selection';
    currentContent?: string;
    selection?: AssistedEditSelection | null;
    transliteration?: boolean;
    model?: string;
    style?: string;
    intent?: 'chat' | 'selection_edit' | 'scene_edit' | 'treatment' | 'ambiguous';
}

export type AssistantPreferenceState = {
    defaultMode?: 'ask' | 'edit' | 'agent';
    replyLanguage?: string;
    transliteration?: boolean;
    savedDirectives?: string[];
};

export type NormalizedAssistantPreferences = {
    defaultMode: 'ask' | 'edit' | 'agent';
    replyLanguage: string;
    transliteration?: boolean;
    savedDirectives: string[];
};

export type AskIntent = 'chat' | 'selection_edit' | 'scene_edit' | 'ambiguous';

export const ASSISTANT_V2_ENABLED = (process.env.SCRIPT_WRITER_ASSISTANT_V2 || 'true').toLowerCase() !== 'false';

export const EXPLANATION_TEXT_LIMIT = 4000;
