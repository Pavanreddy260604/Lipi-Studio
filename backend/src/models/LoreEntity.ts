import mongoose, { Schema, Document } from 'mongoose';

export interface ILoreEntity extends Document {
    bibleId: mongoose.Types.ObjectId;
    name: string; // E.g., "KARNA", "HASTINAPURA"
    type: 'character' | 'location' | 'object' | 'faction';
    description?: string;
    properties?: Record<string, any>; // Arbitrary metadata: traits, motivations, era, etc.
    createdAt: Date;
    updatedAt: Date;
}

const LoreEntitySchema: Schema = new Schema({
    bibleId: {
        type: Schema.Types.ObjectId,
        ref: 'Bible',
        required: [true, 'Bible ID is required'],
        index: true
    },
    name: {
        type: String,
        required: [true, 'Name is required'],
        trim: true,
        uppercase: true, // Keep uppercase for robust LLM mapping matches
        maxlength: [100, 'Name cannot exceed 100 characters']
    },
    type: {
        type: String,
        required: [true, 'Type is required'],
        enum: {
            values: ['character', 'location', 'object', 'faction'],
            message: 'Invalid type. Must be: character, location, object, or faction'
        }
    },
    description: {
        type: String,
        trim: true,
        maxlength: [4000, 'Description cannot exceed 4000 characters']
    },
    properties: {
        type: Schema.Types.Mixed,
        default: {}
    }
}, { timestamps: true });

// A name must be unique within a single show bible to prevent duplicate nodes.
LoreEntitySchema.index({ bibleId: 1, name: 1 }, { unique: true });

LoreEntitySchema.post('save', async function(doc: ILoreEntity) {
    if (doc.type !== 'character') return;
    try {
        const { Character } = require('./Character');
        const existingChar = await Character.findOne({
            bibleId: doc.bibleId,
            name: { $regex: new RegExp(`^${doc.name}$`, 'i') }
        });
        if (!existingChar) {
            await Character.create({
                bibleId: doc.bibleId,
                name: doc.name,
                role: 'supporting',
                motivation: doc.description || 'Synced from lore entity.',
                currentStatus: 'Stable',
                traits: Array.isArray(doc.properties?.traits) ? doc.properties.traits : [],
            });
        } else {
            let modified = false;
            if (doc.description && doc.description.length > (existingChar.motivation || '').length) {
                existingChar.motivation = doc.description;
                modified = true;
            }
            if (doc.properties?.traits && Array.isArray(doc.properties.traits)) {
                const currentTraits = existingChar.traits || [];
                const newTraits = doc.properties.traits.filter((t: string) => t && !currentTraits.some((ct: string) => ct.toUpperCase() === t.toUpperCase()));
                if (newTraits.length > 0) {
                    existingChar.traits = [...currentTraits, ...newTraits];
                    modified = true;
                }
            }
            if (doc.properties?.role && existingChar.role !== doc.properties.role) {
                existingChar.role = doc.properties.role;
                modified = true;
            }
            if (doc.properties?.currentStatus && doc.properties.currentStatus !== 'Stable') {
                existingChar.currentStatus = doc.properties.currentStatus;
                modified = true;
            }
            if (modified) await existingChar.save();
        }
    } catch {
        // Silently handle reverse sync errors to avoid breaking the save operation
    }
});

export const LoreEntity = mongoose.model<ILoreEntity>('LoreEntity', LoreEntitySchema);
