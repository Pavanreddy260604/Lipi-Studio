import { describe, it, expect } from './framework.js';
import { JSONHelper } from '../services/parser/jsonHelper.js';

describe('Concurrency & Asynchronous Stress Test Judge', () => {
    it('should concurrently repair 50 corrupt JSON payloads without memory leaks or race conditions', async () => {
        const payloadCount = 50;
        const promises: Promise<any>[] = [];

        const startMemory = process.memoryUsage().heapUsed;

        for (let i = 0; i < payloadCount; i++) {
            const raw = `
            {
                "title": "SCENE ${i}: THE FOREST",
                "slugline": "EXT. FOREST - NIGHT",
                "goal": "Introduce threat ${i} and stress the character",,,
                "description": "A massive beast ${i} approaches the campsite."
            }
            `;
            promises.push(
                new Promise((resolve) => {
                    // Simulate random asynchronous delays to force event loop interleaving
                    setTimeout(() => {
                        const parsed = JSONHelper.dirtyRepair(raw);
                        resolve(parsed);
                    }, Math.random() * 50);
                })
            );
        }

        const results = await Promise.all(promises);
        
        expect(results.length).toBe(payloadCount);
        expect(results[0].title).toBe('SCENE 0: THE FOREST');
        expect(results[payloadCount - 1].title).toBe(`SCENE ${payloadCount - 1}: THE FOREST`);

        const endMemory = process.memoryUsage().heapUsed;
        const memoryGrowthKb = (endMemory - startMemory) / 1024;
        
        // Assert that memory leak is constrained (less than 15MB growth during stress execution)
        expect(memoryGrowthKb < 15360).toBe(true);
    });
});
