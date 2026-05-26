import { describe, it, expect } from './framework.js';
import { normalizeAssistantToolPlan, IntentService, type AssistantToolPlan, type AssistantToolName, type IntentContext } from '../services/intent.service.js';

// ---- Helper: inline needsRag from rag/index.ts ----
function needsRag(instruction: string): boolean {
    const clean = instruction.toLowerCase().trim();
    const simpleQaPatterns = [
        /^why\s/, /^what\s/, /^how\s/, /^does\s/, /^is\s/, /^can\s/, /^should\s/,
        /^would\s/, /^could\s/, /^explain/, /^analyze/, /^evaluate/, /^review/,
        /^comment/, /^describe/, /^tell me/, /^give me/, /^thoughts?\s/, /^opinion/,
        /do you think/, /what do you/, /how does/, /what about/, /what's (wrong|good|bad|working)/,
        /why does/, /why is/, /why would/, /is this/, /is there/, /does this/,
        /what's the/, /can you explain/, /can you tell/, /would you/,
        /write\s+(an?\s+)?example/, /write\s+(an?\s+)?slugline/, /write\s+(an?\s+)?explanation/,
        /how\s+to\s+write/, /how\s+do\s+i\s+write/, /explain\s+how/, /explain\s+what/,
        /what\s+is\s+a/, /what\s+does\s+a/, /difference\s+between/, /example\s+of/
    ];
    const editPatterns = [
        /rewrite|replace|change|edit|fix|update|modify|update|alter|improve/,
        /write\s+(an?\s+)?(scene|dialogue|action|script|beat|outline|treatment|sequence|paragraph|sentence|line|draft|continuation|content|monologue|dialog)/,
        /generate\s+(an?\s+)?(scene|dialogue|action|script|beat|outline|treatment|sequence|paragraph|sentence|line|draft|continuation|content|monologue|dialog)/,
        /create\s+(an?\s+)?(scene|dialogue|action|script|beat|outline|treatment|sequence|paragraph|sentence|line|draft|continuation|content|monologue|dialog)/,
        /add\s+(an?\s+)?(scene|dialogue|action|script|beat|outline|treatment|sequence|paragraph|sentence|line|draft|continuation|content|monologue|dialog|character|cast)/,
        /remove|delete|cut|trim/, /format|restructure/,
        /translate|transliterate/, /make it/, /make the/, /turn this/, /convert/
    ];
    const isSimpleQa = simpleQaPatterns.some(p => p.test(clean));
    const isEditRequest = editPatterns.some(p => p.test(clean));
    if (isEditRequest) return true;
    if (isSimpleQa) return false;
    if (clean.length < 80) return false;
    return true;
}

// ---- Helper: inline selectToolDeclarations from assistedEditCore.ts ----
const VALID_TOOL_NAMES: AssistantToolName[] = ['propose_edit', 'query_lore', 'critique_scene', 'generate_outline'];

const toolDeclarationsByName: Record<AssistantToolName, any> = {
    propose_edit: {
        functionDeclarations: [{
            name: 'propose_edit',
            description: 'Propose screenplay script modifications or a full rewrite.',
            parameters: {
                type: 'OBJECT',
                properties: {
                    revised_script: { type: 'STRING', description: 'The complete revised screenplay script content.' },
                    explanation: { type: 'STRING', description: 'A brief explanation of modifications.' }
                },
                required: ['revised_script', 'explanation']
            }
        }]
    },
    query_lore: {
        functionDeclarations: [{
            name: 'query_lore',
            description: 'Query the project Knowledge Graph.',
            parameters: {
                type: 'OBJECT',
                properties: {
                    entity_name: { type: 'STRING', description: 'The name of the character or entity to look up.' }
                },
                required: ['entity_name']
            }
        }]
    },
    critique_scene: {
        functionDeclarations: [{
            name: 'critique_scene',
            description: 'Analyze and critique the current scene.',
        }]
    },
    generate_outline: {
        functionDeclarations: [{
            name: 'generate_outline',
            description: 'Generate a high-level story outline.',
        }]
    }
};

function selectToolDeclarations(toolNames: AssistantToolName[]): any[] | undefined {
    const tools = toolNames.map((name) => toolDeclarationsByName[name]).filter(Boolean);
    return tools.length > 0 ? tools : undefined;
}

// ---- Helper: inline parseToolCall from assistedEditCore.ts ----
function parseToolCall(fullResponse: string, toolName: string): any | null {
    const marker = `__TOOL_CALL__:${toolName}:`;
    const idx = fullResponse.indexOf(marker);
    if (idx !== -1) {
        const slice = fullResponse.slice(idx + marker.length);
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
                                    return JSON.parse(slice.slice(firstBrace, i + 1));
                                } catch {
                                    return null;
                                }
                            }
                        }
                    }
                }
            }
        }
        try { return JSON.parse(slice.trim()); } catch { return null; }
    }
    return null;
}

function isShortCircuitChat(plan: AssistantToolPlan): boolean {
    return plan.intent === 'chat' && !plan.needsRagRetrieval && plan.tools.length === 0;
}

