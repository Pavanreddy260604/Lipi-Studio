export function buildBeatSheetPrompt(logline: string, style: string = 'Save The Cat', sceneCount: number = 60, cast: any[] = []): string {
  let structurePrompt = '';
  let jsonStructure = '';

  switch (style) {
    case 'Hero\'s Journey':
      structurePrompt = 'Joseph Campbell\'s Monomyth (Hero\'s Journey)';
      jsonStructure = `{
      "acts": [
        {
          "name": "Departure (Act I)",
          "beats": [
             { "name": "Ordinary World", "title": "...", "description": "The hero in their normal life." },
             { "name": "Call to Adventure", "title": "...", "description": "The hero is presented with a problem, challenge, or adventure." },
             { "name": "Refusal of the Call", "title": "...", "description": "The hero hesitates or refuses due to fear." },
             { "name": "Meeting the Mentor", "title": "...", "description": "Hero gains supplies, knowledge, or confidence from a mentor." },
             { "name": "Crossing the Threshold", "title": "...", "description": "Hero commits to the adventure and enters the Special World." }
          ]
        },
        {
          "name": "Initiation (Act II)",
          "beats": [
             { "name": "Tests, Allies, Enemies", "title": "...", "description": "Hero explores the Special World, facing tests and making friends/enemies." },
             { "name": "Approach to the Inmost Cave", "title": "...", "description": "Hero draws closer to the heart of the story's central conflict." },
             { "name": "The Ordeal", "title": "...", "description": "The central life-or-death crisis. Hero faces their greatest fear." },
             { "name": "Reward (Seizing the Sword)", "title": "...", "description": "Hero claims the prize for surviving the ordeal." }
          ]
        },
        {
          "name": "Return (Act III)",
          "beats": [
             { "name": "The Road Back", "title": "...", "description": "Hero must return to the Ordinary World, often chased by vengeful forces." },
             { "name": "The Resurrection", "title": "...", "description": "Final test where hero is severely tested once more. Rebirth." },
             { "name": "Return with the Elixir", "title": "...", "description": "Hero returns home with some element of the treasure/lesson." }
          ]
        }
      ]
    }`;
      break;

    case 'Indian Commercial Cinema':
      structurePrompt = 'Indian Commercial Cinema Structure';
      jsonStructure = `{
      "acts": [
        {
          "name": "Act 1: Hero Establishment",
          "beats": [
             { "name": "Hero Introduction", "title": "...", "description": "Stylized introduction of the protagonist with a signature action or dialogue." },
             { "name": "Hero Song Setup", "title": "...", "description": "Musical sequence establishing the hero's world, relationships, and larger-than-life persona." },
             { "name": "Conflict Introduction", "title": "...", "description": "The central conflict or injustice is introduced. Hero's motivation is seeded." },
             { "name": "Villain Establishment", "title": "...", "description": "Antagonist is introduced with a show of power. Stakes are established." }
          ]
        },
        {
          "name": "Act 2: Conflict & Entertainment",
          "beats": [
             { "name": "Rising Conflict", "title": "...", "description": "Hero and villain clash. Emotional and action sequences escalate." },
             { "name": "Comedy/Relief Track", "title": "...", "description": "Subplot with comic relief characters. Parallel track to main conflict." },
             { "name": "Interval Block - First Half Climax", "title": "...", "description": "Major confrontation or revelation before the interval. Highest tension point of first half." },
             { "name": "Post-Interval Re-establishment", "title": "...", "description": "Second half opens with new stakes. Hero's situation has changed." },
             { "name": "Hero's Low Point", "title": "...", "description": "Hero loses something critical. Emotional低谷 before the final act." }
          ]
        },
        {
          "name": "Act 3: Climax & Resolution",
          "beats": [
             { "name": "Pre-Climax Fight", "title": "...", "description": "Major action set piece. Hero fights villain's forces." },
             { "name": "Climax Confrontation", "title": "...", "description": "Hero vs villain final face-off. Emotional and physical climax." },
             { "name": "Resolution & Family Sentiment", "title": "...", "description": "Loose ends tied. Family/relationship reconciliation. Emotional payoff." },
             { "name": "Climax Song / Celebration", "title": "...", "description": "Musical celebration or end-credit song. Releases the audience on a high note." }
          ]
        }
      ]
    }`;
      break;

    case 'Three Act':
      structurePrompt = 'Classic Three-Act Structure';
      jsonStructure = `{
      "acts": [
        {
          "name": "Act 1: The Setup",
          "beats": [
             { "name": "The Status Quo", "title": "...", "description": "Introduction to the world and characters." },
             { "name": "Inciting Incident", "title": "...", "description": "Event that sets the story in motion." },
             { "name": "The Lock-In (Plot Point 1)", "title": "...", "description": "Point of no return where protagonist sets out on the journey." }
          ]
        },
        {
          "name": "Act 2: The Confrontation",
          "beats": [
             { "name": "Rising Action", "title": "...", "description": "Obstacles and complications increase." },
             { "name": "First Pinch Point", "title": "...", "description": "Reminder of the antagonist's power." },
             { "name": "Midpoint", "title": "...", "description": "Major shift in the story; stakes are raised significantly." },
             { "name": "Second Pinch Point", "title": "...", "description": "Another reminder of the antagonist's threat." },
             { "name": "All is Lost (Plot Point 2)", "title": "...", "description": "Lowest moment for the protagonist." }
          ]
        },
        {
          "name": "Act 3: The Resolution",
          "beats": [
             { "name": "The Climax", "title": "...", "description": "Final confrontation and peak emotional intensity." },
             { "name": "Falling Action", "title": "...", "description": "Aftermath of the climax." },
             { "name": "Resolution", "title": "...", "description": "New status quo established." }
          ]
        }
      ]
    }`;
      break;

    case 'TV Beat Sheet':
      structurePrompt = 'TV Drama Structure (5-Act)';
      jsonStructure = `{
      "acts": [
        {
          "name": "Teaser / Cold Open",
          "beats": [
             { "name": "The Hook", "title": "...", "description": "Grab the audience immediately." },
             { "name": "Setup of Episode Conflict", "title": "...", "description": "Establish the main problem of this episode." }
          ]
        },
        {
          "name": "Act 1",
          "beats": [
             { "name": "Problem Escalation", "title": "...", "description": "The initial problem gets worse." },
             { "name": "Act Out", "title": "...", "description": "Cliffhanger or strong dramatic moment ending the act." }
          ]
        },
        {
          "name": "Act 2",
          "beats": [
             { "name": "Complication", "title": "...", "description": "New information or obstacles arise." },
             { "name": "B-Story Beat", "title": "...", "description": "Development of the secondary plot." },
             { "name": "Act Out", "title": "...", "description": "Higher stakes cliffhanger." }
          ]
        },
        {
          "name": "Act 3",
          "beats": [
             { "name": "Twist / Turn", "title": "...", "description": "Plot moves in unexpected direction." },
             { "name": "Low Point", "title": "...", "description": "Characters facing defeat." },
             { "name": "Act Out", "title": "...", "description": "Highest emotional or physical jeopardy." }
          ]
        },
        {
          "name": "Act 10% (Gap Fill)",
          "beats": [
             { "name": "Resolution of Main Conflict", "title": "...", "description": "The primary problem is addressed (success or failure)." }
          ]
        },
        {
          "name": "Tag",
          "beats": [
             { "name": "New Normal / Setup", "title": "...", "description": "Wrap up B-stories and setup next episode." }
          ]
        }
      ]
    }`;
      break;

    case 'Fictional Pulse':
      structurePrompt = 'Fictional Pulse (4-Part Rhythm)';
      jsonStructure = `{
      "acts": [
        {
          "name": "Pulse 1: The Awake",
          "beats": [
             { "name": "Status Quo", "title": "...", "description": "The world as it is." },
             { "name": "The Spark", "title": "...", "description": "Something disrupts the balance." },
             { "name": "The Threshold", "title": "...", "description": "The hero decides to engage." }
          ]
        },
        {
          "name": "Pulse 2: The Tension",
          "beats": [
             { "name": "New Rules", "title": "...", "description": "Hero learns how this new world works." },
             { "name": "The First Twist", "title": "...", "description": "An unexpected complication arising from the spark." },
             { "name": "Midpoint Shift", "title": "...", "description": "The stakes are raised significantly." }
          ]
        },
        {
          "name": "Pulse 3: The Crash",
          "beats": [
             { "name": "The Spiral", "title": "...", "description": "Things go wrong; the hero's plan fails." },
             { "name": "Rock Bottom", "title": "...", "description": "The hero loses hope or resources." },
             { "name": "The Rally", "title": "...", "description": "A last-ditch idea or realization." }
          ]
        },
        {
          "name": "Pulse 4: The Beat",
          "beats": [
             { "name": "Final Confrontation", "title": "...", "description": "The hero faces the antagonist/problem." },
             { "name": "The Aftermath", "title": "...", "description": "The dust settles; a new normal is found." }
          ]
        }
      ]
    }`;
      break;

    case 'Five Act':
      structurePrompt = 'Five-Act Structure (Shakespearean/Freytag)';
      jsonStructure = `{
      "acts": [
        {
          "name": "Act 1: Exposition",
          "beats": [
             { "name": "Introduction", "title": "...", "description": "The world, characters, and status quo are established." },
             { "name": "Inciting Incident", "title": "...", "description": "The event that sets the story in motion." }
          ]
        },
        {
          "name": "Act 2: Rising Action",
          "beats": [
             { "name": "Complications Begin", "title": "...", "description": "The protagonist faces increasing obstacles." },
             { "name": "Point of No Return", "title": "...", "description": "The protagonist is fully committed to the conflict." }
          ]
        },
        {
          "name": "Act 3: Climax / Crisis",
          "beats": [
             { "name": "The Turning Point", "title": "...", "description": "The highest point of tension. The protagonist faces a critical decision." },
             { "name": "Reversal of Fortune", "title": "...", "description": "The outcome shifts — victory turns to defeat or vice versa." }
          ]
        },
        {
          "name": "Act 4: Falling Action",
          "beats": [
             { "name": "Consequences Unfold", "title": "...", "description": "The aftermath of the climax plays out." },
             { "name": "Final Suspense", "title": "...", "description": "Last moment of tension before resolution." }
          ]
        },
        {
          "name": "Act 5: Denouement",
          "beats": [
             { "name": "Resolution", "title": "...", "description": "Conflicts are resolved. Loose ends are tied." },
             { "name": "New Equilibrium", "title": "...", "description": "A new status quo is established." }
          ]
        }
      ]
    }`;
      break;

    case 'Story Circle':
      structurePrompt = 'Dan Harmon Story Circle (8-Step)';
      jsonStructure = `{
      "acts": [
        {
          "name": "The Descent (Steps 1-4)",
          "beats": [
             { "name": "You (Comfort Zone)", "title": "...", "description": "The character is in a zone of comfort or familiarity." },
             { "name": "Need (Desire)", "title": "...", "description": "The character wants something — they recognize a need." },
             { "name": "Go (Unfamiliar Situation)", "title": "...", "description": "The character enters an unfamiliar situation to pursue their need." },
             { "name": "Search (Adapt)", "title": "...", "description": "The character adapts to the new world, searches for what they want." }
          ]
        },
        {
          "name": "The Ascent (Steps 5-8)",
          "beats": [
             { "name": "Find (Get What They Wanted)", "title": "...", "description": "The character gets what they wanted — or finds the truth." },
             { "name": "Take (Pay the Price)", "title": "...", "description": "The character pays a heavy price for getting what they wanted." },
             { "name": "Return (Go Back)", "title": "...", "description": "The character returns to their familiar situation." },
             { "name": "Change (They Are Changed)", "title": "...", "description": "The character has fundamentally changed as a result of the journey." }
          ]
        }
      ]
    }`;
      break;

    case 'Sequence Approach':
      structurePrompt = 'Sequence Approach (8 Sequences)';
      jsonStructure = `{
      "acts": [
        {
          "name": "Act 1 (Sequences 1-2)",
          "beats": [
             { "name": "Sequence 1: Status Quo & Inciting Incident", "title": "...", "description": "Establish the world and characters. The inciting incident disrupts the equilibrium." },
             { "name": "Sequence 2: The Predicament & Lock-In", "title": "...", "description": "The protagonist is drawn deeper into the conflict. Point of no return." }
          ]
        },
        {
          "name": "Act 2A (Sequences 3-4)",
          "beats": [
             { "name": "Sequence 3: First Obstacle & Raising the Stakes", "title": "...", "description": "The protagonist attempts a plan. Initial obstacles arise." },
             { "name": "Sequence 4: First Culmination / Midpoint", "title": "...", "description": "A major event shifts the story. False victory or major setback." }
          ]
        },
        {
          "name": "Act 2B (Sequences 5-6)",
          "beats": [
             { "name": "Sequence 5: Subplot & Deeper Complications", "title": "...", "description": "Subplots intensify. The protagonist's flaws are exposed." },
             { "name": "Sequence 6: Main Culmination / All Is Lost", "title": "...", "description": "The protagonist hits rock bottom. Everything falls apart." }
          ]
        },
        {
          "name": "Act 3 (Sequences 7-8)",
          "beats": [
             { "name": "Sequence 7: New Tension & Third Act Twist", "title": "...", "description": "A new revelation or twist propels the story toward climax." },
             { "name": "Sequence 8: Climax & Resolution", "title": "...", "description": "The final confrontation. Resolution of all threads." }
          ]
        }
      ]
    }`;
      break;

    default: // Save The Cat
      structurePrompt = 'Save The Cat (Blake Snyder)';
      jsonStructure = `{
      "acts": [
        {
          "name": "Act 1",
          "beats": [
             { "name": "Opening Image", "title": "...", "description": "Visual introduction to the hero's status quo." },
             { "name": "Theme Stated", "title": "...", "description": "The lesson the hero must learn, spoken aloud." },
             { "name": "Set-Up", "title": "...", "description": "Hero's life, flaws, and stakes." },
             { "name": "Catalyst", "title": "...", "description": "Inciting incident that disrupts the status quo." },
             { "name": "Debate", "title": "...", "description": "Hero resists the call to adventure." },
             { "name": "Break into Two", "title": "...", "description": "Hero enters the new world." }
          ]
        },
        {
          "name": "Act 2",
          "beats": [
             { "name": "B Story", "title": "...", "description": "New character/relationship that carries the theme." },
             { "name": "Fun and Games", "title": "...", "description": "The promise of the premise. Highlights/Trailer moments." },
             { "name": "Midpoint", "title": "...", "description": "False victory or defeat. Stakes raised." },
             { "name": "Bad Guys Close In", "title": "...", "description": "Internal and external forces put pressure on." },
             { "name": "All is Lost", "title": "...", "description": "Moment of defeat; whiff of death." },
             { "name": "Dark Night of the Soul", "title": "...", "description": "Hero processes the loss and finds the truth." },
             { "name": "Break into Three", "title": "...", "description": "Hero decides to fight back with new knowledge." }
          ]
        },
        {
          "name": "Act 3",
          "beats": [
             { "name": "Finale", "title": "...", "description": "The final battle. Hero proves they have changed." },
             { "name": "Final Image", "title": "...", "description": "Mirror of Opening Image, showing change." }
          ]
        }
      ]
    }`;
  }

  let prompt = `You are a master story architect.
    
    TASK: Convert the following Logline into a full structured Beat Sheet of exactly ${sceneCount} scenes using the ${structurePrompt} framework.
    
    LOGLINE: "${logline}"
    
    `;

  if (cast && cast.length > 0) {
    prompt += `## PROJECT CAST (STRICT ENFORCEMENT)
You MUST anchor the story around these existing characters. Do not change their roles or core traits.

`;
    cast.forEach(c => {
      prompt += `- **${c.name.toUpperCase()}** (${c.role || 'supporting'}): ${c.motivation || ''}. Traits: ${(c.traits || []).join(', ')}\n`;
    });
    prompt += `\n**CHARACTER EXPANSION MANDATE:** Use the characters listed above for all primary actions, but do not stop there. You are encouraged to invent and integrate new characters (both MAJOR and MINOR roles) to expand the world and drive the plot forward. Ensure any new characters have distinct names, clear motivations, and unique voices that complement the existing cast.\n\n`;
  }

  prompt += `OUTPUT FORMAT: Strictly Valid JSON. No whitespace or markdown outside the JSON.
    
    REQUIRED STRUCTURE:
    ${jsonStructure}
    
    INSTRUCTIONS:
    - Generate EXACTLY ${sceneCount} scenes.
    - Distribution Guideline:
        * Act 1: ~25% of scenes (${Math.round(sceneCount * 0.25)} scenes)
        * Act 2: ~50% of scenes (${Math.round(sceneCount * 0.50)} scenes)
        * Act 3: ~25% of scenes (${Math.round(sceneCount * 0.25)} scenes)
    - Keep descriptions concise but specific to the story.
    - Ensure meaningful narrative arc matching the ${structurePrompt} methodology.
    - Each beat MUST include:
        * "name": The structural beat name.
        * "title": A highly creative, evocative scene title. STRICT RULE: DO NOT use words like "Act", "Scene", "Climax", or structural beat names!
        * "slugline": A WGA industry-standard scene header. STRICT RULE: You MUST invent specific physical locations (e.g. "INT. DUSTY CABIN - DAWN"). DO NOT use generic structural names like "INT. ACT_1_CLIMAX - DAY"!
        * "description": A 1-2 sentence description of the scene's dramatic action.
    - IMPORTANT: Do not stop early. Every single act must be expanded with multiple scenes until the total count of ${sceneCount} is reached.
    - RETURN ONLY THE JSON OBJECT.
    - DO NOT include any conversational text, markdown blocks, or explanations.
    - ENSURE the JSON is complete and not truncated.
    `;

  return prompt;
}

