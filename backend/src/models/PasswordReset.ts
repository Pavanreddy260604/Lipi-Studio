import mongoose, { Document, Schema } from 'mongoose';

export interface IPasswordReset extends Document {
    userId: mongoose.Types.ObjectId;
    tokenHash: string;      // SHA-256 of the plain reset token
    expiresAt: Date;        // TTL: Usually 1 hour
    used: boolean;
}

const passwordResetSchema = new Schema<IPasswordReset>({
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    tokenHash: { type: String, required: true },
    expiresAt: { type: Date, required: true },
    used: { type: Boolean, default: false }
}, {
    timestamps: true
});

// TTL index to automatically remove expired generic reset tokens
passwordResetSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const PasswordReset = mongoose.model<IPasswordReset>('PasswordReset', passwordResetSchema);
