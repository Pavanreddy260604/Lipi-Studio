import { Scene } from '../../models/scene/index.js';
import { redisCache } from '../redisCache.service.js';
import type { BuildAssistantReferencePackParams, AssistantReference } from './types.js';
import { toId, truncateText } from './utils.js';

export async function buildRecentContinuityReferences(
    params: BuildAssistantReferencePackParams
): Promise<AssistantReference[]> {
    const bibleId = toId(params.bible?._id);
    if (!bibleId) return [];

    const currentSceneId = toId(params.scene?._id);
    const currentSequence = params.scene?.sequenceNumber;
    const filter: Record<string, unknown> = { bibleId };

    if (currentSceneId) filter._id = { $ne: currentSceneId };
    if (currentSequence && currentSequence > 1) filter.sequenceNumber = { $lt: currentSequence };

    interface RecentScene {
        _id: unknown;
        sequenceNumber?: number;
        slugline?: string;
        summary?: string;
        content?: string;
        updatedAt?: Date;
        status?: string;
    }

    const sceneCacheKey = `rag:recent_scenes:${bibleId}:${currentSequence || 'latest'}`;
    let recentScenes = await redisCache.get<RecentScene[]>(sceneCacheKey);
    if (!recentScenes) {
        recentScenes = await Scene.find(filter)
            .select('sequenceNumber slugline summary content updatedAt status')
            .sort(currentSequence ? { sequenceNumber: -1 } : { updatedAt: -1 })
            .limit(12)
            .lean() as unknown as RecentScene[];
        await redisCache.set(sceneCacheKey, recentScenes, 30);
    }

    return recentScenes
        .map((scene, index) => {
            const excerpt = truncateText(scene.summary || scene.content, 260);
            if (!excerpt) return null;
            return {
                group: 'recent_continuity' as const,
                sourceFamily: 'recent' as const,
                label: `Scene ${scene.sequenceNumber}: ${scene.slugline}`,
                excerpt,
                score: Number((0.88 - index * 0.06).toFixed(4))
            };
        })
        .filter(Boolean) as AssistantReference[];
}
