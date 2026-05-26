import mongoose, { Schema, Document } from 'mongoose';
import type { MasterScriptSourceFormat } from '../types/masterScriptLayout';

export interface IMasterScript extends Document {
    userId: string;
    title: string;
    director: string;
    description?: string;
    language: string; // PH Multilingual RAG
    tags: string[]; // ["Sci-Fi", "Noir", "Tense"]
    rawContent: string;
    status: 'pending' | 'processing' | 'validating' | 'indexed' | 'failed';
    progress: number;
    processedChunks: number;
    activeScriptVersion?: string;
    processingScriptVersion?: string;
    parserVersion?: string;
    sourceFormat?: MasterScriptSourceFormat;
    pageCount?: number;
    layoutVersion?: string;
    readerReady?: boolean;
    ragReady?: boolean;
    ingestWarnings?: string[];
    gateStatus?: 'pending' | 'passed' | 'failed';
    lastValidationSummary?: string;
    sourceType: 'screenplay' | 'literature' | 'dictionary'; // PH Mixed RAG
    createdAt: Date;
}

const MasterScriptSchema: Schema = new Schema({
    userId: {
        type: String,
        required: [true, 'User ID is required'],
        index: true,
        trim: true
    },
    title: { type: String, required: true, trim: true },
    director: { type: String, required: true, trim: true },
    description: { type: String },
    language: { type: String, required: true, default: 'English' },
    sourceType: {
        type: String,
        enum: ['screenplay', 'literature', 'dictionary'],
        default: 'screenplay'
    },
    tags: [{ type: String }],
    rawContent: { type: String, required: true },
    status: {
        type: String,
        enum: ['pending', 'processing', 'validating', 'indexed', 'failed'],
        default: 'pending'
    },
    progress: { type: Number, default: 0 },
    processedChunks: { type: Number, default: 0 },
    activeScriptVersion: { type: String },
    processingScriptVersion: { type: String },
    parserVersion: { type: String },
    sourceFormat: {
        type: String,
        enum: ['pdf', 'docx', 'txt', 'md', 'fountain', 'script', 'raw_text']
    },
    pageCount: { type: Number, default: 1 },
    layoutVersion: { type: String },
    readerReady: { type: Boolean, default: false },
    ragReady: { type: Boolean, default: false },
    ingestWarnings: [{ type: String }],
    gateStatus: { type: String, enum: ['pending', 'passed', 'failed'] },
    lastValidationSummary: { type: String }
}, { timestamps: true });

MasterScriptSchema.index({ director: 1, title: 1 });
MasterScriptSchema.index({ tags: 1 });
MasterScriptSchema.index({ activeScriptVersion: 1 });

export const MasterScript = mongoose.model<IMasterScript>('MasterScript', MasterScriptSchema);
