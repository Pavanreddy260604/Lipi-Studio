import { extractStructuredAssistantSections, extractBestEffortScreenplay } from '../src/utils/screenplayFormatting';

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

console.log("--- STARTING ADVANCED PARSER REGEX & KEY ROBUSTNESS TEST ---");

const sections = extractStructuredAssistantSections(mockResponse);
console.log("\nParsed Script Content (should be completely clean screenplay):");
console.log("------------------------");
console.log(sections.script.trim());
console.log("------------------------");

console.log("\nParsed Craft/Explanation:");
console.log("------------------------");
console.log(sections.craft ? sections.craft.trim() : "❌ FAILED TO PARSE");
console.log("------------------------");

const bestEffortScript = extractBestEffortScreenplay(mockResponse);
console.log("\nBest-Effort Screenplay (should have JSON and Explanation stripped):");
console.log("------------------------");
console.log(bestEffortScript.trim());
console.log("------------------------");

// Verify that the screenplay contains absolutely no trailing metadata sections
const isClean = !bestEffortScript.includes("CHARACTER_MEMORY_UPDATE") && 
                !bestEffortScript.includes("PLOT_STATE_UPDATE") && 
                !bestEffortScript.includes("AGENT_EXPLANATION");

if (isClean && sections.craft) {
    console.log("\n✅ SUCCESS: Parser successfully parsed angled bracket tags, and successfully stripped all trailing commentary and JSON blocks!");
    process.exit(0);
} else {
    console.error("\n❌ FAILURE: Parser failed to cleanly strip trailing metadata blocks.");
    process.exit(1);
}
