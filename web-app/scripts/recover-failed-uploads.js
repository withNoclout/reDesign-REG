require('dotenv').config({ path: '../.env.local' });
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// BASE_DIR: Root directory for web-app (consistent across all upload-related files)
const BASE_DIR = path.join(__dirname, '..'); // = web-app/
console.log('[Recover Script] BASE_DIR:', BASE_DIR);

// Configuration
const MAX_CONCURRENT_UPLOADS = 3; // Upload 3 items at a time
const BATCH_DELAY = 1000; // 1 second delay between batches

async function recoverFailedUploads() {
    console.log('='.repeat(60));
    console.log('🔄 Portfolio Upload Recovery Script');
    console.log('='.repeat(60));
    console.log();

    try {
        // Initialize Supabase client
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

        if (!supabaseUrl || !serviceKey) {
            throw new Error('Missing Supabase credentials in .env.local');
        }

        const supabase = createClient(supabaseUrl, serviceKey);
        console.log('✅ Connected to Supabase');
        console.log();

        // Step 1: Find items that haven't been uploaded
        console.log('📋 Step 1: Scanning for failed uploads...');

        const { data: failedItems, error: fetchError } = await supabase
            .from('news_items')
            .select('*')
            .eq('uploaded_to_supabase', false)
            .is('temp_path', 'not.null')
            .order('created_at', { ascending: false });

        if (fetchError) {
            throw new Error(`Failed to fetch items: ${fetchError.message}`);
        }

        if (!failedItems || failedItems.length === 0) {
            console.log('✨ No failed uploads found!');
            console.log();
            return {
                success: true,
                total: 0,
                uploaded: 0,
                failed: 0,
                errors: []
            };
        }

        console.log(`📦 Found ${failedItems.length} items to recover`);
        console.log();

        // Step 2: Process each item
        console.log('🚀 Step 2: Processing uploads...');
        console.log();

        const results = {
            total: failedItems.length,
            uploaded: 0,
            failed: 0,
            errors: []
        };

        // Process in batches to avoid overwhelming the system
        for (let i = 0; i < failedItems.length; i += MAX_CONCURRENT_UPLOADS) {
            const batch = failedItems.slice(i, i + MAX_CONCURRENT_UPLOADS);
            const batchNum = Math.floor(i / MAX_CONCURRENT_UPLOADS) + 1;
            const totalBatches = Math.ceil(failedItems.length / MAX_CONCURRENT_UPLOADS);

            console.log(`📦 Processing batch ${batchNum}/${totalBatches} (${batch.length} items)...`);

            // Process batch in parallel
            const batchPromises = batch.map(item => processItem(supabase, item));
            const batchResults = await Promise.allSettled(batchPromises);

            // Update results
            batchResults.forEach((result, idx) => {
                const item = batch[idx];
                if (result.status === 'fulfilled' && result.value.success) {
                    results.uploaded++;
                    console.log(`  ✅ Item ${item.id}: ${result.value.message}`);
                } else {
                    results.failed++;
                    const errorMsg = result.status === 'fulfilled'
                        ? result.value.message
                        : result.reason.message;
                    results.errors.push(`Item ${item.id}: ${errorMsg}`);
                    console.log(`  ❌ Item ${item.id}: ${errorMsg}`);
                }
            });

            console.log();

            // Add delay between batches (except for the last batch)
            if (i + MAX_CONCURRENT_UPLOADS < failedItems.length) {
                console.log(`⏸️  Waiting ${BATCH_DELAY}ms before next batch...`);
                await new Promise(resolve => setTimeout(resolve, BATCH_DELAY));
            }
        }

        // Step 3: Print summary
        console.log('='.repeat(60));
        console.log('📊 Recovery Summary');
        console.log('='.repeat(60));
        console.log(`Total items: ${results.total}`);
        console.log(`✅ Successfully uploaded: ${results.uploaded}`);
        console.log(`❌ Failed: ${results.failed}`);
        console.log();

        if (results.errors.length > 0) {
            console.log('Errors:');
            results.errors.forEach((error, idx) => {
                console.log(`  ${idx + 1}. ${error}`);
            });
            console.log();
        }

        console.log('='.repeat(60));
        console.log();

        return results;

    } catch (error) {
        console.error('💥 Fatal error:', error.message);
        console.error(error.stack);
        return {
            success: false,
            total: 0,
            uploaded: 0,
            failed: 0,
            errors: [error.message]
        };
    }
}

async function processItem(supabase, item) {
    const { id, temp_path, description } = item;

    try {
        // Determine if tempPath is already absolute or relative
        let fullPath;
        let isAbsolute = path.isAbsolute(temp_path.trim());

        if (isAbsolute) {
            // tempPath is already absolute (new behavior)
            fullPath = temp_path.trim();
        } else {
            // tempPath is relative (backward compatibility)
            fullPath = path.resolve(BASE_DIR, temp_path.trim());
        }

        // Normalize path for consistency
        fullPath = path.normalize(fullPath);

        console.log(`    📄 Processing item ${id} (${fs.existsSync(fullPath) ? fs.statSync(fullPath).size : 0} bytes)...`);

        if (!fs.existsSync(fullPath)) {
            return {
                success: false,
                message: `Temp file not found: ${fullPath}`
            };
        }

        // Read file
        const fileBuffer = fs.readFileSync(fullPath);
        console.log(`    📄 Processing item ${id} (${fileBuffer.length} bytes)...`);

        // Generate Supabase filename
        const supabaseFileName = `portfolio/${Date.now()}_${id}_${path.basename(temp_path)}`;

        // Upload using Supabase SDK
        const { error: uploadError } = await supabase.storage
            .from('portfolio-assets')
            .upload(supabaseFileName, fileBuffer, {
                contentType: 'image/webp',
                upsert: false
            });

        if (uploadError) {
            return {
                success: false,
                message: `Upload failed: ${uploadError.message}`
            };
        }

        // Generate public URL
        const { data: publicUrlData } = supabase.storage
            .from('portfolio-assets')
            .getPublicUrl(supabaseFileName);

        const publicUrl = publicUrlData.publicUrl;

        // Update database
        const { error: updateError } = await supabase
            .from('news_items')
            .update({
                image_url: publicUrl,
                temp_path: null,
                uploaded_to_supabase: true
            })
            .eq('id', id);

        if (updateError) {
            return {
                success: false,
                message: `Database update failed: ${updateError.message}`
            };
        }

        // Delete temp file
        try {
            fs.unlinkSync(fullPath);
        } catch (e) {
            console.warn(`    ⚠️ Failed to delete temp file: ${e.message}`);
        }

        return {
            success: true,
            message: `Uploaded and cleaned up`
        };

    } catch (error) {
        return {
            success: false,
            message: error.message
        };
    }
}

// Run if called directly
if (require.main === module) {
    recoverFailedUploads()
        .then(result => {
            if (result.failed === 0) {
                console.log('✨ All uploads recovered successfully!');
            } else {
                console.log('⚠️  Some uploads failed. Please review the errors above.');
            }
            process.exit(result.failed === 0 ? 0 : 1);
        })
        .catch(error => {
            console.error('💥 Fatal error:', error);
            process.exit(1);
        });
}

module.exports = { recoverFailedUploads };