'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

// OTP Verify Modal
// Props: isOpen, email, usercode, userName, onVerified, onClose
export default function OtpVerifyModal({ isOpen, email, usercode, userName, onVerified, onClose }) {
    const [otp, setOtp] = useState(['', '', '', '', '', '']);
    const [sending, setSending] = useState(false);
    const [verifying, setVerifying] = useState(false);
    const [sent, setSent] = useState(false);
    const [error, setError] = useState('');
    const [countdown, setCountdown] = useState(0);
    const [sentVia, setSentVia] = useState('');
    const inputRefs = useRef([]);

    // Auto-send OTP when modal opens
    useEffect(() => {
        if (isOpen && !sent) {
            handleSendOtp();
        }
        if (!isOpen) {
            // Reset state when modal closes
            setOtp(['', '', '', '', '', '']);
            setSent(false);
            setError('');
            setCountdown(0);
            setSentVia('');
        }
    }, [isOpen]);

    // Countdown timer for resend
    useEffect(() => {
        if (countdown <= 0) return;
        const timer = setInterval(() => {
            setCountdown(prev => {
                if (prev <= 1) {
                    clearInterval(timer);
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
        return () => clearInterval(timer);
    }, [countdown]);

    const handleSendOtp = async () => {
        if (sending) return;
        setSending(true);
        setError('');
        try {
            const res = await fetch('/api/auth/send-otp', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, usercode, userName }),
            });
            const data = await res.json();
            if (data.success) {
                setSent(true);
                setSentVia(data.sent_via || 'console');
                setCountdown(60);
                setOtp(['', '', '', '', '', '']);
                setTimeout(() => inputRefs.current[0]?.focus(), 100);
            } else {
                setError(data.message);
            }
        } catch (err) {
            setError('เกิดข้อผิดพลาดในการเชื่อมต่อ');
        } finally {
            setSending(false);
        }
    };

    const handleVerify = useCallback(async (otpValue) => {
        const code = otpValue || otp.join('');
        if (code.length !== 6) return;

        setVerifying(true);
        setError('');
        try {
            const res = await fetch('/api/auth/send-otp', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ usercode, otp: code }),
            });
            const data = await res.json();
            if (data.success) {
                if (onVerified) onVerified();
            } else {
                setError(data.message);
                setOtp(['', '', '', '', '', '']);
                setTimeout(() => inputRefs.current[0]?.focus(), 100);
            }
        } catch (err) {
            setError('เกิดข้อผิดพลาดในการเชื่อมต่อ');
        } finally {
            setVerifying(false);
        }
    }, [otp, usercode, onVerified]);

    const handleInputChange = (index, value) => {
        const digit = value.replace(/\D/g, '').slice(-1);
        const newOtp = [...otp];
        newOtp[index] = digit;
        setOtp(newOtp);

        if (digit && index < 5) {
            inputRefs.current[index + 1]?.focus();
        }

        if (digit && index === 5) {
            const fullOtp = newOtp.join('');
            if (fullOtp.length === 6) {
                handleVerify(fullOtp);
            }
        }
    };

    const handleKeyDown = (index, e) => {
        if (e.key === 'Backspace' && !otp[index] && index > 0) {
            inputRefs.current[index - 1]?.focus();
        }
        if (e.key === 'Escape') {
            onClose?.();
        }
    };

    const handlePaste = (e) => {
        e.preventDefault();
        const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
        if (pasted.length === 0) return;

        const newOtp = [...otp];
        for (let i = 0; i < 6; i++) {
            newOtp[i] = pasted[i] || '';
        }
        setOtp(newOtp);

        const nextEmpty = newOtp.findIndex(d => !d);
        inputRefs.current[nextEmpty >= 0 ? nextEmpty : 5]?.focus();

        if (pasted.length === 6) {
            handleVerify(pasted);
        }
    };

    const maskedEmail = email
        ? email.replace(/^(.{2})(.*)(@.*)$/, (_, first, middle, domain) => first + '\u2022'.repeat(Math.min(middle.length, 6)) + domain)
        : '';

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <div style={{
                position: 'fixed', inset: 0, zIndex: 100,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                padding: '16px',
                background: 'rgba(0,0,0,0.6)',
                backdropFilter: 'blur(4px)',
            }}>
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    style={{
                        background: '#1a1c29',
                        border: '1px solid rgba(255,255,255,0.1)',
                        borderRadius: '16px',
                        padding: '24px',
                        width: '100%',
                        maxWidth: '420px',
                        boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)',
                        position: 'relative',
                    }}
                >
                    {/* Close button */}
                    <button
                        onClick={onClose}
                        style={{
                            position: 'absolute', top: '16px', right: '16px',
                            background: 'none', border: 'none',
                            color: 'rgba(255,255,255,0.3)', cursor: 'pointer',
                        }}
                        aria-label="ปิด"
                    >
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                    </button>

                    {/* Header */}
                    <div style={{ textAlign: 'center', marginBottom: '24px' }}>
                        <div style={{
                            margin: '0 auto 12px',
                            width: '56px', height: '56px',
                            background: 'linear-gradient(135deg, rgba(59,130,246,0.2), rgba(99,102,241,0.2))',
                            color: '#60a5fa',
                            borderRadius: '50%',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            border: '1px solid rgba(59,130,246,0.3)',
                        }}>
                            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                                <polyline points="22,6 12,13 2,6" />
                            </svg>
                        </div>
                        <h3 style={{ color: 'white', fontSize: '1.2rem', fontWeight: 700, margin: '0 0 4px' }}>ยืนยันอีเมลของคุณ</h3>
                        <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.85rem', margin: 0 }}>
                            {sent
                                ? <>เราได้ส่งรหัส 6 หลักไปยัง <strong style={{ color: 'rgba(255,255,255,0.7)' }}>{maskedEmail}</strong></>
                                : 'กำลังส่งรหัสยืนยัน...'
                            }
                        </p>
                        {sentVia === 'console' && (
                            <p style={{
                                color: 'rgba(251,146,60,0.8)', fontSize: '0.7rem',
                                marginTop: '8px',
                                background: 'rgba(251,146,60,0.1)',
                                border: '1px solid rgba(251,146,60,0.2)',
                                borderRadius: '8px',
                                padding: '4px 12px',
                                display: 'inline-block',
                            }}>
                                ⚠️ โหมดทดสอบ: ดู OTP ที่ Server Console
                            </p>
                        )}
                    </div>

                    {/* OTP Input */}
                    <div style={{ display: 'flex', justifyContent: 'center', gap: '10px', marginBottom: '24px' }} onPaste={handlePaste}>
                        {otp.map((digit, i) => (
                            <input
                                key={i}
                                ref={el => inputRefs.current[i] = el}
                                type="text"
                                inputMode="numeric"
                                maxLength={1}
                                value={digit}
                                onChange={(e) => handleInputChange(i, e.target.value)}
                                onKeyDown={(e) => handleKeyDown(i, e)}
                                disabled={verifying || sending}
                                style={{
                                    width: '48px', height: '56px',
                                    textAlign: 'center', fontSize: '1.2rem', fontWeight: 700,
                                    borderRadius: '12px',
                                    border: digit ? '1px solid rgba(59,130,246,0.5)' : '1px solid rgba(255,255,255,0.1)',
                                    background: digit ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.05)',
                                    color: 'white',
                                    outline: 'none',
                                    transition: 'all 0.2s',
                                    opacity: (verifying || sending) ? 0.5 : 1,
                                }}
                                aria-label={`OTP digit ${i + 1}`}
                            />
                        ))}
                    </div>

                    {/* Error Message */}
                    {error && (
                        <motion.div
                            initial={{ opacity: 0, y: -5 }}
                            animate={{ opacity: 1, y: 0 }}
                            style={{
                                color: '#f87171', fontSize: '0.85rem',
                                textAlign: 'center', marginBottom: '16px',
                                background: 'rgba(248,113,113,0.1)',
                                border: '1px solid rgba(248,113,113,0.2)',
                                borderRadius: '12px',
                                padding: '8px 16px',
                            }}
                        >
                            {error}
                        </motion.div>
                    )}

                    {/* Verify Button */}
                    <button
                        onClick={() => handleVerify()}
                        disabled={otp.join('').length !== 6 || verifying}
                        style={{
                            width: '100%', padding: '12px',
                            borderRadius: '12px', border: 'none',
                            background: (otp.join('').length === 6 && !verifying) ? 'linear-gradient(to right, #2563eb, #4f46e5)' : 'rgba(255,255,255,0.1)',
                            color: 'white', fontWeight: 600, fontSize: '0.9rem',
                            cursor: (otp.join('').length === 6 && !verifying) ? 'pointer' : 'not-allowed',
                            opacity: (otp.join('').length === 6 && !verifying) ? 1 : 0.5,
                            transition: 'all 0.2s',
                            marginBottom: '16px',
                        }}
                    >
                        {verifying ? (
                            <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                                <span style={{
                                    width: '16px', height: '16px',
                                    border: '2px solid white', borderTopColor: 'transparent',
                                    borderRadius: '50%',
                                    animation: 'spin 1s linear infinite',
                                }} />
                                กำลังตรวจสอบ...
                            </span>
                        ) : 'ยืนยันรหัส OTP'}
                    </button>

                    {/* Resend */}
                    <div style={{ textAlign: 'center' }}>
                        {countdown > 0 ? (
                            <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.75rem', margin: 0 }}>
                                ส่ง OTP อีกครั้งใน <span style={{ color: 'rgba(255,255,255,0.6)', fontWeight: 700 }}>{countdown}</span> วินาที
                            </p>
                        ) : (
                            <button
                                onClick={handleSendOtp}
                                disabled={sending}
                                style={{
                                    background: 'none', border: 'none',
                                    color: '#60a5fa', fontSize: '0.75rem', fontWeight: 600,
                                    cursor: sending ? 'not-allowed' : 'pointer',
                                    opacity: sending ? 0.5 : 1,
                                }}
                            >
                                {sending ? 'กำลังส่ง...' : 'ไม่ได้รับรหัส? ส่ง OTP อีกครั้ง'}
                            </button>
                        )}
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
}
