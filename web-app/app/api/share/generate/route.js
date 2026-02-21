import { NextResponse } from 'next/server';
import { generateShareToken } from '../../../../utils/jwt';
import { getAuthUser } from '@/lib/auth';

export async function POST(request) {
    try {
        // Auth check — only authenticated users can generate share links
        const userId = await getAuthUser();
        if (!userId) {
            return NextResponse.json(
                { success: false, error: 'Authentication required' },
                { status: 401 }
            );
        }

        const { permissions, expiration, guestName } = await request.json();

        // Validate inputs
        if (!permissions || !Array.isArray(permissions) || permissions.length === 0) {
            return NextResponse.json(
                { success: false, error: 'At least one permission required' },
                { status: 400 }
            );
        }

        if (!guestName || typeof guestName !== 'string' || guestName.trim().length === 0) {
            return NextResponse.json(
                { success: false, error: 'Guest name required' },
                { status: 400 }
            );
        }

        // Validate expiration options
        const validExpirations = ['1h', '24h', '7d', '30d', 'never'];
        const expiresIn = expiration === 'never' ? '365d' : expiration;

        if (!validExpirations.includes(expiration)) {
            return NextResponse.json(
                { success: false, error: 'Invalid expiration option' },
                { status: 400 }
            );
        }

        // Validate permissions
        const validPermissions = ['profile', 'registration', 'grade', 'search', 'manual', 'others'];
        const invalidPermissions = permissions.filter((p) => !validPermissions.includes(p));

        if (invalidPermissions.length > 0) {
            return NextResponse.json(
                {
                    success: false,
                    error: `Invalid permissions: ${invalidPermissions.join(', ')}`
                },
                { status: 400 }
            );
        }

        // Generate JWT token using authenticated user ID
        const payload = {
            userId: String(userId),
            permissions,
            guestName: guestName.trim().substring(0, 100), // Limit guest name length
            createdAt: new Date().toISOString()
        };

        const token = generateShareToken(payload, expiresIn);
        const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
        const shareLink = `${baseUrl}/share?t=${encodeURIComponent(token)}`;

        return NextResponse.json({
            success: true,
            shareLink,
            expiresIn
        });
    } catch (err) {
        console.error('Generate share link error:', err);
        return NextResponse.json(
            { success: false, error: 'Internal server error' },
            { status: 500 }
        );
    }
}