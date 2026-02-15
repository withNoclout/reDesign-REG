
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import axios from 'axios';
import sharp from 'sharp';
import fs from 'fs/promises';
import path from 'path';
import { getServiceSupabase } from '@/lib/supabase';
import { getAuthUser } from '@/lib/auth';

const BASE_URL = 'https://reg4.kmutnb.ac.th/regapiweb2/api/th';

// BASE_DIR: Root directory for web-app (consistent across all upload-related files)
const BASE_DIR = process.cwd(); // = web-app/
console.log('[Portfolio API] BASE_DIR:', BASE_DIR);

export async function GET() {
    try {
        const userId = await getAuthUser();
        // Allow public read? Or restricted?
        // User asked for "Personal Portfolio". So maybe only see own?
        // But usually portfolio is for others to see?
        // Let's stick to: "If logged in, see own. If guest...?"
        // Previous logic was "See Own".

        if (!userId) {
            return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
        }

        const supabase = getServiceSupabase();

        // Fetch USER'S items only
        const { data, error } = await supabase
            .from('news_items')
            .select('*')
            .eq('created_by', String(userId))
            .order('created_at', { ascending: false });

        if (error) throw error;

        return NextResponse.json({ success: true, data: data });
    } catch (error) {
        return NextResponse.json(
            { success: false, message: 'Failed to fetch portfolio: ' + error.message },
            { status: 500 }
        );
    }
}

