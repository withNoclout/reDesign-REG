require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

async function checkSchema() {
    console.log('🔍 Verifying "student_profiles" Table & Policies...');

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceKey) {
        console.error('❌ Missing .env.local credentials');
        return;
    }

    const supabase = createClient(supabaseUrl, serviceKey);

    try {
        // Try to insert a dummy record (rollback effectively, or just verify select)
        // Select is safer.
        const { data, error } = await supabase
            .from('student_profiles')
            .select('student_id')
            .limit(1);

        if (error) {
            if (error.code === '42P01') { // undefined_table
                console.error('❌ Table "student_profiles" DOES NOT EXIST.');
                console.log('👉 Please run the SQL from implementation_plan.md in Supabase Dashboard.');
            } else {
                console.error('❌ Error querying table:', error.message, error.code);
                console.log('This might indicate RLS Policy issues if using a limited key (but we are using Service Key).');
            }
        } else {
            console.log('✅ Table "student_profiles" exists and is accessible.');
            console.log('✅ Caching infrastructure is READY.');
        }

    } catch (err) {
        console.error('Unexpected error:', err);
    }
}

checkSchema();
