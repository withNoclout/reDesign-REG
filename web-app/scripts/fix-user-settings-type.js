
require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
    console.error('❌ DATABASE_URL is missing in .env.local');
    process.exit(1);
}

const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: true }
});

async function fixUserSettingsType() {
    try {
        await client.connect();
        console.log('✅ Connected to Supabase Database');

        // Check current column type
        const typeCheck = await client.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'user_settings' AND column_name = 'user_id';
        `);

        if (typeCheck.rows.length === 0) {
            console.log('⚠️ user_settings table or user_id column not found');
            console.log('Creating user_settings table with TEXT type...');
            await client.query(`
                CREATE TABLE IF NOT EXISTS user_settings (
                    user_id TEXT PRIMARY KEY,
                    portfolio_config JSONB DEFAULT '{"columnCount": 3, "gapSize": "normal"}',
                    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
                );
            `);
            console.log('✅ user_settings table created with TEXT user_id');
        } else {
            const currentType = typeCheck.rows[0].data_type;
            console.log(`Current user_id type: ${currentType}`);

            if (currentType === 'uuid') {
                console.log('🔄 Changing user_id from UUID to TEXT...');

                // Drop and recreate since PK type change requires it
                await client.query(`
                    ALTER TABLE user_settings 
                    ALTER COLUMN user_id TYPE TEXT USING user_id::TEXT;
                `);
                console.log('✅ user_id column changed to TEXT');
            } else {
                console.log('✅ user_id is already TEXT — no change needed');
            }
        }

        // Enable RLS
        await client.query(`ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;`);
        console.log('✅ RLS enabled on user_settings');

        // Add RLS policies
        const policies = [
            {
                name: 'Service Role Full Access',
                sql: `FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role')`
            }
        ];

        for (const policy of policies) {
            try {
                await client.query(`DROP POLICY IF EXISTS "${policy.name}" ON user_settings;`);
                await client.query(`CREATE POLICY "${policy.name}" ON user_settings ${policy.sql};`);
                console.log(`✅ Policy "${policy.name}" created`);
            } catch (e) {
                console.warn(`⚠️ Policy "${policy.name}" warning:`, e.message);
            }
        }

        console.log('\n🎉 user_settings fix completed!');

    } catch (err) {
        console.error('\n❌ Error:', err.message);
        process.exit(1);
    } finally {
        await client.end();
        console.log('✅ Connection closed');
    }
}

fixUserSettingsType();
