import { Character } from '../../models/Character.js';
import { Bible } from '../../models/Bible.js';
import { Scene } from '../../models/scene/index.js';
import { aiServiceManager } from '../aiManager/index.js';
import { projectContextService } from '../projectContext/index.js';
import { assistantRagService } from '../rag/index.js';
import { intentService } from '../intent.service.js';
import { castingDirectorService } from '../castingDirector.service.js';
import { getAssistantPreferences } from './prompts.js';
import type { AssistedEditOptions } from './types.js';

import type { AssistantToolName } from '../intent.service.js';
import { criticService } from '../critic.service.js';
import { parserService } from '../parser/index.js';
import { beatOrchestratorService } from '../beat/index.js';
import { CharacterFeedback } from '../../models/CharacterFeedback.js';
import { UNIFIED_ASSISTANT_PROMPT } from '../../prompts/hollywood/index.js';
import { sanitizeScreenplayContent } from '../../utils/screenplayFormatting/index.js';
import { buildLoreContextBlock } from './loreHelper.js';
import { buildAssistantChatHistoryText, buildEditorAssistantPrompt, buildAssistantSelectionBlock, buildAssistantPreferencesBlock } from './prompts.js';
import { executeQueryLoreAndRelationships } from './assistedEditLore.js';
import { applySurgicalPatch } from '../parser/patchApplier.js';
import { buildMandatorySceneBrief } from '../projectContext/index.js';
import { stateManagerService } from '../stateManager.service.js';
import { getNarrativeTraditionPrompt } from './assistedEditCore.js';
import { characterDiscoveryService } from '../characterDiscovery/index.js';

const proposeEditTool = {
    functionDeclarations: [{
        name: 'propose_edit',
        description: 'Propose screenplay script modifications or a full rewrite for the active scene. Use this tool whenever the user asks you to change, edit, rewrite, improve, add, or format the scene or dialogue. Do not output the screenplay script as conversational text, always call this function.',
        parameters: {
            type: 'OBJECT',
            properties: {
                revised_script: {
                    type: 'STRING',
                    description: 'The complete revised screenplay script content, or a surgical search/replace diff block.'
                },
                explanation: {
                    type: 'STRING',
                    description: 'A brief explanation explaining your script modifications (director\'s notes, craft rationale).'
                }
            },
            required: ['revised_script', 'explanation']
        }
    }]
};

const queryLoreTool = {
    functionDeclarations: [{
        name: 'query_lore',
        description: 'Query the project Knowledge Graph (Show Bible) to find out who a character is, relationships, or worldbuilding lore. Use this when the user asks "who is X" or asks for lore.',
        parameters: {
            type: 'OBJECT',
            properties: {
                entity_name: { type: 'STRING', description: 'The name of the character or entity to look up.' }
            },
            required: ['entity_name']
        }
    }]
};

const critiqueSceneTool = {
    functionDeclarations: [{
        name: 'critique_scene',
        description: 'Analyze and critique the current scene for pacing, formatting, dialogue, and structure. Use when the user asks for a review or critique.'
    }]
};

const generateOutlineTool = {
    functionDeclarations: [{
        name: 'generate_outline',
        description: 'Generate a high-level story outline, beat sheet, or beat board for the project.'
    }]
};

const toolDeclarationsByName: Record<AssistantToolName, any> = {
    propose_edit: proposeEditTool,
    query_lore: queryLoreTool,
    critique_scene: critiqueSceneTool,
    generate_outline: generateOutlineTool
};

function selectToolDeclarations(toolNames: AssistantToolName[]) {
    const tools = toolNames.map((name) => toolDeclarationsByName[name]).filter(Boolean);
    return tools.length > 0 ? tools : undefined;
}

