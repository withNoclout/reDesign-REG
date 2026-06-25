import { error, success, unauthorized } from '@/lib/apiResponse';
import { getAuthUser } from '@/lib/auth';
import { disconnectInstagramPoc } from '@/lib/instagramPocService';

export const runtime = 'nodejs';

export async function POST() {
    const userCode = await getAuthUser();
    if (!userCode) return unauthorized();

    try {
        const result = await disconnectInstagramPoc(String(userCode));
        return success({ disconnected: true, connection: result.connection || null });
    } catch (cause) {
        console.error('[api/instagram/link/unlink] Failed to unlink Instagram profile:', cause);
        return error('Failed to unlink Instagram profile', 500, 'INSTAGRAM_UNLINK_FAILED');
    }
}