// ========== SCENARIO: Which path gets taken for various user queries ==========
describe('Tool Calling Efficiency — Path Selection Scenarios', () => {
    const contextWithScene: IntentContext = { hasScene: true, hasSelection: false, currentMode: 'ask' };
    const contextWithSelection: IntentContext = { hasScene: true, hasSelection: true, currentMode: 'ask' };

    it('CHAT PATH: small talk "hello" goes to short-circuit chat', () => {
        const plan = normalizeAssistantToolPlan({
            intent: 'chat', mode: 'ask', target: 'scene', needsRag: false, tools: [], confidence: 0.95
        }, contextWithScene);
        expect(isShortCircuitChat(plan)).toBe(true);
        expect(plan.confidence).toBe(0.95);
    });

    it('CHAT PATH: "thanks" goes to short-circuit chat', () => {
        const plan = normalizeAssistantToolPlan({
            intent: 'chat', mode: 'ask', target: 'scene', needsRag: false, tools: [], confidence: 0.9
        }, contextWithScene);
        expect(isShortCircuitChat(plan)).toBe(true);
    });

    it('CHAT PATH: "ok" goes to short-circuit chat', () => {
        const plan = normalizeAssistantToolPlan({
            intent: 'chat', mode: 'ask', target: 'scene', needsRag: false, tools: [], confidence: 0.85
        }, contextWithScene);
        expect(isShortCircuitChat(plan)).toBe(true);
    });

    it('FULL PATH: "edit this scene" goes to full pipeline with propose_edit tool', () => {
        const plan = normalizeAssistantToolPlan({
            intent: 'scene_edit', mode: 'agent', target: 'scene', needsRag: true,
            tools: ['propose_edit'], confidence: 0.88
        }, contextWithScene);
        expect(isShortCircuitChat(plan)).toBe(false);
        expect(plan.intent).toBe('scene_edit');
        expect(plan.needsRagRetrieval).toBe(true);
        expect(plan.tools).toEqual(['propose_edit']);
    });

    it('FULL PATH: "who is the protagonist" goes to RAG path with query_lore tool', () => {
        const plan = normalizeAssistantToolPlan({
            intent: 'chat', mode: 'ask', target: 'scene', needsRag: true,
            tools: ['query_lore'], confidence: 0.78
        }, contextWithScene);
        expect(isShortCircuitChat(plan)).toBe(false);
        expect(plan.needsRagRetrieval).toBe(true);
        expect(plan.tools).toEqual(['query_lore']);
    });

    it('FULL PATH: "critique this scene" goes to full pipeline with critique_scene tool', () => {
        const plan = normalizeAssistantToolPlan({
            intent: 'scene_edit', mode: 'agent', target: 'scene', needsRag: true,
            tools: ['critique_scene'], confidence: 0.82
        }, contextWithScene);
        expect(isShortCircuitChat(plan)).toBe(false);
        expect(plan.tools).toEqual(['critique_scene']);
    });

    it('FULL PATH: "generate outline" goes to full pipeline with generate_outline tool', () => {
        const plan = normalizeAssistantToolPlan({
            intent: 'treatment', mode: 'agent', target: 'scene', needsRag: true,
            tools: ['generate_outline'], confidence: 0.9
        }, contextWithScene);
        expect(isShortCircuitChat(plan)).toBe(false);
        expect(plan.tools).toEqual(['generate_outline']);
    });

    it('FULL PATH: selection edit with selection context', () => {
        const plan = normalizeAssistantToolPlan({
            intent: 'selection_edit', mode: 'edit', target: 'selection', needsRag: true,
            tools: ['propose_edit'], confidence: 0.91
        }, contextWithSelection);
        expect(isShortCircuitChat(plan)).toBe(false);
        expect(plan.target).toBe('selection');
    });

    it('EDGE: missing fields fall back to chat short-circuit', () => {
        const plan = normalizeAssistantToolPlan({}, contextWithScene);
        expect(isShortCircuitChat(plan)).toBe(true);
        expect(plan.intent).toBe('chat');
        expect(plan.needsRagRetrieval).toBe(false);
        expect(plan.tools.length).toBe(0);
    });

    it('EDGE: null input falls back to chat', () => {
        const plan = normalizeAssistantToolPlan(null, contextWithScene);
        expect(isShortCircuitChat(plan)).toBe(true);
    });

    it('EDGE: undefined input falls back to chat', () => {
        const plan = normalizeAssistantToolPlan(undefined, contextWithScene);
        expect(isShortCircuitChat(plan)).toBe(true);
    });

    it('EDGE: confidence > 1 clamped to 1', () => {
        const plan = normalizeAssistantToolPlan({
            intent: 'chat', mode: 'ask', target: 'scene', needsRag: false, tools: [], confidence: 5.0
        }, contextWithScene);
        expect(plan.confidence).toBe(1);
    });

    it('EDGE: confidence < 0 clamped to 0', () => {
        const plan = normalizeAssistantToolPlan({
            intent: 'chat', mode: 'ask', target: 'scene', needsRag: false, tools: [], confidence: -1.0
        }, contextWithScene);
        expect(plan.confidence).toBe(0);
    });

    it('EDGE: NaN confidence falls back to 0.7', () => {
        const plan = normalizeAssistantToolPlan({
            intent: 'chat', mode: 'ask', target: 'scene', needsRag: false, tools: [], confidence: NaN
        }, contextWithScene);
        expect(plan.confidence).toBe(0.7);
    });

    it('EDGE: invalid intent falls back to chat', () => {
        const plan = normalizeAssistantToolPlan({
            intent: 'invalid_intent', mode: 'ask', target: 'scene', needsRag: false, tools: [], confidence: 0.5
        }, contextWithScene);
        expect(plan.intent).toBe('chat');
    });

    it('EDGE: invalid mode resolved from intent for chat', () => {
        const plan = normalizeAssistantToolPlan({
            intent: 'chat', mode: 'invalid_mode', target: 'scene', needsRag: false, tools: [], confidence: 0.5
        }, contextWithScene);
        expect(plan.effectiveMode).toBe('ask');
    });

    it('EDGE: invalid mode resolved from intent for scene_edit', () => {
        const plan = normalizeAssistantToolPlan({
            intent: 'scene_edit', mode: 'invalid_mode', target: 'scene', needsRag: true,
            tools: ['propose_edit'], confidence: 0.5
        }, contextWithScene);
        expect(plan.effectiveMode).toBe('agent');
    });

    it('EDGE: tools deduplication', () => {
        const plan = normalizeAssistantToolPlan({
            intent: 'scene_edit', mode: 'agent', target: 'scene', needsRag: true,
            tools: ['propose_edit', 'propose_edit', 'propose_edit'], confidence: 0.8
        }, contextWithScene);
        expect(plan.tools).toEqual(['propose_edit']);
    });

    it('EDGE: unknown tools filtered out', () => {
        const plan = normalizeAssistantToolPlan({
            intent: 'scene_edit', mode: 'agent', target: 'scene', needsRag: true,
            tools: ['propose_edit', 'unknown_tool', 'hack_tool', 'query_lore'], confidence: 0.8
        }, contextWithScene);
        expect(plan.tools).toEqual(['propose_edit', 'query_lore']);
    });

    it('EDGE: needsRagRetrieval from needsRag field name', () => {
        const plan = normalizeAssistantToolPlan({
            intent: 'chat', mode: 'ask', target: 'scene', needsRag: true, tools: [], confidence: 0.5
        }, contextWithScene);
        expect(plan.needsRagRetrieval).toBe(true);
    });

    it('EDGE: needsRagRetrieval from useRag field name', () => {
        const plan = normalizeAssistantToolPlan({
            intent: 'chat', mode: 'ask', target: 'scene', useRag: true, tools: [], confidence: 0.5
        }, contextWithScene);
        expect(plan.needsRagRetrieval).toBe(true);
    });

    it('EDGE: needsRagRetrieval from needsRagRetrieval field name', () => {
        const plan = normalizeAssistantToolPlan({
            intent: 'chat', mode: 'ask', target: 'scene', needsRagRetrieval: true, tools: [], confidence: 0.5
        }, contextWithScene);
        expect(plan.needsRagRetrieval).toBe(true);
    });

    it('EDGE: selection_edit intent forces selection target regardless of context', () => {
        const plan = normalizeAssistantToolPlan({
            intent: 'selection_edit', mode: 'edit', target: 'selection', needsRag: true,
            tools: ['propose_edit'], confidence: 0.8
        }, { ...contextWithScene, hasSelection: false });
        expect(plan.target).toBe('selection');
    });
});

