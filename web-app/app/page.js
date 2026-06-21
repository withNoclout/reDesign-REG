'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';

import { useAuth } from './context/AuthContext';
import styles from './page.module.css';


export default function Home() {
    const router = useRouter();
    const auth = useAuth();
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [ssoEnabled, setSsoEnabled] = useState(false);
    const [ssoConfigured, setSsoConfigured] = useState(false);
    const [ssoMissingConfig, setSsoMissingConfig] = useState([]);
    const [ssoChecking, setSsoChecking] = useState(true);
    const [ssoPending, setSsoPending] = useState(false);
    const axiosSourceRef = useRef(null);

    const LANDING_PATH = process.env.NEXT_PUBLIC_LANDING_PATH || '/main';


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

    const validateForm = useCallback(() => {
        if (!username.trim()) {
            setError('กรุณากรอกรหัสนักศึกษา / Username');
            return false;
        }

        if (username.trim().length < 3) {
            setError('รหัสนักศึกษาต้องมีอย่างน้อย 3 ตัวอักษร');
            return false;
        }

        if (!password.trim()) {
            setError('กรุณากรอกรหัสผ่าน / Password');
            return false;
        }

        if (password.length < 4) {
            setError('รหัสผ่านต้องมีอย่างน้อย 4 ตัวอักษร');
            return false;
        }

        return true;
    }, [username, password]);


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
                    : 'SSO not ready'
            );
            return;
        }

        setSsoPending(true);
        window.location.assign(`/api/auth/sso/start?returnTo=${encodeURIComponent(LANDING_PATH)}`);
    }, [LANDING_PATH, loading, ssoChecking, ssoConfigured, ssoEnabled, ssoMissingConfig, ssoPending]);

    const handleLogin = async (event) => {
        event.preventDefault();
        if (loading || ssoPending) return;

        setError('');
        if (!validateForm()) return;

        setLoading(true);
        axiosSourceRef.current = axios.CancelToken.source();

        try {
            const response = await axios.post('/api/auth/login', {
                username: username.trim(),
                password,
            }, {
                cancelToken: axiosSourceRef.current.token,
                timeout: 10000,
            });

            if (!response.data.success) {
                throw new Error(response.data.message || 'รหัสผู้ใช้หรือรหัสผ่านไม่ถูกต้อง');
            }

            auth.login(response.data.data);
            setPassword('');
            setError('');
            router.push(LANDING_PATH);
        } catch (cause) {
            if (axios.isCancel(cause)) {
                console.log('[Login] Request canceled:', cause.message);
                return;
            }

            if (cause.response) {
                setError(cause.response.data?.message || 'เกิดข้อผิดพลาดในการเชื่อมต่อ');
            } else if (cause.request) {
                setError('ไม่สามารถเชื่อมต่อกับเซิร์ฟเวอร์ได้ กรุณาตรวจสอบอินเทอร์เน็ต');
            } else {
                setError(cause.message || 'เกิดข้อผิดพลาดในการเชื่อมต่อ');
            }
        } finally {
            setLoading(false);
            axiosSourceRef.current = null;
        }
    };

    return (
        <main className={styles.pageShell} id="main-content">
            <section className={styles.splitLayout} aria-label="Login">
                <div className={styles.visualPane} aria-hidden="true"></div>

                <div className={styles.authPane}>
                    <div className={`${styles.loginCard} ${error ? styles.shake : ''}`}>
                        <div className={styles.wordmarkWrap}>
                            <svg className={styles.wordmarkLogo} width="136" height="49" viewBox="0 0 136 49" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                                <g clipPath="url(#clip0_179_64)">
                                    <path d="M0 1.38199H21.7478C28.7289 1.15886 34.579 6.81644 34.5537 13.6977C34.5319 20.5501 28.6963 26.1537 21.7478 25.9342H10.8739C18.7684 33.3733 26.6628 40.8087 34.5537 48.2478" stroke="black" strokeWidth="4" strokeMiterlimit="10" />
                                    <path d="M81.9276 1.37842H49.1863L63.9241 24.8149L49.1863 48.2514H81.9276" stroke="black" strokeWidth="4" strokeMiterlimit="10" />
                                    <path d="M116.844 24.8149H135.275V36.9434" stroke="black" strokeWidth="4" strokeMiterlimit="10" />
                                    <path d="M135.275 16.3861V9.0694C134.34 7.96092 128.008 0.723387 117.732 0.719788C115.811 0.719788 107.282 0.968117 101.783 7.51105C97.5245 12.5748 97.597 18.4159 97.6768 24.8149C97.7565 31.2211 97.8254 37.0658 102.146 41.9424C108.098 48.6581 117.504 48.3378 119.182 48.2514C122.161 48.2622 125.141 48.273 128.124 48.2802" stroke="black" strokeWidth="4" strokeMiterlimit="10" />
                                </g>
                                <defs>
                                    <clipPath id="clip0_179_64">
                                        <rect width="136" height="49" fill="white" />
                                    </clipPath>
                                </defs>
                            </svg>
                        </div>

                        <div className={styles.loginHeader}>
                            <h1 className={styles.loginTitle}>Log in</h1>
                        </div>

                        <button
                            type="button"
                            className={styles.altAction}
                            aria-disabled={!ssoEnabled || !ssoConfigured}
                            disabled={loading || ssoPending || ssoChecking || !ssoEnabled || !ssoConfigured}
                            onClick={handleSsoLogin}
                            title={ssoEnabled ? (ssoConfigured ? 'Sign in with KMUTNB SSO' : 'KMUTNB SSO is not configured yet') : 'KMUTNB SSO is disabled'}
                        >
                            <span className={styles.ssoButtonText} aria-hidden="true">SSO</span>
                        </button>

                        <div className={styles.divider} aria-hidden="true">
                            <svg className={styles.contractDivider} width="237" height="16" viewBox="0 0 237 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M108.183 14.7727L108.183 15.2727H108.683L108.683 14.773L108.183 14.7727ZM108.183 0.5L108.183 8.9407e-08H107.683L107.683 0.49975L108.183 0.5ZM128.001 0.5L128.501 0.50025L128.501 8.9407e-08H128.001L128.001 0.5ZM121.001 8.5L121.169 8.02914L120.751 8.93298L121.001 8.5ZM131.866 14.7727L131.616 15.2057L131.732 15.2727H131.866L131.866 14.7727ZM116.001 0.5L116.501 0.50025L116.501 8.9407e-08H116.001L116.001 0.5ZM118.001 0.5L118.001 8.9407e-08H117.501L117.501 0.49975L118.001 0.5ZM0.000293911 14.7727L0.000543683 15.2727H108.183L108.183 14.7727L108.183 14.2727H4.41389e-05L0.000293911 14.7727ZM108.183 14.7727L108.683 14.773L108.683 0.50025L108.183 0.5L107.683 0.49975L107.683 14.7725L108.183 14.7727ZM128.001 0.5L127.501 0.49975C127.501 2.20852 127.156 4.60755 126.168 6.3117C125.679 7.15583 125.053 7.79611 124.265 8.12439C123.484 8.44951 122.478 8.49681 121.169 8.02914L121.001 8.5L120.833 8.97086C122.324 9.50319 123.593 9.48799 124.65 9.04749C125.699 8.61014 126.473 7.78167 127.034 6.8133C128.146 4.89245 128.501 2.29148 128.501 0.50025L128.001 0.5ZM121.001 8.5L120.751 8.93298L131.616 15.2057L131.866 14.7727L132.115 14.3397L121.251 8.06702L121.001 8.5ZM108.183 0.5L108.183 1H116.001L116.001 0.5L116.001 8.9407e-08H108.183L108.183 0.5ZM116.001 0.5L115.501 0.49975L115.501 7.99975L116.001 8L116.501 8.00025L116.501 0.50025L116.001 0.5ZM128.001 0.5L128.001 8.9407e-08H118.001L118.001 0.5L118.001 1H128.001L128.001 0.5ZM118.001 0.5L117.501 0.49975L117.501 3.99975L118.001 4L118.501 4.00025L118.501 0.50025L118.001 0.5ZM131.866 14.7727L131.866 15.2727H237.001L237.001 14.7727L237.001 14.2727H131.865L131.866 14.7727Z" fill="black" />
                            </svg>
                        </div>

                        <form className={styles.loginForm} onSubmit={handleLogin}>
                            <div className={styles.fieldStack}>
                                <div className={styles.inputGroup}>
                                    <label className={styles.visuallyHidden} htmlFor="username">Username</label>
                                    <input
                                        id="username"
                                        type="text"
                                        className={styles.inputField}
                                        placeholder="email or username"
                                        required
                                        value={username}
                                        onChange={(event) => setUsername(event.target.value)}
                                        autoComplete="username"
                                    />
                                    {!username && (
                                        <span className={styles.inputGlyph} aria-hidden="true">user</span>
                                    )}

                                </div>

                                <div className={`${styles.inputGroup} ${styles.passwordRow}`}>
                                    <label className={styles.visuallyHidden} htmlFor="password">Password</label>
                                    <input
                                        id="password"
                                        type="password"
                                        className={styles.inputField}
                                        placeholder="password"
                                        required
                                        value={password}
                                        onChange={(event) => setPassword(event.target.value)}
                                        autoComplete="current-password"
                                    />
                                    <span className={`${styles.inputGlyph} ${password ? styles.passwordMask : ''}`} aria-hidden="true">
                                        {password ? '*'.repeat(password.length) : 'pass'}
                                    </span>
                                </div>

                                <button type="submit" className={styles.loginSubmit} disabled={loading || ssoPending} aria-busy={loading}>
                                    <svg className={styles.loginArrow} width="19" height="15" viewBox="0 0 19 15" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                                        <path d="M1 6.36395H0L0 8.36395H1L1 7.36395L1 6.36395ZM18.7071 8.07106C19.0976 7.68054 19.0976 7.04737 18.7071 6.65685L12.3431 0.292885C11.9526 -0.0976396 11.3195 -0.0976396 10.9289 0.292885C10.5384 0.683409 10.5384 1.31657 10.9289 1.7071L16.5858 7.36395L10.9289 13.0208C10.5384 13.4113 10.5384 14.0445 10.9289 14.435C11.3195 14.8255 11.9526 14.8255 12.3431 14.435L18.7071 8.07106ZM1 7.36395L1 8.36395L18 8.36395V7.36395V6.36395L1 6.36395L1 7.36395Z" fill="white" />
                                    </svg>
                                </button>
                            </div>

                            {error && (
                                <div className={styles.errorMessage} role="alert" aria-live="assertive">
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                                        <circle cx="12" cy="12" r="10" />
                                        <line x1="15" y1="9" x2="9" y2="15" />
                                        <line x1="9" y1="9" x2="15" y2="15" />
                                    </svg>
                                    <span>{error}</span>
                                </div>
                            )}
                        </form>
                        <div className={styles.contactBlock}>
                            <p className={styles.contactValue}>contract ?</p>
                        </div>
                    </div>
                </div>
            </section>
        </main>
    );
}
