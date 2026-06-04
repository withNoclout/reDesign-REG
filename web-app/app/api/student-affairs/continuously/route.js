import { error, success } from '@/lib/apiResponse';
import { getStudentAffairsContinuouslyFeed } from '@/lib/studentAffairsFeed';

export async function GET() {
    try {
        const feed = await getStudentAffairsContinuouslyFeed();
        return success(feed);
    } catch (cause) {
        console.error('[api/student-affairs/continuously] Failed to load feed:', cause);
        return error('Failed to load student affairs updates', 502, 'UPSTREAM_FETCH_FAILED');
    }
}
