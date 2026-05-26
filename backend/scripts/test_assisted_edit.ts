import mongoose from 'mongoose';
import dotenv from 'dotenv';
import axios from 'axios';
import { generateToken } from '../src/utils/jwt.js';
import { applySurgicalPatch } from '../../frontend/src/utils/assistantParser.ts';

dotenv.config();

async function runTest() {
    console.log('Connecting to database...');
    const dbUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/script-editor-standalone';
    console.log(`Targeting MONGODB_URI: ${dbUri}`);
    await mongoose.connect(dbUri);
    console.log('Database connected.');

    // List all databases on the mongo instance to find where our users are stored
    const adminDb = mongoose.connection.db.admin();
    const dbsList = await adminDb.listDatabases();
    console.log('\n=== SCANNING ALL MONGODB DATABASES ===');
    
    let allUsers: any[] = [];
    for (const dbInfo of dbsList.databases) {
        const dbName = dbInfo.name;
        if (dbName === 'admin' || dbName === 'local' || dbName === 'config') continue;
        
        const tempConn = mongoose.connection.useDb(dbName);
        const users = await tempConn.collection('users').find().toArray();
        console.log(`Database [${dbName}] has users:`, users.map(u => `${u.email} (${u._id})`));
        
        // We aggregate the users from all databases
        for (const u of users) {
            allUsers.push({ ...u, sourceDb: dbName });
        }
    }
    console.log('======================================\n');

    // Iterate over users to find one that is active and successfully authenticated by the running server
    for (const user of allUsers) {
        console.log(`\n--------------------------------------`);
        console.log(`Testing with user: ${user.email} (${user._id})`);

        // Generate auth token
        const token = generateToken({
            userId: user._id.toString(),
            email: user.email
        });

        const tempConn = mongoose.connection.useDb(user.sourceDb);

        // Find a bible owned by this user (supporting both string and ObjectId types)
        const bibles = await tempConn.collection('bibles').find({
            $or: [
                { userId: user._id },
                { userId: user._id.toString() }
            ]
        }).toArray();
        if (bibles.length === 0) {
            console.log(`User has no bibles in [${user.sourceDb}], skipping.`);
            continue;
        }

        const bibleIds = bibles.map(b => b._id);
        const scene = await tempConn.collection('scenes').findOne({ bibleId: { $in: bibleIds } });
        if (!scene) {
            console.log(`User has no scenes in [${user.sourceDb}], skipping.`);
            continue;
        }

        console.log(`Using test scene: ${scene.slugline} (${scene._id}) for bible: ${scene.bibleId}`);
        const url = `http://localhost:5003/api/script/scene/${scene._id}/assisted-edit`;
        console.log(`Sending POST request to ${url}...`);

        const originalContent = `INT. ABANDONED TRAIN YARD – NIGHT

The wind rattles rusted tracks. A lone lantern hangs, casting a weak, amber halo over cracked concrete.

KARNA, late twenties, wears a patched leather jacket and carries a battered satchel. His face is set, eyes scanning the shadows.

He stops, listening to the distant echo of a train horn. The sound stutters, then fades.`;

        const instruction = "Introduce a brief, tense encounter with MIRA at the MAHBARTAM OAKAY sign. Use <<<SEARCH>>> and <<<REPLACE>>> format.";

        try {
            const response = await axios.post(url, {
                instruction,
                currentContent: originalContent,
                mode: 'edit',
                target: 'scene'
            }, {
                headers: {
                    'Authorization': `Bearer ${token}`
                },
                responseType: 'stream'
            });

            console.log('Stream started! Receiving chunks:\n');
            let fullResponseText = '';

            // We return a Promise so we block the loop until the stream completes successfully
            await new Promise<void>((resolve, reject) => {
                response.data.on('data', (chunk: Buffer) => {
                    const text = chunk.toString('utf8');
                    process.stdout.write(text);
                    fullResponseText += text;
                });

                response.data.on('end', () => {
                    console.log('\n\nStream completed.');
                    console.log('\n======================================');
                    console.log('ORIGINAL CONTENT:');
                    console.log(originalContent);
                    console.log('======================================');
                    console.log('STREAMED RESPONSE:');
                    console.log(fullResponseText);
                    console.log('======================================');

                    // Apply our newly hardened frontend surgical patch algorithm
                    console.log('Applying frontend surgical patch...');
                    try {
                        const patched = applySurgicalPatch(originalContent, fullResponseText);
                        console.log('======================================');
                        console.log('PATCHED CONTENT RESULT:');
                        console.log(patched);
                        console.log('======================================');
                        console.log('SUCCESS! Endpoint streamed and frontend parser successfully applied the patch.');
                    } catch (err: any) {
                        console.error('Failed to apply surgical patch:', err.message);
                    }
                    resolve();
                });

                response.data.on('error', (err: any) => {
                    reject(err);
                });
            });

            // If we get here, the stream finished successfully! Disconnect and exit.
            mongoose.disconnect();
            process.exit(0);

        } catch (error: any) {
            console.error('Request failed for this user:', error.message);
            if (error.response && error.response.data) {
                console.error('Response Status:', error.response.status);
                await new Promise<void>((resolve) => {
                    let errorData = '';
                    error.response.data.on('data', (chunk: any) => {
                        errorData += chunk.toString('utf8');
                    });
                    error.response.data.on('end', () => {
                        console.error('Response Data:', errorData);
                        resolve();
                    });
                });
            }
        }
    }

    console.error('\n❌ All users tested but none successfully authenticated/streamed.');
    mongoose.disconnect();
    process.exit(1);
}

runTest();
