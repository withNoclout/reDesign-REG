const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const dbUrl = process.env.DATABASE_URL;

if (!supabaseUrl || !serviceRoleKey) {
    console.error('Missing Supabase credentials');
    console.error('Values:', { supabaseUrl, serviceRoleKey: !!serviceRoleKey });
    // Don't exit yet, maybe DB URL works
}

// Fallback: If service role key is missing but we have DB URL, we can still proceed with PG
if (!dbUrl) {
    console.error('Missing DATABASE_URL');
    process.exit(1);
}

async function addTopicColumn() {
    console.log('Checking for "topic" column in "news_items"...');

    // We can't easily check schema via JS client without admin API, 
    // but we can try to select it. If it fails, we know it might not exist.
    // However, the easiest way with Supabase/Postgres is just to execute raw SQL 
    // if we had a function for it, but we don't.
    // So we will use the RPC approach if available, or just report that 
    // the user needs to run SQL if we can't do it via JS.

    // BUT! We can't run DDL (ALTER TABLE) via supabase-js client unless we have a specific RPC function.
    // Wait, the user has been running these scripts successfully? 
    // Ah, previous scripts were DML (INSERT/UPDATE). DDL requires SQL Editor or RPC.

    // Workaround: We will log the SQL command for the user to run, 
    // OR we can try to assume it exists and if not, we can't really "fix" it from node 
    // without a postgres connection string (which we have in .env.local as DATABASE_URL!)

    const { Client } = require('pg');
    const dbUrl = process.env.DATABASE_URL;

    if (!dbUrl) {
        console.error('Missing DATABASE_URL in .env.local');
        return;
    }

    const client = new Client({
        connectionString: dbUrl,
        ssl: { rejectUnauthorized: false } // Supabase requires SSL
    });

    try {
        await client.connect();
        console.log('Connected to PostgreSQL database');

        const query = `
            ALTER TABLE news_items 
            ADD COLUMN IF NOT EXISTS topic TEXT;
        `;

        await client.query(query);
        console.log('✅ Successfully added column "topic" (if not exists)');

    } catch (err) {
        console.error('❌ Error executing SQL:', err.message);
    } finally {
        await client.end();
    }
}

addTopicColumn();
