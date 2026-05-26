const STRUCTURED_SECTION_LABELS = [
    'STORY_CONTEXT_SUMMARY',
    'SCENE_PLAN',
    'SCENE_SCRIPT',
    'CHARACTER_MEMORY_UPDATE',
    'PLOT_STATE_UPDATE',
    'NARRATIVE_CRAFT',
    'RESEARCH_DISCLOSURE',
    'CREATIVE_PLAN',
    'AGENT_EXPLANATION'
];

function extractSectionLocal(text: string, label: string): string {
    const normalized = text.replace(/\r\n?/g, '\n');
    
    // 1. XML style matching
    const tagPattern = new RegExp(`<${label}>([\\s\\S]*?)(?:</${label}>|$)`, 'i');
    const tagMatch = tagPattern.exec(normalized);
    if (tagMatch && tagMatch[1].trim()) {
        return tagMatch[1].trim();
    }

    // 2. Heading-based matching
    const headingPattern = new RegExp(
        `(?:^|\\n)\\s{0,3}#{0,6}\\s*(?:\\*\\*\\s*)?(?:STEP\\s*\\d+\\s*:\\s*)?(?:\\*\\*\\s*)?<?${label}>?(?:\\s*\\(JSON\\))?\\s*\\*?\\*?\\s*:?\\s*(?:\\*\\*\\s*)?\\n([\\s\\S]*?)(?=\\n\\s{0,3}#{0,6}\\s*(?:\\*\\*\\s*)?(?:STEP\\s*\\d+|${STRUCTURED_SECTION_LABELS.join('|')})|\\n\\s*---|\\n\\s*<|$)`,
        'i'
    );
    const headingMatch = headingPattern.exec(normalized);
    if (headingMatch && headingMatch[1].trim()) {
        return headingMatch[1].trim();
    }

    return '';
}

const mockResponse = `
INT. ADIRATHA’S HUMBLE HUT – NIGHT

A single oil lamp gutters on a clay shelf...

KARNA
You see me.

---

### **STEP 4: <AGENT_EXPLANATION>**
This is a Director's Craft explanation.

---

### **STEP 5: <CHARACTER_MEMORY_UPDATE>**
{
  "updates": [
    {
      "name": "Karna",
      "newStatus": "Deep conflict",
      "itemsGained": [],
      "itemsLost": [],
      "relationshipChanges": [
        {
          "with": "Surya",
          "change": "Silent, judging presence"
        }
      ]
    }
  ]
}

---

### **PLOT_STATE_UPDATE**
{
  "newEvents": ["Seeds planted"]
}
`;

console.log("Memory update extracted:");
console.log(extractSectionLocal(mockResponse, 'CHARACTER_MEMORY_UPDATE'));

console.log("\nPlot state extracted:");
console.log(extractSectionLocal(mockResponse, 'PLOT_STATE_UPDATE'));

console.log("\nExplanation extracted:");
console.log(extractSectionLocal(mockResponse, 'AGENT_EXPLANATION'));
