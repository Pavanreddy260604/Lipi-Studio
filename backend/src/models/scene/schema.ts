import mongoose, { Schema, Document } from 'mongoose';

export interface IScene extends Document {
    bibleId: mongoose.Types.ObjectId;
    sequenceNumber: number;
    title?: string;
    slugline: string;

    summary: string;
    goal: string;

    content: string;
    pendingContent?: string;
    lastInstruction?: string;
    assistantChatHistory?: {
        role: 'user' | 'assistant';
        type: 'instruction' | 'thought' | 'proposal' | 'chat';
        content: string;
        status?: 'pending' | 'applied' | 'discarded';
        timestamp: Date;
        metadata?: {
            explanation?: string[];
            analysis?: string;
            plan?: string;
            craft?: string;
        };
        retrievalMetadata?: {
            mode?: 'ask' | 'edit' | 'agent';
            target?: 'scene' | 'selection';
            queryVariants?: Array<{ key: string; preview: string; length: number }>;
            candidateCounts?: {
                project: number;
                master: number;
                recent: number;
                continuity: number;
            };
            sourceMix?: {
                project: number;
                master: number;
                recent: number;
                continuity: number;
            };
            selectedReferences?: Array<{
                group: string;
                sourceFamily: string;
                label: string;
                score: number;
                sampleId?: string;
                masterScriptId?: string;
                chunkType?: string;
                elementType?: string;
            }>;
            languageFallbackUsed?: boolean;
            eligibleMasterScriptCount?: number;
            exactLanguageMasterCount?: number;
        };
    }[];

    status: 'planned' | 'drafted' | 'reviewed' | 'final';
    feedback?: string;

    critique?: {
        score: number;
        grade: string;
        summary: string;
        formattingIssues: string[];
        dialogueIssues: string[];
        pacingIssues: string[];
        suggestions: string[];
    };

    highScore?: {
        content: string;
        critique: {
            score: number;
            grade: string;
            summary: string;
            formattingIssues: string[];
            dialogueIssues: string[];
            pacingIssues: string[];
            suggestions: string[];
        };
        savedAt: Date;
    };

    charactersInvolved: mongoose.Types.ObjectId[];
    mentionedItems: string[];
    previousSceneSummary?: string;

    createdAt: Date;
    updatedAt: Date;
}

export const VALID_STATUSES = ['planned', 'drafted', 'reviewed', 'final'] as const;

export const SceneSchema: Schema = new Schema({
    bibleId: {
        type: Schema.Types.ObjectId,
        ref: 'Bible',
        required: [true, 'Bible ID is required'],
        index: true
    },
    sequenceNumber: {
        type: Number,
        required: [true, 'Sequence number is required'],
        min: [1, 'Sequence number must be at least 1']
    },
    title: {
        type: String,
        trim: true,
        maxlength: [200, 'Title cannot exceed 200 characters']
    },
    slugline: {
        type: String,
        required: [true, 'Slugline is required'],
        trim: true,
        maxlength: [200, 'Slugline cannot exceed 200 characters'],
        validate: {
            validator: function (v: string) {
                return typeof v === 'string' && v.trim().length > 0;
            },
            message: 'Slugline cannot be empty'
        }
    },

    summary: {
        type: String,
        required: [true, 'Summary is required'],
        maxlength: [2000, 'Summary cannot exceed 2000 characters']
    },
    goal: {
        type: String,
        maxlength: [1000, 'Goal cannot exceed 1000 characters']
    },

    content: {
        type: String,
        default: '',
        maxlength: [100000, 'Content cannot exceed 100,000 characters']
    },
    pendingContent: {
        type: String,
        maxlength: [100000, 'Pending content cannot exceed 100,000 characters']
    },
    lastInstruction: {
        type: String,
        maxlength: [2000, 'Last instruction cannot exceed 2000 characters']
    },
    assistantChatHistory: [{
        role: { type: String, enum: ['user', 'assistant'] },
        type: { type: String, enum: ['instruction', 'thought', 'proposal', 'chat'] },
        content: { type: String, maxlength: 100000 },
        status: { type: String, enum: ['pending', 'applied', 'discarded'] },
        timestamp: { type: Date, default: Date.now },
        metadata: { type: Schema.Types.Mixed },
        retrievalMetadata: { type: Schema.Types.Mixed }
    }],

    status: {
        type: String,
        enum: {
            values: [...VALID_STATUSES],
            message: 'Invalid status. Allowed: ' + VALID_STATUSES.join(', ')
        },
        default: 'planned'
    },
    feedback: {
        type: String,
        maxlength: [5000, 'Feedback cannot exceed 5000 characters']
    },

    critique: {
        score: {
            type: Number,
            min: [0, 'Score must be between 0 and 100'],
            max: [100, 'Score must be between 0 and 100']
        },
        grade: {
            type: String,
            maxlength: [10, 'Grade cannot exceed 10 characters']
        },
        summary: {
            type: String,
            maxlength: [2000, 'Critique summary cannot exceed 2000 characters']
        },
        formattingIssues: [{
            type: String,
            maxlength: [500, 'Each issue cannot exceed 500 characters']
        }],
        dialogueIssues: [{
            type: String,
            maxlength: [500, 'Each issue cannot exceed 500 characters']
        }],
        pacingIssues: [{
            type: String,
            maxlength: [500, 'Each issue cannot exceed 500 characters']
        }],
        suggestions: [{
            type: String,
            maxlength: [500, 'Each suggestion cannot exceed 500 characters']
        }]
    },

    highScore: {
        content: {
            type: String,
            maxlength: [100000, 'High score content cannot exceed 100,000 characters']
        },
        critique: {
            score: {
                type: Number,
                min: [0, 'Score must be between 0 and 100'],
                max: [100, 'Score must be between 0 and 100']
            },
            grade: {
                type: String,
                maxlength: [10, 'Grade cannot exceed 10 characters']
            },
            summary: {
                type: String,
                maxlength: [2000, 'Critique summary cannot exceed 2000 characters']
            },
            formattingIssues: [{
                type: String,
                maxlength: [500, 'Each issue cannot exceed 500 characters']
            }],
            dialogueIssues: [{
                type: String,
                maxlength: [500, 'Each issue cannot exceed 500 characters']
            }],
            pacingIssues: [{
                type: String,
                maxlength: [500, 'Each issue cannot exceed 500 characters']
            }],
            suggestions: [{
                type: String,
                maxlength: [500, 'Each suggestion cannot exceed 500 characters']
            }]
        },
        savedAt: { type: Date }
    },

    charactersInvolved: [{
        type: Schema.Types.ObjectId,
        ref: 'Character'
    }],
    mentionedItems: [{
        type: String,
        maxlength: [200, 'Each mentioned item cannot exceed 200 characters']
    }],
    previousSceneSummary: {
        type: String,
        maxlength: [2000, 'Previous scene summary cannot exceed 2000 characters']
    }
}, { timestamps: true });

SceneSchema.index({ bibleId: 1, sequenceNumber: 1 }, { unique: true });
