
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import axios from 'axios';
import { getServiceSupabase } from '@/lib/supabase';

// Mock data for when Supabase is not connected
const MOCK_NEWS = [
    {
        id: 1,
        title: 'ยินดีต้อนรับสู่ระบบใหม่',
        description: 'เว็บไซต์นี้ได้รับการออกแบบใหม่เพื่อความทันสมัยและใช้งานง่ายขึ้น',
        image_url: null,
        created_at: new Date().toISOString()
    },
    {
        id: 2,
        title: 'กำหนดการลงทะเบียน 2/2567',
        description: 'นักศึกษาสามารถตรวจสอบกำหนดการลงทะเบียนได้ที่เมนู "ตารางเรียน/สอบ"',
        image_url: null,
        created_at: new Date(Date.now() - 86400000).toISOString()
    }
];

const ADMIN_USER_ID = 's6701091611290';
const BASE_URL = 'https://reg4.kmutnb.ac.th/regapiweb2/api/th';

export async function GET() {
    try {
        // Try to fetch from Supabase
        try {
            const supabase = getServiceSupabase();
            const { data, error } = await supabase
                .from('news_items')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;

            return NextResponse.json({ success: true, data: data });
        } catch (dbError) {
            console.warn('[API] Supabase fetch failed:', dbError.message);
            return NextResponse.json(
                { success: false, message: 'Database connection failed' },
                { status: 503 }
            );
        }
    } catch (error) {
        return NextResponse.json(
            { success: false, message: 'Failed to fetch news' },
            { status: 500 }
        );
    }
}

export async function POST(request) {
    try {
        // 1. Check Authentication (Admin Only)
        const cookieStore = await cookies();
        const token = cookieStore.get('reg_token')?.value;

        if (!token) {
            return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
        }

        // Validate with Real API
        try {
            const authRes = await axios.get(`${BASE_URL}/Schg/Getacadstd`, {
                headers: { 'Authorization': `Bearer ${token}` },
                validateStatus: status => status < 500
            });

            if (authRes.status !== 200 || !authRes.data) {
                return NextResponse.json({ success: false, message: 'Invalid Session' }, { status: 401 });
            }

            // Check Admin ID
            // The API returns student profile directly? Or a list? app/api/student/info assumes it returns data directly?
            // Actually usually Getacadstd returns object. Let's assume it has usercode/student code.
            // Based on previous logs or code: usercode is in the response.
            // Let's safe check keys.
            const userCode = authRes.data.studentCode || authRes.data.usercode || authRes.data.studentId;

            // Debug log if needed (commented out)
            // console.log('Admin Check:', userCode);

            if (String(userCode) !== ADMIN_USER_ID) {
                return NextResponse.json({ success: false, message: 'Forbidden: Admin only' }, { status: 403 });
            }

        } catch (authErr) {
            console.error('[API] Auth validation failed:', authErr.message);
            return NextResponse.json({ success: false, message: 'Auth Validation Failed' }, { status: 500 });
        }

        // 2. Parse Data
        const formData = await request.formData();
        const title = formData.get('title');
        const description = formData.get('description');
        const image = formData.get('image');

        if (!title || !description) {
            return NextResponse.json({ success: false, message: 'Missing title or description' }, { status: 400 });
        }

        // 3. Upload to Supabase
        try {
            const supabase = getServiceSupabase();
            let imageUrl = null;

            if (image && image.size > 0) {
                // Upload Image
                const fileExt = image.name.split('.').pop();
                const fileName = `news/${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;

                // Convert File to ArrayBuffer for Supabase upload
                const arrayBuffer = await image.arrayBuffer();
                const fileBuffer = Buffer.from(arrayBuffer);

                const { data: uploadData, error: uploadError } = await supabase
                    .storage
                    .from('portfolio-assets')
                    .upload(fileName, fileBuffer, {
                        contentType: image.type,
                        upsert: false
                    });

                if (uploadError) throw uploadError;

                // Get Public URL
                const { data: publicUrlData } = supabase
                    .storage
                    .from('portfolio-assets')
                    .getPublicUrl(fileName);

                imageUrl = publicUrlData.publicUrl;
            }

            // 4. Insert Record
            const { data: insertData, error: insertError } = await supabase
                .from('news_items')
                .insert([{
                    title,
                    description,
                    image_url: imageUrl,
                    created_by: ADMIN_USER_ID
                }])
                .select();

            if (insertError) throw insertError;

            return NextResponse.json({ success: true, data: insertData });

        } catch (supabaseErr) {
            console.error('[API] Supabase operation failed:', supabaseErr.message);

            if (supabaseErr.message.includes('Missing Supabase Service Key')) {
                return NextResponse.json({
                    success: false,
                    message: 'Supabase Not Configured. Please provide credentials.'
                }, { status: 503 });
            }

            return NextResponse.json({ success: false, message: 'Database Error: ' + supabaseErr.message }, { status: 500 });
        }

    } catch (error) {
        console.error('[API] News POST error:', error);
        return NextResponse.json({ success: false, message: 'Internal Server Error' }, { status: 500 });
    }
}
