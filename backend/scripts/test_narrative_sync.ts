import mongoose from 'mongoose';
import { connectDB } from '../src/config/db';
import { Character } from '../src/models/Character';
import { LoreEntity } from '../src/models/LoreEntity';
import { LoreRelation } from '../src/models/LoreRelation';
import { characterService } from '../src/services/character.service';
import { stateManagerService } from '../src/services/stateManager.service';

async function runNarrativeSyncTest() {
    console.log('--- STARTING NARRATIVE GRAPH SYNCHRONIZATION TEST ---');

    // 1. Establish DB Connection
    await connectDB();

    const dummyBibleId = new mongoose.Types.ObjectId();
    console.log(`Created mock Bible ID: ${dummyBibleId}`);

    let karnaId: string = '';

    try {
        // ==========================================
        // STEP 1: TEST MANUAL CRUD CREATION
        // ==========================================
        console.log('\n--- STEP 1: TESTING MANUAL CHARACTER CREATION ---');
        const karnaChar = await characterService.createCharacter({
            bibleId: dummyBibleId as any,
            name: 'Karna',
            role: 'protagonist',
            motivation: 'Wants Surya\'s recognition',
            currentStatus: 'Stable',
            traits: ['Intense', 'Proud']
        });
        karnaId = karnaChar._id.toString();
        console.log(`Manual Character created: ${karnaChar.name} (${karnaId})`);

        // Assert LoreEntity node created
        const karnaNode = await LoreEntity.findOne({ bibleId: dummyBibleId, name: 'KARNA' });
        if (!karnaNode) {
            throw new Error('Assertion Failed: LoreEntity node not automatically created for manual character!');
        }
        console.log('✔ SUCCESS: LoreEntity node automatically mirrored in graph!');
        if (karnaNode.properties.role !== 'protagonist' || karnaNode.description !== 'Wants Surya\'s recognition') {
            throw new Error('Assertion Failed: LoreEntity properties do not match manual Character inputs!');
        }
        console.log('✔ SUCCESS: LoreEntity node description and role properties match perfectly!');


        // ==========================================
        // STEP 2: TEST RELATIONSHIP SEEDING & SYNC
        // ==========================================
        console.log('\n--- STEP 2: TESTING RELATIONSHIP ADDITION & GRAPH AUTO-SEEDING ---');
        const updatedKarnaChar = await characterService.updateCharacter(karnaId, {
            relationships: [
                { targetCharName: 'Surya', dynamic: 'Intensely loyal and seeks divine protection' }
            ]
        });

        if (!updatedKarnaChar) throw new Error('Failed to update character relationships');

        // Assert that the target LoreEntity node "SURYA" was automatically created!
        const suryaNode = await LoreEntity.findOne({ bibleId: dummyBibleId, name: 'SURYA' });
        if (!suryaNode) {
            throw new Error('Assertion Failed: Target relationship node "SURYA" was not automatically seeded!');
        }
        console.log('✔ SUCCESS: Target character "SURYA" auto-seeded as a graph node!');

        // Assert that the LoreRelation edge was correctly created and typed
        const relationEdge = await LoreRelation.findOne({
            bibleId: dummyBibleId,
            sourceEntityId: karnaNode._id,
            targetEntityId: suryaNode._id
        });
        if (!relationEdge) {
            throw new Error('Assertion Failed: LoreRelation edge not created between KARNA and SURYA!');
        }
        console.log('✔ SUCCESS: LoreRelation edge established in database!');
        if (relationEdge.relationshipType !== 'allied_with') {
            throw new Error(`Assertion Failed: Expected relation to be mapped as "allied_with", got: ${relationEdge.relationshipType}`);
        }
        console.log('✔ SUCCESS: Dynamic string mapped accurately to typed relationship enum ("allied_with")!');


        // ==========================================
        // STEP 3: TEST AUTOPILOT STATE & ARC SYNC
        // ==========================================
        console.log('\n--- STEP 3: TESTING AUTOPILOT STATE & ARC SYNCHRONIZATION ---');
        // Simulate an autopilot story-generation memory state update
        const mockParsedUpdates = [
            { name: 'Karna', newStatus: 'Panicked', itemsGained: ['golden armor'] }
        ];

        const charList = [updatedKarnaChar];
        await stateManagerService.saveStateObject(mockParsedUpdates, charList);

        // Fetch refreshed Character
        const refreshedChar = await Character.findById(karnaId);
        if (!refreshedChar || refreshedChar.currentStatus !== 'Panicked' || !refreshedChar.heldItems || !refreshedChar.heldItems.includes('golden armor')) {
            throw new Error('Assertion Failed: Autopilot state update did not apply to standard Character!');
        }
        console.log('✔ SUCCESS: Autopilot state update applied successfully to standard Character!');

        // Fetch refreshed LoreEntity
        const refreshedKarnaNode = await LoreEntity.findOne({ bibleId: dummyBibleId, name: 'KARNA' });
        if (!refreshedKarnaNode || refreshedKarnaNode.properties.currentStatus !== 'Panicked' || !refreshedKarnaNode.properties.inventory || !refreshedKarnaNode.properties.inventory.includes('golden armor')) {
            throw new Error('Assertion Failed: Graph LoreEntity properties did not mirror autopilot status/inventory!');
        }
        console.log('✔ SUCCESS: Autopilot state and inventory changes synchronized perfectly with LoreEntity properties!');


        // ==========================================
        // STEP 4: TEST CRUD CASCADE DELETION
        // ==========================================
        console.log('\n--- STEP 4: TESTING CRUD CASCADE DELETION ---');
        const deleteSuccess = await characterService.deleteCharacter(karnaId);
        if (!deleteSuccess) throw new Error('Character deletion failed');

        // Assert Karna Character deleted
        const deletedChar = await Character.findById(karnaId);
        if (deletedChar) throw new Error('Assertion Failed: Standard Character document still exists!');
        console.log('✔ SUCCESS: Standard Character document removed!');

        // Assert Karna LoreEntity deleted
        const deletedKarnaNode = await LoreEntity.findOne({ bibleId: dummyBibleId, name: 'KARNA' });
        if (deletedKarnaNode) throw new Error('Assertion Failed: Graph LoreEntity node still exists!');
        console.log('✔ SUCCESS: Graph LoreEntity node deleted!');

        // Assert relationship edge deleted
        const deletedEdge = await LoreRelation.findOne({
            bibleId: dummyBibleId,
            sourceEntityId: karnaNode._id,
            targetEntityId: suryaNode._id
        });
        if (deletedEdge) throw new Error('Assertion Failed: Relational edge between deleted entities still exists!');
        console.log('✔ SUCCESS: Connected directed edges successfully cascaded and purged!');

        // Assert target entity SURYA is still intact
        const existingSuryaNode = await LoreEntity.findOne({ bibleId: dummyBibleId, name: 'SURYA' });
        if (!existingSuryaNode) throw new Error('Assertion Failed: Target character SURYA was collateral deleted!');
        console.log('✔ SUCCESS: Target character "SURYA" remains intact on the graph!');

    } finally {
        // ==========================================
        // TEAR DOWN & CLEANUP
        // ==========================================
        console.log('\n--- TEARING DOWN NARRATIVE SYNCHRONIZATION TEST RECORDS ---');
        await Character.deleteMany({ bibleId: dummyBibleId });
        await LoreEntity.deleteMany({ bibleId: dummyBibleId });
        await LoreRelation.deleteMany({ bibleId: dummyBibleId });
        console.log('Cleaned up all seeded test documents.');
        
        await mongoose.connection.close();
        console.log('Database connection closed.');
    }

    console.log('\n--- ALL NARRATIVE GRAPH SYNCHRONIZATION TESTS PASSED SUCCESSFULLY! ---');
}

runNarrativeSyncTest().catch(err => {
    console.error('Test Failed with Error:', err);
    process.exit(1);
});
