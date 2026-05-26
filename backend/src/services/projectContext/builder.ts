import { Bible } from '../../models/Bible';
import { Scene } from '../../models/scene/index.js';
import { Character } from '../../models/Character';
import { LoreEntity } from '../../models/LoreEntity';
import { LoreRelation } from '../../models/LoreRelation';
import { ProjectContext } from './types.js';

export async function buildProjectContext(
    bibleId: string,
    currentSequenceNumber?: number,
    activeSceneContent?: string
): Promise<ProjectContext> {
    const sceneQuery: any = { bibleId };
    if (currentSequenceNumber) {
        sceneQuery.sequenceNumber = {
            $gte: Math.max(1, currentSequenceNumber - 75),
            $lte: currentSequenceNumber + 75
        };
    } else {
        sceneQuery.sequenceNumber = { $lte: 150 };
    }

    const [bible, scenes, characters, loreEntities, loreRelations] = await Promise.all([
        Bible.findById(bibleId).lean(),
        Scene.find(sceneQuery).sort({ sequenceNumber: 1 }).limit(150).maxTimeMS(2000).lean(),
        Character.find({ bibleId }).lean(),
        LoreEntity.find({ bibleId }).lean(),
        LoreRelation.find({ bibleId }).lean()
    ]);

    if (!bible) throw new Error('Project not found');

    const sceneCount = scenes.length;

    const scenesForContext = scenes.map((scene: any) => {
        const base: ProjectContext['scenes'][0] = {
            sequenceNumber: scene.sequenceNumber,
            title: scene.title,
            slugline: scene.slugline,
            summary: scene.summary || '',
            goal: scene.goal,
            status: scene.status
        };
        if (currentSequenceNumber) {
            const isInWindow = Math.abs(scene.sequenceNumber - currentSequenceNumber) <= 5;
            if (!isInWindow) base.summary = '';
        } else {
            if (sceneCount > 100 && scene.sequenceNumber > 100) base.summary = '';
        }
        return base;
    });

    const targetScene = scenes.find((s: any) => s.sequenceNumber === currentSequenceNumber);
    const scanText = (
        (activeSceneContent || '') + ' ' +
        (targetScene?.summary || '') + ' ' +
        (targetScene?.goal || '')
    ).toLowerCase();

    const activeCharIds = new Set(
        (targetScene?.charactersInvolved || []).map((id: any) => id.toString())
    );

    const charactersForContext = characters.map((char: any) => {
        const nameLower = char.name.toLowerCase();
        const isExplicitlyInvolved = activeCharIds.has(char._id.toString());
        const isActive = !currentSequenceNumber || isExplicitlyInvolved || scanText.includes(nameLower);
        return {
            name: char.name,
            role: char.role || 'supporting',
            description: isActive ? (char.description || char.voiceDescription || '').slice(0, 400) : '',
            motivation: isActive ? (char.motivation || '').slice(0, 300) : '',
            traits: isActive ? (char.traits || '').slice(0, 300) : ''
        };
    });

    const storyResources = ((bible as any).storyResources || []).map((r: any) => ({
        title: r.title || 'Untitled',
        type: r.type || 'notes',
        content: (r.content || '').slice(0, 4000)
    }));

    const activeScene = targetScene
        ? {
            sequenceNumber: targetScene.sequenceNumber,
            title: targetScene.title,
            slugline: targetScene.slugline || '',
            summary: targetScene.summary || '',
            goal: targetScene.goal || ''
        }
        : undefined;

    const entitiesForContext = (loreEntities || []).map((e: any) => ({
        name: String(e.name || '').toUpperCase(),
        type: e.type || 'character',
        description: (e.description || '').slice(0, 300)
    }));

    const relationsForContext = (loreRelations || []).map((r: any) => {
        const srcId = r.sourceEntityId?._id?.toString?.() || r.sourceEntityId?.toString?.() || '';
        const tgtId = r.targetEntityId?._id?.toString?.() || r.targetEntityId?.toString?.() || '';
        const src = srcId ? loreEntities.find((e: any) => e._id.toString() === srcId) : null;
        const tgt = tgtId ? loreEntities.find((e: any) => e._id.toString() === tgtId) : null;
        return {
            source: src ? String(src.name ?? '').toUpperCase() : 'Unknown',
            type: r.relationshipType,
            target: tgt ? String(tgt.name ?? '').toUpperCase() : 'Unknown',
            description: r.description || ''
        };
    }).filter(r => r.source !== 'Unknown' && r.target !== 'Unknown');

    return {
        activeScene,
        project: {
            title: bible.title,
            logline: bible.logline || '',
            genre: bible.genre || 'Drama',
            tone: bible.tone || '',
            language: bible.language || 'English',
            visualStyle: (bible as any).visualStyle,
            rules: (bible as any).rules || [],
            globalOutline: bible.globalOutline || [],
            storySoFar: (bible.storySoFar || 'The story is just beginning.').slice(0, 5000),
            transliteration: !!(bible as any).transliteration,
            targetSceneCount: (bible as any).targetSceneCount || 60
        },
        scenes: scenesForContext,
        characters: charactersForContext,
        storyResources,
        lore: { entities: entitiesForContext, relations: relationsForContext }
    };
}
