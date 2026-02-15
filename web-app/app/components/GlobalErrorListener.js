'use client';

import { useEffect } from 'react';

/**
 * Global error listener that captures uncaught frontend errors
 * and sends them to the server logging API (/api/log).
 * This catches errors that React error boundaries miss,
 * such as "Maximum update depth exceeded" console errors.
 */
export default function GlobalErrorListener() {
    useEffect(() => {
        const handleError = (event) => {
            const errorData = {
                level: 'ERROR',
                message: event.message || 'Unknown error',
                stack: event.error?.stack || `at ${event.filename}:${event.lineno}:${event.colno}`,
                context: 'GlobalErrorListener',
                timestamp: new Date().toISOString(),
                url: typeof window !== 'undefined' ? window.location.href : 'Unknown URL'
            };

            fetch('/api/log', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(errorData)
            }).catch(() => {});
        };

        const handleUnhandledRejection = (event) => {
            const errorData = {
                level: 'ERROR',
                message: event.reason?.message || String(event.reason) || 'Unhandled Promise Rejection',
                stack: event.reason?.stack || 'No stack trace',
                context: 'UnhandledRejection',
                timestamp: new Date().toISOString(),
                url: typeof window !== 'undefined' ? window.location.href : 'Unknown URL'
            };

            fetch('/api/log', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(errorData)
            }).catch(() => {});
        };

        window.addEventListener('error', handleError);
        window.addEventListener('unhandledrejection', handleUnhandledRejection);

        return () => {
            window.removeEventListener('error', handleError);
            window.removeEventListener('unhandledrejection', handleUnhandledRejection);
        };
    }, []);

    return null;
}
