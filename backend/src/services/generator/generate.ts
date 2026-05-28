import mongoose from 'mongoose';
import { aiServiceManager } from '../aiManager/index.js';
import { buildMandatorySceneBrief, projectContextService } from '../projectContext/index.js';
import { assistantRagService } from '../rag/index.js';
import { characterDiscoveryService } from '../characterDiscovery/index.js';
import { castingDirectorService } from '../castingDirector.service.js';
import { storyPlannerService } from '../storyPlanner/index.js';
import { stateManagerService } from '../stateManager.service.js';
import { Script } from '../../models/Script.js';
import { Character } from '../../models/Character.js';
import { Bible } from '../../models/Bible.js';
import { CharacterFeedback } from '../../models/CharacterFeedback.js';
import { buildScriptPrompt, ULTIMATE_COHERENCE_PROMPT } from '../../prompts/hollywood/index.js';
import { sanitizeScreenplayContent } from '../../utils/screenplayFormatting/index.js';
import type { ScriptRequest } from './types.js';
import { addBackgroundTask } from './background.js';
import { getUserInterestsForBible, stripDeep } from './generateHelpers.js';
import { driftScannerService } from '../driftScanner.service.js';
import { screenplayValidator } from '../screenplayValidator.service.js';

function getContentDelta(prevContent: string | undefined, newContent: string): number {
    if (!prevContent) return 100;
    const prev = prevContent.replace(/\s+/g, ' ').trim();
    const next = newContent.replace(/\s+/g, ' ').trim();
    if (!prev || !next) return 100;
    const maxLen = Math.max(prev.length, next.length);
    if (maxLen === 0) return 0;
    const minLen = Math.min(prev.length, next.length);
    let diffs = 0;
    for (let i = 0; i < minLen; i++) {
        if (prev[i] !== next[i]) diffs++;
    }
    diffs += Math.abs(prev.length - next.length);
    return (diffs / maxLen) * 100;
}

const TASK_MODEL_ROUTES: Record<string, string> = {
    character_discovery: 'instant',
    character_sync: 'instant',
    state_extraction: 'thinking',
    plot_summary: 'thinking',
};

function resolveModelForTask(taskName: string, requestedModel?: string): string {
    if (requestedModel && requestedModel in TASK_MODEL_ROUTES) {
        return TASK_MODEL_ROUTES[requestedModel] || requestedModel;
    }
    return requestedModel || 'balanced';
}

function getRlhfBoostedTemperature(feedbackCount: number, baseTemp: number): number {
    if (feedbackCount <= 2) return baseTemp;
    const boost = Math.min((feedbackCount - 2) * 0.05, 0.35);
    return Math.min(baseTemp + boost, 0.85);
}

