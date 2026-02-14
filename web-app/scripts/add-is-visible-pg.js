
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

async function addIsVisibleColumn() {
    try {
        await client.connect();
        console.log('✅ Connected to Supabase Database');

        console.log('\n📝 Adding is_visible column...');
        await client.query(`
            ALTER TABLE news_items 
            ADD COLUMN IF NOT EXISTS is_visible BOOLEAN DEFAULT TRUE;
        `);
        console.log('✅ is_visible column added successfully');

    } catch (err) {
        console.error('\n❌ Error:', err.message);
        process.exit(1);
    } finally {
        await client.end();
        console.log('\n✅ Database connection closed');
    }
}

addIsVisibleColumn();
