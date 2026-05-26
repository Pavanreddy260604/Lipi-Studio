import mongoose, { Schema, Document } from 'mongoose';

export interface ICharacter extends Document {
    bibleId: mongoose.Types.ObjectId;
    name: string;
    age?: number;
    role: 'protagonist' | 'antagonist' | 'supporting' | 'minor';
    isHero: boolean;
    voice: {
        description: string; // "Gruff, uses simple words"
        sampleLines: string[]; // "I ain't doing that.", "Get lost."
        accent?: string;
    };
    traits: string[]; // "Limp", "Chain smoker"
    motivation: string;
    currentStatus?: string; // e.g., "Injured", "Angry"
    heldItems?: string[]; // e.g., ["Sword", "Letter"]
    relationships?: { targetCharName: string, dynamic: string }[]; // e.g., { "MAL": "Suspicious but obsessed" }
    historyLogs?: { sceneNumber: number, event: string }[]; // Historical logs of major character events
    createdAt: Date;
    updatedAt: Date;
}

// Valid role options
const VALID_ROLES = ['protagonist', 'antagonist', 'supporting', 'minor'] as const;

const CharacterSchema: Schema = new Schema({
    bibleId: {
        type: Schema.Types.ObjectId,
        ref: 'Bible',
        required: [true, 'Bible ID is required'],
        index: true
    },
    name: {
        type: String,
        required: [true, 'Character name is required'],
        trim: true,
        maxlength: [100, 'Character name cannot exceed 100 characters'],
        minlength: [1, 'Character name cannot be empty']
    },
    age: {
        type: Number,
        min: [0, 'Age cannot be negative'],
        max: [150, 'Age cannot exceed 150']
    },
    role: {
        type: String,
        enum: {
            values: [...VALID_ROLES],
            message: 'Invalid role. Allowed: ' + VALID_ROLES.join(', ')
        },
        default: 'supporting'
    },
    voice: {
        description: {
            type: String,
            maxlength: [500, 'Voice description cannot exceed 500 characters']
        },
        sampleLines: [{
            type: String,
            maxlength: [500, 'Each sample line cannot exceed 500 characters']
        }],
        accent: {
            type: String,
            maxlength: [100, 'Accent cannot exceed 100 characters']
        }
    },
    traits: [{
        type: String,
        maxlength: [100, 'Each trait cannot exceed 100 characters']
    }],
    motivation: {
        type: String,
        maxlength: [1000, 'Motivation cannot exceed 1000 characters']
    },
    currentStatus: {
        type: String,
        maxlength: [500, 'Status cannot exceed 500 characters'],
        default: 'Stable'
    },
    heldItems: [{
        type: String,
        maxlength: [100]
    }],
    relationships: [{
        targetCharName: { type: String, trim: true },
        dynamic: { type: String, maxlength: [500] }
    }],
    historyLogs: [{
        sceneNumber: { type: Number, required: true },
        event: { type: String, required: true }
    }],
    isHero: {
        type: Boolean,
        default: false
    }
}, { timestamps: true });

// Index for efficient queries and case-insensitive uniqueness
CharacterSchema.index(
    { bibleId: 1, name: 1 },
    { 
        unique: true, 
        collation: { locale: 'en', strength: 2 } 
    }
);

// Enforce unique hero declaration per Bible at database level
CharacterSchema.index(
    { bibleId: 1, isHero: 1 },
    {
        unique: true,
        partialFilterExpression: { isHero: true }
    }
);

// Mongoose pre-save validation hook for hero integrity
CharacterSchema.pre('save', async function(next) {
    if (this.isModified('isHero') && this.isHero === true) {
        const CharacterModel = this.constructor as mongoose.Model<ICharacter>;
        const existingHero = await CharacterModel.findOne({
            bibleId: this.bibleId,
            isHero: true,
            _id: { $ne: this._id }
        });
        if (existingHero) {
            return next(new Error('Another character is already declared the Hero of this film. Demote them first.'));
        }
    }
    next();
});

export const Character = mongoose.model<ICharacter>('Character', CharacterSchema);
