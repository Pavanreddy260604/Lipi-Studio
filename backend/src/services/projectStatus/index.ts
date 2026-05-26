import { Bible } from '../../models/Bible';
import { Character } from '../../models/Character';
import { Scene } from '../../models/scene/index.js';
import { ScriptSnapshot } from '../../models/ScriptSnapshot';
import { Treatment } from '../../models/Treatment';
import { buildProjectStatusSummary } from './builder.js';
import type { ProjectStatusBuildInput, ProjectStatusSummary, StatusProjectInput, StatusSceneInput } from './types.js';

export class ProjectStatusService {
    async getProjectStatus(bibleId: string, userId?: string): Promise<ProjectStatusSummary> {
        const project = await Bible.findOne({ _id: bibleId, userId }).lean();
        if (!project) {
            throw new Error('ACCESS_DENIED');
        }

        const [scenes, characterCount, treatmentCount, snapshotCount, latestSnapshot, branches] = await Promise.all([
            Scene.find({ bibleId }).sort({ sequenceNumber: 1 }).lean(),
            Character.countDocuments({ bibleId }),
            Treatment.countDocuments({ bibleId }),
            ScriptSnapshot.countDocuments({ bibleId }),
            ScriptSnapshot.findOne({ bibleId }).sort({ createdAt: -1 }).select('createdAt').lean(),
            ScriptSnapshot.distinct('branch', { bibleId }),
        ]);

        return buildProjectStatusSummary({
            project: project as StatusProjectInput,
            scenes: scenes as StatusSceneInput[],
            characterCount,
            treatmentCount,
            snapshotCount,
            latestSnapshotAt: latestSnapshot?.createdAt || null,
            branches,
        });
    }
}

export const projectStatusService = new ProjectStatusService();

export { buildProjectStatusSummary } from './builder.js';
export type {
    ProjectStatusSummary, ProjectStatusBuildInput,
    StatusSceneInput, StatusProjectInput, SceneStatus, NextActionPriority
} from './types.js';
