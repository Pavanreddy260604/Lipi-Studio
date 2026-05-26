import express from 'express';
import { authenticate } from '../../middleware/auth.js';
import { listScenesByBible, createScene, updateScene, deleteScene } from './controller.js';
import { generateContent, critiqueScene, fixScene, commitEdit, assistedEdit } from './ai.js';
import { aiLimiter, aiCritiqueLimiter } from '../../middleware/rateLimiter.js';

const router = express.Router();

router.use(authenticate);

router.post('/', createScene);
router.put('/:id', updateScene);
router.delete('/:id', deleteScene);

router.get('/bible/:bibleId', listScenesByBible);

router.post('/:id/generate', aiLimiter, generateContent);
router.post('/:id/critique', aiCritiqueLimiter, critiqueScene);
router.post('/:id/fix', aiCritiqueLimiter, fixScene);
router.post('/:id/commit-edit', aiLimiter, commitEdit);
router.post('/:id/assisted-edit', aiLimiter, assistedEdit);

export const sceneRoutes = router;
