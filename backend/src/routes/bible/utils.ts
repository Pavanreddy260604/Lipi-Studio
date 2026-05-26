import { Bible } from '../../models/Bible.js';

export type AssistantPreferencesInput = {
    defaultMode?: 'ask' | 'edit' | 'agent';
    replyLanguage?: string;
    transliteration?: boolean;
    savedDirectives?: string[];
};

export function normalizeAssistantPreferences(
    raw: unknown,
    existing?: AssistantPreferencesInput | null
): AssistantPreferencesInput | null {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
    const input = raw as Record<string, unknown>;
    const defaultMode = typeof input.defaultMode === 'string' ? input.defaultMode : existing?.defaultMode;
    if (defaultMode && !['ask', 'edit', 'agent'].includes(defaultMode)) throw new Error('INVALID_ASSISTANT_DEFAULT_MODE');
    const replyLanguage = typeof input.replyLanguage === 'string' ? input.replyLanguage.trim() : existing?.replyLanguage;
    const transliteration = typeof input.transliteration === 'boolean' ? input.transliteration : existing?.transliteration;
    const savedDirectives = input.savedDirectives !== undefined ? input.savedDirectives : existing?.savedDirectives;
    if (savedDirectives !== undefined && !Array.isArray(savedDirectives)) throw new Error('INVALID_ASSISTANT_DIRECTIVES');
    const normalizedDirectives = (savedDirectives || [])
        .filter((item): item is string => typeof item === 'string')
        .map((item) => item.trim())
        .filter(Boolean)
        .slice(0, 12);
    return {
        defaultMode: (defaultMode as 'ask' | 'edit' | 'agent') || 'ask',
        replyLanguage: replyLanguage || undefined,
        transliteration,
        savedDirectives: normalizedDirectives
    };
}

export function formatAssistantContext(raw: unknown): string | undefined {
    if (typeof raw === 'string') { const trimmed = raw.trim(); return trimmed || undefined; }
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined;
    const context = raw as Record<string, any>;
    const sections: string[] = [];

    if (context.project && typeof context.project === 'object') {
        const lines = ['PROJECT SUMMARY',
            typeof context.project.title === 'string' ? `Title: ${context.project.title}` : '',
            typeof context.project.logline === 'string' ? `Logline: ${context.project.logline}` : '',
            typeof context.project.genre === 'string' ? `Genre: ${context.project.genre}` : '',
            typeof context.project.tone === 'string' ? `Tone: ${context.project.tone}` : '',
            typeof context.project.language === 'string' ? `Language: ${context.project.language}` : ''].filter(Boolean);
        if (lines.length > 1) sections.push(lines.join('\n'));
    }

    if (context.scene && typeof context.scene === 'object') {
        const lines = ['ACTIVE SCENE',
            typeof context.scene.id === 'string' ? `Scene ID: ${context.scene.id}` : '',
            typeof context.scene.name === 'string' ? `Scene: ${context.scene.name}` : ''].filter(Boolean);
        if (lines.length > 1) sections.push(lines.join('\n'));
    }

    if (context.script && typeof context.script === 'object' && typeof context.script.excerpt === 'string' && context.script.excerpt.trim()) {
        sections.push(`OPEN SCENE SCRIPT\n${context.script.excerpt.trim().slice(0, 12000)}`);
    }

    if (context.selection && typeof context.selection === 'object' && typeof context.selection.text === 'string' && context.selection.text.trim()) {
        const lines = ['ACTIVE SELECTION',
            typeof context.selection.lineStart === 'number' && typeof context.selection.lineEnd === 'number'
                ? `Lines: ${context.selection.lineStart}-${context.selection.lineEnd}` : '',
            typeof context.selection.charCount === 'number' ? `Characters: ${context.selection.charCount}` : '',
            context.selection.text.trim()].filter(Boolean);
        sections.push(lines.join('\n'));
    }

    if (context.reply && typeof context.reply === 'object') {
        const lines = ['REPLY PREFERENCES',
            typeof context.reply.language === 'string' ? `Reply Language: ${context.reply.language}` : '',
            typeof context.reply.transliteration === 'boolean' ? `Transliteration: ${context.reply.transliteration ? 'enabled' : 'disabled'}` : ''].filter(Boolean);
        if (lines.length > 1) sections.push(lines.join('\n'));
    }

    if (context.assistantPreferences && typeof context.assistantPreferences === 'object') {
        const directives = Array.isArray(context.assistantPreferences.savedDirectives)
            ? context.assistantPreferences.savedDirectives.filter((item: unknown): item is string => typeof item === 'string' && item.trim().length > 0) : [];
        const lines = ['SAVED ASSISTANT PREFERENCES',
            typeof context.assistantPreferences.replyLanguage === 'string' ? `Preferred Reply Language: ${context.assistantPreferences.replyLanguage}` : '',
            typeof context.assistantPreferences.transliteration === 'boolean' ? `Preferred Transliteration: ${context.assistantPreferences.transliteration ? 'enabled' : 'disabled'}` : '',
            directives.length > 0 ? `Directives:\n- ${directives.slice(0, 8).join('\n- ')}` : ''].filter(Boolean);
        if (lines.length > 1) sections.push(lines.join('\n'));
    }

    return sections.length > 0 ? sections.join('\n\n') : undefined;
}

export async function assertBibleAccess(id: string, userId?: string) {
    const bible = await Bible.findOne({ _id: id, userId });
    if (!bible) throw new Error('ACCESS_DENIED');
    return bible;
}
