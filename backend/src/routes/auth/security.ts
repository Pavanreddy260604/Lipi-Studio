import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import mongoose from 'mongoose';
import { User } from '../../models/User.js';
import { RefreshToken } from '../../models/RefreshToken.js';
import { PasswordReset } from '../../models/PasswordReset.js';
import { emailService } from '../../services/email.service.js';
import { logger } from '../../utils/logger.js';
import { forgotPasswordSchema, resetPasswordSchema, verifyEmailSchema, normalizeEmail } from './validation.js';
import { Script } from '../../models/Script.js';
import { Bible } from '../../models/Bible.js';
import { Character } from '../../models/Character.js';
import { Scene } from '../../models/scene/index.js';
import { Treatment } from '../../models/Treatment.js';
import { ScriptSnapshot } from '../../models/ScriptSnapshot.js';
import { VoiceSample } from '../../models/VoiceSample.js';
import { ChatConversation } from '../../models/ChatConversation.js';
import { MasterScript } from '../../models/MasterScript.js';
import { CharacterFeedback } from '../../models/CharacterFeedback.js';
import { LoreEntity } from '../../models/LoreEntity.js';
import { LoreRelation } from '../../models/LoreRelation.js';
import { MasterScriptValidationReport } from '../../models/MasterScriptValidationReport.js';
import { MasterScriptSourceLine } from '../../models/MasterScriptSourceLine.js';
import { IngestionManifest } from '../../models/IngestionManifest.js';

const log = logger.child({ module: 'auth' });

export async function forgotPassword(req: Request, res: Response, _next: NextFunction) {
    try {
        const result = forgotPasswordSchema.safeParse(req.body);
        if (!result.success) return res.status(400).json({ success: false, error: result.error.issues[0].message });
        const email = normalizeEmail(result.data.email);
        const user = await User.findOne({ email });
        if (!user) return res.json({ success: true, data: { message: 'If an account exists, a reset link was sent' } });
        const resetToken = crypto.randomBytes(32).toString('hex');
        const tokenHash = crypto.createHash('sha256').update(resetToken).digest('hex');
        await PasswordReset.create({ userId: user._id, tokenHash, expiresAt: new Date(Date.now() + 60 * 60 * 1000) });
        const frontendUrl = process.env.FRONTEND_URL || 'https://lipistudio.me';
        emailService.sendPasswordResetEmail(user.email, `${frontendUrl}/reset-password?token=${resetToken}`)
            .catch(e => log.error('forgot_password.email_failed', { err: e }));
        res.json({ success: true, data: { message: 'If an account exists, a reset link was sent' } });
    } catch (error) {
        log.error('forgot_password.failed', { err: error });
        res.status(500).json({ success: false, error: 'Failed to process request' });
    }
}

export async function resetPassword(req: Request, res: Response, _next: NextFunction) {
    try {
        const result = resetPasswordSchema.safeParse(req.body);
        if (!result.success) return res.status(400).json({ success: false, error: result.error.issues[0].message });
        const { token, password } = result.data;
        const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
        const resetRecord = await PasswordReset.findOne({ tokenHash, used: false, expiresAt: { $gt: new Date() } });
        if (!resetRecord) return res.status(400).json({ success: false, error: 'Invalid or expired reset token' });
        const user = await User.findById(resetRecord.userId);
        if (!user) return res.status(400).json({ success: false, error: 'User not found' });
        user.passwordHash = password;
        await user.save();
        resetRecord.used = true;
        await resetRecord.save();
        await RefreshToken.deleteMany({ userId: user._id });
        res.json({ success: true, data: { message: 'Password has been reset successfully' } });
    } catch (error) {
        log.error('reset_password.failed', { err: error });
        res.status(500).json({ success: false, error: 'Failed to reset password' });
    }
}

export async function verifyEmail(req: Request, res: Response, _next: NextFunction) {
    try {
        const result = verifyEmailSchema.safeParse(req.body);
        if (!result.success) return res.status(400).json({ success: false, error: result.error.issues[0].message });
        const { code } = result.data;
        const user = await User.findById(req.userId);
        if (!user) return res.status(404).json({ success: false, error: 'User not found' });
        if (user.emailVerified) return res.json({ success: true, data: { message: 'Email already verified', user: user.toJSON() } });
        if (!user.verificationToken || !user.verificationExpiry) return res.status(400).json({ success: false, error: 'No verification pending' });
        if (new Date() > user.verificationExpiry) return res.status(400).json({ success: false, error: 'Verification code has expired. Please request a new one.' });
        const hashedCode = crypto.createHash('sha256').update(code).digest('hex');
        if (hashedCode !== user.verificationToken) return res.status(400).json({ success: false, error: 'Invalid verification code' });
        user.emailVerified = true;
        user.verificationToken = undefined;
        user.verificationExpiry = undefined;
        await user.save();
        res.json({ success: true, message: 'Email verified successfully', data: { user } });
    } catch (error) {
        log.error('verify_email.failed', { err: error });
        res.status(500).json({ success: false, error: 'Failed to verify email' });
    }
}

