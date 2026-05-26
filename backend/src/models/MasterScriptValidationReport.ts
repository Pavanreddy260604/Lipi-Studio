import mongoose, { Schema, Document } from 'mongoose';

export interface IValidationLineIssue {
    lineNo: number;
    lineId?: string;
    detail?: string;
}

export interface IValidationOrderIssue {
    sceneSeq: number;
    elementSeq: number;
    detail: string;
}

export interface IValidationHierarchyIssue {
    chunkId?: string;
    detail: string;
}

export interface IGeAuditResult {
    status: 'passed' | 'failed' | 'skipped';
    checkedAt?: Date;
    command?: string;
    summary?: string;
    details?: Record<string, unknown>;
}

export interface IMasterScriptValidationReport extends Document {
    masterScriptId: mongoose.Types.ObjectId;
    scriptVersion: string;
    status: 'passed' | 'failed';
    missingLines: IValidationLineIssue[];
    extraLines: IValidationLineIssue[];
    layoutMismatches: IValidationLineIssue[];
    classificationMismatches: IValidationLineIssue[];
    orderMismatches: IValidationOrderIssue[];
    reconstructionMismatch: boolean;
    hierarchyMismatches: IValidationHierarchyIssue[];
    summary: string;
    geAudit?: IGeAuditResult;
    createdAt: Date;
    updatedAt: Date;
}

const MasterScriptValidationReportSchema: Schema = new Schema({
    masterScriptId: { type: Schema.Types.ObjectId, ref: 'MasterScript', required: true },
    scriptVersion: { type: String, required: true },
    status: { type: String, enum: ['passed', 'failed'], required: true },
    missingLines: [{
        lineNo: { type: Number, required: true },
        lineId: { type: String },
        detail: { type: String }
    }],
    extraLines: [{
        lineNo: { type: Number, required: true },
        lineId: { type: String },
        detail: { type: String }
    }],
    layoutMismatches: [{
        lineNo: { type: Number, required: true },
        lineId: { type: String },
        detail: { type: String }
    }],
    classificationMismatches: [{
        lineNo: { type: Number, required: true },
        lineId: { type: String },
        detail: { type: String }
    }],
    orderMismatches: [{
        sceneSeq: { type: Number, required: true },
        elementSeq: { type: Number, required: true },
        detail: { type: String, required: true }
    }],
    reconstructionMismatch: { type: Boolean, required: true, default: false },
    hierarchyMismatches: [{
        chunkId: { type: String },
        detail: { type: String, required: true }
    }],
    summary: { type: String, required: true },
    geAudit: {
        status: { type: String, enum: ['passed', 'failed', 'skipped'] },
        checkedAt: { type: Date },
        command: { type: String },
        summary: { type: String },
        details: { type: Schema.Types.Mixed }
    }
}, { timestamps: true });

MasterScriptValidationReportSchema.index({ masterScriptId: 1, scriptVersion: 1 }, { unique: true });
MasterScriptValidationReportSchema.index({ masterScriptId: 1, createdAt: -1 });

export const MasterScriptValidationReport = mongoose.model<IMasterScriptValidationReport>(
    'MasterScriptValidationReport',
    MasterScriptValidationReportSchema
);
