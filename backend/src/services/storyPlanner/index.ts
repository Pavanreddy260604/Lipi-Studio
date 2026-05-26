import type { BeatSheetStructure, FullBeatSheetParams } from './types.js';
import { ensureGlobalOutline, updateRecursiveSummary, generateBlockBeatSheet, generateBeatSheet, generateFullBeatSheet } from './planner.js';
import { BEAT_SHEET_STRUCTURES } from './structures.js';

export class StoryPlannerService {
    public async ensureGlobalOutline(bible: any): Promise<void> {
        return ensureGlobalOutline(bible);
    }
    public async updateRecursiveSummary(bible: any): Promise<void> {
        return updateRecursiveSummary(bible);
    }
    public async generateBlockBeatSheet(bibleId: string, startScene: number, count?: number): Promise<any[]> {
        return generateBlockBeatSheet(bibleId, startScene, count);
    }
    public async generateBeatSheet(request: any, samples: any[], cast: any[]): Promise<any> {
        return generateBeatSheet(request, samples, cast);
    }
    public async *generateFullBeatSheet(params: FullBeatSheetParams): AsyncGenerator<string, void, unknown> {
        yield* generateFullBeatSheet(params);
    }
}

export const storyPlannerService = new StoryPlannerService();
export type { BeatSheetStructure, FullBeatSheetParams };
export { BEAT_SHEET_STRUCTURES };
