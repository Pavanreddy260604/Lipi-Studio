import mongoose, { Schema, Document } from 'mongoose';
import type { MasterScriptSourceKind } from '../types/masterScriptLayout';

export interface IMasterScriptSourceLine extends Document {
    masterScriptId: mongoose.Types.ObjectId;
    scriptVersion: string;
    lineNo: number;
    pageNo: number;
    pageLineNo: number;
    rawText: string;
    isBlank: boolean;
    indentColumns: number;
    lineHash: string;
    lineId: string;
    sourceKind: MasterScriptSourceKind;
    xStart?: number;
    yTop?: number;
    createdAt: Date;
    updatedAt: Date;
}

const MasterScriptSourceLineSchema: Schema = new Schema({
    masterScriptId: { type: Schema.Types.ObjectId, ref: 'MasterScript', required: true },
    scriptVersion: { type: String, required: true },
    lineNo: { type: Number, required: true },
    pageNo: { type: Number, required: true, default: 1 },
    pageLineNo: { type: Number, required: true, default: 1 },
    // Blank lines are valid source lines and must be preserved for exact reconstruction.
    rawText: { type: String, default: '' },
    isBlank: { type: Boolean, required: true, default: false },
    indentColumns: { type: Number, required: true, default: 0 },
    lineHash: { type: String, required: true },
    lineId: { type: String, required: true },
    sourceKind: { type: String, enum: ['title_page', 'body', 'page_marker'], required: true, default: 'body' },
    xStart: { type: Number },
    yTop: { type: Number }
}, { timestamps: true });

MasterScriptSourceLineSchema.index({ masterScriptId: 1, scriptVersion: 1, lineNo: 1 }, { unique: true });
MasterScriptSourceLineSchema.index({ masterScriptId: 1, scriptVersion: 1, lineId: 1 }, { unique: true });
MasterScriptSourceLineSchema.index({ masterScriptId: 1, scriptVersion: 1, pageNo: 1, pageLineNo: 1 });

export const MasterScriptSourceLine = mongoose.model<IMasterScriptSourceLine>(
    'MasterScriptSourceLine',
    MasterScriptSourceLineSchema
);