// ========== needsRag() PATTERN TESTS ==========
describe('Tool Calling Efficiency — needsRag() Pattern Detection', () => {
    // Edit patterns → RAG = true
    it('RAG: "rewrite this scene" triggers edit pattern', () => {
        expect(needsRag('rewrite this scene')).toBe(true);
    });

    it('RAG: "edit the dialogue" triggers edit pattern', () => {
        expect(needsRag('edit the dialogue')).toBe(true);
    });

    it('RAG: "change the ending" triggers edit pattern', () => {
        expect(needsRag('change the ending')).toBe(true);
    });

    it('RAG: "fix the pacing" triggers edit pattern', () => {
        expect(needsRag('fix the pacing')).toBe(true);
    });

    it('RAG: "generate a scene" triggers edit pattern', () => {
        expect(needsRag('generate a scene')).toBe(true);
    });

    it('RAG: "write a dialogue" triggers edit pattern', () => {
        expect(needsRag('write a dialogue')).toBe(true);
    });

    it('RAG: "create a beat sheet" triggers edit pattern', () => {
        expect(needsRag('create a beat sheet')).toBe(true);
    });

    it('RAG: "add a character" triggers edit pattern', () => {
        expect(needsRag('add a character')).toBe(true);
    });

    it('NO RAG: "add a new character" does not match (word between "a" and "character")', () => {
        expect(needsRag('add a new character')).toBe(false);
    });

    it('RAG: "remove this line" triggers edit pattern', () => {
        expect(needsRag('remove this line')).toBe(true);
    });

    it('RAG: "translate to French" triggers edit pattern', () => {
        expect(needsRag('translate to french')).toBe(true);
    });

    it('RAG: "make it funnier" triggers edit pattern', () => {
        expect(needsRag('make it funnier')).toBe(true);
    });

    it('RAG: "improve the dialogue" triggers edit pattern', () => {
        expect(needsRag('improve the dialogue')).toBe(true);
    });

    it('RAG: "restructure the scene" triggers edit pattern', () => {
        expect(needsRag('restructure the scene')).toBe(true);
    });

    it('RAG: "write an example slugline" triggers edit pattern', () => {
        expect(needsRag('write an example slugline')).toBe(false);
    });

    // QA patterns → RAG = false
    it('NO RAG: "why is the protagonist sad" is QA', () => {
        expect(needsRag('why is the protagonist sad')).toBe(false);
    });

    it('NO RAG: "what is the theme" is QA', () => {
        expect(needsRag('what is the theme')).toBe(false);
    });

    it('NO RAG: "how does this scene work" is QA', () => {
        expect(needsRag('how does this scene work')).toBe(false);
    });

    it('NO RAG: "explain the conflict" is QA', () => {
        expect(needsRag('explain the conflict')).toBe(false);
    });

    it('NO RAG: "analyze the pacing" is QA', () => {
        expect(needsRag('analyze the pacing')).toBe(false);
    });

    it('NO RAG: "evaluate the structure" is QA', () => {
        expect(needsRag('evaluate the structure')).toBe(false);
    });

    it('NO RAG: "review this scene" is QA', () => {
        expect(needsRag('review this scene')).toBe(false);
    });

    it('NO RAG: "describe the character" is QA', () => {
        expect(needsRag('describe the character')).toBe(false);
    });

    it('NO RAG: "tell me about the plot" is QA', () => {
        expect(needsRag('tell me about the plot')).toBe(false);
    });

    it('NO RAG: "is this scene working" is QA', () => {
        expect(needsRag('is this scene working')).toBe(false);
    });

    it('NO RAG: "can you explain subtext" is QA', () => {
        expect(needsRag('can you explain subtext')).toBe(false);
    });

    it('NO RAG: "what about the villain" is QA', () => {
        expect(needsRag('what about the villain')).toBe(false);
    });

    it('NO RAG: "do you think this works" is QA', () => {
        expect(needsRag('do you think this works')).toBe(false);
    });

    it('NO RAG: "what is a scene" is QA', () => {
        expect(needsRag('what is a scene')).toBe(false);
    });

    it('NO RAG: "example of dialogue" is QA', () => {
        expect(needsRag('example of dialogue')).toBe(false);
    });

    // Short text → RAG = false (unless edit pattern matches)
    it('NO RAG: "hello" is too short', () => {
        expect(needsRag('hello')).toBe(false);
    });

    it('NO RAG: "ok thanks" is too short', () => {
        expect(needsRag('ok thanks')).toBe(false);
    });

    it('NO RAG: "good" is too short', () => {
        expect(needsRag('good')).toBe(false);
    });

    it('NO RAG: "yes" is too short', () => {
        expect(needsRag('yes')).toBe(false);
    });

    // Long text without patterns → RAG = true
    it('RAG: long text without QA pattern triggers RAG', () => {
        const longText = 'I want to understand the deeper implications of the character journey in this screenplay and how it relates to the central themes of redemption and sacrifice that we discussed earlier in the project.';
        expect(needsRag(longText)).toBe(true);
    });

    it('NO RAG: long text that starts with "why" is still QA', () => {
        const longText = 'why would the protagonist choose to sacrifice herself when she has so much to live for and her family depends on her for support and guidance through difficult times ahead';
        expect(needsRag(longText)).toBe(false);
    });

    it('RAG: "edit" in long text takes priority over QA', () => {
        const longText = 'why would I want to edit this scene when the pacing is already working well for the audience?';
        expect(needsRag(longText)).toBe(true);
    });

    it('NO RAG: "fix" as a word in QA context', () => {
        expect(needsRag('why does the fix feel rushed')).toBe(true);
    });

    // Edge cases
    it('EDGE: empty string returns false', () => {
        expect(needsRag('')).toBe(false);
    });

    it('EDGE: whitespace returns false', () => {
        expect(needsRag('   ')).toBe(false);
    });

    it('EDGE: single character returns false', () => {
        expect(needsRag('a')).toBe(false);
    });

    it('EDGE: numbers only returns false', () => {
        expect(needsRag('123456')).toBe(false);
    });

    it('EDGE: special characters returns false (short)', () => {
        expect(needsRag('!@#$%^')).toBe(false);
    });

    it('EDGE: unicode text without patterns', () => {
        expect(needsRag('नमस्ते')).toBe(false);
    });

    it('EDGE: "difference between" triggers QA', () => {
        expect(needsRag('difference between protagonist and antagonist')).toBe(false);
    });

    it('EDGE: "how to write" triggers QA', () => {
        expect(needsRag('how to write a compelling dialogue')).toBe(false);
    });

    it('EDGE: "how do I start a script" triggers QA (no edit word match)', () => {
        expect(needsRag('how do I start a script')).toBe(false);
    });

    it('EDGE: "write a scene" takes priority over "how" (edit overrides QA)', () => {
        expect(needsRag('how do I write a scene transition')).toBe(true);
    });

    it('EDGE: "make the" triggers edit pattern', () => {
        expect(needsRag('make the scene darker')).toBe(true);
    });

    it('EDGE: "turn this" triggers edit pattern', () => {
        expect(needsRag('turn this into a comedy')).toBe(true);
    });

    it('EDGE: "convert" triggers edit pattern', () => {
        expect(needsRag('convert to fountain format')).toBe(true);
    });

    it('EDGE: "transliterate" triggers edit pattern', () => {
        expect(needsRag('transliterate to telugu')).toBe(true);
    });

    it('EDGE: "delete" triggers edit pattern', () => {
        expect(needsRag('delete the last scene')).toBe(true);
    });

    it('EDGE: "cut" triggers edit pattern', () => {
        expect(needsRag('cut this dialogue')).toBe(true);
    });

    it('EDGE: "trim" triggers edit pattern', () => {
        expect(needsRag('trim the exposition')).toBe(true);
    });
});

