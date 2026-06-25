
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('❌ Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function createUserDirectoryTable() {
    try {
        console.log('📝 Creating user_directory table via Supabase RPC...');

        // Use rpc to execute raw SQL (requires sql function or dashboard)
        // Alternative: use Supabase Dashboard SQL Editor
        // For now, test if table exists by trying a select
        const { data, error } = await supabase
            .from('user_directory')
            .select('user_code')
            .limit(1);

        if (error && error.message.includes('user_directory')) {
            console.log('⚠️  Table does not exist yet.');
            console.log('');
            console.log('📋 Please run this SQL in Supabase Dashboard → SQL Editor:');
            console.log('─'.repeat(60));
            console.log(`
-- Enable trigram extension for partial text search
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- User directory (populated on login)
CREATE TABLE IF NOT EXISTS user_directory (
    user_code    TEXT PRIMARY KEY,
    name_th      TEXT,
    name_en      TEXT,
    email        TEXT,
    faculty      TEXT,
    avatar_url   TEXT,
    last_login   TIMESTAMPTZ DEFAULT NOW(),
    created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- Search indexes
CREATE INDEX IF NOT EXISTS idx_user_dir_name_th
    ON user_directory USING gin (name_th gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_user_dir_name_en
    ON user_directory USING gin (name_en gin_trgm_ops);

-- Enable RLS
ALTER TABLE user_directory ENABLE ROW LEVEL SECURITY;

-- Allow service role full access
CREATE POLICY "Service role full access"
    ON user_directory FOR ALL USING (true) WITH CHECK (true);
`);
            console.log('─'.repeat(60));
        } else {
            console.log('✅ user_directory table already exists!');
            if (data) console.log(`   Found ${data.length} record(s)`);
        }

    } catch (err) {
        console.error('❌ Error:', err.message);
    }
}

createUserDirectoryTable();
