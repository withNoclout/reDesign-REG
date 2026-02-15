
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

async function fixUserVerificationsRLS() {
    try {
        await client.connect();
        console.log('✅ Connected to Supabase Database');

        // Check if table exists
        const tableCheck = await client.query(`
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_name = 'user_verifications'
            );
        `);

        if (!tableCheck.rows[0].exists) {
            console.log('⚠️ user_verifications table does not exist. Creating...');
            await client.query(`
                CREATE TABLE IF NOT EXISTS user_verifications (
                    user_code         TEXT PRIMARY KEY,
                    is_verified       BOOLEAN DEFAULT FALSE,
                    drive_connected   BOOLEAN DEFAULT FALSE,
                    profile_image_url TEXT,
                    updated_at        TIMESTAMPTZ DEFAULT NOW()
                );
            `);
            console.log('✅ Table created');
        }

        // Check current RLS status
        const rlsCheck = await client.query(`
            SELECT relrowsecurity 
            FROM pg_class 
            WHERE relname = 'user_verifications';
        `);
        console.log('RLS enabled:', rlsCheck.rows[0]?.relrowsecurity);

        // Check existing policies
        const policyCheck = await client.query(`
            SELECT policyname FROM pg_policies 
            WHERE tablename = 'user_verifications';
        `);
        console.log('Existing policies:', policyCheck.rows.map(r => r.policyname));

        // Add missing RLS policies
        const policies = [
            {
                name: 'Service Role Full Access',
                sql: `FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role')`
            },
            {
                name: 'Public Read Verifications',
                sql: `FOR SELECT USING (true)`
            }
        ];

        for (const policy of policies) {
            try {
                await client.query(`DROP POLICY IF EXISTS "${policy.name}" ON user_verifications;`);
                await client.query(`CREATE POLICY "${policy.name}" ON user_verifications ${policy.sql};`);
                console.log(`✅ Policy "${policy.name}" created`);
            } catch (e) {
                console.warn(`⚠️ Policy "${policy.name}" warning:`, e.message);
            }
        }

        console.log('\n🎉 user_verifications RLS fix completed!');

    } catch (err) {
        console.error('\n❌ Error:', err.message);
        process.exit(1);
    } finally {
        await client.end();
        console.log('✅ Connection closed');
    }
}

fixUserVerificationsRLS();
