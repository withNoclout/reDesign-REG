import { NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';

// Cache health check result for 15 seconds
let _healthCache = null;
let _healthCacheTime = 0;
const HEALTH_CACHE_TTL = 15_000;

export async function GET() {
    const now = Date.now();

    // Return cached result if fresh
    if (_healthCache && now - _healthCacheTime < HEALTH_CACHE_TTL) {
        return NextResponse.json(
            { ..._healthCache, timestamp: new Date().toISOString(), cached: true },
            { status: _healthCache.database === 'connected' ? 200 : 503 }
        );
    }

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

    // Cache the result
    _healthCache = { server: health.server, database: health.database };
    _healthCacheTime = now;

    return NextResponse.json(health, { status: health.database === 'connected' ? 200 : 503 });
}
