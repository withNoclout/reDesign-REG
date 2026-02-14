'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

const LAST_USERS_KEY = 'reg_last_users';
const MAX_SAVED_USERS = 3;
import { useRouter } from 'next/navigation';
import axios from 'axios';
import { useAuth } from './context/AuthContext';
import './globals.css';

export default function Home() {
    const router = useRouter();
    const auth = useAuth();
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [menuOpen, setMenuOpen] = useState(false);
    const [shakeTrigger, setShakeTrigger] = useState(0);

    // Last-login suggestion state
    const [lastUsers, setLastUsers] = useState([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const usernameGroupRef = useRef(null);

    // Ref for axios cancellation
    const axiosSourceRef = useRef(null);

    // Navigation path from environment
    const LANDING_PATH = process.env.NEXT_PUBLIC_LANDING_PATH || '/landing';

    // Load last users from localStorage on mount
    useEffect(() => {
        try {
            const stored = localStorage.getItem(LAST_USERS_KEY);
            if (stored) {
                const parsed = JSON.parse(stored);
                if (Array.isArray(parsed)) setLastUsers(parsed.slice(0, MAX_SAVED_USERS));
            }
        } catch (e) {
            console.warn('[Login] Failed to load last users:', e.message);
        }
    }, []);

    // Click-outside to close suggestions
    useEffect(() => {
        function handleClickOutside(e) {
            if (usernameGroupRef.current && !usernameGroupRef.current.contains(e.target)) {
                setShowSuggestions(false);
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Cleanup on unmount
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
        if (username.length < 3) {
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

    const togglePassword = () => setShowPassword(!showPassword);
    const toggleMenu = () => setMenuOpen(!menuOpen);

    const handleLogin = async (e) => {
        e.preventDefault();

        // Prevent multiple submissions
        if (loading) return;

        // Reset previous error
        setError('');

        // Validate form before submission
        if (!validateForm()) {
            setShakeTrigger(prev => prev + 1);
            return;
        }

        setLoading(true);

        // Create new cancellation token for this request
        axiosSourceRef.current = axios.CancelToken.source();

        try {
            const response = await axios.post('/api/auth/login', {
                username: username.trim(),
                password: password
            }, {
                cancelToken: axiosSourceRef.current.token,
                timeout: 10000 // 10 second timeout
            });

            if (response.data.success) {
                // Store user profile in AuthContext
                auth.login(response.data.data);

                // Save username to last-login list
                try {
                    const trimmed = username.trim();
                    const prev = JSON.parse(localStorage.getItem(LAST_USERS_KEY) || '[]');
                    const updated = [trimmed, ...prev.filter(u => u !== trimmed)].slice(0, MAX_SAVED_USERS);
                    localStorage.setItem(LAST_USERS_KEY, JSON.stringify(updated));
                    setLastUsers(updated);
                } catch (e) { /* ignore */ }

                // Clear sensitive data from state
                setPassword('');
                setError('');

                // Navigate to landing page
                router.push(LANDING_PATH);
            } else {
                throw new Error(response.data.message || 'รหัสผู้ใช้หรือรหัสผ่านไม่ถูกต้อง');
            }
        } catch (err) {
            if (axios.isCancel(err)) {
                console.log('Request canceled:', err.message);
                return;
            }

            // Handle different error types
            let errorMessage = 'เกิดข้อผิดพลาดในการเชื่อมต่อ';

            if (err.response) {
                // Server responded with error status
                errorMessage = err.response.data?.message || errorMessage;
            } else if (err.request) {
                // Request made but no response
                errorMessage = 'ไม่สามารถเชื่อมต่อกับเซิร์ฟเวอร์ได้ กรุณาตรวจสอบอินเทอร์เน็ต';
            } else {
                // Other errors
                errorMessage = err.message || errorMessage;
            }

            setError(errorMessage);
            setShakeTrigger(prev => prev + 1);
        } finally {
            setLoading(false);
            axiosSourceRef.current = null;
        }
    };

    return (
        <main className="main-content">
            <div className="bg-image"></div>
            <div className="bg-overlay"></div>

            {/* Navbar */}
            <nav className={`navbar ${menuOpen ? 'active' : ''}`} id="navbar">
                <div className="nav-container">
                    <a href="#" className="nav-brand">
                        <svg className="nav-logo" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <circle cx="20" cy="20" r="18" stroke="white" strokeWidth="2" fill="rgba(255,255,255,0.15)" />
                            <text x="20" y="26" textAnchor="middle" fill="white" fontSize="14" fontWeight="700" fontFamily="Montserrat">R</text>
                        </svg>
                        <span className="brand-text">REG <span className="brand-accent">KMUTNB</span></span>
                    </a>

                    <ul className={`nav-menu ${menuOpen ? 'active' : ''}`}>
                        <li><a href="#" className="nav-link active min-h-[44px] flex items-center">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" /></svg>
                            หน้าหลัก
                        </a></li>
                        <li><a href="#" className="nav-link min-h-[44px] flex items-center">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /></svg>
                            ระเบียนประวัติ
                        </a></li>
                        <li><a href="#" className="nav-link min-h-[44px] flex items-center">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>
                            ตารางเรียน/สอบ
                        </a></li>
                        <li><a href="#" className="nav-link min-h-[44px] flex items-center">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="12 2 2 7 12 12 22 7 12 2" /><polyline points="2 17 12 22 22 17" /><polyline points="2 12 12 17 22 12" /></svg>
                            โครงสร้างหลักสูตร
                        </a></li>
                        <li><a href="#" className="nav-link min-h-[44px] flex items-center">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" /></svg>
                            ค้นหาห้องว่าง
                        </a></li>
                        <li><a href="#" className="nav-link min-h-[44px] flex items-center">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" /></svg>
                            ข่าวสาร
                        </a></li>
                        <li><a href="#" className="nav-link min-h-[44px] flex items-center">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>
                            ถาม-ตอบ
                        </a></li>
                    </ul>

                    <div className="nav-right">
                        <button className="nav-login-btn min-h-[44px]">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" /><polyline points="10 17 15 12 10 7" /><line x1="15" y1="12" x2="3" y2="12" /></svg>
                            เข้าสู่ระบบ
                        </button>
                        <button className="hamburger min-h-[44px] min-w-[44px]" onClick={toggleMenu}>
                            <span></span><span></span><span></span>
                        </button>
                    </div>
                </div>
            </nav>

            {/* Login Box */}
            <div className="login-wrapper">
                <div className={`login-box ${error ? 'animate-shake' : ''}`}>
                    <div className="login-header">
                        <div className="university-crest">
                            <img src="/BG_image/logo_transparent.png" alt="University Logo" className="w-full h-full object-contain" />
                        </div>
                        <h1 className="login-title">ระบบลงทะเบียนนักศึกษา</h1>
                        <p className="login-subtitle">King Mongkut's University of Technology North Bangkok</p>
                    </div>

                    <form className="login-form" onSubmit={handleLogin}>
                        <div className="input-group" ref={usernameGroupRef}>
                            <div className="input-icon">
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
                            </div>
                            <input
                                type="text"
                                className="glass-input min-h-[44px]"
                                placeholder="รหัสนักศึกษา / Username"
                                required
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                onFocus={() => lastUsers.length > 0 && setShowSuggestions(true)}
                                autoComplete="username"
                            />

                            {/* Last-login suggestion dropdown */}
                            {showSuggestions && lastUsers.length > 0 && (
                                <div className="username-suggestions">
                                    <div className="suggestions-header">
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
                                        <span>เข้าสู่ระบบล่าสุด</span>
                                    </div>
                                    {lastUsers.map((savedUser) => (
                                        <div key={savedUser} className="suggestion-item">
                                            <button
                                                type="button"
                                                className="suggestion-btn"
                                                onClick={() => {
                                                    setUsername(savedUser);
                                                    setShowSuggestions(false);
                                                }}
                                            >
                                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
                                                <span>{savedUser}</span>
                                            </button>
                                            <button
                                                type="button"
                                                className="suggestion-remove"
                                                title="ลบ"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    const updated = lastUsers.filter(u => u !== savedUser);
                                                    setLastUsers(updated);
                                                    localStorage.setItem(LAST_USERS_KEY, JSON.stringify(updated));
                                                    if (updated.length === 0) setShowSuggestions(false);
                                                }}
                                            >
                                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div className="input-group">
                            <div className="input-icon">
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
                            </div>
                            <input
                                type={showPassword ? "text" : "password"}
                                className="glass-input min-h-[44px]"
                                placeholder="รหัสผ่าน / Password"
                                required
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                autoComplete="current-password"
                            />
                            <button type="button" className="toggle-password min-h-[44px] min-w-[44px]" onClick={togglePassword}>
                                {showPassword ? (
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
                                ) : (
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>
                                )}
                            </button>
                        </div>

                        {error && (
                            <div className="error-message active" role="alert" aria-live="assertive">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                                    <circle cx="12" cy="12" r="10" />
                                    <line x1="15" y1="9" x2="9" y2="15" />
                                    <line x1="9" y1="9" x2="15" y2="15" />
                                </svg>
                                <span>{error}</span>
                            </div>
                        )}

                        <button type="submit" className="login-submit min-h-[44px]" disabled={loading} aria-busy={loading}>
                            <span className="btn-text">{loading ? 'กำลังเข้าสู่ระบบ...' : 'เข้าสู่ระบบ'}</span>
                            {loading && <div className="spinner active" aria-hidden="true"></div>}
                            {!loading && (
                                <svg className="btn-arrow" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                                    <line x1="5" y1="12" x2="19" y2="12" />
                                    <polyline points="12 5 19 12 12 19" />
                                </svg>
                            )}
                        </button>

                        <div className="login-links">
                            <a href="#" className="link-forgot min-h-[44px] flex items-center">ลืมรหัสผ่าน?</a>
                            <span className="link-divider">|</span>
                            <a href="#" className="link-manual min-h-[44px] flex items-center">คู่มือการใช้งาน</a>
                        </div>
                    </form>

                    <div className="login-footer">
                        <p>Powered by <strong>Vision Net</strong> · Redesigned with ❤️</p>
                    </div>
                </div>
            </div>
        </main>
    );
}