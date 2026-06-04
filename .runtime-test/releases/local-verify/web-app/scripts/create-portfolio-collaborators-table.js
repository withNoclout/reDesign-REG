
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('❌ Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function createPortfolioCollaboratorsTable() {
    try {
        console.log('📝 Checking portfolio_collaborators table...');

        const { data, error } = await supabase
            .from('portfolio_collaborators')
            .select('id')
            .limit(1);

        if (error && error.message.includes('portfolio_collaborators')) {
            console.log('⚠️  Table does not exist yet.');
            console.log('');
            console.log('📋 Please run this SQL in Supabase Dashboard → SQL Editor:');
            console.log('─'.repeat(60));
            console.log(`
-- Portfolio collaborators (join table)
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

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_collab_portfolio
    ON portfolio_collaborators (portfolio_id);
CREATE INDEX IF NOT EXISTS idx_collab_student
    ON portfolio_collaborators (student_code);
CREATE INDEX IF NOT EXISTS idx_collab_status
    ON portfolio_collaborators (status);
CREATE INDEX IF NOT EXISTS idx_collab_added_by
    ON portfolio_collaborators (added_by);

-- Enable RLS
ALTER TABLE portfolio_collaborators ENABLE ROW LEVEL SECURITY;

-- Allow service role full access
CREATE POLICY "Service role full access"
    ON portfolio_collaborators FOR ALL USING (true) WITH CHECK (true);
`);
            console.log('─'.repeat(60));
        } else {
            console.log('✅ portfolio_collaborators table already exists!');
            if (data) console.log(`   Found ${data.length} record(s)`);
        }

    } catch (err) {
        console.error('❌ Error:', err.message);
    }
}

createPortfolioCollaboratorsTable();