export async function resendVerification(req: Request, res: Response, _next: NextFunction) {
    try {
        const user = await User.findById(req.userId);
        if (!user) return res.status(404).json({ success: false, error: 'User not found' });
        if (user.emailVerified) return res.status(400).json({ success: false, error: 'Email already verified' });
        if (user.verificationExpiry && new Date(user.verificationExpiry.getTime() - 14 * 60 * 1000) > new Date()) return res.status(429).json({ success: false, error: 'Please wait a minute before requesting another code' });
        const verificationCode = crypto.randomInt(100000, 999999).toString();
        user.verificationToken = crypto.createHash('sha256').update(verificationCode).digest('hex');
        user.verificationExpiry = new Date(Date.now() + 15 * 60 * 1000);
        await user.save();
        await emailService.sendVerificationEmail(user.email, verificationCode);
        res.json({ success: true, data: { message: 'Verification code sent' } });
    } catch (error) {
        log.error('resend_verification.failed', { err: error });
        res.status(500).json({ success: false, error: 'Failed to resend verification code' });
    }
}

export async function deleteAccount(req: Request, res: Response, _next: NextFunction) {
    const userId = req.userId;
    try {
        // Fetch all the user's bibles and master scripts to cascade cleanups
        const [userBibles, userScripts] = await Promise.all([
            Bible.find({ userId }).select('_id').lean(),
            MasterScript.find({ userId }).select('_id').lean()
        ]);
        const bibleIds = userBibles.map(b => b._id);
        const scriptIds = userScripts.map(s => s._id);

        // Delete from Qdrant resiliently
        const { vectorService } = await import('../../services/vector/index.js');
        for (const bibleId of bibleIds) {
            try {
                await vectorService.deleteSamplesByBibleId(bibleId.toString());
            } catch (err) {
                log.error(`[deleteAccount] Qdrant bible vector delete failed:`, { err });
            }
        }
        for (const scriptId of scriptIds) {
            try {
                await vectorService.deleteSamplesByMasterScriptId(scriptId.toString());
            } catch (err) {
                log.error(`[deleteAccount] Qdrant script vector delete failed:`, { err });
            }
        }

        // Invalidate Redis cache
        const { redisCache } = await import('../../services/redisCache.service.js');
        for (const bibleId of bibleIds) {
            try {
                await redisCache.delPattern(`*${bibleId.toString()}*`);
            } catch (err) {
                log.error(`[deleteAccount] Redis cache clear failed:`, { err });
            }
        }

        const conn = mongoose.connection;
        const supportsTransactions = Boolean((conn as any)?.client?.topology?.hasSessionSupport?.());
        const cascadeOps = (session?: mongoose.ClientSession) => {
            const opts = session ? { session } : undefined;
            return [
                RefreshToken.deleteMany({ userId }, opts),
                PasswordReset.deleteMany({ userId }, opts),
                Script.deleteMany({ userId }, opts),
                Bible.deleteMany({ userId }, opts),
                Character.deleteMany({ userId }, opts),
                Scene.deleteMany({ userId }, opts),
                Treatment.deleteMany({ userId }, opts),
                ScriptSnapshot.deleteMany({ userId }, opts),
                VoiceSample.deleteMany({ userId }, opts),
                ChatConversation.deleteMany({ userId }, opts),
                MasterScript.deleteMany({ userId }, opts),
                CharacterFeedback.deleteMany({ bibleId: { $in: bibleIds } }, opts),
                LoreEntity.deleteMany({ bibleId: { $in: bibleIds } }, opts),
                LoreRelation.deleteMany({ bibleId: { $in: bibleIds } }, opts),
                MasterScriptValidationReport.deleteMany({ masterScriptId: { $in: scriptIds } }, opts),
                MasterScriptSourceLine.deleteMany({ masterScriptId: { $in: scriptIds } }, opts),
                IngestionManifest.deleteMany({ targetId: { $in: [...bibleIds, ...scriptIds] } }, opts),
            ];
        };

        let transactionFailed = false;
        if (supportsTransactions) {
            const session = await mongoose.startSession();
            try {
                await session.withTransaction(async () => {
                    await Promise.all(cascadeOps(session));
                    await User.findByIdAndDelete(userId, { session });
                });
            } catch (txErr: any) {
                if (txErr?.message?.includes('Transaction numbers are only allowed') || txErr?.code === 20) {
                    log.warn('[deleteAccount] Standalone MongoDB detected. Falling back to non-transactional deletion.');
                    transactionFailed = true;
                } else {
                    throw txErr;
                }
            } finally {
                await session.endSession();
            }
        }

        if (!supportsTransactions || transactionFailed) {
            await Promise.all(cascadeOps());
            await User.findByIdAndDelete(userId);
        }

        res.clearCookie('refreshToken');
        res.json({ success: true, data: { message: 'Account and all screenplay assets deleted successfully' } });
    } catch (error) {
        log.error('delete_account.failed', { err: error });
        res.status(500).json({ success: false, error: 'Failed to delete account' });
    }
}
