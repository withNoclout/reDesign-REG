/**
 * Reusable rate limiter with sliding window algorithm.
 * In-memory store (Map) — suitable for single-instance deployments.
 * For production multi-instance, replace store with Redis/Upstash.
 */

const stores = new Map();

function getStore(namespace) {
    if (!stores.has(namespace)) {
        stores.set(namespace, new Map());
    }
    return stores.get(namespace);
}

/**
 * Create a rate limiter for a specific use case.
 * @param {Object} options
 * @param {string}  options.namespace   - Unique name for this limiter (e.g., 'login', 'search')
 * @param {number}  options.maxAttempts - Max requests allowed in the window
 * @param {number}  options.windowMs    - Time window in milliseconds
 * @returns {{ check: (key: string) => RateLimitResult, increment: (key: string) => void, reset: (key: string) => void }}
 */
export function createRateLimiter({ namespace, maxAttempts, windowMs }) {
    const store = getStore(namespace);

    function check(key) {
        const now = Date.now();
        const record = store.get(key);

        if (!record || now > record.resetTime) {
            store.set(key, { count: 0, resetTime: now + windowMs });
            return { allowed: true, remaining: maxAttempts, resetTime: now + windowMs };
        }

        if (record.count >= maxAttempts) {
            const retryAfterMs = record.resetTime - now;
            return { allowed: false, remaining: 0, resetTime: record.resetTime, retryAfterMs };
        }

        return { allowed: true, remaining: maxAttempts - record.count, resetTime: record.resetTime };
    }

    function increment(key) {
        const now = Date.now();
        const record = store.get(key) || { count: 0, resetTime: now + windowMs };
        if (now > record.resetTime) {
            store.set(key, { count: 1, resetTime: now + windowMs });
        } else {
            record.count++;
            store.set(key, record);
        }
    }

    function reset(key) {
        store.delete(key);
    }

    return { check, increment, reset };
}

/**
 * Extract client IP from Next.js request headers.
 * @param {Request} request
 * @returns {string}
 */
export function getClientIp(request) {
    const forwardedFor = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
    if (forwardedFor === '::1' || forwardedFor === '::ffff:127.0.0.1') return '127.0.0.1';
    if (forwardedFor) return forwardedFor;

    const realIp = request.headers.get('x-real-ip');
    if (realIp === '::1' || realIp === '::ffff:127.0.0.1') return '127.0.0.1';
    if (realIp) return realIp;

    const host = request.headers.get('x-forwarded-host')
        || request.headers.get('host')
        || request.headers.get('origin')
        || '';
    const normalizedHost = String(host).toLowerCase().replace(/^https?:\/\//, '').split('/')[0].split(':')[0];
    if (normalizedHost === '127.0.0.1' || normalizedHost === 'localhost') {
        return '127.0.0.1';
    }

    return 'unknown';
}
