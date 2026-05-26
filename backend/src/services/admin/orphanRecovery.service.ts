import { MasterScript } from '../../models/MasterScript.js';
import { IngestionManifest } from '../../models/IngestionManifest.js';
import { Scene } from '../../models/scene/index.js';
import { VoiceSample } from '../../models/VoiceSample.js';
import { Bible } from '../../models/Bible.js';
import { vectorService } from '../vector/index.js';

export class OrphanRecoveryService {
    async runStartupRecovery(): Promise<void> {
        console.log('[OrphanRecovery] Running startup integrity checks and recovery...');
        try {
            await this.recoverStuckMasterScripts();
            await this.clearStalePendingSceneContent();
            await this.cleanupOrphanedVoiceSamples();
            await this.cleanupOrphanedScenes();
            console.log('[OrphanRecovery] Startup integrity checks and recovery completed successfully.');
        } catch (error) {
            console.error('[OrphanRecovery] Error during startup recovery:', error);
        }
    }

    /**
     * Finds MasterScripts stuck in 'processing' or 'validating' state and resets them to 'failed'.
     * Also updates their ingestion manifests accordingly.
     */
    private async recoverStuckMasterScripts(): Promise<void> {
        const stuckScripts = await MasterScript.find({
            status: { $in: ['processing', 'validating'] }
        });

        if (stuckScripts.length === 0) {
            return;
        }

        console.log(`[OrphanRecovery] Found ${stuckScripts.length} master scripts stuck in processing/validating state. Resetting to failed.`);

        for (const script of stuckScripts) {
            script.status = 'failed';
            script.gateStatus = 'failed';
            script.lastValidationSummary = 'Interrupted by server restart/shutdown. Please re-upload or re-process.';
            await script.save();

            // Also fail any ingestion manifest in pending/processing status for this script
            await IngestionManifest.updateMany(
                {
                    targetId: script._id,
                    jobType: 'master_script',
                    status: { $in: ['pending', 'processing'] }
                },
                {
                    $set: {
                        status: 'failed',
                        errorLogs: [{
                            error: 'Job processing was interrupted by server restart.'
                        }]
                    }
                }
            );

            console.log(`[OrphanRecovery] Reset script "${script.title}" (ID: ${script._id}) to failed.`);
        }
    }

    /**
     * Clears Scene pendingContent that has been left unused and updated more than 1 hour ago.
     */
    private async clearStalePendingSceneContent(): Promise<void> {
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
        
        const result = await Scene.updateMany(
            {
                pendingContent: { $exists: true, $ne: '' },
                updatedAt: { $lt: oneHourAgo }
            },
            {
                $set: { pendingContent: '' }
            }
        );

        if (result.modifiedCount > 0) {
            console.log(`[OrphanRecovery] Cleared stale pendingContent for ${result.modifiedCount} scene(s) older than 1 hour.`);
        }
    }

    /**
     * Deletes VoiceSamples (MongoDB & Qdrant) that reference a non-existent MasterScript.
     */
    private async cleanupOrphanedVoiceSamples(): Promise<void> {
        const masterScripts = await MasterScript.find().select('_id').lean();
        const activeScriptIds = masterScripts.map(s => s._id.toString());

        // Find samples whose masterScriptId is not in activeScriptIds
        const orphanedSamples = await VoiceSample.find({
            masterScriptId: { $nin: activeScriptIds }
        }).select('masterScriptId').lean();

        if (orphanedSamples.length === 0) {
            return;
        }

        const uniqueOrphanedScriptIds = Array.from(
            new Set(
                orphanedSamples
                    .map(s => s.masterScriptId?.toString())
                    .filter((id): id is string => !!id)
            )
        );

        console.log(`[OrphanRecovery] Found orphaned VoiceSamples. Deleting vectors for ${uniqueOrphanedScriptIds.length} unique non-existent script IDs.`);

        for (const scriptId of uniqueOrphanedScriptIds) {
            try {
                await vectorService.deleteSamplesByMasterScriptId(scriptId);
                console.log(`[OrphanRecovery] Deleted orphaned vectors in Qdrant for masterScriptId: ${scriptId}`);
            } catch (err) {
                console.error(`[OrphanRecovery] Failed to delete Qdrant vectors for orphaned masterScriptId ${scriptId}:`, err);
            }
        }

        const deleteResult = await VoiceSample.deleteMany({
            masterScriptId: { $nin: activeScriptIds }
        });

        if (deleteResult.deletedCount > 0) {
            console.log(`[OrphanRecovery] Deleted ${deleteResult.deletedCount} orphaned VoiceSample documents from MongoDB.`);
        }
    }

    /**
     * Deletes Scenes that reference a non-existent Bible.
     */
    private async cleanupOrphanedScenes(): Promise<void> {
        const bibles = await Bible.find().select('_id').lean();
        const activeBibleIds = bibles.map(b => b._id.toString());

        const deleteResult = await Scene.deleteMany({
            bibleId: { $nin: activeBibleIds }
        });

        if (deleteResult.deletedCount > 0) {
            console.log(`[OrphanRecovery] Cleaned up ${deleteResult.deletedCount} orphaned Scene document(s) from MongoDB.`);
        }
    }
}

export const orphanRecoveryService = new OrphanRecoveryService();
