'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { LockIcon, CpuIcon } from '../Icons';
import { useCredential } from '../../context/CredentialContext';

export default function AutoEvalToggle() {
    const [isEnabled, setIsEnabled] = useState(false);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    const { requestCredential } = useCredential();

    useEffect(() => {
        fetchSettings();
    }, []);

    const fetchSettings = async () => {
        try {
            const res = await fetch('/api/student/evaluation/settings');
            const data = await res.json();
            if (data.success) {
                setIsEnabled(data.is_auto_eval_enabled);
            }
        } catch (e) {
            console.error('Failed to fetch eval settings:', e);
        } finally {
            setLoading(false);
        }
    };

    const handleToggle = async () => {
        if (!isEnabled) {
            const pwd = await requestCredential(
                'ยืนยันตัวตนเพื่อเปิดใช้งาน',
                'เพื่อความปลอดภัยสูงสุด รหัสผ่านจะถูกนำไปเข้ารหัสแบบ Two-Way (AES-256) และเก็บถาวรในฐานข้อมูลเพื่อใช้งานอัตโนมัติ'
            );
            if (pwd) {
                saveSettings(true, pwd);
            }
        } else {
            saveSettings(false);
        }
    };

    const saveSettings = async (enableStatus, pwd = null) => {
        setSaving(true);
        try {
            const res = await fetch('/api/student/evaluation/settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    is_auto_eval_enabled: enableStatus,
                    password: pwd
                })
            });
            const data = await res.json();
            if (data.success) {
                setIsEnabled(enableStatus);
            } else {
                alert(data.message || 'Error saving settings');
            }
        } catch (e) {
            alert('Connection error');
        } finally {
            setSaving(false);
        }
    };

    if (loading) return null;

    return (
        <div className="bg-[rgba(255,255,255,0.05)] backdrop-blur-md rounded-2xl p-5 border border-[rgba(255,255,255,0.1)] flex flex-col md:flex-row items-start md:items-center justify-between gap-4 w-full">
            <div>
                <h3 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
                    <span className="text-blue-400"><CpuIcon size={20} /></span> ระบบประเมินอาจารย์อัตโนมัติ
                    {isEnabled && <span className="bg-green-500/20 text-green-400 text-xs px-2 py-1 rounded-full border border-green-500/30">เปิดใช้งานอยู่</span>}
                </h3>
                <p className="text-white/60 text-sm">
                    ประหยัดเวลาด้วยการประเมิน "มากที่สุด" ให้กับอาจารย์ที่ยังไม่ได้รับการประเมินแบบอัตโนมัติ (ทำงานเบื้องหลัง)
                </p>
            </div>

            <div className="flex items-center gap-3 shrink-0">
                <button
                    onClick={handleToggle}
                    disabled={loading || saving}
                    className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors focus:outline-none disabled:opacity-50 ${isEnabled ? 'bg-[#4ade80]' : 'bg-gray-600'}`}
                >
                    <span
                        className={`inline-block h-6 w-6 transform rounded-full bg-white transition-transform ${isEnabled ? 'translate-x-7' : 'translate-x-1'}`}
                    />
                </button>
            </div>


        </div>
    );
}