export async function* generateScript(request: ScriptRequest): AsyncGenerator<string, void, unknown> {
    if (process.env.NODE_ENV !== 'production') { console.log(`[ScriptGen] Building prompt for: ${request.format} / ${request.style}`); }
    // Validate IDs at entry to prevent NoSQL injection in all downstream queries
    if (request.bibleId && !mongoose.Types.ObjectId.isValid(request.bibleId)) {
        throw new Error('Invalid bibleId');
    }
    if (request.characterIds) {
        for (const id of request.characterIds) {
            if (!mongoose.Types.ObjectId.isValid(id)) throw new Error('Invalid characterId');
        }
    }
    if (request.useAdvancedCoherence) {
        yield* generateAdvancedScript(request);
        return;
    }
    let ownerId = request.userId || '000000000000000000000000';
    if (!mongoose.Types.ObjectId.isValid(ownerId)) {
        throw new Error('Invalid userId');
    }
    let targetLanguage = request.language;
    let transliteration = request.transliteration;
    const isSceneScopedGeneration = Boolean(
        request.sceneSlugline?.trim() && request.sceneSummary?.trim()
    );
    let projectContextBlock = '';
    if (request.bibleId) {
        try {
            const projectCtx = await projectContextService.build(
                request.bibleId,
                request.sceneSequenceNumber,
                undefined
            );
            projectContextBlock = projectContextService.toPromptBlock(projectCtx);
            if (!targetLanguage) targetLanguage = projectCtx.project.language;
            if (transliteration === undefined) transliteration = projectCtx.project.transliteration;
            if (!request.genre) request.genre = projectCtx.project.genre;
            if (!request.tone) request.tone = projectCtx.project.tone;
        } catch (err) {
            if (process.env.NODE_ENV !== 'production') { console.warn(`[ScriptGenerator] Project Context building failed: ${err}`); }
        }
    }
    request.language = targetLanguage || 'English';
    request.transliteration = !!transliteration;
    const scriptDoc = new Script({
        userId: new mongoose.Types.ObjectId(ownerId),
        prompt: request.idea, format: request.format, style: request.style,
        language: request.language, status: 'generating',
        metadata: { genre: request.genre, tone: request.tone, bibleId: request.bibleId }
    });
    await scriptDoc.save();
    let similarSamples: any[] = [];
    if (!request.speedMode) {
        try {
            const userInterests = await getUserInterestsForBible({ userId: ownerId } as any);
            const bibleDoc = request.bibleId ? await Bible.findById(request.bibleId).lean() : null;
            const pack = await assistantRagService.buildAssistantReferencePack({
                instruction: [
                    request.sceneSlugline,
                    request.sceneSummary,
                    request.sceneGoal,
                    request.idea
                ].filter(Boolean).join('\n'),
                mode: 'edit',
                target: 'scene',
                language: request.language,
                bible: (bibleDoc as any) || undefined,
                scene: isSceneScopedGeneration ? {
                    slugline: request.sceneSlugline,
                    summary: request.sceneSummary,
                    goal: request.sceneGoal,
                    sequenceNumber: request.sceneSequenceNumber
                } as any : undefined,
                userInterests: userInterests ?? undefined
            } as any);
            similarSamples = (pack as any).retrievalMetadata?.chunks || [];
        } catch (err) {
            if (process.env.NODE_ENV !== 'production') { console.warn(`[ScriptGenerator] RAG Lookup failed: ${err}`); }
        }
    }
    let castContext: any[] = [];
    let bibleDoc: any = null;
    if (request.bibleId) {
        bibleDoc = await Bible.findById(request.bibleId).lean();
    }
    if (request.characterIds?.length) {
        castContext = await Character.find({ _id: { $in: request.characterIds } }).lean();
    } else if (request.bibleId) {
        castContext = await Character.find({ bibleId: request.bibleId }).lean();
    }

    // Compile RLHF Prompt Anchors with over-fitting prevention
    let rlhfAnchorsBlock = '';
    let rlhfFeedbackCount = 0;
    if (request.bibleId) {
        try {
            const feedbacks = await CharacterFeedback.find({ bibleId: request.bibleId })
                .sort({ createdAt: -1 })
                .limit(5)
                .lean();
            rlhfFeedbackCount = feedbacks.length;
            if (feedbacks.length > 0) {
                const now = Date.now();
                const agedFeedbacks = feedbacks.map((fb, idx) => {
                    const ageMinutes = fb.createdAt ? (now - new Date(fb.createdAt).getTime()) / 60000 : 0;
                    const recencyWeight = Math.max(0.3, 1 - ageMinutes / 10080);
                    return { ...fb, recencyWeight, originalIndex: idx };
                });
                const sorted = agedFeedbacks.sort((a, b) => b.recencyWeight - a.recencyWeight).slice(0, 3);
                rlhfAnchorsBlock = '\n\n## CRITICAL STYLE DIRECTIVES (RLHF ANCHORS)\n' +
                    'The writer has previously rejected certain casting, pacing, or dialogue choices. You MUST strictly adhere to these style anchors (weighted by recency):\n\n' +
                    sorted.map((fb) => {
                        const category = fb.category ? `[Category: ${fb.category.toUpperCase()}]` : '';
                        const context = fb.mistakeContext ? `\n   - Context of past mistake: "${fb.mistakeContext}"` : '';
                        const correction = fb.userCorrection ? `\n   - Strict instruction: "${fb.userCorrection}"` : '';
                        const recencyNote = fb.recencyWeight < 0.6 ? '\n   - Note: This is an older correction; apply with moderate weight.' : '';
                        return `${fb.originalIndex + 1}. ${category}${context}${correction}${recencyNote}`;
                    }).join('\n\n') + '\n';
            }
        } catch (fbErr) {
            console.error('[ScriptGenerator] Failed to fetch RLHF corrections:', fbErr);
        }
    }

    const fullPrompt = buildScriptPrompt(
        request.idea, request.format, request.style,
        { genre: request.genre, tone: request.tone, language: request.language, transliteration: request.transliteration, sceneLength: request.sceneLength, polarityShift: request.polarityShift },
        similarSamples, castContext
    );
    const stateGuidance = castContext.length > 0 ? '\n\n## CHARACTER CONTINUITY:\n' + stateManagerService.buildCharacterContext(castContext) + '\n' : '';
    let finalPrompt = stateGuidance + fullPrompt;
    
    // Inject locations, extras, ignored names, and RLHF directives
    if (rlhfAnchorsBlock) finalPrompt += rlhfAnchorsBlock;
    if (request.sceneLocations?.length) {
        finalPrompt += `\n\n## SCENE LOCATIONS / SETTINGS TO INTEGRATE:\nUse these places as active scene headers or action line backdrops: ${request.sceneLocations.join(', ')}\n`;
    }
    if (request.genericExtras?.length) {
        finalPrompt += `\n\n## GENERIC BACKGROUND EXTRAS / MINOR ROLES TO INTEGRATE:\nIntegrate these minor actors naturally in action lines (e.g. OLD MAN 2, DRIVER 1). Do NOT treat them as speaking main casting: ${request.genericExtras.join(', ')}\n`;
    }
    if (bibleDoc && bibleDoc.ignoredCharacterNames?.length) {
        finalPrompt += `\n\n## STAGE CONSTRAINTS / EXCLUSION DIRECTIVES:\nStrictly AVOID using the following names as characters or speaking heads. Do NOT write dialogue for them and do NOT introduce them into the scene: ${bibleDoc.ignoredCharacterNames.join(', ')}\n`;
    }

    if (projectContextBlock) finalPrompt = `${projectContextBlock}\n\n${finalPrompt}`;
    if (isSceneScopedGeneration && request.sceneSlugline && request.sceneSummary) {
        finalPrompt = `${buildMandatorySceneBrief({
            sequenceNumber: request.sceneSequenceNumber || 0,
            slugline: request.sceneSlugline,
            summary: request.sceneSummary,
            goal: request.sceneGoal
        })}\n\n${finalPrompt}`;
    }
    if (request.previousContext?.trim()) {
        finalPrompt += `\n\n## PREVIOUS SCENE CONTINUITY\n${request.previousContext.trim()}`;
    }
    const beatSheet = isSceneScopedGeneration
        ? null
        : await storyPlannerService.generateBeatSheet(request, similarSamples, castContext);
    if (beatSheet) {
        let serializedBeatSheet = '';
        if (typeof beatSheet === 'object' && beatSheet !== null) {
            const beats = Array.isArray(beatSheet) ? beatSheet : (beatSheet.beats || beatSheet.milestones || []);
            if (Array.isArray(beats) && beats.length > 0) {
                serializedBeatSheet = beats.map((b: any, i: number) => {
                    if (typeof b === 'string') return `${i + 1}. ${b}`;
                    return `${i + 1}. **${(b.name || b.title || 'Beat').toUpperCase()}**: ${b.description || b.summary || b.goal || JSON.stringify(b)}`;
                }).join('\n');
            } else {
                serializedBeatSheet = JSON.stringify(stripDeep(beatSheet), null, 2);
            }
        } else serializedBeatSheet = String(beatSheet);
        finalPrompt += `\n\n## APPROVED BEAT SHEET:\n${serializedBeatSheet}\n\nNow write the scene.`;
    }
    const selectedModel = resolveModelForTask('', request.model);
    const temperature = rlhfFeedbackCount > 2 ? getRlhfBoostedTemperature(rlhfFeedbackCount, 0.5) : undefined;
    const stream = aiServiceManager.chatStream([{ role: 'user', content: finalPrompt }], undefined, {
        model: selectedModel,
        temperature,
        webSearch: false,
    });
    let finalContent = '';
    try {
        for await (const chunk of stream) { finalContent += chunk; yield chunk; }
        scriptDoc.content = sanitizeScreenplayContent(finalContent);
        scriptDoc.status = 'completed';
        await scriptDoc.save();
        if (request.bibleId) {
            const prevContent = (await Script.findOne({ bibleId: request.bibleId }).sort({ createdAt: -1 }).lean())?.content;
            addBackgroundTask('characterDiscovery', () => {
                const delta = getContentDelta(prevContent, finalContent);
                if (delta < 50) return Promise.resolve({ taskName: 'characterDiscovery', success: false, details: 'Skipped: content delta too low (<50%)' });
                return characterDiscoveryService.discoverAndSave(request.bibleId!, finalContent).then(count => ({
                    taskName: 'characterDiscovery',
                    success: true,
                    details: `Discovered/enriched ${count} characters`,
                }));
            });
            addBackgroundTask('characterSync', () =>
                castingDirectorService.syncCharactersFromScreenplay(request.bibleId!, finalContent).then(names => ({
                    taskName: 'characterSync',
                    success: true,
                    details: `Synced ${names.length} characters from screenplay`,
                }))
            );
            addBackgroundTask('plotSummary', async () => {
                try {
                    const currentBible = await Bible.findById(request.bibleId);
                    if (currentBible) {
                        await storyPlannerService.updateRecursiveSummary(currentBible as any);
                        return { taskName: 'plotSummary', success: true, details: 'Plot summary updated' };
                    }
                    return { taskName: 'plotSummary', success: false, error: 'Bible not found' };
                } catch (err: any) {
                    return { taskName: 'plotSummary', success: false, error: err.message };
                }
            });
            addBackgroundTask('stateExtraction', () =>
                stateManagerService.extractAndSaveState(finalContent, castContext).then(() => ({
                    taskName: 'stateExtraction',
                    success: true,
                    details: 'State extracted and saved',
                }))
            );
            addBackgroundTask('driftScan', () => {
                const charContext = castContext.map((c: any) => ({
                    name: c.name,
                    currentStatus: c.currentStatus,
                    heldItems: c.heldItems,
                }));
                const report = driftScannerService.scan(finalContent, charContext);
                return Promise.resolve({
                    taskName: 'driftScan',
                    success: !report.hasDrift,
                    details: report.hasDrift ? `${report.warningCount} drifts found` : 'No state drifts detected',
                });
            });
        }
    } catch (error) {
        scriptDoc.status = 'failed';
        await scriptDoc.save();
        throw error;
    }
}

