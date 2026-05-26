import mongoose from 'mongoose';
import { Character, ICharacter } from '../models/Character';
import { LoreEntity } from '../models/LoreEntity';
import { LoreRelation } from '../models/LoreRelation';
import { aiServiceManager } from './aiManager/index.js';
import { JSONHelper } from './parser/jsonHelper.js';

const RELATIONSHIP_CACHE = new Map<string, 'sibling_of' | 'hates' | 'allied_with' | 'parent_of' | 'owns' | 'member_of' | 'other'>();

export function classifyRelationshipWithAI(dynamicText: string): Promise<'sibling_of' | 'hates' | 'allied_with' | 'parent_of' | 'owns' | 'member_of' | 'other'> {
    const cacheKey = dynamicText.toLowerCase().trim();
    const cached = RELATIONSHIP_CACHE.get(cacheKey);
    if (cached) return Promise.resolve(cached);

    const prompt = `Classify this character relationship into exactly one type.
Dynamic: "${dynamicText}"

Options:
- hates: rivalry, enmity, revenge, resentment, opposition
- allied_with: friendship, loyalty, love, trust, partnership, alliance
- sibling_of: brother, sister, sibling bond
- parent_of: father, mother, parental, mentor, guardian
- owns: ownership, master, boss, leader, commander
- member_of: organization member, belonging, faction
- other: anything else

Return ONLY a JSON object: {"type": "hates" | "allied_with" | "sibling_of" | "parent_of" | "owns" | "member_of" | "other"}`;

    return aiServiceManager.chat(prompt, { model: 'instant', format: 'json', temperature: 0 }).then(response => {
        try {
            const cleaned = response.replace(/^```json\s*/i, '').replace(/\s*```$/, '').trim();
            const parsed = JSON.parse(cleaned) || JSONHelper.dirtyRepair(cleaned);
            const type = parsed.type || parsed.relationshipType || 'other';
            if (['sibling_of', 'hates', 'allied_with', 'parent_of', 'owns', 'member_of', 'other'].includes(type)) {
                RELATIONSHIP_CACHE.set(cacheKey, type);
                return type as any;
            }
            return 'other' as const;
        } catch {
            return 'other' as const;
        }
    }).catch(() => 'other' as const);
}

export class LoreSyncService {
    /**
     * Synchronizes a Character model entry to LoreEntity and its relationships to LoreRelation.
     * Keeps standard character fields and graph-relation structures perfectly aligned.
     */
    async syncCharacter(char: ICharacter): Promise<void> {
        try {
            const bibleId = char.bibleId;
            const nameUpper = char.name.trim().toUpperCase();

            // 1. Create or Update LoreEntity Node
            const entity = await LoreEntity.findOneAndUpdate(
                { bibleId, name: nameUpper },
                {
                    $set: {
                        type: 'character',
                        description: char.motivation || char.voice?.description || 'Discovered character.',
                        properties: {
                            role: char.role,
                            traits: char.traits || [],
                            age: char.age,
                            currentStatus: char.currentStatus || 'Stable',
                            inventory: char.heldItems || []
                        }
                    }
                },
                { upsert: true, new: true }
            );

            if (process.env.NODE_ENV !== 'production') {
                console.log(`[LoreSync] Synchronized LoreEntity node for character: ${nameUpper}`);
            }

            // 2. Synchronize Directed Relationship Edges
            if (char.relationships && Array.isArray(char.relationships)) {
                for (const rel of char.relationships) {
                    if (!rel.targetCharName) continue;
                    const targetNameUpper = rel.targetCharName.trim().toUpperCase();

                    // Find or create target LoreEntity node first to establish edge safety
                    let targetEntity = await LoreEntity.findOne({ bibleId, name: targetNameUpper });
                    if (!targetEntity) {
                        targetEntity = await LoreEntity.create({
                            bibleId,
                            name: targetNameUpper,
                            type: 'character',
                            description: `Discovered through relationship context with ${char.name}.`
                        });
                        
                        // Attempt to seed back a reciprocal standard Character model to keep discovery clean!
                        try {
                            const existingChar = await Character.findOne({
                                bibleId,
                                name: { $regex: new RegExp(`^${targetNameUpper}$`, 'i') }
                            });
                            if (!existingChar) {
                                await Character.create({
                                    bibleId,
                                    name: rel.targetCharName.trim(),
                                    role: 'supporting',
                                    motivation: `Discovered from relations of ${char.name}.`,
                                    currentStatus: 'Stable'
                                });
                            }
                        } catch (seedErr) {
                            // Suppress background seeding errors
                        }
                    }

                    const dynamicText = (rel.dynamic || '').trim();
                    const relationshipType = dynamicText
                        ? await classifyRelationshipWithAI(dynamicText)
                        : 'other' as const;

                    // Create or update the directional relationship edge
                    await LoreRelation.findOneAndUpdate(
                        {
                            bibleId,
                            sourceEntityId: entity._id,
                            targetEntityId: targetEntity._id
                        },
                        {
                            $set: {
                                relationshipType,
                                description: rel.dynamic || 'Active connection.'
                            }
                        },
                        { upsert: true }
                    );

                    if (process.env.NODE_ENV !== 'production') {
                        console.log(`[LoreSync] Synchronized LoreRelation edge: ${nameUpper} -> ${relationshipType} -> ${targetNameUpper}`);
                    }
                }
            }
        } catch (err: any) {
            console.error(`[LoreSyncService] Failed to sync character ${char.name}:`, err.message);
        }
    }

    /**
     * Safely tears down the LoreEntity node and its connected relations when a character is deleted.
     */
    async deleteCharacterSync(bibleId: mongoose.Types.ObjectId, name: string): Promise<void> {
        try {
            const nameUpper = name.trim().toUpperCase();
            const entity = await LoreEntity.findOne({ bibleId, name: nameUpper });
            
            if (entity) {
                // Delete all directed relational edges involving this entity as source or target
                const relDeleteResult = await LoreRelation.deleteMany({
                    bibleId,
                    $or: [
                        { sourceEntityId: entity._id },
                        { targetEntityId: entity._id }
                    ]
                });
                
                // Delete the LoreEntity node itself
                await LoreEntity.findByIdAndDelete(entity._id);
                
                if (process.env.NODE_ENV !== 'production') {
                    console.log(`[LoreSync] Cleaned up LoreEntity "${nameUpper}" and ${relDeleteResult.deletedCount} related edges.`);
                }
            }
        } catch (err: any) {
            console.error(`[LoreSyncService] Failed to clean deleted character "${name}":`, err.message);
        }
    }
}

export const loreSyncService = new LoreSyncService();
