import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { getServiceSupabase } from '@/lib/supabase';

const STORAGE_BUCKET = 'profile-images';

export async function POST(request) {
    try {
        const { image, reset } = await request.json();
        let usercodeRaw = await getAuthUser();
        const supabase = getServiceSupabase();

        if (!usercodeRaw) {
            return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
        }

        // Normalize student code (remove 's' prefix)
        const usercode = usercodeRaw.startsWith('s') ? usercodeRaw.substring(1) : usercodeRaw;

        if (reset) {
            const now = new Date().toISOString();

            // Clear from Supabase verifications table
            const { error: verificationError } = await supabase
                .from('user_verifications')
                .upsert({
                    user_code: String(usercode),
                    profile_image_url: null,
                    updated_at: now
                }, { onConflict: 'user_code' });

            if (verificationError) {
                return NextResponse.json({ success: false, message: 'Failed to reset profile image: ' + verificationError.message }, { status: 500 });
            }

            // Also clear from user_directory
            await supabase
                .from('user_directory')
                .upsert({
                    user_code: String(usercode),
                    avatar_url: null,
                    last_login: now
                }, { onConflict: 'user_code' });

            // AND update the new students table (reset custom image flag)
            // Note: In a real scenario, we'd need to fetch the university image again. 
            // For now, setting is_custom_image=0 will tell the next login to fetch it.
            // If they don't log out, the local session needs to handle the fallback gracefully.
            await supabase
                .from('students')
                .update({ is_custom_image: 0 })
                .eq('usercode', String(usercode));

            return NextResponse.json({ success: true, path: null, message: 'Profile image reset successfully' });
        }

        if (!image) {
            return NextResponse.json({ success: false, message: 'Missing image' }, { status: 400 });
        }

        // Validate base64 payload size (~5MB image = ~6.6MB base64)
        const MAX_BASE64_LENGTH = 7 * 1024 * 1024;
        if (image.length > MAX_BASE64_LENGTH) {
            return NextResponse.json(
                { success: false, message: 'Image file too large (max 5MB)' },
                { status: 413 }
            );
        }

        // Remove data URI header, convert to buffer
        const base64Data = image.replace(/^data:image\/\w+;base64,/, '');
        const buffer = Buffer.from(base64Data, 'base64');
        const fileName = `${usercode}.jpg`;

        // Upload to Supabase Storage (upsert: overwrite if exists)
        const { error: storageError } = await supabase.storage
            .from(STORAGE_BUCKET)
            .upload(fileName, buffer, {
                contentType: 'image/jpeg',
                upsert: true,
            });

        if (storageError) {
            console.error('[Upload] Supabase Storage error:', storageError.message);
            return NextResponse.json({ success: false, message: 'Failed to upload to storage: ' + storageError.message }, { status: 500 });
        }

        // Get the public URL (no expiry, pure CDN URL)
        const { data: pubData } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(fileName);
        const publicUrl = pubData.publicUrl;

        const now = new Date().toISOString();

        // Persist URL to user_verifications table
        const { error: upsertError } = await supabase
            .from('user_verifications')
            .upsert({
                user_code: String(usercode),
                profile_image_url: publicUrl,
                updated_at: now
            }, { onConflict: 'user_code' });

        if (upsertError) {
            return NextResponse.json({ success: false, message: 'Failed to persist profile image URL: ' + upsertError.message }, { status: 500 });
        }

        // Also sync to user_directory
        await supabase
            .from('user_directory')
            .upsert({
                user_code: String(usercode),
                avatar_url: publicUrl,
                last_login: now
            }, { onConflict: 'user_code' });

        // AND update the new students table
        await supabase
            .from('students')
            .update({
                profile_image_url: publicUrl,
                is_custom_image: 1,
                updated_at: now
            })
            .eq('usercode', String(usercode));

        return NextResponse.json({
            success: true,
            path: publicUrl,
            message: 'Image uploaded to Supabase Storage successfully'
        });

    } catch (error) {
        console.error('[Upload] Error:', error);
        return NextResponse.json({ success: false, message: 'Upload failed: ' + error.message }, { status: 500 });
    }
}
