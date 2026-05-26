import mongoose, { Document, Schema } from 'mongoose';

// ============================================
// TYPES
// ============================================

export interface IRevision {
    content: string;
    timestamp: Date;
    changeNote: string;
}

export interface IScriptMetadata {
    duration: number;
    genre: string;
    tone: string;
    scenes: number;
    characters: string[];
    wordCount: number;
    estimatedPages: number;
}

export interface IScript extends Document {
    userId: mongoose.Types.ObjectId;
    title: string;
    prompt: string;
    format: 'film' | 'short' | 'youtube' | 'reel' | 'commercial' | 'tv-episode';
    style: 'classic' | 'nolan' | 'tarantino' | 'spielberg' | 'anderson' | 'dialogue-driven' | 'visual-minimal' | 'non-linear' | 'documentary' | 'action-heavy' | 'experimental' | 'custom' | 'indie' | 'modern';
    language: string;
    content: string;
    revisions: IRevision[];
    metadata: IScriptMetadata;
    status: 'generating' | 'completed' | 'failed' | 'draft';
    lastAutoSave: Date;
    isDeleted: boolean;
    createdAt: Date;
    updatedAt: Date;
    addRevision(changeNote?: string): void;
}

// ============================================
// SCHEMAS
// ============================================

const revisionSchema = new Schema<IRevision>({
    content: {
        type: String,
        required: true
    },
    timestamp: {
        type: Date,
        default: Date.now
    },
    changeNote: {
        type: String,
        default: 'Auto-save'
    }
});

const metadataSchema = new Schema<IScriptMetadata>({
    duration: { type: Number, default: 0 },
    genre: { type: String, default: 'Drama' },
    tone: { type: String, default: 'Serious' },
    scenes: { type: Number, default: 0 },
    characters: [{ type: String }],
    wordCount: { type: Number, default: 0 },
    estimatedPages: { type: Number, default: 0 }
}, { _id: false });

const scriptSchema = new Schema<IScript>({
    userId: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    title: {
        type: String,
        default: 'Untitled Script'
    },
    prompt: {
        type: String,
        required: true
    },
    format: {
        type: String,
        enum: ['film', 'short', 'youtube', 'reel', 'commercial', 'tv-episode'],
        default: 'film'
    },
    style: {
        type: String,
        enum: ['classic', 'nolan', 'tarantino', 'spielberg', 'anderson', 'dialogue-driven', 'visual-minimal', 'non-linear', 'documentary', 'action-heavy', 'experimental', 'custom', 'indie', 'modern'],
        default: 'classic'
    },
    language: {
        type: String,
        default: 'English'
    },
    content: {
        type: String,
        default: ''
    },
    revisions: [revisionSchema],
    metadata: {
        type: metadataSchema,
        default: () => ({})
    },
    status: {
        type: String,
        enum: ['generating', 'completed', 'failed', 'draft'],
        default: 'draft'
    },
    lastAutoSave: {
        type: Date,
        default: Date.now
    },
    isDeleted: {
        type: Boolean,
        default: false
    }
}, {
    timestamps: true
});

// ============================================
// INDEXES
// ============================================

scriptSchema.index({ userId: 1, updatedAt: -1 });
scriptSchema.index({ userId: 1, isDeleted: 1 });
scriptSchema.index({ status: 1 });

// ============================================
// MIDDLEWARE
// ============================================

// Calculate metadata before saving
scriptSchema.pre('save', function (next) {
    if (this.content) {
        // Word count
        this.metadata.wordCount = this.content.split(/\s+/).filter(Boolean).length;

        // Estimated pages (industry standard: ~180 words per page)
        this.metadata.estimatedPages = Math.ceil(this.metadata.wordCount / 180);

        // Count scenes (INT. or EXT. headers)
        const sceneMatches = this.content.match(/^(INT\.|EXT\.)/gm);
        this.metadata.scenes = sceneMatches ? sceneMatches.length : 0;

        // Extract characters (look for ALL CAPS names followed by dialogue)
        const characterMatches = this.content.match(/^\s{20,}([A-Z][A-Z\s]+)$/gm);
        if (characterMatches) {
            const uniqueChars = [...new Set(characterMatches.map(c => c.trim()))];
            this.metadata.characters = uniqueChars.slice(0, 20); // Limit to 20 characters
        }
    }
    next();
});

// ============================================
// METHODS
// ============================================

// Add a revision to history
scriptSchema.methods.addRevision = function (changeNote: string = 'Auto-save') {
    if (!this.content) return;

    this.revisions.push({
        content: this.content,
        timestamp: new Date(),
        changeNote
    });

    // Keep only last 50 revisions to prevent bloat
    if (this.revisions.length > 50) {
        this.revisions = this.revisions.slice(-50);
    }

    this.lastAutoSave = new Date();
};

// ============================================
// VIRTUALS
// ============================================

scriptSchema.virtual('latestRevision').get(function () {
    return this.revisions.length > 0
        ? this.revisions[this.revisions.length - 1]
        : null;
});

scriptSchema.virtual('revisionCount').get(function () {
    return this.revisions.length;
});

// ============================================
// EXPORT
// ============================================

export const Script = mongoose.model<IScript>('Script', scriptSchema);
