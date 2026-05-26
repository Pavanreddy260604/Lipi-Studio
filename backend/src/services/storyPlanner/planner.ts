import { Bible } from '../../models/Bible';
import { Scene } from '../../models/scene/index.js';
import mongoose from 'mongoose';
import { aiServiceManager } from '../aiManager/index.js';
import { projectContextService } from '../projectContext/index.js';
import { buildBeatSheetPrompt } from '../../prompts/hollywood/index.js';
import { JSONHelper } from '../parser/index.js';
import {
    MASTER_OUTLINE_PROMPT, RECURSIVE_SUMMARY_PROMPT,
    BLOCK_BEAT_SHEET_PROMPT, BEAT_SHEET_PROMPT,
    CORE_BEATS_OUTLINE_PROMPT, BLOCK_SKELETON_PROMPT
} from './prompts.js';
import { getActsDistribution, CORE_BEATS_COUNT, STRUCTURE_TO_STYLE } from './structures.js';
import type { BeatSheetStructure, FullBeatSheetParams } from './types.js';

export async function ensureGlobalOutline(bible: any): Promise<void> {
    const targetScale = Math.max(20, Math.floor((bible.targetSceneCount || 60) / 3));
    if (bible.globalOutline && bible.globalOutline.length >= targetScale) return;
    const prompt = MASTER_OUTLINE_PROMPT
        .replace('{{logline}}', bible.logline || bible.title)
        .replace('{{target_scale}}', targetScale.toString());
    try {
        if (process.env.NODE_ENV !== 'production') { console.log('[GlobalOutline] Generating for logline:', bible.logline || bible.title); }
        const response = await aiServiceManager.chat(prompt, { model: 'gemini-2.5-flash', format: 'json', webSearch: false });
        const cleanJson = response.replace(/```json/g, '').replace(/```/g, '').trim();
        let outline = JSONHelper.dirtyRepair(cleanJson);
        if (!Array.isArray(outline) && typeof outline === 'object') {
            outline = outline.beats || outline.story_arc || outline.master_story_arc || Object.values(outline)[0];
        }
        if (Array.isArray(outline)) {
            bible.globalOutline = outline;
            await bible.save();
            if (process.env.NODE_ENV !== 'production') { console.log('[StoryPlanner] Global Outline Generated for Bible:', bible._id); }
        }
    } catch (err) {
        console.error('[GlobalOutline] Failed to generate:', err);
    }
}

export async function updateRecursiveSummary(bible: any): Promise<void> {
    const recentScenes = await Scene.find({ bibleId: bible._id }).sort({ createdAt: -1 }).limit(5).lean();
    if (recentScenes.length === 0) return;
    const scenesText = recentScenes.reverse().map((s: any) => `### ${s.title}\n${s.content}`).join('\n\n');
    const prompt = RECURSIVE_SUMMARY_PROMPT.replace('{{recent_scenes}}', scenesText).replace('{{story_so_far}}', bible.storySoFar || 'The story is just beginning.');
    try {
        const newSummary = await aiServiceManager.chat(prompt, { model: 'balanced' });
        bible.storySoFar = newSummary.trim();
        await bible.save();
        if (process.env.NODE_ENV !== 'production') { console.log('[StoryPlanner] Story So Far updated recursive summary.'); }
    } catch (err) {
        console.error('[RecursiveSummary] Failed:', err);
    }
}

export async function generateBlockBeatSheet(bibleId: string, startScene: number, count: number = 10): Promise<any[]> {
    const bible = await Bible.findById(bibleId);
    if (!bible) throw new Error('Bible not found');
    const prompt = BLOCK_BEAT_SHEET_PROMPT
        .replace('{{story_so_far}}', bible.storySoFar || 'The story is just beginning.')
        .replace('{{global_outline}}', bible.globalOutline?.join('\n') || 'No global outline.')
        .replace(/{{start_scene}}/g, startScene.toString())
        .replace(/{{end_scene}}/g, (startScene + count - 1).toString());
    try {
        if (process.env.NODE_ENV !== 'production') { console.log(`[StoryPlanner] Planning Block: Scenes ${startScene}-${startScene + count - 1}`); }
        const response = await aiServiceManager.chat(prompt, { model: 'gemini-2.5-flash', format: 'json', webSearch: false });
        const cleanJson = response.replace(/```json/g, '').replace(/```/g, '').trim();
        let block = JSONHelper.dirtyRepair(cleanJson);
        if (!Array.isArray(block) && typeof block === 'object') block = block.scenes || block.beats || Object.values(block)[0];
        return Array.isArray(block) ? block : [];
    } catch (err) {
        console.error('[BlockBeatSheet] Failed:', err);
        return [];
    }
}

