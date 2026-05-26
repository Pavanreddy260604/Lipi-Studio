import { Request, Response, NextFunction } from 'express';
import fs from 'fs';
import path from 'path';
import { Bible } from '../../models/Bible.js';
import { exportService } from '../../services/export.service.js';
import { projectStatusService } from '../../services/projectStatus/index.js';
import { assertBibleAccess, normalizeAssistantPreferences } from './utils.js';

export async function listProjects(req: Request, res: Response, _next: NextFunction) {
    const userId = req.userId;
    try {
        const bibles = await Bible.find({ userId }).sort({ createdAt: -1 });
        res.json({ success: true, data: bibles });
    } catch (error) {
        const msg = (error as Error).message;
        const stack = (error as Error).stack;
        try {
            fs.appendFileSync(path.join(__dirname, '../../error_log.txt'), `[${new Date().toISOString()}] List Error: ${msg}\nStack: ${stack}\nUser: ${userId}\n\n`);
        } catch { }
        console.error('[BibleAPI] List Error:', error);
        res.status(500).json({ error: 'Failed to fetch projects', requestId: Date.now().toString(36) });
    }
}

export async function getProjectStatus(req: Request, res: Response, _next: NextFunction) {
    try {
        const status = await projectStatusService.getProjectStatus(req.params.id, req.userId);
        res.json({ success: true, data: status });
    } catch (error) {
        if ((error as Error).message === 'ACCESS_DENIED') return res.status(403).json({ error: 'Access denied' });
        console.error('[BibleAPI] Status Error:', error);
        res.status(500).json({ error: 'Failed to fetch project status' });
    }
}

export async function createProject(req: Request, res: Response, _next: NextFunction) {
    const { title, logline, genre, tone, language, storyResources } = req.body;
    if (!req.userId || !title) return res.status(400).json({ error: 'User ID and Title are required' });
    try {
        const rawPreferences = req.body.assistantPreferences;
        const assistantPreferences = rawPreferences === undefined
            ? { defaultMode: 'ask' as const, savedDirectives: [] as string[] }
            : normalizeAssistantPreferences(rawPreferences);
        if (!assistantPreferences) return res.status(400).json({ error: 'Invalid assistantPreferences payload' });
        const newBible = await Bible.create({
            userId: req.userId, title, logline: logline || '', genre: genre || 'Drama',
            tone: tone || 'Serious', language: language || 'English', rules: [],
            storyResources: Array.isArray(storyResources) ? storyResources.map(r => ({
                title: typeof r.title === 'string' && r.title.trim() ? r.title.trim() : 'Untitled Resource',
                content: typeof r.content === 'string' ? r.content : '',
                type: ['synopsis', 'novel_excerpt', 'treatment', 'reference', 'notes', 'other'].includes(r.type) ? r.type : 'notes',
                sourceFilename: typeof r.sourceFilename === 'string' ? r.sourceFilename : undefined,
                addedAt: new Date()
            })) : [],
            assistantPreferences
        });
        res.json({ success: true, data: newBible });
    } catch (error) {
        const msg = (error as Error).message;
        if (msg === 'INVALID_ASSISTANT_DEFAULT_MODE' || msg === 'INVALID_ASSISTANT_DIRECTIVES') return res.status(400).json({ error: 'Invalid assistantPreferences payload' });
        console.error('[BibleAPI] Create Error:', error);
        res.status(500).json({ error: 'Failed to create project' });
    }
}

export async function getProject(req: Request, res: Response, _next: NextFunction) {
    try {
        const bible = await assertBibleAccess(req.params.id, req.userId);
        res.json({ success: true, data: bible });
    } catch (error) {
        if ((error as Error).message === 'ACCESS_DENIED') return res.status(403).json({ error: 'Access denied' });
        res.status(500).json({ error: 'Failed to fetch project' });
    }
}

export async function updateProject(req: Request, res: Response, _next: NextFunction) {
    try {
        const bible = await assertBibleAccess(req.params.id, req.userId);
        const allowedFields = ['title', 'logline', 'genre', 'tone', 'language', 'visualStyle', 'rules', 'storyResources', 'assistantPreferences'];
        const updateData: Record<string, unknown> = {};
        for (const field of allowedFields) { if (req.body[field] !== undefined) updateData[field] = req.body[field]; }
        if (updateData.title === '') return res.status(400).json({ error: 'Title cannot be empty' });
        const validGenres = ['Drama', 'Sci-Fi', 'Comedy', 'Thriller', 'Horror', 'Action', 'Romance', 'Documentary'];
        if (updateData.genre && !validGenres.includes(updateData.genre as string)) return res.status(400).json({ error: `Invalid genre. Allowed: ${validGenres.join(', ')}` });
        if (updateData.rules && !Array.isArray(updateData.rules)) return res.status(400).json({ error: 'Rules must be an array' });
        if (req.body.assistantPreferences !== undefined) {
            try {
                const normalizedPreferences = normalizeAssistantPreferences(req.body.assistantPreferences, bible.assistantPreferences as any);
                if (!normalizedPreferences) return res.status(400).json({ error: 'Invalid assistantPreferences payload' });
                updateData.assistantPreferences = normalizedPreferences;
            } catch (error) {
                const msg = (error as Error).message;
                if (msg === 'INVALID_ASSISTANT_DEFAULT_MODE' || msg === 'INVALID_ASSISTANT_DIRECTIVES') return res.status(400).json({ error: 'Invalid assistantPreferences payload' });
                throw error;
            }
        }
        const updatedBible = await Bible.findOneAndUpdate(
            { _id: req.params.id, userId: req.userId },
            { $set: updateData },
            { new: true, runValidators: true }
        );
        if (!updatedBible) return res.status(404).json({ error: 'Project not found' });
        res.json({ success: true, data: updatedBible });
    } catch (error) {
        console.error('[BibleAPI] Update Error:', error);
        res.status(500).json({ error: 'Failed to update project' });
    }
}

