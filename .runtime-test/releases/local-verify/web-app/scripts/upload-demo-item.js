const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

// Configuration
// Using the Mock ID from `lib/auth.js`
const USER_ID = '00000000-0000-0000-0000-000000000067';
const SOURCE_IMAGE_PATH = path.resolve(__dirname, '../../BG_image/login logo.png');
const BUCKET_NAME = 'portfolio-assets';
const TABLE_NAME = 'news_items';

// Load Env
const envPath = path.resolve(__dirname, '../.env.local');
let env = {};
if (fs.existsSync(envPath)) {
    const envConfig = fs.readFileSync(envPath, 'utf8');
    envConfig.split('\n').forEach(line => {
        const [key, value] = line.split('=');
        if (key && value) env[key.trim()] = value.trim();
    });
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.error('❌ Missing Supabase credentials');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// PG Client
const pool = new Pool({
    connectionString: env.DATABASE_URL || process.env.DATABASE_URL,
});

async function runDemo() {
    console.log('🚀 Starting Demo Upload...');
    console.log(`User: ${USER_ID}`);
    console.log(`Image: ${SOURCE_IMAGE_PATH}`);

    if (!fs.existsSync(SOURCE_IMAGE_PATH)) {
        console.error('❌ Image file not found at:', SOURCE_IMAGE_PATH);
        return;
    }

    // 1. Upload Image
    const fileContent = fs.readFileSync(SOURCE_IMAGE_PATH);
    const fileName = `demo/login-logo-${Date.now()}.png`;

    console.log(`\n1️⃣ Uploading to Storage (${fileName})...`);
    const { data: uploadData, error: uploadError } = await supabase
        .storage
        .from(BUCKET_NAME)
        .upload(fileName, fileContent, {
            contentType: 'image/png',
            upsert: false
        });

    if (uploadError) {
        console.error('❌ Upload Failed:', uploadError.message);
        return;
    }
    console.log('✅ Upload Success');

    // 2. Get Public URL
    const { data: urlData } = supabase
        .storage
        .from(BUCKET_NAME)
        .getPublicUrl(fileName);

    const publicUrl = urlData.publicUrl;
    console.log('🔗 URL:', publicUrl);

    // 3. Insert into Database directly (Bypass RLS)
    console.log('\n2️⃣ Inserting into Database (Direct SQL)...');
    try {
        const client = await pool.connect();
        const query = `
            INSERT INTO news_items (title, description, image_url, created_by, created_at)
            VALUES ($1, $2, $3, $4, NOW())
            RETURNING *;
        `;
        const values = ['Demo Upload from Script', 'This image was uploaded via a backend script to demonstrate Supabase integration.', publicUrl, USER_ID];

        const res = await client.query(query, values);
        client.release();

        console.log('✅ Database Insert Success!', res.rows[0].id);
        console.log('\n🎉 DEMO COMPLETE');
        console.log('1. I have enabled MOCK_AUTH in your .env.local');
        console.log('2. Please RELOAD the website.');
        console.log('3. You will be logged in as "mock_student_67" and see this image.');

    } catch (err) {
        console.error('❌ Database Insert Failed:', err.message);
    } finally {
        await pool.end();
    }
}

runDemo();
