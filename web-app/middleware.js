import { NextResponse } from 'next/server';
import { isIpPreviewRequest } from '@/lib/authCookiePolicy.mjs';

const runtimeReleaseId = typeof process.env.REDESIGN_REG_RELEASE_ID === 'string'
    ? process.env.REDESIGN_REG_RELEASE_ID.trim() || 'dev'
    : 'dev';
const runtimeBuildId = typeof process.env.REDESIGN_REG_BUILD_ID === 'string'
    ? process.env.REDESIGN_REG_BUILD_ID.trim() || 'dev'
    : 'dev';

const runtimeSsoLoginEnabled = typeof process.env.KMUTNB_SSO_LOGIN_ENABLED === 'string'
    && process.env.KMUTNB_SSO_LOGIN_ENABLED.trim().toLowerCase() === 'true';

export function middleware(request) {
    const { pathname } = request.nextUrl;

    const hasAuthCookie = Boolean(request.cookies.get('reg_token')?.value || (runtimeSsoLoginEnabled && request.cookies.get('reg_sso_session')?.value));
    const isAssetOrApi = pathname.startsWith('/_next') || pathname.startsWith('/api') || pathname.match(/\.[a-zA-Z0-9]+$/);

    if (!isAssetOrApi) {
        const publicPaths = ['/'];
        const isPublicPath = publicPaths.includes(pathname);

        if (isPublicPath && hasAuthCookie) {
            const landingPath = process.env.NEXT_PUBLIC_LANDING_PATH || '/main';
            const redirectResponse = NextResponse.redirect(new URL(landingPath, request.url));
            redirectResponse.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
            redirectResponse.headers.set('Pragma', 'no-cache');
            redirectResponse.headers.set('Expires', '0');
            return redirectResponse;
        }

        if (!isPublicPath && !hasAuthCookie) {
            const url = new URL('/', request.url);
            url.searchParams.set('session', 'expired');
            const redirectResponse = NextResponse.redirect(url);
            redirectResponse.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
            redirectResponse.headers.set('Pragma', 'no-cache');
            redirectResponse.headers.set('Expires', '0');
            return redirectResponse;
        }
    }

    const response = NextResponse.next();
    const ipPreviewRequest = isIpPreviewRequest(request);

    const cspDirectives = [
        `default-src 'self'`,
        `script-src 'self' 'unsafe-eval' 'unsafe-inline'`,
        `style-src 'self' 'unsafe-inline' https://fonts.googleapis.com`,
        `img-src 'self' blob: data: https://reg.kmutnb.ac.th https://reg3.kmutnb.ac.th https://reg4.kmutnb.ac.th https://tqbzejjswyexfyvtluup.supabase.co`,
        `font-src 'self' https://fonts.gstatic.com`,
        `connect-src 'self' https://tqbzejjswyexfyvtluup.supabase.co https://reg.kmutnb.ac.th https://reg3.kmutnb.ac.th https://reg4.kmutnb.ac.th`,
        `object-src 'none'`,
        `base-uri 'self'`,
        `form-action 'self'`,
        `frame-ancestors 'none'`,
        ipPreviewRequest ? null : `upgrade-insecure-requests`,
    ].filter(Boolean);

    const cspHeader = cspDirectives.join('; ') + ';';

    const contentSecurityPolicyHeaderValue = cspHeader
        .replace(/\s{2,}/g, ' ')
        .trim();

    const headers = response.headers;
    headers.set('Content-Security-Policy', contentSecurityPolicyHeaderValue);
    headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
    headers.set('X-Frame-Options', 'DENY');
    headers.set('X-Content-Type-Options', 'nosniff');
    if (!ipPreviewRequest) headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    headers.set('X-Redesign-Reg-Release-Id', runtimeReleaseId);
    headers.set('X-Redesign-Reg-Build-Id', runtimeBuildId);

    if (!isAssetOrApi) {
        headers.append('Vary', 'Cookie');
        headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
        headers.set('Pragma', 'no-cache');
        headers.set('Expires', '0');
    }

    return response;
}

export const config = {
    matcher: [
        '/((?!api|_next/static|_next/image|favicon.ico).*)',
    ],
};
