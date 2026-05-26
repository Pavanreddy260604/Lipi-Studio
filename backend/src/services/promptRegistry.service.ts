import { 
    SCREENPLAY_SYSTEM_PROMPT, 
    FORMAT_TEMPLATES, 
    STYLE_PROMPTS, 
    SUBTEXT_MANDATE, 
} from '../prompts/hollywood/index.js';

interface PromptVars {
    projectTitle?: string;
    context?: string;
    plotState?: string;
    content?: string;
    instruction?: string;
    focus?: string;
    format?: keyof typeof FORMAT_TEMPLATES;
    style?: keyof typeof STYLE_PROMPTS;
    language?: string;
    transliteration?: boolean;
    cast?: any[];
    [key: string]: any;
}

/**
 * PromptRegistryService
 * The "Brain" of the Scripting Engine.
 * Centralizes all AI instructions and formatting mandates.
 */
class PromptRegistryService {
    /**
     * Get a core Hollywood Script Generation prompt.
     * Migrated from legacy buildScriptPrompt.
     */
    getScriptGenerationPrompt(vars: PromptVars) {
        const formatInfo = FORMAT_TEMPLATES[vars.format || 'film'];
        const styleInfo = STYLE_PROMPTS[vars.style || 'classic'];

        let system = `${SCREENPLAY_SYSTEM_PROMPT}\n\n${SUBTEXT_MANDATE}`;
        
        let user = `## ASSIGNMENT
**Format:** ${formatInfo.name}
**Style:** ${styleInfo.name}
${styleInfo.prompt}

## CAST & CONTEXT
${this.buildCastBlock(vars.cast)}

## INSTRUCTION
${vars.instruction || 'Write a compelling scene based on the context.'}

## LANGUAGE
${this.buildLanguageBlock(vars.language, vars.transliteration)}

Now write the complete screenplay. Begin with FADE IN: and use proper Hollywood formatting throughout.`;

        return { system, user };
    }

    /**
     * Get a Surgical Patching prompt.
     */
    getSurgicalEditPrompt(vars: PromptVars) {
        let system = `You are a surgical script editor. 
                     Return your complete revised scene content directly.
                     Maintain absolute formatting integrity. Do not output any explanation, markdown formatting tags, or commentary outside of the screenplay.`;

        if (vars.language && vars.language !== 'English') {
            system += `\nWrite dialogue/speech lines ONLY in native, fluent ${vars.language.toUpperCase()}. All formatting elements, Scene Headings (INT./EXT.), Action Descriptions/Stage Directions, and Character Names MUST remain strictly in standard English.`;
            if (vars.transliteration) {
                system += `\nUse phonetic transliteration (English alphabet spellings) for the native dialogue.`;
            } else {
                system += `\nWrite dialogue/speech lines in the native ${vars.language} script.`;
            }
        }
        if (vars.genre || vars.tone) {
            system += `\nGenre context: ${vars.genre || 'Drama'}. Tone/Vibe: ${vars.tone || 'Cinematic'}.`;
        }
        if (vars.visualStyle) {
            system += `\nVisual Style: ${vars.visualStyle}.`;
        }
        if (vars.rules && vars.rules.length > 0) {
            system += `\nStrict Stylistic Rules:\n${vars.rules.map((r: string) => `- ${r}`).join('\n')}`;
        }

        return {
            system,
            user: `Edit the following scene content:
                   ${vars.content}
                   
                   Instruction: ${vars.instruction}`
        };
    }

    private buildCastBlock(cast?: any[]) {
        if (!cast || cast.length === 0) return 'No specific cast provided. Create characters as needed.';
        return cast.map(c => `- ${c.name.toUpperCase()} (${c.role || 'Supporting'}): ${c.motivation || ''}`).join('\n');
    }

    private buildLanguageBlock(language?: string, transliteration?: boolean) {
        if (!language || language === 'English') return 'Write in professional English.';
        
        let block = `## LANGUAGE RULE (IMPORTANT)
Write the dialogue/speech lines ONLY in native, fluent ${language.toUpperCase()}.
All other elements (Scene Headings/Sluglines like INT./EXT., Action Descriptions, Stage Directions, and Character Names) MUST remain strictly in standard English.`;
        
        if (transliteration) {
            block += `\nWrite dialogue/speech lines in ${language} using the ENGLISH ALPHABET (Phonetic Transliteration, e.g. "Namaskaram" instead of "నమస్కారం").`;
        } else {
            block += `\nWrite dialogue/speech lines in the native ${language} script (e.g. "నమస్కారం").`;
        }
        return block;
    }
}

export const promptRegistry = new PromptRegistryService();
