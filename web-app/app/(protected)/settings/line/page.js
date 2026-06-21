import { Suspense } from 'react';
import LineSettingsPageClient from '@/app/settings/line/LineSettingsPageClient';

function LineSettingsPageFallback() {
    return (
        <main className="main-content min-h-screen bg-[#0f172a] flex items-center justify-center text-white">
            <div className="text-center">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-[#06c755]"></div>
                <p className="mt-4 text-white/70">กำลังโหลดการตั้งค่า LINE...</p>
            </div>
        </main>
    );
}

export default function Page() {
    return (
        <Suspense fallback={<LineSettingsPageFallback />}>
            <LineSettingsPageClient />
        </Suspense>
    );
}
