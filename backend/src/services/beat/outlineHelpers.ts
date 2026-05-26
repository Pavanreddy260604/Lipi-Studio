import mongoose from 'mongoose';
import { Treatment } from '../../models/Treatment.js';
import { projectContextService } from '../projectContext/index.js';
import { aiServiceManager } from '../aiManager/index.js';
import { JSONHelper } from '../parser/jsonHelper.js';
import { CORE_BEATS_COUNT, CORE_BEATS_OUTLINE_PROMPT, STRUCTURE_TO_STYLE } from './prompts.js';
import { getActsDistribution, getActIndexForScene } from './structureUtils.js';

export async function buildProjectContext(bibleId: string, cast: any[]) {
    const projectCtx = await projectContextService.build(bibleId);

    const mergedCastMap = new Map<string, any>();
    projectCtx.characters.forEach((c: any) => {
        if (c && c.name) mergedCastMap.set(c.name.toLowerCase(), c);
    });
    if (Array.isArray(cast)) {
        cast.forEach((c: any) => {
            if (c && c.name) {
                const existing = mergedCastMap.get(c.name.toLowerCase());
                mergedCastMap.set(c.name.toLowerCase(), {
                    name: c.name,
                    role: c.role || existing?.role || 'supporting',
                    motivation: c.motivation || existing?.motivation || '',
                    traits: c.traits || existing?.traits || ''
                });
            }
        });
    }
    const mergedCast = Array.from(mergedCastMap.values());
    const castStr = mergedCast.map(c => `- **${c.name.toUpperCase()}** (${c.role || 'supporting'}): ${c.motivation || ''}`).join('\n');
    const resourcesStr = projectCtx.storyResources && projectCtx.storyResources.length > 0
        ? projectCtx.storyResources.map(r => `### SOURCE MATERIAL / STORY RESOURCE: ${r.title} (${r.type || 'notes'})\n${r.content}`).join('\n\n')
        : '';

    const genre = projectCtx.project.genre || 'General';
    const tone = projectCtx.project.tone || 'Cinematic';
    const visualStyle = projectCtx.project.visualStyle || '';
    const rules = projectCtx.project.rules || [];

    const projectDirectives = [
        `Genre: ${genre}`,
        `Tone/Vibe: ${tone}`,
        visualStyle ? `Visual Style: ${visualStyle}` : '',
        rules.length > 0 ? `Strict Stylistic Rules:\n${rules.map((r: string) => `- ${r}`).join('\n')}` : ''
    ].filter(Boolean).join('\n');

    return { castStr, resourcesStr, projectDirectives };
}

export async function generateCoreBeatsOutline(
    logline: string,
    frameworkKey: string,
    styleName: string,
    projectDirectives: string,
    resourcesStr: string,
    customInstructions: string | undefined
): Promise<any[]> {
    const coreBeatsCount = CORE_BEATS_COUNT[frameworkKey] || 10;
    let outlinePrompt = CORE_BEATS_OUTLINE_PROMPT
        .replace('{{core_beats_count}}', coreBeatsCount.toString())
        .replace('{{structure_name}}', styleName)
        .replace('{{logline}}', logline);

    if (projectDirectives) {
        outlinePrompt += `\n\n## PROJECT DIRECTIVES & CREATIVE CONTEXT:\n${projectDirectives}`;
    }
    if (resourcesStr) {
        outlinePrompt += `\n\n## SOURCE MATERIAL / STORY RESOURCES (CRITICAL REFERENCE):\n${resourcesStr}`;
    }
    if (customInstructions?.trim()) {
        outlinePrompt += `\n\n## CUSTOM CREATIVE DIRECTION / INSTRUCTIONS (MANDATORY):\n${customInstructions.trim()}`;
    }

    if (process.env.NODE_ENV !== 'production') {
        console.log(`[BeatOrchestrator] Generating core beats outline (${coreBeatsCount} beats) for style: ${styleName}`);
    }

    let coreBeats: any[] = [];
    try {
        const response = await aiServiceManager.chat(outlinePrompt, {
            model: 'thinking',
            format: 'json',
            webSearch: false
        });
        const extracted = JSONHelper.extractJson(response);
        const parsed = JSONHelper.dirtyRepair(extracted);
        coreBeats = Array.isArray(parsed) ? parsed : (parsed.beats || parsed.milestones || []);
    } catch (err) {
        console.error('[BeatOrchestrator] Core beats generation failed, using fallback:', err);
    }

    if (coreBeats.length === 0) {
        const acts = getActsDistribution(frameworkKey, coreBeatsCount);
        coreBeats = acts.map(act => ({
            name: act.name,
            description: `Focus on expanding the dramatic conflict for the ${act.name} segment.`
        }));
    }
    return coreBeats;
}

export function buildBlockConstants(projectDirectives: string, resourcesStr: string, customInstructions: string | undefined): string {
    let bc = '';
    if (projectDirectives) bc += `\n\n## PROJECT DIRECTIVES & CREATIVE CONTEXT:\n${projectDirectives}`;
    if (resourcesStr) bc += `\n\n## SOURCE MATERIAL / STORY RESOURCES (CRITICAL REFERENCE):\n${resourcesStr}`;
    if (customInstructions?.trim()) bc += `\n\n## CUSTOM CREATIVE DIRECTION / INSTRUCTIONS (MANDATORY):\n${customInstructions.trim()}`;
    return bc;
}

export async function saveTreatment(bibleId: string, logline: string, structureType: string, runningScenes: any[], actsDistribution: any[]) {
    const structuredActs: any[] = actsDistribution.map(act => ({ name: act.name, beats: [] }));
    for (let i = 0; i < runningScenes.length; i++) {
        const scene = runningScenes[i];
        const actIndex = getActIndexForScene(scene.number, actsDistribution);
        structuredActs[actIndex].beats.push({
            name: scene.name, title: scene.title, slugline: scene.slugline,
            description: scene.description, goal: scene.goal
        });
    }
    const finalActs = structuredActs.filter(act => act.beats.length > 0);

    await Treatment.findOneAndUpdate(
        { bibleId: new mongoose.Types.ObjectId(bibleId) },
        { logline, style: structureType, acts: finalActs },
        { upsert: true, new: true }
    );
}
