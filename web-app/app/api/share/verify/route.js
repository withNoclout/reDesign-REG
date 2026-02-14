import { NextResponse } from 'next/server';
import { verifyShareToken } from '../../../../utils/jwt';

export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);
        const token = searchParams.get('t');

        if (!token || typeof token !== 'string' || token.trim().length === 0) {
            return NextResponse.json(
                { success: false, error: 'Token required' },
                { status: 400 }
            );
        }

        // Verify token
        const decoded = verifyShareToken(token);

        if (!decoded) {
            return NextResponse.json(
                { success: false, error: 'Invalid or expired token' },
                { status: 401 }
            );
        }

        // Return verified guest info
        return NextResponse.json({
            success: true,
            guestName: decoded.guestName,
            permissions: decoded.permissions,
            userId: decoded.userId
        });
    } catch (err) {
        console.error('Verify token error:', err);
        return NextResponse.json(
            { success: false, error: 'Internal server error' },
            { status: 500 }
        );
    }
}