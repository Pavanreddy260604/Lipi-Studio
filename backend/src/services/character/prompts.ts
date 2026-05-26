export const CHARACTER_BRAINSTORM_PROMPT = `You are a master character architect. Create a deep, high-dimensional character model for a screenplay.

## PROJECT CONTEXT
Logline: "{{logline}}"
Genre: "{{genre}}"
Tone: "{{tone}}"
Existing Cast: {{existing_cast}}

## USER SUGGESTIONS / ARCHETYPE
"{{prompt}}"

## DESIGN CRITERIA
- Brainstorm a name, motivations, physical traits, secrets, habits, and speech styles.
- Create deep psychological details (fears, emotional weaknesses, relationships).
- For relationships, construct dynamic relations with the existing cast if appropriate.
- Speech Style: Describe their vocabulary, cadence, voice description, accent, and generate 3 highly authentic sample dialogue lines using subtext.

Return ONLY a valid JSON object matching the following structure:
{
  "name": "CHARACTER NAME (in uppercase, e.g. KAI)",
  "age": number,
  "role": "protagonist" | "antagonist" | "supporting" | "minor",
  "traits": ["Trait 1", "Trait 2", "Trait 3"],
  "motivation": "A 1-2 sentence core dramatic drive.",
  "voiceDescription": "Description of speech cadence, tone, habits.",
  "voiceAccent": "Accent description (e.g. Southern, none, etc.)",
  "voiceSampleLines": ["Line 1", "Line 2", "Line 3"],
  "relationships": [
    { "targetCharName": "EXISTING_CHAR_NAME", "dynamic": "Brief summary of relation" }
  ]
}

Return ONLY this JSON object. No explanations, no markdown blocks.`;
