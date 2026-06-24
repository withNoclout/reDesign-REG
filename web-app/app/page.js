'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import axios from 'axios';

import LoginTransitionShell from './components/LoginTransitionShell';
import { useAuth } from './context/AuthContext';

function getSafeReturnPath(value) {
    if (typeof value !== 'string') return null;
    if (!value.startsWith('/') || value.startsWith('//')) return null;
    return value;
}


export default function Home() {
    const { login } = useAuth();
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [ssoEnabled, setSsoEnabled] = useState(false);
    const [ssoConfigured, setSsoConfigured] = useState(false);
    const [ssoMissingConfig, setSsoMissingConfig] = useState([]);
    const [ssoChecking, setSsoChecking] = useState(true);
    const [ssoPending, setSsoPending] = useState(false);
    const [returnTo, setReturnTo] = useState(null);
    const axiosSourceRef = useRef(null);

    const LANDING_PATH = returnTo || process.env.NEXT_PUBLIC_LANDING_PATH || '/main';
    const LOGIN_FORM_ID = 'production-login-form';

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        setReturnTo(getSafeReturnPath(params.get('returnTo')));
    }, []);


    useEffect(() => {
        let cancelled = false;

        async function loadSsoStatus() {
            try {
                const response = await fetch('/api/auth/sso/status', {
                    cache: 'no-store',
                    credentials: 'same-origin',
                });
                const payload = await response.json().catch(() => null);
                if (cancelled) return;

                setSsoEnabled(Boolean(payload?.data?.enabled));
                setSsoConfigured(Boolean(payload?.data?.configured));
                setSsoMissingConfig(Array.isArray(payload?.data?.missingConfig) ? payload.data.missingConfig : []);
            } catch (cause) {
                if (!cancelled) {
                    setSsoEnabled(false);
                    setSsoConfigured(false);
                    setSsoMissingConfig([]);
                }
                console.warn('[Login] Failed to load SSO status:', cause.message);
            } finally {
                if (!cancelled) setSsoChecking(false);
            }
        }

        loadSsoStatus();
        return () => {
            cancelled = true;
        };
    }, []);

    useEffect(() => {
        return () => {
            if (axiosSourceRef.current) {
                axiosSourceRef.current.cancel('Component unmounted');
            }
        };
    }, []);

    const readCurrentCredentials = useCallback(() => {
        if (typeof document === 'undefined') {
            return { username, password };
        }

        const usernameElement = document.getElementById('username');
        const passwordElement = document.getElementById('password');
        const nextUsername = usernameElement && 'value' in usernameElement
            ? String(usernameElement.value || '').replace(/[^\x20-\x7E]/g, '')
            : username;
        const nextPassword = passwordElement && 'value' in passwordElement
            ? String(passwordElement.value || '')
            : password;

        return { username: nextUsername, password: nextPassword };
    }, [password, username]);

    const validateForm = useCallback((credentials = { username, password }) => {
        const nextUsername = credentials.username.trim();
        const nextPassword = credentials.password;

        if (!nextUsername) {
            setError('กรุณากรอกรหัสนักศึกษา / Username');
            return false;
        }

        if (nextUsername.length < 3) {
            setError('รหัสนักศึกษาต้องมีอย่างน้อย 3 ตัวอักษร');
            return false;
        }

        if (!nextPassword.trim()) {
            setError('กรุณากรอกรหัสผ่าน / Password');
            return false;
        }

        if (nextPassword.length < 4) {
            setError('รหัสผ่านต้องมีอย่างน้อย 4 ตัวอักษร');
            return false;
        }

        return true;
    }, [password, username]);

    const handleSsoLogin = useCallback(() => {
        if (loading || ssoPending || ssoChecking) return;

        setError('');
        if (!ssoEnabled) {
            setError('SSO is disabled');
            return;
        }

        if (!ssoConfigured) {
            setError(
                ssoMissingConfig.length
                    ? `SSO not ready: ${ssoMissingConfig.join(', ')}`
                    : 'SSO not ready',
            );
            return;
        }

        setSsoPending(true);
        window.location.assign(`/api/auth/sso/start?returnTo=${encodeURIComponent(LANDING_PATH)}`);
    }, [LANDING_PATH, loading, ssoChecking, ssoConfigured, ssoEnabled, ssoMissingConfig, ssoPending]);

    const handleLoginRequest = useCallback(async () => {
        if (loading || ssoPending) return false;

        setError('');
        const credentials = readCurrentCredentials();
        if (credentials.username !== username) {
            setUsername(credentials.username);
        }
        if (credentials.password !== password) {
            setPassword(credentials.password);
        }
        if (!validateForm(credentials)) return false;

        setLoading(true);
        axiosSourceRef.current = axios.CancelToken.source();

        try {
            const response = await axios.post('/api/auth/login', {
                username: credentials.username.trim(),
                password: credentials.password,
            }, {
                cancelToken: axiosSourceRef.current.token,
                timeout: 10000,
            });

            if (!response.data.success) {
                throw new Error(response.data.message || 'รหัสผู้ใช้หรือรหัสผ่านไม่ถูกต้อง');
            }

            const sessionResponse = await fetch('/api/auth/session/status', {
                cache: 'no-store',
                credentials: 'same-origin',
            });
            const sessionPayload = await sessionResponse.json().catch(() => null);
            if (!sessionResponse.ok || sessionPayload?.success === false || !sessionPayload?.data?.authenticated || !sessionPayload?.data?.user) {
                throw new Error(sessionPayload?.error?.message || 'ไม่สามารถยืนยัน session หลังเข้าสู่ระบบได้ กรุณาลองใหม่อีกครั้ง');
            }

            login(sessionPayload.data.user);
            setError('');
            return true;
        } catch (cause) {
            if (axios.isCancel(cause)) {
                console.log('[Login] Request canceled:', cause.message);
                return false;
            }

            if (cause.response) {
                setError(cause.response.data?.message || 'เกิดข้อผิดพลาดในการเชื่อมต่อ');
            } else if (cause.request) {
                setError('ไม่สามารถเชื่อมต่อกับเซิร์ฟเวอร์ได้ กรุณาตรวจสอบอินเทอร์เน็ต');
            } else {
                setError(cause.message || 'เกิดข้อผิดพลาดในการเชื่อมต่อ');
            }
            return false;
        } finally {
            setLoading(false);
            axiosSourceRef.current = null;
        }
    }, [loading, login, password, readCurrentCredentials, ssoPending, username, validateForm]);

    const handleLoginComplete = useCallback(() => {
        setPassword('');
        window.location.assign(LANDING_PATH);
    }, [LANDING_PATH]);

    const ssoDisabled = loading || ssoPending || ssoChecking || !ssoEnabled || !ssoConfigured;
    const ssoTitle = ssoEnabled
        ? (ssoConfigured ? 'Sign in with KMUTNB SSO' : 'KMUTNB SSO is not configured yet')
        : 'KMUTNB SSO is disabled';

    return (
        <LoginTransitionShell
            error={error}
            formId={LOGIN_FORM_ID}
            onLoginComplete={handleLoginComplete}
            onLoginStart={handleLoginRequest}
            onPasswordChange={setPassword}
            onSsoLogin={handleSsoLogin}
            onUsernameChange={setUsername}
            password={password}
            ssoDisabled={ssoDisabled}
            ssoTitle={ssoTitle}
            submitDisabled={loading || ssoPending}
            username={username}
        />
    );
}
