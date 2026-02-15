/**
 * Migration: Create `portfolio_collaborators` table
 * 
 * Run: node scripts/create-portfolio-collaborators-table.js
 * 
 * Prerequisites:
 *   - user_directory table must exist (run create-user-directory-table.js first)
 *   - news_items table must exist
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
    console.log('🚀 Creating portfolio_collaborators table...');

    const { error } = await supabase.rpc('exec_sql', {
        query: `
            CREATE TABLE IF NOT EXISTS portfolio_collaborators (
                id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
                portfolio_id    BIGINT NOT NULL REFERENCES news_items(id) ON DELETE CASCADE,
                student_code    TEXT NOT NULL,
                added_by        TEXT NOT NULL,
                status          TEXT DEFAULT 'pending'
                                CHECK (status IN ('pending', 'accepted', 'rejected')),
                created_at      TIMESTAMPTZ DEFAULT NOW(),
                responded_at    TIMESTAMPTZ,
                
                UNIQUE(portfolio_id, student_code)
            );

            CREATE INDEX IF NOT EXISTS idx_collab_portfolio 
                ON portfolio_collaborators (portfolio_id);
            CREATE INDEX IF NOT EXISTS idx_collab_student 
                ON portfolio_collaborators (student_code);
            CREATE INDEX IF NOT EXISTS idx_collab_status 
                ON portfolio_collaborators (status);
            CREATE INDEX IF NOT EXISTS idx_collab_added_by 
                ON portfolio_collaborators (added_by);

            ALTER TABLE portfolio_collaborators ENABLE ROW LEVEL SECURITY;
        `
    });

    if (error) {
        console.warn('⚠️  RPC exec_sql not available. Run this SQL manually in Supabase SQL Editor:');
        console.log(`
CREATE TABLE IF NOT EXISTS portfolio_collaborators (
    id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    portfolio_id    BIGINT NOT NULL REFERENCES news_items(id) ON DELETE CASCADE,
    student_code    TEXT NOT NULL,
    added_by        TEXT NOT NULL,
    status          TEXT DEFAULT 'pending'
                    CHECK (status IN ('pending', 'accepted', 'rejected')),
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    responded_at    TIMESTAMPTZ,
    
    UNIQUE(portfolio_id, student_code)
);

CREATE INDEX IF NOT EXISTS idx_collab_portfolio 
    ON portfolio_collaborators (portfolio_id);
CREATE INDEX IF NOT EXISTS idx_collab_student 
    ON portfolio_collaborators (student_code);
CREATE INDEX IF NOT EXISTS idx_collab_status 
    ON portfolio_collaborators (status);
CREATE INDEX IF NOT EXISTS idx_collab_added_by 
    ON portfolio_collaborators (added_by);

ALTER TABLE portfolio_collaborators ENABLE ROW LEVEL SECURITY;
        `);
        return;
    }

    console.log('✅ portfolio_collaborators table created successfully');
}

migrate().catch(err => {
    console.error('❌ Migration failed:', err.message);
    process.exit(1);
});
