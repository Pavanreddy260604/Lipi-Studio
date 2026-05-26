import { aiServiceManager } from '../aiManager/index.js';
import { RagCache } from './cache.js';
import { buildQueryVariants, getQuotas, buildProjectContinuityReferences, extractPersistentDirectives, formatSection } from './prompts.js';
import { retrieveProjectCandidates, retrieveMasterCandidates } from './retrieval.js';
import { buildRecentContinuityReferences } from './continuity.js';
import { rankCandidates, inferPreferredElementTypes, buildMasterFeedRefs, toReference } from './ranking.js';
import { buildLoreGraphContext } from './lore.js';
import type { AssistantReferencePack, AssistantRetrievalMetadata, EmbeddedQueryVariant, BuildAssistantReferencePackParams } from './types.js';
import { truncateText, toId } from './utils.js';

export class AssistantRagService {
    private cache = new RagCache();

    needsRag(instruction: string): boolean {
        const clean = instruction.toLowerCase().trim();
        const simpleQaPatterns = [
            /^why\s/, /^what\s/, /^how\s/, /^does\s/, /^is\s/, /^can\s/, /^should\s/,
            /^would\s/, /^could\s/, /^explain/, /^analyze/, /^evaluate/, /^review/,
            /^comment/, /^describe/, /^tell me/, /^give me/, /^thoughts?\s/, /^opinion/,
            /do you think/, /what do you/, /how does/, /what about/, /what's (wrong|good|bad|working)/,
            /why does/, /why is/, /why would/, /is this/, /is there/, /does this/,
            /what's the/, /can you explain/, /can you tell/, /would you/,
            /write\s+(an?\s+)?example/, /write\s+(an?\s+)?slugline/, /write\s+(an?\s+)?explanation/,
            /how\s+to\s+write/, /how\s+do\s+i\s+write/, /explain\s+how/, /explain\s+what/,
            /what\s+is\s+a/, /what\s+does\s+a/, /difference\s+between/, /example\s+of/
        ];
        const editPatterns = [
            /rewrite|replace|change|edit|fix|update|modify|update|alter|improve/,
            /write\s+(an?\s+)?(scene|dialogue|action|script|beat|outline|treatment|sequence|paragraph|sentence|line|draft|continuation|content|monologue|dialog)/,
            /generate\s+(an?\s+)?(scene|dialogue|action|script|beat|outline|treatment|sequence|paragraph|sentence|line|draft|continuation|content|monologue|dialog)/,
            /create\s+(an?\s+)?(scene|dialogue|action|script|beat|outline|treatment|sequence|paragraph|sentence|line|draft|continuation|content|monologue|dialog)/,
            /add\s+(an?\s+)?(scene|dialogue|action|script|beat|outline|treatment|sequence|paragraph|sentence|line|draft|continuation|content|monologue|dialog|character|cast)/,
            /remove|delete|cut|trim/, /format|restructure/,
            /translate|transliterate/, /make it/, /make the/, /turn this/, /convert/
        ];
        const isSimpleQa = simpleQaPatterns.some(p => p.test(clean));
        const isEditRequest = editPatterns.some(p => p.test(clean));
        if (isEditRequest) return true;
        if (isSimpleQa) return false;
        if (clean.length < 80) return false;
        return true;
    }

