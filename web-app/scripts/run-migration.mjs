
import pg from 'pg';
import fs from 'fs';
import path from 'path';
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

const client = new Client({
    connectionString,
    ssl: {
        rejectUnauthorized: false
    }
});

async function migrate() {
    try {
        await client.connect();
        console.log('Connected to PostgreSQL database.');

        const sqlPath = path.join(__dirname, '../supabase-schema.sql');
        const sql = fs.readFileSync(sqlPath, 'utf-8');

        console.log('Executing migration script...');

        // Execute the SQL. Note: This assumes the SQL is safe to rerun or uses IF NOT EXISTS
        // For policies, they might throw errors if they already exist, so we split by semicolon and run individually to allow partial success
        const commands = sql
            .split(';')
            .map(cmd => cmd.trim())
            .filter(cmd => cmd.length > 0);

        for (const command of commands) {
            try {
                await client.query(command);
                // console.log('Successfully executed:', command.substring(0, 50) + '...');
            } catch (err) {
                if (err.message.includes('already exists')) {
                    // console.log('Skipped (already exists):', command.substring(0, 50) + '...');
                } else {
                    console.error('Error executing command:', command.substring(0, 50) + '...');
                    console.error('Detail:', err.message);
                }
            }
        }

        console.log('Migration completed successfully.');
    } catch (err) {
        console.error('Migration failed:', err.message);
    } finally {
        await client.end();
    }
}

migrate();