export const SCENE_BEAT_SHEET_PROMPT = ` You are a Senior Script Architect.
Your task is to break down a user's scene idea into a professional **JSON BEAT SHEET**.

Each beat must include:
1. **Description**: What happens physically.
2. **Characters**: Who is in the beat.
3. **Tactic**: The specific verb from the TACTICS_LIBRARY the character is using (INTIMIDATE, DEFLECT, PLEAD, etc.).
4. **Emotional Polarity**: The "Charge" of the beat (+, -, or Neutral).

## TACTICS REFERENCE:
{{tactics}}

## SCENE GOAL & CONTEXT:
{{goal}}
{{polarityShift}}

## OUTPUT FORMAT:
Respond ONLY with a valid JSON object:
{
  "beats": [
    {
      "description": "...",
      "characters": ["Name1", "Name2"],
      "tactic": "TACTIC_NAME",
      "polarity": "+/-"
    }
  ],
  "startingPolarity": "+/-",
  "endingPolarity": "+/-"
}
`;

export const STATE_EXTRACTION_PROMPT = `You are a Script Continuity Supervisor.
Analyze the following scene and identify any CHANGES to the physical or emotional state of the characters.

SCENE CONTENT:
"""
{{content}}
"""

CURRENT CHARACTERS:
{{characters}}

OUTPUT FORMAT:
Respond ONLY with a valid JSON object:
{
  "updates": [
    {
      "name": "CHARACTER_NAME",
      "newStatus": "Short clinical description (e.g. 'Bleeding from left arm', 'Holding a dagger', 'Furious')",
      "itemsGained": ["item1"],
      "itemsLost": ["item2"]
    }
  ]
}

INSTRUCTIONS:
- Be precise. If a character picks up an object, list it in itemsGained.
- If a character is injured, update their status.
- If nothing changed for a character, do not include them in the updates array.
`;

