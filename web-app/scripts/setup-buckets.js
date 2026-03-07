import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

// Load the exact .env.local file
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase credentials in .env.local');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function setupBuckets() {
    console.log('--- Setting up Supabase Buckets ---');

    const bucketsToCreate = ['avatars', 'portfolios'];

    for (const bucketName of bucketsToCreate) {
        console.log(`Checking bucket: ${bucketName}...`);

        // Try getting the bucket
        const { data: bucketData, error: bucketError } = await supabase.storage.getBucket(bucketName);

        if (bucketError && bucketError.message.includes('not found')) {
            console.log(`Bucket '${bucketName}' not found. Creating...`);

            const { data, error } = await supabase.storage.createBucket(bucketName, {
                public: true,
                allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
                fileSizeLimit: 2097152 // 2MB
            });

            if (error) {
                console.error(`❌ Failed to create bucket '${bucketName}':`, error.message);
            } else {
                console.log(`✅ Successfully created bucket '${bucketName}'`);
            }
        } else if (bucketData) {
            console.log(`✅ Bucket '${bucketName}' already exists.`);
        } else if (bucketError) {
            console.error(`❌ Error checking bucket '${bucketName}':`, bucketError.message);
        }
    }

    console.log('--- Bucket Setup Complete ---');
}

setupBuckets();
