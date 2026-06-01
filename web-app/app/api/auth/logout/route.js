import { NextResponse } from 'next/server';
import { AUTH_IDENTITY_COOKIE_NAME } from '@/lib/auth';

export async function POST() {
    const response = NextResponse.json({ success: true, message: 'ออกจากระบบสำเร็จ' });

    response.cookies.set('reg_token', '', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        path: '/',
        sameSite: 'lax',
        maxAge: 0
    });

    response.cookies.set(AUTH_IDENTITY_COOKIE_NAME, '', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        path: '/',
        sameSite: 'lax',
        maxAge: 0
    });

    // Clear the legacy cookie as part of the security cutover.
    response.cookies.set('std_code', '', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        path: '/',
        sameSite: 'lax',
        maxAge: 0
    });

    return response;
}
