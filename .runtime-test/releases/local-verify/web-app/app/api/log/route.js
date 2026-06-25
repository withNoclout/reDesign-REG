import fs from 'fs/promises';
import { existsSync, mkdirSync, statSync } from 'fs';
import { error, rateLimited, success, validationError } from '@/lib/apiResponse';
import { getLogDir, getLogFilePath } from '@/lib/runtimePaths.mjs';
import { createRateLimiter, getClientIp } from '@/lib/rateLimit';

// Rate limit: 30 log entries per minute per IP
const logLimiter = createRateLimiter({
    namespace: 'log',
    maxAttempts: 30,
    windowMs: 60 * 1000,
});

const VALID_LEVELS = ['DEBUG', 'INFO', 'WARN', 'ERROR', 'FATAL'];
const MAX_MESSAGE_LENGTH = 2000;
const MAX_CONTEXT_LENGTH = 100;
const MAX_LOG_FILE_SIZE = 10 * 1024 * 1024; // 10MB cap

export async function POST(request) {
    try {
        // Frontend error logging must still work when the session has expired
        // or before the user has logged in, so auth is intentionally optional.

        // Rate limit by IP
        const ip = getClientIp(request);
        const limit = logLimiter.check(ip);
        if (!limit.allowed) {
            return rateLimited(limit.retryAfterMs);
        }
        logLimiter.increment(ip);

        const body = await request.json();
        let { level = 'INFO', message, context = 'Unknown', stack, url } = body;
        const timestamp = new Date().toISOString(); // Server-generated timestamp (never trust client)

        // Validate level
        level = String(level).toUpperCase();
        if (!VALID_LEVELS.includes(level)) level = 'INFO';

        // Validate and truncate message
        if (!message || typeof message !== 'string') {
            return validationError('Message is required');
        }
        message = message.substring(0, MAX_MESSAGE_LENGTH);
        context = String(context).substring(0, MAX_CONTEXT_LENGTH);

        // Sanitize — strip control characters and potential injection patterns
        const sanitize = (str) => str ? String(str).replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '') : '';
        message = sanitize(message);
        context = sanitize(context);
        if (stack) stack = sanitize(String(stack)).substring(0, 3000);
        if (url) url = sanitize(String(url)).substring(0, 500);

        const logDir = getLogDir();
        const logFilePath = getLogFilePath();

        // Ensure logs directory exists (sync on first call only)
        if (!existsSync(logDir)) {
            mkdirSync(logDir, { recursive: true });
        }

        // Check log file size — prevent disk filling
        try {
            if (existsSync(logFilePath)) {
                const stats = statSync(logFilePath);
                if (stats.size > MAX_LOG_FILE_SIZE) {
                    console.warn('[Log API] Log file exceeds 10MB — rotating');
                    const rotatedPath = logFilePath + '.old';
                    await fs.rename(logFilePath, rotatedPath);
                }
            }
        } catch { /* file might not exist yet — that's fine */ }

        // Format the log entry
        const logEntry = `[${timestamp}] [${level}] [${context}] ${message}\n` +
            (url ? `URL: ${url}\n` : '') +
            (stack ? `${stack}\n` : '') +
            '-'.repeat(80) + '\n';

        // Append to log file (async, non-blocking)
        await fs.appendFile(logFilePath, logEntry);

        return success();
    } catch (caughtError) {
        console.error('Logging API Error:', caughtError);
        return error('Failed to log', 500, 'LOG_WRITE_FAILED');
    }
}
