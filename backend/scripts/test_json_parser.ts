import { JSONHelper } from '../src/services/parser.service.js';

const mockResponse = `Here is the JSON output:
[
  {
    "title": "Act 1 Climax 2",
    "slugline": "INT. ROOM - DAY",
    "goal": "...",
    "description": "..."
  },
  {
    "title": "Act 1 Climax 3",
    "slugline": "INT. ROOM - NIGHT",
    "goal": "...",
    "description": "..."
  }
]`;

console.log("Mock Response:");
console.log(mockResponse);

const extracted = JSONHelper.extractJson(mockResponse);
console.log("\nExtracted:");
console.log(extracted);

try {
    const repaired = JSONHelper.dirtyRepair(extracted);
    console.log("\nParsed successfully:");
    console.log(JSON.stringify(repaired, null, 2));
} catch (e: any) {
    console.error("\nParse failed:", e.message);
    const repairedStr = (JSONHelper as any).repairJson(extracted);
    console.log("\nRepaired String was:");
    console.log(repairedStr);
}
