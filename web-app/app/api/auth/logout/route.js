import { NextResponse } from 'next/server';

export async function POST() {
    const response = NextResponse.json({ success: true, message: 'ออกจากระบบสำเร็จ' });

    // Clear the API token cookie
    response.cookies.set('reg_token', '', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        path: '/',
        sameSite: 'lax',
        maxAge: 0 // Expire immediately
    });

    return response;
}
