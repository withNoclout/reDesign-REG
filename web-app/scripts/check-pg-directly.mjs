
import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const { Client } = pg;
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env.local') });

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
    console.error('Missing DATABASE_URL in .env.local');
    process.exit(1);
}

const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false }
});

async function check() {
    try {
        await client.connect();
        const res = await client.query(`
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_name = 'evaluation_submissions'
            );
        `);
        console.log('Does table evaluation_submissions exist?', res.rows[0].exists);

        if (res.rows[0].exists) {
            const countRes = await client.query('SELECT COUNT(*) FROM public.evaluation_submissions');
            console.log('Record count:', countRes.rows[0].count);
        }
    } catch (err) {
        console.error('Check failed:', err.message);
    } finally {
        await client.end();
    }
}

check();
