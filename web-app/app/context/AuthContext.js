'use client';

import { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
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
    const [loading, setLoading] = useState(true);
    const [isVerified, setIsVerified] = useState(false); // Drive connected status

    // Restore session on mount
    useEffect(() => {
        try {
            const stored = sessionStorage.getItem(SESSION_KEY);
            if (stored) {
                const parsed = JSON.parse(stored);
                if (parsed?.usercode) {
                    const customImg = localStorage.getItem(`custom_profile_img_${parsed.usercode}`);
                    if (customImg && !parsed.img) parsed.img = customImg;

                    // Check verification status
                    const verified = localStorage.getItem(`drive_connected_${parsed.usercode}`) === 'true';
                    setIsVerified(verified);
                }
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
        if (userData?.usercode) {
            const customImg = localStorage.getItem(`custom_profile_img_${userData.usercode}`);
            if (customImg && !userData.img) userData.img = customImg;

            // Check verification status
            const verified = localStorage.getItem(`drive_connected_${userData.usercode}`) === 'true';
            setIsVerified(verified);
        }

        setUser(userData);
        setIsAuthenticated(true);
        try {
            sessionStorage.setItem(SESSION_KEY, JSON.stringify(userData));
        } catch (e) {
            console.warn('[Auth] Failed to store session:', e.message);
        }
    }, []);

    // Connect Google Drive (Mock)
    const connectGoogleDrive = useCallback(async () => {
        if (!user?.usercode) return false;

        // Simulate API call / Popup
        await new Promise(resolve => setTimeout(resolve, 1000));

        localStorage.setItem(`drive_connected_${user.usercode}`, 'true');
        setIsVerified(true);
        return true;
    }, [user]);

    // Logout: clear everything
    const logout = useCallback(async () => {
        setUser(null);
        setIsAuthenticated(false);
        setIsVerified(false);
        sessionStorage.removeItem(SESSION_KEY);

        try {
            await fetch('/api/auth/logout', { method: 'POST' });
        } catch (e) { }

        router.push('/');
    }, [router]);

    // Update profile image
    const updateProfileImage = useCallback(async (newImgUrl) => {
        if (!user?.usercode) return;

        // Ensure verified (Safety check, though UI gates it too)
        // logic: if not verified, maybe return or throw? 
        // For now, assume UI handles it, or check here:
        // if (!isVerified) return; // Uncomment to enforce strict check

        const key = `custom_profile_img_${user.usercode}`;
        let finalParams = { img: newImgUrl };

        if (newImgUrl) {
            // Upload to server to save as file (for repo commit)
            try {
                const res = await fetch('/api/user/upload-image', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        image: newImgUrl
                    })
                });

                const data = await res.json();
                if (data.success && data.path) {
                    finalParams.img = data.path; // Use server path
                } else {
                    console.warn('Upload failed, using Base64 fallback');
                }
            } catch (err) {
                console.error('Upload error:', err);
            }

            localStorage.setItem(key, finalParams.img);
        } else {
            try {
                await fetch('/api/user/upload-image', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ reset: true })
                });
            } catch (err) {
                console.error('Reset upload error:', err);
            }
            localStorage.removeItem(key);
            finalParams.img = null;
        }

        setUser(prev => {
            const updated = {
                ...prev,
                img: finalParams.img || (newImgUrl === null ? (prev.originalImg || null) : prev.img)
            };
            sessionStorage.setItem(SESSION_KEY, JSON.stringify(updated));
            return updated;
        });
    }, [user]);

    const value = useMemo(() => ({
        user,
        isAuthenticated,
        loading,
        isVerified,
        login,
        logout,
        updateProfileImage,
        connectGoogleDrive,
    }), [user, isAuthenticated, loading, isVerified, login, logout, updateProfileImage, connectGoogleDrive]);

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