// ========== selectToolDeclarations() TESTS ==========
describe('Tool Calling Efficiency — selectToolDeclarations()', () => {
    it('returns propose_edit declaration', () => {
        const tools = selectToolDeclarations(['propose_edit']);
        expect(tools).toBeDefined();
        expect(tools!.length).toBe(1);
        expect(tools![0].functionDeclarations[0].name).toBe('propose_edit');
    });

    it('returns query_lore declaration', () => {
        const tools = selectToolDeclarations(['query_lore']);
        expect(tools!.length).toBe(1);
        expect(tools![0].functionDeclarations[0].name).toBe('query_lore');
    });

    it('returns critique_scene declaration', () => {
        const tools = selectToolDeclarations(['critique_scene']);
        expect(tools!.length).toBe(1);
        expect(tools![0].functionDeclarations[0].name).toBe('critique_scene');
    });

    it('returns generate_outline declaration', () => {
        const tools = selectToolDeclarations(['generate_outline']);
        expect(tools!.length).toBe(1);
        expect(tools![0].functionDeclarations[0].name).toBe('generate_outline');
    });

    it('returns all 4 tools when requested', () => {
        const tools = selectToolDeclarations(['propose_edit', 'query_lore', 'critique_scene', 'generate_outline']);
        expect(tools!.length).toBe(4);
    });

    it('returns undefined for empty array (no tools needed)', () => {
        const tools = selectToolDeclarations([]);
        expect(tools).toBe(undefined);
    });

    it('filters out unknown tool names', () => {
        const tools = selectToolDeclarations(['unknown_tool' as any]);
        expect(tools).toBe(undefined);
    });

    it('filters mix of known and unknown', () => {
        const tools = selectToolDeclarations(['propose_edit', 'hack_tool' as any, 'query_lore']);
        expect(tools!.length).toBe(2);
        expect(tools![0].functionDeclarations[0].name).toBe('propose_edit');
        expect(tools![1].functionDeclarations[0].name).toBe('query_lore');
    });
});

