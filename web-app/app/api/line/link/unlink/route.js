import { error, success, unauthorized } from '@/lib/apiResponse';
import { getAuthUser } from '@/lib/auth';
import { unlinkLineAccount } from '@/lib/lineSettingsService';

export const runtime = 'nodejs';

export async function POST() {
    const userCode = await getAuthUser();
    if (!userCode) return unauthorized();

    try {
        return success(await unlinkLineAccount(String(userCode)));
    } catch (cause) {
        console.error('[api/line/link/unlink] Failed to unlink LINE account:', cause);
        return error('Failed to unlink LINE account', 500, 'LINE_UNLINK_FAILED');
    }
}
