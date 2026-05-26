/**
 * Structured response parser for AI Assistant streams.
 * Ported from backend utility to provide real-time UI feedback.
 */

export const STRUCTURED_SECTION_LABELS = [
    'STORY_CONTEXT_SUMMARY',
    'SCENE_PLAN',
    'SCENE_SCRIPT',
    'CHARACTER_MEMORY_UPDATE',
    'PLOT_STATE_UPDATE',
    'NARRATIVE_CRAFT',
    'RESEARCH_DISCLOSURE',
    'CREATIVE_PLAN',
    'AGENT_EXPLANATION'
] as const;

export interface StructuredSections {
    summary?: string;
    plan?: string;
    script: string;
    craft?: string;
    research?: string;
}

function buildStructuredSectionHeadingPattern(labels: readonly string[]): RegExp {
    return new RegExp(
        `(?:^|\\n)\\s{0,3}#{0,6}\\s*(?:STEP\\s*\\d+\\s*:\\s*)?(?:${labels.join('|')})(?:\\s*\\(JSON\\))?\\s*:?\\s*(?:\\n|$)`,
        'i'
    );
}

function extractStructuredSection(content: string, label: string, nextLabels: readonly string[]): string {
    const normalized = content.replace(/\r\n?/g, '\n');
    
    // Strategy 1: XML Style
    const tagPattern = new RegExp(`<${label}>([\\s\\S]*?)(?:</${label}>|$)`, 'i');
    const tagMatch = tagPattern.exec(normalized);
    if (tagMatch && tagMatch[1].trim()) {
        return tagMatch[1].trim();
    }

    // Strategy 2: Heading Style
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

/**
 * Extracts sections from the full AI response.
 * Handles both streaming and complete text.
 */
export function extractStructuredAssistantSections(content: string): StructuredSections {
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
    const script = extractStructuredSection(content, 'SCENE_SCRIPT', [
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

    // Industry Standard Strict Parser: ONLY treat content as a screenplay script if it explicitly contains
    // screenplay section headers, surgical patch tags, or explicit screenplay markdown blocks.
    // This prevents conversational chat replies from being falsely triggered as diff proposals.
    let finalScript = script;
    if (!finalScript) {
        const cleanedContent = content.trim();
        const hasSurgicalMarkers = cleanedContent.includes('<<<SEARCH>>>') || cleanedContent.includes('<<<REPLACE>>>');
        const hasFountainCodeBlock = /```(fountain|script-edit|screenplay)\n?([\s\S]*?)```/i.test(cleanedContent);
        
        if (hasSurgicalMarkers) {
            finalScript = cleanedContent;
        } else if (hasFountainCodeBlock) {
            const match = cleanedContent.match(/```(fountain|script-edit|screenplay)\n?([\s\S]*?)```/i);
            if (match && match[2].trim()) {
                finalScript = match[2].trim();
            }
        }
    }

    // Clean up code block ticks if the script was wrapped in markdown (e.g. ```script-edit or ```fountain)
    if (finalScript) {
        finalScript = finalScript
            .replace(/^```[a-zA-Z0-9_-]*\n?/g, '') // Strip starting ticks
            .replace(/\n?```\s*$/g, '')            // Strip ending ticks
            .trim();
    }

    return {
        summary: summary || undefined,
        research: research || undefined,
        plan: plan || undefined,
        script: finalScript || '',
        craft: craft || undefined
    };
}

/**
 * Checks if a patch instruction (SEARCH/REPLACE) is present in the script content.
 */
export function parseSurgicalPatch(scriptContent: string): { search: string; replace: string } | null {
    const searchMatch = scriptContent.match(/<<<SEARCH>>>\n?([\s\S]*?)\n?<<<REPLACE>>>/i);
    const replaceMatch = scriptContent.match(/<<<REPLACE>>>\n?([\s\S]*?)\n?(?:<<<END_REPLACE>>>|$)/i);

    if (searchMatch && replaceMatch) {
        return {
            search: searchMatch[1].trim(),
            replace: replaceMatch[1].trim()
        };
    }
    return null;
}

/**
 * Normalizes text by aligning newlines, collapsing double spaces, and standardizing dashes.
 */
export function normalizeScriptText(text: string): string {
    return (text || '')
        .replace(/\r\n/g, '\n')
        .replace(/\r/g, '\n')
        .replace(/[\u2013\u2014–—]/g, '-') // Standardize all dash variants
        .replace(/[ \t]+/g, ' ')
        .trim();
}

/**
 * Strips HTML tags (e.g. <center>, <b>, <i>), markdown blockquotes,
 * and other AI-generated formatting artifacts from raw screenplay content.
 */
export function sanitizeScreenplayContent(content: string): string {
    if (!content) return content;
    return content
        // Strip HTML tags (e.g. <center>NAME</center> → NAME, <b>text</b> → text)
        .replace(/<\/?(?:center|b|i|em|strong|u|span|div|p|br\s*\/?)>/gi, '')
        // Strip markdown blockquote prefixes used for dialogue ("> text" → "text")
        .replace(/^>\s?/gm, '')
        // Strip markdown bold/italic wrapping around character names in cue lines
        .replace(/^\*{1,3}([A-Z][A-Z\s\-'().]+)\*{1,3}\s*$/gm, '$1')
        // Collapse any leftover multiple blank lines to max two
        .replace(/\n{4,}/g, '\n\n\n');
}


/**
 * Applies a surgical patch to original script content, robustly handling newline/CRLF mismatches,
 * dash type mismatches, and minor spacing variations.
 */
export function applySurgicalPatch(original: string, scriptContent: string): string {
    const searchMatch = scriptContent.match(/<<<SEARCH>>>\s*([\s\S]*?)\s*<<<REPLACE>>>/i);
    const replaceMatch = scriptContent.match(/<<<REPLACE>>>\s*([\s\S]*?)\s*(?:<<<END_REPLACE>>>|$)/i);

    if (!searchMatch || !replaceMatch) {
        // If there are no search/replace markers, return scriptContent as a full rewrite
        return scriptContent;
    }

    let searchContent = searchMatch[1].trim();
    let replaceContent = replaceMatch[1].trim();

    // Clean up code block ticks if they were captured inside the search/replace matching blocks
    searchContent = searchContent.replace(/^```[a-zA-Z0-9_-]*\n?/g, '').replace(/\n?```\s*$/g, '').trim();
    replaceContent = replaceContent.replace(/^```[a-zA-Z0-9_-]*\n?/g, '').replace(/\n?```\s*$/g, '').trim();

    // Handle empty search placeholders (e.g. prepending or full generation)
    const isPlaceholder = !searchContent || 
                         searchContent === '"""' || 
                         searchContent === '""' || 
                         searchContent.replace(/[\n\r\s]/g, '') === '""""""' ||
                         searchContent === 'EMPTY_SCRIPT' ||
                         searchContent === '...';

    if (isPlaceholder) {
        return original ? (replaceContent + '\n\n' + original) : replaceContent;
    }

    // Attempt 1: Exact Match (handling CRLF/LF newlines)
    const normalizedOriginal = original.replace(/\r\n/g, '\n');
    const normalizedSearch = searchContent.replace(/\r\n/g, '\n');
    const normalizedReplace = replaceContent.replace(/\r\n/g, '\n');

    if (normalizedOriginal.includes(normalizedSearch)) {
        const patched = normalizedOriginal.replace(normalizedSearch, normalizedReplace);
        // Restore CRLF standard if the original script used it
        return original.includes('\r\n') ? patched.replace(/\n/g, '\r\n') : patched;
    }

    // Attempt 2: Resilient Normalization (Ignore minor spacing and dash differences)
    const normOriginal = normalizeScriptText(original);
    const normSearch = normalizeScriptText(searchContent);

    if (normOriginal.includes(normSearch)) {
        // Match found in normalized space. Let's trace it back in the original lines.
        const searchLines = searchContent.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
        if (searchLines.length > 0) {
            const firstLine = searchLines[0];
            const lastLine = searchLines[searchLines.length - 1];

            // Normalize line comparisons for index finding
            const originalLines = original.split(/\r?\n/);
            let firstIdx = -1;
            let lastIdx = -1;

            for (let i = 0; i < originalLines.length; i++) {
                if (normalizeScriptText(originalLines[i]).includes(normalizeScriptText(firstLine))) {
                    firstIdx = i;
                    break;
                }
            }

            for (let i = originalLines.length - 1; i >= 0; i--) {
                if (normalizeScriptText(originalLines[i]).includes(normalizeScriptText(lastLine))) {
                    lastIdx = i;
                    break;
                }
            }

            if (firstIdx !== -1 && lastIdx !== -1 && lastIdx >= firstIdx) {
                // Construct the precise target block of lines from the original text
                const targetRange = originalLines.slice(firstIdx, lastIdx + 1).join(original.includes('\r\n') ? '\r\n' : '\n');
                if (normalizeScriptText(targetRange).includes(normSearch)) {
                    return original.replace(targetRange, replaceContent);
                }
            }
        }
    }

    // Fallback: If exact and normalized search both fail to locate the block,
    // log it and return the full replacement as the new script to prevent data loss.
    console.warn('[AssistantParser] Resilient patch failed to match search block. Falling back to proposed rewrite.');
    return replaceContent;
}

export interface AssistantProposal {
    script: string | null;
    explanation: string | null;
}

/**
 * Robustly parses the assistant's streaming or complete response.
 * Handles both the modern Gemini tool call format (`__TOOL_CALL__:propose_edit:`)
 * and legacy XML/markdown structured sections seamlessly.
 */
export function parseAssistantProposal(acc: string, originalContent: string): AssistantProposal {
    const toolCallMarker = '__TOOL_CALL__:propose_edit:';
    const toolCallIdx = acc.indexOf(toolCallMarker);
    
    if (toolCallIdx !== -1) {
        try {
            const slice = acc.slice(toolCallIdx + toolCallMarker.length);
            let parsedArgs: any = null;
            
            // Try extracting using the brace matcher (resilient to trailing/streaming characters)
            const firstBrace = slice.indexOf('{');
            if (firstBrace !== -1) {
                let depth = 0;
                let insideString = false;
                let escaped = false;
                for (let i = firstBrace; i < slice.length; i++) {
                    const char = slice[i];
                    if (char === '\\') {
                        escaped = !escaped;
                    } else if (char === '"') {
                        if (!escaped) insideString = !insideString;
                        escaped = false;
                    } else {
                        escaped = false;
                        if (!insideString) {
                            if (char === '{') {
                                depth++;
                            } else if (char === '}') {
                                depth--;
                                if (depth === 0) {
                                    try {
                                        parsedArgs = JSON.parse(slice.slice(firstBrace, i + 1));
                                    } catch {
                                        parsedArgs = null;
                                    }
                                    break;
                                }
                            }
                        }
                    }
                }
            }
            
            // Fallback: direct JSON parse of trimmed slice
            if (!parsedArgs) {
                try {
                    parsedArgs = JSON.parse(slice.trim());
                } catch {
                    // Try regex matching to extract partial JSON while streaming
                    const scriptRegex = /"revised_script"\s*:\s*"((?:[^"\\]|\\.)*)/;
                    const explanationRegex = /"explanation"\s*:\s*"((?:[^"\\]|\\.)*)/;
                    
                    const scriptMatch = slice.match(scriptRegex);
                    const explanationMatch = slice.match(explanationRegex);
                    
                    let partialScript = '';
                    let partialExplanation = '';
                    
                    if (scriptMatch) {
                        partialScript = scriptMatch[1]
                            .replace(/\\"/g, '"')
                            .replace(/\\n/g, '\n')
                            .replace(/\\t/g, '\t');
                    }
                    if (explanationMatch) {
                        partialExplanation = explanationMatch[1]
                            .replace(/\\"/g, '"')
                            .replace(/\\n/g, '\n')
                            .replace(/\\t/g, '\t');
                    }
                    
                    if (partialScript || partialExplanation) {
                        parsedArgs = {
                            revised_script: partialScript,
                            explanation: partialExplanation
                        };
                    }
                }
            }
            
            if (parsedArgs) {
                const revisedScript = parsedArgs.revised_script || '';
                const explanation = parsedArgs.explanation || '';
                
                let finalScript = null;
                if (revisedScript.trim()) {
                    finalScript = sanitizeScreenplayContent(applySurgicalPatch(originalContent, revisedScript));
                }
                
                return {
                    script: finalScript,
                    explanation: explanation || null
                };
            }
        } catch (e) {
            console.error('[AssistantParser] Error parsing propose_edit tool call:', e);
        }
    }
    
    // Legacy fallback: structured XML or markdown sections
    const sections = extractStructuredAssistantSections(acc);
    if (sections.script) {
        return {
            script: sanitizeScreenplayContent(applySurgicalPatch(originalContent, sections.script)),
            explanation: sections.craft || sections.research || sections.summary || null
        };
    }
    
    return {
        script: null,
        explanation: null
    };
}

/**
 * Cleans assistant streaming content to prevent raw payload/tags leaking to the user.
 */
export function cleanAssistantStreamingContent(acc: string, originalContent: string): string {
    // 1. Remove XML-style thinking blocks completely or provide a nice status
    let clean = acc.replace(/<THINKING>[\s\S]*?(?:<\/THINKING>|$)/gi, '');
    
    // 2. If it is a tool call (propose_edit), extract the explanation/notes if available, or hide the raw tool call payload
    if (acc.includes('__TOOL_CALL__:propose_edit:')) {
        const proposal = parseAssistantProposal(acc, originalContent);
        // If we have an explanation, show it. Otherwise show a clean progress/loading message.
        let exp = proposal.explanation || 'Crafting the screenplay rewrite...';
        // Clean screenplay formatting leaks
        exp = exp
            .replace(/<\/?center>/gi, '')
            .replace(/<center\s*>/gi, '')
            .replace(/^>\s?/gm, '');
        return exp;
    }
    
    // 3. Remove raw tool call wrappers or trailing markers
    clean = clean.replace(/__TOOL_CALL__[\s\S]*$/g, '').trim();
    
    // 4. Return clean text, or a default placeholder if we are in the thinking stage
    if (!clean && acc.includes('<THINKING>')) {
        return 'Analyzing instructions and outline...';
    }
    
    // Clean screenplay formatting leaks (e.g. <center>, </center>, and leading > on lines)
    clean = clean
        .replace(/<\/?center>/gi, '')
        .replace(/<center\s*>/gi, '')
        .replace(/^>\s?/gm, '');
    
    return clean;
}

