
import { aiServiceManager } from './aiManager/index.js';
import { ELITE_INTENT_CLASSIFIER_PROMPT } from '../prompts/hollywood/index.js';

export type AssistantIntent = 'scene_edit' | 'selection_edit' | 'chat' | 'treatment';
export type AssistantToolName = 'propose_edit' | 'query_lore' | 'critique_scene' | 'generate_outline';

export interface IntentContext {
    hasScene: boolean;
    hasSelection: boolean;
    currentMode: string;
}

export interface AssistantToolPlan {
    intent: AssistantIntent;
    effectiveMode: 'ask' | 'edit' | 'agent';
    target: 'scene' | 'selection';
    needsRagRetrieval: boolean;
    tools: AssistantToolName[];
    confidence: number;
}

const VALID_INTENTS = new Set<AssistantIntent>(['scene_edit', 'selection_edit', 'chat', 'treatment']);
const VALID_MODES = new Set(['ask', 'edit', 'agent']);
const VALID_TOOLS = new Set<AssistantToolName>(['propose_edit', 'query_lore', 'critique_scene', 'generate_outline']);

export function normalizeAssistantToolPlan(raw: any, context?: Partial<IntentContext>): AssistantToolPlan {
    const intent: AssistantIntent = VALID_INTENTS.has(raw?.intent) ? raw.intent : 'chat';
    const requestedMode = VALID_MODES.has(raw?.mode) ? raw.mode : undefined;
    const effectiveMode = (requestedMode || (intent === 'chat' ? 'ask' : 'agent')) as 'ask' | 'edit' | 'agent';
    const target = (raw?.target === 'selection' && context?.hasSelection !== false) || intent === 'selection_edit'
        ? 'selection'
        : 'scene';
    const rawTools = Array.isArray(raw?.tools) ? raw.tools : [];
    const tools: AssistantToolName[] = [];
    for (const tool of rawTools) {
        if (typeof tool !== 'string') continue;
        if (!VALID_TOOLS.has(tool as AssistantToolName)) continue;
        if (!tools.includes(tool as AssistantToolName)) tools.push(tool as AssistantToolName);
    }
    const confidence = Number(raw?.confidence);

    return {
        intent,
        effectiveMode,
        target,
        needsRagRetrieval: Boolean(raw?.needsRag ?? raw?.needsRagRetrieval ?? raw?.useRag),
        tools,
        confidence: Number.isFinite(confidence) ? Math.max(0, Math.min(1, confidence)) : 0.7
    };
}

export class IntentService {
    public async classifyIntentElite(instruction: string, context: IntentContext): Promise<{ intent: AssistantIntent, confidence: number }> {
        const plan = await this.planAssistantRequest(instruction, context);
        return { intent: plan.intent, confidence: plan.confidence };
    }

    public async planAssistantRequest(instruction: string, context: IntentContext): Promise<AssistantToolPlan> {
        const prompt = `${ELITE_INTENT_CLASSIFIER_PROMPT}

### TOOL ROUTING ADDENDUM:
Decide exactly which assistant tools, if any, should be exposed for this request.

Available tools:
- "propose_edit": only when the user wants script text changed, rewritten, generated, translated, formatted, or continued.
- "query_lore": only when the user asks about a project character, relationship, faction, location, object, or continuity fact.
- "critique_scene": only when the user asks for a critique, review, pacing check, structure check, dialogue analysis, or quality audit.
- "generate_outline": only when the user asks for a treatment, outline, beat sheet, beat board, or story structure.

RAG rule:
- needsRag=true only when project knowledge, lore, prior scenes, references, or source material are needed to answer well.
- Small talk, thanks, greetings, meta questions, and generic chat must use needsRag=false and tools=[].

Return ONLY this JSON shape:
{
  "intent": "scene_edit" | "selection_edit" | "chat" | "treatment",
  "mode": "ask" | "edit" | "agent",
  "target": "scene" | "selection",
  "needsRag": true | false,
  "tools": ["propose_edit" | "query_lore" | "critique_scene" | "generate_outline"],
  "confidence": 0..1,
  "reasoning": "one short sentence"
}`
            .replace('{{hasScene}}', String(context.hasScene))
            .replace('{{hasSelection}}', String(context.hasSelection))
            .replace('{{currentMode}}', context.currentMode || 'ask')
            .replace('{{instruction}}', instruction.trim());

        try {
            const raw = await aiServiceManager.chat(prompt, {
                model: 'instant',
                temperature: 0,
                format: 'json'
            });
            const payload = this.extractJsonPayload(raw);
            if (!payload) throw new Error('Tool planner returned no JSON payload.');
            return normalizeAssistantToolPlan(JSON.parse(payload), context);
        } catch (error) {
            console.warn('[IntentService] LLM tool planning failed; falling back to plain chat.', error);
            return normalizeAssistantToolPlan({
                intent: 'chat',
                mode: 'ask',
                target: context.hasSelection ? 'selection' : 'scene',
                needsRag: false,
                tools: [],
                confidence: 0.35
            }, context);
        }
    }

    private extractJsonPayload(raw: string): string | null {
        if (!raw) return null;
        
        const normalized = raw.replace(/\r\n?/g, '\n').trim();

        // Strategy 1: Look for JSON blocks
        const blockMatch = normalized.match(/```json\n?([\s\S]*?)\n?```/i) || normalized.match(/```\n?([\s\S]*?)\n?```/i);
        if (blockMatch && blockMatch[1].trim()) return blockMatch[1].trim();

        // Strategy 2: Find outermost braces (the most reliable for noisy AI)
        const firstBrace = normalized.indexOf('{');
        const lastBrace = normalized.lastIndexOf('}');
        if (firstBrace !== -1 && lastBrace > firstBrace) {
            const potentialJson = normalized.slice(firstBrace, lastBrace + 1);
            // Quick sanity check: does it contain a quote?
            if (potentialJson.includes('"')) return potentialJson;
        }

        // Strategy 3: Clean response if it looks like a lone JSON object
        if (normalized.startsWith('{') && normalized.endsWith('}')) return normalized;

        return null;
    }
}

export const intentService = new IntentService();