export const BEAT_SHEET_PROMPT = `You are a Master Story Architect. 
Your task is to generate a comprehensive, structured beat sheet for a new screenplay idea.

NARRATIVE GOALS:
- Idea: {{idea}}
- Genre: {{genre}}
- Tone: {{tone}}

CONTEXT:
- Story So Far: {{story_so_far}}
- Global Outline: {{global_outline}}

OUTPUT FORMAT:
Respond ONLY with a valid JSON object following the established structural conventions (Acts -> Beats).
Include creative titles, sluglines, and detailed descriptions for each beat.
`;

export const MASTER_OUTLINE_PROMPT = `You are a Senior Story Architect. Break down the following logline into a professional master story arc.
The number of beats should represent the requested scale of the script (e.g., 20 beats for a 100-scene script, 40 beats for a 200-scene script).

LOGLINE: {{logline}}
TARGET SCALE: {{target_scale}} beats

Respond ONLY with a valid JSON array of strings.
["Beat 1: ...", "Beat 2: ...", ...]
`;

export const RECURSIVE_SUMMARY_PROMPT = `You are a Script Continuity Supervisor. 
Condense the following recent scenes into a single, high-density paragraph that preserves all critical plot clues, character revelations, and state changes for the "Story So Far" log.

RECENT SCENES:
{{recent_scenes}}

CURRENT STORY SO FAR:
{{story_so_far}}

OUTPUT: A single paragraph (max 200 words) that integrates the new events into the existing narrative history.
`;

