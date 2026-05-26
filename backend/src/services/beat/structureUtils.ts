import { STRUCTURE_ACTS } from './prompts.js';

export interface ActDistribution {
    name: string;
    sceneCount: number;
}

export function getActsDistribution(structureType: string, targetSceneCount: number): ActDistribution[] {
    const actsConfig = STRUCTURE_ACTS[structureType] || STRUCTURE_ACTS.three_act;
    let remainingScenes = targetSceneCount;
    const acts: ActDistribution[] = [];

    for (let i = 0; i < actsConfig.length; i++) {
        const config = actsConfig[i];
        let count = Math.round(targetSceneCount * config.percentage);
        if (i === actsConfig.length - 1) {
            count = remainingScenes;
        }
        count = Math.max(1, count);
        remainingScenes -= count;

        acts.push({
            name: config.name,
            sceneCount: count
        });
    }
    return acts;
}

export function getActIndexForScene(index: number, actsDistribution: ActDistribution[]): number {
    let runningSum = 0;
    for (let a = 0; a < actsDistribution.length; a++) {
        runningSum += actsDistribution[a].sceneCount;
        if (index <= runningSum) return a;
    }
    return actsDistribution.length - 1;
}
