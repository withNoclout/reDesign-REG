import { error, success, validationError } from '@/lib/apiResponse';
import { getMissingLineMessagingConfig, verifyLineWebhookSignature } from '@/lib/lineMessaging';
import {
    getLineWebhookIngressConfig,
    verifyLineWebhookProxySecret,
} from '@/lib/lineWebhookIngress';
import { parseLineWebhookEnvelope, processLineWebhookEnvelope } from '@/lib/lineWebhookService';

export const runtime = 'nodejs';

export async function POST(request) {
    const missingConfig = getMissingLineMessagingConfig();
    if (missingConfig.length > 0) {
        return error(
            `LINE webhook is not configured. Missing: ${missingConfig.join(', ')}`,
            503,
            'LINE_WEBHOOK_NOT_CONFIGURED'
        );
    }


    // ==================================== LINE OA ====================================
    // Optional shared-secret hop from research.kmutnb.ac.th -> redesign-reg.
    // Remove together with lib/lineWebhookIngress.js when the bridge is retired.
    // ================================= END LINE OA ==================================
    const ingress = getLineWebhookIngressConfig();
    const proxySecret = request.headers.get(ingress.proxySecretHeader);
    if (!verifyLineWebhookProxySecret(proxySecret, ingress.proxySharedSecret)) {
        return error('Invalid LINE webhook proxy secret', 403, 'LINE_WEBHOOK_PROXY_FORBIDDEN');
    }


    const signature = request.headers.get('x-line-signature');
    const rawBody = await request.text();

    if (!verifyLineWebhookSignature(rawBody, signature)) {
        return error('Invalid LINE webhook signature', 403, 'LINE_WEBHOOK_FORBIDDEN');
    }

    let envelope;
    try {
        envelope = parseLineWebhookEnvelope(rawBody);
    } catch (cause) {
        return validationError(cause instanceof Error ? cause.message : 'Invalid LINE webhook payload');
    }

    try {
        const result = await processLineWebhookEnvelope(envelope);
        if (result.failedCount > 0) {
            console.error('[api/line/webhook] Failed to process one or more LINE webhook events:', result.events);
            return error('Failed to process one or more LINE webhook events', 500, 'LINE_WEBHOOK_PROCESSING_FAILED');
        }
        return success(result);
    } catch (cause) {
        console.error('[api/line/webhook] Failed to process LINE webhook payload:', cause);
        return error('Failed to process LINE webhook payload', 500, 'LINE_WEBHOOK_FAILED');
    }
}