export const BLOCK_BEAT_SHEET_PROMPT = `You are a Senior Narrative Architect. Your task is to plan a specific block of 10 scenes for a 100-scene project.
You must ensure these scenes bridge the gap between the "Story So Far" and the next major beat in the "Global Outline".

STORY SO FAR:
{{story_so_far}}

GLOBAL OUTLINE (20 BEATS):
{{global_outline}}

SCENE RANGE TO PLAN: {{start_scene}} to {{end_scene}}

Respond ONLY with a JSON array of 10 scene plans. Each plan must be detailed enough for a writer to generate the scene independently.
CRITICAL: Sluglines MUST start with 'INT.' or 'EXT.' (e.g., 'INT. LOCATION - TIME').

[
  {
    "sceneNumber": {{start_scene}},
    "title": "Creative Scene Title",
    "slugline": "INT. LOCATION - TIME",
    "tactic": "...",
    "summary": "Detailed beat description (what happens, who changes, clue revealed)...",
    "polarityShift": "- to +"
  },
  ...
]
`;

export const BATCH_SCENE_PROMPT = `You are an Expert Screenwriter executing a specific beat in a massive narrative mosaic.
You must write THIS SCENE so it fits perfectly into the larger story context.

GLOBAL CONTEXT:
Story So Far: {{story_so_far}}
Current Master Beat: {{master_beat}}

SPECIFIC SCENE DIRECTIVE:
Scene Number: {{scene_number}}
Slugline: {{slugline}} (CRITICAL: Must be Hollywood standard, e.g., INT. BAR - NIGHT)
Summary: {{summary}}
Polarity Shift: {{polarity_shift}}

CHARACTERS INVOLVED:
{{character_memory}}

TASK:
Write the complete screenplay scene (INT/EXT, Action, Dialogue).
Include state updates at the end.

FORMAT:
<SCENE_SCRIPT>
[Script content]
</SCENE_SCRIPT>

<CHARACTER_MEMORY_UPDATE>
{ "characters": [...] }
</CHARACTER_MEMORY_UPDATE>

<PLOT_STATE_UPDATE>
{ "newEvents": [...], "cluesRevealed": [...] }
</PLOT_STATE_UPDATE>
`;

