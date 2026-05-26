import mongoose, { Schema, Document } from 'mongoose';

export type VoiceSampleChunkType =
    | 'dialogue'
    | 'action'
    | 'narration'
    | 'slug'
    | 'cue'
    | 'transition'
    | 'centered'
    | 'note'
    | 'section'
    | 'synopsis'
    | 'parenthetical'
    | 'lyrics'
    | 'context'
    | 'scene'
    | 'other'
    | 'designation'
    | 'setting';

export type VoiceSampleElementType =
    | 'scene'
    | 'dialogue'
    | 'action'
    | 'narration'
    | 'slug'
    | 'cue'
    | 'transition'
    | 'centered'
    | 'note'
    | 'section'
    | 'synopsis'
    | 'parenthetical'
    | 'lyrics'
    | 'other'
    | 'designation'
    | 'setting';

export interface IVoiceSample extends Document {
    bibleId: mongoose.Types.ObjectId;
    characterId?: mongoose.Types.ObjectId; // Optional: linked to specific character
    content: string; // The specific line of dialogue
    contentHash?: string; // Deduplication hash
    speaker?: string; // Optional detected speaker name
    era?: string; // New: Time period/age context
    language?: string; // PH Multilingual RAG
    tactic?: string; // Character tactic (PH 19)
    emotion?: string; // Emotional charge (PH 19)
    chunkType?: VoiceSampleChunkType;
    chunkIndex?: number;
    sceneSeq?: number;
    elementSeq?: number;
    elementType?: VoiceSampleElementType;
    sourceStartLine?: number;
    sourceEndLine?: number;
    sourceLineIds?: string[];
    dualDialogue?: boolean;
    sceneNumber?: string;
    nonPrinting?: boolean;
    ingestState?: 'staging' | 'active' | 'archived';
    embedding: number[]; // The vector representation
    tags: string[]; // "Slang", "Angry", "South London"
    source: string; // "The Wire S01E05"
    masterScriptId?: mongoose.Types.ObjectId; // Optional: linked to a pro master script
    chunkId?: string; // Stable identifier for the chunk
    scriptVersion?: string; // New: To track structural indices
    parserVersion?: string; // New: To track engine version
    parentNodeId?: mongoose.Types.ObjectId; // PH 29: For hierarchical RAG
    isHierarchicalNode?: boolean; // PH 29: True if this is a "Beat" or "Scene" node
    createdAt: Date;
}

const VoiceSampleSchema: Schema = new Schema({
    bibleId: { type: Schema.Types.ObjectId, ref: 'Bible' }, // Bible is optional if it's a global master script
    masterScriptId: { type: Schema.Types.ObjectId, ref: 'MasterScript' }, // PH 21
    characterId: { type: Schema.Types.ObjectId, ref: 'Character' },
    content: { type: String, required: true },
    contentHash: { type: String },
    speaker: { type: String },
    era: { type: String }, // NEW: Time period or age range (e.g. "1990s", "childhood")
    language: { type: String }, // PH Multilingual RAG
    tactic: { type: String }, // PH 19
    emotion: { type: String }, // PH 19
    chunkType: {
        type: String,
        enum: ['dialogue', 'action', 'narration', 'slug', 'cue', 'transition', 'centered', 'note', 'section', 'synopsis', 'parenthetical', 'lyrics', 'context', 'scene', 'other', 'designation', 'setting']
    },
    chunkIndex: { type: Number },
    sceneSeq: { type: Number },
    elementSeq: { type: Number },
    elementType: {
        type: String,
        enum: ['scene', 'dialogue', 'action', 'narration', 'slug', 'cue', 'transition', 'centered', 'note', 'section', 'synopsis', 'parenthetical', 'lyrics', 'other', 'designation', 'setting']
    },
    sourceStartLine: { type: Number },
    sourceEndLine: { type: Number },
    sourceLineIds: [{ type: String }],
    dualDialogue: { type: Boolean },
    sceneNumber: { type: String },
    nonPrinting: { type: Boolean, default: false },
    ingestState: { type: String, enum: ['staging', 'active', 'archived'] },
    chunkId: { type: String },
    scriptVersion: { type: String },
    parserVersion: { type: String },
    embedding: { type: [Number], required: true },
    tags: [{ type: String }],
    source: { type: String },
    parentNodeId: { type: Schema.Types.ObjectId, ref: 'VoiceSample' }, // PH 29
    isHierarchicalNode: { type: Boolean, default: false } // PH 29
}, { timestamps: true });

// Simple index for retrieving by project
VoiceSampleSchema.index({ bibleId: 1 });
VoiceSampleSchema.index({ masterScriptId: 1 });
VoiceSampleSchema.index({ masterScriptId: 1, scriptVersion: 1 });
VoiceSampleSchema.index({ masterScriptId: 1, scriptVersion: 1, chunkId: 1 });
VoiceSampleSchema.index({ masterScriptId: 1, scriptVersion: 1, sceneSeq: 1, elementSeq: 1 });
VoiceSampleSchema.index({ bibleId: 1, contentHash: 1 });

export const VoiceSample = mongoose.model<IVoiceSample>('VoiceSample', VoiceSampleSchema);
