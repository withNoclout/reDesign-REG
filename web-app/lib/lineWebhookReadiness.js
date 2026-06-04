import dns from 'node:dns/promises';
import net from 'node:net';
import {
    getLineWebhookIngressConfig,
    getLineWebhookPublicUrl,
    isLineWebhookProxyProtectionEnabled,
} from './lineWebhookIngress.js';

function readString(value) {
    return typeof value === 'string' && value.trim() ? value.trim() : null;
}


function isLoopbackOrPrivateHostname(hostname) {
    const normalized = readString(hostname)?.toLowerCase();
    if (!normalized) return true;
    if (normalized === 'localhost' || normalized.endsWith('.local')) return true;

    const ipVersion = net.isIP(normalized);
    if (ipVersion === 4) {
        const [a = 0, b = 0] = normalized.split('.').map(Number);
        if (a === 10 || a === 127 || a === 0) return true;
        if (a === 192 && b === 168) return true;
        if (a === 169 && b === 254) return true;
        if (a === 172 && b >= 16 && b <= 31) return true;
        return false;
    }

    if (ipVersion === 6) {
        return normalized === '::1'
            || normalized.startsWith('fc')
            || normalized.startsWith('fd')
            || normalized.startsWith('fe80:');
    }

    return false;
}

async function resolveHostname(hostname) {
    const addresses = await dns.lookup(hostname, { all: true });
    return Array.from(new Set(addresses.map((entry) => entry.address).filter(Boolean)));
}

function createIssue(code, severity, message, recommendation) {
    return { code, severity, message, recommendation };
}

function isExternalWebhookProxyTarget(webhookUrl) {
    const baseUrl = readString(process.env.NEXT_PUBLIC_BASE_URL);
    if (!baseUrl || !webhookUrl) return false;

    try {
        const publicUrl = new URL(webhookUrl);
        const appUrl = new URL(baseUrl);
        return publicUrl.origin !== appUrl.origin || publicUrl.pathname !== '/api/line/webhook';
    } catch {
        return false;
    }
}

