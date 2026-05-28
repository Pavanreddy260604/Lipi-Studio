import { aiServiceManager } from '../aiManager/index.js';
import { buildMandatorySceneBrief, projectContextService } from '../projectContext/index.js';
import { assistantRagService } from '../rag/index.js';
import { characterDiscoveryService } from '../characterDiscovery/index.js';
import { castingDirectorService } from '../castingDirector.service.js';
import { stateManagerService } from '../stateManager.service.js';
import { intentService } from '../intent.service.js';
import type { AssistantToolName } from '../intent.service.js';
import { criticService } from '../critic.service.js';
import { parserService } from '../parser/index.js';
import { beatOrchestratorService } from '../beat/index.js';
import { Scene } from '../../models/scene/index.js';
import { Character } from '../../models/Character.js';
import { Bible } from '../../models/Bible.js';
import { CharacterFeedback } from '../../models/CharacterFeedback.js';
import { UNIFIED_ASSISTANT_PROMPT } from '../../prompts/hollywood/index.js';
import { sanitizeScreenplayContent } from '../../utils/screenplayFormatting/index.js';
import type { AssistedEditOptions } from './types.js';
import { buildLoreContextBlock } from './loreHelper.js';
import { buildAssistantChatHistoryText, buildEditorAssistantPrompt, buildAssistantSelectionBlock, buildAssistantPreferencesBlock, getAssistantPreferences } from './prompts.js';
import { executeQueryLoreAndRelationships } from './assistedEditLore.js';
import { applySurgicalPatch } from '../parser/patchApplier.js';

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

export function getNarrativeTraditionPrompt(style?: string): string {
    const s = (style || '').toLowerCase();
    if (s.includes('epic') || s.includes('indian')) {
        return `[NARRATIVE TRADITION: INDIAN EPIC CYCLE]
- Emphasize "Dharma" (duty/responsibility) and dynamic moral dilemmas.
- Actions have long-term consequences affecting relationships and factions.
- Contrast cosmic order against absolute chaos. Maintain heightened emotional charge.`;
    }
    if (s.includes('yugen') || s.includes('japanese')) {
        return `[NARRATIVE TRADITION: YUGEN / JAPANESE SUBTLETY]
- Focus intensely on subtext and the mysterious beauty of nature.
- Speak through what is left unsaid; actions speak louder than dialogue.
- Dialogue should be extremely minimalist, preserving emotional distance and restraint.`;
    }
    if (s.includes('kishotenketsu') || s.includes('kisho')) {
        return `[NARRATIVE TRADITION: KISHŌTENKETSU (4-ACT STRUCTURE)]
- Structure the scene progression without standard Western antagonist conflict.
- Act 1: Ki (Introduction). Act 2: Shō (Development). Act 3: Ten (The Twist/Contrast). Act 4: Ketsu (Reconciliation/Resolution).
- Force contrast and perspective shifts rather than raw physical collision.`;
    }
    return `[NARRATIVE TRADITION: HOLLYWOOD 3-ACT / CHARACTER-DRIVEN]
- Focus on clear character Wants vs Needs, direct conflict, and clear stakes.
- Character decisions must lead directly to escalating narrative friction.`;
}

