'use client';

import Navbar from '../components/Navbar';
import GlowingBackground from '../components/GlowingBackground';
import AgentMemoryWorkbench from '../components/AgentMemoryWorkbench';
import '../globals.css';

export default function AgentMemoryPage() {
    return (
        <main className="main-content" id="main-content">
            <GlowingBackground />
            <div className="bg-image" aria-hidden="true"></div>
            <div className="bg-overlay" aria-hidden="true"></div>
            <Navbar activePage="others" />

            <div className="main-container pt-32 pb-20 px-4 md:px-8 max-w-7xl mx-auto flex flex-col gap-8">
                <div className="glass-card border border-white/10 p-6 md:p-8 shadow-2xl shadow-black/20">
                    <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                        <div>
                            <span className="inline-flex rounded-full border border-orange-400/30 bg-orange-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-orange-200">
                                Admin Workspace
                            </span>
                            <h1 className="mt-4 text-3xl font-bold text-white font-prompt md:text-4xl">Agent Memory Console</h1>
                            <p className="mt-3 max-w-3xl text-sm leading-7 text-white/65 font-prompt md:text-base">
                                พื้นที่สำหรับตรวจสอบ graph snapshots, วิเคราะห์ blast radius ก่อน surgical fix,
                                ค้นหา memory เดิมของระบบ, และบันทึกผลการแก้ไขให้ agent ใช้ซ้ำได้ในรอบถัดไป
                            </p>
                        </div>
                    </div>
                </div>

                <AgentMemoryWorkbench />
            </div>
        </main>
    );
}
