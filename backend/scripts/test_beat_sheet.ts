import { aiServiceManager } from '../src/services/ai.manager.js';
import { storyPlannerService } from '../src/services/storyPlanner.service.js';
import mongoose from 'mongoose';
import * as dotenv from 'dotenv';
import { Bible } from '../src/models/Bible.js';
import { Scene } from '../src/models/Scene.js';

dotenv.config();

async function testBeatSheet() {
    console.log("Connecting to MongoDB...");
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/script-writer');
    
    // Force NVIDIA
    aiServiceManager.setProvider('nvidia');
    console.log("AI Provider set to:", aiServiceManager.getProvider());

    // Get any valid bible
    const bible = await Bible.findOne();
    if (!bible) {
        console.log("No bible found. Exiting.");
        process.exit(0);
    }

    console.log(`Using Bible: ${bible.title} (${bible._id})`);

    const generator = storyPlannerService.generateFullBeatSheet({
        bibleId: bible._id.toString(),
        targetSceneCount: 15,
        structureType: 'three_act',
        customInstructions: 'Make it epic.'
    });

    try {
        let fullOutput = '';
        for await (const chunk of generator) {
            process.stdout.write(chunk);
            fullOutput += chunk;
        }
        console.log("\n\nSUCCESS! Beat sheet generated.");
    } catch (err: any) {
        console.error("\n\nFATAL ERROR DURING GENERATION:", err);
    }

    process.exit(0);
}

testBeatSheet();
