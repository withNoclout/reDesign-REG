const INSECURE_IP_PREVIEW_HOSTS = new Set([
    '127.0.0.1',
    'localhost',
    '172.16.214.69',
    '202.44.32.253',
]);

function readFirstHeaderValue(value) {
    if (!value) return '';
    const commaIndex = value.indexOf(',');
    return (commaIndex === -1 ? value : value.slice(0, commaIndex)).trim();
}

function stripPort(host) {
    if (!host) return '';
    if (host.startsWith('[')) {
        const closingBracket = host.indexOf(']');
        return closingBracket === -1 ? host : host.slice(1, closingBracket);
    }
    const colonIndex = host.lastIndexOf(':');
    return colonIndex === -1 ? host : host.slice(0, colonIndex);
}

function getRequestHost(request) {
    return stripPort(
        readFirstHeaderValue(
            request?.headers?.get('x-forwarded-host')
            || request?.headers?.get('host')
            || request?.nextUrl?.host
            || request?.nextUrl?.hostname
            || ''
        ).toLowerCase()
    );
}

function getRequestProto(request) {
    const forwardedProto = readFirstHeaderValue(request?.headers?.get('x-forwarded-proto'));
    if (forwardedProto) return forwardedProto.toLowerCase();

    const protocol = request?.nextUrl?.protocol;
    if (!protocol) return '';
    return protocol.endsWith(':') ? protocol.slice(0, -1).toLowerCase() : protocol.toLowerCase();
}

export function isIpPreviewRequest(request) {
    return INSECURE_IP_PREVIEW_HOSTS.has(getRequestHost(request));
}

export function shouldUseSecureAuthCookies(request) {
    if (process.env.NODE_ENV !== 'production') return false;

    const proto = getRequestProto(request);
    const allowInsecurePreviewCookies = proto === 'http' && isIpPreviewRequest(request);

    return !allowInsecurePreviewCookies;
}

export function buildAuthCookieOptions(request, maxAge) {
    return {
        httpOnly: true,
        secure: shouldUseSecureAuthCookies(request),
        path: '/',
        sameSite: 'lax',
        maxAge,
    };
}
