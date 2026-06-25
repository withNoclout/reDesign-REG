
import { NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';
import { getAuthUser } from '@/lib/auth';
import { PORTFOLIO_CONFIG_DEFAULTS, mergePortfolioConfigPreservingStudentLoan } from '@/lib/studentLoanSettings';

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
            .eq('user_id', String(userId))
            .single();

        if (error && error.code !== 'PGRST116') {
            console.warn('Settings fetch error (returning defaults):', error.message);
        }

        return NextResponse.json({
            success: true,
            config: data?.portfolio_config || PORTFOLIO_CONFIG_DEFAULTS
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
        const { data: existingRow, error: fetchError } = await supabase
            .from('user_settings')
            .select('portfolio_config')
            .eq('user_id', String(userId))
            .single();

        if (fetchError && fetchError.code !== 'PGRST116') {
            console.error('[Settings] Existing config fetch failed:', fetchError.message);
            return NextResponse.json({ success: false, message: 'Failed to load existing settings: ' + fetchError.message }, { status: 500 });
        }

        const mergedConfig = mergePortfolioConfigPreservingStudentLoan(existingRow?.portfolio_config, config);
        const { error } = await supabase
            .from('user_settings')
            .upsert({
                user_id: String(userId),
                portfolio_config: mergedConfig,
                updated_at: new Date().toISOString()
            }, { onConflict: 'user_id' });

        if (error) {
            console.error('[Settings] Save failed:', error.message);
            return NextResponse.json({ success: false, message: 'Failed to save settings: ' + error.message }, { status: 500 });
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        return NextResponse.json({ success: false, message: error.message }, { status: 500 });
    }
}
