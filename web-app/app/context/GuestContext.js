'use client';

import { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { verifyShareToken } from '../../utils/jwt';

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
            return { isGuest: false, allowedModules: [], guestName: '' };
        }
        const params = new URLSearchParams(window.location.search);
        const token = params.get('t');
        if (token) {
            const decoded = verifyShareToken(token);
            if (decoded) {
                console.log('Guest mode activated:', decoded.guestName);
                return {
                    isGuest: true,
                    allowedModules: decoded.permissions || [],
                    guestName: decoded.guestName || 'Guest'
                };
            }
        }
        return { isGuest: false, allowedModules: [], guestName: '' };
    }, []);

    const [isGuest, setIsGuest] = useState(initialGuestState.isGuest);
    const [allowedModules, setAllowedModules] = useState(initialGuestState.allowedModules);
    const [guestName, setGuestName] = useState(initialGuestState.guestName);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        // Just handle invalid token redirect here if needed
        if (typeof window !== 'undefined') {
            const params = new URLSearchParams(window.location.search);
            const token = params.get('t');
            if (token && !isGuest) {
                console.error('Invalid or expired share token');
                router.push('/');
            }
        }
    }, [router, isGuest]);

    const value = useMemo(() => ({
        isGuest,
        allowedModules,
        guestName,
        loading
    }), [isGuest, allowedModules, guestName, loading]);

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