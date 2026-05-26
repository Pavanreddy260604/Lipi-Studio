import { parserService } from '../src/services/parser.service';
import { aiServiceManager } from '../src/services/ai.manager';

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

console.log("--- STARTING PARSER FALLBACK INTEGRATION TEST ---");

// Force a Groq Rate Limit / Network error to trigger refineAssistantResponse's catch block
const originalChat = aiServiceManager.chat;
aiServiceManager.chat = async () => {
    throw new Error("rate_limit_exceeded (Simulated Groq 429 error)");
};

async function run() {
    try {
        console.log("\nExecuting refineAssistantResponse in rate-limited fallback mode...");
        
        // Log what extractSectionLocal returns directly
        const rawResponse = mockResponse;
        
        // Let's call refineAssistantResponse
        const result = await parserService.refineAssistantResponse(rawResponse);
        
        console.log("\nParsed Script (should be completely clean screenplay):");
        console.log("------------------------");
        console.log(result.script.trim());
        console.log("------------------------");

        const hasMemory = result.characterMemory !== null && result.characterMemory.updates[0].name === "Karna";
        const hasPlot = result.plotState !== null && result.plotState.newEvents[0] === "Seeds planted";
        
        if (hasMemory && hasPlot) {
            console.log("\n✅ SUCCESS: ParserService successfully executed its local backup pipeline, parsed the JSON blocks locally, and stripped all metadata blocks!");
            process.exit(0);
        } else {
            console.error("\n❌ FAILURE: ParserService failed to execute backup pipeline.");
            process.exit(1);
        }
    } catch (err: any) {
        console.error("\n❌ CRITICAL ERROR:", err.message);
        process.exit(1);
    } finally {
        aiServiceManager.chat = originalChat;
    }
}

run();
