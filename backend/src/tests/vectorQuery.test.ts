import { describe, it, expect } from './framework.js';
import { findSimilarSamplesImpl } from '../services/vector/findSimilar.js';

describe('Vector Query Guards', () => {
    it('builds allowed-scope filters with top-level should clauses', async () => {
        let capturedSearch: any = null;
        const client = {
            async search(_collection: string, payload: any) {
                capturedSearch = payload;
                return [];
            }
        } as any;

        await findSimilarSamplesImpl(client, 'voice_samples', 'ALL', [0.1, 0.2, 0.3], 5, undefined, {
            scopeType: 'masterScriptId',
            allowedScopeIds: ['script-a', 'script-b'],
            includeHierarchicalNodes: true
        });

        expect(Array.isArray(capturedSearch.filter.should)).toBe(true);
        expect(capturedSearch.filter.must).toBe(undefined);
        expect(capturedSearch.filter.should.length).toBe(2);
    });
});
