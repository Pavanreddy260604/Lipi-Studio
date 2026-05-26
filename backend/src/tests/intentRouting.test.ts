import { describe, it, expect } from './framework.js';
import { normalizeAssistantToolPlan } from '../services/intent.service.js';

describe('Assistant Intent Routing', () => {
    it('normalizes an LLM small-talk plan as plain chat without RAG or tools', () => {
        const plan = normalizeAssistantToolPlan({
            intent: 'chat',
            mode: 'ask',
            target: 'scene',
            needsRag: false,
            tools: []
        });

        expect(plan.intent).toBe('chat');
        expect(plan.effectiveMode).toBe('ask');
        expect(plan.needsRagRetrieval).toBe(false);
        expect(plan.tools.length).toBe(0);
    });

    it('normalizes an LLM edit plan to expose only the requested edit tool', () => {
        const plan = normalizeAssistantToolPlan({
            intent: 'scene_edit',
            mode: 'agent',
            target: 'scene',
            needsRag: true,
            tools: ['propose_edit', 'unknown_tool']
        });

        expect(plan.intent).toBe('scene_edit');
        expect(plan.effectiveMode).toBe('agent');
        expect(plan.needsRagRetrieval).toBe(true);
        expect(plan.tools).toEqual(['propose_edit']);
    });
});
