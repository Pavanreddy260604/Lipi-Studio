import type { BeatSheetStructure } from './types.js';

export const STRUCTURE_ACTS: Record<BeatSheetStructure, { name: string; percentage: number }[]> = {
    save_the_cat: [
        { name: 'Act I: Setup & Catalyst', percentage: 0.25 },
        { name: 'Act II: Fun & Games & Crisis', percentage: 0.50 },
        { name: 'Act III: Climax & Resolution', percentage: 0.25 }
    ],
    three_act: [
        { name: 'Act I: The Setup', percentage: 0.25 },
        { name: 'Act II: The Confrontation', percentage: 0.50 },
        { name: 'Act III: The Resolution', percentage: 0.25 }
    ],
    five_act: [
        { name: 'Act I: Exposition', percentage: 0.20 },
        { name: 'Act II: Rising Action', percentage: 0.20 },
        { name: 'Act III: Climax / Crisis', percentage: 0.20 },
        { name: 'Act IV: Falling Action', percentage: 0.20 },
        { name: 'Act V: Denouement', percentage: 0.20 }
    ],
    heros_journey: [
        { name: 'Departure (Act I)', percentage: 0.25 },
        { name: 'Initiation (Act II)', percentage: 0.50 },
        { name: 'Return (Act III)', percentage: 0.25 }
    ],
    story_circle: [
        { name: 'The Descent (Act I)', percentage: 0.50 },
        { name: 'The Ascent (Act II)', percentage: 0.50 }
    ],
    sequence: [
        { name: 'Act I (Sequences 1-2)', percentage: 0.25 },
        { name: 'Act IIA (Sequences 3-4)', percentage: 0.25 },
        { name: 'Act IIB (Sequences 5-6)', percentage: 0.25 },
        { name: 'Act III (Sequences 7-8)', percentage: 0.25 }
    ],
    indian_commercial: [
        { name: 'Act 1: Hero Establishment', percentage: 0.30 },
        { name: 'Act 2: Conflict & Entertainment', percentage: 0.40 },
        { name: 'Act 3: Climax & Resolution', percentage: 0.30 }
    ],
    tv_beat_sheet: [
        { name: 'Teaser & Act I', percentage: 0.25 },
        { name: 'Act II & Act III', percentage: 0.50 },
        { name: 'Act IV & Tag', percentage: 0.25 }
    ],
    fictional_pulse: [
        { name: 'Pulse 1: The Awake', percentage: 0.25 },
        { name: 'Pulse 2: The Tension', percentage: 0.25 },
        { name: 'Pulse 3: The Crash', percentage: 0.25 },
        { name: 'Pulse 4: The Beat', percentage: 0.25 }
    ]
};

export const CORE_BEATS_COUNT: Record<BeatSheetStructure, number> = {
    save_the_cat: 15, three_act: 10, five_act: 10, heros_journey: 12,
    story_circle: 8, sequence: 8, indian_commercial: 12, tv_beat_sheet: 10, fictional_pulse: 10
};

export const STRUCTURE_TO_STYLE: Record<BeatSheetStructure, string> = {
    save_the_cat: 'Save The Cat', three_act: 'Three Act', five_act: 'Five Act',
    heros_journey: "Hero's Journey", story_circle: 'Story Circle', sequence: 'Sequence Approach',
    indian_commercial: 'Indian Commercial Cinema', tv_beat_sheet: 'TV Beat Sheet', fictional_pulse: 'Fictional Pulse'
};

export const BEAT_SHEET_STRUCTURES: Record<BeatSheetStructure, { name: string; description: string; beatCount: string }> = {
    save_the_cat: { name: 'Save the Cat (Blake Snyder)', description: '15 specific beats with page targets. Best for commercial genre films.', beatCount: '15 beats' },
    three_act: { name: 'Three-Act Structure (Syd Field)', description: 'Classic Setup -> Confrontation -> Resolution. Universal and flexible.', beatCount: '8-10 beats' },
    five_act: { name: 'Five-Act Structure (Shakespeare)', description: 'Exposition -> Rising Action -> Crisis -> Climax -> Denouement. For complex dramas.', beatCount: '10-12 beats' },
    heros_journey: { name: "Hero's Journey (Campbell/Vogler)", description: '12-stage monomyth. Best for epic, mythic, or transformation stories.', beatCount: '12 beats' },
    story_circle: { name: 'Story Circle (Dan Harmon)', description: '8-step circular structure. Great for TV episodes and short form.', beatCount: '8 beats' },
    sequence: { name: 'Sequence Approach', description: '8-12 self-contained sequences of 10-15 pages each. Manages long second acts.', beatCount: '8-12 sequences' },
    indian_commercial: { name: 'Indian Commercial Cinema', description: 'Hero introduction -> Interval Block -> Climax. For masala/commercial Indian films.', beatCount: '12-14 beats' },
    tv_beat_sheet: { name: 'TV Drama (5-Act)', description: 'Teaser -> Act breaks -> Tag. For episodic television.', beatCount: '10-12 beats' },
    fictional_pulse: { name: 'Fictional Pulse (4-Part)', description: 'Awake -> Tension -> Crash -> Beat. Rhythm-based alternative structure.', beatCount: '10-12 beats' }
};

export function getActsDistribution(structureType: BeatSheetStructure, targetSceneCount: number) {
    const actsConfig = STRUCTURE_ACTS[structureType] || STRUCTURE_ACTS.three_act;
    let remainingScenes = targetSceneCount;
    const acts = [];
    for (let i = 0; i < actsConfig.length; i++) {
        const config = actsConfig[i];
        let count = Math.round(targetSceneCount * config.percentage);
        if (i === actsConfig.length - 1) count = remainingScenes;
        count = Math.max(1, count);
        remainingScenes -= count;
        acts.push({ name: config.name, sceneCount: count });
    }
    return acts;
}
