import { aiServiceManager } from '../src/services/ai.manager';

async function run() {
    console.log("Checking active provider in Service Manager...");
    const provider = aiServiceManager.getProvider();
    console.log("Active Provider:", provider);

    if (provider !== 'gemini') {
        console.error("Error: Active provider is not gemini!");
        return;
    }

    console.log("Testing chat completion via Service Manager...");
    try {
        const response = await aiServiceManager.chat(
            "Write a very short 1-sentence tagline for a sci-fi thriller screenplay."
        );
        console.log("Success! Tagline from Gemini via Manager:");
        console.log(response);
    } catch (err: any) {
        console.error("Test failed:", err.message);
    }
}

run();