export async function getLineWebhookReadiness({ recentEvents = [] } = {}) {
    const channelSecret = readString(process.env.LINE_CHANNEL_SECRET);
    const channelAccessToken = readString(process.env.LINE_CHANNEL_ACCESS_TOKEN);
    const ingress = getLineWebhookIngressConfig();
    const webhookUrl = getLineWebhookPublicUrl();
    const parsedUrl = (() => {
        try {
            return webhookUrl ? new URL(webhookUrl) : null;
        } catch {
            return null;
        }
    })();

    const issues = [];
    let dnsAddresses = [];
    const proxyProtectionEnabled = isLineWebhookProxyProtectionEnabled(ingress.proxySharedSecret);

    if (!channelSecret) {
        issues.push(createIssue(
            'missing-channel-secret',
            'blocking',
            'ยังไม่ได้ตั้งค่า LINE_CHANNEL_SECRET สำหรับตรวจสอบลายเซ็น webhook',
            'ตั้งค่า Channel secret ของ Messaging API channel ใน production environment'
        ));
    }

    if (!channelAccessToken) {
        issues.push(createIssue(
            'missing-channel-access-token',
            'blocking',
            'ยังไม่ได้ตั้งค่า LINE_CHANNEL_ACCESS_TOKEN สำหรับตอบกลับ LINE OA',
            'ตั้งค่า long-lived channel access token ของ Messaging API channel ใน production environment'
        ));
    }

    if (!webhookUrl) {
        issues.push(createIssue(
            'missing-webhook-url',
            'blocking',
            'ยังไม่ได้ตั้งค่า URL สาธารณะที่ LINE จะเรียกกลับเข้ามา',
            'ตั้งค่า NEXT_PUBLIC_BASE_URL หรือ LINE_WEBHOOK_PUBLIC_URL ให้ชี้ไปยัง public HTTPS endpoint'
        ));
    } else if (!parsedUrl) {
        issues.push(createIssue(
            'invalid-webhook-url',
            'blocking',
            `Webhook URL ไม่ถูกต้อง: ${webhookUrl}`,
            'แก้ค่า NEXT_PUBLIC_BASE_URL หรือ LINE_WEBHOOK_PUBLIC_URL ให้เป็น URL เต็มรูปแบบ'
        ));
    } else {
        if (parsedUrl.protocol !== 'https:') {
            issues.push(createIssue(
                'webhook-not-https',
                'blocking',
                `Webhook URL ต้องเป็น HTTPS แต่ตอนนี้เป็น ${parsedUrl.protocol.replace(':', '').toUpperCase()}`,
                'วางระบบไว้หลัง public HTTPS endpoint ที่ใช้ certificate ที่ browser เชื่อถือได้'
            ));
        }

        if (isLoopbackOrPrivateHostname(parsedUrl.hostname)) {
            issues.push(createIssue(
                'webhook-private-host',
                'blocking',
                `Webhook URL ใช้ host ภายในหรือ private host (${parsedUrl.hostname}) ซึ่ง LINE cloud จะเรียกกลับไม่ได้`,
                'เปลี่ยนเป็น public DNS name ที่เข้าถึงได้จากภายนอกองค์กร'
            ));
        } else {
            try {
                dnsAddresses = await resolveHostname(parsedUrl.hostname);
                if (dnsAddresses.length === 0) {
                    issues.push(createIssue(
                        'webhook-dns-empty',
                        'blocking',
                        `DNS ของ ${parsedUrl.hostname} ยังไม่ resolve เป็นปลายทางใดเลย`,
                        'เพิ่ม public DNS record และยืนยันว่าชี้มาที่ ingress ของระบบจริง'
                    ));
                }
            } catch {
                issues.push(createIssue(
                    'webhook-dns-unresolved',
                    'blocking',
                    `DNS ของ ${parsedUrl.hostname} ยังไม่ resolve จาก runtime นี้`,
                    'ตรวจ DNS/Firewall/NAT ให้ host นี้เข้าถึงได้จริงทั้งจากภายนอกและจากเครื่อง runtime'
                ));
            }
        }
    }

    if (isExternalWebhookProxyTarget(webhookUrl) && !proxyProtectionEnabled) {
        issues.push(createIssue(
            'missing-webhook-proxy-secret',
            'warning',
            'Webhook URL นี้ชี้ออกไปยัง public proxy ภายนอก แต่ยังไม่ได้ตั้ง LINE_WEBHOOK_PROXY_SHARED_SECRET',
            'ตั้ง shared secret ระหว่าง public proxy กับแอป แล้วให้ proxy ส่ง header ภายในก่อนถึง /api/line/webhook'
        ));
    }

    const normalizedEvents = Array.isArray(recentEvents)
        ? [...recentEvents].sort((left, right) => new Date(right?.processedAt || 0).getTime() - new Date(left?.processedAt || 0).getTime())
        : [];
    const lastEvent = normalizedEvents[0] || null;

    if (!lastEvent) {
        issues.push(createIssue(
            'no-webhook-events-observed',
            'warning',
            'ยังไม่พบ webhook event ล่าสุดในระบบ จึงยังไม่มีหลักฐานว่า LINE เรียก webhook endpoint นี้สำเร็จแล้ว',
            'หลังตั้งค่า webhook URL ใน LINE Developers ให้กด Verify และส่งข้อความทดสอบเพื่อยืนยัน ingress'
        ));
    }

    const blockingIssues = issues.filter((issue) => issue.severity === 'blocking');
    const warningIssues = issues.filter((issue) => issue.severity === 'warning');

    return {
        ready: blockingIssues.length === 0,
        state: blockingIssues.length > 0 ? 'blocked' : warningIssues.length > 0 ? 'warning' : 'ready',
        webhookUrl,
        host: parsedUrl?.hostname || null,
        dnsAddresses,
        issues,
        checks: {
            channelSecret: Boolean(channelSecret),
            channelAccessToken: Boolean(channelAccessToken),
            webhookUrl: Boolean(parsedUrl),
            https: parsedUrl?.protocol === 'https:',
            publicHost: parsedUrl ? !isLoopbackOrPrivateHostname(parsedUrl.hostname) : false,
            dnsResolvable: dnsAddresses.length > 0,
            recentWebhookEvent: Boolean(lastEvent),
            proxyProtection: proxyProtectionEnabled,
        },
        telemetry: {
            recentEventCount: normalizedEvents.length,
            lastWebhookEventAt: lastEvent?.processedAt || null,
            lastWebhookEventType: lastEvent?.eventType || null,
            lastWebhookEventStatus: lastEvent?.status || null,
        },
    };
}
