'use client';

import { useState } from 'react';
import { LightbulbIcon, CheckIcon } from './Icons';

/**
 * ShareLinkBox - Displays generated share link with copy functionality
 * 
 * @param {Object} props
 * @param {string} props.link - The share link to display
 */
export default function ShareLinkBox({ link }) {
    const [copied, setCopied] = useState(false);

    const copyToClipboard = async () => {
        try {
            await navigator.clipboard.writeText(link);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (err) {
            console.error('Failed to copy:', err);
            alert('Failed to copy link. Please copy manually.');
        }
    };

    return (
        <div className="mt-6 p-4 bg-[rgba(74,222,128,0.1)] border border-[#4ade80]/30 rounded-xl">
            <p className="text-sm text-[#4ade80] mb-3 font-medium"><CheckIcon size={14} className="inline mr-1" /> ลิงก์แชร์พอร์ตโฟลิโอของคุณพร้อมแล้ว!</p>
            <div className="flex gap-2">
                <input
                    type="text"
                    value={link}
                    readOnly
                    className="flex-1 px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white text-sm font-mono"
                />
                <button
                    onClick={copyToClipboard}
                    className={`px-4 py-2 rounded-lg font-medium transition-colors ${copied
                            ? 'bg-[#4ade80] text-black'
                            : 'bg-[#4ade80] hover:bg-[#4ade80]/80 text-black'
                        }`}
                >
                    {copied ? 'คัดลอกแล้ว!' : 'คัดลอก'}
                </button>
            </div>
            <p className="text-xs text-white/50 mt-2">
                <LightbulbIcon size={14} className="inline mr-1" /> ลิงก์นี้จะหมดอายุตามที่คุณตั้งค่าไว้
            </p>
        </div>
    );
}