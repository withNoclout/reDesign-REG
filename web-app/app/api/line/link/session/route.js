import { error, rateLimited, success, unauthorized } from '@/lib/apiResponse';
import { getAuthUser } from '@/lib/auth';
import { createLinePairingSession } from '@/lib/lineSettingsService';
import { createRateLimiter, getClientIp } from '@/lib/rateLimit';

const linePairingSessionLimiter = createRateLimiter({
    namespace: 'line-link-session',
    maxAttempts: 5,
    windowMs: 10 * 60 * 1000,
});

export const runtime = 'nodejs';

export async function POST(request) {
    const userCode = await getAuthUser();
    if (!userCode) return unauthorized();

    const limiterKey = `${userCode}:${getClientIp(request)}`;
    const limit = linePairingSessionLimiter.check(limiterKey);
    if (!limit.allowed) return rateLimited(limit.retryAfterMs);

    try {
        const session = await createLinePairingSession(String(userCode));
        linePairingSessionLimiter.increment(limiterKey);
        return success(session);
    } catch (cause) {
        if (cause?.code === 'LINE_WEBHOOK_NOT_READY') {
            return error(cause.message, 503, cause.code);
        }

        console.error('[api/line/link/session] Failed to create LINE pairing session:', cause);
        return error('Failed to create LINE pairing session', 500, 'LINE_LINK_SESSION_FAILED');
    }
}