export async function* assistedEdit(sceneId: string, instruction: string, options: AssistedEditOptions = {}): AsyncGenerator<string, void, unknown> {
    const scene = await Scene.findById(sceneId).populate('bibleId');
    if (!scene) throw new Error('Scene not found');
    const bible = scene.bibleId as any;
    const sceneImages: string[] = (scene as any).images || [];
    const assistantPreferences = getAssistantPreferences(bible);
    const language = options.language || assistantPreferences.replyLanguage || bible?.language || 'English';
    const originalContent = sanitizeScreenplayContent(options.currentContent ?? scene.content ?? '');

    const greetingsRegex = /^\s*(hi|hello|hey|greetings|good\s+morning|good\s+afternoon|good\s+evening|yo|hola|whats\s+up|what's\s+up|howdy|thanks|thank\s+you|thankyou)\b/i;
    const isGreeting = greetingsRegex.test(instruction.trim()) && instruction.trim().split(/\s+/).length <= 5;

    if (!scene.assistantChatHistory) scene.assistantChatHistory = [];
    scene.assistantChatHistory.push({ role: 'user', type: 'instruction', content: instruction, timestamp: new Date() } as any);
    await scene.save();

    if (isGreeting) {
        const plainChatPrompt = [
            'You are a warm, concise screenwriting studio assistant.',
            'Answer naturally in 1-2 sentences.',
            'Do not use tools, retrieve knowledge, critique, rewrite, or mention internal routing.',
            '',
            `User message: ${instruction.trim()}`
        ].join('\n');
        let responseText = '';
        const stream = aiServiceManager.chatStream(
            [{ role: 'user', content: plainChatPrompt }],
            undefined,
            { model: options.model || 'instant', temperature: 0.7 }
        );
        for await (const chunk of stream) {
            responseText += chunk;
            yield chunk;
        }
        scene.assistantChatHistory.push({
            role: 'assistant', type: 'chat', content: responseText, timestamp: new Date()
        } as any);
        await scene.save();
        return;
    }

    const effectiveMode = options.mode || 'ask';
    const target = options.selection?.text?.trim() ? 'selection' : 'scene';

    const castContext = bible?._id ? await Character.find({ bibleId: bible._id }).lean() : [];
    const characterMemoryText = stateManagerService.buildCharacterContext(castContext);
    let loreContextBlock = '';
    if (bible?._id && scene) {
        try {
            const bibleIdStr = bible._id.toString();
            const characterIds = (scene.charactersInvolved || []).map((id: any) => typeof id === 'string' ? id : id.toString());
            const scanText = ((scene.summary || '') + ' ' + (scene.goal || '') + ' ' + (scene.slugline || '')).toLowerCase();
            loreContextBlock = await buildLoreContextBlock(bibleIdStr, characterIds, scanText);
        } catch (_err) { /* Lore lookup is best-effort */ }
    }

    const characterIds = (scene.charactersInvolved || []).map((id: any) => typeof id === 'string' ? id : id.toString());

    // --- Build Full Context (Always) ---

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
    if (bible?._id) {
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
            console.error('[assistedEditCore] Failed to fetch RLHF corrections:', fbErr);
        }
    }

    const narrativeTraditionPrompt = getNarrativeTraditionPrompt(bible?.style);

    // Project Context
    let projectContextBlock = '';
    if (bible?._id) {
        try {
            const projectCtx = await projectContextService.build(
                bible._id.toString(),
                scene.sequenceNumber,
                originalContent
            );
            projectContextBlock = projectContextService.toPromptBlock(projectCtx);
        } catch (err) { /* ignore fallback */ }
    }

    const activeSceneBrief = buildMandatorySceneBrief({
        sequenceNumber: scene.sequenceNumber,
        title: scene.title,
        slugline: scene.slugline || 'Current Scene',
        summary: scene.summary || '',
        goal: scene.goal || ''
    });

    // --- Conditional RAG Retrieval (expensive, only for edit-like queries) ---
    const needsRagRetrieval = true;
    let ragSections = '';
    let persistentDirectives = '';
    let transliterationRules = '';
    if (needsRagRetrieval) {
        const ragPack = await assistantRagService.buildAssistantReferencePack({
            instruction, mode: effectiveMode, target, language,
            transliteration: Boolean(options.transliteration ?? assistantPreferences.transliteration),
            currentContent: originalContent, selection: options.selection, bible, scene: scene as any, lite: false
        });
        ragSections = ragPack.promptSections;
        persistentDirectives = (ragPack as any).persistentDirectives || '';
        transliterationRules = (ragPack as any).transliteration_rules || '';
    }

    // --- Build Unified Prompt ---
    const projectSpecs = [
        bible?.storySoFar ? `Story So Far: ${bible.storySoFar}` : '',
        bible?.genre ? `Genre: ${bible.genre}` : '',
        bible?.tone ? `Tone/Vibe: ${bible.tone}` : '',
        (bible as any)?.visualStyle ? `Visual Style: ${(bible as any).visualStyle}` : '',
        (bible as any)?.rules?.length ? `Strict Rules: ${(bible as any).rules.join('; ')}` : ''
    ].filter(Boolean).join('\n');

    let prompt = buildEditorAssistantPrompt(UNIFIED_ASSISTANT_PROMPT, {
        mode: effectiveMode,
        target,
        story_so_far: (projectSpecs || 'The story is just beginning.') + loreContextBlock,
        global_outline: bible?.globalOutline?.join('\n') || '',
        slugline: scene.slugline || 'Current Scene',
        summary: scene.summary || '',
        characters: characterMemoryText,
        plot_state: (scene as any).previousSceneSummary || scene.goal || '',
        language,
        transliteration: Boolean(options.transliteration ?? assistantPreferences.transliteration),
        transliteration_rules: transliterationRules,
        original_content: originalContent,
        selection_block: buildAssistantSelectionBlock(options.selection),
        chat_history: sanitizeScreenplayContent(buildAssistantChatHistoryText(scene.assistantChatHistory as any)),
        similar_samples: ragSections,
        persistent_directives: persistentDirectives,
        instruction,
        assistant_preferences: buildAssistantPreferencesBlock(assistantPreferences, language, Boolean(options.transliteration)),
        hero_designation: heroPromptBlock,
        rlhf_anchors: rlhfAnchorsBlock,
        narrative_tradition: narrativeTraditionPrompt
    });

    prompt = `${activeSceneBrief}\n\n${projectContextBlock ? `${projectContextBlock}\n\n` : ''}${prompt}`;

    // --- Stream with the exact tool set selected by the LLM planner ---
    let fullResponse = '';
    try {
        const stream = aiServiceManager.chatStream(
            [{ role: 'user', content: prompt, images: sceneImages }],
            undefined,
            {
                model: options.model || 'balanced',
                tools: selectToolDeclarations(['propose_edit', 'query_lore', 'critique_scene', 'generate_outline']),
                webSearch: false,
                reasoning_effort: 'default',
                reasoning_format: 'parsed'
            }
        );
        for await (const chunk of stream) { fullResponse += chunk; yield chunk; }
    } catch (err: any) {
        console.error('[ScriptGenerator] AI Stream Error:', err);
        yield `\n\n[ERROR: AI communication failed. ${err.message || 'Please check your connection.'}]`;
        return;
    }

    // --- Post-stream: Detect tool call OR fall back to legacy XML parsing ---
    let assistantType: 'proposal' | 'chat' = 'chat';
    let visibleResponse = fullResponse;

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
    if (loreArgs && loreArgs.entity_name && bible?._id) {
        const result = await executeQueryLoreAndRelationships(bible._id.toString(), loreArgs.entity_name);
        visibleResponse = `**[Lore Archivist Result for "${loreArgs.entity_name}"]:**\n\n${result}`;
        yield `\n\n${visibleResponse}`;
    }

    const critiqueArgs = parseToolCall('critique_scene');
    if (critiqueArgs) {
        const critique = await criticService.evaluateScene(originalContent, scene.goal || '', bible?.genre || 'Drama', language, bible?.rules || []);
        visibleResponse = `### Screenplay Critique Report\n\n**Score:** ${critique.score || 80}/100 | **Grade:** ${critique.grade || 'B'}\n\n**Verdict:** *${critique.summary || 'Scene is mechanically solid.'}*\n\n` +
                          `#### Formatting & Style Review\n${(critique.formattingIssues?.length ? critique.formattingIssues.map((f: string) => `- ${f}`).join('\n') : `- WGA Industry formatting is respected.`)}\n\n` +
                          `#### Dialogue & Subtext Review\n${(critique.dialogueIssues?.length ? critique.dialogueIssues.map((d: string) => `- ${d}`).join('\n') : `- Characters have distinct voices.`)}\n\n` +
                          `#### Pacing & Rhythm Review\n${(critique.pacingIssues?.length ? critique.pacingIssues.map((p: string) => `- ${p}`).join('\n') : `- Rhythmic pacing is solid.`)}\n\n` +
                          `#### Suggested Actionable Rewrites\n${critique.suggestions?.length ? critique.suggestions.map((s: string) => `- ${s}`).join('\n') : `- Keep writing! No immediate corrections needed.`}`;
        yield `\n\n${visibleResponse}`;
    }

    const outlineArgs = parseToolCall('generate_outline');
    if (outlineArgs && bible?._id) {
        yield `\n\n[Director Agent (Story Architect)]: Routing outlining request to the Story Architect...\n`;
        const stream = beatOrchestratorService.generateOutlineGraph({
            bibleId: bible._id.toString(), logline: bible.logline || bible.title || 'A compelling screenplay',
            structureType: bible.style || 'save_the_cat', sceneCount: bible.targetSceneCount || 60,
            customInstructions: instruction, cast: castContext
        });
        for await (const chunk of stream) { if (chunk.includes('Block')) yield `Planning narrative block... ${chunk.trim()}\n`; }
        visibleResponse = `### Story Outline Generated Successfully!\n\nThe Beat Board has been updated with a professional outline framework. You can now view and edit your new Beat Cards in the Beat Board panel.`;
        yield `\n\n${visibleResponse}`;
    }

    const proposeArgs = parseToolCall('propose_edit');
    if (proposeArgs) {
        const revisedScript = proposeArgs.revised_script || '';
        const explanationText = proposeArgs.explanation || '';

        if (revisedScript.trim()) {
            assistantType = 'proposal';
            const fullOriginal = scene.content || '';
            const resolvedScript = sanitizeScreenplayContent(applySurgicalPatch(fullOriginal, revisedScript));

            if (options.target === 'selection' && options.selection) {
                const start = typeof options.selection.start === 'number' ? options.selection.start : 0;
                const end = typeof options.selection.end === 'number' ? options.selection.end : fullOriginal.length;
                scene.pendingContent = sanitizeScreenplayContent(fullOriginal.slice(0, start) + resolvedScript + fullOriginal.slice(end));
            } else {
                scene.pendingContent = resolvedScript;
            }
            scene.lastInstruction = instruction;
            visibleResponse = explanationText || `Script revision proposed.`;
        }
    }

    // Legacy fallback: if no tool call detected, use the old XML section parser
    if (assistantType === 'chat' && needsRagRetrieval && !loreArgs && !critiqueArgs && !outlineArgs) {
        const fullOriginalContent = options.target === 'selection' ? (options.selection?.text || '') : (scene.content || '');
        const refined = sanitizeScreenplayContent((await parserService.refineAssistantResponse(fullResponse, fullOriginalContent)).script);
        const hasScriptChanges = refined && refined.trim() !== fullOriginalContent.trim();
        if (hasScriptChanges) {
            assistantType = 'proposal';
            visibleResponse = refined;
            const fullOriginal = scene.content || '';
            if (options.target === 'selection' && options.selection) {
                const start = typeof options.selection.start === 'number' ? options.selection.start : 0;
                const end = typeof options.selection.end === 'number' ? options.selection.end : fullOriginal.length;
                scene.pendingContent = sanitizeScreenplayContent(fullOriginal.slice(0, start) + visibleResponse + fullOriginal.slice(end));
            } else {
                scene.pendingContent = visibleResponse;
            }
            scene.lastInstruction = instruction;
        }
    }

    scene.assistantChatHistory.push({
        role: 'assistant', type: assistantType, status: assistantType === 'proposal' ? 'pending' : undefined,
        content: visibleResponse, timestamp: new Date()
    } as any);
    await scene.save();

    if (bible?._id) {
        let scanText = assistantType === 'proposal' ? (scene.pendingContent || visibleResponse) : fullResponse;
        scanText = sanitizeScreenplayContent(scanText);
        characterDiscoveryService.discoverAndSave(bible._id.toString(), scanText).catch(err => { console.error('[ScriptGenerator] Background CharacterDiscovery failed:', err); });
        castingDirectorService.syncCharactersFromScreenplay(bible._id.toString(), scanText).catch(err => { console.error('[ScriptGenerator] Background CastingDirector sync failed:', err); });
    }
}
