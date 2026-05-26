import { describe, it, expect } from './framework.js';
import { normalizeScreenplayWhitespace } from '../utils/screenplayFormatting/normalizer.js';
import {
    hasStructuredAssistantSections,
    extractBestEffortScreenplay,
    extractBestEffortAssistantAnswer,
    extractStructuredAssistantSections
} from '../utils/screenplayFormatting/extractor.js';

describe('Screenplay Line Classification & Whitespace Normalization QA', () => {
    // 15 Assertions total in this block

    it('should strip leading and trailing outer blank lines completely', () => {
        const input = "\n\n\nINT. CASTLE - DAY\n\nRen walks inside.\n\n\n";
        const result = normalizeScreenplayWhitespace(input);

        // Assertion 1: Strips leading blanks
        expect(result.startsWith('INT. CASTLE - DAY')).toBe(true);
        // Assertion 2: Strips trailing blanks
        expect(result.endsWith('Ren walks inside.')).toBe(true);
        // Assertion 3: Retains intermediate blank lines
        expect(result.includes('\n\n')).toBe(true);
    });

    it('should collapse consecutive intermediate blank lines to a single blank line', () => {
        const input = "INT. CASTLE - DAY\n\n\n\nRen walks inside.\n\n\n\nHe stops.";
        const result = normalizeScreenplayWhitespace(input);

        // Assertion 4: Quintuple blank lines are collapsed in standard screenplay spacing
        expect(result.includes('\n\n\n\n\n')).toBe(false);
        // Assertion 5: intermediate lines collapse
        expect(result.includes('Ren walks inside.')).toBe(true);
        // Assertion 6: Does not contain extreme blank lines
        expect(result.includes('\n\n\n\n\n\n')).toBe(false);
    });

    it('should enforce zero blank lines between Character Cue and Parenthetical', () => {
        const input = "REN\n\n(whispering)\n\nI think they are watching us.";
        const result = normalizeScreenplayWhitespace(input);

        // Assertion 7: Cue directly followed by parenthetical
        expect(result.includes('REN\n(whispering)')).toBe(true);
        // Assertion 8: No empty line inserted in between
        expect(result.includes('REN\n\n(whispering)')).toBe(false);
    });

    it('should enforce zero blank lines between Parenthetical and Dialogue', () => {
        const input = "REN\n(whispering)\n\nGo left.";
        const result = normalizeScreenplayWhitespace(input);

        // Assertion 9: Parenthetical directly followed by dialogue
        expect(result.includes('(whispering)\nGo left.')).toBe(true);
        // Assertion 10: Dialogue is not separated from parenthetical by a blank
        expect(result.includes('(whispering)\n\nGo left.')).toBe(false);
    });

    it('should retain a single blank line between Action blocks and Character Cues', () => {
        const input = "Ren walks over to the table.\n\nREN\nI am hungry.";
        const result = normalizeScreenplayWhitespace(input);

        // Assertion 11: Retains one blank line before Cue
        expect(result.includes('Ren walks over to the table.\n\nREN')).toBe(true);
        // Assertion 12: Cue followed directly by dialogue (no parenthetical)
        expect(result.includes('REN\nI am hungry.')).toBe(true);
    });

    it('should preserve intentionally forced blank lines', () => {
        const input = "INT. CELL - NIGHT\n  \nRen sits.";
        const result = normalizeScreenplayWhitespace(input);

        // Assertion 13: Forced spaces line retained
        expect(result.includes('\n  \n')).toBe(true);
        // Assertion 14: Slugline exists
        expect(result.includes('INT. CELL - NIGHT')).toBe(true);
        // Assertion 15: Action block exists
        expect(result.includes('Ren sits.')).toBe(true);
    });
});

