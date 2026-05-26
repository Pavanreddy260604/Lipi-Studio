import mongoose from 'mongoose';
import { extractTextFromFile } from '../../utils/fileParser/index.js';
import { VoiceSample } from '../../models/VoiceSample';
import { aiServiceManager } from '../aiManager/index.js';
import { vectorService } from '../vector/index.js';
import { chunkerService, DialogueChunk } from '../chunker/index.js';
import { Character } from '../../models/Character';
import type { IngestionResult } from './types.js';
import { escapeRegExp } from '../../utils/security.js';

export class VoiceService {
    async ingestReferenceMaterial(
        bibleId: string,
        fileBuffer: Buffer,
        mimeType: string,
        sourceName: string,
        characterId?: string,
        options?: {
            minDialogueLength?: number;
            characterFilter?: string[];
            era?: string;
        }
    ): Promise<IngestionResult> {
        if (!mongoose.Types.ObjectId.isValid(bibleId)) throw new Error('Invalid bibleId');
        let fullText = await extractTextFromFile(fileBuffer, mimeType, sourceName);

        const parseResult = await chunkerService.parseScreenplay(fullText);

        await this.replaceSourceScope(bibleId, sourceName, characterId);

        if (process.env.NODE_ENV !== 'production') {
            console.log(`[VoiceService] Parsed ${sourceName}:`);
            console.log(`  - Scenes: ${parseResult.sceneCount}`);
            console.log(`  - Characters: ${parseResult.characters.join(', ')}`);
            console.log(`  - Dialogue chunks: ${parseResult.stats.dialogueCount}`);
            console.log(`  - Action chunks: ${parseResult.stats.actionCount}`);
            console.log(`  - Avg dialogue length: ${parseResult.stats.avgDialogueLength} chars`);
            if (options?.era) {
                console.log(`  - Era Context: ${options.era}`);
            }
        }

        let dialogueChunks = chunkerService.extractDialogueForIngestion(parseResult, {
            minLength: options?.minDialogueLength ?? 20,
            maxLength: 2000,
            characterFilter: options?.characterFilter
        });

        if (dialogueChunks.length === 0 && characterId) {
            if (process.env.NODE_ENV !== 'production') { console.log(`[VoiceService] No dialogue found. Falling back to action chunks for character ${characterId}`); }

            const actionChunks = parseResult.chunks.filter(c => c.type === 'action');

            if (actionChunks.length > 0) {
                dialogueChunks = actionChunks.map(c => ({
                    ...c,
                    type: 'dialogue' as const,
                    speaker: 'TARGET',
                }));
            }
        }

        if (process.env.NODE_ENV !== 'production') { console.log(`[VoiceService] Processing ${dialogueChunks.length} dialogue chunks for ingestion`); }

        if (process.env.NODE_ENV !== 'production') { console.log(`[VoiceService] Pre-creating ${Math.ceil(dialogueChunks.length / 4)} Beat Nodes...`); }
        const BEAT_SIZE = 4;
        const beatIds: (mongoose.Types.ObjectId | undefined)[] = new Array(dialogueChunks.length).fill(undefined);

        for (let i = 0; i < dialogueChunks.length; i += BEAT_SIZE) {
            const beatChunks = dialogueChunks.slice(i, i + BEAT_SIZE);
            if (beatChunks.length === 0) continue;

            const beatText = beatChunks.map(c => `[${c.speaker}] ${c.content}`).join('\n');
            const beatEmbedding = await aiServiceManager.generateEmbedding(`BEAT CONTEXT:\n${beatText}`);
            const beatHash = chunkerService.generateContentHash(`${sourceName}|BEAT|${i}|${beatText}`);

            const beatNode = await VoiceSample.create({
                bibleId: new mongoose.Types.ObjectId(bibleId),
                content: beatText,
                contentHash: beatHash,
                chunkType: 'context',
                chunkIndex: i,
                embedding: beatEmbedding,
                isHierarchicalNode: true,
                source: `${sourceName} (Beat)`,
                tags: ['auto-ingested', 'beat-node']
            });
            await vectorService.upsertSample({
                id: beatNode._id.toString(),
                content: beatText,
                embedding: beatEmbedding,
                metadata: {
                    bibleId: bibleId.toString(),
                    contentHash: beatHash,
                    chunkType: 'context',
                    chunkIndex: i,
                    isHierarchicalNode: true,
                    tags: ['auto-ingested', 'beat-node'],
                    source: `${sourceName} (Beat)`
                }
            });

            for (let j = 0; j < beatChunks.length; j++) {
                if (i + j < beatIds.length) beatIds[i + j] = beatNode._id as mongoose.Types.ObjectId;
            }
        }

        let savedCount = 0;
        let skippedDuplicates = 0;
        let skippedShort = 0;
        let errorCount = 0;

        const CONCURRENCY_LIMIT = 10;
        const BATCH_DELAY_MS = 100;

        const processChunk = async (chunk: any, globalIdx: number): Promise<{ success: boolean; reason?: string }> => {
            try {
                const contentHash = chunkerService.generateContentHash(
                    `${sourceName}|${chunk.chunkIndex}|${chunk.speaker || 'UNKNOWN'}|${chunk.content}`
                );

                const existing = await VoiceSample.findOne({
                    bibleId: new mongoose.Types.ObjectId(bibleId),
                    source: sourceName,
                    contentHash,
                    isHierarchicalNode: false
                });

                if (existing) {
                    return { success: false, reason: 'duplicate' };
                }

                if (chunk.content.length < 10) {
                    return { success: false, reason: 'short' };
                }

                const eraContext = (chunk as any).era || options?.era || '';
                const contextString = chunk.contextBefore ? `Context: ${chunk.contextBefore}. ` : '';
                const speakerString = `Speaker: ${chunk.speaker}${eraContext ? ` (${eraContext})` : ''}. `;

                const richTextToEmbed = `${speakerString}${contextString}Line: "${chunk.content}"`;
                const embedding = await aiServiceManager.generateEmbedding(richTextToEmbed);

                const isSemanticDuplicate = await vectorService.isSemanticallyDuplicate(
                    bibleId,
                    embedding,
                    0.95
                );
                if (isSemanticDuplicate) {
                    return { success: false, reason: 'duplicate' };
                }

                const resolvedCharacterId = characterId
                    ? new mongoose.Types.ObjectId(characterId)
                    : await this.resolveCharacterByName(bibleId, chunk.speaker);

                const newSample = await VoiceSample.create({
                    bibleId: new mongoose.Types.ObjectId(bibleId),
                    characterId: resolvedCharacterId,
                    content: chunk.content,
                    contentHash,
                    speaker: chunk.speaker,
                    era: (chunk as any).era || options?.era,
                    chunkType: chunk.type,
                    chunkIndex: chunk.chunkIndex,
                    embedding,
                    source: sourceName,
                    parentNodeId: beatIds[globalIdx],
                    tags: ['auto-ingested', chunk.parenthetical || ''].filter(Boolean)
                });

                await vectorService.upsertSample({
                    id: newSample._id.toString(),
                    content: chunk.content,
                    embedding: embedding,
                    metadata: {
                        bibleId: bibleId.toString(),
                        characterId: resolvedCharacterId?.toString(),
                        contentHash,
                        speaker: chunk.speaker,
                        era: (chunk as any).era || options?.era,
                        chunkType: chunk.type,
                        chunkIndex: chunk.chunkIndex,
                        source: sourceName,
                        parentNodeId: beatIds[globalIdx]?.toString(),
                        isHierarchicalNode: false,
                        tags: ['auto-ingested', chunk.parenthetical || ''].filter(Boolean)
                    }
                });
                return { success: true };

            } catch (err: any) {
                console.error(`[VoiceService] Failed to process chunk from ${chunk.speaker}: ${err.message}`);
                return { success: false, reason: 'error' };
            }
        };

        for (let i = 0; i < dialogueChunks.length; i += CONCURRENCY_LIMIT) {
            const batch = dialogueChunks.slice(i, i + CONCURRENCY_LIMIT);

            const results = await Promise.allSettled(
                batch.map((chunk, batchIdx) => processChunk(chunk, i + batchIdx))
            );

            for (const result of results) {
                if (result.status === 'fulfilled') {
                    if (result.value.success) {
                        savedCount++;
                    } else if (result.value.reason === 'duplicate') {
                        skippedDuplicates++;
                    } else if (result.value.reason === 'short') {
                        skippedShort++;
                    } else {
                        errorCount++;
                    }
                } else {
                    errorCount++;
                }
            }

            if ((i + CONCURRENCY_LIMIT) % 50 === 0) {
                if (process.env.NODE_ENV !== 'production') { console.log(`[VoiceService] Batch Update: Processed ${Math.min(i + CONCURRENCY_LIMIT, dialogueChunks.length)} / ${dialogueChunks.length} chunks...`); }
            }

            if (i + CONCURRENCY_LIMIT < dialogueChunks.length) {
                await new Promise(resolve => setTimeout(resolve, BATCH_DELAY_MS));
            }
        }

        if (process.env.NODE_ENV !== 'production') {
            console.log(`[VoiceService] Ingestion complete:`);
            console.log(`  - Saved: ${savedCount}`);
            console.log(`  - Skipped (duplicates): ${skippedDuplicates}`);
            console.log(`  - Skipped (too short): ${skippedShort}`);
            console.log(`  - Errors: ${errorCount}`);
        }

        return {
            savedCount,
            skippedDuplicates,
            skippedShort,
            errorCount,
            characters: parseResult.characters,
            sceneCount: parseResult.sceneCount
        };
    }

