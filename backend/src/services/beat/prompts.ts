export const STRUCTURE_ACTS: Record<string, { name: string; percentage: number }[]> = {
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

export const CORE_BEATS_COUNT: Record<string, number> = {
    save_the_cat: 15,
    three_act: 10,
    five_act: 10,
    heros_journey: 12,
    story_circle: 8,
    sequence: 8,
    indian_commercial: 12,
    tv_beat_sheet: 10,
    fictional_pulse: 10
};

export const STRUCTURE_TO_STYLE: Record<string, string> = {
    save_the_cat: 'Save The Cat',
    three_act: 'Three Act',
    five_act: 'Five Act',
    heros_journey: "Hero's Journey",
    story_circle: 'Story Circle',
    sequence: 'Sequence Approach',
    indian_commercial: 'Indian Commercial Cinema',
    tv_beat_sheet: 'TV Beat Sheet',
    fictional_pulse: 'Fictional Pulse'
};

export const CORE_BEATS_OUTLINE_PROMPT = `You are a master screenplay orchestrator (The Director).
Convert the following Logline into a structured beat outline of exactly {{core_beats_count}} core structural milestones following the {{structure_name}} framework.

LOGLINE: "{{logline}}"

Return ONLY a valid JSON object containing a single key "beats", which holds an array of objects. Each object must have:
- "name": The structural milestone name (e.g. "Inciting Incident")
- "description": A 1-2 sentence dramatic projection of how this milestone plays out in this story.

Return ONLY the JSON object. Do not include markdown or explanations.`;

export const BLOCK_SKELETON_PROMPT = `You are a professional screenplay architect (The Director).
Brainstorm the unique settings (sluglines) and creative titles for scenes {{start_scene}} through {{end_scene}} (out of {{total_scenes}} total scenes).
These scenes must map to the following part of the Global Outline:
{{active_milestones}}

## LOGLINE
"{{logline}}"

## CAST
{{cast}}

## PREVIOUSLY GENERATED SCENES (DO NOT DUPLICATE LOCATIONS OR PLOT EVENTS)
{{previously_planned_scenes}}

Return ONLY a valid JSON object containing a single key "scenes", which holds an array of scene objects. Each object must have:
- "title": A highly creative, evocative, and cinematic scene title (e.g. "Wax and Gold" or "The Shadow in the Trees"). STRICT RULE: DO NOT use structural words like "Act", "Scene", "Setup", "Climax", or copy the milestone names!
- "slugline": A WGA industry-standard scene header. STRICT RULE: You MUST invent specific, realistic physical locations (e.g. "INT. DUSTY CABIN - DAWN" or "EXT. NEON ALLEYWAY - NIGHT"). DO NOT use generic structural names like "INT. ACT_1_CLIMAX - DAY"!
- "goal": A single clear sentence stating the dramatic purpose of the scene.
- "description": A highly creative, specific 1-sentence description of the scene's dramatic action.

Return ONLY the JSON object. Do not include markdown or explanations.`;
