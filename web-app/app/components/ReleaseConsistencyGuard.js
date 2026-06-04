'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

const RELOAD_THROTTLE_MS = 30_000;
const RELEASE_RELOAD_STORAGE_KEY = 'reg-release-reload-at';
const STYLE_RELOAD_STORAGE_KEY = 'reg-style-reload-at';
const LAST_SEEN_RELEASE_STORAGE_KEY = 'reg-last-seen-release-id';
const EXPECTED_BODY_BACKGROUND = 'rgb(15, 23, 42)';

function canReload(key) {
    try {
        const lastReloadAt = Number(sessionStorage.getItem(key) || '0');
        return Date.now() - lastReloadAt >= RELOAD_THROTTLE_MS;
    } catch {
        return true;
    }
}

function markReload(key) {
    try {
        sessionStorage.setItem(key, String(Date.now()));
    } catch {
        // ignore storage failures
    }
}

function readLastSeenRelease() {
    try {
        return sessionStorage.getItem(LAST_SEEN_RELEASE_STORAGE_KEY) || null;
    } catch {
        return null;
    }
}

function writeLastSeenRelease(releaseId) {
    if (!releaseId) return;
    try {
        sessionStorage.setItem(LAST_SEEN_RELEASE_STORAGE_KEY, releaseId);
    } catch {
        // ignore storage failures
    }
}

function sendLog(payload) {
    fetch('/api/log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        keepalive: true,
        cache: 'no-store',
    }).catch(() => {});
}

function documentHasExpectedStyles() {
    const stylesheets = Array.from(document.querySelectorAll('link[rel="stylesheet"]'));
    const hasNextStylesheet = stylesheets.some((sheet) => sheet.getAttribute('href')?.includes('/_next/static/chunks/'));
    const backgroundColor = window.getComputedStyle(document.body).backgroundColor;
    return hasNextStylesheet && backgroundColor === EXPECTED_BODY_BACKGROUND;
}

export default function ReleaseConsistencyGuard() {
    const pathname = usePathname();

    useEffect(() => {
        if (typeof window === 'undefined') {
            return undefined;
        }

        document.documentElement.dataset.clientBooted = 'true';

        const protectedRoute = pathname && pathname !== '/';
        if (!protectedRoute) {
            return undefined;
        }

        const styleCheckTimer = window.setTimeout(() => {
            if (documentHasExpectedStyles()) {
                return;
            }

            sendLog({
                level: 'WARN',
                context: 'ReleaseConsistencyGuard',
                message: 'Protected route rendered without expected global styles; attempting one-time recovery reload.',
                pathname,
                timestamp: new Date().toISOString(),
            });

            if (canReload(STYLE_RELOAD_STORAGE_KEY)) {
                markReload(STYLE_RELOAD_STORAGE_KEY);
                window.location.reload();
            }
        }, 800);

        const checkRelease = async () => {
            try {
                const response = await fetch('/api/health', { cache: 'no-store' });
                if (!response.ok) {
                    return;
                }

                const health = await response.json();
                const liveReleaseId = health?.runtime?.releaseId || null;
                const previousReleaseId = readLastSeenRelease();

                if (previousReleaseId && liveReleaseId && previousReleaseId !== liveReleaseId) {
                    sendLog({
                        level: 'WARN',
                        context: 'ReleaseConsistencyGuard',
                        message: 'Detected live runtime release change during an existing browser session; attempting one-time recovery reload.',
                        pathname,
                        previousReleaseId,
                        liveReleaseId,
                        timestamp: new Date().toISOString(),
                    });

                    if (canReload(RELEASE_RELOAD_STORAGE_KEY)) {
                        markReload(RELEASE_RELOAD_STORAGE_KEY);
                        writeLastSeenRelease(liveReleaseId);
                        window.location.reload();
                        return;
                    }
                }

                writeLastSeenRelease(liveReleaseId);
            } catch {
                // Ignore diagnostic fetch failures.
            }
        };

        checkRelease();

        return () => {
            window.clearTimeout(styleCheckTimer);
        };
    }, [pathname]);

    return null;
}
