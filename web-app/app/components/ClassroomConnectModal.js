'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { BookOpenIcon, CheckCircleIcon, ChevronRightIcon, XIcon } from './Icons';

function buildModalContent({ classroom, authenticated }) {
    if (!classroom?.configured) {
        return {
            eyebrow: 'Classroom Mail',
            title: 'ระบบยังไม่พร้อมเชื่อม Google Mail สำหรับ Classroom',
            description: 'ผู้ดูแลระบบยังไม่ได้ตั้งค่า OAuth หรือฐานข้อมูลที่จำเป็นสำหรับการอ่านอีเมลแจ้งเตือนจาก Google Classroom ในสภาพแวดล้อมนี้',
            bullets: [
                'ต้องมี Google OAuth client และ callback URL ที่ถูกต้อง',
                'ต้องมี token encryption key และตารางฐานข้อมูลสำหรับ Gmail-backed notifications',
                'เมื่อตั้งค่าพร้อมแล้ว ผู้ใช้จะสามารถกดเชื่อมต่อได้จากหน้านี้ทันที',
            ],
            primaryLabel: null,
            secondaryLabel: null,
            statusTone: 'slate',
        };
    }

    if (classroom?.rollout && !classroom.rollout.enabled) {
        return {
            eyebrow: 'Classroom Mail',
            title: classroom.rollout.mode === 'off'
                ? 'Google Mail Classroom POC ถูกปิดใช้งานชั่วคราว'
                : 'Google Mail Classroom POC ยังไม่เปิดใช้สำหรับบัญชีนี้',
            description: classroom.rollout.mode === 'off'
                ? 'ระบบได้ปิดการเชื่อมต่อ Google Mail Classroom POC ชั่วคราวเพื่อลดผลกระทบระหว่างการทดสอบหรือปรับปรุงระบบ'
                : 'ขณะนี้การเชื่อมต่อ Google Mail สำหรับ Classroom ยังจำกัดเฉพาะผู้ใช้ใน pilot rollout เพื่อลด blast radius ก่อนเปิดใช้กับผู้ใช้ทั้งหมด',
            bullets: [
                'บัญชีนี้ยังไม่สามารถเริ่ม consent flow กับ Google ได้ในขณะนี้',
                'คุณยังเปิดหน้าตั้งค่าเพื่อดูสถานะ rollout และเหตุผลที่ระบบยังไม่เปิดใช้ได้',
                'เมื่อระบบพร้อมเปิดกว้างขึ้น ผู้ใช้รายอื่นจะเข้าสู่ flow เดียวกันนี้ได้ทันทีโดยไม่ต้องเปลี่ยนโครงสร้างหน้า',
            ],
            primaryLabel: authenticated ? 'เปิดหน้าตั้งค่า Classroom Mail' : 'กลับไปหน้าเข้าสู่ระบบ',
            secondaryLabel: null,
            statusTone: 'amber',
        };
    }

    if (!authenticated || classroom?.authRequired) {
        return {
            eyebrow: 'Classroom Mail',
            title: 'เข้าสู่ระบบก่อนเชื่อม Google Mail',
            description: 'หลังจากเข้าสู่ระบบแล้ว คุณจะสามารถเลือกฟีเจอร์ที่ต้องการเปิดใช้ และอนุญาตให้ระบบอ่านอีเมลแจ้งเตือนจาก Google Classroom ของบัญชีคุณได้อย่างปลอดภัย',
            bullets: [
                'ระบบจะขอสิทธิ Gmail readonly ผ่าน Google consent screen อย่างเป็นทางการ',
                'คุณสามารถเลือกว่าจะเปิดการแจ้งเตือนประกาศ งาน และงานที่ถูกส่งคืนหรือไม่',
                'การเชื่อมต่อจะผูกกับบัญชีของผู้ใช้รายนี้เท่านั้น',
            ],
            primaryLabel: 'เข้าสู่ระบบก่อน',
            secondaryLabel: null,
            statusTone: 'sky',
        };
    }

    if (classroom?.connected) {
        return {
            eyebrow: 'Classroom Mail',
            title: 'Google Mail สำหรับ Classroom เชื่อมต่อแล้ว',
            description: 'คุณสามารถเปิดหน้าตั้งค่าเพื่อตรวจสอบ account ที่เชื่อมอยู่ ปรับฟีเจอร์ที่ใช้งาน หรือสั่ง sync ใหม่ได้จากหน้าจัดการ Classroom Mail',
            bullets: [
                'ดูอีเมล Google ที่เชื่อมอยู่และเวลาซิงก์ล่าสุด',
                'ปรับฟีเจอร์ที่ให้ระบบแจ้งเตือนใน Notification Bell',
                'เชื่อมใหม่หรือยกเลิกการเชื่อมต่อได้เมื่อจำเป็น',
            ],
            primaryLabel: 'เปิดหน้าตั้งค่า Classroom Mail',
            secondaryLabel: 'เปิด Gmail',
            statusTone: 'emerald',
        };
    }

    if (classroom?.reconnectRequired) {
        return {
            eyebrow: 'Classroom Mail',
            title: 'ต้องเชื่อม Google Mail ใหม่',
            description: 'สิทธิ์ Gmail readonly เดิมหมดอายุหรือถูกเพิกถอน คุณสามารถกลับไปเลือกฟีเจอร์ที่ต้องการ และเริ่มการอนุญาตใหม่ผ่าน Google ได้จากหน้าตั้งค่า',
            bullets: [
                'ระบบจะแสดงรายละเอียดสิทธิ์ที่ขอใช้งานก่อนเริ่มเชื่อมต่อ',
                'เมื่ออนุญาตใหม่แล้ว ระบบจะ sync อีเมลแจ้งเตือนจาก Classroom ของคุณทันที',
                'หาก Google account ไม่ตรงกับผู้ใช้ ระบบจะไม่ bind ให้โดยอัตโนมัติ',
            ],
            primaryLabel: 'ไปหน้าตั้งค่า Classroom Mail',
            secondaryLabel: 'เชื่อมต่อใหม่ทันที',
            statusTone: 'amber',
        };
    }

    return {
        eyebrow: 'Classroom Mail',
        title: 'เชื่อม Google Mail เพื่อรับแจ้งเตือน Classroom',
        description: 'ในหน้าตั้งค่า คุณจะเลือกฟีเจอร์ที่ต้องการเปิดใช้ แล้วค่อยอนุญาต Gmail readonly ผ่าน Google consent screen เพื่อให้ระบบอ่านอีเมลแจ้งเตือนจาก Classroom ของบัญชีคุณ',
        bullets: [
            'เลือกได้ว่าจะรับประกาศ งานใหม่ และงานที่ถูกส่งคืนหรือไม่',
            'ระบบจะขอสิทธิเท่าที่จำเป็นก่อนเริ่มซิงก์',
            'หลังเชื่อมแล้ว Notification Bell จะดึงอีเมลแจ้งเตือนจาก Classroom ของคุณเข้ามาแสดง',
        ],
        primaryLabel: 'ไปหน้าตั้งค่า Classroom Mail',
        secondaryLabel: 'เชื่อมทันที',
        statusTone: 'sky',
    };
}

