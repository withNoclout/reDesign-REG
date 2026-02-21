import { NextResponse } from 'next/server';

export function middleware(request) {
    const response = NextResponse.next();

    // Generate a unique nonce for each request (optional for strict CSP)
    // const nonce = Buffer.from(crypto.randomUUID()).toString('base64');

    // Content Security Policy (CSP)
    // Allowed sources:
    // - Scripts: Self, unsafe-inline (needed for Next.js in some modes), unsafe-eval
    // - Styles: Self, unsafe-inline, Google Fonts
    // - Fonts: Self, Google Fonts (gstatic)
    // - Images: Self, Data URI, Blob
    // - Connect: Self (API calls)
    const cspHeader = `
        default-src 'self';
        script-src 'self' 'unsafe-eval' 'unsafe-inline';
        style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
        img-src 'self' blob: data: https://tqbzejjswyexfyvtluup.supabase.co;
        font-src 'self' https://fonts.gstatic.com;
        connect-src 'self' https://tqbzejjswyexfyvtluup.supabase.co;
        object-src 'none';
        base-uri 'self';
        form-action 'self';
        frame-ancestors 'none';
        upgrade-insecure-requests;
    `;

    // Replace newlines and extra spaces
    const contentSecurityPolicyHeaderValue = cspHeader
        .replace(/\s{2,}/g, ' ')
        .trim();

    // Set Security Headers
    const headers = response.headers;

    headers.set('Content-Security-Policy', contentSecurityPolicyHeaderValue);
    headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
    headers.set('X-Frame-Options', 'DENY'); // Prevent clickjacking
    headers.set('X-Content-Type-Options', 'nosniff'); // Prevent MIME type sniffing
    headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains'); // Enforce HTTPS
    headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()'); // Disable unused features

    return response;
}

export const config = {
    matcher: [
        /*
         * Match all request paths except for:
         * - api (API routes)
         * - _next/static (static files)
         * - _next/image (image optimization files)
         * - favicon.ico (favicon file)
         */
        '/((?!api|_next/static|_next/image|favicon.ico).*)',
    ],
};
