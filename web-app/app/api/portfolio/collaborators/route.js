import { getAuthUser } from '@/lib/auth';
import { getServiceSupabase } from '@/lib/supabase';
import { success, error, unauthorized, validationError } from '@/lib/apiResponse';

/**
 * GET /api/portfolio/collaborators?portfolio_id=...&page=1&limit=20
 * List collaborators for a specific portfolio item.
 * Only the owner or accepted collaborators can view.
 */
export async function GET(request) {
    try {
        const userId = await getAuthUser();
        if (!userId) return unauthorized();

        const { searchParams } = new URL(request.url);
        const portfolioId = searchParams.get('portfolio_id');
        const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
        const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') || '20', 10)));

        if (!portfolioId) {
            return validationError('portfolio_id is required');
        }

        const supabase = getServiceSupabase();

        // Check access: user must be owner or accepted collaborator
        const { data: portfolio, error: portfolioErr } = await supabase
            .from('news_items')
            .select('id, created_by')
            .eq('id', portfolioId)
            .single();

        if (portfolioErr || !portfolio) {
            return error('Portfolio item not found', 404);
        }

        const isOwner = portfolio.created_by === userId;

        if (!isOwner) {
            // Check if user is an accepted collaborator
            const { data: collab } = await supabase
                .from('portfolio_collaborators')
                .select('id')
                .eq('portfolio_id', portfolioId)
                .eq('student_code', userId)
                .eq('status', 'accepted')
                .single();

            if (!collab) {
                return error('Access denied', 403);
            }
        }

        // Fetch collaborators with user directory info
        const offset = (page - 1) * limit;
        const { data: collaborators, error: collabErr, count } = await supabase
            .from('portfolio_collaborators')
            .select(`
                id,
                student_code,
                status,
                created_at,
                responded_at,
                user_directory!inner(name_th, name_en, avatar_url)
            `, { count: 'exact' })
            .eq('portfolio_id', portfolioId)
            .order('created_at', { ascending: false })
            .range(offset, offset + limit - 1);

        if (collabErr) {
            // Fallback: if join fails (user_directory might not have the record), query without join
            const { data: fallback, error: fallbackErr, count: fallbackCount } = await supabase
                .from('portfolio_collaborators')
                .select('id, student_code, status, created_at, responded_at', { count: 'exact' })
                .eq('portfolio_id', portfolioId)
                .order('created_at', { ascending: false })
                .range(offset, offset + limit - 1);

            if (fallbackErr) {
                console.error('[API] Collaborators list error:', fallbackErr.message);
                return error('Failed to fetch collaborators', 500);
            }

            return success({
                collaborators: fallback || [],
                pagination: {
                    page,
                    limit,
                    total: fallbackCount || 0,
                    totalPages: Math.ceil((fallbackCount || 0) / limit),
                },
            });
        }

        return success({
            collaborators: collaborators || [],
            pagination: {
                page,
                limit,
                total: count || 0,
                totalPages: Math.ceil((count || 0) / limit),
            },
        });
    } catch (err) {
        console.error('[API] Collaborators GET error:', err.message);
        return error('Internal server error', 500);
    }
}
