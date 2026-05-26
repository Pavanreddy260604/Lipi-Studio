import { Router } from 'express';
import mongoose from 'mongoose';
import rateLimit from 'express-rate-limit';
import { voiceService } from '../../services/voice/index.js';
import { vectorService } from '../../services/vector/index.js';
import { authenticate } from '../../middleware/auth.js';
import { Bible } from '../../models/Bible';
import { VoiceSample } from '../../models/VoiceSample';
import { upload, validateSourceParam } from './config.js';

const router = Router();

const voiceRateLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 10,
    message: { success: false, error: 'Too many voice requests, please try again later.' }
});

router.use(authenticate);
router.use(voiceRateLimiter);

router.post('/ingest', upload.single('file'), async (req, res) => {
    try {
        const { bibleId, characterId, era } = req.body;
        const file = req.file;

        if (!file) {
            return res.status(400).json({ success: false, error: 'Missing file upload' });
        }

        if (!bibleId || typeof bibleId !== 'string') {
            return res.status(400).json({ success: false, error: 'Missing or invalid bibleId' });
        }

        if (characterId && typeof characterId !== 'string') {
            return res.status(400).json({ success: false, error: 'characterId must be a string' });
        }

        if (era && (typeof era !== 'string' || era.length > 100)) {
            return res.status(400).json({ success: false, error: 'era must be a string with max 100 characters' });
        }

        const bible = await Bible.findOne({ _id: bibleId, userId: req.userId });
        if (!bible) {
            return res.status(403).json({ success: false, error: 'Access denied for this project' });
        }

        const result = await voiceService.ingestReferenceMaterial(
            bibleId, file.buffer, file.mimetype, file.originalname, characterId, { era }
        );

        const payload = {
            count: result.savedCount,
            skippedDuplicates: result.skippedDuplicates,
            skippedShort: result.skippedShort,
            characters: result.characters,
            sceneCount: result.sceneCount,
            message: `Successfully ingested ${result.savedCount} samples (${result.skippedDuplicates} duplicates skipped, detected ${result.characters.length} characters).`
        };

        res.json({ success: true, data: payload });
    } catch (error: any) {
        console.error('Ingestion failed:', error);
        if (error.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({ success: false, error: 'File too large. Maximum size is 10MB.' });
        }
        if (error.code === 'LIMIT_FILE_COUNT') {
            return res.status(400).json({ success: false, error: 'Only one file can be uploaded at a time.' });
        }
        res.status(500).json({ success: false, error: error.message || 'Ingestion failed' });
    }
});

router.get('/sources', async (req, res) => {
    try {
        const { bibleId, characterId } = req.query;

        if (!bibleId) {
            return res.status(400).json({ success: false, error: 'Missing bibleId' });
        }

        const bible = await Bible.findOne({ _id: bibleId, userId: req.userId });
        if (!bible) {
            return res.status(403).json({ success: false, error: 'Access denied' });
        }

        const matchStage: any = {
            bibleId: new mongoose.Types.ObjectId(bibleId as string)
        };

        if (characterId) {
            matchStage.characterId = new mongoose.Types.ObjectId(characterId as string);
        }

        const sources = await VoiceSample.aggregate([
            { $match: matchStage },
            {
                $group: {
                    _id: '$source',
                    count: { $sum: 1 },
                    lastIngested: { $max: '$createdAt' },
                    characterIds: { $addToSet: '$characterId' }
                }
            },
            { $sort: { lastIngested: -1 } }
        ]);

        res.json({ success: true, data: sources, sources });
    } catch (error: any) {
        console.error('Fetch sources failed:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

router.delete('/delete-source', async (req, res) => {
    try {
        const { bibleId, characterId, source } = req.body;

        if (!bibleId || !source) {
            return res.status(400).json({ success: false, error: 'Missing bibleId or source' });
        }

        const validatedSource = validateSourceParam(source);
        if (!validatedSource) {
            return res.status(400).json({ success: false, error: 'Invalid source parameter' });
        }

        if (!mongoose.Types.ObjectId.isValid(bibleId)) {
            return res.status(400).json({ success: false, error: 'Invalid bibleId format' });
        }
        if (characterId && !mongoose.Types.ObjectId.isValid(characterId)) {
            return res.status(400).json({ success: false, error: 'Invalid characterId format' });
        }

        const bible = await Bible.findOne({ _id: bibleId, userId: req.userId });
        if (!bible) {
            return res.status(403).json({ success: false, error: 'Access denied' });
        }

        const deleteQuery: Record<string, unknown> = {
            bibleId: new mongoose.Types.ObjectId(bibleId),
            source: validatedSource
        };

        if (characterId && mongoose.Types.ObjectId.isValid(characterId)) {
            deleteQuery.characterId = new mongoose.Types.ObjectId(characterId);
        }

        const samplesToDelete = await VoiceSample.find(deleteQuery).select('_id').lean();
        const sampleIds = samplesToDelete.map((doc: any) => doc._id.toString());

        if (sampleIds.length > 0) {
            await vectorService.deleteSamplesByIds(sampleIds);
        }
        await vectorService.deleteSamplesBySource(
            bibleId, validatedSource,
            characterId && mongoose.Types.ObjectId.isValid(characterId) ? characterId : undefined
        );

        const result = await VoiceSample.deleteMany(deleteQuery);

        const payload = {
            deletedCount: result.deletedCount,
            message: `Deleted ${result.deletedCount} samples from source "${source}"`
        };

        res.json({ success: true, data: payload });
    } catch (error: any) {
        console.error('Delete source failed:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

export default router;
