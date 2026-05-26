import mongoose from 'mongoose';
import { connectDB } from '../src/config/db';
import { LoreEntity } from '../src/models/LoreEntity';
import { LoreRelation } from '../src/models/LoreRelation';
import { scriptGenerator } from '../src/services/scriptGenerator.service';

async function runLoreGraphTest() {
    console.log('--- STARTING LORE GRAPH PERFORMANCE TEST ---');

    // 1. Establish DB Connection
    await connectDB();

    const dummyBibleId = new mongoose.Types.ObjectId();
    console.log(`Created mock Bible ID: ${dummyBibleId}`);

    try {
        // 2. Seed Mock Lore Entities
        console.log('\n--- SEEDING LORE ENTITIES ---');
        const entityKarna = await LoreEntity.create({
            bibleId: dummyBibleId,
            name: 'KARNA',
            type: 'character',
            description: 'Divinely born hero hidden as a charioteer\'s son.',
            properties: { role: 'protagonist' }
        });
        console.log(`Created LoreEntity: ${entityKarna.name} (${entityKarna._id})`);

        const entitySurya = await LoreEntity.create({
            bibleId: dummyBibleId,
            name: 'SURYA',
            type: 'character',
            description: 'The sun god, Karna\'s divine father.',
            properties: { role: 'deity' }
        });
        console.log(`Created LoreEntity: ${entitySurya.name} (${entitySurya._id})`);

        // 3. Seed Relation Edge
        console.log('\n--- SEEDING RELATIONSHIP EDGE ---');
        const relation = await LoreRelation.create({
            bibleId: dummyBibleId,
            sourceEntityId: entityKarna._id,
            targetEntityId: entitySurya._id,
            relationshipType: 'allied_with',
            description: 'Karna seeks validation but Surya remains silent.',
            sceneActiveRange: { startSequence: 1, endSequence: 20 }
        });
        console.log(`Created LoreRelation Edge: ${relation.relationshipType} (${relation._id})`);

        // 4. Measure Query Latency & Assertions
        console.log('\n--- RUNNING GRAPH LORE LOOKUP (METHOD B EXECUTOR) ---');
        const startTime = performance.now();
        
        // Invoke the relation query helper
        const result = await (scriptGenerator as any).executeQueryLoreAndRelationships(
            dummyBibleId.toString(),
            'KARNA',
            'any'
        );
        
        const endTime = performance.now();
        const latencyMs = endTime - startTime;
        
        console.log('\n--- QUERY RESULT ---');
        console.log(result);
        console.log(`\nQuery execution latency: ${latencyMs.toFixed(2)} ms`);

        console.log('\n--- VERIFYING ASSERIONS ---');
        // Assertion 1: Must return relationship data
        if (!result.includes('KARNA') || !result.includes('SURYA') || !result.includes('ALLIED WITH')) {
            throw new Error('Assertion Failed: Query output does not contain expected entity or relationship names!');
        }
        console.log('✔ SUCCESS: Relational details retrieved successfully!');

        // Assertion 2: Lookup speed must be sub-10ms for peak real-time performance
        if (latencyMs > 10) {
            console.warn(`⚠️ WARNING: Query took ${latencyMs.toFixed(2)}ms (Goal is <10ms)`);
        } else {
            console.log('✔ SUCCESS: Lookup speed is sub-10ms!');
        }

    } finally {
        // 5. Tear Down and Cleanup
        console.log('\n--- TEARING DOWN TEST RECORDS ---');
        const deleteEntitiesResult = await LoreEntity.deleteMany({ bibleId: dummyBibleId });
        const deleteRelationsResult = await LoreRelation.deleteMany({ bibleId: dummyBibleId });
        console.log(`Deleted ${deleteEntitiesResult.deletedCount} LoreEntities and ${deleteRelationsResult.deletedCount} LoreRelations.`);
        
        // Close DB connection gracefully
        await mongoose.connection.close();
        console.log('Database connection closed.');
    }

    console.log('\n--- ALL GRAPH LORE TESTS COMPLETED SUCCESSFULLY! ---');
}

runLoreGraphTest().catch(err => {
    console.error('Test Failed with Error:', err);
    process.exit(1);
});
