import fs from 'fs';
import path from 'path';
import pg from 'pg';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

const { Client } = pg;
const __dirname = path.dirname(fileURLToPath(import.meta.url));

dotenv.config({ path: path.join(__dirname, '../.env.local') });

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
    console.error('Missing DATABASE_URL in .env.local');
    process.exit(1);
}

function getSslConfig() {
    const sslMode = String(process.env.PGSSLMODE || '').toLowerCase();
    if (sslMode === 'disable') return false;

    try {
        const databaseUrl = new URL(connectionString);
        if (['localhost', '127.0.0.1'].includes(databaseUrl.hostname)) {
            return false;
        }
    } catch {
        // Fall back to TLS for remote URLs we cannot parse.
    }

    return { rejectUnauthorized: true };
}


const client = new Client({
    connectionString,
    ssl: getSslConfig(),
});

async function main() {
    const sqlPath = path.join(__dirname, '../deploy/database/agent-memory.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    try {
        await client.connect();
        await client.query(sql);
        console.log('Agent memory schema applied successfully.');
    } catch (error) {
        console.error('Failed to apply agent memory schema:', error.message);
        process.exitCode = 1;
    } finally {
        await client.end();
    }
}

main();