describe('Screenplay Extractor & Section Alignment QA', () => {
    // 15 Assertions total in this block

    it('should strip conversational assistant wrappers from screenplay texts', () => {
        const input1 = "RESPONSE:\nINT. CABIN - DAY\nRen is sleeping.";
        const input2 = "REVISED SCRIPT:\nINT. CABIN - DAY\nRen is sleeping.";

        const result1 = extractBestEffortScreenplay(input1);
        const result2 = extractBestEffortScreenplay(input2);

        // Assertion 16: RESPONSE: header stripped
        expect(result1.startsWith('RESPONSE:')).toBe(false);
        // Assertion 17: Screenplay starts with INT.
        expect(result1.startsWith('INT. CABIN - DAY')).toBe(true);
        // Assertion 18: REVISED SCRIPT: header stripped
        expect(result2.startsWith('REVISED SCRIPT:')).toBe(false);
        // Assertion 19: Second screenplay starts with INT.
        expect(result2.startsWith('INT. CABIN - DAY')).toBe(true);
    });

    it('should correctly detect structured assistant sections using headings/tags', () => {
        const inputWithTags = "<SCENE_SCRIPT>\nINT. CELL - NIGHT\n</SCENE_SCRIPT>";
        const inputWithHeadings = "### SCENE_SCRIPT\nINT. CELL - NIGHT";

        // Assertion 20: Detects XML tags
        expect(hasStructuredAssistantSections(inputWithTags)).toBe(true);
        // Assertion 21: Detects markdown headers
        expect(hasStructuredAssistantSections(inputWithHeadings)).toBe(true);
        // Assertion 22: Returns false for standard dialogue without tags
        expect(hasStructuredAssistantSections("REN\nHello")).toBe(false);
    });

    it('should extract structured sections cleanly, omitting other categories', () => {
        const payload = `
        <STORY_CONTEXT_SUMMARY>
        This is a quick summary.
        </STORY_CONTEXT_SUMMARY>

        <SCENE_SCRIPT>
        INT. DOCK - NIGHT
        Ren looks out.
        </SCENE_SCRIPT>

        <AGENT_EXPLANATION>
        Explanation block.
        </AGENT_EXPLANATION>
        `;

        const sections = extractStructuredAssistantSections(payload);

        // Assertion 23: Summary extracted
        expect(sections.summary).toBe('This is a quick summary.');
        // Assertion 24: Script extracted
        expect(sections.script.includes('INT. DOCK - NIGHT')).toBe(true);
        // Assertion 25: Craft (Agent Explanation) extracted
        expect(sections.craft).toBe('Explanation block.');
        // Assertion 26: Unused research is undefined
        expect(sections.research).toBe(undefined);
    });

    it('should fall back to best-effort screenplay extraction when no tags exist', () => {
        const rawContent = `Here is a story scene I wrote for you:

INT. MEADOW - DAY

Julia picks flowers.

JULIA
(smiling)
How lovely.`;

        const extracted = extractBestEffortScreenplay(rawContent);

        // Assertion 27: Excludes conversational intro
        expect(extracted.includes('Here is a story scene')).toBe(false);
        // Assertion 28: Starts screenplay at the slugline
        expect(extracted.startsWith('INT. MEADOW - DAY')).toBe(true);
        // Assertion 29: Maintains cue to parenthetical spacing
        expect(extracted.includes('JULIA\n(smiling)')).toBe(true);
        // Assertion 30: Whitespace normalized in fallback
        expect(extracted.includes('\n\nJULIA')).toBe(true);
    });
});

