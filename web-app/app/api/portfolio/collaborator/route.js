import { getAuthUser } from '@/lib/auth';
import { getServiceSupabase } from '@/lib/supabase';
import { success, error, unauthorized, forbidden, validationError, notFound } from '@/lib/apiResponse';

/**
 * GET /api/portfolio/collaborator
 * Fetch pending collaboration tags for the current user.
 */
export async function GET() {
    try {
        const userId = await getAuthUser();
        if (!userId) return unauthorized();
        const userCodes = [String(userId), `s${String(userId)}`];

        const supabase = getServiceSupabase();

        // Fetch pending tags with portfolio info
        const { data: pending, error: pendingErr } = await supabase
            .from('portfolio_collaborators')
            .select('id, portfolio_id, added_by, created_at')
            .in('student_code', userCodes)
            .eq('status', 'pending')
            .order('created_at', { ascending: false })
            .limit(50);

        if (pendingErr) {
            console.error('[API] Pending tags fetch error:', pendingErr.message);
            return error('Failed to fetch pending tags', 500);
        }

        if (!pending || pending.length === 0) {
            return success({ tags: [] });
        }

        // Fetch portfolio details for these tags
        const portfolioIds = pending.map(p => p.portfolio_id);
        const { data: portfolios } = await supabase
            .from('news_items')
            .select('id, topic, description, image_url')
            .in('id', portfolioIds);

        const portfolioMap = Object.fromEntries(
            (portfolios || []).map(p => [p.id, p])
        );

        // Fetch adder names from user_directory
        const adderCodes = [...new Set(pending.map(p => p.added_by))];
        const { data: adders } = await supabase
            .from('user_directory')
            .select('user_code, name_th, name_en')
            .in('user_code', adderCodes);

        const adderMap = Object.fromEntries(
            (adders || []).map(a => [a.user_code, a])
        );

        const tags = pending.map(tag => ({
            ...tag,
            portfolio: portfolioMap[tag.portfolio_id] || null,
            added_by_info: adderMap[tag.added_by] || { user_code: tag.added_by },
        }));

        return success({ tags });
    } catch (err) {
        console.error('[API] Collaborator GET error:', err.message);
        return error('Internal server error', 500);
    }
}

/**
 * PATCH /api/portfolio/collaborator
 * Accept or reject a collaboration tag.
 * Only the tagged student can respond.
 */
export async function PATCH(request) {
    try {
        const userId = await getAuthUser();
        if (!userId) return unauthorized();
        const userCodes = [String(userId), `s${String(userId)}`];

        const body = await request.json();
        const { portfolio_id, action } = body;

        // Validate input
        if (!portfolio_id && portfolio_id !== 0) {
            return validationError('portfolio_id is required');
        }

        const portfolioIdNum = Number(portfolio_id);
        if (!Number.isFinite(portfolioIdNum)) {
            return validationError('portfolio_id must be a valid number');
        }

        if (!['accepted', 'rejected'].includes(action)) {
            return validationError('action must be "accepted" or "rejected"');
        }

        const supabase = getServiceSupabase();

        // Verify the collaboration exists and belongs to this user
        const { data: existing, error: findErr } = await supabase
            .from('portfolio_collaborators')
            .select('id, student_code, status')
            .eq('portfolio_id', portfolioIdNum)
            .in('student_code', userCodes)
            .single();

        if (findErr || !existing) {
            return notFound('Collaboration not found');
        }

        if (!userCodes.includes(existing.student_code)) {
            return forbidden('You can only respond to your own tags');
        }

        // Update status
        const { error: updateErr } = await supabase
            .from('portfolio_collaborators')
            .update({
                status: action,
                responded_at: new Date().toISOString(),
            })
            .eq('portfolio_id', portfolioIdNum)
            .in('student_code', userCodes);

        if (updateErr) {
            console.error('[API] Collaborator update error:', updateErr.message);
            return error('Failed to update collaboration status', 500);
        }

        return success({ status: action });
    } catch (err) {
        console.error('[API] Collaborator PATCH error:', err.message);
        return error('Internal server error', 500);
    }
}
