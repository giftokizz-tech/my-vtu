const db = require('../config/database');

console.log('Setting up VTU Pro database...');

db.init();

// Wait a moment for database initialization
setTimeout(() => {
    console.log('Database setup complete!');
    console.log('Default admin credentials:');
    console.log('Username: admin');
    console.log('Password: admin123');
    console.log('');
    console.log('You can now start the server with: npm start');
    process.exit(0);
}, 2000);