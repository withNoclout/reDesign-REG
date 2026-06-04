/**
 * Comprehensive Database Fix Script
 * Uses Supabase JS client (service role) to verify and fix schema issues.
 * 
 * Run: node scripts/fix-database-comprehensive.js
 * 
 * ⚠️ For DDL changes (ALTER TABLE, CREATE TABLE), you MUST run the SQL
 * directly in Supabase Dashboard → SQL Editor. This script will generate
 * the SQL for you and verify current state.
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('❌ Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkTable(tableName) {
    const { data, error } = await supabase
        .from(tableName)
        .select('*')
        .limit(1);

    if (error) {
        return { exists: false, error: error.message };
    }
    return { exists: true, sampleRow: data?.[0] || null };
}

async function main() {
    console.log('🔍 Database Schema Verification\n');
    console.log('='.repeat(60));

    // 1. Check news_items
    console.log('\n📋 Table: news_items');
    const newsCheck = await checkTable('news_items');
    if (newsCheck.exists) {
        console.log('   ✅ EXISTS');
        if (newsCheck.sampleRow) {
            console.log('   Columns:', Object.keys(newsCheck.sampleRow).join(', '));
        }
    } else {
        console.log('   ❌ NOT FOUND:', newsCheck.error);
    }

    // 2. Check user_settings
    console.log('\n📋 Table: user_settings');
    const settingsCheck = await checkTable('user_settings');
    if (settingsCheck.exists) {
        console.log('   ✅ EXISTS');

        // Test if TEXT user_id works
        const { error: textTest } = await supabase
            .from('user_settings')
            .select('user_id')
            .eq('user_id', 'test-text-value')
            .limit(1);

        if (textTest) {
            console.log('   ⚠️ TEXT query failed:', textTest.message);
            if (textTest.message.includes('invalid input syntax for type uuid')) {
                console.log('   🔴 CONFIRMED: user_id is UUID type — NEEDS FIX!');
                console.log('   📝 Run this SQL in Supabase Dashboard → SQL Editor:');
                console.log('');
                console.log('   ALTER TABLE user_settings ALTER COLUMN user_id TYPE TEXT USING user_id::TEXT;');
                console.log('');
            }
        } else {
            console.log('   ✅ user_id accepts TEXT values');
        }
    } else {
        console.log('   ❌ NOT FOUND:', settingsCheck.error);
        console.log('   📝 Run this SQL in Supabase Dashboard → SQL Editor:');
        console.log('');
        console.log('   CREATE TABLE user_settings (');
        console.log('       user_id TEXT PRIMARY KEY,');
        console.log('       portfolio_config JSONB DEFAULT \'{"columnCount": 3, "gapSize": "normal"}\',');
        console.log('       updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP');
        console.log('   );');
        console.log('   ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;');
        console.log('   CREATE POLICY "Service Role Full Access" ON user_settings');
        console.log('       FOR ALL USING (auth.role() = \'service_role\')');
        console.log('       WITH CHECK (auth.role() = \'service_role\');');
        console.log('');
    }

    // 3. Check user_verifications
    console.log('\n📋 Table: user_verifications');
    const verCheck = await checkTable('user_verifications');
    if (verCheck.exists) {
        console.log('   ✅ EXISTS');
    } else {
        console.log('   ❌ NOT FOUND:', verCheck.error);
        if (verCheck.error.includes('permission denied') || verCheck.error.includes('policy')) {
            console.log('   🔴 RLS is blocking access — needs policies!');
        }
        console.log('   📝 Run this SQL in Supabase Dashboard → SQL Editor:');
        console.log('');
        console.log('   -- If table exists but RLS blocks:');
        console.log('   CREATE POLICY "Service Role Full Access" ON user_verifications');
        console.log('       FOR ALL USING (auth.role() = \'service_role\')');
        console.log('       WITH CHECK (auth.role() = \'service_role\');');
        console.log('   CREATE POLICY "Public Read Verifications" ON user_verifications');
        console.log('       FOR SELECT USING (true);');
        console.log('');
        console.log('   -- If table doesn\'t exist:');
        console.log('   CREATE TABLE user_verifications (');
        console.log('       user_code TEXT PRIMARY KEY,');
        console.log('       is_verified BOOLEAN DEFAULT FALSE,');
        console.log('       drive_connected BOOLEAN DEFAULT FALSE,');
        console.log('       profile_image_url TEXT,');
        console.log('       updated_at TIMESTAMPTZ DEFAULT NOW()');
        console.log('   );');
        console.log('   ALTER TABLE user_verifications ENABLE ROW LEVEL SECURITY;');
        console.log('');
    }

    // 4. Check student_profiles
    console.log('\n📋 Table: student_profiles');
    const profileCheck = await checkTable('student_profiles');
    if (profileCheck.exists) {
        console.log('   ✅ EXISTS');
        if (profileCheck.sampleRow) {
            console.log('   Columns:', Object.keys(profileCheck.sampleRow).join(', '));
        }
    } else {
        console.log('   ❌ NOT FOUND:', profileCheck.error);
        console.log('   📝 Run this SQL in Supabase Dashboard → SQL Editor:');
        console.log('');
        console.log('   CREATE TABLE student_profiles (');
        console.log('       student_id TEXT PRIMARY KEY,');
        console.log('       faculty TEXT,');
        console.log('       department TEXT,');
        console.log('       major TEXT,');
        console.log('       advisor1 TEXT,');
        console.log('       advisor2 TEXT,');
        console.log('       advisor3 TEXT,');
        console.log('       admit_year TEXT,');
        console.log('       current_year TEXT,');
        console.log('       current_semester TEXT,');
        console.log('       updated_at TIMESTAMPTZ DEFAULT NOW()');
        console.log('   );');
        console.log('   ALTER TABLE student_profiles ENABLE ROW LEVEL SECURITY;');
        console.log('   CREATE POLICY "Service Role Full Access" ON student_profiles');
        console.log('       FOR ALL USING (auth.role() = \'service_role\')');
        console.log('       WITH CHECK (auth.role() = \'service_role\');');
        console.log('   CREATE POLICY "Public Read Profiles" ON student_profiles');
        console.log('       FOR SELECT USING (true);');
        console.log('');
    }

    console.log('\n' + '='.repeat(60));
    console.log('🎯 Summary: Copy any SQL above and run in Supabase Dashboard');
    console.log('   URL: https://supabase.com/dashboard/project/tqbzejjswyexfyvtluup/sql');
    console.log('='.repeat(60));
}

main().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});
