import { Router } from 'express';
import { characterService } from '../services/character/index.js';
import { authenticate, requireAdmin } from '../middleware/auth.js';
import { Bible } from '../models/Bible';
import { Character } from '../models/Character';
import { CharacterFeedback } from '../models/CharacterFeedback';
import { castingDirectorService } from '../services/castingDirector.service.js';

const router = Router();

router.use(authenticate);

async function assertBibleAccess(bibleId: string, userId?: string) {
    const bible = await Bible.findOne({ _id: bibleId, userId });
    if (!bible) {
        throw new Error('ACCESS_DENIED');
    }
    return bible;
}

async function assertCharacterAccess(characterId: string, userId?: string) {
    const character = await Character.findById(characterId);
    if (!character) return null;
    await assertBibleAccess(character.bibleId.toString(), userId);
    return character;
}

// GET /api/character/bible/:bibleId
router.get('/bible/:bibleId', async (req, res) => {
    try {
        const { bibleId } = req.params;
        await assertBibleAccess(bibleId, req.userId);
        const characters = await characterService.getCharactersByBible(bibleId);
        res.json({ success: true, data: characters });
    } catch (error: any) {
        if (error.message === 'ACCESS_DENIED') {
            return res.status(403).json({ success: false, error: 'Access denied' });
        }
        res.status(500).json({ success: false, error: error.message });
    }
});

// GET /api/character/:id
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const character = await assertCharacterAccess(id, req.userId);
        if (!character) {
            return res.status(404).json({ success: false, error: 'Character not found' });
        }
        res.json({ success: true, data: character });
    } catch (error: any) {
        if (error.message === 'ACCESS_DENIED') {
            return res.status(403).json({ success: false, error: 'Access denied' });
        }
        res.status(500).json({ success: false, error: error.message });
    }
});

// POST /api/character/generate-profile
router.post('/generate-profile', async (req, res) => {
    try {
        const { bibleId, prompt, name } = req.body;
        if (!bibleId) {
            return res.status(400).json({ success: false, error: 'Bible ID is required' });
        }
        await assertBibleAccess(bibleId, req.userId);
        const profile = await characterService.generateCharacterProfile(bibleId, prompt, name);
        res.json({ success: true, data: profile });
    } catch (error: any) {
        if (error.message === 'ACCESS_DENIED') {
            return res.status(403).json({ success: false, error: 'Access denied' });
        }
        res.status(500).json({ success: false, error: error.message });
    }
});

// POST /api/character
router.post('/', async (req, res) => {
    try {
        const { bibleId } = req.body;
        await assertBibleAccess(bibleId, req.userId);
        const character = await characterService.createCharacter({ ...req.body, bibleId });
        res.json({ success: true, data: character });
    } catch (error: any) {
        if (error.message === 'ACCESS_DENIED') {
            return res.status(403).json({ success: false, error: 'Access denied' });
        }
        res.status(500).json({ success: false, error: error.message });
    }
});

// PUT /api/character/:id
router.put('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        await assertCharacterAccess(id, req.userId);

        // Whitelist allowed fields to prevent mass assignment
        const allowedFields = ['name', 'age', 'role', 'voice', 'traits', 'motivation', 'isHero', 'historyLogs'];
        const updateData: Record<string, unknown> = {};

        for (const field of allowedFields) {
            if (req.body[field] !== undefined) {
                updateData[field] = req.body[field];
            }
        }

        // Validate role enum
        const validRoles = ['protagonist', 'antagonist', 'supporting', 'minor'];
        if (updateData.role && !validRoles.includes(updateData.role as string)) {
            return res.status(400).json({ success: false, error: `Invalid role. Allowed: ${validRoles.join(', ')}` });
        }

        // Validate age is positive
        if (updateData.age !== undefined && (typeof updateData.age !== 'number' || updateData.age < 0)) {
            return res.status(400).json({ success: false, error: 'Age must be a positive number' });
        }

        // Validate name is not empty
        if (updateData.name === '') {
            return res.status(400).json({ success: false, error: 'Name cannot be empty' });
        }

        // Validate traits is an array
        if (updateData.traits && !Array.isArray(updateData.traits)) {
            return res.status(400).json({ success: false, error: 'Traits must be an array' });
        }

        const character = await characterService.updateCharacter(id, updateData);
        if (!character) {
            return res.status(404).json({ success: false, error: 'Character not found' });
        }
        res.json({ success: true, data: character });
    } catch (error: any) {
        if (error.message === 'ACCESS_DENIED') {
            return res.status(403).json({ success: false, error: 'Access denied' });
        }
        res.status(500).json({ success: false, error: error.message });
    }
});

