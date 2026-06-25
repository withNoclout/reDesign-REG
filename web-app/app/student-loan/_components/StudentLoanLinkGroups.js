'use client';

import { BookOpenIcon, ChevronRightIcon, LinkIcon } from '@/app/components/Icons';

function LinkCard({ item }) {
    return (
        <a
            href={item.href}
            target={item.href?.startsWith('http') ? '_blank' : undefined}
            rel={item.href?.startsWith('http') ? 'noreferrer' : undefined}
            className="block rounded-2xl border border-white/10 bg-white/[0.03] p-4 hover:bg-white/[0.05] transition-colors"
        >
            <div className="flex items-start justify-between gap-3">
                <div>
                    <p className="text-white font-semibold font-prompt">{item.title}</p>
                    <p className="mt-2 text-sm text-white/55 font-prompt leading-relaxed">{item.description}</p>
                </div>
                <ChevronRightIcon size={16} className="text-white/40 shrink-0 mt-1" />
            </div>
        </a>
    );
}

export default function StudentLoanLinkGroups({ groups }) {
    if (groups.length === 0) {
        return (
            <section className="rounded-3xl border border-white/10 bg-[rgba(15,23,42,0.7)] backdrop-blur-xl p-6 shadow-xl text-white/60 font-prompt">
                ยังไม่พบลิงก์เพิ่มเติมสำหรับประเภทผู้กู้ของคุณในขณะนี้
            </section>
        );
    }

    return (
        <section className="rounded-3xl border border-white/10 bg-[rgba(15,23,42,0.7)] backdrop-blur-xl p-6 shadow-xl">
            <div className="flex items-center gap-3 mb-5">
                <div className="h-11 w-11 rounded-2xl bg-white/10 flex items-center justify-center text-[#ff8a65]">
                    <LinkIcon size={20} />
                </div>
                <div>
                    <p className="text-sm text-white/50 font-montserrat uppercase tracking-[0.16em]">Student Loan Links</p>
                    <h2 className="text-xl text-white font-prompt font-bold">ลิงก์ที่ต้องใช้</h2>
                </div>
            </div>

            <div className="space-y-6">
                {groups.map((group, index) => (
                    <div key={group.key}>
                        <div className="flex items-center gap-3 mb-4">
                            <div className="h-10 w-10 rounded-2xl bg-white/10 flex items-center justify-center text-[#ff8a65]">
                                {index === groups.length - 1 ? <BookOpenIcon size={18} /> : <LinkIcon size={18} />}
                            </div>
                            <div>
                                <h3 className="text-lg text-white font-prompt font-semibold">{group.title}</h3>
                                <p className="text-sm text-white/55 font-prompt leading-relaxed">{group.description}</p>
                            </div>
                        </div>
                        <div className="grid xl:grid-cols-2 gap-3">
                            {group.items.map((item) => (
                                <LinkCard key={item.id} item={item} />
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        </section>
    );
}
