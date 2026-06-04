import { NextResponse } from 'next/server';

/**
 * Standardized API response helpers.
 * Ensures consistent response format across all API routes.
 */

/**
 * Success response.
 * @param {any} data - Response payload
 * @param {number} status - HTTP status code (default: 200)
 * @returns {NextResponse}
 */
export function success(data = null, status = 200) {
    return NextResponse.json({ success: true, data }, { status });
}

/**
 * Error response.
 * @param {string} message - Human-readable error message
 * @param {number} status - HTTP status code (default: 400)
 * @param {string} code - Machine-readable error code (optional)
 * @returns {NextResponse}
 */
export function error(message, status = 400, code = undefined) {
    const body = { success: false, error: { message } };
    if (code) body.error.code = code;
    return NextResponse.json(body, { status });
}

/**
 * Unauthorized response (401).
 * @param {string} message
 * @returns {NextResponse}
 */
export function unauthorized(message = 'Authentication required') {
    return error(message, 401, 'UNAUTHORIZED');
}

/**
 * Forbidden response (403).
 * @param {string} message
 * @returns {NextResponse}
 */
export function forbidden(message = 'Access denied') {
    return error(message, 403, 'FORBIDDEN');
}

/**
 * Rate limited response (429).
 * @param {number} retryAfterMs - Milliseconds until rate limit resets
 * @returns {NextResponse}
 */
export function rateLimited(retryAfterMs) {
    const retryAfterSec = Math.ceil(retryAfterMs / 1000);
    const response = error(
        `Too many requests. Try again in ${retryAfterSec} seconds.`,
        429,
        'RATE_LIMITED'
    );
    response.headers.set('Retry-After', String(retryAfterSec));
    return response;
}

/**
 * Not found response (404).
 * @param {string} message
 * @returns {NextResponse}
 */
export function notFound(message = 'Resource not found') {
    return error(message, 404, 'NOT_FOUND');
}

/**
 * Validation error response (422).
 * @param {string} message
 * @returns {NextResponse}
 */
export function validationError(message) {
    return error(message, 422, 'VALIDATION_ERROR');
}
