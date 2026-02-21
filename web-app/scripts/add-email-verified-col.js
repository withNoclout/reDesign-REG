require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
    console.error('❌ DATABASE_URL is missing in .env.local');
    process.exit(1);
}

const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false }
});

async function addEmailVerifiedCol() {
    try {
        await client.connect();
        console.log('✅ Connected to Supabase Database');

        console.log('\n📝 Adding email_verified_at column to user_settings table...');

        await client.query(`
            ALTER TABLE user_settings 
            ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;
        `);

        console.log('✅ email_verified_at column added successfully (or already exists)');

    } catch (err) {
        console.error('\n❌ Error:', err.message);
        process.exit(1);
    } finally {
        await client.end();
        console.log('\n✅ Database connection closed');
    }
}

addEmailVerifiedCol();