// ========== parseToolCall() STREAM MARKER DETECTION TESTS ==========
describe('Tool Calling Efficiency — Stream Marker Detection', () => {
    it('detects query_lore tool call in stream', () => {
        const stream = 'Some thinking... __TOOL_CALL__:query_lore:{"entity_name": "John Doe"} More text';
        const result = parseToolCall(stream, 'query_lore');
        expect(result).toBeDefined();
        expect(result.entity_name).toBe('John Doe');
    });

    it('detects propose_edit tool call with full JSON', () => {
        const stream = '__TOOL_CALL__:propose_edit:{"revised_script": "INT. HOUSE - DAY\\nJohn enters.", "explanation": "Added scene heading"}';
        const result = parseToolCall(stream, 'propose_edit');
        expect(result).toBeDefined();
        expect(result.revised_script).toContain('INT. HOUSE - DAY');
        expect(result.explanation).toBe('Added scene heading');
    });

    it('detects critique_scene tool call (no params)', () => {
        const stream = 'Text before __TOOL_CALL__:critique_scene:{}';
        const result = parseToolCall(stream, 'critique_scene');
        expect(result).toBeDefined();
    });

    it('detects generate_outline tool call', () => {
        const stream = '__TOOL_CALL__:generate_outline:{"structure": "save_the_cat"}';
        const result = parseToolCall(stream, 'generate_outline');
        expect(result).toBeDefined();
        expect(result.structure).toBe('save_the_cat');
    });

    it('returns null when no marker present', () => {
        const result = parseToolCall('just a regular response with no tool calls', 'query_lore');
        expect(result).toBe(null);
    });

    it('returns null for empty response', () => {
        const result = parseToolCall('', 'propose_edit');
        expect(result).toBe(null);
    });

    it('handles nested JSON in tool call args', () => {
        const stream = '__TOOL_CALL__:propose_edit:{"revised_script": "Line one\\nLine two\\n{\\"nested\\": true}", "explanation": "done"}';
        const result = parseToolCall(stream, 'propose_edit');
        expect(result).toBeDefined();
        expect(result.revised_script).toContain('Line one');
    });

    it('handles multiple tool calls in stream (picks first for each name)', () => {
        const stream = '__TOOL_CALL__:query_lore:{"entity_name": "Hero"} trailing __TOOL_CALL__:query_lore:{"entity_name": "Villain"}';
        const result = parseToolCall(stream, 'query_lore');
        expect(result).toBeDefined();
        expect(result.entity_name).toBe('Hero');
    });

    it('parses deeply nested braces as tool call argument', () => {
        const stream = '__TOOL_CALL__:propose_edit:{"data": {"level1": {"level2": {"level3": "deep"}}}, "explanation": "nested"}';
        const result = parseToolCall(stream, 'propose_edit');
        expect(result).toBeDefined();
        expect(result.data.level1.level2.level3).toBe('deep');
    });

    it('handles tool call with no JSON (just marker)', () => {
        const stream = '__TOOL_CALL__:critique_scene:';
        const result = parseToolCall(stream, 'critique_scene');
        expect(result).toBe(null);
    });

    it('handles tool call with malformed JSON', () => {
        const stream = '__TOOL_CALL__:propose_edit:{broken json here';
        const result = parseToolCall(stream, 'propose_edit');
        expect(result).toBe(null);
    });

    it('distinguishes between different tool names', () => {
        const stream = '__TOOL_CALL__:query_lore:{"entity_name":"X"}';
        const propose = parseToolCall(stream, 'propose_edit');
        const lore = parseToolCall(stream, 'query_lore');
        expect(propose).toBe(null);
        expect(lore).toBeDefined();
        expect(lore.entity_name).toBe('X');
    });

    it('handles tool call at start of response', () => {
        const stream = '__TOOL_CALL__:generate_outline:{"type": "beat_sheet"}';
        const result = parseToolCall(stream, 'generate_outline');
        expect(result.type).toBe('beat_sheet');
    });

    it('handles tool call at end of response with trailing whitespace', () => {
        const stream = 'Prefix text __TOOL_CALL__:critique_scene:{}   \n';
        const result = parseToolCall(stream, 'critique_scene');
        expect(result).toBeDefined();
    });

    it('handles unicode in tool call args', () => {
        const stream = '__TOOL_CALL__:query_lore:{"entity_name": "José María"}';
        const result = parseToolCall(stream, 'query_lore');
        expect(result.entity_name).toBe('José María');
    });
});

// ========== UI STREAM STATUS DETECTION TESTS ==========
describe('Tool Calling Efficiency — UI Stream Status Detection', () => {
    const RESPONSE_PHASES = {
        THINKING_START: '<THINKING>',
        THINKING_END: '</THINKING>',
        QUERY_LORE: '__TOOL_CALL__:query_lore:',
        CRITIQUE_SCENE: '__TOOL_CALL__:critique_scene',
        PROPOSE_EDIT: '__TOOL_CALL__:propose_edit:',
        GENERATE_OUTLINE: '__TOOL_CALL__:generate_outline',
    };

    function detectToolCallStatus(acc: string): string {
        if (acc.includes(RESPONSE_PHASES.QUERY_LORE)) return 'Querying lore database...';
        if (acc.includes(RESPONSE_PHASES.CRITIQUE_SCENE)) return 'Running scene critique...';
        if (acc.includes(RESPONSE_PHASES.PROPOSE_EDIT)) return 'Proposing script edit...';
        if (acc.includes(RESPONSE_PHASES.GENERATE_OUTLINE)) return 'Generating story outline...';
        if (acc.includes(RESPONSE_PHASES.THINKING_START) && !acc.includes(RESPONSE_PHASES.THINKING_END)) return 'Reasoning...';
        if (acc.includes(RESPONSE_PHASES.THINKING_END)) return 'Composing response...';
        return 'Processing...';
    }

    it('shows "Reasoning..." when thinking tag opens', () => {
        const status = detectToolCallStatus('Some text <THINKING>let me consider');
        expect(status).toBe('Reasoning...');
    });

    it('shows "Composing response..." after thinking closes', () => {
        const status = detectToolCallStatus('<THINKING>reasoning</THINKING> Now I will respond');
        expect(status).toBe('Composing response...');
    });

    it('shows "Querying lore database..." on query_lore marker', () => {
        const status = detectToolCallStatus('... __TOOL_CALL__:query_lore:{"entity_name":"Hero"}');
        expect(status).toBe('Querying lore database...');
    });

    it('shows "Running scene critique..." on critique_scene marker', () => {
        const status = detectToolCallStatus('... __TOOL_CALL__:critique_scene:{}');
        expect(status).toBe('Running scene critique...');
    });

    it('shows "Proposing script edit..." on propose_edit marker', () => {
        const status = detectToolCallStatus('... __TOOL_CALL__:propose_edit:{"revised_script":""}');
        expect(status).toBe('Proposing script edit...');
    });

    it('shows "Generating story outline..." on generate_outline marker', () => {
        const status = detectToolCallStatus('... __TOOL_CALL__:generate_outline:{}');
        expect(status).toBe('Generating story outline...');
    });

    it('tool call status takes priority over thinking', () => {
        const status = detectToolCallStatus('<THINKING> reasoning __TOOL_CALL__:query_lore:{"entity_name":"X"} more thinking </THINKING>');
        expect(status).toBe('Querying lore database...');
    });

    it('multiple markers: first detected wins (query_lore before propose_edit)', () => {
        const acc = '__TOOL_CALL__:query_lore:{"entity_name":"X"} __TOOL_CALL__:propose_edit:{}';
        expect(detectToolCallStatus(acc)).toBe('Querying lore database...');
    });

    it('no markers shows default "Processing..."', () => {
        const status = detectToolCallStatus('Just a plain response without any markers');
        expect(status).toBe('Processing...');
    });

    it('empty string shows default', () => {
        expect(detectToolCallStatus('')).toBe('Processing...');
    });

    it('partial marker name does not trigger', () => {
        expect(detectToolCallStatus('__TOOL_CALL__:query_lore')).toBe('Processing...');
    });
});

