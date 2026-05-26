import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { User } from '../src/models/User.js';

dotenv.config();

async function runTest() {
    const dbUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/script-editor-standalone';
    console.log(`Connecting to MONGODB_URI: ${dbUri}`);
    await mongoose.connect(dbUri);
    console.log('Database connected.');

    // 1. Query using native driver
    const nativeUsers = await mongoose.connection.db.collection('users').find().toArray();
    console.log('Native users list:', nativeUsers.map(u => `${u.email} (${u._id})`));

    if (nativeUsers.length === 0) {
        console.log('No native users found.');
        await mongoose.disconnect();
        return;
    }

    const testId = nativeUsers[0]._id.toString();
    console.log(`\nQuerying ID using Mongoose User.findById("${testId}")...`);
    
    // 2. Query using Mongoose model
    const mongooseUser = await User.findById(testId);
    console.log('Mongoose User findById result:', mongooseUser ? `${mongooseUser.email} (${mongooseUser._id})` : 'NULL');

    console.log('\nQuerying all users using Mongoose User.find()...');
    const allMongooseUsers = await User.find();
    console.log('Mongoose User.find() results:', allMongooseUsers.map(u => `${u.email} (${u._id})`));

    await mongoose.disconnect();
}

runTest().catch(err => {
    console.error('Test error:', err);
    mongoose.disconnect();
});
