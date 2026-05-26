import { refineAssistantResponse as refineFn } from './assistantRefiner.js';
import type { ParsedAssistantResponse } from './types.js';
import { JSONHelper } from './jsonHelper.js';

export { JSONHelper } from './jsonHelper.js';
export type { ParsedAssistantResponse } from './types.js';

export class ParserService {
    async refineAssistantResponse(
        rawResponse: string,
        originalContent: string = ''
    ): Promise<ParsedAssistantResponse> {
        return refineFn(rawResponse, originalContent);
    }
}

export const parserService = new ParserService();
