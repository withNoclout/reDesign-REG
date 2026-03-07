import { getServiceSupabase } from './supabase';
import { v4 as uuidv4 } from 'uuid';
// Note: In a real production environment, you might want to use 'sharp' here 
// to compress and convert images to WebP before uploading to save massive costs.
// For now, we will handle basic buffered uploads.

/**
 * Uploads an image buffer to a Supabase Storage bucket.
 * 
 * @param {string} bucketName - 'avatars' or 'portfolios'
 * @param {Buffer} fileBuffer - The image file buffer.
 * @param {string} mimeType - e.g., 'image/jpeg', 'image/png'
 * @param {string} [customPath] - Optional custom path, otherwise a UUID is used.
 * @returns {Promise<string|null>} The public URL of the uploaded image, or null on failure.
 */
export async function uploadImage(bucketName, fileBuffer, mimeType, customPath = null) {
    if (!fileBuffer) return null;

    try {
        const supabase = getServiceSupabase();

        // Use provided path or generate a random UUID
        const filePath = customPath || `${uuidv4()}.${mimeType.split('/')[1] || 'jpg'}`;

        const { data, error } = await supabase.storage
            .from(bucketName)
            .upload(filePath, fileBuffer, {
                contentType: mimeType,
                upsert: true, // Overwrite if same name (useful for avatars)
                cacheControl: '3600'
            });

        if (error) {
            console.error(`[Supabase Storage] Upload failed for bucket ${bucketName}:`, error.message);
            return null;
        }

        // Return the public URL
        const { data: publicUrlData } = supabase.storage
            .from(bucketName)
            .getPublicUrl(filePath);

        return publicUrlData.publicUrl;

    } catch (err) {
        console.error(`[Supabase Storage] Critical Upload Failure:`, err.message);
        return null;
    }
}