export async function POST(request) {
    try {
        let userId;

        if (process.env.MOCK_AUTH === 'true') {
            const mockId = '00000000-0000-0000-0000-000000000067';
            console.log('[Portfolio API] Mock Auth Enabled. User ID:', mockId);
            userId = mockId;
        } else {
            // 1. Check Auth
            console.log('[Portfolio API] Checking Auth...');
            userId = await getAuthUser();
        }

        console.log('[Portfolio API] Auth Result:', userId);

        if (!userId) {
            console.warn('[Portfolio API] Unauthorized access attempt');
            return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
        }

        let formData;
        try {
            formData = await request.formData();
        } catch (e) {
            console.error('[Portfolio API] Failed to parse FormData:', e);
            return NextResponse.json({ success: false, message: 'Failed to parse body as FormData: ' + e.message }, { status: 400 });
        }

        const title = formData.get('title') || 'Untitled';
        const description = formData.get('description');
        const image = formData.get('image');

        console.log(`[Portfolio API] Received request. Desc length: ${description?.length}, Image size: ${image?.size}`);

        if (!description) {
            return NextResponse.json({ success: false, message: 'Description is required' }, { status: 400 });
        }

        // 2. Process Image - Save to temp
        let tempFilePath = null;
        if (image && image.size > 0) {
            console.log('[Portfolio API] Processing image...');

            try {
                const buffer = Buffer.from(await image.arrayBuffer());

                // Validate image file type
                if (!image.type.startsWith('image/')) {
                    return NextResponse.json(
                        { success: false, message: 'Invalid file type. Please upload an image.' },
                        { status: 400 }
                    );
                }

                // Check for supported formats
                const supportedFormats = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
                if (!supportedFormats.includes(image.type)) {
                    return NextResponse.json(
                        { success: false, message: 'Unsupported image format. Please use JPEG, PNG, or WebP.' },
                        { status: 400 }
                    );
                }

                // Optimize with Sharp
                const optimizedBuffer = await sharp(buffer)
                    .resize(1000, 1000, {
                        fit: 'inside',
                        withoutEnlargement: true
                    }) // Max 1000px
                    .webp({ quality: 80 })
                    .toBuffer();

                console.log('[Portfolio API] Image optimized. Saving to temp...');

                // Generate unique filename
                const tempFileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.webp`;

                // Ensure temp directory exists using BASE_DIR
                const tempDir = path.join(BASE_DIR, 'public', 'temp');
                await fs.mkdir(tempDir, { recursive: true });

                // Store ABSOLUTE path using BASE_DIR for consistency
                tempFilePath = path.join(BASE_DIR, 'public', 'temp', tempFileName);

                console.log('[Portfolio API] Temp file path (absolute):', tempFilePath);
                console.log('[Portfolio API] Temp filename:', tempFileName);

                // Save to temp directory (tempFilePath is already absolute)
                const fullPath = tempFilePath;

                await fs.writeFile(fullPath, optimizedBuffer);
                console.log('[Portfolio API] Temp file saved:', tempFilePath);
            } catch (sharpError) {
                console.error('[Portfolio API] Sharp processing error:', sharpError);
                return NextResponse.json(
                    { success: false, message: 'Failed to process image: ' + sharpError.message },
                    { status: 500 }
                );
            }
        }

        // 3. Save to DB with temp file path
        console.log('[Portfolio API] Saving to Database...');
        const supabase = getServiceSupabase();
        const { data, error } = await supabase
            .from('news_items')
            .insert([{
                title,
                description,
                image_url: tempFilePath, // Store temp path for now
                temp_path: tempFilePath, // Additional field for upload script
                uploaded_to_supabase: false, // Flag to track upload status
                created_by: String(userId)
            }])
            .select();

        if (error) {
            console.error('[Portfolio API] DB Insert Error:', error);
            throw new Error('Database Insert Failed: ' + error.message);
        }

        console.log('[Portfolio API] Success!');
        return NextResponse.json({ success: true, data: data });

    } catch (error) {
        console.error('Portfolio POST error:', error);
        return NextResponse.json({ success: false, message: error.message }, { status: 500 });
    }
}

export async function PATCH(request) {
    try {
        const userId = await getAuthUser();
        if (!userId) {
            return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        const { id, is_visible } = body;

        if (!id) {
            return NextResponse.json({ success: false, message: 'ID is required' }, { status: 400 });
        }

        const supabase = getServiceSupabase();

        // Verify ownership
        const { data: item, error: fetchError } = await supabase
            .from('news_items')
            .select('created_by')
            .eq('id', id)
            .single();

        if (fetchError || !item) {
            return NextResponse.json({ success: false, message: 'Item not found' }, { status: 404 });
        }

        if (item.created_by !== String(userId)) {
            return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 403 });
        }

        // Update
        const { error } = await supabase
            .from('news_items')
            .update({ is_visible })
            .eq('id', id);

        if (error) throw error;

        return NextResponse.json({ success: true });
    } catch (error) {
        return NextResponse.json({ success: false, message: error.message }, { status: 500 });
    }
}

export async function DELETE(request) {
    try {
        // Parse ID from URL query params or body? Standard is usually URL path but here we are in same route file.
        // Let's use searchParams since it's cleaner for DELETE without body in some clients, 
        // OR use body. Let's support body for consistency with PATCH, or searchParams.
        // Let's use searchParams.
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');

        const userId = await getAuthUser();
        if (!userId) {
            return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
        }

        if (!id) {
            return NextResponse.json({ success: false, message: 'ID is required' }, { status: 400 });
        }

        const supabase = getServiceSupabase();

        // Verify ownership
        const { data: item, error: fetchError } = await supabase
            .from('news_items')
            .select('created_by, image_url')
            .eq('id', id)
            .single();

        if (fetchError || !item) {
            return NextResponse.json({ success: false, message: 'Item not found' }, { status: 404 });
        }

        if (item.created_by !== String(userId)) {
            return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 403 });
        }

        // Delete from DB
        const { error } = await supabase
            .from('news_items')
            .delete()
            .eq('id', id);

        if (error) throw error;

        // Optional: Delete file from storage if you want to be clean
        // But the image_url might be a temp path or a Supabase Storage path.
        // For now, let's just delete the DB record.

        return NextResponse.json({ success: true });
    } catch (error) {
        return NextResponse.json({ success: false, message: error.message }, { status: 500 });
    }
}
