import mongoose from 'mongoose';
import { characterService } from '../src/services/character/index.js';
import { connectDB } from '../src/config/db.js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(process.cwd(), '.env') });

async function run() {
    console.log("Connecting to Database...");
    await connectDB();

    const bibleId = '6a0b455e99aff652ce19293f';
    const prompt = 'A cynical, chain-smoking hacker who lives in neon alleys.';
    const name = 'Zara';

    console.log(`Running generateCharacterProfile for Bible: ${bibleId}...`);
    try {
        const result = await characterService.generateCharacterProfile(bibleId, prompt, name);
        console.log("Success! Generated Character Profile:");
        console.log(JSON.stringify(result, null, 2));
    } catch (err) {
        console.error("Failed to generate character profile:", err);
    } finally {
        await mongoose.connection.close();
        console.log("Database connection closed.");
    }
}
run();
