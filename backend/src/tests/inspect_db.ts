import { connectDB } from '../config/db.js';
import mongoose from 'mongoose';
import { Scene } from '../models/scene/model.js';

async function main() {
    await connectDB();
    try {
        const scenes = await Scene.find({ bibleId: "6a0c97fcd986307b54f5f932" }).sort({ sequenceNumber: 1 }).limit(3);
        console.log(`Found ${scenes.length} scenes in project:`);
        for (const s of scenes) {
            console.log(`\n================ SCENE ${s.sequenceNumber} ===============`);
            console.log(`ID: ${s._id}`);
            console.log(`Title: ${s.title}`);
            console.log(`Slugline: ${s.slugline}`);
            console.log(`Summary: ${s.summary}`);
            console.log(`Goal: ${s.goal}`);
            console.log(`Status: ${s.status}`);
            console.log(`Content Preview:`);
            console.log(s.content ? s.content.slice(0, 300) : "EMPTY");
        }
    } catch (err) {
        console.error('Error finding scenes:', err);
    } finally {
        await mongoose.connection.close();
        process.exit(0);
    }
}

main();
