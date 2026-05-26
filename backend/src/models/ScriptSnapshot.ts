import mongoose, { Schema, Document } from 'mongoose';

export interface IScriptSnapshot extends Document {
    bibleId: mongoose.Types.ObjectId;
    label: string;
    description?: string;
    branch: string;
    sceneSnapshots: Array<{
        sceneId: mongoose.Types.ObjectId;
        sequenceNumber: number;
        title: string;
        slugline: string;
        content: string;
        summary: string;
    }>;
    metadata: {
        sceneCount: number;
        wordCount: number;
        characterCount: number;
    };
    createdAt: Date;
}

const ScriptSnapshotSchema: Schema = new Schema({
    bibleId: {
        type: Schema.Types.ObjectId,
        ref: 'Bible',
        required: true,
        index: true,
    },
    label: {
        type: String,
        required: true,
        trim: true,
        maxlength: [200, 'Label cannot exceed 200 characters'],
    },
    description: {
        type: String,
        maxlength: [1000, 'Description cannot exceed 1000 characters'],
    },
    branch: {
        type: String,
        default: 'main',
        trim: true,
        maxlength: [100, 'Branch name cannot exceed 100 characters'],
    },
    sceneSnapshots: [{
        sceneId: { type: Schema.Types.ObjectId, ref: 'Scene' },
        sequenceNumber: Number,
        title: String,
        slugline: String,
        content: String,
        summary: String,
    }],
    metadata: {
        sceneCount: { type: Number, default: 0 },
        wordCount: { type: Number, default: 0 },
        characterCount: { type: Number, default: 0 },
    },
}, { timestamps: true });

ScriptSnapshotSchema.index({ bibleId: 1, branch: 1, createdAt: -1 });

export const ScriptSnapshot = mongoose.model<IScriptSnapshot>('ScriptSnapshot', ScriptSnapshotSchema);
