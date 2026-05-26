import { z } from 'zod';

// Define the categories of screenplay lines
export const ScreenplayLineKindSchema = z.enum([
    'blank',
    'slug',
    'cue',
    'parenthetical',
    'dialogue',
    'transition',
    'action'
]);

export type ScreenplayLineKind = z.infer<typeof ScreenplayLineKindSchema>;

// Schema for a single screenplay line, validating standard properties
export const ScreenplayLineSchema = z.object({
    lineNumber: z.number().int().positive(),
    text: z.string(),
    kind: ScreenplayLineKindSchema,
    characterName: z.string().optional() // For dialogue/parenthetical lines
});

export type ScreenplayLine = z.infer<typeof ScreenplayLineSchema>;

// Screenplay Scene validation schema using strict refinements
export const ScreenplaySceneSchema = z.object({
    title: z.string().min(1),
    lines: z.array(ScreenplayLineSchema)
}).refine((scene) => {
    // Structural refinement: Dialogues must always be preceded by a character cue or parenthetical
    for (let i = 0; i < scene.lines.length; i++) {
        const line = scene.lines[i];
        if (line.kind === 'dialogue') {
            if (i === 0) return false; // First line cannot be dialogue
            const prev = scene.lines[i - 1];
            if (prev.kind !== 'cue' && prev.kind !== 'parenthetical' && prev.kind !== 'dialogue') {
                return false;
            }
        }
    }
    return true;
}, {
    message: "Screenplay constraint violated: Every dialogue line must be preceded by a character cue, a parenthetical, or an existing dialogue block.",
    path: ["lines"]
}).refine((scene) => {
    // Structural refinement: Parentheticals must always be preceded by a character cue
    for (let i = 0; i < scene.lines.length; i++) {
        const line = scene.lines[i];
        if (line.kind === 'parenthetical') {
            if (i === 0) return false;
            const prev = scene.lines[i - 1];
            if (prev.kind !== 'cue') {
                return false;
            }
        }
    }
    return true;
}, {
    message: "Screenplay constraint violated: Every parenthetical instruction must be directly preceded by a character cue.",
    path: ["lines"]
}).refine((scene) => {
    // Uppercase constraints: Cues, Sluglines, and Transitions must be in uppercase
    for (const line of scene.lines) {
        const trimmed = line.text.trim();
        if (line.kind === 'cue') {
            const cleanCue = trimmed.replace(/<[^>]*>/g, '').replace(/^[>@\s]*/, '').replace(/\^$/, '').trim();
            if (cleanCue !== cleanCue.toUpperCase()) {
                return false;
            }
        }
        if (line.kind === 'slug') {
            if (trimmed !== trimmed.toUpperCase()) {
                return false;
            }
        }
    }
    return true;
}, {
    message: "Screenplay uppercase constraint violated: All Character Cues and Scene Sluglines must be in uppercase.",
    path: ["lines"]
});

export type ScreenplayScene = z.infer<typeof ScreenplaySceneSchema>;

/**
 * Screenplay parser that handles standard formatting as well as Markdown/HTML center tags
 */
export function parseScreenplayText(rawText: string): ScreenplayLine[] {
    const rawLines = rawText.replace(/\r\n/g, '\n').split('\n');
    const parsedLines: ScreenplayLine[] = [];
    
    let lastKind: ScreenplayLineKind = 'blank';
    let currentCharacter: string | undefined = undefined;

    for (let i = 0; i < rawLines.length; i++) {
        const rawLine = rawLines[i];
        const trimmed = rawLine.trim();
        const lineNum = i + 1;

        if (!trimmed) {
            lastKind = 'blank';
            parsedLines.push({ lineNumber: lineNum, text: '', kind: 'blank' });
            continue;
        }

        // 1. Markdown/HTML Center Tag Cue: <center>NAME</center> or plain capitalized cue line
        const centerMatch = trimmed.match(/^<center>\s*([A-Z\s\-]+)\s*<\/center>$/i);
        const isCenterCue = !!centerMatch;
        const cleanName = isCenterCue ? centerMatch[1].trim().toUpperCase() : trimmed.replace(/^[>@\s]*/, '').replace(/:$/, '').trim();
        
        const isPlainCue = !isCenterCue && 
                           cleanName.length > 0 && 
                           cleanName.length <= 40 && 
                           cleanName === cleanName.toUpperCase() && 
                           /[A-Z]/.test(cleanName) && 
                           !/[.!?]$/.test(cleanName) &&
                           !/^(INT\b|EXT\b|FADE\b|CUT\b)/i.test(cleanName);

        if (isCenterCue || isPlainCue) {
            currentCharacter = cleanName;
            lastKind = 'cue';
            parsedLines.push({
                lineNumber: lineNum,
                text: rawLine,
                kind: 'cue',
                characterName: currentCharacter
            });
            continue;
        }

        // 2. Sluglines
        if (/^(INT\.?|EXT\.?|EST\.?|INT\/EXT\.?|INT\.\/EXT\.?|EXT\/INT\.?|EXT\.\/INT\.?|I\/E\.?)\s+.+$/i.test(trimmed)) {
            currentCharacter = undefined;
            lastKind = 'slug';
            parsedLines.push({ lineNumber: lineNum, text: rawLine, kind: 'slug' });
            continue;
        }

        // 3. Parentheticals: (dialogue directive) or markdown variant like > (directive)
        const cleanParentheticalText = trimmed.replace(/^>\s*/, '').trim();
        const isParenthetical = /^\([^)]*\)$/.test(cleanParentheticalText);

        if (isParenthetical) {
            lastKind = 'parenthetical';
            parsedLines.push({
                lineNumber: lineNum,
                text: rawLine,
                kind: 'parenthetical',
                characterName: currentCharacter
            });
            continue;
        }

        // 4. Transitions
        if (/^(FADE IN:?|FADE OUT\.?|CUT TO:|MATCH CUT TO:|SMASH CUT TO:|DISSOLVE TO:)$/.test(trimmed.toUpperCase()) || trimmed.toUpperCase().endsWith(' TO:')) {
            currentCharacter = undefined;
            lastKind = 'transition';
            parsedLines.push({ lineNumber: lineNum, text: rawLine, kind: 'transition' });
            continue;
        }

        // 5. Dialogue: blockquoted with `>` or following a cue/parenthetical
        const isBlockquotedDialogue = trimmed.startsWith('>');
        if (isBlockquotedDialogue || lastKind === 'cue' || lastKind === 'parenthetical' || lastKind === 'dialogue') {
            lastKind = 'dialogue';
            parsedLines.push({
                lineNumber: lineNum,
                text: rawLine,
                kind: 'dialogue',
                characterName: currentCharacter
            });
            continue;
        }

        // 6. Action
        currentCharacter = undefined;
        lastKind = 'action';
        parsedLines.push({ lineNumber: lineNum, text: rawLine, kind: 'action' });
    }

    return parsedLines;
}

