import mongoose, { Schema, Document } from 'mongoose';

export interface IBeat {
    name: string; // e.g. "Opening Image", "Theme Stated"
    title?: string;
    slugline?: string;
    summary?: string;
    description: string; // The generated plot point
}

export interface IAct {
    name: string; // "Act 1", "Act 2A", etc.
    beats: IBeat[];
}

export interface ITreatment extends Document {
    bibleId: mongoose.Types.ObjectId;
    logline: string;
    style: string;
    acts: IAct[];
    createdAt: Date;
    updatedAt: Date;
}

const BeatSchema = new Schema({
    name: { type: String, required: true },
    title: { type: String },
    slugline: { type: String },
    summary: { type: String },
    description: { type: String, required: true }
});

const ActSchema = new Schema({
    name: { type: String, required: true },
    beats: [BeatSchema]
});

const TreatmentSchema: Schema = new Schema({
    bibleId: { type: Schema.Types.ObjectId, ref: 'Bible', required: true },
    logline: { type: String, required: true },
    style: { type: String, default: 'Save The Cat' },
    acts: [ActSchema]
}, { timestamps: true });

export const Treatment = mongoose.model<ITreatment>('Treatment', TreatmentSchema);