export async function generateBeatSheet(request: any, samples: any[], cast: any[]): Promise<any> {
    const bible = request.bibleId && mongoose.Types.ObjectId.isValid(request.bibleId)
        ? await Bible.findById(request.bibleId)
        : null;
    let prompt = BEAT_SHEET_PROMPT
        .replace('{{idea}}', request.idea)
        .replace('{{genre}}', request.genre || 'Drama')
        .replace('{{tone}}', request.tone || 'Neutral');
    if (bible) {
        prompt = prompt.replace('{{story_so_far}}', bible.storySoFar || 'The story is just beginning.');
        prompt = prompt.replace('{{global_outline}}', bible.globalOutline?.join('\n') || 'No global outline.');
        const storyResources = (bible as any).storyResources || [];
        if (storyResources.length > 0) {
            const resourcesStr = storyResources.map((r: any) =>
                `### SOURCE MATERIAL: ${r.title} (${r.type || 'notes'})\n${(r.content || '').slice(0, 4000)}`
            ).join('\n\n');
            prompt += `\n\n## SOURCE MATERIAL / STORY RESOURCES (CRITICAL REFERENCE):\n${resourcesStr}`;
        }
    } else {
        prompt = prompt.replace('{{story_so_far}}', 'Stand-alone scene.').replace('{{global_outline}}', 'None.');
    }
    try {
        const response = await aiServiceManager.chat(prompt, { model: 'gemini-2.5-flash', format: 'json', webSearch: false });
        const cleanJson = response.replace(/```json/g, '').replace(/```/g, '').trim();
        return JSONHelper.dirtyRepair(cleanJson);
    } catch (err) {
        console.error('[BeatSheet] Generation failed:', err);
        return null;
    }
}

export async function* generateFullBeatSheet(params: FullBeatSheetParams): AsyncGenerator<string, void, unknown> {
    const bible = await Bible.findById(params.bibleId);
    if (!bible) throw new Error('Project not found');

    const targetSceneCount = params.targetSceneCount || (bible as any).targetSceneCount || 60;
    const structureType = params.structureType || 'three_act';
    const styleName = STRUCTURE_TO_STYLE[structureType] || 'Three Act';

    yield `{\n  "acts": [\n`;

    const actsDistribution = getActsDistribution(structureType, targetSceneCount);
    const projectCtx = await projectContextService.build(params.bibleId);
    const castStr = projectCtx.characters.map(c => `- **${c.name.toUpperCase()}** (${c.role || 'supporting'}): ${c.motivation || ''}`).join('\n');
    const resourcesStr = projectCtx.storyResources && projectCtx.storyResources.length > 0
        ? projectCtx.storyResources.map(r => `### SOURCE MATERIAL / STORY RESOURCE: ${r.title} (${r.type || 'notes'})\n${r.content}`).join('\n\n')
        : '';

    const genre = projectCtx.project.genre || 'General';
    const tone = projectCtx.project.tone || 'Cinematic';
    const visualStyle = projectCtx.project.visualStyle || '';
    const rules = projectCtx.project.rules || [];
    const projectDirectives = [
        `Genre: ${genre}`, `Tone/Vibe: ${tone}`,
        visualStyle ? `Visual Style: ${visualStyle}` : '',
        rules.length > 0 ? `Strict Stylistic Rules:\n${rules.map((r: string) => `- ${r}`).join('\n')}` : ''
    ].filter(Boolean).join('\n');

    const coreBeatsCount = CORE_BEATS_COUNT[structureType] || 10;
    let outlinePrompt = CORE_BEATS_OUTLINE_PROMPT
        .replace('{{core_beats_count}}', coreBeatsCount.toString())
        .replace('{{structure_name}}', styleName)
        .replace('{{logline}}', bible.logline || bible.title);

    if (projectDirectives) outlinePrompt += `\n\n## PROJECT DIRECTIVES & CREATIVE CONTEXT:\n${projectDirectives}`;
    if (resourcesStr) outlinePrompt += `\n\n## SOURCE MATERIAL / STORY RESOURCES (CRITICAL REFERENCE):\n${resourcesStr}`;
    if (params.customInstructions?.trim()) outlinePrompt += `\n\n## CUSTOM CREATIVE DIRECTION / INSTRUCTIONS (MANDATORY):\n${params.customInstructions.trim()}`;

    let coreBeats: any[] = [];
    try {
        const response = await aiServiceManager.chat(outlinePrompt, { model: 'gemini-2.5-flash', format: 'json', webSearch: false });
        const extracted = JSONHelper.extractJson(response);
        const parsed = JSONHelper.dirtyRepair(extracted);
        coreBeats = Array.isArray(parsed) ? parsed : (parsed.beats || parsed.milestones || []);
    } catch (err) {
        console.error('[StoryPlanner] Phase 1 failed, generating simple fallback core beats:', err);
        coreBeats = actsDistribution.map((act: { name: string; sceneCount: number }) => ({
            name: act.name,
            description: `A dramatic segment comprising approximately ${Math.round((act.sceneCount / targetSceneCount) * 100)}% of the story.`
        }));
    }

    let actIndex = 0;
    for (const beat of coreBeats) {
        const scenesInAct = actsDistribution[actIndex]?.sceneCount ?? Math.round(targetSceneCount / actsDistribution.length);
        const startScene = actIndex === 0 ? 1 : actsDistribution.slice(0, actIndex).reduce((s, a) => s + a.sceneCount, 0) + 1;
        const endScene = Math.min(startScene + scenesInAct - 1, targetSceneCount);

        if (actIndex > 0) yield `,\n`;
        yield `    {\n      "name": "${beat.name}",\n      "beats": [\n`;

        const blockScenes = await generateBlockBeatSheet(params.bibleId, startScene, scenesInAct);
        for (let i = 0; i < blockScenes.length; i++) {
            if (i > 0) yield `,\n`;
            yield `        ${JSON.stringify(blockScenes[i])}`;
        }

        yield `\n      ]\n    }`;
        actIndex++;
    }

    yield `\n  ]\n}`;
}
