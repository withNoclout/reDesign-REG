
import { NextResponse } from 'next/server';
import { getServiceSupabase } from '../../../lib/supabase';
import { getAuthUser } from '@/lib/auth';

export async function GET() {
    try {
        const userId = await getAuthUser();
        if (!userId) {
            return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
        }

        const supabase = getServiceSupabase();
        const { data, error } = await supabase
            .from('user_settings')
            .select('portfolio_config')
            .eq('user_id', userId)
            .single();

        if (error && error.code !== 'PGRST116') { // PGRST116 is "Results contain 0 rows"
            console.error('Error fetching settings:', error);
            throw error;
        }

        // Return default if no settings
        return NextResponse.json({
            success: true,
            config: data?.portfolio_config || { columnCount: 3, gapSize: 'normal' }
        });
    } catch (error) {
        return NextResponse.json({ success: false, message: error.message }, { status: 500 });
    }
}

export async function POST(request) {
    try {
        const userId = await getAuthUser();
        if (!userId) {
            return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        const { config } = body;

        if (!config) {
            return NextResponse.json({ success: false, message: 'Config is required' }, { status: 400 });
        }

        const supabase = getServiceSupabase();

        // Upsert settings
        const { error } = await supabase
            .from('user_settings')
            .upsert({
                user_id: userId,
                portfolio_config: config,
                updated_at: new Date().toISOString()
            }, { onConflict: 'user_id' });

        if (error) throw error;

        return NextResponse.json({ success: true });
    } catch (error) {
        return NextResponse.json({ success: false, message: error.message }, { status: 500 });
    }
}