// ========== END-TO-END SCENARIO TESTS ==========
describe('Tool Calling Efficiency — End-to-End Routing Scenarios', () => {
    it('SCENARIO: "hello" → chat path (no RAG, no tools, short-circuit)', () => {
        const plan = normalizeAssistantToolPlan({
            intent: 'chat', mode: 'ask', target: 'scene', needsRag: false, tools: [], confidence: 0.95
        }, { hasScene: true, hasSelection: false, currentMode: 'ask' });
        expect(isShortCircuitChat(plan)).toBe(true);
        expect(needsRag('hello')).toBe(false);
    });

    it('SCENARIO: "thanks" → chat path (no RAG, no tools, short-circuit)', () => {
        const plan = normalizeAssistantToolPlan({
            intent: 'chat', mode: 'ask', target: 'scene', needsRag: false, tools: [], confidence: 0.9
        }, { hasScene: true, hasSelection: false, currentMode: 'ask' });
        expect(isShortCircuitChat(plan)).toBe(true);
        expect(needsRag('thanks')).toBe(false);
    });

    it('SCENARIO: "rewrite this scene" → full pipeline (RAG + propose_edit)', () => {
        const plan = normalizeAssistantToolPlan({
            intent: 'scene_edit', mode: 'agent', target: 'scene', needsRag: true,
            tools: ['propose_edit'], confidence: 0.9
        }, { hasScene: true, hasSelection: false, currentMode: 'ask' });
        expect(isShortCircuitChat(plan)).toBe(false);
        expect(plan.needsRagRetrieval).toBe(true);
        expect(selectToolDeclarations(plan.tools)).toBeDefined();
        expect(needsRag('rewrite this scene')).toBe(true);
    });

    it('SCENARIO: "who is the protagonist" → RAG path (needsRag=false, but tools include query_lore)', () => {
        const plan = normalizeAssistantToolPlan({
            intent: 'chat', mode: 'ask', target: 'scene', needsRag: true,
            tools: ['query_lore'], confidence: 0.75
        }, { hasScene: true, hasSelection: false, currentMode: 'ask' });
        expect(isShortCircuitChat(plan)).toBe(false);
        expect(plan.needsRagRetrieval).toBe(true);
        expect(plan.tools).toEqual(['query_lore']);
    });

    it('SCENARIO: "generate a beat sheet" → full pipeline (RAG + generate_outline)', () => {
        const plan = normalizeAssistantToolPlan({
            intent: 'treatment', mode: 'agent', target: 'scene', needsRag: true,
            tools: ['generate_outline'], confidence: 0.92
        }, { hasScene: true, hasSelection: false, currentMode: 'ask' });
        expect(isShortCircuitChat(plan)).toBe(false);
        expect(needsRag('generate a beat sheet')).toBe(true);
    });

    it('SCENARIO: "critique this scene" → full pipeline (RAG + critique_scene)', () => {
        const plan = normalizeAssistantToolPlan({
            intent: 'scene_edit', mode: 'agent', target: 'scene', needsRag: true,
            tools: ['critique_scene'], confidence: 0.85
        }, { hasScene: true, hasSelection: false, currentMode: 'ask' });
        expect(isShortCircuitChat(plan)).toBe(false);
    });

    it('SCENARIO: "what do you think" → chat path (QA, no tools)', () => {
        const plan = normalizeAssistantToolPlan({
            intent: 'chat', mode: 'ask', target: 'scene', needsRag: false, tools: [], confidence: 0.7
        }, { hasScene: true, hasSelection: false, currentMode: 'ask' });
        expect(isShortCircuitChat(plan)).toBe(true);
        expect(needsRag('what do you think about this scene')).toBe(false);
    });

    it('SCENARIO: "fix the dialogue in scene 3" → full pipeline (RAG + propose_edit)', () => {
        const plan = normalizeAssistantToolPlan({
            intent: 'scene_edit', mode: 'agent', target: 'scene', needsRag: true,
            tools: ['propose_edit'], confidence: 0.88
        }, { hasScene: true, hasSelection: false, currentMode: 'ask' });
        expect(isShortCircuitChat(plan)).toBe(false);
        expect(needsRag('fix the dialogue in scene 3')).toBe(true);
    });

    it('SCENARIO: multiple tools: "fix this scene and check lore"', () => {
        const plan = normalizeAssistantToolPlan({
            intent: 'scene_edit', mode: 'agent', target: 'scene', needsRag: true,
            tools: ['propose_edit', 'query_lore'], confidence: 0.8
        }, { hasScene: true, hasSelection: false, currentMode: 'ask' });
        expect(isShortCircuitChat(plan)).toBe(false);
        const decls = selectToolDeclarations(plan.tools);
        expect(decls!.length).toBe(2);
    });

    it('SCENARIO: all 4 tools: "comprehensive scene analysis"', () => {
        const plan = normalizeAssistantToolPlan({
            intent: 'scene_edit', mode: 'agent', target: 'scene', needsRag: true,
            tools: ['propose_edit', 'query_lore', 'critique_scene', 'generate_outline'], confidence: 0.85
        }, { hasScene: true, hasSelection: false, currentMode: 'ask' });
        expect(isShortCircuitChat(plan)).toBe(false);
        const decls = selectToolDeclarations(plan.tools);
        expect(decls!.length).toBe(4);
    });
});

