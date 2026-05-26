import mongoose from 'mongoose';
import { VoiceSample } from '../../models/VoiceSample';
import { vectorService } from '../vector/index.js';
import { llamaindexService } from '../llamaindex.service';
import type { IMasterScript } from '../../models/MasterScript';
import type { ParsedElement, ParsedScene } from '../masterScriptParser/types.js';
import { createStableHash, buildSceneNodeText, buildElementEmbeddingText, normalizeElementContent } from './helpers.js';

export async function createSceneNodes(
    script: IMasterScript,
    scriptVersion: string,
    parserVersion: string,
    scenes: ParsedScene[],
    elements: ParsedElement[]
): Promise<Map<number, mongoose.Types.ObjectId>> {
    const sceneParentMap = new Map<number, mongoose.Types.ObjectId>();

    // 1. If screenplay has elements in sceneSeq 0 (e.g. front matter/credits), create a parent node for scene 0
    const hasFrontMatter = elements.some(el => el.sceneSeq === 0);
    if (hasFrontMatter) {
        const frontMatterElements = elements.filter(el => el.sceneSeq === 0);
        const sceneContent = `${script.title} - Front Matter / Introduction`;
        const sceneEmbedding = await llamaindexService.getEmbedding(sceneContent);
        const chunkId = `scene_${script._id.toString()}_${scriptVersion}_0`;
        const sourceLineIds = Array.from(new Set(frontMatterElements.flatMap(element => element.sourceLineIds)));
        const sourceStartLine = Math.min(...frontMatterElements.map(el => el.sourceStartLine));
        const sourceEndLine = Math.max(...frontMatterElements.map(el => el.sourceEndLine));

        const sceneNode = new VoiceSample({
            masterScriptId: script._id, content: sceneContent,
            contentHash: createStableHash(chunkId, "Front Matter"), chunkId,
            chunkType: 'scene', chunkIndex: 0, sceneSeq: 0,
            elementSeq: 0, elementType: 'scene',
            sourceStartLine, sourceEndLine,
            sourceLineIds, embedding: sceneEmbedding, isHierarchicalNode: true,
            scriptVersion, parserVersion, language: script.language,
            tags: [...script.tags, 'scene-node', 'front-matter'],
            source: `${script.director}: ${script.title} (Front Matter)`
        });
        await sceneNode.save();
        await vectorService.upsertSample({
            id: sceneNode._id.toString(), content: sceneContent, embedding: sceneEmbedding,
            metadata: {
                masterScriptId: script._id.toString(), chunkId, chunkType: 'scene',
                chunkIndex: 0, sceneSeq: 0, elementSeq: 0,
                elementType: 'scene', sourceStartLine,
                sourceEndLine, sourceLineIds, scriptVersion,
                parserVersion, language: script.language, isHierarchicalNode: true,
                tags: [...script.tags, 'scene-node', 'front-matter'],
                source: `${script.director}: ${script.title} (Front Matter)`
            }
        });
        sceneParentMap.set(0, sceneNode._id as mongoose.Types.ObjectId);
    }

    // 2. Map all standard parsed scene headings
    for (const scene of scenes) {
        const sceneContent = buildSceneNodeText(scene);
        const sceneEmbedding = await llamaindexService.getEmbedding(sceneContent);
        const chunkId = `scene_${script._id.toString()}_${scriptVersion}_${scene.sceneSeq}`;
        const sourceLineIds = Array.from(new Set(scene.elements.flatMap(element => element.sourceLineIds)));

        const sceneNode = new VoiceSample({
            masterScriptId: script._id, content: sceneContent,
            contentHash: createStableHash(chunkId, scene.heading), chunkId,
            chunkType: 'scene', chunkIndex: scene.sceneSeq, sceneSeq: scene.sceneSeq,
            elementSeq: 0, elementType: 'scene',
            sourceStartLine: scene.sourceStartLine, sourceEndLine: scene.sourceEndLine,
            sourceLineIds, embedding: sceneEmbedding, isHierarchicalNode: true,
            scriptVersion, parserVersion, language: script.language,
            tags: [...script.tags, 'scene-node'],
            source: `${script.director}: ${script.title} (Scene ${scene.sceneSeq})`
        });
        await sceneNode.save();
        await vectorService.upsertSample({
            id: sceneNode._id.toString(), content: sceneContent, embedding: sceneEmbedding,
            metadata: {
                masterScriptId: script._id.toString(), chunkId, chunkType: 'scene',
                chunkIndex: scene.sceneSeq, sceneSeq: scene.sceneSeq, elementSeq: 0,
                elementType: 'scene', sourceStartLine: scene.sourceStartLine,
                sourceEndLine: scene.sourceEndLine, sourceLineIds, scriptVersion,
                parserVersion, language: script.language, isHierarchicalNode: true,
                tags: [...script.tags, 'scene-node'],
                source: `${script.director}: ${script.title} (Scene ${scene.sceneSeq})`
            }
        });
        sceneParentMap.set(scene.sceneSeq, sceneNode._id as mongoose.Types.ObjectId);
    }
    return sceneParentMap;
}

