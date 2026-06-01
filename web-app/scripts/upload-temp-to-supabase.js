const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });
const { createClient } = require('@supabase/supabase-js');

const BASE_DIR = path.join(__dirname, '..');
const TEMP_DIR = path.join(BASE_DIR, 'public', 'temp');

function resolveTempFilePath(tempPath) {
    const normalizedInput = String(tempPath || '').trim();
    if (!normalizedInput) {
        throw new Error('Missing temp_path in database record');
    }

    const fullPath = path.isAbsolute(normalizedInput)
        ? path.resolve(normalizedInput)
        : path.resolve(BASE_DIR, normalizedInput);

    const relativeToTempDir = path.relative(TEMP_DIR, fullPath);
    if (relativeToTempDir.startsWith('..') || path.isAbsolute(relativeToTempDir)) {
        throw new Error('Temp path escapes the allowed upload staging directory');
    }

    return fullPath;
}

function getSupabaseClient() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const authKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !authKey) {
        throw new Error('Missing Supabase credentials');
    }

    return createClient(supabaseUrl, authKey);
}

async function uploadTempToSupabase(itemId) {
    try {
        console.log(`[Upload Script] Starting upload for item ${itemId}...`);

        const supabase = getSupabaseClient();
        const { data: item, error: fetchError } = await supabase
            .from('news_items')
            .select('id, temp_path, uploaded_to_supabase, image_url')
            .eq('id', itemId)
            .single();

        if (fetchError || !item) {
            throw new Error(`Failed to load item ${itemId}: ${fetchError?.message || 'Not found'}`);
        }

        if (item.uploaded_to_supabase && !item.temp_path) {
            console.log('[Upload Script] Item already uploaded');
            return { success: true, publicUrl: item.image_url || null };
        }

        const fullPath = resolveTempFilePath(item.temp_path);
        console.log(`[Upload Script] Resolved temp path: ${fullPath}`);

        if (!fs.existsSync(fullPath)) {
            throw new Error(`Temp file not found: ${fullPath}`);
        }

        const fileBuffer = fs.readFileSync(fullPath);
        console.log(`[Upload Script] File size: ${fileBuffer.length} bytes`);

        const supabaseFileName = `portfolio/${Date.now()}_${item.id}_${path.basename(fullPath)}`;
        console.log('[Upload Script] Uploading to Supabase Storage...');

        const { error: uploadError } = await supabase.storage
            .from('portfolio-assets')
            .upload(supabaseFileName, fileBuffer, {
                contentType: 'image/webp',
                upsert: false
            });

        if (uploadError) {
            throw new Error(`Upload failed: ${uploadError.message}`);
        }

        const { data: publicUrlData } = supabase.storage
            .from('portfolio-assets')
            .getPublicUrl(supabaseFileName);

        const publicUrl = publicUrlData.publicUrl;

        const { error: updateError } = await supabase
            .from('news_items')
            .update({
                image_url: publicUrl,
                temp_path: null,
                uploaded_to_supabase: true
            })
            .eq('id', item.id);

        if (updateError) {
            throw new Error(`Database update failed: ${updateError.message}`);
        }

        try {
            fs.unlinkSync(fullPath);
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

module.exports = { uploadTempToSupabase };

if (require.main === module) {
    const args = process.argv.slice(2);
    if (args.length < 1) {
        console.log('Usage: node upload-temp-to-supabase.js <itemId>');
        process.exit(1);
    }

    const [itemId] = args;
    uploadTempToSupabase(itemId)
        .then(result => {
            console.log('\nFinal result:', result);
            process.exit(result.success ? 0 : 1);
        })
        .catch(error => {
            console.error('Unhandled error:', error);
            process.exit(1);
        });
}