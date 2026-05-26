import mongoose from 'mongoose';
import { LoreEntity } from '../../models/LoreEntity.js';
import { LoreRelation } from '../../models/LoreRelation.js';

export async function buildLoreContextBlock(bibleId: string, characterIds: string[], scanText?: string): Promise<string> {
    let resolvedCharIds = characterIds;
    if (characterIds.length === 0) {
        const allBibleChars = await mongoose.model('Character').find({ bibleId }).select('_id name').lean();
        if (scanText) {
            const lowerScan = scanText.toLowerCase();
            const matchedChars = allBibleChars.filter((c: any) => {
                if (!c.name) return false;
                const name = c.name.toLowerCase();
                return new RegExp(`\\b${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`).test(lowerScan);
            });
            resolvedCharIds = matchedChars.length > 0 ? matchedChars.map((c: any) => c._id.toString()) : allBibleChars.map((c: any) => c._id.toString());
        } else {
            resolvedCharIds = allBibleChars.map((c: any) => c._id.toString());
        }
    }

    if (resolvedCharIds.length === 0) return '';

    const resolvedChars = await mongoose.model('Character').find({ _id: { $in: resolvedCharIds } }).select('name').lean();
    const charNames = resolvedChars.map((c: any) => c.name.toUpperCase().trim());
    if (charNames.length === 0) return '';

    const loreEntities = await LoreEntity.find({ bibleId, name: { $in: charNames }, type: 'character' }).select('_id name').lean();
    const entityIds = loreEntities.map(e => e._id);
    if (entityIds.length === 0) return '';

    const relations = await LoreRelation.find({
        bibleId,
        $or: [{ sourceEntityId: { $in: entityIds } }, { targetEntityId: { $in: entityIds } }]
    }).populate('sourceEntityId', 'name').populate('targetEntityId', 'name').lean();

    if (relations.length === 0) return '';

    const lines = relations.map((rel: any) => {
        const srcName = rel.sourceEntityId?.name || 'UNKNOWN';
        const tgtName = rel.targetEntityId?.name || 'UNKNOWN';
        const relType = rel.relationshipType.replace(/_/g, ' ').toUpperCase();
        return `- ${srcName} is ${relType} to ${tgtName}${rel.description ? ` (${rel.description})` : ''}`;
    });

    return `\nCharacter Relationships:\n${lines.join('\n')}`;
}
