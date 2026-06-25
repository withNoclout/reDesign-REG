'use client';

import { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';

const AuthContext = createContext(null);
const SESSION_KEY = 'reg_user_session';

function readStoredSession() {
    if (typeof window === 'undefined') return null;

    try {
        const stored = localStorage.getItem(SESSION_KEY);
        if (!stored) return null;
        const parsed = JSON.parse(stored);
        return parsed && typeof parsed === 'object' ? parsed : null;
    } catch (error) {
        console.warn('[Auth] Failed to restore session:', error.message);
        localStorage.removeItem(SESSION_KEY);
        return null;
    }
}

function persistSession(userData) {
    if (typeof window === 'undefined') return;

    try {
        localStorage.setItem(SESSION_KEY, JSON.stringify(userData));
    } catch (error) {
        console.warn('[Auth] Failed to store session:', error.message);
    }
}

function clearStoredSession() {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(SESSION_KEY);
}

function readString(value) {
    return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function firstNonEmpty(...values) {
    for (const value of values) {
        const normalized = readString(value);
        if (normalized) return normalized;
    }
    return null;
}

function buildDisplayName(personnelInfo = {}, studentInfo = {}) {
    return firstNonEmpty(
        studentInfo.full_name_th,
        studentInfo.full_name,
        studentInfo.name_th,
        studentInfo.name,
        personnelInfo.full_name_th,
        [personnelInfo.firstname_th, personnelInfo.lastname_th].filter(Boolean).join(' '),
    );
}

function buildDisplayNameEn(personnelInfo = {}, studentInfo = {}) {
    return firstNonEmpty(
        studentInfo.full_name_en,
        studentInfo.name_en,
        personnelInfo.full_name_en,
        [personnelInfo.firstname_en, personnelInfo.lastname_en].filter(Boolean).join(' '),
    );
}

function buildSsoSessionUser(statusData) {
    const session = statusData?.session;
    const user = statusData?.user;
    if (!session?.userCode || !user) return null;

    const studentInfo = user.studentInfo && typeof user.studentInfo === 'object' ? user.studentInfo : {};
    const personnelInfo = user.personnelInfo && typeof user.personnelInfo === 'object' ? user.personnelInfo : {};
    const userCode = firstNonEmpty(session.userCode, user.userCode);
    if (!userCode) return null;

    const displayName = firstNonEmpty(user.displayName, buildDisplayName(personnelInfo, studentInfo), userCode);
    const displayNameEn = firstNonEmpty(user.nameEn, buildDisplayNameEn(personnelInfo, studentInfo), displayName);
    const email = firstNonEmpty(user.email, studentInfo.email, personnelInfo.email);
    const username = firstNonEmpty(user.username, studentInfo.student_code, studentInfo.student_id, userCode);
    const accountType = firstNonEmpty(user.accountType, 'sso');

    return {
        username,
        usernameeng: displayNameEn,
        name: displayName,
        nameeng: displayNameEn,
        email: email || '',
        usercode: userCode,
        userid: userCode,
        userstatus: 'Y',
        userstatusdes: 'SSO',
        statusdes: accountType,
        statusdeseng: accountType.toUpperCase(),
        role: [accountType],
        reportdate: '',
        img: null,
        navimg: null,
        authProvider: 'kmutnb_sso',
        authMode: 'sso',
        ssoSubject: firstNonEmpty(session.subject, user.subject),
        legacyRegToken: false,
    };
}

function buildServerSessionUser(sessionData, stored) {
    if (!sessionData?.authenticated) return null;

    if (sessionData.authProvider === 'kmutnb_sso') {
        if (sessionData.user?.authProvider === 'kmutnb_sso') return sessionData.user;
        return buildSsoSessionUser(sessionData);
    }

    const user = sessionData.user && typeof sessionData.user === 'object' ? sessionData.user : {};
    const storedLegacy = stored && stored.authProvider !== 'kmutnb_sso' ? stored : {};
    const userCode = firstNonEmpty(user.usercode, sessionData.userId, user.userid, user.username);
    if (!userCode) return null;

    return {
        username: firstNonEmpty(user.username, userCode),
        usernameeng: firstNonEmpty(user.usernameeng, user.nameeng, userCode),
        name: firstNonEmpty(user.name, user.username, userCode),
        nameeng: firstNonEmpty(user.nameeng, user.usernameeng, user.name, userCode),
        email: firstNonEmpty(user.email, ''),
        usercode: userCode,
        userid: firstNonEmpty(user.userid, userCode),
        userstatus: firstNonEmpty(user.userstatus, 'Y'),
        userstatusdes: firstNonEmpty(user.userstatusdes, 'STUDENT'),
        statusdes: firstNonEmpty(user.statusdes, 'student'),
        statusdeseng: firstNonEmpty(user.statusdeseng, 'STUDENT'),
        role: Array.isArray(user.role) ? user.role : ['student'],
        reportdate: firstNonEmpty(user.reportdate, ''),
        img: firstNonEmpty(user.img, storedLegacy.img, storedLegacy.originalImg) || null,
        originalImg: firstNonEmpty(storedLegacy.originalImg, user.img) || null,
        navimg: firstNonEmpty(user.navimg, storedLegacy.navimg) || null,
        authProvider: 'legacy_reg',
        authMode: 'legacy',
        legacyRegToken: Boolean(sessionData.legacyRegToken),
    };
}


export function AuthProvider({ children }) {
    const router = useRouter();
    const [user, setUser] = useState(() => readStoredSession());
    const [isAuthenticated, setIsAuthenticated] = useState(() => Boolean(readStoredSession()));
    const [loading, setLoading] = useState(true);
    const [isVerified, setIsVerified] = useState(false);

    useEffect(() => {
        let cancelled = false;

        async function bootstrapAuth() {
            const stored = readStoredSession();

            try {
                const response = await fetch('/api/auth/session/status', {
                    cache: 'no-store',
                    credentials: 'same-origin',
                });
                const payload = await response.json().catch(() => null);

                if (cancelled) return;

                if (!response.ok || payload?.success === false) {
                    throw new Error(payload?.error?.message || `Session check failed (${response.status})`);
                }

                const sessionUser = buildServerSessionUser(payload?.data, stored);
                if (sessionUser) {
                    setUser(sessionUser);
                    setIsAuthenticated(true);
                    persistSession(sessionUser);
                    return;
                }

                clearStoredSession();
                setUser(null);
                setIsAuthenticated(false);
            } catch (error) {
                if (!cancelled) {
                    clearStoredSession();
                    setUser(null);
                    setIsAuthenticated(false);
                }
                console.warn('[Auth] Failed to verify server session:', error.message);
            } finally {
                if (!cancelled) setLoading(false);
            }
        }

        bootstrapAuth();
        return () => {
            cancelled = true;
        };
    }, []);

    useEffect(() => {
        const stored = readStoredSession();
        if (!stored && isAuthenticated) {
            setIsAuthenticated(false);
            setUser(null);
        }
    }, [isAuthenticated]);

    const login = useCallback((userData) => {
        setUser(userData);
        setIsAuthenticated(true);
        persistSession(userData);
    }, []);

    const markAsVerified = useCallback(() => {
        setIsVerified(true);
    }, []);

    const logout = useCallback(async () => {
        setUser(null);
        setIsAuthenticated(false);
        setIsVerified(false);
        clearStoredSession();

        try {
            await fetch('/api/auth/logout', { method: 'POST' });
        } catch {
            // Ignore logout transport failures; local session is already cleared.
        }

        router.push('/');
    }, [router]);

    const updateProfileImage = useCallback(async (newImgUrl) => {
        if (!user?.usercode) return;

        let finalParams = { img: newImgUrl };

        if (newImgUrl) {
            try {
                const res = await fetch('/api/user/upload-image', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ image: newImgUrl }),
                });

                const data = await res.json();
                if (data.success && data.path) {
                    finalParams.img = data.path;
                } else {
                    console.warn('Upload failed, using Base64 fallback in session only');
                }
            } catch (err) {
                console.error('Upload error:', err);
            }
        } else {
            try {
                await fetch('/api/user/upload-image', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ reset: true }),
                });
            } catch (err) {
                console.error('Reset upload error:', err);
            }
            finalParams.img = null;
        }

        setUser((prev) => {
            const updated = {
                ...prev,
                img: finalParams.img || (newImgUrl === null ? (prev.originalImg || null) : prev.img),
            };
            persistSession(updated);
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
        markAsVerified,
    }), [user, isAuthenticated, loading, isVerified, login, logout, updateProfileImage, markAsVerified]);

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
