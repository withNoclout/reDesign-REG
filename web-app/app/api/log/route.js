import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import { existsSync, mkdirSync } from 'fs';
import path from 'path';

export async function POST(request) {
    try {
        const body = await request.json();
        const { level = 'INFO', message, context = 'Unknown', stack, url, timestamp = new Date().toISOString() } = body;

        // Path to the logs directory (root of web-app/logs)
        const logDir = path.join(process.cwd(), 'logs');
        const logFilePath = path.join(logDir, 'app.log');

        // Ensure logs directory exists (sync on first call only)
        if (!existsSync(logDir)) {
            mkdirSync(logDir, { recursive: true });
        }

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
