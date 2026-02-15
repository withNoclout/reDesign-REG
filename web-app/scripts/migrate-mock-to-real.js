require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

// Configuration
const MOCK_USER_ID = '00000000-0000-0000-0000-000000000067';
const REAL_USER_ID = 's6701091611290'; // From .env.local REG_USERNAME

async function migrateData() {
    console.log('🔄 Starting Data Migration: Mock -> Real');
    console.log(`   Mock ID: ${MOCK_USER_ID}`);
    console.log(`   Real ID: ${REAL_USER_ID}`);
    console.log('='.repeat(50));

    // Init Supabase
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceKey) {
        console.error('❌ Missing Supabase credentials');
        process.exit(1);
    }

    const supabase = createClient(supabaseUrl, serviceKey);

    try {
        // 1. Check for items owned by Mock User
        const { data: mockItems, error: fetchError } = await supabase
            .from('news_items')
            .select('*')
            .eq('created_by', MOCK_USER_ID);

        if (fetchError) throw fetchError;

        console.log(`📊 Found ${mockItems.length} items belonging to Mock User.`);

        if (mockItems.length === 0) {
            console.log('✅ No migration needed.');
            return;
        }

        // 2. Perform Update
        console.log('🚀 Migrating items...');
        const { data: updated, error: updateError } = await supabase
            .from('news_items')
            .update({ created_by: REAL_USER_ID })
            .eq('created_by', MOCK_USER_ID)
            .select();

        if (updateError) throw updateError;

        console.log(`✅ Successfully migrated ${updated.length} items to ${REAL_USER_ID}`);
        console.log('🎉 Portfolio should now be visible in Real Mode!');

    } catch (err) {
        console.error('❌ Migration Failed:', err.message);
    }
}

migrateData();
