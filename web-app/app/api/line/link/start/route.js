import { error, rateLimited, success, unauthorized, validationError } from '@/lib/apiResponse';
import { getAuthUser } from '@/lib/auth';
import { getMissingLineMessagingConfig, issueLineLinkToken } from '@/lib/lineMessaging';
import { startLineAccountLinking, sanitizeLineUserId } from '@/lib/lineLinkingService';
import { createRateLimiter, getClientIp } from '@/lib/rateLimit';
import { createLineWebhookStore } from '@/lib/lineWebhookStore';

const lineLinkStartLimiter = createRateLimiter({
    namespace: 'line-link-start',
    maxAttempts: 5,
    windowMs: 10 * 60 * 1000,
});

export const runtime = 'nodejs';

export async function POST(request) {
    const userCode = await getAuthUser();
    if (!userCode) return unauthorized();

    const limiterKey = `${userCode}:${getClientIp(request)}`;
    const limit = lineLinkStartLimiter.check(limiterKey);
    if (!limit.allowed) return rateLimited(limit.retryAfterMs);

    const missingConfig = getMissingLineMessagingConfig({ requireAccessToken: true });
    if (missingConfig.length > 0) {
        return error(
            `LINE account linking is not configured. Missing: ${missingConfig.join(', ')}`,
            503,
            'LINE_LINK_NOT_CONFIGURED'
        );
    }

    let body;
    try {
        body = await request.json();
    } catch {
        return validationError('Request body must be valid JSON');
    }

    const lineUserId = sanitizeLineUserId(body?.lineUserId);
    if (!lineUserId) {
        return validationError('lineUserId is required');
    }

    try {
        lineLinkStartLimiter.increment(limiterKey);
        const store = createLineWebhookStore();
        const result = await startLineAccountLinking({ userCode, lineUserId }, {
            getAccount: store.getAccount,
            createLinkRequest: store.createLinkRequest,
            issueLinkToken: issueLineLinkToken,
        });
        return success(result);
    } catch (cause) {
        const message = cause instanceof Error ? cause.message : 'Failed to start LINE account linking';
        if (message.includes('not found') || message.includes('required') || message.includes('following') || message.includes('already linked')) {
            return validationError(message);
        }
        console.error('[api/line/link/start] Failed to start LINE account linking:', cause);
        return error('Failed to start LINE account linking', 500, 'LINE_LINK_START_FAILED');
    }
}
