import mongoose from 'mongoose';
import type { Request, Response, NextFunction } from 'express';

// Path-param names that, in this codebase, refer to MongoDB ObjectIds.
const OBJECT_ID_PARAMS = new Set([
    'id',
    'userId',
    'sessionId',
    'projectId',
    'scriptId',
    'sceneId',
    'characterId',
    'treatmentId',
]);

export const isValidObjectId = (v?: string | null): boolean =>
    Boolean(v && mongoose.Types.ObjectId.isValid(v));

export const toObjectId = (value: string): mongoose.Types.ObjectId =>
    new mongoose.Types.ObjectId(value);

/**
 * Express middleware that rejects requests whose route params look like a
 * MongoDB ObjectId param (id, projectId, ...) but aren't actually valid ObjectIds.
 * Stops the silent-null/404 enumeration pattern.
 */
export const validateObjectIdParams = (req: Request, res: Response, next: NextFunction) => {
    for (const [key, value] of Object.entries(req.params)) {
        if (!OBJECT_ID_PARAMS.has(key)) continue;
        if (typeof value !== 'string' || !mongoose.Types.ObjectId.isValid(value)) {
            return res.status(400).json({ success: false, error: `Invalid ${key}` });
        }
    }
    next();
};