export async function indexLeafElements(params: {
    script: IMasterScript;
    processingVersion: string;
    parserVersion: string;
    elements: ParsedElement[];
    scenes: ParsedScene[];
    sceneParentMap: Map<number, mongoose.Types.ObjectId>;
    manifest: any;
}): Promise<void> {
    const { script, processingVersion, parserVersion, elements, scenes, sceneParentMap, manifest } = params;
    const sceneHeadingBySeq = new Map(scenes.map(scene => [scene.sceneSeq, scene.heading]));
    const batchSize = 25;

    manifest.totalChunks = elements.length;

    for (let i = 0; i < elements.length; i += batchSize) {
        const batch = elements.slice(i, i + batchSize);
        try {
            const NON_EMBEDDABLE_TYPES = new Set(['page_marker', 'blank', 'title_page']);
            
            // Gather embedding texts only for meaningful, embeddable screenplay elements
            const batchEmbeddableTexts = batch
                .filter(el => !NON_EMBEDDABLE_TYPES.has(el.elementType))
                .map(el => buildElementEmbeddingText(el, sceneHeadingBySeq.get(el.sceneSeq) || '[UNKNOWN SCENE]'));

            // Fetch embeddings in a single batch request
            let embeddings: number[][] = [];
            if (batchEmbeddableTexts.length > 0) {
                embeddings = await llamaindexService.getEmbeddingsBatch(batchEmbeddableTexts);
            }

            // Create Mongoose records for all elements (full coverage)
            let embeddableIdx = 0;
            const samplesToSave = batch.map(element => {
                const storedContent = normalizeElementContent(element);
                const chunkId = `chunk_${script._id.toString()}_${processingVersion}_${element.chunkIndex}`;
                const parentNodeId = sceneParentMap.get(element.sceneSeq);
                const contentHash = createStableHash(processingVersion, String(element.sceneSeq), String(element.elementSeq), ...element.sourceLineIds, storedContent);

                let mappedElementType: string = element.elementType;
                if (element.elementType === 'character_cue') {
                    mappedElementType = 'cue';
                } else if (element.elementType === 'scene_heading') {
                    mappedElementType = 'slug';
                } else if (NON_EMBEDDABLE_TYPES.has(element.elementType)) {
                    mappedElementType = 'other';
                }

                let embedding: number[];
                if (NON_EMBEDDABLE_TYPES.has(element.elementType)) {
                    // Populate zero-vector dummy embeddings for layout/blanks/title-page nodes
                    embedding = new Array(3072).fill(0);
                } else {
                    embedding = embeddings[embeddableIdx++];
                }

                return new VoiceSample({
                    _id: new mongoose.Types.ObjectId(), // pre-generate _id for vector binding
                    masterScriptId: script._id, content: storedContent, contentHash,
                    speaker: element.speaker, language: script.language,
                    chunkType: element.chunkType === 'other' || NON_EMBEDDABLE_TYPES.has(element.elementType) ? 'other' : element.chunkType,
                    chunkIndex: element.chunkIndex,
                    sceneSeq: element.sceneSeq, elementSeq: element.elementSeq,
                    elementType: mappedElementType,
                    sourceStartLine: element.sourceStartLine, sourceEndLine: element.sourceEndLine,
                    sourceLineIds: element.sourceLineIds, dualDialogue: element.dualDialogue,
                    sceneNumber: element.sceneNumber, nonPrinting: element.nonPrinting,
                    embedding, tags: script.tags, source: `${script.director}: ${script.title}`, chunkId,
                    scriptVersion: processingVersion, parserVersion,
                    parentNodeId, isHierarchicalNode: false
                });
            });

            // Bulk write in one fast DB operation
            await VoiceSample.insertMany(samplesToSave);

            // Vector-index only the meaningful, search-relevant elements
            const vectorNodes = samplesToSave
                .filter((sample, idx) => !NON_EMBEDDABLE_TYPES.has(batch[idx].elementType))
                .map(sample => ({
                    id: sample._id.toString(),
                    content: sample.content,
                    embedding: sample.embedding,
                    metadata: {
                        masterScriptId: script._id.toString(),
                        contentHash: sample.contentHash,
                        speaker: sample.speaker,
                        language: sample.language,
                        chunkType: sample.chunkType,
                        chunkIndex: sample.chunkIndex,
                        tags: sample.tags,
                        source: sample.source,
                        scriptVersion: sample.scriptVersion,
                        chunkId: sample.chunkId,
                        parserVersion: sample.parserVersion,
                        parentNodeId: sample.parentNodeId?.toString(),
                        isHierarchicalNode: false,
                        sceneSeq: sample.sceneSeq,
                        elementSeq: sample.elementSeq,
                        elementType: sample.elementType,
                        sourceStartLine: sample.sourceStartLine,
                        sourceEndLine: sample.sourceEndLine,
                        sourceLineIds: sample.sourceLineIds,
                        dualDialogue: sample.dualDialogue,
                        sceneNumber: sample.sceneNumber,
                        nonPrinting: sample.nonPrinting
                    }
                }));

            if (vectorNodes.length > 0) {
                await vectorService.upsertSamplesBatch(vectorNodes);
            }

            manifest.successfulChunks += batch.length;
        } catch (error: any) {
            manifest.failedChunks += batch.length;
            manifest.errorLogs.push({ chunkIndex: batch[0]?.chunkIndex, error: error?.message || 'Batch failure' });
            console.error(`[AdminService] Error processing batch starting at ${batch[0]?.chunkIndex}:`, error);
        }

        const processed = Math.min(i + batch.length, elements.length);
        const totalDone = manifest.successfulChunks + manifest.failedChunks;
        script.processedChunks = manifest.successfulChunks;
        script.progress = 35 + Math.floor((processed / elements.length) * 50);
        script.lastValidationSummary = `Indexed ${totalDone}/${elements.length} structured chunks for ${processingVersion}`;
        await script.save();
        await manifest.save();
    }
}