// DELETE /api/character/:id
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        await assertCharacterAccess(id, req.userId);
        const success = await characterService.deleteCharacter(id);
        if (!success) {
            return res.status(404).json({ success: false, error: 'Character not found' });
        }
        res.json({ success: true, message: 'Character deleted' });
    } catch (error: any) {
        if (error.message === 'ACCESS_DENIED') {
            return res.status(403).json({ success: false, error: 'Access denied' });
        }
        res.status(500).json({ success: false, error: error.message });
    }
});

// POST /api/character/feedback
router.post('/feedback', async (req, res) => {
    try {
        const { bibleId, characterId, mistakeContext, userCorrection, category } = req.body;
        if (!bibleId || !mistakeContext || !userCorrection) {
            return res.status(400).json({ success: false, error: 'bibleId, mistakeContext, and userCorrection are required' });
        }
        await assertBibleAccess(bibleId, req.userId);
        
        const feedback = await CharacterFeedback.create({
            bibleId,
            characterId: characterId || undefined,
            mistakeContext,
            userCorrection,
            category: category || 'voice'
        });
        res.json({ success: true, data: feedback });
    } catch (error: any) {
        if (error.message === 'ACCESS_DENIED') {
            return res.status(403).json({ success: false, error: 'Access denied' });
        }
        res.status(500).json({ success: false, error: error.message });
    }
});

// POST /api/character/bible/:bibleId/proactive-casting
router.post('/bible/:bibleId/proactive-casting', async (req, res) => {
    try {
        const { bibleId } = req.params;
        await assertBibleAccess(bibleId, req.userId);
        const proposed = await castingDirectorService.generateProactiveCastingCall(bibleId);
        res.json({ success: true, data: proposed });
    } catch (error: any) {
        if (error.message === 'ACCESS_DENIED') {
            return res.status(403).json({ success: false, error: 'Access denied' });
        }
        res.status(500).json({ success: false, error: error.message });
    }
});

// POST /api/character/bible/:bibleId/audit-scene-cast
router.post('/bible/:bibleId/audit-scene-cast', async (req, res) => {
    try {
        const { bibleId } = req.params;
        const { sceneGoal, instruction } = req.body;
        await assertBibleAccess(bibleId, req.userId);
        const auditResult = await castingDirectorService.auditSceneCast(bibleId, sceneGoal || '', instruction || '');
        res.json({ success: true, data: auditResult });
    } catch (error: any) {
        if (error.message === 'ACCESS_DENIED') {
            return res.status(403).json({ success: false, error: 'Access denied' });
        }
        res.status(500).json({ success: false, error: error.message });
    }
});

// POST /api/character/bible/:bibleId/ignore-character
router.post('/bible/:bibleId/ignore-character', async (req, res) => {
    try {
        const { bibleId } = req.params;
        const { name } = req.body;
        if (!name) {
            return res.status(400).json({ success: false, error: 'name is required' });
        }
        const bible = await assertBibleAccess(bibleId, req.userId);
        const cleanName = name.toLowerCase().trim();
        if (bible.ignoredCharacterNames && !bible.ignoredCharacterNames.includes(cleanName)) {
            bible.ignoredCharacterNames.push(cleanName);
            await bible.save();
        } else if (!bible.ignoredCharacterNames) {
            bible.ignoredCharacterNames = [cleanName];
            await bible.save();
        }
        res.json({ success: true, data: bible.ignoredCharacterNames });
    } catch (error: any) {
        if (error.message === 'ACCESS_DENIED') {
            return res.status(403).json({ success: false, error: 'Access denied' });
        }
        res.status(500).json({ success: false, error: error.message });
    }
});

