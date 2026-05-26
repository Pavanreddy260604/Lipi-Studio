import mongoose from 'mongoose';
import { aiServiceManager } from '../aiManager/index.js';
import { promptRegistry } from '../promptRegistry.service.js';
import { AUDIT_EXPLANATION_PROMPT } from '../../prompts/hollywood/index.js';
import { cleanAssistantChatResponse, extractStructuredAssistantSections, sanitizeScreenplayContent } from '../../utils/screenplayFormatting/index.js';

export async function reviseSceneBatch(
    originalContent: string, critique: any, goal: string, isSecondAttempt: boolean = false,
    targetScore: number = 0, language: string = 'English', bibleId?: string | mongoose.Types.ObjectId,
    sceneId?: string | mongoose.Types.ObjectId, instruction?: string
): Promise<string> {
    let genre = 'Drama', tone = 'Cinematic', visualStyle = '', rules: string[] = [], isTransliteration = false;
    if (bibleId) {
        try {
            const bible = await mongoose.model('Bible').findById(bibleId).lean();
            if (bible) {
                genre = (bible as any).genre || 'Drama';
                tone = (bible as any).tone || 'Cinematic';
                visualStyle = (bible as any).visualStyle || '';
                rules = (bible as any).rules || [];
                isTransliteration = !!(bible as any).transliteration;
            }
        } catch (err) { /* silently ignore */ }
    }
    const { system, user } = promptRegistry.getSurgicalEditPrompt({
        content: originalContent, instruction: instruction || goal, focus: critique.summary,
        language, transliteration: isTransliteration, genre, tone, visualStyle, rules
    });
    const response = await aiServiceManager.chat(`${system}\n\n${user}`, { model: isSecondAttempt ? 'deep' : 'thinking', temperature: isSecondAttempt ? 0.3 : 0.1 });
    if (isSecondAttempt) {
        const sections = extractStructuredAssistantSections(response);
        if (sections.script) return sanitizeScreenplayContent(sections.script);
        return sanitizeScreenplayContent(cleanAssistantChatResponse(response));
    }
    return sanitizeScreenplayContent(response);
}

export async function generateAuditNotes(original: string, revised: string): Promise<string> {
    const prompt = AUDIT_EXPLANATION_PROMPT.replace('{{original}}', original).replace('{{revised}}', revised);
    const response = await aiServiceManager.chat(prompt, { model: 'balanced', temperature: 0.2 });
    return response.trim();
}
