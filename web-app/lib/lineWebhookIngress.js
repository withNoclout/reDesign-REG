import crypto from 'node:crypto';

// ==================================== LINE OA ====================================
// Research-host webhook bridge contract.
// Remove this block together with research.kmutnb.ac.th bridge files/config when LINE OA
// webhook ingress no longer needs to traverse the research host.
// ================================= END LINE OA ==================================

export const LINE_WEBHOOK_PROXY_SECRET_HEADER = 'x-reg-line-webhook-proxy-secret';

function readString(value) {
    return typeof value === 'string' && value.trim() ? value.trim() : null;
}

export function getLineWebhookPublicUrl() {
    const explicit = readString(process.env.LINE_WEBHOOK_PUBLIC_URL);
    if (explicit) return explicit;

    const baseUrl = readString(process.env.NEXT_PUBLIC_BASE_URL);
    if (!baseUrl) return null;
    return `${baseUrl.replace(/\/+$/, '')}/api/line/webhook`;
}

export function getLineWebhookIngressConfig() {
    return {
        publicUrl: getLineWebhookPublicUrl(),
        proxySharedSecret: readString(process.env.LINE_WEBHOOK_PROXY_SHARED_SECRET),
        proxySecretHeader: LINE_WEBHOOK_PROXY_SECRET_HEADER,
    };
}

export function isLineWebhookProxyProtectionEnabled(proxySharedSecret = getLineWebhookIngressConfig().proxySharedSecret) {
    return Boolean(readString(proxySharedSecret));
}

export function verifyLineWebhookProxySecret(
    providedSecret,
    expectedSecret = getLineWebhookIngressConfig().proxySharedSecret,
) {
    const normalizedExpected = readString(expectedSecret);
    if (!normalizedExpected) return true;

    const normalizedProvided = readString(providedSecret);
    if (!normalizedProvided) return false;

    const expectedBuffer = Buffer.from(normalizedExpected, 'utf8');
    const providedBuffer = Buffer.from(normalizedProvided, 'utf8');
    if (expectedBuffer.length !== providedBuffer.length) return false;

    return crypto.timingSafeEqual(expectedBuffer, providedBuffer);
}
