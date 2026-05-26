import mongoose from 'mongoose';

async function run() {
    // Test 1: IPv4
    try {
        console.log('--- Connecting to IPv4 127.0.0.1 ---');
        const conn1 = await mongoose.createConnection('mongodb://127.0.0.1:27017/script-editor-standalone').asPromise();
        const users1 = await conn1.db.collection('users').find().toArray();
        console.log('IPv4 Users:', users1.map(u => `${u.email} (${u._id})`));
        await conn1.close();
    } catch (err: any) {
        console.error('IPv4 Connection failed:', err.message);
    }

    // Test 2: IPv6 / localhost
    try {
        console.log('\n--- Connecting to IPv6 [::1] ---');
        const conn2 = await mongoose.createConnection('mongodb://[::1]:27017/script-editor-standalone').asPromise();
        const users2 = await conn2.db.collection('users').find().toArray();
        console.log('IPv6 Users:', users2.map(u => `${u.email} (${u._id})`));
        await conn2.close();
    } catch (err: any) {
        console.error('IPv6 Connection failed:', err.message);
    }

    // Test 3: localhost
    try {
        console.log('\n--- Connecting to localhost ---');
        const conn3 = await mongoose.createConnection('mongodb://localhost:27017/script-editor-standalone').asPromise();
        const users3 = await conn3.db.collection('users').find().toArray();
        console.log('localhost Users:', users3.map(u => `${u.email} (${u._id})`));
        await conn3.close();
    } catch (err: any) {
        console.error('localhost Connection failed:', err.message);
    }
}

run().catch(err => console.error(err));
