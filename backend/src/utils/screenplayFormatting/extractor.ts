import { STRUCTURED_SECTION_LABELS } from './types.js';
import { normalizeScreenplayWhitespace } from './normalizer.js';

function buildStructuredSectionHeadingPattern(labels: readonly string[]): RegExp {
    return new RegExp(
        `(?:^|\\n)\\s{0,3}#{0,6}\\s*(?:\\*\\*\\s*)?(?:STEP\\s*\\d+\\s*:\\s*)?(?:\\*\\*\\s*)?<?(?:${labels.join('|')})>?(?:\\s*\\(JSON\\))?\\s*\\*?\\*?\\s*:?\\s*(?:\\*\\*\\s*)?(?:\\n|$)`,
        'i'
    );
}

function extractStructuredSection(content: string, label: string, nextLabels: readonly string[]): string {
    const normalized = content.replace(/\r\n?/g, '\n');
    
    const tagPattern = new RegExp(`<${label}>([\\s\\S]*?)(?:</${label}>|$)`, 'i');
    const tagMatch = tagPattern.exec(normalized);
    if (tagMatch && tagMatch[1].trim()) {
        return tagMatch[1].trim();
    }

    const startPattern = buildStructuredSectionHeadingPattern([label]);
    const startMatch = startPattern.exec(normalized);

    if (!startMatch) {
        return '';
    }

    const afterStart = normalized.slice(startMatch.index + startMatch[0].length);
    const endPattern = nextLabels.length > 0 ? buildStructuredSectionHeadingPattern(nextLabels) : null;
    const endMatch = endPattern?.exec(afterStart);
    const section = endMatch ? afterStart.slice(0, endMatch.index) : afterStart;
    return section.trim();
}

export function hasStructuredAssistantSections(content: string): boolean {
    return buildStructuredSectionHeadingPattern(STRUCTURED_SECTION_LABELS).test(content.replace(/\r\n?/g, '\n'));
}

function stripTrailingStructuredUpdates(content: string): string {
    const normalized = content.replace(/\r\n?/g, '\n');
    
    const tagIndex = normalized.search(/<(CHARACTER_MEMORY_UPDATE|PLOT_STATE_UPDATE|AGENT_EXPLANATION|NARRATIVE_CRAFT|CREATIVE_PLAN|RESEARCH_DISCLOSURE)>/i);
    if (tagIndex !== -1) return normalized.slice(0, tagIndex);

    const trailingMarkerIndex = normalized.search(buildStructuredSectionHeadingPattern([
        'CHARACTER_MEMORY_UPDATE',
        'PLOT_STATE_UPDATE',
        'AGENT_EXPLANATION',
        'NARRATIVE_CRAFT',
        'CREATIVE_PLAN',
        'RESEARCH_DISCLOSURE'
    ]));
    return trailingMarkerIndex === -1 ? normalized : normalized.slice(0, trailingMarkerIndex);
}

function looksLikeScreenplayStart(line: string): boolean {
    const trimmed = line.trim();
    if (!trimmed) return false;

    if (buildStructuredSectionHeadingPattern(STRUCTURED_SECTION_LABELS).test(`\n${trimmed}\n`)) {
        return false;
    }

    if (/^(INT\.?|EXT\.?|EST\.?|INT\/EXT\.?|INT\.\/EXT\.?|EXT\/INT\.?|EXT\.\/INT\.?|I\/E\.?)\s+.+$/i.test(trimmed)) {
        return true;
    }

    if (/^(FADE IN:?|FADE OUT\.?|CUT TO:|MATCH CUT TO:|SMASH CUT TO:|DISSOLVE TO:)$/.test(trimmed.toUpperCase()) || trimmed.toUpperCase().endsWith(' TO:')) {
        return true;
    }

    if (trimmed.startsWith('@') || /^>\s*.+\s*<$/.test(trimmed) || trimmed.startsWith('~')) {
        return true;
    }

    const normalized = trimmed.replace(/^@\s*/, '').replace(/\^\s*$/, '').trim();
    return (
        normalized.length > 0 &&
        normalized.length <= 40 &&
        normalized === normalized.toUpperCase() &&
        /[A-Z]/.test(normalized) &&
        !/[.!?]$/.test(normalized)
    );
}