    async buildAssistantReferencePack(params: BuildAssistantReferencePackParams): Promise<AssistantReferencePack> {
        const cacheKey = this.cache.getKey(params);
        const cached = this.cache.get(cacheKey);
        if (cached) return cached;

        const queryVariants = buildQueryVariants(params);
        const embeddedQueriesRaw = await Promise.all(
            queryVariants.map(async (query) => {
                try {
                    const embeddingPromise = aiServiceManager.generateEmbedding(query.text);
                    let timeoutId: ReturnType<typeof setTimeout>;
                    const timeoutPromise = new Promise<null>((_, reject) => {
                        timeoutId = setTimeout(() => reject(new Error('Embedding timeout')), 15000);
                    });
                    const embedding = await Promise.race([embeddingPromise, timeoutPromise]);
                    clearTimeout(timeoutId!);
                    return { ...query, embedding };
                } catch (err) {
                    console.warn(`[AssistantRAG] Embedding generation failed or timed out for query: ${query.text.substring(0, 50)}...`, err);
                    return null;
                }
            })
        );
        const embeddedQueries = embeddedQueriesRaw.filter(q => q !== null) as EmbeddedQueryVariant[];

        const [projectCandidates, masterResult, recentContinuityRefs, projectContinuityRefs] = await Promise.all([
            retrieveProjectCandidates(embeddedQueries, params),
            params.mode === 'ask' ? { candidates: [], languageFallbackUsed: false, eligibleMasterScriptCount: 0, exactLanguageMasterCount: 0 } : retrieveMasterCandidates(embeddedQueries, params),
            buildRecentContinuityReferences(params),
            buildProjectContinuityReferences(params)
        ]);

        const preferredElementTypes = inferPreferredElementTypes(params);
        const quotas = getQuotas(params);

        const projectStyleRefs = rankCandidates(projectCandidates, params, preferredElementTypes, 'project')
            .slice(0, quotas.projectStyle)
            .map((candidate) => toReference(candidate.sample, 'project_style', 'project', candidate.score));

        const masterFeedRefs = masterResult.candidates.length > 0
            ? buildMasterFeedRefs(masterResult, params, preferredElementTypes, quotas.masterFeed)
            : [];

        const allSelectedReferences = [...projectStyleRefs, ...masterFeedRefs];
        allSelectedReferences.sort((a, b) => b.score - a.score);

        const selectedProjectContinuity = projectContinuityRefs.slice(0, quotas.projectContinuity);
        const selectedRecentContinuity = recentContinuityRefs.slice(0, quotas.recentContinuity);

        const sections = [
            formatSection('PROJECT CONTINUITY REFERENCES', selectedProjectContinuity),
            formatSection('PROJECT STYLE REFERENCES', projectStyleRefs),
            formatSection('MASTER FEED REFERENCES', masterFeedRefs),
            formatSection('RECENT SCENE CONTINUITY', selectedRecentContinuity)
        ].filter(Boolean);

        const storyResources = (params.bible as any)?.storyResources || [];
        if (storyResources.length > 0) {
            const formattedResources = storyResources.map((res: any) =>
                `#### RESOURCE: "${res.title || 'Untitled'}" (${res.type || 'notes'})\n${truncateText(res.content || '', 3500)}`
            ).join('\n\n');
            sections.push("### SOURCE MATERIAL / STORY RESOURCES (CRITICAL REFERENCE)\n" + formattedResources);
        }

        const finalReferences = [...selectedProjectContinuity, ...allSelectedReferences, ...selectedRecentContinuity];

        let persistentDirectives = extractPersistentDirectives(params.scene?.assistantChatHistory || []);

        const rules = (params.bible as any)?.rules || [];
        const visualStyle = (params.bible as any)?.visualStyle;
        const genre = (params.bible as any)?.genre;
        const tone = (params.bible as any)?.tone;

        const extraDirectives: string[] = [];
        if (genre) extraDirectives.push(`Genre: ${genre}`);
        if (tone) extraDirectives.push(`Tone/Vibe: ${tone}`);
        if (visualStyle) extraDirectives.push(`Visual Style: ${visualStyle}`);
        if (rules.length > 0) {
            extraDirectives.push(`Strict Stylistic Rules:\n${rules.map((r: string) => `- ${r}`).join('\n')}`);
        }

        const bibleId = toId(params.bible?._id);
        const loreContext = await buildLoreGraphContext(bibleId, params.scene, params.bible);
        if (loreContext) extraDirectives.push(loreContext);

        if (extraDirectives.length > 0) {
            persistentDirectives = `${persistentDirectives}\n\n### MANDATORY PROJECT CONSTRAINTS:\n${extraDirectives.join('\n')}`.trim();
        }

        let transliteration_rules = 'Transliteration is DISABLED. Use the native script of the language.';
        if (params.transliteration) {
            transliteration_rules = [
                'TRANSLITERATION IS ENABLED (Romanized Output):',
                '1. Write {{language}} dialogue using English letters phonetically.',
                '2. Use colloquial, spoken phonetics (e.g., use \'ra\', \'na\', \'yaar\' emotional particles).',
                '3. DO NOT translate to English. Stay in the native language, just change the characters.',
                '4. Priority: Emotional authenticity over formal dictionary spelling.'
            ].join('\n');
        }

        const retrievalMetadata: AssistantRetrievalMetadata = {
            mode: params.mode, target: params.target,
            queryVariants: embeddedQueries.map((query) => ({
                key: query.key, preview: truncateText(query.text, 180), length: query.text.length
            })),
            candidateCounts: {
                project: projectCandidates.length, master: masterResult.candidates.length,
                recent: recentContinuityRefs.length, continuity: projectContinuityRefs.length
            },
            sourceMix: {
                project: projectStyleRefs.length, master: masterFeedRefs.length,
                recent: selectedRecentContinuity.length, continuity: selectedProjectContinuity.length
            },
            selectedReferences: finalReferences.map((reference) => ({
                group: reference.group, sourceFamily: reference.sourceFamily, label: reference.label,
                score: Number(reference.score.toFixed(4)), sampleId: reference.sampleId,
                masterScriptId: reference.masterScriptId, chunkType: reference.chunkType,
                elementType: reference.elementType, sourceType: reference.sourceType
            })),
            languageFallbackUsed: masterResult.languageFallbackUsed,
            eligibleMasterScriptCount: masterResult.eligibleMasterScriptCount,
            exactLanguageMasterCount: masterResult.exactLanguageMasterCount
        };

        this.logRetrieval(params, retrievalMetadata);

        const result: AssistantReferencePack = {
            promptSections: sections.join('\n\n'), persistentDirectives, transliteration_rules, retrievalMetadata
        };

        this.cache.set(cacheKey, result);
        return result;
    }

    private logRetrieval(params: BuildAssistantReferencePackParams, metadata: AssistantRetrievalMetadata) {
        if (process.env.NODE_ENV !== 'production') {
            console.info(`[AssistantRAG] Retrieval completed [${params.mode}/${params.target}]`);
            console.info(`- Variants: ${metadata.queryVariants.map(v => v.key).join(', ')}`);
            console.info(`- Mix: P:${metadata.sourceMix.project} M:${metadata.sourceMix.master} R:${metadata.sourceMix.recent} C:${metadata.sourceMix.continuity}`);
        }
    }
}

export const assistantRagService = new AssistantRagService();
