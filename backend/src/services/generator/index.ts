import mongoose from 'mongoose';
import { generateScript, generateAdvancedScript } from './generate.js';
import { assistedEdit } from './assistedEditCore.js';
import { assistProject, commitAssistedEdit, discardAssistedEdit } from './assistedEditProject.js';
import { reviseSceneBatch, generateAuditNotes } from './assistedEditBatch.js';
import { waitForBackgroundTasks } from './background.js';

export class ScriptGeneratorService {
    async *generateScript(request: any) { yield* generateScript(request); }
    async *generateAdvancedScript(request: any) { yield* generateAdvancedScript(request); }
    async *assistedEdit(sceneId: string, instruction: string, options: any) { yield* assistedEdit(sceneId, instruction, options ?? {}); }
    async *assistProject(bibleId: string, instruction: string, options: any) { yield* assistProject(bibleId, instruction, options ?? {}); }
    async commitAssistedEdit(sceneId: string) { return commitAssistedEdit(sceneId); }
    async discardAssistedEdit(sceneId: string) { return discardAssistedEdit(sceneId); }
    async reviseSceneBatch(originalContent: string, critique: any, goal: string, isSecondAttempt: boolean = false, targetScore: number = 0, language: string = 'English', bibleId?: string | mongoose.Types.ObjectId, sceneId?: string | mongoose.Types.ObjectId, instruction?: string) { return reviseSceneBatch(originalContent, critique, goal, isSecondAttempt, targetScore, language, bibleId, sceneId, instruction); }
    async generateAuditNotes(original: string, revised: string) { return generateAuditNotes(original, revised); }
    async waitForBackgroundTasks() { return waitForBackgroundTasks(); }
}

export const scriptGenerator = new ScriptGeneratorService();
