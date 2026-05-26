import { connectDB } from './config/db.js';
import { User } from './models/User.js';

async function run() {
    try {
        console.log('Connecting to database...');
        await connectDB();
        
        const email = 'pavanreddynalla1959@gmail.com';
        console.log(`Checking user: ${email}...`);
        
        const user = await User.findOne({ email });
        if (!user) {
            console.log(`User ${email} does not exist in the database yet. They will be auto-verified upon registration.`);
        } else {
            console.log('User found! Current status:', { emailVerified: user.emailVerified, role: user.role });
            user.emailVerified = true;
            user.role = 'admin';
            await user.save();
            console.log('User successfully verified and elevated to admin role!');
        }
        
        process.exit(0);
    } catch (err) {
        console.error('Failed to run update script:', err);
        process.exit(1);
    }
}

run();
