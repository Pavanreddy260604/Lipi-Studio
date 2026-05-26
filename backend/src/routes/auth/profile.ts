import { Request, Response, NextFunction } from 'express';
import { User } from '../../models/User.js';
import { RefreshToken } from '../../models/RefreshToken.js';
import { hashToken } from '../../utils/jwt.js';
import { encrypt } from '../../utils/encryption.js';
import { logger } from '../../utils/logger.js';
import { updateProfileSchema, aiKeySchema, changePasswordSchema } from './validation.js';
import crypto from 'crypto';
import { emailService } from '../../services/email.service.js';

const log = logger.child({ module: 'auth' });

export async function getMe(req: Request, res: Response, _next: NextFunction) {
    try {
        const user = await User.findById(req.userId).select('-passwordHash -geminiApiKey -encryptionIV');
        if (!user) { res.status(404).json({ success: false, error: 'User not found' }); return; }
        res.json({ success: true, data: { user: user.toJSON() } });
    } catch (error) {
        log.error('get_user.failed', { err: error });
        res.status(500).json({ success: false, error: 'Failed to get user' });
    }
}

export async function updateProfile(req: Request, res: Response, _next: NextFunction) {
    try {
        const result = updateProfileSchema.safeParse(req.body);
        if (!result.success) { res.status(400).json({ success: false, error: result.error.issues[0].message }); return; }
        
        const { 
            email, 
            name, 
            timezone, 
            scriptInterests,
            theme,
            accentColor,
            customAccentColor,
            aiAccentColor,
            backgroundTinting,
            reducedMotion
        } = result.data;
        
        const currentUser = await User.findById(req.userId);
        if (!currentUser) { res.status(404).json({ success: false, error: 'User not found' }); return; }

        let emailChanged = false;
        if (email && email.toLowerCase() !== currentUser.email.toLowerCase()) {
            const existing = await User.findOne({ email: email.toLowerCase(), _id: { $ne: req.userId } });
            if (existing) {
                res.status(400).json({ success: false, error: 'Email is already in use by another account' });
                return;
            }
            currentUser.email = email.toLowerCase();
            currentUser.emailVerified = false;
            emailChanged = true;
            
            // Generate a secure 6-digit code
            const verificationCode = crypto.randomInt(100000, 999999).toString();
            currentUser.verificationToken = crypto.createHash('sha256').update(verificationCode).digest('hex');
            currentUser.verificationExpiry = new Date(Date.now() + 15 * 60 * 1000);
            
            // Send verification email asynchronously
            emailService.sendVerificationEmail(currentUser.email, verificationCode).catch(err => {
                log.error('update_profile.send_verification.failed', { err, email: currentUser.email });
            });
        }

        if (name !== undefined) currentUser.name = name;
        if (timezone !== undefined) currentUser.timezone = timezone;
        if (scriptInterests !== undefined) currentUser.scriptInterests = scriptInterests;
        if (theme !== undefined) currentUser.theme = theme;
        if (accentColor !== undefined) currentUser.accentColor = accentColor;
        if (customAccentColor !== undefined) currentUser.customAccentColor = customAccentColor;
        if (aiAccentColor !== undefined) currentUser.aiAccentColor = aiAccentColor;
        if (backgroundTinting !== undefined) currentUser.backgroundTinting = backgroundTinting;
        if (reducedMotion !== undefined) currentUser.reducedMotion = reducedMotion;

        await currentUser.save();

        res.json({ 
            success: true, 
            data: { 
                user: currentUser.toJSON(), 
                emailChanged,
                message: emailChanged 
                    ? 'Profile updated. A new email verification code has been sent to your email.' 
                    : 'Profile updated successfully.' 
            } 
        });
    } catch (error) {
        log.error('update_profile.failed', { err: error });
        res.status(500).json({ success: false, error: 'Failed to update profile' });
    }
}

export async function updateAiKey(req: Request, res: Response, _next: NextFunction) {
    try {
        const result = aiKeySchema.safeParse(req.body ?? {});
        if (!result.success) return res.status(400).json({ success: false, error: result.error.issues[0].message });
        const { apiKey } = result.data;
        const { iv, encryptedData } = encrypt(apiKey);
        const user = await User.findByIdAndUpdate(req.userId, { $set: { geminiApiKey: encryptedData, encryptionIV: iv } }, { new: true, runValidators: true });
        if (!user) return res.status(404).json({ success: false, error: 'User not found' });
        res.json({ success: true, data: { message: 'AI Key updated securely' } });
    } catch (error) {
        log.error('update_ai_key.failed', { err: error });
        res.status(500).json({ success: false, error: 'Failed to update AI key' });
    }
}

export async function changePassword(req: Request, res: Response, _next: NextFunction) {
    try {
        const result = changePasswordSchema.safeParse(req.body);
        if (!result.success) return res.status(400).json({ success: false, error: result.error.issues[0].message });
        const { currentPassword, newPassword } = result.data;
        const user = await User.findById(req.userId);
        if (!user) return res.status(404).json({ success: false, error: 'User not found' });
        const isValid = await user.comparePassword(currentPassword);
        if (!isValid) return res.status(401).json({ success: false, error: 'Incorrect current password' });
        user.passwordHash = newPassword;
        await user.save();
        await RefreshToken.deleteMany({ userId: user._id, token: { $ne: hashToken(req.cookies?.refreshToken || '') } });
        res.json({ success: true, data: { message: 'Password changed successfully' } });
    } catch (error) {
        log.error('change_password.failed', { err: error });
        res.status(500).json({ success: false, error: 'Failed to change password' });
    }
}