// GET /api/character/bible/:bibleId/rlhf-metrics
router.get('/bible/:bibleId/rlhf-metrics', requireAdmin, async (req, res) => {
    try {
        const { bibleId } = req.params;
        const bible = await assertBibleAccess(bibleId, req.userId);

        const feedbacks = await CharacterFeedback.find({ bibleId });
        const approvedCount = await Character.countDocuments({ bibleId });
        const ignoredCount = bible.ignoredCharacterNames?.length || 0;

        const totalFeedbacks = feedbacks.length;
        const feedbacksByCategory = {
            voice: feedbacks.filter(f => f.category === 'voice').length,
            trait: feedbacks.filter(f => f.category === 'trait').length,
            lore: feedbacks.filter(f => f.category === 'lore').length,
            relationship: feedbacks.filter(f => f.category === 'relationship').length,
            global_casting: feedbacks.filter(f => f.category === 'global_casting').length,
        };

        const totalCastingProposed = approvedCount + ignoredCount + totalFeedbacks;
        const accuracyScore = totalCastingProposed > 0 
            ? Math.round((approvedCount / totalCastingProposed) * 100)
            : 100;

        const recentFeedbacks = await CharacterFeedback.find({ bibleId })
            .sort({ createdAt: -1 })
            .limit(5)
            .populate('characterId');

        res.json({
            success: true,
            data: {
                totalFeedbacks,
                feedbacksByCategory,
                accuracyScore,
                ignoredCount,
                recentFeedbacks
            }
        });
    } catch (error: any) {
        if (error.message === 'ACCESS_DENIED') {
            return res.status(403).json({ success: false, error: 'Access denied' });
        }
        res.status(500).json({ success: false, error: error.message });
    }
});

// POST /api/character/bible/:bibleId/bulk-casting
router.post('/bible/:bibleId/bulk-casting', async (req, res) => {
    try {
        const { bibleId } = req.params;
        const { approvedCharacters, ignoredNames, locations, extras } = req.body;
        const bible = await assertBibleAccess(bibleId, req.userId);

        // 1. Process Approved Characters
        if (Array.isArray(approvedCharacters) && approvedCharacters.length > 0) {
            for (const char of approvedCharacters) {
                let existing = await Character.findOne({
                    bibleId,
                    name: { $regex: new RegExp(`^${char.name}$`, 'i') }
                });
                if (existing) {
                    existing.role = char.role || existing.role;
                    existing.traits = char.traits || existing.traits;
                    existing.motivation = char.motivation || existing.motivation;
                    if (char.voiceDescription) {
                        existing.voice = {
                            description: char.voiceDescription,
                            sampleLines: char.sampleLines || existing.voice?.sampleLines || []
                        };
                    }
                    await existing.save();
                } else {
                    await Character.create({
                        bibleId,
                        name: char.name,
                        role: char.role || 'supporting',
                        traits: char.traits || [],
                        motivation: char.motivation || '',
                        voice: {
                            description: char.voiceDescription || 'Clear speaking voice',
                            sampleLines: char.sampleLines || []
                        },
                        currentStatus: 'Stable'
                    });
                }
            }
        }

        // 2. Process Ignored Names (excluders/ignore list) with two-way synchronization and deduplication
        if (Array.isArray(ignoredNames)) {
            const currentIgnored = bible.ignoredCharacterNames || [];
            const incomingNormalized = ignoredNames
                .map((n: string) => n.trim().toLowerCase())
                .filter(Boolean);

            // Find newly added names to log RLHF feedback (avoiding duplicate feedbacks)
            const newlyAdded = incomingNormalized.filter(name => !currentIgnored.includes(name));

            for (const name of newlyAdded) {
                await CharacterFeedback.create({
                    bibleId,
                    mistakeContext: `AI proposed character casting: ${name}`,
                    userCorrection: `Reject character "${name}". The writer wants to avoid flat, unnecessary extra characters like ${name} in the cast list. Keep the focus on core characters and write extras directly in action blocks without creating full cast profiles.`,
                    category: 'global_casting'
                });
            }

            // Sync the ignored list in the database
            bible.ignoredCharacterNames = incomingNormalized;
            await bible.save();
        }

        res.json({ success: true, message: 'Bulk casting processed successfully' });
    } catch (error: any) {
        if (error.message === 'ACCESS_DENIED') {
            return res.status(403).json({ success: false, error: 'Access denied' });
        }
        res.status(500).json({ success: false, error: error.message });
    }
});

export const characterRoutes = router;
