'use client';

import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

const GuestContext = createContext(null);

/**
 * GuestProvider - Manages guest mode state for portfolio sharing
 * 
 * Context values:
 * - isGuest: boolean - true if accessing via share link
 * - allowedModules: string[] - list of permitted menu IDs
 * - guestName: string - owner's name for display
 * - loading: boolean - true while verifying token
 */
export function GuestProvider({ children }) {
    const router = useRouter();

    const initialGuestState = useMemo(() => {
        if (typeof window === 'undefined') {
            return { token: '', isGuest: false, allowedModules: [], guestName: '', loading: false };
        }

        const token = new URLSearchParams(window.location.search).get('t') || '';
        return {
            token,
            isGuest: false,
            allowedModules: [],
            guestName: '',
            loading: Boolean(token),
        };
    }, []);

    const [shareToken, setShareToken] = useState(initialGuestState.token);
    const [isGuest, setIsGuest] = useState(initialGuestState.isGuest);
    const [allowedModules, setAllowedModules] = useState(initialGuestState.allowedModules);
    const [guestName, setGuestName] = useState(initialGuestState.guestName);
    const [loading, setLoading] = useState(initialGuestState.loading);

    useEffect(() => {
        if (typeof window === 'undefined') return undefined;

        const token = new URLSearchParams(window.location.search).get('t') || '';
        setShareToken(token);

        if (!token) {
            setIsGuest(false);
            setAllowedModules([]);
            setGuestName('');
            setLoading(false);
            return undefined;
        }

        const controller = new AbortController();
        setLoading(true);

        fetch(`/api/share/verify?t=${encodeURIComponent(token)}`, {
            cache: 'no-store',
            signal: controller.signal,
        })
            .then(async (response) => {
                const payload = await response.json().catch(() => null);
                if (!response.ok || payload?.success === false) {
                    throw new Error(payload?.error || 'Invalid or expired share token');
                }

                setIsGuest(true);
                setAllowedModules(Array.isArray(payload.permissions) ? payload.permissions : []);
                setGuestName(typeof payload.guestName === 'string' && payload.guestName.trim() ? payload.guestName.trim() : 'Guest');
            })
            .catch((error) => {
                if (controller.signal.aborted) return;
                console.error('Invalid or expired share token:', error.message);
                setIsGuest(false);
                setAllowedModules([]);
                setGuestName('');
                router.push('/');
            })
            .finally(() => {
                if (!controller.signal.aborted) setLoading(false);
            });

        return () => controller.abort();
    }, [router]);

    const value = useMemo(() => ({
        isGuest,
        allowedModules,
        guestName,
        loading,
        shareToken,
    }), [isGuest, allowedModules, guestName, loading, shareToken]);

    return (
        <GuestContext.Provider value={value}>
            {children}
        </GuestContext.Provider>
    );
}

/**
 * useGuest - Hook to access guest context
 * 
 * @returns {Object} Guest context value
 * @example
 * const { isGuest, allowedModules, guestName, loading } = useGuest();
 */
export function useGuest() {
    const context = useContext(GuestContext);
    if (context === null) {
        throw new Error('useGuest must be used within a GuestProvider');
    }
    return context;
}