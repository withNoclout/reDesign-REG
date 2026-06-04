'use client';

import { CpuIcon } from '../Icons';

export default function AutoEvalToggle() {
    return (
        <div className="bg-[rgba(255,255,255,0.05)] backdrop-blur-md rounded-2xl p-5 border border-[rgba(255,255,255,0.1)] flex flex-col gap-3 w-full">
            <div>
                <h3 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
                    <span className="text-blue-400"><CpuIcon size={20} /></span>
                    ระบบประเมินอาจารย์อัตโนมัติ
                    <span className="bg-red-500/20 text-red-300 text-xs px-2 py-1 rounded-full border border-red-500/30">ปิดชั่วคราว</span>
                </h3>
                <p className="text-white/60 text-sm">
                    ฟีเจอร์นี้ถูกปิดใช้งานระหว่างปรับปรุงระบบยืนยันตัวตนและยกเลิกการเก็บรหัสผ่านแบบถอดกลับได้
                </p>
            </div>
        </div>
    );
}
