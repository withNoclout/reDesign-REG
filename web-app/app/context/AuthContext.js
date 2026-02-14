'use client';

import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';

const AuthContext = createContext(null);

/**
 * User profile shape (from decoded tokenuser JWT):
 * {
 *   username: string,       // ชื่อ (ไทย)
 *   usernameeng: string,    // ชื่อ (อังกฤษ)
 *   name: string,           // ชื่อเต็ม (ไทย)
 *   nameeng: string,        // ชื่อเต็ม (อังกฤษ)
 *   email: string,
 *   usercode: string,       // รหัสนักศึกษา
 *   userid: string,
 *   userstatus: string,     // "Y" = active
 *   userstatusdes: string,  // "ปกติ"
 *   statusdes: string,      // "ปกติ"
 *   statusdeseng: string,   // "Regular"
 *   role: string[],         // ["student", ""]
 *   reportdate: string,     // วันที่รายงานตัว
 *   img: string,            // Profile image URL
 *   navimg: string,         // Nav profile image URL
 * }
 */

const SESSION_KEY = 'reg_user_session';

export function AuthProvider({ children }) {
    const router = useRouter();
    const [user, setUser] = useState(null);
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [loading, setLoading] = useState(true); // true until we check sessionStorage

    // Restore session on mount
    useEffect(() => {
        try {
            const stored = sessionStorage.getItem(SESSION_KEY);
            if (stored) {
                const parsed = JSON.parse(stored);
                setUser(parsed);
                setIsAuthenticated(true);
            }
        } catch (e) {
            console.warn('[Auth] Failed to restore session:', e.message);
            sessionStorage.removeItem(SESSION_KEY);
        } finally {
            setLoading(false);
        }
    }, []);

    // Login: store user data from API response
    const login = useCallback((userData) => {
        setUser(userData);
        setIsAuthenticated(true);
        try {
            sessionStorage.setItem(SESSION_KEY, JSON.stringify(userData));
        } catch (e) {
            console.warn('[Auth] Failed to store session:', e.message);
        }
    }, []);

    // Logout: clear everything
    const logout = useCallback(async () => {
        setUser(null);
        setIsAuthenticated(false);
        sessionStorage.removeItem(SESSION_KEY);

        // Clear server-side cookie
        try {
            await fetch('/api/auth/logout', { method: 'POST' });
        } catch (e) {
            // Ignore – we still clear client state
        }

        router.push('/');
    }, [router]);

    const value = {
        user,
        isAuthenticated,
        loading,
        login,
        logout,
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}

export default AuthContext;
