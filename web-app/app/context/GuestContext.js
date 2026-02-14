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
    const [isGuest, setIsGuest] = useState(false);
    const [allowedModules, setAllowedModules] = useState([]);
    const [guestName, setGuestName] = useState('');
    const [loading, setLoading] = useState(true);
    const router = useRouter();

    useEffect(() => {
        // Check if share token in URL
        if (typeof window === 'undefined') return;

        const params = new URLSearchParams(window.location.search);
        const token = params.get('t');

        if (token) {
            // Verify token
            const decoded = verifyShareToken(token);

            if (decoded) {
                // Valid token - activate guest mode
                setIsGuest(true);
                setAllowedModules(decoded.permissions || []);
                setGuestName(decoded.guestName || 'Guest');
                console.log('Guest mode activated:', decoded.guestName);
            } else {
                // Invalid or expired token - redirect to login
                console.error('Invalid or expired share token');
                router.push('/');
            }
        }

        setLoading(false);
    }, [router]);

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