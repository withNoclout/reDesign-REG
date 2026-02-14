require('dotenv').config({ path: '../.env.local' });
const fs = require('fs');
const path = require('path');

// BASE_DIR: Root directory for web-app (consistent across all upload-related files)
const BASE_DIR = path.join(__dirname, '..'); // = web-app/
console.log('[Upload Script] BASE_DIR:', BASE_DIR);
console.log('[Upload Script] Script directory:', __dirname);

async function uploadTempToSupabase(itemId, tempPath) {
    try {
        console.log(`[Upload Script] Starting upload for item ${itemId}...`);
        console.log(`[Upload Script] Raw temp path from DB: ${tempPath}`);

        // Read environment variables
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

        if (!supabaseUrl || !anonKey) {
            throw new Error('Missing Supabase credentials');
        }

        // Determine if tempPath is already absolute or relative
        let fullPath;
        let isAbsolute = path.isAbsolute(tempPath.trim());

        console.log(`[Upload Script] Is tempPath absolute? ${isAbsolute}`);

        if (isAbsolute) {
            // tempPath is already absolute (new behavior)
            fullPath = tempPath.trim();
            console.log(`[Upload Script] Using absolute path directly`);
        } else {
            // tempPath is relative (backward compatibility)
            console.log(`[Upload Script] Converting relative path to absolute using BASE_DIR`);
            fullPath = path.resolve(BASE_DIR, tempPath.trim());
        }

        // Normalize path for consistency
        fullPath = path.normalize(fullPath);

        console.log(`[Upload Script] Final full path: ${fullPath}`);
        console.log(`[Upload Script] File should exist: ${fs.existsSync(fullPath)}`);

        // Check if temp file exists
        if (!fs.existsSync(fullPath)) {
            console.error(`[Upload Script] ERROR: Temp file not found!`);
            console.error(`[Upload Script] Script directory: ${__dirname}`);
            console.error(`[Upload Script] BASE_DIR: ${BASE_DIR}`);
            console.error(`[Upload Script] Input tempPath: ${tempPath}`);
            console.error(`[Upload Script] Resolved fullPath: ${fullPath}`);

            // Check what's in the temp directory
            const tempDir = path.join(BASE_DIR, 'public', 'temp');
            console.error(`[Upload Script] Expected temp directory: ${tempDir}`);

            if (fs.existsSync(tempDir)) {
                const files = fs.readdirSync(tempDir);
                console.error(`[Upload Script] Temp directory contents (${files.length} files):`);
                files.slice(0, 10).forEach(f => console.error(`  - ${f}`));
            } else {
                console.error(`[Upload Script] Temp directory does not exist!`);
            }

            throw new Error(`Temp file not found: ${fullPath}`);
        }

        // Initialize Supabase Client
        const { createClient } = require('@supabase/supabase-js');

        // Use Service Role Key if available (preferred), otherwise fallback to Anon Key
        // NOTE: The key in SUPABASE_SERVICE_ROLE_KEY is a valid JWT (starts with eyJ...), 
        // while NEXT_PUBLIC_SUPABASE_ANON_KEY might be an opaque key (sb_...).
        // Storage requires a valid JWT in Authorization header.
        const authKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

        const supabase = createClient(supabaseUrl, authKey);

        // Read the file
        const fileBuffer = fs.readFileSync(fullPath);
        console.log(`[Upload Script] File size: ${fileBuffer.length} bytes`);

        // Generate Supabase filename
        const supabaseFileName = `portfolio/${Date.now()}_${path.basename(tempPath)}`;

        // Upload using Supabase SDK
        console.log('[Upload Script] Uploading to Supabase Storage (via SDK)...');

        const { data: uploadData, error: uploadError } = await supabase.storage
            .from('portfolio-assets')
            .upload(supabaseFileName, fileBuffer, {
                contentType: 'image/webp',
                upsert: false
            });

        if (uploadError) {
            throw new Error(`Upload failed: ${uploadError.message}`);
        }

        console.log('[Upload Script] Upload successful!');

        // Generate public URL
        const { data: publicUrlData } = supabase.storage
            .from('portfolio-assets')
            .getPublicUrl(supabaseFileName);

        const publicUrl = publicUrlData.publicUrl;
        console.log('[Upload Script] Public URL:', publicUrl);

        // Update database
        console.log('[Upload Script] Updating database...');

        const { error: updateError } = await supabase
            .from('news_items')
            .update({
                image_url: publicUrl,
                temp_path: null,
                uploaded_to_supabase: true
            })
            .eq('id', itemId);

        if (updateError) {
            throw new Error(`Database update failed: ${updateError.message}`);
        }

        console.log('[Upload Script] Database updated successfully');

        // Delete temp file
        console.log('[Upload Script] Deleting temp file...');
        try {
            fs.unlinkSync(fullPath);
            console.log('[Upload Script] Temp file deleted');
        } catch (unlinkError) {
            console.warn('[Upload Script] Warning: Failed to delete temp file:', unlinkError.message);
        }

        console.log('[Upload Script] ✓ Complete!');
        return { success: true, publicUrl };

    } catch (error) {
        console.error('[Upload Script] Error:', error.message);
        return { success: false, error: error.message };
    }
}

// Export for use in API route
module.exports = { uploadTempToSupabase };

// If run directly
if (require.main === module) {
    const args = process.argv.slice(2);
    if (args.length < 2) {
        console.log('Usage: node upload-temp-to-supabase.js <itemId> <tempPath>');
        console.log('Example: node upload-temp-to-supabase.js 123 "public/temp/file.webp"');
        process.exit(1);
    }

    const [itemId, tempPath] = args;
    uploadTempToSupabase(itemId, tempPath)
        .then(result => {
            console.log('\nFinal result:', result);
            process.exit(result.success ? 0 : 1);
        })
        .catch(error => {
            console.error('Fatal error:', error);
            process.exit(1);
        });
}