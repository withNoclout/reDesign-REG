require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
    console.error('❌ DATABASE_URL is missing in .env.local');
    console.error('Please make sure you have DATABASE_URL set in your environment variables.');
    process.exit(1);
}

const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false }
});

async function addMissingColumns() {
    try {
        await client.connect();
        console.log('✅ Connected to Supabase Database');

        // Add temp_path column if not exists
        console.log('\n📝 Adding temp_path column...');
        try {
            await client.query(`
                ALTER TABLE news_items 
                ADD COLUMN IF NOT EXISTS temp_path TEXT;
            `);
            console.log('✅ temp_path column added successfully');
        } catch (err) {
            console.warn('⚠️  Warning adding temp_path:', err.message);
        }

        // Add uploaded_to_supabase column if not exists
        console.log('\n📝 Adding uploaded_to_supabase column...');
        try {
            await client.query(`
                ALTER TABLE news_items 
                ADD COLUMN IF NOT EXISTS uploaded_to_supabase BOOLEAN DEFAULT FALSE;
            `);
            console.log('✅ uploaded_to_supabase column added successfully');
        } catch (err) {
            console.warn('⚠️  Warning adding uploaded_to_supabase:', err.message);
        }

        // Verify the columns were added
        console.log('\n🔍 Verifying table structure...');
        const result = await client.query(`
            SELECT column_name, data_type, column_default 
            FROM information_schema.columns 
            WHERE table_name = 'news_items' 
            AND column_name IN ('temp_path', 'uploaded_to_supabase')
            ORDER BY column_name;
        `);

        if (result.rows.length > 0) {
            console.log('\n✅ Columns verified in news_items table:');
            result.rows.forEach(row => {
                console.log(`   - ${row.column_name}: ${row.data_type}${row.column_default ? ` (default: ${row.column_default})` : ''}`);
            });
        } else {
            console.log('\n⚠️  Warning: No new columns found in the table');
        }

        console.log('\n🎉 Database update completed successfully!');
        console.log('\n📝 Next steps:');
        console.log('   1. The portfolio upload feature should now work');
        console.log('   2. Test by uploading a portfolio item from the web app');
        console.log('   3. Check the database to verify data is being stored correctly');

    } catch (err) {
        console.error('\n❌ Error:', err.message);
        console.error('\n📋 Full error details:', err);
        process.exit(1);
    } finally {
        await client.end();
        console.log('\n✅ Database connection closed');
    }
}

addMissingColumns();