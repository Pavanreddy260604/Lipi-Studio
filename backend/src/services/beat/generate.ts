import { aiServiceManager } from '../aiManager/index.js';
import { JSONHelper } from '../parser/jsonHelper.js';
import { BLOCK_SKELETON_PROMPT, STRUCTURE_TO_STYLE } from './prompts.js';
import { getActsDistribution, getActIndexForScene } from './structureUtils.js';
import { buildProjectContext, generateCoreBeatsOutline, buildBlockConstants, saveTreatment } from './outlineHelpers.js';
import { GenerateOutlineParams } from './types.js';

function buildPreviouslyPlanned(scenes: any[]): string {
    if (scenes.length === 0) return 'No scenes planned yet. This is the very beginning of the story.';
    return scenes.slice(-50).map(s => {
        const cleanTitle = (s.title || '').replace(/[\n\r"{}]/g, '').trim().slice(0, 100);
        const cleanSlug = (s.slugline || '').replace(/[\n\r"{}]/g, '').trim().slice(0, 80);
        const cleanGoal = (s.goal || '').replace(/[\n\r"{}]/g, '').trim().slice(0, 150);
        return `- Scene ${s.number}: ${cleanTitle} (${cleanSlug}) -> Goal: ${cleanGoal}`;
    }).join('\n');
}

function buildFallbackScene(_title: string, milestoneName: string, idx: number) {
    return {
        title: `${milestoneName} - Scene ${idx}`,
        slugline: `INT. ${milestoneName.toUpperCase().replace(/[^A-Z]/g, ' ').trim().replace(/\s+/g, '_') || 'LOCATION'}_${idx} - DAY`,
        goal: `Develop and resolve key elements of the "${milestoneName}" beat.`,
        description: `A scene driving the story forward during the ${milestoneName} phase.`
    };
}

export async function* generateOutlineGraph(params: GenerateOutlineParams): AsyncGenerator<string, void, unknown> {
    const { bibleId, logline, structureType, sceneCount, customInstructions, cast } = params;
    const targetSceneCount = Number(sceneCount || 60);
    const frameworkKey = STRUCTURE_TO_STYLE[structureType] ? structureType : 'three_act';
    const styleName = STRUCTURE_TO_STYLE[frameworkKey];
    const actsDistribution = getActsDistribution(frameworkKey, targetSceneCount);

    yield `{\n  "acts": [\n`;

    const { castStr, resourcesStr, projectDirectives } = await buildProjectContext(bibleId, cast || []);
    const coreBeats = await generateCoreBeatsOutline(logline, frameworkKey, styleName, projectDirectives, resourcesStr, customInstructions);

    const blockSize = targetSceneCount > 60 ? 25 : 20;
    const totalBlocks = Math.ceil(targetSceneCount / blockSize);
    const runningScenes: any[] = [];
    const blockConstants = buildBlockConstants(projectDirectives, resourcesStr, customInstructions);

    if (process.env.NODE_ENV !== 'production') {
        console.log(`[BeatOrchestrator] Sequential scene generation: ${targetSceneCount} scenes in ${totalBlocks} blocks (block size: ${blockSize})...`);
    }

    let currentActIndex = -1;
    let sceneIndex = 1;

    for (let blockIndex = 0; blockIndex < totalBlocks; blockIndex++) {
        const startScene = blockIndex * blockSize + 1;
        const endScene = Math.min(targetSceneCount, startScene + blockSize - 1);

        const milestoneIndexStart = Math.min(coreBeats.length - 1, Math.floor((startScene - 1) / targetSceneCount * coreBeats.length));
        const milestoneIndexEnd = Math.min(coreBeats.length - 1, Math.max(milestoneIndexStart, Math.floor((endScene - 1) / targetSceneCount * coreBeats.length)));
        let milestonesArray = coreBeats.slice(milestoneIndexStart, milestoneIndexEnd + 1);
        if (milestonesArray.length === 0 && coreBeats.length > 0) {
            milestonesArray = [coreBeats[Math.min(coreBeats.length - 1, milestoneIndexStart)]];
        }
        const activeMilestones = milestonesArray
            .map((mb, i) => `${milestoneIndexStart + i + 1}. **${mb.name}**: ${mb.description}`)
            .join('\n');

        const previouslyPlanned = buildPreviouslyPlanned(runningScenes);

        let blockPrompt = BLOCK_SKELETON_PROMPT
            .replace(/{{start_scene}}/g, startScene.toString())
            .replace(/{{end_scene}}/g, endScene.toString())
            .replace(/{{total_scenes}}/g, targetSceneCount.toString())
            .replace('{{active_milestones}}', activeMilestones)
            .replace('{{logline}}', logline)
            .replace('{{cast}}', castStr || 'No cast defined yet.')
            .replace('{{previously_planned_scenes}}', previouslyPlanned);

        blockPrompt += blockConstants;

        if (process.env.NODE_ENV !== 'production') {
            console.log(`[BeatOrchestrator] Block ${blockIndex + 1}/${totalBlocks} (Scenes ${startScene}-${endScene})`);
        }

        let blockScenes: any[] = [];
        try {
            const response = await aiServiceManager.chat(blockPrompt, {
                model: process.env.BEAT_ORCHESTRATOR_MODEL || 'balanced',
                format: 'json',
                webSearch: process.env.BEAT_ORCHESTRATOR_WEB_SEARCH === 'true'
            });
            const extracted = JSONHelper.extractJson(response);
            const parsed = JSONHelper.dirtyRepair(extracted);
            blockScenes = Array.isArray(parsed) ? parsed : (parsed.scenes || parsed.beats || []);
        } catch (err) {
            console.error(`[BeatOrchestrator] Block ${blockIndex + 1} generation failed, using fallback:`, err);
            // If the first block fails, let's propagate the error so the user doesn't get a completely broken outline
            if (blockIndex === 0) {
                throw err;
            }
            const milestoneName = coreBeats[milestoneIndexStart]?.name || 'Narrative Dev';
            for (let idx = startScene; idx <= endScene; idx++) {
                blockScenes.push(buildFallbackScene(`${milestoneName} - Scene ${idx}`, milestoneName, idx));
            }
        }

        for (let i = 0; i < blockScenes.length; i++) {
            const scene = blockScenes[i];
            const activeActIndex = getActIndexForScene(sceneIndex, actsDistribution);

            if (activeActIndex !== currentActIndex) {
                if (currentActIndex !== -1) yield `\n      ]\n    },\n`;
                currentActIndex = activeActIndex;
                yield `    {\n      "name": ${JSON.stringify(actsDistribution[currentActIndex].name)},\n      "beats": [\n`;
            } else if (sceneIndex > 1) {
                yield `,\n`;
            }

            const beatPayload = {
                name: `Scene ${sceneIndex}`,
                title: scene.title || `Dramatic Beat ${sceneIndex}`,
                slugline: scene.slugline || `INT. LOCATION - DAY`,
                description: scene.description || scene.summary || `Scene continuing key developments.`,
                goal: scene.goal || `Execute beat: Scene ${sceneIndex}`
            };

            runningScenes.push({
                number: sceneIndex,
                name: beatPayload.name,
                title: beatPayload.title,
                slugline: beatPayload.slugline,
                description: beatPayload.description,
                goal: beatPayload.goal
            });

            const json = JSON.stringify(beatPayload, null, 8);
            yield `        ${json.split('\n').map((l, index) => index === 0 ? l : '        ' + l).join('\n').trim()}`;
            sceneIndex++;
        }
    }

    if (currentActIndex !== -1) yield `\n      ]\n    }\n`;
    yield `  ]\n}`;

    await saveTreatment(bibleId, logline, structureType, runningScenes, actsDistribution);
}
