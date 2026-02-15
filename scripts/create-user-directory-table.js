/**
 * Migration: Create `user_directory` table
 * 
 * Run: node scripts/create-user-directory-table.js
 * 
 * Prerequisites:
 *   - NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local
 *   - pg_trgm extension enabled in Supabase (usually enabled by default)
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '../web-app/.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function migrate() {
    console.log('🚀 Creating user_directory table...');

    // Create the table using Supabase SQL
    const { error } = await supabase.rpc('exec_sql', {
        query: `
            CREATE TABLE IF NOT EXISTS user_directory (
                user_code    TEXT PRIMARY KEY,
                name_th      TEXT DEFAULT '',
                name_en      TEXT DEFAULT '',
                email        TEXT DEFAULT '',
                faculty      TEXT DEFAULT '',
                avatar_url   TEXT DEFAULT '',
                last_login   TIMESTAMPTZ DEFAULT NOW(),
                created_at   TIMESTAMPTZ DEFAULT NOW()
            );

            -- Trigram indexes for partial name search
            CREATE EXTENSION IF NOT EXISTS pg_trgm;
            
            CREATE INDEX IF NOT EXISTS idx_user_directory_name_th 
                ON user_directory USING gin (name_th gin_trgm_ops);
            CREATE INDEX IF NOT EXISTS idx_user_directory_name_en 
                ON user_directory USING gin (name_en gin_trgm_ops);
            CREATE INDEX IF NOT EXISTS idx_user_directory_user_code 
                ON user_directory USING btree (user_code);

            -- RLS (defense-in-depth, bypassed by service role)
            ALTER TABLE user_directory ENABLE ROW LEVEL SECURITY;
        `
    });

    if (error) {
        // If exec_sql RPC doesn't exist, provide manual SQL
        console.warn('⚠️  RPC exec_sql not available. Run this SQL manually in Supabase SQL Editor:');
        console.log(`
CREATE TABLE IF NOT EXISTS user_directory (
    user_code    TEXT PRIMARY KEY,
    name_th      TEXT DEFAULT '',
    name_en      TEXT DEFAULT '',
    email        TEXT DEFAULT '',
    faculty      TEXT DEFAULT '',
    avatar_url   TEXT DEFAULT '',
    last_login   TIMESTAMPTZ DEFAULT NOW(),
    created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS idx_user_directory_name_th 
    ON user_directory USING gin (name_th gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_user_directory_name_en 
    ON user_directory USING gin (name_en gin_trgm_ops);

ALTER TABLE user_directory ENABLE ROW LEVEL SECURITY;
        `);
        return;
    }

    console.log('✅ user_directory table created successfully');
}

migrate().catch(err => {
    console.error('❌ Migration failed:', err.message);
    process.exit(1);
});