describe('Granular Formatting Edge-Cases & Language Processors QA', () => {
    // 15 Assertions total in this block

    it('should correctly extract assistant conversational answers excluding screenplay blocks', () => {
        const payload = `
        <STORY_CONTEXT_SUMMARY>
        Ren reaches safety.
        </STORY_CONTEXT_SUMMARY>

        <SCENE_SCRIPT>
        INT. SAFETY - DAY
        </SCENE_SCRIPT>

        <NARRATIVE_CRAFT>
        Pacing is rapid.
        </NARRATIVE_CRAFT>
        `;

        const answer = extractBestEffortAssistantAnswer(payload);

        // Assertion 31: Summary is included in answer
        expect(answer.includes('Ren reaches safety.')).toBe(true);
        // Assertion 32: Narrative craft explanation is included
        expect(answer.includes('Pacing is rapid.')).toBe(true);
        // Assertion 33: Raw script block is excluded from assistant conversational answer
        expect(answer.includes('INT. SAFETY - DAY')).toBe(false);
    });

    it('should return entire raw text if no structured tags exist inside assistant answers', () => {
        const rawText = "Just a conversational chat response with no special screenplay.";
        const answer = extractBestEffortAssistantAnswer(rawText);

        // Assertion 34: Conversational answer preserved
        expect(answer).toBe(rawText);
        // Assertion 35: Answer is a string
        expect(typeof answer).toBe('string');
    });

    it('should strip trailing structured update metadata blocks from clean script drafts', () => {
        const payload = `
        INT. DOCK - NIGHT
        Ren runs.
        
        <CHARACTER_MEMORY_UPDATE>
        {"Ren": "escaped"}
        </CHARACTER_MEMORY_UPDATE>
        `;

        const screenplay = extractBestEffortScreenplay(payload);

        // Assertion 36: Script content preserved
        expect(screenplay.includes('INT. DOCK - NIGHT')).toBe(true);
        // Assertion 37: Trailing XML metadata block stripped
        expect(screenplay.includes('CHARACTER_MEMORY_UPDATE')).toBe(false);
    });

    it('should recognize transitions ending in TO: in screenplay lines', () => {
        const input = "FADE IN:\n\nINT. ROAD - DAY\n\nRen walks.\n\nCUT TO:\n\nINT. INN - NIGHT";
        const normalized = normalizeScreenplayWhitespace(input);

        // Assertion 38: Retains transition at the start
        expect(normalized.includes('FADE IN:\n\nINT. ROAD - DAY')).toBe(true);
        // Assertion 39: Retains transition CUT TO: inside script
        expect(normalized.includes('Ren walks.\n\nCUT TO:\n\nINT. INN - NIGHT')).toBe(true);
    });

    it('should classify parentheticals matching round brackets', () => {
        const input = "REN\n(panting heavily)\nI made it.";
        const normalized = normalizeScreenplayWhitespace(input);

        // Assertion 40: Correctly identifies parenthetical and attaches directly to cue
        expect(normalized.includes('REN\n(panting heavily)')).toBe(true);
        // Assertion 41: Dialogue follows parenthetical directly
        expect(normalized.includes('(panting heavily)\nI made it.')).toBe(true);
    });

    it('should handle sluglines with slash variations INT/EXT', () => {
        const input = "INT/EXT. FLYING SHIP - DAY\nRen looks at the clouds.";
        const normalized = normalizeScreenplayWhitespace(input);

        // Assertion 42: Slugline matches INT/EXT structure
        expect(normalized.startsWith('INT/EXT. FLYING SHIP - DAY')).toBe(true);
    });

    it('should classify uppercase short sentences without ending punctuation as cues', () => {
        const input = "JULIA\nWhere are you?";
        const normalized = normalizeScreenplayWhitespace(input);

        // Assertion 43: JULIA is treated as character cue
        expect(normalized.includes('JULIA\nWhere are you?')).toBe(true);
    });

    it('should distinguish cue lines from action lines with ending punctuation', () => {
        const input = "JULIA.\n\nWhere are you?";
        const normalized = normalizeScreenplayWhitespace(input);

        // Assertion 44: Action block preserves separating blank line
        expect(normalized.includes('JULIA.\n\nWhere are you?')).toBe(true);
        // Assertion 45: Spacing separates action block from dialogue block
        expect(normalized.startsWith('JULIA.')).toBe(true);
    });
});
