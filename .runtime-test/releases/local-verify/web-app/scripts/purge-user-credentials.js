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

async function purgeUserCredentials() {
    try {
        await client.connect();
        console.log('✅ Connected to Supabase Database');

        const existsResult = await client.query(`
            SELECT EXISTS (
                SELECT 1
                FROM information_schema.tables
                WHERE table_schema = 'public'
                  AND table_name = 'user_credentials'
            ) AS exists;
        `);

        if (!existsResult.rows[0]?.exists) {
            console.log('ℹ️ user_credentials table does not exist; nothing to purge');
            return;
        }

        const beforeResult = await client.query(`
            SELECT
                COUNT(*)::int AS total_rows,
                COUNT(*) FILTER (WHERE encrypted_password IS NOT NULL)::int AS encrypted_password_rows,
                COUNT(*) FILTER (WHERE iv IS NOT NULL)::int AS iv_rows
            FROM public.user_credentials;
        `);

        console.log('Before cleanup:', beforeResult.rows[0]);

        await client.query('BEGIN');

        const purgeResult = await client.query(`
            UPDATE public.user_credentials
            SET encrypted_password = NULL,
                iv = NULL,
                updated_at = NOW()
            WHERE encrypted_password IS NOT NULL
               OR iv IS NOT NULL;
        `);

        console.log(`✅ Purged credential material from ${purgeResult.rowCount} row(s)`);

        await client.query(`
            ALTER TABLE public.user_credentials
            DROP COLUMN IF EXISTS encrypted_password,
            DROP COLUMN IF EXISTS iv;
        `);

        await client.query('COMMIT');

        const columnResult = await client.query(`
            SELECT column_name
            FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = 'user_credentials'
            ORDER BY ordinal_position;
        `);

        console.log('Remaining columns:', columnResult.rows.map(row => row.column_name));
        console.log('✅ Credential columns dropped successfully');
    } catch (err) {
        try {
            await client.query('ROLLBACK');
        } catch {
            // ignore rollback failures when the connection never reached BEGIN
        }
        console.error('❌ Purge failed:', err.message);
        process.exitCode = 1;
    } finally {
        await client.end().catch(() => {});
        console.log('✅ Database connection closed');
    }
}

purgeUserCredentials();
