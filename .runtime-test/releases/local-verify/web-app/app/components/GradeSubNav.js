'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { GraduationCapIcon, CalendarIcon, UserCheckIcon } from './Icons';

const TABS = [
    { href: '/grade', label: 'ผลการเรียน', icon: GraduationCapIcon },
    { href: '/grade/schedule', label: 'ตารางเรียน', icon: CalendarIcon },
    { href: '/evaluation', label: 'ประเมินอาจารย์', icon: UserCheckIcon },
];

export default function GradeSubNav() {
    const pathname = usePathname();

    return (
        <div className="flex gap-2">
            {TABS.map(({ href, label, icon: Icon }) => {
                const isActive = pathname === href;
                return (
                    <Link
                        key={href}
                        href={href}
                        prefetch={true}
                        className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 min-h-[44px] ${isActive
                                ? 'bg-[rgba(255,87,34,0.2)] text-[#ff5722] border border-[rgba(255,87,34,0.4)]'
                                : 'bg-[rgba(255,255,255,0.06)] text-white/50 border border-[rgba(255,255,255,0.1)] hover:text-white/80 hover:bg-[rgba(255,255,255,0.1)]'
                            }`}
                    >
                        <Icon size={16} />
                        <span>{label}</span>
                    </Link>
                );
            })}
        </div>
    );
}
