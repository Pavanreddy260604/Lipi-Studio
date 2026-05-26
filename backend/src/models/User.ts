import mongoose, { Document, Schema } from 'mongoose';
import bcrypt from 'bcryptjs';

export interface IUser extends Document {
    _id: mongoose.Types.ObjectId;
    name: string;
    email: string;
    passwordHash: string;
    timezone: string; // Store user's timezone for streak calculations
    targets: {
        dsa: number;
        backend: number;
        project: number;
    };
    emailVerified?: boolean;
    role?: 'user' | 'admin';
    verificationToken?: string;
    verificationExpiry?: Date;
    subscriptionId?: mongoose.Types.ObjectId;
    geminiApiKey?: string;
    encryptionIV?: string;
    scriptInterests?: {
        directors: string[];
        genres: string[];
        styles: string[];
    };
    theme?: string;
    accentColor?: string;
    customAccentColor?: string | null;
    aiAccentColor?: string;
    backgroundTinting?: boolean;
    reducedMotion?: boolean;
    createdAt: Date;
    updatedAt: Date;
    comparePassword(candidatePassword: string): Promise<boolean>;
}

const userSchema = new Schema<IUser>(
    {
        name: {
            type: String,
            required: [true, 'Name is required'],
            trim: true,
            minlength: [2, 'Name must be at least 2 characters'],
            maxlength: [50, 'Name cannot exceed 50 characters'],
        },
        email: {
            type: String,
            required: [true, 'Email is required'],
            unique: true,
            lowercase: true,
            trim: true,
            match: [/^\S+@\S+\.\S+$/, 'Please enter a valid email'],
        },
        passwordHash: {
            type: String,
            required: [true, 'Password is required'],
        },
        timezone: {
            type: String,
            default: 'Asia/Kolkata', // Default timezone
            trim: true,
        },
        targets: {
            dsa: { type: Number, default: 6, min: 0, max: 24 },
            backend: { type: Number, default: 4, min: 0, max: 24 },
            project: { type: Number, default: 1, min: 0, max: 24 },
        },
        emailVerified: {
            type: Boolean,
            default: false,
        },
        verificationToken: {
            type: String, // Stored as a hash
            default: null,
        },
        verificationExpiry: {
            type: Date,
            default: null,
        },
        subscriptionId: {
            type: Schema.Types.ObjectId,
            ref: 'Subscription',
            default: null,
        },
        role: {
            type: String,
            enum: ['user', 'admin'],
            default: 'user',
        },
        geminiApiKey: {
            type: String,
            default: null,
        },
        encryptionIV: {
            type: String,
            default: null,
        },
        scriptInterests: {
            directors: { type: [String], default: [] },
            genres: { type: [String], default: [] },
            styles: { type: [String], default: [] },
        },
        theme: {
            type: String,
            enum: ['dark', 'light', 'system'],
            default: 'dark',
        },
        accentColor: {
            type: String,
            default: 'terracotta',
        },
        customAccentColor: {
            type: String,
            default: null,
        },
        aiAccentColor: {
            type: String,
            default: '#00f2ff',
        },
        backgroundTinting: {
            type: Boolean,
            default: true,
        },
        reducedMotion: {
            type: Boolean,
            default: false,
        },
    },
    {
        timestamps: true,
    }
);

// Hash password before saving (only if password is new/modified)
userSchema.pre('save', async function (next) {
    // Skip if passwordHash isn't modified (it's already hashed)
    if (!this.isModified('passwordHash')) {
        return next();
    }

    // Check if already hashed (bcrypt hashes start with $2a$ or $2b$)
    const bcryptPrefix = /^\$2[ab]\$/;
    if (!bcryptPrefix.test(this.passwordHash)) {
        const salt = await bcrypt.genSalt(12);
        this.passwordHash = await bcrypt.hash(this.passwordHash, salt);
    }

    next();
});

// Compare password method
userSchema.methods.comparePassword = async function (
    candidatePassword: string
): Promise<boolean> {
    return bcrypt.compare(candidatePassword, this.passwordHash);
};

// Remove sensitive fields when converting to JSON
userSchema.set('toJSON', {
    transform: (_doc, ret: any) => {
        const hasApiKey = !!ret.geminiApiKey;
        const { passwordHash, geminiApiKey, encryptionIV, verificationToken, verificationExpiry, __v, ...rest } = ret;
        return {
            ...rest,
            hasApiKey,
        };
    },
});

export const User = mongoose.model<IUser>('User', userSchema);