    private async replaceSourceScope(
        bibleId: string,
        sourceName: string,
        characterId?: string
    ): Promise<void> {
        const bibleObjectId = new mongoose.Types.ObjectId(bibleId);
        const leafQuery: Record<string, unknown> = {
            bibleId: bibleObjectId,
            source: sourceName
        };
        if (characterId && mongoose.Types.ObjectId.isValid(characterId)) {
            leafQuery.characterId = new mongoose.Types.ObjectId(characterId);
        }
        const beatQuery: Record<string, unknown> = {
            bibleId: bibleObjectId,
            source: `${sourceName} (Beat)`
        };

        const existing = await VoiceSample.find({ $or: [leafQuery, beatQuery] }).select('_id').lean();
        if (existing.length === 0) return;

        const existingIds = existing.map((doc: any) => doc._id.toString());
        await vectorService.deleteSamplesByIds(existingIds);
        await vectorService.deleteSamplesBySource(
            bibleId,
            sourceName,
            characterId && mongoose.Types.ObjectId.isValid(characterId) ? characterId : undefined
        );
        await vectorService.deleteSamplesBySource(
            bibleId,
            `${sourceName} (Beat)`,
            undefined
        );
        await VoiceSample.deleteMany({ $or: [leafQuery, beatQuery] });

        if (process.env.NODE_ENV !== 'production') { console.log(`[VoiceService] Replaced existing source scope "${sourceName}" (${existingIds.length} samples removed).`); }
    }

    private async resolveCharacterByName(
        bibleId: string,
        speakerName?: string
    ): Promise<mongoose.Types.ObjectId | undefined> {
        if (!speakerName) return undefined;

        try {
            const character = await Character.findOne({
                bibleId: new mongoose.Types.ObjectId(bibleId),
                name: { $regex: new RegExp(`^${escapeRegExp(speakerName)}$`, 'i') }
            });

            if (character) {
                return character._id;
            }

            return undefined;

        } catch (err) {
            if (process.env.NODE_ENV !== 'production') { console.warn(`[VoiceService] Character resolution failed for "${speakerName}": ${err}`); }
            return undefined;
        }
    }

    private async splitIntoDialogueChunks(text: string): Promise<string[]> {
        const result = await chunkerService.parseScreenplay(text);
        return result.chunks
            .filter(c => c.type === 'dialogue')
            .map(c => c.content);
    }
}

export const voiceService = new VoiceService();