// User-provided screenplay scene to validate
const userSceneText = `EXT. HASTINAPUR ARENA - DAY

The vast arena is locked in a ringing silence. TENS OF THOUSANDS of eyes are fixed on DURYODHANA, whose powerful frame radiates absolute command.

He walks with a deliberate, muscular gait, not to the royal box, but directly towards the center of the arena. Towards KARNA.

Karna stands frozen, the fire of his humiliation banked by confusion. His jaw is granite, his fists clenched, but his eyes follow the approaching prince.

Duryodhana circles him once, a predator assessing a magnificent new weapon. A slow, audacious smirk spreads across his face. He stops and turns not to Karna, but to the royal preceptor, KRIPACHARYA.

<center>DURYODHANA</center>
> Royal Guru... you asked for this man's lineage. You spoke of rules. Of tradition.

Kripacharya, standing beside the royal family, puffs up with indignation, about to speak. Duryodhana raises a hand, silencing him without a glance. His voice booms, filling the silent stadium.

<center>DURYODHANA</center>
> (to the assembly)
> But tradition is the shield of the timid. And rules are the excuses of the weak. I see a warrior here whose skill is his lineage. Whose valor is his bloodline!

He turns back to Karna, his eyes gleaming.

<center>DURYODHANA</center>
> A man's worth is not in his birth, but in his deeds. And by the deed I have just witnessed, this man is the equal of any king!

A shocked MURMUR ripples through the crowd and the royal box. GURU DRONA shifts uncomfortably. In the stands, KUNTI’s hands fly to her mouth, her face ashen. ARJUNA watches, his expression unreadable, his knuckles white on the grip of his bow.

Duryodhana’s voice drops, becoming sharp, decisive.

<center>DURYODHANA</center>
> If his lack of a kingdom is the only barrier to his right to challenge my cousin... then I shall remove that barrier.

He raises his voice to a full-throated roar.

<center>DURYODHANA</center>
> As Prince of Hastinapur, I, Duryodhana, do hereby name this warrior... King of Anga!

STUNNED. SILENCE.

The words hang in the air, impossible. Kripacharya's mouth hangs open. The elders look at each other in disbelief.

Duryodhana signals to one of his attendants, who rushes forward, bearing a golden, jewel-encrusted CROWN on a velvet cushion.

Duryodhana takes the crown. He turns to Karna, who stares at him, utterly dumbfounded. The fury in his eyes has been replaced by a raw, vulnerable shock. For the first time, he looks his age.

Duryodhana lifts the crown high for all to see. The sun catches the jewels, scattering light across the arena floor.

Then, with a flourish, he places it firmly on Karna's head.

The weight of it seems to land on Karna's soul. He flinches, his eyes wide. A king. Crowned in the very spot of his deepest shame.

The silence of the CROWD is no longer tense, but awestruck. They stare at the charioteer's son, now a king, made so by an act of pure, defiant will.`;

function runValidation() {
    console.log("====================================================");
    console.log("🎬 SCREENPLAY VALIDATION RUNNER (ZOD SCHEMA JUDGE)");
    console.log("====================================================");

    const parsedLines = parseScreenplayText(userSceneText);
    
    // Build screen scene object for Zod validation
    const screenplaySceneData = {
        title: "Karna's Coronation as King of Anga",
        lines: parsedLines
    };

    console.log(`Parsed ${parsedLines.length} lines from scene raw text.\n`);

    const result = ScreenplaySceneSchema.safeParse(screenplaySceneData);

    if (result.success) {
        console.log("✅ SUCCESS: Screenplay scene passed Zod validation perfectly!");
        console.log("No formatting or hierarchy constraint violations detected.\n");
        
        // Output statistical summary
        const stats = parsedLines.reduce((acc, line) => {
            acc[line.kind] = (acc[line.kind] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);

        console.log("--- Scene Line-by-Line Breakdown ---");
        console.log(`Action lines:       ${stats.action || 0}`);
        console.log(`Character Cues:     ${stats.cue || 0}`);
        console.log(`Parentheticals:     ${stats.parenthetical || 0}`);
        console.log(`Dialogue lines:     ${stats.dialogue || 0}`);
        console.log(`Sluglines:          ${stats.slug || 0}`);
        console.log(`Transitions:        ${stats.transition || 0}`);
        console.log(`Blank lines:        ${stats.blank || 0}`);
        console.log("------------------------------------\n");
    } else {
        console.error("❌ FAILED: Screenplay validation failed!");
        console.error(JSON.stringify(result.error.format(), null, 2));
    }
}

runValidation();
