'use client';

import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import Navbar from '../components/Navbar';
import ToggleSwitch from '../components/ToggleSwitch';
import ShareLinkBox from '../components/ShareLinkBox';
import { motion } from 'framer-motion';
import { fadeInUp } from '../lib/animations';
import '../globals.css';

const MENU_ITEMS = [
    { id: 'profile', label: 'ข้อมูลส่วนตัว' },
    { id: 'registration', label: 'ทะเบียน' },
    { id: 'grade', label: 'ผลการเรียน' },
    { id: 'search', label: 'ค้นหาระบบ' },
    { id: 'manual', label: 'คู่มือการใช้งาน' },
    { id: 'others', label: 'อื่นๆ' }
];

const EXPIRATION_OPTIONS = [
    { value: '1h', label: '1 ชั่วโมง' },
    { value: '24h', label: '24 ชั่วโมง' },
    { value: '7d', label: '7 วัน' },
    { value: '30d', label: '30 วัน' },
    { value: 'never', label: 'ไม่มีวันหมด' }
];

export default function PortfolioSettings() {
    const { user } = useAuth();
    const [permissions, setPermissions] = useState({});
    const [expiration, setExpiration] = useState('24h');
    const [shareLink, setShareLink] = useState(null);
    const [generating, setGenerating] = useState(false);

    const togglePermission = (id) => {
        setPermissions((prev) => ({
            ...prev,
            [id]: !prev[id]
        }));
    };

    const generateShareLink = async () => {
        const selectedModules = MENU_ITEMS
            .filter((item) => permissions[item.id])
            .map((item) => item.id);

        if (selectedModules.length === 0) {
            alert('กรุณาเลือกอย่างน้อย 1 รายการ');
            return;
        }

        setGenerating(true);

        try {
            const response = await fetch('/api/share/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    permissions: selectedModules,
                    expiration,
                    guestName: user?.name || 'Student'
                })
            });

            const data = await response.json();

            if (data.success) {
                setShareLink(data.shareLink);
            } else {
                alert(data.error || 'Failed to generate link');
            }
        } catch (err) {
            console.error('Generate share link error:', err);
            alert('เกิดข้อผิดพลาด กรุณาลองใหม่');
        } finally {
            setGenerating(false);
        }
    };

    const hasSelectedPermissions = Object.values(permissions).some((v) => v);

    return (
        <main className="main-content">
            <div className="bg-image"></div>
            <div className="bg-overlay"></div>

            <Navbar activePage="others" />

            <div className="landing-container pt-32 pb-20 px-4 md:px-8 max-w-4xl mx-auto">
                <motion.div
                    {...fadeInUp}
                    className="bg-[rgba(15,23,42,0.8)] backdrop-blur-xl border border-white/10 rounded-3xl p-8"
                >
                    <h1 className="text-3xl font-bold text-white mb-2 font-prompt">
                        ตั้งค่าพอร์ตโฟลิโอ
                    </h1>
                    <p className="text-white/60 mb-8">
                        เลือกส่วนที่ต้องการแชร์ให้ผู้อื่นดู
                    </p>

                    {/* Expiration Selection */}
                    <div className="mb-8">
                        <label className="text-white/70 mb-3 block font-medium">
                            ระยะเวลาที่ลิงก์จะหมดอายุ
                        </label>
                        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                            {EXPIRATION_OPTIONS.map((option) => (
                                <button
                                    key={option.value}
                                    onClick={() => setExpiration(option.value)}
                                    className={`py-3 px-4 rounded-xl text-sm font-medium transition-all ${expiration === option.value
                                            ? 'bg-[#4ade80] text-black transform scale-105'
                                            : 'bg-white/10 text-white hover:bg-white/20'
                                        }`}
                                >
                                    {option.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Permission Toggles */}
                    <div className="mb-8">
                        <label className="text-white/70 mb-3 block font-medium">
                            เลือกส่วนที่ต้องการแชร์
                        </label>
                        <div className="space-y-3">
                            {MENU_ITEMS.map((item) => (
                                <ToggleSwitch
                                    key={item.id}
                                    label={item.label}
                                    enabled={permissions[item.id] || false}
                                    onChange={() => togglePermission(item.id)}
                                />
                            ))}
                        </div>
                    </div>

                    {/* Generate Button */}
                    <button
                        onClick={generateShareLink}
                        disabled={generating || !hasSelectedPermissions}
                        className="w-full py-4 bg-[#4ade80] hover:bg-[#4ade80]/80 text-black rounded-xl font-bold text-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-prompt"
                    >
                        {generating ? 'กำลังสร้างลิงก์...' : 'สร้างลิงก์แชร์'}
                    </button>

                    {/* Generated Link */}
                    {shareLink && <ShareLinkBox link={shareLink} />}
                </motion.div>
            </div>
        </main>
    );
}