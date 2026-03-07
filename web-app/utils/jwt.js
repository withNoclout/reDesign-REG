const SECRET = process.env.JWT_SECRET;

/**
 * Generate a share token with JWT (Server-side only)
 */
export function generateShareToken(payload, expiresIn) {
    if (typeof window !== 'undefined') {
        throw new Error('generateShareToken can only be called on the server');
    }
    // Dynamically import jsonwebtoken to prevent it from being bundled in the client
    const jwt = require('jsonwebtoken');
    try {
        return jwt.sign(payload, SECRET, { expiresIn });
    } catch (error) {
        console.error('Error generating share token:', error);
        throw new Error('Failed to generate share token');
    }
}

/**
 * Verify a share token (Server-side preferred)
 */
export function verifyShareToken(token) {
    if (typeof window !== 'undefined') {
        // On the client, we just decode it without verification (signature check is impossible without SECRET)
        return decodeShareToken(token);
    }
    const jwt = require('jsonwebtoken');
    try {
        return jwt.verify(token, SECRET);
    } catch (error) {
        console.error('Error verifying share token:', error.message);
        return null;
    }
}

/**
 * Decode a share token without verification (for debugging only)
 * @param {string} token - JWT token to decode
 * @returns {Object|null} Decoded payload or null if invalid
 */
export function decodeShareToken(token) {
    if (!token) return null;
    try {
        // Simple base64 decode for the client to read permissions without jsonwebtoken
        const parts = token.split('.');
        if (parts.length !== 3) return null;
        const payload = parts[1];
        return JSON.parse(Buffer.from(payload, 'base64').toString());
    } catch (error) {
        console.error('Error decoding share token:', error);
        return null;
    }
}