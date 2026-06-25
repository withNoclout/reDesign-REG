import { getServiceSupabase } from './supabase.js';

export async function listPendingPortfolioCollaboratorTags(userCode) {
    const normalizedUserCode = String(userCode || '').trim();
    if (!normalizedUserCode) return [];

    const userCodes = [normalizedUserCode, `s${normalizedUserCode}`];
    const supabase = getServiceSupabase();

    const { data: pending, error: pendingError } = await supabase
        .from('portfolio_collaborators')
        .select('id, portfolio_id, added_by, created_at')
        .in('student_code', userCodes)
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
        .limit(50);

    if (pendingError) {
        throw new Error(`Failed to fetch pending collaborator tags: ${pendingError.message}`);
    }

    if (!pending || pending.length === 0) return [];

    const portfolioIds = pending.map((item) => item.portfolio_id);
    const adderCodes = [...new Set(pending.map((item) => item.added_by))];

    const [{ data: portfolios }, { data: adders }] = await Promise.all([
        supabase
            .from('news_items')
            .select('id, topic, description, image_url')
            .in('id', portfolioIds),
        supabase
            .from('user_directory')
            .select('user_code, name_th, name_en')
            .in('user_code', adderCodes),
    ]);

    const portfolioMap = Object.fromEntries((portfolios || []).map((item) => [item.id, item]));
    const adderMap = Object.fromEntries((adders || []).map((item) => [item.user_code, item]));

    return pending.map((tag) => ({
        ...tag,
        portfolio: portfolioMap[tag.portfolio_id] || null,
        added_by_info: adderMap[tag.added_by] || { user_code: tag.added_by },
    }));
}
