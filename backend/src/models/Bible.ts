import mongoose, { Schema, Document } from 'mongoose';

export interface IAssistantPreferences {
    defaultMode: 'ask' | 'edit' | 'agent';
    replyLanguage?: string;
    transliteration?: boolean;
    savedDirectives: string[];
}

export interface ITreatmentParameters {
    sceneCount?: number;
    structure?: string;
    tone?: string;
    lastUpdated?: Date;
}

export interface IStoryResource {
    _id?: string;
    title: string;
    content: string;
    type: 'synopsis' | 'novel_excerpt' | 'treatment' | 'reference' | 'notes' | 'other';
    sourceFilename?: string; // Original filename if uploaded as PDF/DOCX
    addedAt: Date;
}

export interface IBible extends Document {
    userId: string; // String to support various auth provider IDs
    title: string;
    logline: string;
    genre: string;
    tone: string;
    language: string;
    visualStyle: string; // "Noir", "Wes Anderson", "Handheld"
    rules: string[]; // "No voiceovers", "Only takes place at night"
    globalOutline?: string[]; // 20-beat master story arc
    storySoFar?: string; // Cumulative summary of the entire plot
    sceneCount?: number; // Total scenes generated so far
    transliteration?: boolean; // PH Transliteration Soul
    targetSceneCount?: number; // Target number of scenes for the script
    storyResources?: IStoryResource[]; // Source material for AI (novel, synopsis, etc.)
    ignoredCharacterNames?: string[]; // Array of lowercase string names to ignore permanently
    assistantPreferences?: IAssistantPreferences;
    treatmentParameters?: ITreatmentParameters;
    createdAt: Date;
    updatedAt: Date;
}

// Valid genre options
const VALID_GENRES = ['Drama', 'Sci-Fi', 'Comedy', 'Thriller', 'Horror', 'Action', 'Romance', 'Documentary', 'Fantasy', 'Mystery'];

const AssistantPreferencesSchema = new Schema<IAssistantPreferences>({
    defaultMode: {
        type: String,
        enum: ['ask', 'edit', 'agent'],
        default: 'ask'
    },
    replyLanguage: {
        type: String,
        maxlength: [50, 'Reply language cannot exceed 50 characters']
    },
    transliteration: {
        type: Boolean
    },
    savedDirectives: [{
        type: String,
        maxlength: [500, 'Each assistant directive cannot exceed 500 characters']
    }]
}, { _id: false });

const BibleSchema: Schema = new Schema({
    userId: {
        type: String,
        required: [true, 'User ID is required'],
        index: true,
        trim: true
    },
    title: {
        type: String,
        required: [true, 'Title is required'],
        trim: true,
        maxlength: [200, 'Title cannot exceed 200 characters'],
        minlength: [1, 'Title cannot be empty']
    },
    logline: {
        type: String,
        default: '',
        maxlength: [1000, 'Logline cannot exceed 1000 characters']
    },
    genre: {
        type: String,
        enum: {
            values: VALID_GENRES,
            message: 'Invalid genre. Allowed: ' + VALID_GENRES.join(', ')
        },
        default: 'Drama'
    },
    tone: {
        type: String,
        maxlength: [100, 'Tone cannot exceed 100 characters']
    },
    language: {
        type: String,
        default: 'English',
        maxlength: [50, 'Language cannot exceed 50 characters']
    },
    visualStyle: {
        type: String,
        maxlength: [100, 'Visual style cannot exceed 100 characters']
    },
    rules: [{
        type: String,
        maxlength: [500, 'Each rule cannot exceed 500 characters']
    }],
    globalOutline: [{
        type: String,
        maxlength: [500]
    }],
    storySoFar: {
        type: String,
        default: 'The story is just beginning.'
    },
    sceneCount: {
        type: Number,
        default: 0
    },
    transliteration: {
        type: Boolean,
        default: false
    },
    targetSceneCount: {
        type: Number,
        default: 60
    },
    storyResources: [{
        title: { type: String, maxlength: 200, default: 'Untitled Resource' },
        content: { type: String, maxlength: 100000 },
        type: {
            type: String,
            enum: ['synopsis', 'novel_excerpt', 'treatment', 'reference', 'notes', 'other'],
            default: 'notes'
        },
        sourceFilename: { type: String, maxlength: 300 },
        addedAt: { type: Date, default: Date.now }
    }],
    ignoredCharacterNames: [{
        type: String,
        lowercase: true,
        trim: true
    }],
    assistantPreferences: {
        type: AssistantPreferencesSchema,
        default: () => ({
            defaultMode: 'ask',
            savedDirectives: []
        })
    },
    treatmentParameters: {
        sceneCount: { type: Number, default: 60 },
        structure: { type: String, default: '3-Act Structure' },
        tone: { type: String, default: 'Cinematic' },
        lastUpdated: { type: Date, default: Date.now }
    }
}, { timestamps: true });

// Index for efficient queries
BibleSchema.index({ userId: 1, createdAt: -1 });

export const Bible = mongoose.model<IBible>('Bible', BibleSchema);
