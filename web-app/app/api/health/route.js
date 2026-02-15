import { NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';

export async function GET() {
    const health = {
        server: 'ok',
        database: 'unknown',
        timestamp: new Date().toISOString()
    };

    try {
        const supabase = getServiceSupabase();
        const { error } = await supabase.from('news_items').select('count', { count: 'exact', head: true });

        if (error) {
            health.database = 'error';
            health.dbError = error.message;
        } else {
            health.database = 'connected';
        }
    } catch (e) {
        health.database = 'error';
        health.dbError = e.message;
    }

    return NextResponse.json(health, { status: health.database === 'connected' ? 200 : 503 });
}
