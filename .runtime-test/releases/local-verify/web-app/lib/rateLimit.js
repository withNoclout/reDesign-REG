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
    return (
        request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
        request.headers.get('x-real-ip') ||
        'unknown'
    );
}