export async function* generateAdvancedScript(request: ScriptRequest): AsyncGenerator<string, void, unknown> {
    const bible = request.bibleId ? await Bible.findById(request.bibleId) : null;
    if (bible) await storyPlannerService.ensureGlobalOutline(bible as any);
    let ownerId = request.userId || '000000000000000000000000';
    let targetLanguage = request.language;
    let transliteration = request.transliteration;
    if (bible) {
        if (!targetLanguage) targetLanguage = (bible as any).language;
        if (transliteration === undefined) transliteration = (bible as any).transliteration;
    }
    request.language = targetLanguage || 'English';
    request.transliteration = !!transliteration;
    const scriptDoc = new Script({
        userId: new mongoose.Types.ObjectId(ownerId),
        prompt: request.idea, format: request.format, style: request.style,
        language: request.language, status: 'generating',
        metadata: { genre: request.genre, tone: request.tone, bibleId: request.bibleId }
    });
    await scriptDoc.save();
    let castContext: any[] = [];
    if (request.characterIds?.length) {
        castContext = await Character.find({ _id: { $in: request.characterIds } }).lean();
    } else if (request.bibleId) {
        castContext = await Character.find({ bibleId: request.bibleId }).lean();
    }
    const characterMemoryText = stateManagerService.buildCharacterContext(castContext);
    let projectContextBlock = '';
    if (request.bibleId) {
        try {
            const projectCtx = await projectContextService.build(
                request.bibleId,
                request.sceneSequenceNumber,
                undefined
            );
            projectContextBlock = projectContextService.toPromptBlock(projectCtx);
        } catch (err) { /* ignore fallback */ }
    }

    // Compile RLHF Prompt Anchors with over-fitting prevention
    let rlhfAnchorsBlock = '';
    let rlhfFeedbackCount = 0;
    if (request.bibleId) {
        try {
            const feedbacks = await CharacterFeedback.find({ bibleId: request.bibleId })
                .sort({ createdAt: -1 })
                .limit(5)
                .lean();
            rlhfFeedbackCount = feedbacks.length;
            if (feedbacks.length > 0) {
                const now = Date.now();
                const agedFeedbacks = feedbacks.map((fb, idx) => {
                    const ageMinutes = fb.createdAt ? (now - new Date(fb.createdAt).getTime()) / 60000 : 0;
                    const recencyWeight = Math.max(0.3, 1 - ageMinutes / 10080);
                    return { ...fb, recencyWeight, originalIndex: idx };
                });
                const sorted = agedFeedbacks.sort((a, b) => b.recencyWeight - a.recencyWeight).slice(0, 3);
                rlhfAnchorsBlock = '\n\n## CRITICAL STYLE DIRECTIVES (RLHF ANCHORS)\n' +
                    'The writer has previously rejected certain casting, pacing, or dialogue choices. You MUST strictly adhere to these style anchors (weighted by recency):\n\n' +
                    sorted.map((fb) => {
                        const category = fb.category ? `[Category: ${fb.category.toUpperCase()}]` : '';
                        const context = fb.mistakeContext ? `\n   - Context of past mistake: "${fb.mistakeContext}"` : '';
                        const correction = fb.userCorrection ? `\n   - Strict instruction: "${fb.userCorrection}"` : '';
                        const recencyNote = fb.recencyWeight < 0.6 ? '\n   - Note: This is an older correction; apply with moderate weight.' : '';
                        return `${fb.originalIndex + 1}. ${category}${context}${correction}${recencyNote}`;
                    }).join('\n\n') + '\n';
            }
        } catch (fbErr) {
            console.error('[ScriptGenerator] Failed to fetch RLHF corrections:', fbErr);
        }
    }

    let finalPrompt = ULTIMATE_COHERENCE_PROMPT
        .replace('{{user_prompt}}', request.idea)
        .replace('{{global_outline}}', bible?.globalOutline?.join('\n') || '')
        .replace('{{story_so_far}}', bible?.storySoFar || '')
        .replace('{{character_memory}}', characterMemoryText || '')
        .replace('{{plot_state}}', request.previousContext || 'Starting build.');

    if (rlhfAnchorsBlock) finalPrompt += rlhfAnchorsBlock;
    if (request.sceneLocations?.length) {
        finalPrompt += `\n\n## SCENE LOCATIONS / SETTINGS TO INTEGRATE:\nUse these places as active scene headers or action line backdrops: ${request.sceneLocations.join(', ')}\n`;
    }
    if (request.genericExtras?.length) {
        finalPrompt += `\n\n## GENERIC BACKGROUND EXTRAS / MINOR ROLES TO INTEGRATE:\nIntegrate these minor actors naturally in action lines (e.g. OLD MAN 2, DRIVER 1). Do NOT treat them as speaking main casting: ${request.genericExtras.join(', ')}\n`;
    }
    if (bible && (bible as any).ignoredCharacterNames?.length) {
        finalPrompt += `\n\n## STAGE CONSTRAINTS / EXCLUSION DIRECTIVES:\nStrictly AVOID using the following names as characters or speaking heads. Do NOT write dialogue for them and do NOT introduce them into the scene: ${(bible as any).ignoredCharacterNames.join(', ')}\n`;
    }

    if (projectContextBlock) finalPrompt = `${projectContextBlock}\n\n${finalPrompt}`;
    const temperature = rlhfFeedbackCount > 2 ? getRlhfBoostedTemperature(rlhfFeedbackCount, 0.3) : undefined;
    const stream = aiServiceManager.chatStream([{ role: 'user', content: finalPrompt }], undefined, {
        model: resolveModelForTask('advanced', request.model),
        temperature,
        webSearch: false,
    });
    let alreadyYieldedLength = 0;
    let isYieldingScript = false;
    let fullResponse = '';
    try {
        for await (const chunk of stream) {
            fullResponse += chunk;
            if (!isYieldingScript && /<SCENE_SCRIPT>/i.test(fullResponse)) isYieldingScript = true;
            if (isYieldingScript) {
                const scriptMatch = fullResponse.match(/<SCENE_SCRIPT>\s*([\s\S]*)$/i);
                if (scriptMatch) {
                    const scriptText = scriptMatch[1];
                    const markerMatch = scriptText.match(/<(STORY_CONTEXT_SUMMARY|SCENE_PLAN|CHARACTER_MEMORY_UPDATE|PLOT_STATE_UPDATE|AGENT_EXPLANATION)>/i);
                    const safeTotalLength = markerMatch ? (markerMatch.index || 0) : Math.max(0, scriptText.length - 15);
                    const safeDelta = scriptText.slice(alreadyYieldedLength, safeTotalLength);
                    if (safeDelta) { 
                        yield sanitizeScreenplayContent(safeDelta); 
                        alreadyYieldedLength += safeDelta.length; 
                    }
                    if (markerMatch) isYieldingScript = false;
                }
            }
        }
        let extractedScript = '';
        const scriptMatch = fullResponse.match(/<SCENE_SCRIPT>\s*([\s\S]*?)(?:<(?:STORY_CONTEXT_SUMMARY|SCENE_PLAN|CHARACTER_MEMORY_UPDATE|PLOT_STATE_UPDATE|AGENT_EXPLANATION)>|$)/i);
        extractedScript = scriptMatch ? scriptMatch[1].trim() : fullResponse;
        extractedScript = sanitizeScreenplayContent(extractedScript);
        scriptDoc.content = extractedScript;
        scriptDoc.status = 'completed';
        await scriptDoc.save();
        if (request.bibleId) {
            const prevContent = (await Script.findOne({ bibleId: request.bibleId }).sort({ createdAt: -1 }).lean())?.content;
            addBackgroundTask('characterDiscovery', () => {
                const delta = getContentDelta(prevContent, extractedScript);
                if (delta < 50) return Promise.resolve({ taskName: 'characterDiscovery', success: false, details: 'Skipped: content delta too low (<50%)' });
                return characterDiscoveryService.discoverAndSave(request.bibleId!, extractedScript).then(count => ({
                    taskName: 'characterDiscovery',
                    success: true,
                    details: `Discovered/enriched ${count} characters`,
                }));
            });
            addBackgroundTask('characterSync', () =>
                castingDirectorService.syncCharactersFromScreenplay(request.bibleId!, extractedScript).then(names => ({
                    taskName: 'characterSync',
                    success: true,
                    details: `Synced ${names.length} characters from screenplay`,
                }))
            );
            addBackgroundTask('plotSummary', async () => {
                try {
                    const currentBible = await Bible.findById(request.bibleId);
                    if (currentBible) {
                        await storyPlannerService.updateRecursiveSummary(currentBible as any);
                        return { taskName: 'plotSummary', success: true, details: 'Plot summary updated' };
                    }
                    return { taskName: 'plotSummary', success: false, error: 'Bible not found' };
                } catch (err: any) {
                    return { taskName: 'plotSummary', success: false, error: err.message };
                }
            });
            addBackgroundTask('stateExtraction', () =>
                stateManagerService.extractAndSaveState(extractedScript, castContext).then(() => ({
                    taskName: 'stateExtraction',
                    success: true,
                    details: 'State extracted and saved',
                }))
            );
            addBackgroundTask('driftScan', () => {
                const charContext = castContext.map((c: any) => ({
                    name: c.name,
                    currentStatus: c.currentStatus,
                    heldItems: c.heldItems,
                }));
                const report = driftScannerService.scan(extractedScript, charContext);
                return Promise.resolve({
                    taskName: 'driftScan',
                    success: !report.hasDrift,
                    details: report.hasDrift ? `${report.warningCount} drifts found: ${report.characterDrifts.map(d => `${d.name}.${d.field}`).join(', ')}` : 'No state drifts detected',
                });
            });
        }
    } catch (error) {
        scriptDoc.status = 'failed';
        await scriptDoc.save();
        throw error;
    }
}
