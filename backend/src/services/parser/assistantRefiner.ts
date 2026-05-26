import { aiServiceManager } from '../aiManager/index.js';
import { JSONHelper } from './jsonHelper.js';
import { ParsedAssistantSchema, ParsedAssistantResponse } from './types.js';
import { applySurgicalPatch } from './patchApplier.js';
import { cleanAssistantChatResponse } from '../../utils/screenplayFormatting/index.js';

const STRUCTURED_SECTION_LABELS = [
    'STORY_CONTEXT_SUMMARY',
    'SCENE_PLAN',
    'SCENE_SCRIPT',
    'CHARACTER_MEMORY_UPDATE',
    'PLOT_STATE_UPDATE',
    'NARRATIVE_CRAFT',
    'RESEARCH_DISCLOSURE',
    'CREATIVE_PLAN',
    'AGENT_EXPLANATION'
];

function extractSectionLocal(text: string, label: string): string {
    const normalized = text.replace(/\r\n?/g, '\n');

    const tagPattern = new RegExp(`(?:^|\\n)\\s*<${label}>\\s*\\n?([\\s\\S]*?)(?:</${label}>|$)`, 'i');
    const tagMatch = tagPattern.exec(normalized);
    if (tagMatch && tagMatch[1].trim()) return tagMatch[1].trim();

    const headingPattern = new RegExp(
        `(?:^|\\n)\\s{0,3}#{0,6}\\s*(?:\\*\\*\\s*)?(?:STEP\\s*\\d+\\s*:\\s*)?(?:\\*\\*\\s*)?<?${label}>?(?:\\s*\\(JSON\\))?\\s*\\*?\\*?\\s*:?\\s*(?:\\*\\*\\s*)?\\n([\\s\\S]*?)(?=\\n\\s{0,3}#{0,6}\\s*(?:\\*\\*\\s*)?(?:STEP\\s*\\d+|<?(?:${STRUCTURED_SECTION_LABELS.join('|')})>?\\*?\\*?)|\\n\\s*---|\\n\\s*<|$)`,
        'i'
    );
    const headingMatch = headingPattern.exec(normalized);
    if (headingMatch && headingMatch[1].trim()) return headingMatch[1].trim();

    return '';
}

export async function refineAssistantResponse(
    rawResponse: string,
    originalContent: string = ''
): Promise<ParsedAssistantResponse> {
    const parserPrompt = `Extract structured content from the following assistant response.
        
        RAW_RESPONSE:
        """
        ${rawResponse}
        """

        TASK:
        Extract: research, plan, script, explanation, summary, characterMemory (updates array), plotState.
        The "script" field must be a flat string containing the edited screenplay content.
        
        IMPORTANT: Return strict JSON.`;

    try {
        console.info('[ParserService] Phase 1: Structured Extraction...');
        let result = await aiServiceManager.chat(parserPrompt, {
            provider: aiServiceManager.getProvider(),
            model: 'instant',
            temperature: 0.1,
            format: 'json'
        });

        let rawParsed: any;
        try {
            rawParsed = JSON.parse(JSONHelper.extractJson(result));
        } catch (parseErr: any) {
            console.warn('[ParserService] Phase 2: Self-Correction Loop triggered...');
            const corrected = await JSONHelper.validateAndCorrect(result, parseErr.message);
            if (corrected) {
                rawParsed = JSON.parse(JSONHelper.extractJson(corrected));
            } else {
                throw parseErr;
            }
        }

        const validated = ParsedAssistantSchema.parse(rawParsed);

        let script = JSONHelper.flattenToString(validated.script);
        script = applySurgicalPatch(originalContent, script);

        return {
            ...validated,
            script,
            research: JSONHelper.flattenToString(validated.research),
            plan: JSONHelper.flattenToString(validated.plan),
            explanation: JSONHelper.flattenToString(validated.explanation),
            summary: JSONHelper.flattenToString(validated.summary)
        };
    } catch (error: any) {
        console.error('[ParserService] Advanced Refinement Failed, executing local extraction backup:', error.message);

        let localMemory = null;
        let localPlot = null;
        let localExplanation = '';

        try {
            const memRaw = extractSectionLocal(rawResponse, 'CHARACTER_MEMORY_UPDATE');
            if (memRaw) {
                const cleanJson = JSONHelper.extractJson(memRaw);
                localMemory = JSONHelper.dirtyRepair(cleanJson);
            }
        } catch (err: any) {
            console.warn('[ParserService] Local characterMemory parse failed:', err.message);
        }

        try {
            const plotRaw = extractSectionLocal(rawResponse, 'PLOT_STATE_UPDATE');
            if (plotRaw) {
                const cleanJson = JSONHelper.extractJson(plotRaw);
                localPlot = JSONHelper.dirtyRepair(cleanJson);
            }
        } catch (err: any) {
            console.warn('[ParserService] Local plotState parse failed:', err.message);
        }

        try {
            localExplanation = extractSectionLocal(rawResponse, 'AGENT_EXPLANATION') ||
                               extractSectionLocal(rawResponse, 'NARRATIVE_CRAFT');
        } catch (err) {}

        const fallbackScript = applySurgicalPatch(
            originalContent,
            cleanAssistantChatResponse(rawResponse)
        );

        return {
            script: fallbackScript,
            research: null,
            plan: null,
            explanation: localExplanation || null,
            summary: null,
            characterMemory: localMemory,
            plotState: localPlot
        };
    }
}
