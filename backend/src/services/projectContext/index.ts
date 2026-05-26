import type { ActiveSceneBrief, ProjectContext } from './types.js';
import { buildProjectContext } from './builder.js';
import { buildMandatorySceneBrief, toPromptBlock } from './prompts.js';

class ProjectContextService {
    async build(bibleId: string, currentSequenceNumber?: number, activeSceneContent?: string): Promise<ProjectContext> {
        return buildProjectContext(bibleId, currentSequenceNumber, activeSceneContent);
    }

    toPromptBlock(ctx: ProjectContext): string {
        return toPromptBlock(ctx);
    }
}

export const projectContextService = new ProjectContextService();
export { buildMandatorySceneBrief };
export type { ProjectContext, ActiveSceneBrief };
