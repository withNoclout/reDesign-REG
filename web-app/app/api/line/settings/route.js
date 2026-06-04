import { error, success, unauthorized } from '@/lib/apiResponse';
import { getAuthUser } from '@/lib/auth';
import { getLineSettingsSummary } from '@/lib/lineSettingsService';

export const runtime = 'nodejs';

export async function GET() {
    const userCode = await getAuthUser();
    if (!userCode) return unauthorized();

    try {
        return success(await getLineSettingsSummary(String(userCode)));
    } catch (cause) {
        console.error('[api/line/settings] Failed to load LINE settings summary:', cause);
        return error('Failed to load LINE settings', 500, 'LINE_SETTINGS_FAILED');
    }
}
