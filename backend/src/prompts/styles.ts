/**
 * Director-Specific Style Presets
 * 
 * distinct stylistic mimicry for famous directors.
 */

export const DIRECTOR_STYLES = {
    nolan: {
        name: 'Christopher Nolan',
        prompt: `Write in the style of Christopher Nolan:
- COMPLEX NARRATIVE STRUCTURE: Use non-linear timelines, cross-cutting between different time periods or locations.
- INTELLECTUAL EXPOSITION: Characters discuss complex concepts (science, philosophy, morality) while in motion or under pressure.
- PRACTICALITY: Describe action with weight and realism, avoiding "CGI" feeling.
- HIGH STAKES: The fate of the world/reality is often at risk.
- AUDIO-VISUAL CUES: Reference "ticking clocks", intense soundscapes, or visual paradoxes.`,
        characteristics: ['non-linear time', 'high concept', 'practical action', 'intellectual dialogue']
    },

    tarantino: {
        name: 'Quentin Tarantino',
        prompt: `Write in the style of Quentin Tarantino:
- POP CULTURE DIALOGUE: Characters speak in long, witty monologues about seemingly trivial topics (movies, music, food) before violence erupts.
- NON-LINEAR CHAPTERS: Feel free to structure with title cards or out-of-order sequences.
- SUDDEN VIOLENCE: Tension builds slowly through dialogue, then breaks with sudden, graphic intensity.
- DETAILED SPECIFICITY: Be hyper-specific about brand names, song choices on the radio, or specific character details (feet, food).
- COOL FACTOR: Characters are hyper-articulate and "cool" even in distress.`,
        characteristics: ['pop culture references', 'extended dialogue', 'nonlinear structure', 'tension']
    },

    spielberg: {
        name: 'Steven Spielberg',
        prompt: `Write in the style of Steven Spielberg:
- SENSE OF WONDER: Focus on reaction shots ("The Spielberg Face")—characters staring in awe or terror at something off-screen.
- FAMILY DYNAMICS: Ground the extraordinary events in relatable family tension or father-son relationships.
- VISUAL FLOW: Write scenes that flow fluidly, guiding the eye.
- SENTIMENTALITY: Don't shy away from emotional, heart-swelling moments.
- ORDINARY PEOPLE: Protagonists are often relatable, ordinary people thrust into extraordinary circumstances.`,
        characteristics: ['awe & wonder', 'family themes', 'fluid blocking', 'emotional resonance']
    },

    anderson: {
        name: 'Wes Anderson',
        prompt: `Write in the style of Wes Anderson:
- SYMMETRY & COMPOSITION: Describe scenes as flat, dioramas, or perfectly symmetrical shots.
- DEADPAN DIALOGUE: Characters speak directly, politely, and without much affect, even in ridiculous situations.
- QUIRKY DETAILS: hyper-detailed descriptions of props, outfits, and lists.
- PASTEL WORLD: Brief mentions of color palettes (pinks, baby blues, yellows).
- NARRATOR: Feel free to include a storybook-style narrator.`,
        characteristics: ['deadpan humor', 'symmetry', 'pastel aesthetics', 'meticulous detail']
    }
};
