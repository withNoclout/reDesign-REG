import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getServiceSupabase } from '@/lib/supabase';
import { encryptPassword } from '@/lib/cryptoUtils';

export async function GET() {
    try {
        const cookieStore = await cookies();
        const stdCode = cookieStore.get('std_code')?.value;

        if (!stdCode) {
            return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
        }

        const supabase = getServiceSupabase();
        const { data, error } = await supabase
            .from('user_credentials')
            .select('is_auto_eval_enabled')
            .eq('user_code', stdCode)
            .single();

        if (error && error.code !== 'PGRST116') {
            console.error('[Eval Settings API] Supabase fetch error:', error);
            // Ignore no row found (user never saved before)
        }

        return NextResponse.json({
            success: true,
            is_auto_eval_enabled: data?.is_auto_eval_enabled || false
        });

    } catch (error) {
        console.error('[Eval Settings API] Error:', error.message);
        return NextResponse.json({ success: false, message: 'Internal Server Error' }, { status: 500 });
    }
}

export async function POST(request) {
    try {
        const cookieStore = await cookies();
        const stdCode = cookieStore.get('std_code')?.value;

        if (!stdCode) {
            return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
        }

        const { is_auto_eval_enabled } = await request.json();

        const supabase = getServiceSupabase();

        // Now we ONLY update the toggle flag, avoiding any modification or nullification of the credentials.
        // The creds are already captured and maintained cleanly via the login process (`/api/auth/login`).
        const { error } = await supabase.from('user_credentials').upsert({
            user_code: stdCode,
            is_auto_eval_enabled: is_auto_eval_enabled === true,
            updated_at: new Date().toISOString()
        }, { onConflict: 'user_code' });

        if (error) throw error;

        return NextResponse.json({ success: true, message: 'บันทึกการตั้งค่าเรียบร้อย' });

    } catch (error) {
        console.error('[Eval Settings API] Error:', error.message);
        return NextResponse.json({ success: false, message: 'Internal Server Error', detail: error.message }, { status: 500 });
    }
}
