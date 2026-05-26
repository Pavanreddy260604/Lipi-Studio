import { z } from 'zod';

export const ParsedAssistantSchema = z.object({
    research: z.any().nullable().default(null),
    plan: z.any().nullable().default(null),
    script: z.any().describe('The updated screenplay content or surgical patch (SEARCH/REPLACE)'),
    explanation: z.any().nullable().default(null),
    summary: z.any().nullable().default(null),
    characterMemory: z.any().nullable().default(null),
    plotState: z.any().nullable().default(null)
}).passthrough();

export type ParsedAssistantResponse = z.infer<typeof ParsedAssistantSchema>;
