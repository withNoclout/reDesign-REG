'use client';

import { useEffect } from 'react';

const CHUNK_RELOAD_THROTTLE_MS = 30_000;
const CHUNK_RELOAD_STORAGE_KEY = 'next-chunk-reload-at';


/**
 * Global error listener that captures uncaught frontend errors
 * and sends them to the server logging API (/api/log).
 * This catches errors that React error boundaries miss,
 * such as "Maximum update depth exceeded" console errors.
 */
export default function GlobalErrorListener() {
    useEffect(() => {
        const shouldReloadForChunkError = ({ message = '', filename = '', stack = '' }) => {
            const details = `${message}\n${filename}\n${stack}`;
            return details.includes('ChunkLoadError') ||
                details.includes('Failed to load chunk') ||
                details.includes('/_next/static/chunks/');
        };

        const tryRecoverChunkError = (errorData) => {
            if (!shouldReloadForChunkError(errorData) || typeof window === 'undefined') {
                return false;
            }

            try {
                const lastReloadAt = Number(sessionStorage.getItem(CHUNK_RELOAD_STORAGE_KEY) || '0');
                if (Date.now() - lastReloadAt < CHUNK_RELOAD_THROTTLE_MS) {
                    return false;
                }

                sessionStorage.setItem(CHUNK_RELOAD_STORAGE_KEY, String(Date.now()));
                window.location.reload();
                return true;
            } catch {
                return false;
            }
        };

        const sendLog = (errorData) => {
            fetch('/api/log', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(errorData),
                keepalive: true,
            }).catch(() => {});
        };

        const handleError = (event) => {
            const errorData = {
                level: 'ERROR',
                message: event.message || 'Unknown error',
                stack: event.error?.stack || `at ${event.filename}:${event.lineno}:${event.colno}`,
                context: 'GlobalErrorListener',
                timestamp: new Date().toISOString(),
                url: window.location.href,
                filename: event.filename || '',
            };

            if (!tryRecoverChunkError(errorData)) {
                sendLog(errorData);
            }
        };

        const handleUnhandledRejection = (event) => {
            const errorData = {
                level: 'ERROR',
                message: event.reason?.message || String(event.reason) || 'Unhandled Promise Rejection',
                stack: event.reason?.stack || 'No stack trace',
                context: 'UnhandledRejection',
                timestamp: new Date().toISOString(),
                url: window.location.href,
            };

            if (!tryRecoverChunkError(errorData)) {
                sendLog(errorData);
            }
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
