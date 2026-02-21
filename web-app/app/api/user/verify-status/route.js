import { NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';
import { getAuthUser } from '@/lib/auth';

export async function GET() {
    try {
        const userId = await getAuthUser();
        if (!userId) {
            return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
        }

        const supabase = getServiceSupabase();

        // Attempt to get the email_verified_at field
        const { data, error } = await supabase
            .from('user_settings')
            .select('email_verified_at')
            .eq('user_id', String(userId))
            .single();

        if (error && error.code !== 'PGRST116') {
            console.error('[Verify Status GET] Error:', error.message);
            return NextResponse.json({ success: false, message: error.message }, { status: 500 });
        }

        return NextResponse.json({
            success: true,
            is_verified: !!data?.email_verified_at
        });

    } catch (error) {
        console.error('[Verify Status GET] Exception:', error.message);
        return NextResponse.json({ success: false, message: error.message }, { status: 500 });
    }
}

export async function POST(request) {
    try {
        const userId = await getAuthUser();
        if (!userId) {
            return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
        }

        const supabase = getServiceSupabase();

        // Upsert the user_settings record with the current timestamp
        const { error } = await supabase
            .from('user_settings')
            .upsert({
                user_id: String(userId),
                email_verified_at: new Date().toISOString()
            }, { onConflict: 'user_id' });

        if (error) {
            console.error('[Verify Status POST] Upsert failed:', error.message);
            return NextResponse.json({ success: false, message: 'Failed to update verification status' }, { status: 500 });
        }

        return NextResponse.json({ success: true, is_verified: true });

    } catch (error) {
        console.error('[Verify Status POST] Exception:', error.message);
        return NextResponse.json({ success: false, message: error.message }, { status: 500 });
    }
}