export async function deleteProject(req: Request, res: Response, _next: NextFunction) {
    try {
        const bibleId = req.params.id;
        await assertBibleAccess(bibleId, req.userId);
        
        const [
            { Scene },
            { Character },
            { Treatment },
            { VoiceSample },
            { CharacterFeedback },
            { LoreEntity },
            { LoreRelation }
        ] = await Promise.all([
            import('../../models/scene/index.js'),
            import('../../models/Character.js'),
            import('../../models/Treatment.js'),
            import('../../models/VoiceSample.js'),
            import('../../models/CharacterFeedback.js'),
            import('../../models/LoreEntity.js'),
            import('../../models/LoreRelation.js')
        ]);

        const { vectorService } = await import('../../services/vector/index.js');
        const { redisCache } = await import('../../services/redisCache.service.js');

        // Delete from Qdrant resiliently (do not let vector DB failure block DB deletion)
        try {
            await vectorService.deleteSamplesByBibleId(bibleId);
        } catch (err) {
            console.error('[BibleAPI] Qdrant vector deletion failed for bibleId:', bibleId, err);
        }

        // Run Mongoose deletions in parallel
        const [
            sceneResult,
            characterResult,
            treatmentResult,
            voiceResult,
            feedbackResult,
            loreEntityResult,
            loreRelationResult
        ] = await Promise.all([
            Scene.deleteMany({ bibleId }),
            Character.deleteMany({ bibleId }),
            Treatment.deleteMany({ bibleId }),
            VoiceSample.deleteMany({ bibleId }),
            CharacterFeedback.deleteMany({ bibleId }),
            LoreEntity.deleteMany({ bibleId }),
            LoreRelation.deleteMany({ bibleId })
        ]);

        // Delete the Bible itself
        await Bible.findByIdAndDelete(bibleId);

        // Invalidate associated Redis cache keys
        try {
            await redisCache.delPattern(`*${bibleId}*`);
        } catch (cacheErr) {
            console.error('[BibleAPI] Redis cache invalidation failed for bibleId:', bibleId, cacheErr);
        }

        res.json({
            success: true,
            data: {
                message: 'Project and all related data deleted',
                deleted: {
                    scenes: sceneResult.deletedCount || 0,
                    characters: characterResult.deletedCount || 0,
                    treatments: treatmentResult.deletedCount || 0,
                    voiceSamples: voiceResult.deletedCount || 0,
                    characterFeedback: feedbackResult.deletedCount || 0,
                    loreEntities: loreEntityResult.deletedCount || 0,
                    loreRelations: loreRelationResult.deletedCount || 0
                }
            }
        });
    } catch (error) {
        if ((error as Error).message === 'ACCESS_DENIED') return res.status(403).json({ error: 'Access denied' });
        console.error('[BibleAPI] Delete Error:', error);
        res.status(500).json({ error: 'Failed to delete project' });
    }
}

export async function exportProject(req: Request, res: Response, _next: NextFunction) {
    try {
        await assertBibleAccess(req.params.id, req.userId);
        const format = (req.query.format as 'fountain' | 'txt' | 'json' | 'pdf') || 'fountain';
        if (format === 'pdf') {
            const pdfBuffer = await exportService.generatePDF(req.params.id);
            res.header('Content-Type', 'application/pdf');
            res.header('Content-Disposition', 'attachment; filename="script.pdf"');
            res.send(pdfBuffer);
            return;
        }
        const content = await exportService.compileProject(req.params.id, format);
        if (format === 'json') {
            res.header('Content-Type', 'application/json');
            res.send(content);
        } else {
            res.header('Content-Type', 'text/plain');
            res.header('Content-Disposition', `attachment; filename="script.${format}"`);
            res.send(content);
        }
    } catch (error) {
        if ((error as Error).message === 'ACCESS_DENIED') return res.status(403).json({ error: 'Access denied' });
        console.error('[BibleAPI] Export Error:', error);
        res.status(500).json({ error: 'Failed to export project' });
    }
}
