import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import { existsSync, mkdirSync, statSync } from 'fs';
import path from 'path';
import { getAuthUser } from '@/lib/auth';
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
        // Auth check — only logged-in users can write logs
        const userId = await getAuthUser();
        if (!userId) {
            return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
        }

        // Rate limit by IP
        const ip = getClientIp(request);
        const limit = logLimiter.check(ip);
        if (!limit.allowed) {
            return NextResponse.json({ success: false, error: 'Too many requests' }, { status: 429 });
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
            return NextResponse.json({ success: false, error: 'Message is required' }, { status: 400 });
        }
        message = message.substring(0, MAX_MESSAGE_LENGTH);
        context = String(context).substring(0, MAX_CONTEXT_LENGTH);

        // Sanitize — strip control characters and potential injection patterns
        const sanitize = (str) => str ? String(str).replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '') : '';
        message = sanitize(message);
        context = sanitize(context);
        if (stack) stack = sanitize(String(stack)).substring(0, 3000);
        if (url) url = sanitize(String(url)).substring(0, 500);

        // Path to the logs directory (root of web-app/logs)
        const logDir = path.join(process.cwd(), 'logs');
        const logFilePath = path.join(logDir, 'app.log');

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

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Logging API Error:', error);
        return NextResponse.json({ success: false, error: 'Failed to log' }, { status: 500 });
    }
}
