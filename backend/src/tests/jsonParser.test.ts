import { describe, it, expect } from './framework.js';
import { JSONHelper } from '../services/parser/jsonHelper.js';

describe('JSONHelper Brutal Parse & Repair Judge', () => {
    it('should parse standard perfect JSON without any changes', () => {
        const payload = { title: 'SCENE 1', description: 'Ren arrives at the dock.' };
        const raw = JSON.stringify(payload);
        const parsed = JSONHelper.dirtyRepair(raw);
        expect(parsed.title).toBe('SCENE 1');
        expect(parsed.description).toBe('Ren arrives at the dock.');
    });

    it('should successfully repair unquoted JSON keys', () => {
        const raw = `{ title: "A New Hope", slugline: "INT. SPACE - NIGHT" }`;
        const parsed = JSONHelper.dirtyRepair(raw);
        expect(parsed.title).toBe('A New Hope');
        expect(parsed.slugline).toBe('INT. SPACE - NIGHT');
    });

    it('should successfully repair single-quoted keys and values', () => {
        const raw = `{ 'title': 'The Empire Strikes Back', 'goal': 'Capture the Rebel base' }`;
        const parsed = JSONHelper.dirtyRepair(raw);
        expect(parsed.title).toBe('The Empire Strikes Back');
        expect(parsed.goal).toBe('Capture the Rebel base');
    });

    it('should brutally judge and repair trailing/consecutive commas', () => {
        const raw = `{ "title": "Return of the Jedi",,, "slugline": "EXT. FOREST - DAY", }`;
        const parsed = JSONHelper.dirtyRepair(raw);
        expect(parsed.title).toBe('Return of the Jedi');
        expect(parsed.slugline).toBe('EXT. FOREST - DAY');
    });

    it('should trigger stack-based screenplay object extractor under absolute truncation disaster', () => {
        const rawText = `
        Here is the draft treatment:
        {
            "title": "SCENE 1: THE DOCK",
            "slugline": "EXT. DOCK - NIGHT",
            "goal": "Introduce Ren and show his paranoia."
        }
        This is an extra scene that got cut off mid-sentence:
        {
            "title": "SCENE 2: THE BOAT",
            "slugline": "INT. CABIN - NIGHT",
            "goal": "Ren tries to sleep but hears footsteps."
        
        `;
        const parsedArray = JSONHelper.dirtyRepair(rawText);
        expect(Array.isArray(parsedArray)).toBe(true);
        expect(parsedArray.length).toBe(2);
        expect(parsedArray[0].title).toBe('SCENE 1: THE DOCK');
        expect(parsedArray[1].title).toBe('SCENE 2: THE BOAT');
    });

    it('should safely extract strings and return string representations if objects lack text content', () => {
        const str = JSONHelper.flattenToString("Hello world");
        expect(str).toBe("Hello world");

        const objText = JSONHelper.flattenToString({ content: "Screenplay page content." });
        expect(objText).toBe("Screenplay page content.");
    });

    it('should brutally repair missing closing braces in arrays of objects', () => {
        const raw = `
        {
            "scenes": [
                {
                    "title": "Scene A",
                    "slugline": "INT. ROOM - DAY",
                    "description": "Short desc."
                ,
                {
                    "title": "Scene B",
                    "slugline": "INT. ROOM - NIGHT",
                    "description": "Short desc B."
                }
            ]
        }
        `;
        const parsed = JSONHelper.dirtyRepair(raw);
        expect(parsed.scenes.length).toBe(2);
        expect(parsed.scenes[0].title).toBe('Scene A');
        expect(parsed.scenes[1].title).toBe('Scene B');
    });

    it('should brutally balance incorrectly nested brackets and braces in arrays of objects', () => {
        const raw = `
        {
            "scenes": [
                {
                    "title": "Scene A",
                    "slugline": "INT. ROOM - DAY",
                    "description": "Short desc."
                }
            }}
        `;
        const parsed = JSONHelper.dirtyRepair(raw);
        expect(parsed.scenes.length).toBe(1);
        expect(parsed.scenes[0].title).toBe('Scene A');
    });
});
