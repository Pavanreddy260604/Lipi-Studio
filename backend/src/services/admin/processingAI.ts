import { MasterScript } from '../../models/MasterScript';
import { MasterScriptValidationReport } from '../../models/MasterScriptValidationReport';
import { masterScriptParserService } from '../masterScriptParser/index.js';
import { masterScriptValidatorService } from '../masterScriptValidator/index.js';
import { geAuditService, GeAuditResult } from '../geAudit.service';
import type { StartMasterScriptProcessingResult, GateStatus } from './types.js';
import {
    prepareManifest, resetVersionArtifacts, ensureSourceLayoutForVersion,
    createScriptVersion
} from './processingCore.js';
import { applySourceMetadata } from './helpers.js';
import { createSceneNodes, indexLeafElements } from './processingIndexing.js';

export async function startMasterScriptProcessing(scriptId: string): Promise<StartMasterScriptProcessingResult> {
    const script = await MasterScript.findById(scriptId);
    if (!script) throw new Error('Master script not found');

    if (script.status === 'processing') {
        return {
            scriptVersion: script.processingScriptVersion || script.activeScriptVersion || createScriptVersion(),
            gateStatus: (script.gateStatus as GateStatus) || 'pending'
        };
    }

    const scriptVersion = script.processingScriptVersion || createScriptVersion();
    script.processingScriptVersion = scriptVersion;
    script.gateStatus = 'pending';
    script.status = 'processing';
    script.progress = script.readerReady ? 5 : 0;
    script.processedChunks = 0;
    script.ragReady = false;
    script.lastValidationSummary = `Ingestion started for ${scriptVersion}`;
    await script.save();

    void processMasterScript(scriptId, scriptVersion).catch((error: any) => {
        console.error('[AdminService] Background ingestion failed for %s:', scriptId, error);
    });

    return { scriptVersion, gateStatus: 'pending' };
}

export async function processMasterScript(scriptId: string, scriptVersion?: string): Promise<void> {
    const script = await MasterScript.findById(scriptId);
    if (!script) throw new Error('Master script not found');

    const processingVersion = scriptVersion || script.processingScriptVersion || script.activeScriptVersion || createScriptVersion();
    const manifest = await prepareManifest(script._id, processingVersion);

    try {
        await resetVersionArtifacts(script._id, processingVersion, { preserveSourceLines: true });
        const extractedSource = await ensureSourceLayoutForVersion(script, processingVersion, manifest);

        script.status = 'processing';
        script.progress = 5;
        script.processedChunks = 0;
        script.processingScriptVersion = processingVersion;
        script.gateStatus = 'pending';
        script.readerReady = extractedSource.lines.length > 0;
        script.ragReady = false;
        applySourceMetadata(script, extractedSource);
        script.lastValidationSummary = `Parsing ${processingVersion}`;
        await script.save();

        const parsed = masterScriptParserService.parse(extractedSource, processingVersion);
        if (parsed.elements.length === 0) throw new Error('Structured parser produced no chunks');

        script.parserVersion = parsed.parserVersion;
        script.progress = 15;
        script.lastValidationSummary = `Parsed ${parsed.elements.length} structured chunks for ${processingVersion}`;
        await script.save();

        manifest.totalChunks = parsed.elements.length;
        manifest.titlePage = parsed.titlePage;
        manifest.readerReady = true;
        manifest.ragReady = false;
        await manifest.save();

        const sceneParentMap = await createSceneNodes(script, processingVersion, parsed.parserVersion, parsed.scenes, parsed.elements);
        script.progress = 35;
        script.lastValidationSummary = `Indexed ${parsed.scenes.length} scene nodes for ${processingVersion}`;
        await script.save();

        await indexLeafElements({
            script, processingVersion, parserVersion: parsed.parserVersion,
            elements: parsed.elements, scenes: parsed.scenes, sceneParentMap, manifest
        });

        script.status = 'validating';
        script.progress = 90;
        script.lastValidationSummary = `Running validation and GE audit for ${processingVersion}`;
        await script.save();

        const validation = await masterScriptValidatorService.validateScriptVersion(scriptId, processingVersion);
        const auditResult = await runGeAudit(scriptId, processingVersion);
        const ragReady = validation.passed;
        const gatePassed = ragReady && auditResult.status === 'passed';

        script.processingScriptVersion = gatePassed ? undefined : processingVersion;
        script.gateStatus = gatePassed ? 'passed' : 'failed';
        script.status = gatePassed ? 'indexed' : 'failed';
        script.progress = 100;
        script.processedChunks = manifest.successfulChunks;
        script.parserVersion = parsed.parserVersion;
        script.readerReady = true;
        script.ragReady = ragReady;
        script.lastValidationSummary = `${validation.report.summary} GE audit: ${auditResult.summary}`;
        if (gatePassed) script.activeScriptVersion = processingVersion;
        await script.save();

        manifest.status = manifest.failedChunks > 0 || !ragReady ? 'partial_success' : 'completed';
        manifest.gateStatus = gatePassed ? 'passed' : 'failed';
        manifest.geAuditStatus = auditResult.status;
        manifest.readerReady = true;
        manifest.ragReady = ragReady;
        await manifest.save();
    } catch (error: any) {
        script.processingScriptVersion = processingVersion;
        script.gateStatus = 'failed';
        script.status = 'failed';
        script.progress = script.readerReady ? 5 : 0;
        script.ragReady = false;
        script.lastValidationSummary = error?.message || 'Ingestion failed';
        await script.save();

        manifest.status = 'failed';
        manifest.gateStatus = 'failed';
        manifest.geAuditStatus = manifest.geAuditStatus || 'skipped';
        manifest.readerReady = script.readerReady || false;
        manifest.ragReady = false;
        manifest.errorLogs.push({ error: error?.message || 'Unknown error' });
        await manifest.save();

        console.error(`[AdminService] Final Error generating samples for ${script.title}:`, error);
        throw error;
    }
}

export async function runGeAudit(scriptId: string, scriptVersion?: string): Promise<GeAuditResult> {
    const script = await MasterScript.findById(scriptId).select('_id activeScriptVersion processingScriptVersion');
    if (!script) throw new Error('Master script not found');

    const resolvedScriptVersion = scriptVersion || script.activeScriptVersion || script.processingScriptVersion;
    if (!resolvedScriptVersion) throw new Error('No script version available for GE audit');

    const result = await geAuditService.runMasterScriptAudit(scriptId, resolvedScriptVersion);

    await MasterScriptValidationReport.findOneAndUpdate(
        { masterScriptId: script._id, scriptVersion: resolvedScriptVersion },
        {
            $set: { geAudit: result },
            $setOnInsert: {
                status: result.status === 'passed' ? 'passed' : 'failed',
                missingLines: [], extraLines: [], layoutMismatches: [],
                classificationMismatches: [], orderMismatches: [],
                reconstructionMismatch: false, hierarchyMismatches: [],
                summary: 'Validation report placeholder created from GE audit'
            }
        },
        { upsert: true, new: true }
    );
    return result;
}
