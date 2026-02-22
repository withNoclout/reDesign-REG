import { NextResponse } from 'next/server';

export function middleware(request) {
    const { pathname } = request.nextUrl;

    // --- Authentication & Route Protection ---
    const token = request.cookies.get('reg_token')?.value;

    // Skip authentication check for static files and API routes
    const isAssetOrApi = pathname.startsWith('/_next') || pathname.startsWith('/api') || pathname.match(/\.[a-zA-Z0-9]+$/);

    if (!isAssetOrApi) {
        const publicPaths = ['/'];
        const isPublicPath = publicPaths.includes(pathname);

        // If logged in and trying to access the login page, redirect to landing
        if (isPublicPath && token) {
            // Use process.env directly cautiously or just fallback. 
            // process.env next to middleware sometimes isn't fully loaded without care, but works in Edge runtimes for standard env vars.
            const landingPath = process.env.NEXT_PUBLIC_LANDING_PATH || '/main';
            return NextResponse.redirect(new URL(landingPath, request.url));
        }

        // If NOT logged in and trying to access any protected route, redirect to login
        if (!isPublicPath && !token) {
            const url = new URL('/', request.url);
            // Optional: You could append a query param like ?returnUrl=${pathname} here if needed
            return NextResponse.redirect(url);
        }
    }

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
