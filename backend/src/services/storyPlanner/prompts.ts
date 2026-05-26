export const MASTER_OUTLINE_PROMPT = `You are a master story architect. Create a {{target_scale}}-beat global story outline for the following logline.

LOGLINE: "{{logline}}"

Return a JSON array of strings, where each string is a one-sentence description of a story beat.
Example: ["The hero discovers a hidden letter", "A rival appears at the ceremony", ...]

RULES:
- Each beat should be a single, clear sentence.
- Cover the full arc: setup, rising action, midpoint, crisis, climax, resolution.
- Return ONLY the JSON array. No markdown, no explanations.`;

export const RECURSIVE_SUMMARY_PROMPT = `You are a story continuity editor. Read the RECENT SCENES below and the existing STORY SO FAR summary. Generate an updated cumulative summary that incorporates the new events.

## STORY SO FAR
{{story_so_far}}

## RECENT SCENES
{{recent_scenes}}

RULES:
- Write a flowing, third-person narrative summary (2-4 paragraphs).
- Include key character developments, plot turns, and emotional shifts.
- Do not include scene numbers or formatting markers.
- Return ONLY the updated summary text.`;

export const BLOCK_BEAT_SHEET_PROMPT = `You are a screenplay story architect. Generate a detailed beat sheet for scenes {{start_scene}} through {{end_scene}}.

## STORY SO FAR
{{story_so_far}}

## GLOBAL OUTLINE
{{global_outline}}

Return ONLY a valid JSON object containing a single key "scenes", which holds an array of scene objects. Each scene must have:
- "title": A highly creative, evocative scene title. STRICT RULE: DO NOT use words like "Act", "Scene", "Climax", or milestone names!
- "slugline": A WGA industry-standard scene header. STRICT RULE: You MUST invent specific physical locations (e.g. "INT. DUSTY CABIN - DAWN"). DO NOT use generic structural names like "INT. LOCATION - TIME" or "INT. ACT_1"!
- "summary": 2-3 sentence description of what happens
- "goal": The dramatic purpose of the scene

Return ONLY the JSON object. No markdown.`;

export const BEAT_SHEET_PROMPT = `You are a master story architect. Create a beat sheet for the following story idea.

IDEA: "{{idea}}"
GENRE: {{genre}}
TONE: {{tone}}

## STORY SO FAR
{{story_so_far}}

## GLOBAL OUTLINE
{{global_outline}}

Return a JSON object with acts and beats. Each beat must have "name", "title", "slugline", and "description".
Return ONLY valid JSON.`;

export const CORE_BEATS_OUTLINE_PROMPT = `You are a master story architect.
Convert the following Logline into a structured beat outline of exactly {{core_beats_count}} core structural milestones following the {{structure_name}} framework.

LOGLINE: "{{logline}}"

Return ONLY a valid JSON object containing a single key "beats", which holds an array of objects. Each object must have:
- "name": The structural milestone name (e.g. "Inciting Incident")
- "description": A 1-2 sentence dramatic projection of how this milestone plays out in this story.

Return ONLY the JSON object. Do not include markdown or explanations.`;

export const BLOCK_SKELETON_PROMPT = `You are a professional screenplay architect.
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
