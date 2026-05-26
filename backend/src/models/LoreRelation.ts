import mongoose, { Schema, Document } from 'mongoose';

export interface ILoreRelation extends Document {
    bibleId: mongoose.Types.ObjectId;
    sourceEntityId: mongoose.Types.ObjectId;
    targetEntityId: mongoose.Types.ObjectId;
    relationshipType: 'sibling_of' | 'hates' | 'allied_with' | 'parent_of' | 'owns' | 'member_of' | 'other';
    description?: string; // Narrative details, e.g., "Karna seeks validation but feels abandoned."
    sceneActiveRange?: {
        startSequence?: number;
        endSequence?: number;
    };
    createdAt: Date;
    updatedAt: Date;
}

const LoreRelationSchema: Schema = new Schema({
    bibleId: {
        type: Schema.Types.ObjectId,
        ref: 'Bible',
        required: [true, 'Bible ID is required'],
        index: true
    },
    sourceEntityId: {
        type: Schema.Types.ObjectId,
        ref: 'LoreEntity',
        required: [true, 'Source entity ID is required'],
        index: true
    },
    targetEntityId: {
        type: Schema.Types.ObjectId,
        ref: 'LoreEntity',
        required: [true, 'Target entity ID is required'],
        index: true
    },
    relationshipType: {
        type: String,
        required: [true, 'Relationship type is required'],
        enum: {
            values: ['sibling_of', 'hates', 'allied_with', 'parent_of', 'owns', 'member_of', 'other'],
            message: 'Invalid relationship type.'
        }
    },
    description: {
        type: String,
        trim: true,
        maxlength: [2000, 'Relationship description cannot exceed 2000 characters']
    },
    sceneActiveRange: {
        startSequence: { type: Number, min: 1 },
        endSequence: { type: Number, min: 1 }
    }
}, { timestamps: true });

// Compound index to quickly fetch all relations of a source or target within a project
LoreRelationSchema.index({ bibleId: 1, sourceEntityId: 1 });
LoreRelationSchema.index({ bibleId: 1, targetEntityId: 1 });

export const LoreRelation = mongoose.model<ILoreRelation>('LoreRelation', LoreRelationSchema);