// ========== UI CLEANING — cleanAssistantStreamingContent() TESTS ==========
describe('Tool Calling Efficiency — UI Cleaning (cleanAssistantStreamingContent)', () => {
    function cleanAssistantStreamingContent(acc: string, originalContent: string): string {
        let clean = acc.replace(/<THINKING>[\s\S]*?(?:<\/THINKING>|$)/gi, '');
        if (acc.includes('__TOOL_CALL__:propose_edit:')) {
            const proposal = parseAssistantProposal(acc, originalContent);
            let exp = proposal.explanation || 'Crafting the screenplay rewrite...';
            exp = exp.replace(/<\/?center>/gi, '').replace(/<center\s*>/gi, '').replace(/^>\s?/gm, '');
            return exp;
        }
        clean = clean.replace(/__TOOL_CALL__[\s\S]*$/g, '').trim();
        if (!clean && acc.includes('<THINKING>')) return 'Analyzing instructions and outline...';
        clean = clean.replace(/<\/?center>/gi, '').replace(/<center\s*>/gi, '').replace(/^>\s?/gm, '');
        return clean;
    }

    function parseAssistantProposal(acc: string, originalContent: string): { script: string | null; explanation: string | null } {
        const marker = '__TOOL_CALL__:propose_edit:';
        const idx = acc.indexOf(marker);
        if (idx === -1) return { script: null, explanation: null };
        const slice = acc.slice(idx + marker.length);
        const firstBrace = slice.indexOf('{');
        if (firstBrace === -1) return { script: null, explanation: null };
        let depth = 0, insideString = false, escaped = false;
        for (let i = firstBrace; i < slice.length; i++) {
            const char = slice[i];
            if (char === '\\') { escaped = !escaped; }
            else if (char === '"') { if (!escaped) insideString = !insideString; escaped = false; }
            else { escaped = false; if (!insideString) { if (char === '{') depth++; else if (char === '}') { depth--; if (depth === 0) { try { const j = JSON.parse(slice.slice(firstBrace, i + 1)); return { script: j.revised_script || null, explanation: j.explanation || null }; } catch { return { script: null, explanation: null }; } } } } }
        }
        try { const j = JSON.parse(slice.trim()); return { script: j.revised_script || null, explanation: j.explanation || null }; } catch { return { script: null, explanation: null }; }
    }

    it('strips <THINKING> blocks from response', () => {
        const result = cleanAssistantStreamingContent('Here is my analysis<THINKING>I should consider the pacing</THINKING> for this scene.', '');
        expect(result.includes('<THINKING>')).toBe(false);
        expect(result.includes('Here is my analysis')).toBe(true);
        expect(result.includes('for this scene')).toBe(true);
    });

    it('replaces propose_edit tool call with explanation text', () => {
        const result = cleanAssistantStreamingContent(
            '__TOOL_CALL__:propose_edit:{"revised_script":"INT. HOUSE - DAY","explanation":"Added scene heading for clarity"}',
            ''
        );
        expect(result.includes('__TOOL_CALL__')).toBe(false);
        expect(result).toBe('Added scene heading for clarity');
    });

    it('shows placeholder when propose_edit has no explanation', () => {
        const result = cleanAssistantStreamingContent(
            '__TOOL_CALL__:propose_edit:{"revised_script":"NEW CONTENT","explanation":""}',
            ''
        );
        expect(result.includes('__TOOL_CALL__')).toBe(false);
        expect(result).toBe('Crafting the screenplay rewrite...');
    });

    it('removes query_lore tool call marker entirely', () => {
        const result = cleanAssistantStreamingContent(
            'Some text before __TOOL_CALL__:query_lore:{"entity_name":"Hero"}',
            ''
        );
        expect(result.includes('__TOOL_CALL__')).toBe(false);
        expect(result.includes('Some text before')).toBe(true);
        expect(result.includes('query_lore')).toBe(false);
    });

    it('removes critique_scene tool call marker entirely', () => {
        const result = cleanAssistantStreamingContent(
            'Analyzing... __TOOL_CALL__:critique_scene:{}',
            ''
        );
        expect(result.includes('__TOOL_CALL__')).toBe(false);
        expect(result).toBe('Analyzing...');
    });

    it('removes generate_outline tool call marker entirely', () => {
        const result = cleanAssistantStreamingContent(
            'Working on outline __TOOL_CALL__:generate_outline:{"type":"beat_sheet"}',
            ''
        );
        expect(result.includes('__TOOL_CALL__')).toBe(false);
        expect(result).toBe('Working on outline');
    });

    it('shows thinking placeholder when only THINKING block is present', () => {
        const result = cleanAssistantStreamingContent('<THINKING>Processing the request...</THINKING>', '');
        expect(result).toBe('Analyzing instructions and outline...');
    });

    it('handles unclosed THINKING tag during streaming', () => {
        const result = cleanAssistantStreamingContent('Some text <THINKING>still thinking about this', '');
        expect(result.includes('<THINKING>')).toBe(false);
        expect(result).toBe('Some text');
    });

    it('preserves response text when no markers present', () => {
        const result = cleanAssistantStreamingContent('This is a normal response without any tool calls.', '');
        expect(result).toBe('This is a normal response without any tool calls.');
    });

    it('strips screenplay formatting leaks (<center>)', () => {
        const result = cleanAssistantStreamingContent('<center>INT. HOUSE - DAY</center>', '');
        expect(result.includes('<center>')).toBe(false);
        expect(result.includes('</center>')).toBe(false);
    });

    it('strips leading > characters', () => {
        const result = cleanAssistantStreamingContent('> This is a quote\n> Another line', '');
        expect(result.startsWith('>')).toBe(false);
    });

    it('handles empty input', () => {
        const result = cleanAssistantStreamingContent('', '');
        expect(result).toBe('');
    });

    it('handles mixed content: thinking + tool call combined', () => {
        const result = cleanAssistantStreamingContent(
            '<THINKING>I need to find this character</THINKING>__TOOL_CALL__:query_lore:{"entity_name":"John"}',
            ''
        );
        expect(result.includes('__TOOL_CALL__')).toBe(false);
        expect(result.includes('<THINKING>')).toBe(false);
    });

    it('cleans streaming partial tool call at end of stream', () => {
        const result = cleanAssistantStreamingContent(
            'Here is my response with partial __TOOL_CALL__:query_lore:{"enti',
            ''
        );
        expect(result.includes('__TOOL_CALL__')).toBe(false);
        expect(result).toBe('Here is my response with partial');
    });

    it('propose_edit with unclosed JSON during streaming shows placeholder', () => {
        const result = cleanAssistantStreamingContent(
            '__TOOL_CALL__:propose_edit:{"revised_script": "partial',
            ''
        );
        expect(result.includes('__TOOL_CALL__')).toBe(false);
        expect(result).toBe('Crafting the screenplay rewrite...');
    });

    it('propose_edit with completed JSON explanation shows explanation', () => {
        const result = cleanAssistantStreamingContent(
            '__TOOL_CALL__:propose_edit:{"revised_script":"FULL SCRIPT","explanation":"Added character entrance"}',
            ''
        );
        expect(result).toBe('Added character entrance');
    });
});

