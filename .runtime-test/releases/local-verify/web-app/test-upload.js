const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Load environment variables manually since we might not have dotenv in devDependencies
// Assuming we run this from project root
const envPath = path.resolve(__dirname, '../web-app/.env.local');
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
    console.error('❌ Missing Supabase credentials in .env.local');
    // console.log('Parsed Env:', env); // Security: Don't log keys
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function testUpload() {
    console.log('🚀 Starting Supabase Upload Test...');
    console.log(`Target Bucket: portfolio-assets`);

    const fileName = `test-upload-${Date.now()}.txt`;
    const fileContent = 'This is a test file to verify Supabase storage permissions.';
    const buffer = Buffer.from(fileContent, 'utf-8');

    // 1. Upload
    console.log(`\n1️⃣ Attempting to upload ${fileName}...`);
    const { data, error } = await supabase
        .storage
        .from('portfolio-assets')
        .upload(fileName, buffer, {
            contentType: 'text/plain',
            upsert: false
        });

    if (error) {
        console.error('❌ Upload Failed:', error.message);
        return;
    }
    console.log('✅ Upload Success:', data.path);

    // 2. Get Public URL
    console.log('\n2️⃣ Retrieving Public URL...');
    const { data: urlData } = supabase
        .storage
        .from('portfolio-assets')
        .getPublicUrl(fileName);

    console.log('🔗 Public URL:', urlData.publicUrl);

    // 3. Verify Access (Optional fetch)
    // ...

    // 4. Cleanup (Delete)
    console.log(`\n3️⃣ Cleaning up (Deleting ${fileName})...`);
    const { error: delError } = await supabase
        .storage
        .from('portfolio-assets')
        .remove([fileName]);

    if (delError) {
        console.error('⚠️ Cleanup Failed:', delError.message);
    } else {
        console.log('✅ Cleanup Success');
    }

    console.log('\n🎉 Test Completed Successfully!');
}

testUpload();
