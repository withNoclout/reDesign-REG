'use client';

import { EyeIcon } from './Icons';

/**
 * GuestBanner - Displays banner when viewing portfolio as guest
 * 
 * @param {Object} props
 * @param {string} props.guestName - Name of the portfolio owner
 */
export default function GuestBanner({ guestName }) {
    return (
        <div className="fixed top-20 left-4 right-4 md:left-auto md:right-8 md:w-96 z-40">
            <div className="bg-[#4ade80]/20 border border-[#4ade80]/40 backdrop-blur-lg rounded-xl p-4 flex items-center gap-3 shadow-lg">
                <div className="text-2xl"><EyeIcon size={24} /></div>
                <div className="flex-1">
                    <p className="text-[#4ade80] font-bold text-sm">
                        กำลังดูพอร์ตโฟลิโอของ {guestName}
                    </p>
                    <p className="text-white/60 text-xs mt-1">
                        โหมดผู้เยี่ยมชม - เฉพาะการดูเท่านั้น
                    </p>
                </div>
            </div>
        </div>
    );
}