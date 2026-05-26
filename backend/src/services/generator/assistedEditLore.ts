import mongoose from 'mongoose';
import { LoreEntity } from '../../models/LoreEntity.js';
import { LoreRelation } from '../../models/LoreRelation.js';

export async function executeQueryLoreAndRelationships(bibleId: string, entityName: string, relationshipType?: string): Promise<string> {
    try {
        const nameUpper = entityName.toUpperCase().trim();
        const bibleIdObj = new mongoose.Types.ObjectId(bibleId);
        const entity = await LoreEntity.findOne({ bibleId: bibleIdObj, name: nameUpper }).lean();
        if (!entity) return `Lore entity "${entityName}" not found in this show bible.`;
        const query: any = { bibleId: bibleIdObj, $or: [{ sourceEntityId: entity._id }, { targetEntityId: entity._id }] };
        if (relationshipType && relationshipType !== 'any') query.relationshipType = relationshipType;
        const relations = await LoreRelation.find(query).populate('sourceEntityId', 'name type').populate('targetEntityId', 'name type').lean();
        if (relations.length === 0) return `Lore Entity: ${entity.name} (${entity.type.toUpperCase()})\nDescription: ${entity.description || 'No description'}\nRelationships: No active relationships recorded.`;
        const relationsMarkdown = relations.map((rel: any) => {
            const srcName = rel.sourceEntityId?.name || 'UNKNOWN';
            const tgtName = rel.targetEntityId?.name || 'UNKNOWN';
            return `- ${srcName} is ${rel.relationshipType.replace(/_/g, ' ').toUpperCase()} to ${tgtName}${rel.description ? ` (${rel.description})` : ''}`;
        }).join('\n');
        return `Lore Entity: ${entity.name} (${entity.type.toUpperCase()})\nDescription: ${entity.description || 'No description'}\n\nRelationships:\n${relationsMarkdown}`;
    } catch (err: any) { return `Error executing relationship query: ${err.message}`; }
}
