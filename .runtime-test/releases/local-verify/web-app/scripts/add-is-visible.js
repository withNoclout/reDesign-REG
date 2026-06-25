
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing Supabase credentials in .env.local');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function addIsVisibleColumn() {
    console.log('Checking for "is_visible" column in "news_items"...');

    // 1. Check if column exists (by trying to select it)
    const { error: selectError } = await supabase
        .from('news_items')
        .select('is_visible')
        .limit(1);

    if (!selectError) {
        console.log('✅ Column "is_visible" already exists.');
        return;
    }

    console.log('Column not found or error. Attempting to add it via raw SQL (if enabled) or telling user to add it.');
    console.log('NOTE: Since we cannot run DDL via client easily without SQL editor access, we rely on the user or stored procedures. But wait, we can try to use the "postgres" connection if available, or just mocking it if we are in a limited env.');

    // Attempt DDL via rpc if a function exists, otherwise we might fail. 
    // BUT, for this environment, often we just assume we can't change schema easily unless we have a specific setup.
    // However, let's try a direct SQL execution if your setup allows it, OR just log that we need it.

    // Actually, in many Supabase setups for these tasks, we might not have direct DDL access from the JS client unless we have a specific function.
    // Let's try to just warn/instruct if we can't do it.

    console.log('⚠️ Cannot automatically add columns without SQL access. Please run this in your Supabase SQL Editor:');
    console.log(`
    ALTER TABLE news_items 
    ADD COLUMN IF NOT EXISTS is_visible BOOLEAN DEFAULT TRUE;
    `);

    // Mock success for the script if we can't do it? 
    // Wait, let's look at previous scripts. `scripts/add-missing-columns.js` did something.
}

addIsVisibleColumn();
