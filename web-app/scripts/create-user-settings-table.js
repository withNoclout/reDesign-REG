
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

async function createUserSettingsTable() {
    try {
        await client.connect();
        console.log('✅ Connected to Supabase Database');

        console.log('\n📝 Creating user_settings table...');

        // Create table if not exists
        // We use TEXT for user_id to match the potential string/uuid format from auth, 
        // ideally it should reference check against auth.users but for simplicity in this script we might skip strict FK if auth schema is tricky to access,
        // but let's try to be correct. If auth.users is in a different schema (auth), we can reference it.
        // However, usually referencing auth.users requires permissions. Let's just use TEXT/UUID for now and index it.
        // We will make user_id the Primary Key to ensure one setting per user.

        await client.query(`
            CREATE TABLE IF NOT EXISTS user_settings (
                user_id UUID PRIMARY KEY,
                portfolio_config JSONB DEFAULT '{"columnCount": 3, "gapSize": "normal"}',
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
        `);

        console.log('✅ user_settings table created/verified successfully');

    } catch (err) {
        console.error('\n❌ Error:', err.message);
        process.exit(1);
    } finally {
        await client.end();
        console.log('\n✅ Database connection closed');
    }
}

createUserSettingsTable();
