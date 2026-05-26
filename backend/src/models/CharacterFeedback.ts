import mongoose, { Schema, Document } from 'mongoose';

export interface ICharacterFeedback extends Document {
    bibleId: mongoose.Types.ObjectId;
    characterId?: mongoose.Types.ObjectId;  // Optional: Nullable for project-wide casting rules
    mistakeContext: string;  // e.g. "Drafted Bheem using formal, verbose language"
    userCorrection: string;  // e.g. "Bheem speaks in blunt, raw sentences. No formal logic."
    category: 'voice' | 'trait' | 'lore' | 'relationship' | 'global_casting';
    createdAt: Date;
    updatedAt: Date;
}

const CharacterFeedbackSchema: Schema = new Schema({
    bibleId: {
        type: Schema.Types.ObjectId,
        ref: 'Bible',
        required: [true, 'Bible ID is required'],
        index: true
    },
    characterId: {
        type: Schema.Types.ObjectId,
        ref: 'Character',
        required: false,
        index: true
    },
    mistakeContext: {
        type: String,
        required: [true, 'Mistake context is required'],
        maxlength: [1000, 'Context cannot exceed 1000 characters']
    },
    userCorrection: {
        type: String,
        required: [true, 'User correction is required'],
        maxlength: [1000, 'Correction cannot exceed 1000 characters']
    },
    category: {
        type: String,
        enum: ['voice', 'trait', 'lore', 'relationship', 'global_casting'],
        required: [true, 'Category is required'],
        default: 'voice'
    }
}, { timestamps: true });

// Compound index for fast retrieval of character corrections
CharacterFeedbackSchema.index({ bibleId: 1, characterId: 1, category: 1 });

export const CharacterFeedback = mongoose.model<ICharacterFeedback>('CharacterFeedback', CharacterFeedbackSchema);