export async function* assistProject(bibleId: string, instruction: string, options: AssistedEditOptions = {}): AsyncGenerator<string, void, unknown> {
    const bible = await Bible.findById(bibleId);
    if (!bible) throw new Error('Project not found');
    const assistantPreferences = getAssistantPreferences(bible);
    const language = options.language || assistantPreferences.replyLanguage || (bible as any).language || 'English';

    // Simple greetings/small talk regex check
    const greetingsRegex = /^\s*(hi|hello|hey|greetings|good\s+morning|good\s+afternoon|good\s+evening|yo|hola|whats\s+up|what's\s+up|howdy|thanks|thank\s+you|thankyou)\b/i;
    const isGreeting = greetingsRegex.test(instruction.trim()) && instruction.trim().split(/\s+/).length <= 5;

    if (isGreeting) {
        const plainChatPrompt = [
            'You are a warm, concise screenwriting studio assistant.',
            'Answer naturally in 1-2 sentences.',
            'Do not use tools, retrieve knowledge, critique, rewrite, or mention internal routing.',
            '',
            `User message: ${instruction.trim()}`
        ].join('\n');
        try {
            const stream = aiServiceManager.chatStream(
                [{ role: 'user', content: plainChatPrompt }],
                undefined,
                { model: options.model || 'instant', temperature: 0.7 }
            );
            for await (const chunk of stream) yield chunk;
        } catch (err: any) {
            yield `\n\n[ERROR: Project Assistant failed. ${err.message}]`;
        }
        return;
    }

    const effectiveMode = options.mode || 'ask';
    const target = options.selection?.text?.trim() ? 'selection' : 'scene';

    // Query last modified scene in this project as context fallback
    const fallbackScene = await Scene.findOne({ bibleId })
        .sort({ updatedAt: -1 })
        .populate('bibleId')
        .exec();

    const originalContent = sanitizeScreenplayContent(options.currentContent ?? fallbackScene?.content ?? '');
    const slugline = fallbackScene?.slugline || 'Current Scene';
    const summary = fallbackScene?.summary || '';
    const goal = fallbackScene?.goal || '';
    const sequenceNumber = fallbackScene?.sequenceNumber ?? 1;

    const castContext = await Character.find({ bibleId: bible._id }).lean();
    const characterMemoryText = stateManagerService.buildCharacterContext(castContext);

    let loreContextBlock = '';
    try {
        const characterIds = fallbackScene ? (fallbackScene.charactersInvolved || []).map((id: any) => typeof id === 'string' ? id : id.toString()) : [];
        const scanText = ((summary || '') + ' ' + (goal || '') + ' ' + (slugline || '')).toLowerCase();
        loreContextBlock = await buildLoreContextBlock(bibleId, characterIds, scanText);
    } catch (_err) { /* Lore lookup is best-effort */ }

    const characterIds = fallbackScene ? (fallbackScene.charactersInvolved || []).map((id: any) => typeof id === 'string' ? id : id.toString()) : [];

    // Hero Designation
    const heroChar = castContext.find(c => c.isHero === true);
    let heroPromptBlock = '';
    if (heroChar) {
        heroPromptBlock = `Story Protagonist (Hero): ${heroChar.name}\n` +
                          `- Age: ${heroChar.age}\n` +
                          `- Traits: ${heroChar.traits.join(', ')}\n` +
                          `- Motivation: ${heroChar.motivation}\n` +
                          `- Voice: ${heroChar.voice?.description || 'Standard'}\n` +
                          `Strict Mandate: All scene plans and conflict beats must directly test this hero's emotional Wound or internal need.`;
    }

    // RLHF Alignment Anchors
    let rlhfAnchorsBlock = '';
    try {
        const queryCond: any = { bibleId: bible._id };
        if (characterIds && characterIds.length > 0) {
            queryCond.$or = [
                { characterId: { $in: characterIds } },
                { category: 'global_casting' }
            ];
        } else {
            queryCond.category = 'global_casting';
        }
        const feedbacks = await CharacterFeedback.find(queryCond)
            .sort({ createdAt: -1 })
            .limit(3)
            .lean();
        if (feedbacks.length > 0) {
            rlhfAnchorsBlock = feedbacks.map((fb, idx) => {
                const scope = fb.characterId ? `Character Voice` : `Global Casting`;
                return `${idx + 1}. [${scope} Correction]:\n` +
                       `   - Previous Mistake: "${fb.mistakeContext}"\n` +
                       `   - Writer's Preferred Style: "${fb.userCorrection}"\n` +
                       `   Strict Rule: Emulate this preferred style. Avoid repeating the mistake.`;
            }).join('\n\n');
        }
    } catch (fbErr) {
        console.error('[assistedEditProject] Failed to fetch RLHF corrections:', fbErr);
    }

    const narrativeTraditionPrompt = getNarrativeTraditionPrompt((bible as any).style);

    // Project Context
    let projectContextBlock = '';
    try {
        projectContextBlock = projectContextService.toPromptBlock(
            await projectContextService.build(bibleId, sequenceNumber, originalContent)
        );
    } catch (err) { /* ignore fallback */ }

    const activeSceneBrief = buildMandatorySceneBrief({
        sequenceNumber,
        title: fallbackScene?.title || 'Active Scene',
        slugline,
        summary,
        goal
    });

    const ragPack = await assistantRagService.buildAssistantReferencePack({
        instruction,
        mode: effectiveMode,
        target,
        language,
        transliteration: Boolean(options.transliteration ?? assistantPreferences.transliteration),
        currentContent: originalContent,
        selection: options.selection,
        bible,
        scene: fallbackScene as any,
        lite: false
    });
    const ragSections = ragPack.promptSections;
    const persistentDirectives = (ragPack as any).persistentDirectives || '';
    const transliterationRules = (ragPack as any).transliteration_rules || '';

    const projectSpecs = [
        (bible as any).storySoFar ? `Story So Far: ${(bible as any).storySoFar}` : '',
        (bible as any).genre ? `Genre: ${(bible as any).genre}` : '',
        (bible as any).tone ? `Tone/Vibe: ${(bible as any).tone}` : '',
        (bible as any).visualStyle ? `Visual Style: ${(bible as any).visualStyle}` : '',
        (bible as any).rules?.length ? `Strict Rules: ${(bible as any).rules.join('; ')}` : ''
    ].filter(Boolean).join('\n');

    let prompt = buildEditorAssistantPrompt(UNIFIED_ASSISTANT_PROMPT, {
        mode: effectiveMode,
        target,
        story_so_far: (projectSpecs || 'The story is just beginning.') + loreContextBlock,
        global_outline: (bible as any).globalOutline?.join('\n') || '',
        slugline,
        summary,
        characters: characterMemoryText,
        plot_state: fallbackScene ? ((fallbackScene as any).previousSceneSummary || fallbackScene.goal || '') : '',
        language,
        transliteration: Boolean(options.transliteration ?? assistantPreferences.transliteration),
        transliteration_rules: transliterationRules,
        original_content: originalContent,
        selection_block: buildAssistantSelectionBlock(options.selection),
        chat_history: '',
        similar_samples: ragSections,
        persistent_directives: persistentDirectives,
        instruction,
        assistant_preferences: buildAssistantPreferencesBlock(assistantPreferences, language, Boolean(options.transliteration)),
        hero_designation: heroPromptBlock,
        rlhf_anchors: rlhfAnchorsBlock,
        narrative_tradition: narrativeTraditionPrompt
    });

    prompt = `${activeSceneBrief}\n\n${projectContextBlock ? `${projectContextBlock}\n\n` : ''}${prompt}`;

    let fullResponse = '';
    try {
        const stream = aiServiceManager.chatStream(
            [{ role: 'user', content: prompt }],
            undefined,
            {
                model: options.model || 'balanced',
                tools: selectToolDeclarations(['propose_edit', 'query_lore', 'critique_scene', 'generate_outline']),
                webSearch: false,
                reasoning_effort: 'default',
                reasoning_format: 'parsed'
            }
        );
        for await (const chunk of stream) {
            fullResponse += chunk;
            yield chunk;
        }
    } catch (err: any) {
        console.error('[ScriptGeneratorProject] AI Stream Error:', err);
        yield `\n\n[ERROR: AI communication failed. ${err.message || 'Please check your connection.'}]`;
        return;
    }

    const parseToolCall = (toolName: string) => {
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
            try { return JSON.parse(slice.trim()); } catch (e) { return null; }
        }
        return null;
    };

    const loreArgs = parseToolCall('query_lore');
    if (loreArgs && loreArgs.entity_name) {
        const result = await executeQueryLoreAndRelationships(bibleId, loreArgs.entity_name);
        yield `\n\n**[Lore Archivist Result for "${loreArgs.entity_name}"]:**\n\n${result}`;
    }

    const critiqueArgs = parseToolCall('critique_scene');
    if (critiqueArgs) {
        const critique = await criticService.evaluateScene(originalContent, goal, (bible as any).genre || 'Drama', language, (bible as any).rules || []);
        const visibleResponse = `### Screenplay Critique Report\n\n**Score:** ${critique.score || 80}/100 | **Grade:** ${critique.grade || 'B'}\n\n**Verdict:** *${critique.summary || 'Scene is mechanically solid.'}*\n\n` +
                          `#### Formatting & Style Review\n${(critique.formattingIssues?.length ? critique.formattingIssues.map((f: string) => `- ${f}`).join('\n') : `- WGA Industry formatting is respected.`)}\n\n` +
                          `#### Dialogue & Subtext Review\n${(critique.dialogueIssues?.length ? critique.dialogueIssues.map((d: string) => `- ${d}`).join('\n') : `- Characters have distinct voices.`)}\n\n` +
                          `#### Pacing & Rhythm Review\n${(critique.pacingIssues?.length ? critique.pacingIssues.map((p: string) => `- ${p}`).join('\n') : `- Rhythmic pacing is solid.`)}\n\n` +
                          `#### Suggested Actionable Rewrites\n${critique.suggestions?.length ? critique.suggestions.map((s: string) => `- ${s}`).join('\n') : `- Keep writing! No immediate corrections needed.`}`;
        yield `\n\n${visibleResponse}`;
    }

    const outlineArgs = parseToolCall('generate_outline');
    if (outlineArgs) {
        yield `\n\n[Director Agent (Story Architect)]: Routing outlining request to the Story Architect...\n`;
        const stream = beatOrchestratorService.generateOutlineGraph({
            bibleId: bibleId, logline: (bible as any).logline || (bible as any).title || 'A compelling screenplay',
            structureType: (bible as any).style || 'save_the_cat', sceneCount: (bible as any).targetSceneCount || 60,
            customInstructions: instruction, cast: castContext
        });
        for await (const chunk of stream) { if (chunk.includes('Block')) yield `Planning narrative block... ${chunk.trim()}\n`; }
        const visibleResponse = `### Story Outline Generated Successfully!\n\nThe Beat Board has been updated with a professional outline framework. You can now view and edit your new Beat Cards in the Beat Board panel.`;
        yield `\n\n${visibleResponse}`;
    }

    const proposeArgs = parseToolCall('propose_edit');
    if (proposeArgs) {
        if (fallbackScene) {
            const revisedScript = proposeArgs.revised_script || '';
            const explanationText = proposeArgs.explanation || '';

            if (revisedScript.trim()) {
                const fullOriginal = fallbackScene.content || '';
                const resolvedScript = sanitizeScreenplayContent(applySurgicalPatch(fullOriginal, revisedScript));

                if (options.target === 'selection' && options.selection) {
                    const start = typeof options.selection.start === 'number' ? options.selection.start : 0;
                    const end = typeof options.selection.end === 'number' ? options.selection.end : fullOriginal.length;
                    fallbackScene.pendingContent = sanitizeScreenplayContent(fullOriginal.slice(0, start) + resolvedScript + fullOriginal.slice(end));
                } else {
                    fallbackScene.pendingContent = resolvedScript;
                }
                fallbackScene.lastInstruction = instruction;
                await fallbackScene.save();
                yield `\n\n**[Edit Proposal for Active Scene: "${fallbackScene.title}"]**\n\n*Rationale: ${explanationText || 'Script revision proposed.'}*\n\n*(You can review, apply, or discard this proposal from the editor's side panel)*`;
            }
        } else {
            yield `\n\n[ERROR: No active scene found to apply the proposed script edit to. Please create a scene first.]`;
        }
    }

    if (fallbackScene && (proposeArgs || (!loreArgs && !critiqueArgs && !outlineArgs))) {
        let scanText = proposeArgs ? (fallbackScene.pendingContent || '') : fullResponse;
        scanText = sanitizeScreenplayContent(scanText);
        if (scanText) {
            characterDiscoveryService.discoverAndSave(bibleId, scanText).catch(err => { console.error('[ScriptGeneratorProject] Background CharacterDiscovery failed:', err); });
            castingDirectorService.syncCharactersFromScreenplay(bibleId, scanText).catch(err => { console.error('[ScriptGeneratorProject] Background CastingDirector sync failed:', err); });
        }
    }
}

export async function commitAssistedEdit(sceneId: string): Promise<boolean> {
    const scene = await Scene.findById(sceneId);
    if (!scene || !scene.pendingContent) return false;
    scene.content = scene.pendingContent;
    scene.pendingContent = undefined;
    if (scene.assistantChatHistory) {
        const lastProposal = [...scene.assistantChatHistory].reverse().find(m => m.type === 'proposal');
        if (lastProposal) (lastProposal as any).status = 'applied';
    }
    await scene.save();
    if (scene.bibleId && scene.content) castingDirectorService.syncCharactersFromScreenplay(scene.bibleId.toString(), scene.content).catch(err => { console.error(`[ScriptGenerator] Casting sync failed:`, err.message); });
    return true;
}

export async function discardAssistedEdit(sceneId: string): Promise<boolean> {
    const scene = await Scene.findById(sceneId);
    if (!scene) return false;
    scene.pendingContent = undefined;
    if (scene.assistantChatHistory) {
        const lastProposal = [...scene.assistantChatHistory].reverse().find(m => m.type === 'proposal');
        if (lastProposal) (lastProposal as any).status = 'discarded';
    }
    await scene.save();
    return true;
}
