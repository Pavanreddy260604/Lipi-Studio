import express from 'express';
import { authenticate } from '../../middleware/auth.js';
import { beatSheetLimiter } from '../../middleware/rateLimiter.js';
import { listProjects, getProjectStatus, createProject, getProject, updateProject, deleteProject, exportProject } from './controller.js';
import { projectAssistant, generateBeatSheet, listStructures } from './ai.js';
import { addResource, uploadResource, deleteResource, listResources } from './resources.js';

const router = express.Router();

router.use(authenticate);

router.get('/', listProjects);
router.post('/', createProject);

router.get('/:id', getProject);
router.put('/:id', updateProject);
router.delete('/:id', deleteProject);
router.get('/:id/status', getProjectStatus);
router.get('/:id/export', exportProject);

router.post('/:id/assistant', projectAssistant);

router.post('/:id/beat-sheet', beatSheetLimiter, generateBeatSheet);
router.get('/:id/beat-sheet/structures', listStructures);

router.get('/:id/resources', listResources);
router.post('/:id/resources', addResource);
router.post('/:id/resources/upload', uploadResource);
router.delete('/:id/resources/:resourceId', deleteResource);

export const bibleRoutes = router;
