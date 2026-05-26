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

console.log("Mock Response Stringified:");
console.log(JSON.stringify(mockResponse));