export function extractBestEffortScreenplay(content: string): string {
    const cleaned = stripTrailingStructuredUpdates(
        content
            .replace(/\r\n?/g, '\n')
            .replace(/^RESPONSE:\s*/i, '')
            .replace(/^REVISED SCRIPT:\s*/i, '')
            .trim()
    );

    if (!cleaned.trim()) {
        return '';
    }

    const lines = cleaned.split('\n');
    const screenplayStartIndex = lines.findIndex(looksLikeScreenplayStart);

    if (screenplayStartIndex !== -1) {
        return normalizeScreenplayWhitespace(lines.slice(screenplayStartIndex).join('\n'));
    }

    if (hasStructuredAssistantSections(cleaned)) {
        return '';
    }

    return normalizeScreenplayWhitespace(cleaned);
}

export function extractBestEffortAssistantAnswer(content: string): string {
    const cleaned = content
        .replace(/\r\n?/g, '\n')
        .replace(/^RESPONSE:\s*/i, '')
        .trim();
    if (!cleaned) {
        return '';
    }

    if (!hasStructuredAssistantSections(cleaned)) {
        return cleaned;
    }

    const summary = extractStructuredSection(cleaned, 'STORY_CONTEXT_SUMMARY', [
        'SCENE_PLAN',
        'CREATIVE_PLAN',
        'SCENE_SCRIPT',
        'CHARACTER_MEMORY_UPDATE',
        'PLOT_STATE_UPDATE'
    ]);
    const plan = extractStructuredSection(cleaned, 'SCENE_PLAN', [
        'SCENE_SCRIPT',
        'CHARACTER_MEMORY_UPDATE',
        'PLOT_STATE_UPDATE',
        'NARRATIVE_CRAFT'
    ]) || extractStructuredSection(cleaned, 'CREATIVE_PLAN', [
        'SCENE_SCRIPT',
        'CHARACTER_MEMORY_UPDATE',
        'PLOT_STATE_UPDATE',
        'AGENT_EXPLANATION'
    ]);
    const craft = extractStructuredSection(cleaned, 'NARRATIVE_CRAFT', [
        'PLOT_STATE_UPDATE'
    ]) || extractStructuredSection(cleaned, 'AGENT_EXPLANATION', [
        'CHARACTER_MEMORY_UPDATE',
        'PLOT_STATE_UPDATE'
    ]);

    return [summary, plan, craft].filter(Boolean).join('\n\n').trim();
}

export function extractStructuredAssistantSections(content: string): {
    summary?: string;
    plan?: string;
    script: string;
    craft?: string;
    research?: string;
} {
    const summary = extractStructuredSection(content, 'STORY_CONTEXT_SUMMARY', [
        'SCENE_PLAN',
        'CREATIVE_PLAN',
        'SCENE_SCRIPT',
        'CHARACTER_MEMORY_UPDATE',
        'PLOT_STATE_UPDATE',
        'NARRATIVE_CRAFT'
    ]);
    const research = extractStructuredSection(content, 'RESEARCH_DISCLOSURE', [
        'SCENE_PLAN',
        'CREATIVE_PLAN',
        'SCENE_SCRIPT'
    ]);
    const plan = extractStructuredSection(content, 'SCENE_PLAN', [
        'SCENE_SCRIPT',
        'CHARACTER_MEMORY_UPDATE',
        'PLOT_STATE_UPDATE',
        'NARRATIVE_CRAFT'
    ]) || extractStructuredSection(content, 'CREATIVE_PLAN', [
        'SCENE_SCRIPT',
        'CHARACTER_MEMORY_UPDATE',
        'PLOT_STATE_UPDATE',
        'AGENT_EXPLANATION'
    ]);
    const finalScriptText = extractStructuredSection(content, 'SCENE_SCRIPT', [
        'CHARACTER_MEMORY_UPDATE',
        'PLOT_STATE_UPDATE',
        'NARRATIVE_CRAFT',
        'AGENT_EXPLANATION'
    ]);
    const craft = extractStructuredSection(content, 'NARRATIVE_CRAFT', [
        'PLOT_STATE_UPDATE'
    ]) || extractStructuredSection(content, 'AGENT_EXPLANATION', [
        'CHARACTER_MEMORY_UPDATE',
        'PLOT_STATE_UPDATE'
    ]);

    return {
        summary: summary || undefined,
        research: research || undefined,
        plan: plan || undefined,
        script: normalizeScreenplayWhitespace(finalScriptText) || extractBestEffortScreenplay(content),
        craft: craft || undefined
    };
}