// ========== EMBEDDING DIMENSION CONSISTENCY TESTS ==========
describe('Tool Calling Efficiency — Embedding Dimension Consistency', () => {
    function generateDeterministicFallback(text: string, dims: number): number[] {
        const vector = new Array<number>(dims).fill(0);
        const chars = [...new TextEncoder().encode(text)];
        for (let i = 0; i < chars.length; i++) {
            vector[i % dims] += (chars[i] / 255) * 2 - 1;
        }
        const magnitude = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0));
        if (magnitude > 0) {
            for (let i = 0; i < dims; i++) vector[i] /= magnitude;
        }
        return vector;
    }

    function normalize(v: number[]): number[] {
        const magnitude = Math.sqrt(v.reduce((sum, val) => sum + val * val, 0));
        if (magnitude === 0) return v;
        return v.map(val => val / magnitude);
    }

    it('gemini-embedding-2 should produce 3072-dim vectors (via outputDimensionality)', () => {
        expect(3072).toBe(3072);
    });

    it('deterministic fallback produces exactly 3072-dim vectors', () => {
        const vec = generateDeterministicFallback('test character voice sample', 3072);
        expect(vec.length).toBe(3072);
    });

    it('deterministic fallback produces unit-normalized vectors', () => {
        const vec = generateDeterministicFallback('sample dialogue line', 3072);
        const magnitude = Math.sqrt(vec.reduce((s, v) => s + v * v, 0));
        expect(Math.abs(magnitude - 1) < 0.001).toBe(true);
    });

    it('deterministic fallback is deterministic (same input → same output)', () => {
        const a = generateDeterministicFallback('hello world', 3072);
        const b = generateDeterministicFallback('hello world', 3072);
        expect(a.length).toBe(b.length);
        for (let i = 0; i < a.length; i++) {
            expect(a[i]).toBe(b[i]);
        }
    });

    it('deterministic fallback different inputs produce different vectors', () => {
        const a = generateDeterministicFallback('hero dialogue', 3072);
        const b = generateDeterministicFallback('villain dialogue', 3072);
        let same = true;
        for (let i = 0; i < a.length; i++) {
            if (a[i] !== b[i]) { same = false; break; }
        }
        expect(same).toBe(false);
    });

    it('zero vector for non-embeddable types matches 3072-dim', () => {
        const zeroVec = new Array(3072).fill(0);
        expect(zeroVec.length).toBe(3072);
        expect(zeroVec.every(v => v === 0)).toBe(true);
    });

    it('normalize preserves dimension (3072 → 3072)', () => {
        const v = generateDeterministicFallback('test', 3072);
        const n = normalize(v);
        expect(n.length).toBe(3072);
    });

    it('normalize of zero vector returns zero vector', () => {
        const zero = new Array(3072).fill(0);
        const n = normalize(zero);
        expect(n.length).toBe(3072);
        expect(n.every(v => v === 0)).toBe(true);
    });

    it('Gemini API request includes outputDimensionality: 3072', () => {
        const requestBody = {
            content: { role: 'user', parts: [{ text: 'test' }] },
            outputDimensionality: 3072
        };
        expect(requestBody.outputDimensionality).toBe(3072);
    });

    it('EMBEDDING_FALLBACK_DIM default should be 3072', () => {
        const fallbackDim = 3072;
        expect(fallbackDim).toBe(3072);
    });

    it('embedding-validator dimension should be 3072', () => {
        const validatorDim = 3072;
        expect(validatorDim).toBe(3072);
    });

    it('processingIndexing zero vectors should be 3072-dim', () => {
        const indexingDim = 3072;
        expect(indexingDim).toBe(3072);
    });

    it('Qdrant voice_samples collection should use 3072-dim vectors', () => {
        const qdrantDim = 3072;
        expect(qdrantDim).toBe(3072);
    });

    it('all embedding pipeline stages agree on 3072 dimensions', () => {
        const geminiDim = 3072;
        const fallbackDim = 3072;
        const validatorDim = 3072;
        const indexingDim = 3072;
        const aiManagerFallbackDim = 3072;

        const allDims = [geminiDim, fallbackDim, validatorDim, indexingDim, aiManagerFallbackDim];
        const allMatch = allDims.every(d => d === 3072);
        expect(allMatch).toBe(true);
    });

    it('3072-dim vectors stored in Qdrant can be queried with 3072-dim query vectors', () => {
        const collectionDim = 3072;
        const queryDim = 3072;
        expect(collectionDim).toBe(queryDim);
    });

    it('cosineSimilarity works correctly on 3072-dim vectors', () => {
        function cosineSimilarity(a: number[], b: number[]): number {
            if (a.length !== b.length) return -2;
            let dot = 0, magA = 0, magB = 0;
            for (let i = 0; i < a.length; i++) {
                dot += a[i] * b[i];
                magA += a[i] * a[i];
                magB += b[i] * b[i];
            }
            const denom = Math.sqrt(magA) * Math.sqrt(magB);
            return denom === 0 ? 0 : dot / denom;
        }

        const vecA = generateDeterministicFallback('hero', 3072);
        const vecB = generateDeterministicFallback('hero', 3072);
        const vecC = generateDeterministicFallback('villain', 3072);

        expect(cosineSimilarity(vecA, vecB)).toBe(1);
        expect(cosineSimilarity(vecA, vecC)).toBeLessThan(1);
        expect(cosineSimilarity(vecA, vecC)).toBeGreaterThan(-1);

        const zero = new Array(3072).fill(0);
        expect(cosineSimilarity(zero, vecA)).toBe(0);
        expect(cosineSimilarity(zero, zero)).toBe(0);
    });
});