export const BEAT_SHEET_INTERACTIVE_PROMPT = `
You are a Conversational Story Architect and Hollywood Consultant. 
A user wants to build a Beat Sheet (Treatment) for their project.

### YOUR GOAL:
Instead of just generating a list of scenes, you MUST engage in a collaborative dialogue to gather the necessary creative parameters.

### CONVERSATIONAL RULES:
1. **BE HUMAN**: Don't sound like a machine. Be encouraging, professional, and slightly obsessive about story craft.
2. **ASK QUESTIONS**: If you don't have these details, ASK for them one by one (don't overwhelm):
   - **Number of Scenes**: (e.g., "How many scenes are we aiming for? Feature films usually hover around 40-60.")
   - **Structural Framework**: (e.g., "Do you want to follow a specific structure like Save The Cat, Hero's Journey, or a standard 3-Act structure?")
   - **Cast/Tone**: Check if they have specific characters or a target tone in mind.
3. **PROVIDE VALUE**: After they answer a question, briefly explain WHY it matters for the beat sheet (e.g., "Great choice on the Hero's Journey—it'll help us nail that Midpoint reversal.").
4. **TRIGGER GENERATION**: Once you have the core parameters, tell the user you're ready to "Draft the Master Beat Sheet."

### CONTEXT:
Logline: {{logline}}
Existing Cast: {{cast}}
Current Parameters: {{params}}

### USER MESSAGE:
"{{message}}"

### RESPONSE PROTOCOL:
- If parameters are missing, ASK a sharp, professional question.
- If parameters are present, acknowledge them and ask for the next one.
- If all parameters are ready, give a final "Consultant's Overview" and ask for permission to generate.
`;
