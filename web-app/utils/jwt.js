import jwt from 'jsonwebtoken';

// Get JWT secret from environment, with fallback for development
const SECRET = process.env.JWT_SECRET || 'fallback-secret-change-in-production-min-32-chars';

/**
 * Generate a share token with JWT
 * @param {Object} payload - Token payload (userId, permissions, guestName)
 * @param {string} expiresIn - Expiration time (e.g., '1h', '24h', '7d', '30d', '365d')
 * @returns {string} JWT token
 */
export function generateShareToken(payload, expiresIn) {
    try {
        return jwt.sign(payload, SECRET, { expiresIn });
    } catch (error) {
        console.error('Error generating share token:', error);
        throw new Error('Failed to generate share token');
    }
}

/**
 * Verify a share token
 * @param {string} token - JWT token to verify
 * @returns {Object|null} Decoded payload if valid, null if invalid
 */
export function verifyShareToken(token) {
    try {
        return jwt.verify(token, SECRET);
    } catch (error) {
        // Token is invalid or expired
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
    try {
        return jwt.decode(token);
    } catch (error) {
        console.error('Error decoding share token:', error);
        return null;
    }
}