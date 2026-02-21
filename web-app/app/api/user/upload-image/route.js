import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { getAuthUser } from '@/lib/auth';
import { getServiceSupabase } from '@/lib/supabase';

export async function POST(request) {
    try {
        const { image, reset } = await request.json();
        const usercode = await getAuthUser();
        const supabase = getServiceSupabase();

        if (!usercode) {
            return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
        }

        if (reset) {
            const now = new Date().toISOString();
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

            await supabase
                .from('user_directory')
                .upsert({
                    user_code: String(usercode),
                    avatar_url: null,
                    last_login: now
                }, { onConflict: 'user_code' });

            return NextResponse.json({ success: true, path: null, message: 'Profile image reset successfully' });
        }

        if (!image) {
            return NextResponse.json({ success: false, message: 'Missing image' }, { status: 400 });
        }

        // Validate base64 payload size (approx 5MB image = ~6.6MB base64)
        const MAX_BASE64_LENGTH = 7 * 1024 * 1024; // 7MB max payload
        if (image.length > MAX_BASE64_LENGTH) {
            return NextResponse.json(
                { success: false, message: 'Image file too large (max 5MB)' },
                { status: 413 }
            );
        }

        // Remove header "data:image/jpeg;base64,"
        const base64Data = image.replace(/^data:image\/\w+;base64,/, "");
        const buffer = Buffer.from(base64Data, 'base64');

        // Create uploads dir if not exists
        const uploadDir = path.join(process.cwd(), 'public', 'uploads');
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }

        const fileName = `profile_${usercode}.jpg`;
        const filePath = path.join(uploadDir, fileName);
        const imagePath = `/uploads/${fileName}`;
        const versionedImagePath = `${imagePath}?v=${Date.now()}`;

        fs.writeFileSync(filePath, buffer);
        const now = new Date().toISOString();
        const { error } = await supabase
            .from('user_verifications')
            .upsert({
                user_code: String(usercode),
                profile_image_url: versionedImagePath,
                updated_at: now
            }, { onConflict: 'user_code' });

        if (error) {
            return NextResponse.json({ success: false, message: 'Failed to persist profile image: ' + error.message }, { status: 500 });
        }

        await supabase
            .from('user_directory')
            .upsert({
                user_code: String(usercode),
                avatar_url: versionedImagePath,
                last_login: now
            }, { onConflict: 'user_code' });

        return NextResponse.json({
            success: true,
            path: versionedImagePath,
            message: 'Image uploaded successfully'
        });

    } catch (error) {
        console.error('Upload error:', error);
        return NextResponse.json({ success: false, message: 'Upload failed' }, { status: 500 });
    }
}
