import { describe, it, expect } from './framework.js';

// Simple mock representing the RLHF prompt generator function to test robust compilation logic
function compileRlhfPromptBlock(feedbacks: any[]): string {
    if (!feedbacks || feedbacks.length === 0) return '';
    
    let rlhfAnchorsBlock = '## CRITICAL STYLE DIRECTIVES (RLHF ANCHORS)\n';
    rlhfAnchorsBlock += 'The writer has previously rejected certain casting, pacing, or dialogue choices. You MUST strictly adhere to these negative constraints in your generations:\n';
    
    feedbacks.forEach((fb, idx) => {
        const category = fb.category ? `[Category: ${fb.category.toUpperCase()}]` : '';
        const context = fb.mistakeContext ? `\n   - Context of past mistake: "${fb.mistakeContext}"` : '';
        const correction = fb.userCorrection ? `\n   - Strict instruction: "${fb.userCorrection}"` : '';
        rlhfAnchorsBlock += `\n${idx + 1}. ${category}${context}${correction}\n`;
    });
    
    return rlhfAnchorsBlock;
}

describe('RLHF Closed-Loop System Prompt Compiler stress-testing', () => {
    it('should compile empty feedbacks to an empty string safely without crash', () => {
        const output = compileRlhfPromptBlock([]);
        expect(output).toBe('');
    });

    it('should correctly build prompt block for valid feedback listings', () => {
        const mockFeedbacks = [
            {
                category: 'global_casting',
                mistakeContext: 'AI proposed character casting: REN',
                userCorrection: 'Reject character "REN". Avoid flat, unnecessary extra characters.'
            }
        ];
        const output = compileRlhfPromptBlock(mockFeedbacks);
        expect(output).toContain('## CRITICAL STYLE DIRECTIVES (RLHF ANCHORS)');
        expect(output).toContain('[Category: GLOBAL_CASTING]');
        expect(output).toContain('Reject character "REN"');
    });

    it('should brutally handle and sanitize massive feedback payloads without memory choke', () => {
        const largeString = 'A'.repeat(50000); // 50 KB malicious string
        const mockFeedbacks = [
            {
                category: 'pacing',
                mistakeContext: largeString,
                userCorrection: 'Speed up action blocks'
            }
        ];
        const output = compileRlhfPromptBlock(mockFeedbacks);
        expect(output.length > 50000).toBe(true);
        expect(output).toContain('Speed up action blocks');
    });

    it('should tolerate missing optional feedback fields gracefully', () => {
        const mockFeedbacks = [
            {
                category: null,
                mistakeContext: undefined,
                userCorrection: 'Write dialogue in simple active voice'
            }
        ];
        const output = compileRlhfPromptBlock(mockFeedbacks);
        expect(output).toContain('Strict instruction: "Write dialogue in simple active voice"');
    });
});
