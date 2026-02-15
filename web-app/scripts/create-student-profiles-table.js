
require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
    console.error('❌ DATABASE_URL is missing in .env.local');
    process.exit(1);
}

const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false }
});

async function createStudentProfilesTable() {
    try {
        await client.connect();
        console.log('✅ Connected to Supabase Database');

        // Create student_profiles table
        console.log('\n📝 Creating student_profiles table...');
        await client.query(`
            CREATE TABLE IF NOT EXISTS student_profiles (
                student_id        TEXT PRIMARY KEY,
                faculty           TEXT,
                department        TEXT,
                major             TEXT,
                advisor1          TEXT,
                advisor2          TEXT,
                advisor3          TEXT,
                admit_year        TEXT,
                current_year      TEXT,
                current_semester  TEXT,
                updated_at        TIMESTAMPTZ DEFAULT NOW()
            );
        `);
        console.log('✅ student_profiles table created/verified');

        // Enable RLS
        await client.query(`ALTER TABLE student_profiles ENABLE ROW LEVEL SECURITY;`);
        console.log('✅ RLS enabled on student_profiles');

        // RLS Policies
        const policies = [
            {
                name: 'Service Role Full Access',
                sql: `FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role')`
            },
            {
                name: 'Public Read Profiles',
                sql: `FOR SELECT USING (true)`
            }
        ];

        for (const policy of policies) {
            try {
                await client.query(`DROP POLICY IF EXISTS "${policy.name}" ON student_profiles;`);
                await client.query(`CREATE POLICY "${policy.name}" ON student_profiles ${policy.sql};`);
                console.log(`✅ Policy "${policy.name}" created`);
            } catch (e) {
                console.warn(`⚠️ Policy "${policy.name}" warning:`, e.message);
            }
        }

        // Create index for faster lookups
        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_student_profiles_student_id 
            ON student_profiles(student_id);
        `);
        console.log('✅ Index created on student_id');

        console.log('\n🎉 student_profiles setup completed!');

    } catch (err) {
        console.error('\n❌ Error:', err.message);
        process.exit(1);
    } finally {
        await client.end();
        console.log('✅ Connection closed');
    }
}

createStudentProfilesTable();
