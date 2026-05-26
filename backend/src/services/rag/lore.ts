import mongoose from 'mongoose';
import { LoreEntity } from '../../models/LoreEntity.js';
import { LoreRelation } from '../../models/LoreRelation.js';
import type { AssistantSceneContext, AssistantBibleContext } from './types.js';
import { toId } from './utils.js';

export async function buildLoreGraphContext(
    bibleId: string | undefined,
    scene: AssistantSceneContext | null | undefined,
    bible: AssistantBibleContext | null | undefined
): Promise<string> {
    if (!bibleId) return '';

    let characterIds = (scene?.charactersInvolved || []).map(id => toId(id)).filter(Boolean) as string[];

    if (characterIds.length === 0) {
        try {
            const allBibleChars = await mongoose.model('Character').find({ bibleId }).select('_id name').lean();
            const scanText = ((scene?.summary || '') + ' ' + (scene?.goal || '') + ' ' + (scene?.slugline || '')).toLowerCase();
            const matchedChars = allBibleChars.filter((c: any) => {
                if (!c.name) return false;
                const name = c.name.toLowerCase();
                const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                return new RegExp(`\\b${escaped}\\b`).test(scanText);
            });
            if (matchedChars.length > 0) {
                characterIds = matchedChars.map((c: any) => c._id.toString());
            } else {
                characterIds = allBibleChars.map((c: any) => c._id.toString());
            }
        } catch (err) {
            return '';
        }
    }

    if (characterIds.length === 0) return '';

    try {
        const resolvedCharacters = await mongoose.model('Character').find({
            _id: { $in: characterIds },
            name: { $ne: null, $exists: true }
        }).select('name').lean();
        const characterNames = resolvedCharacters.map((c: any) => (c.name || '').toUpperCase().trim()).filter(Boolean);

        if (characterNames.length === 0) return '';

        const loreEntities = await LoreEntity.find({
            bibleId,
            name: { $in: characterNames },
            type: 'character'
        }).select('_id name').lean();

        const entityIds = loreEntities.map(e => e._id);
        if (entityIds.length === 0) return '';

        const relations = await LoreRelation.find({
            bibleId,
            $or: [
                { sourceEntityId: { $in: entityIds } },
                { targetEntityId: { $in: entityIds } }
            ]
        })
            .populate('sourceEntityId', 'name')
            .populate('targetEntityId', 'name')
            .lean();

        if (relations.length === 0) return '';

        const activeRelationsBlock = relations.map((rel: any) => {
            const sourceName = rel.sourceEntityId?.name || 'UNKNOWN';
            const targetName = rel.targetEntityId?.name || 'UNKNOWN';
            const type = rel.relationshipType.replace(/_/g, ' ').toUpperCase();
            const desc = rel.description ? ` (${rel.description})` : '';
            return `- ${sourceName} is ${type} to ${targetName}${desc}`;
        }).join('\n');

        return `Strict Narrative Constraints & Character Relationships:\n${activeRelationsBlock}`;
    } catch (err) {
        if (process.env.NODE_ENV !== 'production') {
            console.warn('[AssistantRAG] Lore Relation lookup failed:', err);
        }
        return '';
    }
}
