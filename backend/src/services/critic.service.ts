import { aiServiceManager } from './aiManager/index.js';
import { GeminiTool } from './ai.interface';
import { JSONHelper } from './parser/jsonHelper.js';

interface CritiqueResult {
    score: number; // 0-100
    grade: 'A' | 'B' | 'C' | 'D' | 'F';
    summary: string;
    formattingIssues: string[];
    dialogueIssues: string[];
    pacingIssues: string[];
    suggestions: string[];
}

const CRITIQUE_TOOL: GeminiTool = {
    functionDeclarations: [{
        name: 'submit_critique',
        description: 'Submit a structured screenplay critique with score, grade, and categorized issues.',
        parameters: {
            type: 'object',
            properties: {
                score: { type: 'number', description: 'Final score 0-100 after deductions' },
                grade: { type: 'string', description: 'Letter grade: A, B, C, D, or F' },
                summary: { type: 'string', description: 'Brutally honest 2-sentence executive verdict' },
                formattingIssues: { type: 'array', items: { type: 'string' }, description: 'List of WGA formatting deductions' },
                dialogueIssues: { type: 'array', items: { type: 'string' }, description: 'List of dialogue/subtext issues' },
                pacingIssues: { type: 'array', items: { type: 'string' }, description: 'List of pacing/rhythm issues' },
                suggestions: { type: 'array', items: { type: 'string' }, description: '3 mandatory aggressive rewrite prescriptions' }
            },
            required: ['score', 'grade', 'summary', 'formattingIssues', 'dialogueIssues', 'pacingIssues', 'suggestions']
        }
    }]
};

export class CriticService {
    async evaluateScene(sceneContent: string, sceneGoal: string, genre: string, language: string = 'English', rules: string[] = []): Promise<CritiqueResult> {
        const prompt = `
        You are a ruthless, world-class Hollywood Script Consultant. Your reputation depends on your ability to catch every flaw. You are the gatekeeper of quality.
        
        TASK: Perform a BRUTAL EXECUTIVE AUDIT of the screenplay scene below. 
        Start with a SCORE of 100 and apply the following DEDUCTION PROTOCOL:
        
        1. FORMATTING (-10 to -30): Deduct 10 points for each major deviation from WGA standards (sluglines, character cues, margins).
        2. DIALOGUE (-5 to -40): 
           - Deduct 15 points for "On-the-nose" exposition (characters saying what they feel/know instead of using subtext).
           - Deduct 10 points for "Wooden/Generic" voices that sound identical.
           - Deduct 5 points for every line that doesn't use a TACTIC (deflect, intimidate, etc.).
        3. PACING (-5 to -20): 
           - Deduct 10 points if the scene doesn't "Enter late and leave early."
           - Deduct 5 points for "Director's notes" in action lines (telling instead of showing).
        4. DRAMATIC GOAL (-20 to -50): If the scene fails to move the story forward or achieve its stated goal, deduct 30+ points.
        5. PROJECT STYLISTIC RULES (-10 to -40): If the scene violates any of the writer's strict stylistic rules listed under CONTEXT, deduct 15 points for each infraction.
        
        SCORING SCALE:
        90-100: Masterpiece (A) - Professional-ready.
        80-89: Solid (B) - Good craft, minor subtext issues.
        70-79: Average (C) - Readable, but needs significant work.
        <70: Failing (D/F) - Amateurish or mechanically broken.

        CONTEXT:
        Language: ${language}
        Genre: ${genre}
        Dramatic Goal: ${sceneGoal}
        Strict Writer Rules: ${rules.length > 0 ? rules.join('; ') : 'None'}
        
        SCENE CONTENT:
        """
        ${sceneContent}
        """
        
        You MUST call the submit_critique function with your structured findings. Be surgical. If the scene is mediocre, a score of 80 is TOO HIGH. A score of 82 means it is ALMOST production-ready. 
        If it's regular work, it should be in the 60s or 70s.
        `;

        try {
            const response = await aiServiceManager.chat(prompt, {
                model: 'thinking',
                temperature: 0.0, // Zero temp for absolute scoring consistency
                tools: [CRITIQUE_TOOL]
            });

            // Try extracting function call args first (structured output via tool calling)
            const toolCallMatch = response.match(/\[TOOL_CALL:\s*submit_critique\((.+)\)\]/s);
            if (toolCallMatch) {
                try {
                    return JSONHelper.dirtyRepair(toolCallMatch[1]) as CritiqueResult;
                } catch {
                    // Fall through to JSON parsing below
                }
            }

            // Fallback: parse raw JSON response (backwards-compatible with non-tool-calling models)
            let jsonString = response;

            // 1. Try to find content between { and }
            const match = response.match(/\{[\s\S]*\}/);
            if (match) {
                jsonString = match[0];
            } else {
                // 2. If no braces found, try cleaning markdown blocks
                jsonString = response.replace(/```json/g, '').replace(/```/g, '').trim();
            }

            try {
                return JSONHelper.dirtyRepair(jsonString) as CritiqueResult;
            } catch (parseError) {
                console.warn("[CriticService] Initial JSON parse failed, attempting aggressive cleanup:", parseError);
                // 3. Last ditch cleanup: remove everything before first { and after last }
                const firstBrace = jsonString.indexOf('{');
                const lastBrace = jsonString.lastIndexOf('}');
                if (firstBrace !== -1 && lastBrace !== -1) {
                    jsonString = jsonString.substring(firstBrace, lastBrace + 1);
                    return JSONHelper.dirtyRepair(jsonString) as CritiqueResult;
                }
                throw parseError;
            }

        } catch (error) {
            console.error("Critic evaluation failed:", error);
            // Fallback result
            return {
                score: 0,
                grade: 'F',
                summary: "Error generating critique.",
                formattingIssues: [],
                dialogueIssues: [],
                pacingIssues: [],
                suggestions: ["System error. Please try again."]
            };
        }
    }
}

export const criticService = new CriticService();

