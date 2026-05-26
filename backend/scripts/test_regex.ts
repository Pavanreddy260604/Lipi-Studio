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

function extractSectionLocal(text: string, label: string) {
    const normalized = text.replace(/\r\n?/g, '\n');
    
    // We added <? before and >?\*?\*? after the labels in the lookahead list!
    const headingPattern = new RegExp(
        `(?:^|\\n)\\s{0,3}#{0,6}\\s*(?:\\*\\*\\s*)?(?:STEP\\s*\\d+\\s*:\\s*)?(?:\\*\\*\\s*)?<?${label}>?(?:\\s*\\(JSON\\))?\\s*\\*?\\*?\\s*:?\\s*(?:\\*\\*\\s*)?\\n([\\s\\S]*?)(?=\\n\\s{0,3}#{0,6}\\s*(?:\\*\\*\\s*)?(?:STEP\\s*\\d+|<?(?:${STRUCTURED_SECTION_LABELS.join('|')})>?\\*?\\*?)|\\n\\s*---|\\n\\s*<|$)`,
        'i'
    );
    const headingMatch = headingPattern.exec(normalized);
    if (headingMatch) {
        console.log(`\n--- Match details for ${label} ---`);
        console.log("Full Match:", JSON.stringify(headingMatch[0]));
        console.log("Group 1 (Content):", JSON.stringify(headingMatch[1]));
    } else {
        console.log(`\n❌ Failed to match heading for ${label}`);
    }
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

extractSectionLocal(mockResponse, 'CHARACTER_MEMORY_UPDATE');
extractSectionLocal(mockResponse, 'PLOT_STATE_UPDATE');
extractSectionLocal(mockResponse, 'AGENT_EXPLANATION');
