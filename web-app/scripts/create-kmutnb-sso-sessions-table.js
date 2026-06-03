require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('❌ Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);
const sqlPath = path.join(__dirname, '..', 'deploy', 'database', 'kmutnb-sso-sessions.sql');
const sql = fs.readFileSync(sqlPath, 'utf8');

async function ensureKmutnbSsoSessionsTable() {
    try {
        const { data, error } = await supabase
            .from('kmutnb_sso_sessions')
            .select('session_id')
            .limit(1);

        if (error && error.message.includes('kmutnb_sso_sessions')) {
            console.log('⚠️  kmutnb_sso_sessions table does not exist yet.');
            console.log('');
            console.log('📋 Please run this SQL in Supabase Dashboard → SQL Editor:');
            console.log('─'.repeat(60));
            console.log(sql.trim());
            console.log('─'.repeat(60));
            return;
        }

        console.log('✅ kmutnb_sso_sessions table already exists!');
        if (data) console.log(`   Found ${data.length} record(s)`);
    } catch (err) {
        console.error('❌ Error:', err.message);
    }
}

ensureKmutnbSsoSessionsTable();
