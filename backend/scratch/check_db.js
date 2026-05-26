import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: '../.env' });

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/script-editor-standalone';

const SceneSchema = new mongoose.Schema({
    title: String,
    slugline: String,
    content: String,
    status: String,
    bibleId: mongoose.Schema.Types.ObjectId,
    sequenceNumber: Number
}, { collection: 'scenes' });

const Scene = mongoose.model('Scene', SceneSchema);

async function check() {
    console.log('Connecting to:', MONGODB_URI);
    await mongoose.connect(MONGODB_URI);
    console.log('Connected!');

    const scenes = await Scene.find({}).lean();
    console.log(`Found ${scenes.length} scenes in database.`);
    
    for (const scene of scenes) {
        console.log(`- Scene [${scene.sequenceNumber}] "${scene.slugline}":`);
        console.log(`  Title: ${scene.title}`);
        console.log(`  Status: ${scene.status}`);
        console.log(`  Content Length: ${scene.content ? scene.content.length : 0} characters`);
        if (scene.content) {
            console.log(`  Content Preview: "${scene.content.slice(0, 100).replace(/\n/g, ' ')}..."`);
        }
    }

    await mongoose.disconnect();
}

check().catch(err => {
    console.error('Error:', err);
    process.exit(1);
});
