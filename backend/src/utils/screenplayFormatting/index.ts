export { normalizeScreenplayWhitespace } from './normalizer.js';

export function cleanAssistantChatResponse(content: string): string {
    return content
        .replace(/\r\n?/g, '\n')
        .replace(/^RESPONSE:\s*/i, '')
        .trim();
}

/**
 * Strips HTML tags (e.g. <center>, <b>, <i>), markdown blockquotes,
 * and other AI-generated formatting artifacts from raw screenplay content.
 * This is the single chokepoint sanitizer — call it on any AI-produced
 * screenplay text before saving to the database or streaming to the client.
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

export {
    extractBestEffortScreenplay,
    extractBestEffortAssistantAnswer,
    extractStructuredAssistantSections,
    hasStructuredAssistantSections,
} from './extractor.js';
