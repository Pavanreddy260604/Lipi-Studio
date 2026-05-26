import type { ProjectStatusBuildInput, ProjectStatusSummary, StatusSceneInput, SceneStatus } from './types.js';
import { toId, toIso, countWords, calculateProgress, critiqueIsStale, uniqueBranches } from './helpers.js';

export function buildProjectStatusSummary(input: ProjectStatusBuildInput): ProjectStatusSummary {
    const projectId = toId(input.project._id);
    const targetSceneCount = Math.max(1, Number(input.project.targetSceneCount || 60));
    const scenes = input.scenes || [];
    const statusCounts = scenes.reduce<Record<SceneStatus, number>>((acc, scene) => {
        const status = scene.status || 'planned';
        acc[status] = (acc[status] || 0) + 1;
        return acc;
    }, { planned: 0, drafted: 0, reviewed: 0, final: 0 });

    const contentScenes = scenes.filter(scene => Boolean((scene.content || '').trim()));
    const emptyScenes = scenes.length - contentScenes.length;
    const scenesWithSummary = scenes.filter(scene => Boolean((scene.summary || '').trim())).length;
    const wordCount = scenes.reduce((sum, scene) => sum + countWords(scene.content || ''), 0);
    const latestSceneUpdatedAt = scenes
        .map(scene => toIso(scene.updatedAt))
        .filter((value): value is string => Boolean(value))
        .sort()
        .at(-1);

    const scoredScenes = scenes
        .map(scene => scene.critique?.score)
        .filter((score): score is number => typeof score === 'number' && Number.isFinite(score));
    const staleCritiqueScenes = scenes.filter(critiqueIsStale);
    const highScores = scenes
        .map(scene => scene.highScore?.critique?.score)
        .filter((score): score is number => typeof score === 'number' && Number.isFinite(score));
    const scenesNeedingReview = scenes
        .filter(scene => (scene.content || '').trim() && (!scene.critique || critiqueIsStale(scene)))
        .map(scene => toId(scene._id));

    const assistantMessages = scenes.flatMap(scene => scene.assistantChatHistory || []);
    const lastAssistantActivityAt = assistantMessages
        .map(message => toIso(message.timestamp))
        .filter((value): value is string => Boolean(value))
        .sort()
        .at(-1);

    const readinessBlockers: string[] = [];
    const hasLogline = Boolean((input.project.logline || '').trim());
    const hasScenes = scenes.length > 0;
    const hasDraftedContent = contentScenes.length > 0;
    const hasCharacters = input.characterCount > 0;
    const hasStoryResources = (input.project.storyResources || []).length > 0;
    const hasTreatment = input.treatmentCount > 0;

    if (!hasLogline) readinessBlockers.push('Add a logline so generation has a story spine.');
    if (!hasScenes) readinessBlockers.push('Create or sync scenes into the project.');
    if (hasScenes && scenesWithSummary < scenes.length) readinessBlockers.push('Fill missing scene summaries before batch generation.');
    if (!hasDraftedContent) readinessBlockers.push('Draft at least one scene.');

    const readinessSignals = [hasLogline, hasScenes, hasDraftedContent, hasCharacters, hasStoryResources, hasTreatment];
    const readyScore = Math.round((readinessSignals.filter(Boolean).length / readinessSignals.length) * 100);

    const exportBlockers = hasDraftedContent ? [] : ['Add at least one drafted scene before exporting.'];
    const nextActions: ProjectStatusSummary['nextActions'] = [];

    if (!hasLogline) {
        nextActions.push({
            id: 'add-logline',
            label: 'Add project logline',
            priority: 'high',
            reason: 'The backend cannot provide strong generation context without a logline.',
        });
    } else if (!hasScenes) {
        nextActions.push({
            id: 'create-scenes',
            label: 'Create the first scene list',
            priority: 'high',
            reason: 'The project needs planned scenes before drafting can begin.',
        });
    } else if (!hasDraftedContent) {
        nextActions.push({
            id: 'draft-first-scene',
            label: 'Generate or write the first scene',
            priority: 'high',
            reason: 'No scene has screenplay content yet.',
        });
    } else if (staleCritiqueScenes.length > 0) {
        nextActions.push({
            id: 'review-stale-critiques',
            label: 'Refresh stale critiques',
            priority: 'medium',
            reason: `${staleCritiqueScenes.length} reviewed scene${staleCritiqueScenes.length === 1 ? ' has' : 's have'} changed since critique.`,
        });
    } else if (input.snapshotCount === 0) {
        nextActions.push({
            id: 'save-first-snapshot',
            label: 'Save the first script snapshot',
            priority: 'medium',
            reason: 'Snapshots make larger AI edits recoverable.',
        });
    } else {
        nextActions.push({
            id: 'export-script',
            label: 'Export the current draft',
            priority: 'low',
            reason: 'The project has drafted content and can be exported.',
        });
    }

    const latestSnapshotIso = toIso(input.latestSnapshotAt);
    const syncParts = [
        projectId,
        toIso(input.project.updatedAt) || '',
        latestSceneUpdatedAt || '',
        latestSnapshotIso || '',
        scenes.length,
        wordCount,
        input.snapshotCount,
    ];

    return {
        project: {
            id: projectId,
            title: input.project.title || 'Untitled Project',
            genre: input.project.genre,
            tone: input.project.tone,
            language: input.project.language,
            targetSceneCount,
            createdAt: toIso(input.project.createdAt),
            updatedAt: toIso(input.project.updatedAt),
        },
        readiness: {
            hasLogline,
            hasScenes,
            hasDraftedContent,
            hasCharacters,
            hasStoryResources,
            hasTreatment,
            readyScore,
            blockers: readinessBlockers,
        },
        pipeline: {
            totalScenes: scenes.length,
            plannedScenes: statusCounts.planned,
            draftedScenes: statusCounts.drafted,
            reviewedScenes: statusCounts.reviewed,
            finalScenes: statusCounts.final,
            emptyScenes,
            scenesWithSummary,
            wordCount,
            latestSceneUpdatedAt,
            progressPercent: calculateProgress(scenes.length, targetSceneCount),
        },
        quality: {
            reviewedScenes: scoredScenes.length,
            staleCritiqueScenes: staleCritiqueScenes.length,
            averageScore: scoredScenes.length > 0
                ? Math.round(scoredScenes.reduce((sum, score) => sum + score, 0) / scoredScenes.length)
                : null,
            bestScore: highScores.length > 0 ? Math.max(...highScores) : (scoredScenes.length > 0 ? Math.max(...scoredScenes) : null),
            scenesNeedingReview,
        },
        assistant: {
            totalMessages: assistantMessages.length,
            pendingProposals: assistantMessages.filter(message => message.type === 'proposal' && message.status === 'pending').length,
            lastActivityAt: lastAssistantActivityAt,
        },
        snapshots: {
            count: input.snapshotCount,
            branches: uniqueBranches(input.branches),
            latestSnapshotAt: latestSnapshotIso,
        },
        export: {
            ready: exportBlockers.length === 0,
            formats: exportBlockers.length === 0 ? ['fountain', 'txt', 'json', 'pdf'] : [],
            blockers: exportBlockers,
        },
        nextActions,
        syncToken: syncParts.join(':'),
        generatedAt: new Date().toISOString(),
    };
}
