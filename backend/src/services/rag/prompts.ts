import type {
    BuildAssistantReferencePackParams,
    AssistantReference,
    AssistantReferenceGroup,
    AssistantSourceFamily,
    AssistantHistoryEntry
} from './types.js';
import { truncateText, normalizeSectionText, STOP_WORDS } from './utils.js';

export function getQuotas(params: BuildAssistantReferencePackParams) {
    if (params.lite) {
        return { projectContinuity: 1, projectStyle: 1, masterFeed: 1, recentContinuity: 2 };
    }
    if (params.mode === 'ask') {
        return { projectContinuity: 2, projectStyle: 3, masterFeed: 3, recentContinuity: 3 };
    }
    if (params.target === 'selection') {
        return { projectContinuity: 1, projectStyle: 4, masterFeed: 3, recentContinuity: 2 };
    }
    return { projectContinuity: 3, projectStyle: 4, masterFeed: 1, recentContinuity: 4 };
}

export function buildOutlineWindow(globalOutline?: string[], sequenceNumber?: number): string {
    if (!globalOutline?.length) return '';
    if (sequenceNumber === undefined || sequenceNumber === null) {
        return globalOutline.slice(0, 4).join(' | ');
    }
    const beatIndex = Math.max(0, Math.floor((sequenceNumber - 1) / 5));
    const start = Math.max(0, beatIndex - 1);
    const end = Math.min(globalOutline.length, beatIndex + 2);
    return globalOutline.slice(start, end).join(' | ');
}

export function buildProjectContinuityReferences(params: BuildAssistantReferencePackParams): AssistantReference[] {
    const references: AssistantReference[] = [];

    if (params.bible?.storySoFar?.trim()) {
        references.push({
            group: 'project_continuity',
            sourceFamily: 'continuity',
            label: 'Story so far',
            excerpt: truncateText(params.bible.storySoFar, 4000),
            score: 1.1
        });
    }

    const outlineWindow = buildOutlineWindow(params.bible?.globalOutline, params.scene?.sequenceNumber);
    if (outlineWindow) {
        references.push({
            group: 'project_continuity',
            sourceFamily: 'continuity',
            label: 'Global outline window',
            excerpt: truncateText(outlineWindow, 1200),
            score: 0.96
        });
    }

    if (params.scene?.previousSceneSummary?.trim()) {
        references.push({
            group: 'project_continuity',
            sourceFamily: 'continuity',
            label: 'Previous scene state',
            excerpt: truncateText(params.scene.previousSceneSummary, 800),
            score: 0.92
        });
    }

    return references;
}

export function extractPersistentDirectives(history: AssistantHistoryEntry[]): string {
    if (!history || history.length === 0) return '';

    const directives: string[] = [];
    const userTurns = history.filter(h => h.role === 'user').slice(-12);

    for (const turn of userTurns) {
        const content = turn.content.toLowerCase();
        const isDirective =
            /\b(never|always|don't|stop|strictly|ensure|keep|avoid|forbid|prefer|only|instead|format|style|tone)\b/i.test(content) ||
            (content.length < 180 && /\b(character|voice|dialogue|slugline|beat|pacing)\b/i.test(content));

        if (isDirective) {
            directives.push(`- ${turn.content.trim()}`);
        }
    }

    if (directives.length === 0) return 'No active session-level constraints.';

    return [...new Set(directives)].reverse().join('\n');
}

export function buildQueryVariants(params: BuildAssistantReferencePackParams): Array<{ key: 'intent' | 'content' | 'style' | 'expansion'; text: string }> {
    const recentUserTurns = (params.scene?.assistantChatHistory || [])
        .filter((entry) => entry.role === 'user')
        .slice(-3)
        .map((entry) => truncateText(entry.content, 200))
        .filter(Boolean)
        .join('\n');

    const contentBlock = params.selection?.text?.trim()
        ? params.selection.text.slice(0, 1800)
        : (params.currentContent || params.scene?.content || '').slice(0, 2200);

    const styleBlock = [
        params.bible?.title ? `Project: ${params.bible.title}` : '',
        params.bible?.genre ? `Genre: ${params.bible.genre}` : '',
        params.bible?.tone ? `Tone: ${params.bible.tone}` : '',
        params.bible?.visualStyle ? `Visual Style: ${params.bible.visualStyle}` : '',
        params.bible?.language ? `Language: ${params.bible.language}` : '',
        params.bible?.storySoFar ? `Story So Far: ${truncateText(params.bible.storySoFar, 900)}` : '',
        params.bible?.globalOutline?.length
            ? `Global Outline: ${truncateText(params.bible.globalOutline.slice(0, 6).join(' | '), 900)}`
            : '',
        params.scene?.previousSceneSummary ? `Previous Scene: ${truncateText(params.scene.previousSceneSummary, 320)}` : '',
        recentUserTurns ? `Recent User Intent: ${recentUserTurns}` : ''
    ].filter(Boolean).join('\n');

    const variants = [
        { key: 'intent' as const, text: [params.instruction, params.scene?.slugline || '', params.scene?.summary || '', recentUserTurns].filter(Boolean).join('\n\n') },
        { key: 'content' as const, text: contentBlock },
        { key: 'style' as const, text: styleBlock }
    ].filter((variant) => variant.text.trim());

    const seen = new Set<string>();
    const filteredVariants: Array<{ key: 'intent' | 'content' | 'style' | 'expansion'; text: string }> = variants.filter((variant) => {
        const normalized = normalizeSectionText(variant.text);
        if (!normalized || seen.has(normalized)) return false;
        seen.add(normalized);
        return true;
    }) as Array<{ key: 'intent' | 'content' | 'style' | 'expansion'; text: string }>;

    const textExpansion = expandQueryWithText(
        params.instruction,
        params.currentContent || params.scene?.content || ''
    );
    if (textExpansion) {
        filteredVariants.push({
            key: 'expansion',
            text: textExpansion
        });
    }

    return filteredVariants;
}

export function expandQueryWithText(instruction: string, content: string): string | null {
    const clean = instruction.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').trim();
    const words = clean.split(/\s+/).filter(w => w.length > 3 && !STOP_WORDS.has(w));

    const contentWords = content.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/)
        .filter(w => w.length > 3 && !STOP_WORDS.has(w));
    const contentFreq = new Map<string, number>();
    for (const w of contentWords) contentFreq.set(w, (contentFreq.get(w) || 0) + 1);
    const topContent = [...contentFreq.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(e => e[0]);

    const expansion = [...new Set([...words, ...topContent])].slice(0, 15).join(' ');
    return expansion.length > 10 ? expansion : null;
}

export function formatSection(title: string, references: AssistantReference[]): string {
    if (!references.length) return '';

    const body = references.map((reference, index) => {
        const context = reference.parentContext ? `\n[CONTEXT: ${reference.parentContext}]` : '';
        return `--- REFERENCE ${index + 1} (${reference.label}) ---\n${reference.excerpt}${context}`;
    }).join('\n\n');

    return `### ${title}\n\n${body}`;
}
