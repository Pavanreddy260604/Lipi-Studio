import type { AssistedEditSelection, NormalizedAssistantPreferences } from './types.js';

export function buildEditorAssistantPrompt(template: string, params: Record<string, any>): string {
    return Object.entries(params).reduce((p, [k, v]) => p.split(`{{${k}}}`).join(String(v)), template);
}

export function buildAssistantChatHistoryText(entries?: Array<{ role: 'user' | 'assistant'; content: string }>): string {
    if (!entries?.length) return 'No previous conversation.\n';

    const relevantEntries = entries.slice(-5);

    return relevantEntries.map(e => {
        const compressedContent = e.content
            .replace(/<SCENE_SCRIPT>[\s\S]*?(?:<\/SCENE_SCRIPT>|$)/gi, '[Screenplay draft - omitted to conserve tokens]')
            .replace(/```(fountain|script-edit|screenplay)[\s\S]*?(?:```|$)/gi, '[Screenplay draft - omitted to conserve tokens]')
            .slice(0, 1000);

        return `[${e.role.toUpperCase()}]: ${compressedContent}`;
    }).join('\n\n');
}

export function buildAssistantPreferencesBlock(prefs: NormalizedAssistantPreferences, lang: string, trans: boolean): string {
    return `Language: ${prefs.replyLanguage || lang}\nTransliteration: ${trans ? 'Enabled' : 'Disabled'}\nDirectives: ${prefs.savedDirectives.join(', ')}`;
}

export function buildAssistantSelectionBlock(selection?: AssistedEditSelection | null): string {
    if (!selection?.text?.trim()) return 'No explicit selection provided.';
    return `[Lines ${selection.lineStart}-${selection.lineEnd}] Characters: ${selection.charCount || selection.text.length}\n${selection.text}`;
}

export function buildAssistantOutputContract(mode: string, target: string, selection?: AssistedEditSelection | null): string {
    if (mode === 'ask') {
        return `CONVERSATION MODE CONTRACT:
1. Provide a sharp, agentic critique or analysis. No fluff.
2. If suggesting changes, use bullet points with specific examples.
3. DO NOT output the 5-STEP REPLICA STRUCTURE unless explicitly commanded.
4. Your goal is to guide the user, not write the script for them.`;
    }

    if (target === 'selection' && selection) {
        return `LOCAL PATCH CONTRACT (CRITICAL):
1. Output MUST use the 5-STEP REPLICA STRUCTURE.
2. In STEP 3 (SCENE_SCRIPT), output EXACTLY ONE \`\`\`script-edit block.
3. The <<<SEARCH>>> block MUST perfectly match the selected text. Not a single character, space, or newline can differ.
4. The <<<REPLACE>>> block contains your elite rewrite.
5. NEVER rewrite text outside the provided selection borders.`;
    }

    return `FULL SCENE REWRITE CONTRACT (CRITICAL):
1. Output MUST use the 5-STEP REPLICA STRUCTURE.
2. In STEP 3 (SCENE_SCRIPT), you MUST output your entire revised or generated screenplay content inside a single \`\`\`script-edit block.
3. DO NOT use <<<SEARCH>>> or <<<REPLACE>>> tags. Just output the clean, full revised screenplay.
4. Ensure it has standard Hollywood formatting (sluglines, actions, characters, dialogue).`;
}

export function getAssistantPreferences(bible: any): NormalizedAssistantPreferences {
    return {
        defaultMode: bible?.assistantPreferences?.defaultMode || 'ask',
        replyLanguage: bible?.assistantPreferences?.replyLanguage || '',
        transliteration: !!bible?.assistantPreferences?.transliteration,
        savedDirectives: bible?.assistantPreferences?.savedDirectives || []
    };
}
