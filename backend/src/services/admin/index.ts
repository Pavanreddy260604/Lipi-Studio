import { GeAuditResult } from '../geAudit.service';
import type { StartMasterScriptProcessingResult, CreateMasterScriptInput } from './types.js';
import { startMasterScriptProcessing, processMasterScript, runGeAudit } from './processing.js';
import { getAllMasterScripts, createMasterScript, getMasterScriptChunks, getMasterScriptReconstructedScript, getMasterScriptValidationReport, deleteMasterScript } from './queries.js';

export class AdminService {
    startMasterScriptProcessing(scriptId: string): Promise<StartMasterScriptProcessingResult> {
        return startMasterScriptProcessing(scriptId);
    }
    processMasterScript(scriptId: string, scriptVersion?: string): Promise<void> {
        return processMasterScript(scriptId, scriptVersion);
    }
    getAllMasterScripts(userId: string) {
        return getAllMasterScripts(userId);
    }
    createMasterScript(userId: string, data: CreateMasterScriptInput) {
        return createMasterScript(userId, data);
    }
    getMasterScriptChunks(scriptId: string, scriptVersion?: string) {
        return getMasterScriptChunks(scriptId, scriptVersion);
    }
    getMasterScriptReconstructedScript(scriptId: string, scriptVersion?: string) {
        return getMasterScriptReconstructedScript(scriptId, scriptVersion);
    }
    getMasterScriptValidationReport(scriptId: string, scriptVersion?: string) {
        return getMasterScriptValidationReport(scriptId, scriptVersion);
    }
    runGeAudit(scriptId: string, scriptVersion?: string): Promise<GeAuditResult> {
        return runGeAudit(scriptId, scriptVersion);
    }
    deleteMasterScript(scriptId: string): Promise<void> {
        return deleteMasterScript(scriptId);
    }
}

export const adminService = new AdminService();
