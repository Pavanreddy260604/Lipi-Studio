import { connectDB } from '../config/db.js';
import mongoose from 'mongoose';
import { VoiceSample } from '../models/VoiceSample.js';

async function main() {
    await connectDB();
    try {
        const scriptVersion = "v_mpeb3f4p_ncvtzo";
        
        // Find leaf chunks with no parentNodeId
        const badChunks = await VoiceSample.find({
            scriptVersion,
            isHierarchicalNode: false,
            parentNodeId: { $exists: false }
        }).limit(10).lean();

        console.log(`================ FOUND ${badChunks.length} CHUNKS WITH MISSING PARENT ================`);
        for (const chunk of badChunks) {
            console.log(`\nID: ${chunk._id}`);
            console.log(`ChunkId: ${chunk.chunkId}`);
            console.log(`ElementType: ${chunk.elementType}`);
            console.log(`ChunkType: ${chunk.chunkType}`);
            console.log(`SceneSeq: ${chunk.sceneSeq}, ElementSeq: ${chunk.elementSeq}`);
            console.log(`Content: "${chunk.content}"`);
        }

        // Count how many bad chunks there are in total for this version
        const count = await VoiceSample.countDocuments({
            scriptVersion,
            isHierarchicalNode: false,
            parentNodeId: { $exists: false }
        });
        console.log(`\nTotal bad chunks: ${count}`);

    } catch (err) {
        console.error('Error:', err);
    } finally {
        await mongoose.connection.close();
        process.exit(0);
    }
}

main();