const TONE_CLASSES = {
    sky: {
        badge: 'bg-sky-500/15 text-sky-200 border border-sky-400/20',
        icon: 'text-sky-300',
        panel: 'border-sky-400/15 bg-sky-500/10',
    },
    emerald: {
        badge: 'bg-emerald-500/15 text-emerald-200 border border-emerald-400/20',
        icon: 'text-emerald-300',
        panel: 'border-emerald-400/15 bg-emerald-500/10',
    },
    amber: {
        badge: 'bg-amber-500/15 text-amber-200 border border-amber-400/20',
        icon: 'text-amber-300',
        panel: 'border-amber-400/15 bg-amber-500/10',
    },
    slate: {
        badge: 'bg-white/10 text-white/70 border border-white/10',
        icon: 'text-white/70',
        panel: 'border-white/10 bg-white/[0.03]',
    },
};

export default function ClassroomConnectModal({
    isOpen,
    classroom,
    authenticated,
    onClose,
    onOpenSettings,
    onBeginAuth,
    onOpenClassroom,
}) {
    const content = buildModalContent({ classroom, authenticated });
    const tone = TONE_CLASSES[content.statusTone] || TONE_CLASSES.sky;

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[140] flex items-center justify-center p-4">
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="absolute inset-0 bg-black/75 backdrop-blur-sm"
                        onClick={onClose}
                    />

                    <motion.div
                        initial={{ opacity: 0, scale: 0.96, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.96, y: 20 }}
                        transition={{ duration: 0.2 }}
                        className="relative z-10 w-full max-w-2xl rounded-3xl border border-white/10 bg-[rgba(15,23,42,0.96)] shadow-2xl overflow-hidden"
                    >
                        <div className="px-6 py-5 border-b border-white/10 bg-white/[0.03] flex items-start justify-between gap-4">
                            <div>
                                <p className="text-xs uppercase tracking-[0.2em] text-[#ff8a65] font-montserrat mb-2">{content.eyebrow}</p>
                                <h2 className="text-2xl text-white font-prompt font-bold">{content.title}</h2>
                                <p className="text-sm text-white/60 mt-2 font-prompt max-w-xl">{content.description}</p>
                            </div>
                            <button
                                onClick={onClose}
                                className="shrink-0 rounded-full bg-white/10 text-white/70 hover:bg-white/20 hover:text-white transition-colors p-2"
                                aria-label="ปิด"
                            >
                                <XIcon size={16} />
                            </button>
                        </div>
                        <div className="p-6 space-y-6">
                            <div className={`rounded-2xl border p-4 ${tone.panel}`}>
                                <div className="flex items-center gap-2 mb-3 flex-wrap">
                                    <span className={`text-[11px] font-bold px-2 py-1 rounded-full ${tone.badge}`}>สถานะการเชื่อมต่อ</span>
                                    <span className="text-[11px] text-white/55 font-montserrat">
                                        {classroom?.connected
                                            ? 'Connected'
                                            : (!classroom?.rollout?.enabled
                                                ? (classroom?.rollout?.mode === 'off' ? 'Disabled' : 'Pilot only')
                                                : (classroom?.reconnectRequired ? 'Reconnect required' : 'Not connected'))}
                                    </span>
                                </div>
                                <ul className="space-y-3">
                                    {content.bullets.map((bullet) => (
                                        <li key={bullet} className="flex items-start gap-3 text-sm text-white/80 font-prompt leading-relaxed">
                                            <CheckCircleIcon size={16} className={`shrink-0 mt-0.5 ${tone.icon}`} />
                                            <span>{bullet}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>

                            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                                <div className="flex items-center gap-2 text-white mb-3">
                                    <BookOpenIcon size={16} className="text-[#ff8a65]" />
                                    <h3 className="font-prompt font-semibold">สิ่งที่จะเกิดขึ้นเมื่อคุณกดอนุญาต</h3>
                                </div>
                                <div className="grid md:grid-cols-2 gap-3 text-sm text-white/70 font-prompt">
                                    <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                                        <p className="font-semibold text-white mb-1">1. เลือกฟีเจอร์ในหน้าตั้งค่า</p>
                                        <p>คุณสามารถติ๊กเลือกได้ว่าต้องการอ่านข้อความอีเมลแจ้งเตือนเรื่องประกาศ งานใหม่ และงานที่ถูกส่งคืนจาก Classroom</p>
                                    </div>
                                    <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                                        <p className="font-semibold text-white mb-1">2. อนุญาต Gmail readonly</p>
                                        <p>Google จะเปิด popup/consent screen ให้คุณยืนยันสิทธิการอ่านอีเมลแบบ read-only จากนั้น browser นี้จะใช้ token ไปอ่านข้อความแจ้งเตือนเอง</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="px-6 py-4 border-t border-white/10 bg-black/20 flex flex-wrap items-center justify-end gap-3">
                            <button
                                type="button"
                                onClick={onClose}
                                className="inline-flex items-center rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm font-semibold text-white/75 hover:bg-white/[0.06] hover:text-white transition-colors"
                            >
                                ปิด
                            </button>
                            {content.secondaryLabel && classroom?.configured && authenticated && !classroom?.connected && (
                                <button
                                    type="button"
                                    onClick={onBeginAuth}
                                    className="inline-flex items-center rounded-xl border border-[#ff8a65]/25 bg-[#ff8a65]/10 px-4 py-2.5 text-sm font-semibold text-[#ffd2c4] hover:bg-[#ff8a65]/20 transition-colors"
                                >
                                    {content.secondaryLabel}
                                </button>
                            )}
                            {content.secondaryLabel && classroom?.configured && classroom?.connected && (
                                <button
                                    type="button"
                                    onClick={onOpenClassroom}
                                    className="inline-flex items-center rounded-xl border border-[#ff8a65]/25 bg-[#ff8a65]/10 px-4 py-2.5 text-sm font-semibold text-[#ffd2c4] hover:bg-[#ff8a65]/20 transition-colors"
                                >
                                    {content.secondaryLabel}
                                </button>
                            )}
                            {content.primaryLabel && (
                                <button
                                    type="button"
                                    onClick={authenticated && classroom?.configured ? onOpenSettings : onBeginAuth}
                                    className="inline-flex items-center rounded-xl bg-[#ff5722] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#ff7043] transition-colors"
                                >
                                    {content.primaryLabel}
                                    <ChevronRightIcon size={14} className="ml-1.5" />
                                </button>
                            )}
                            {!content.primaryLabel && !authenticated && (
                                <button
                                    type="button"
                                    onClick={onBeginAuth}
                                    className="inline-flex items-center rounded-xl bg-[#ff5722] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#ff7043] transition-colors"
                                >
                                    กลับไปหน้าเข้าสู่ระบบ
                                    <ChevronRightIcon size={14} className="ml-1.5" />
                                </button>
                            )}
                            {!content.primaryLabel && authenticated && classroom?.configured && (
                                <button
                                    type="button"
                                    onClick={onOpenSettings}
                                    className="inline-flex items-center rounded-xl bg-[#ff5722] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#ff7043] transition-colors"
                                >
                                    เปิดหน้าตั้งค่า Classroom
                                    <ChevronRightIcon size={14} className="ml-1.5" />
                                </button>
                            )}
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}
