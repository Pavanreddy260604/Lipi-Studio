import { Router } from 'express';
import mongoose from 'mongoose';
import multer from 'multer';
import { voiceService } from '../services/voice/index.js';
import { vectorService } from '../services/vector/index.js';
import { authenticate } from '../middleware/auth.js';
import { Bible } from '../models/Bible';
import { VoiceSample } from '../models/VoiceSample';
import path from 'path';

const router = Router();

// Configure multer with file filtering for security
const ALLOWED_EXTENSIONS = ['.pdf', '.txt', '.md', '.docx'];
const ALLOWED_MIME_TYPES = [
    'application/pdf',
    'text/plain',
    'text/markdown',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
];

const fileFilter = (req: Express.Request, file: Express.Multer.File, callback: multer.FileFilterCallback) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const isAllowedExt = ALLOWED_EXTENSIONS.includes(ext);
    const isAllowedMime = ALLOWED_MIME_TYPES.includes(file.mimetype);
    const isOctetStream = file.mimetype === 'application/octet-stream';

    if (isAllowedMime || (isOctetStream && isAllowedExt)) {
        callback(null, true);
    } else {
        callback(new Error(`Invalid file type. Allowed: ${ALLOWED_EXTENSIONS.join(', ')}`));
    }
};

const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 10 * 1024 * 1024, // 10MB cap to prevent abuse
        files: 1 // Only one file at a time
    },
    fileFilter: fileFilter
});

// Require auth for all voice routes
router.use(authenticate);

// POST /api/voice/ingest
router.post('/ingest', upload.single('file'), async (req, res) => {
    try {
        const { bibleId, characterId, era } = req.body;
        const file = req.file;

        // Input validation
        if (!file) {
            return res.status(400).json({ success: false, error: 'Missing file upload' });
        }

        if (!bibleId || typeof bibleId !== 'string' || !mongoose.Types.ObjectId.isValid(bibleId)) {
            return res.status(400).json({ success: false, error: 'Missing or invalid bibleId' });
        }

        // Validate characterId if provided
        if (characterId && typeof characterId !== 'string') {
            return res.status(400).json({ success: false, error: 'characterId must be a string' });
        }
        if (characterId && !mongoose.Types.ObjectId.isValid(characterId)) {
            return res.status(400).json({ success: false, error: 'Invalid characterId format' });
        }

        // Validate era if provided
        if (era && (typeof era !== 'string' || era.length > 100)) {
            return res.status(400).json({ success: false, error: 'era must be a string with max 100 characters' });
        }

        const bible = await Bible.findOne({ _id: bibleId, userId: req.userId });
        if (!bible) {
            return res.status(403).json({ success: false, error: 'Access denied for this project' });
        }

        const result = await voiceService.ingestReferenceMaterial(
            bibleId,
            file.buffer,
            file.mimetype,
            file.originalname,
            characterId, // Pass optional characterId
            { era }
        );

        const payload = {
            count: result.savedCount,
            skippedDuplicates: result.skippedDuplicates,
            skippedShort: result.skippedShort,
            characters: result.characters,
            sceneCount: result.sceneCount,
            message: `Successfully ingested ${result.savedCount} samples (${result.skippedDuplicates} duplicates skipped, detected ${result.characters.length} characters).`
        };

        res.json({
            success: true,
            data: payload,
        });

    } catch (error: any) {
        console.error('Ingestion failed:', error);
        // Handle multer errors
        if (error.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({ success: false, error: 'File too large. Maximum size is 10MB.' });
        }
        if (error.code === 'LIMIT_FILE_COUNT') {
            return res.status(400).json({ success: false, error: 'Only one file can be uploaded at a time.' });
        }
        res.status(500).json({ success: false, error: error.message || 'Ingestion failed' });
    }
});

// GET /api/voice/sources - List ingested sources
router.get('/sources', async (req, res) => {
    try {
        const { bibleId, characterId } = req.query;

        if (!bibleId) {
            return res.status(400).json({ success: false, error: 'Missing bibleId' });
        }
        if (!mongoose.Types.ObjectId.isValid(bibleId as string)) {
            return res.status(400).json({ success: false, error: 'Invalid bibleId format' });
        }
        if (characterId && !mongoose.Types.ObjectId.isValid(characterId as string)) {
            return res.status(400).json({ success: false, error: 'Invalid characterId format' });
        }

        // Verify access
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

        // Aggregate to find unique sources and counts
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

        res.json({
            success: true,
            data: sources,
            sources
        });

    } catch (error: any) {
        console.error('Fetch sources failed:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});


// Validation helper for source parameter (prevents NoSQL injection)
const validateSourceParam = (source: unknown): string | null => {
    if (typeof source !== 'string') {
        return null;
    }
    const normalized = source.trim();
    if (normalized.length === 0 || normalized.length > 255) {
        return null;
    }
    // Null bytes should never appear in user-visible source names.
    if (normalized.includes('\0')) {
        return null;
    }
    return normalized;
};

// DELETE /api/voice/delete-source - Delete a specific source
router.delete('/delete-source', async (req, res) => {
    try {
        const { bibleId, characterId, source } = req.body;

        if (!bibleId || !source) {
            return res.status(400).json({ success: false, error: 'Missing bibleId or source' });
        }

        // Validate source parameter to prevent NoSQL injection
        const validatedSource = validateSourceParam(source);
        if (!validatedSource) {
            return res.status(400).json({ success: false, error: 'Invalid source parameter' });
        }

        // Validate bibleId is a valid ObjectId
        if (!mongoose.Types.ObjectId.isValid(bibleId)) {
            return res.status(400).json({ success: false, error: 'Invalid bibleId format' });
        }
        if (characterId && !mongoose.Types.ObjectId.isValid(characterId)) {
            return res.status(400).json({ success: false, error: 'Invalid characterId format' });
        }

        // Verify access
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

        // Delete from vector DB first, then MongoDB to avoid stale vectors surviving a successful delete flow.
        const samplesToDelete = await VoiceSample.find(deleteQuery).select('_id').lean();
        const sampleIds = samplesToDelete.map((doc: any) => doc._id.toString());

        if (sampleIds.length > 0) {
            await vectorService.deleteSamplesByIds(sampleIds);
        }
        // Metadata-scope cleanup for any drifted vectors not present in MongoDB anymore.
        await vectorService.deleteSamplesBySource(
            bibleId,
            validatedSource,
            characterId && mongoose.Types.ObjectId.isValid(characterId) ? characterId : undefined
        );

        const result = await VoiceSample.deleteMany(deleteQuery);

        const payload = {
            deletedCount: result.deletedCount,
            message: `Deleted ${result.deletedCount} samples from source "${source}"`
        };

        res.json({
            success: true,
            data: payload,
        });

    } catch (error: any) {
        console.error('Delete source failed:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

export default router;
