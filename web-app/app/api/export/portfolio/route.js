import { NextResponse } from 'next/server';

export async function POST(req) {
    try {
        const body = await req.json();
        const { permissions, guestName } = body;

        if (!permissions || !Array.isArray(permissions)) {
            return NextResponse.json({ error: 'Invalid permissions' }, { status: 400 });
        }

        // Generate HTML String (PoC Offline Static Export)
        // Uses Tailwind CDN for offline/online rendering and inline SVG icons to match UI/UX Pro Max standards
        const htmlContent = `
<!DOCTYPE html>
<html lang="th">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>พอร์ตโฟลิโอ - ${guestName}</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <link href="https://fonts.googleapis.com/css2?family=Prompt:wght@300;400;500;600;700&display=swap" rel="stylesheet">
    <style>
        body { font-family: 'Prompt', sans-serif; background-color: #0f172a; color: white; }
        .glass-card { 
            background: rgba(255,255,255,0.05); 
            backdrop-filter: blur(20px); 
            border: 1px solid rgba(255,255,255,0.1); 
            border-radius: 1.5rem; 
        }
        .icon-circle {
            width: 2rem; height: 2rem; border-radius: 9999px;
            display: flex; align-items: center; justify-content: center; flex-shrink: 0;
        }
    </style>
</head>
<body class="min-h-screen p-4 md:p-8 relative overflow-x-hidden">
    <!-- Background Elements -->
    <div class="fixed inset-0 pointer-events-none -z-10">
        <div class="absolute top-[-10%] right-[-5%] w-[500px] h-[500px] rounded-full bg-orange-600 opacity-20 blur-[100px]"></div>
        <div class="absolute bottom-[-10%] left-[-10%] w-[600px] h-[600px] rounded-full bg-blue-600 opacity-10 blur-[120px]"></div>
    </div>

    <div class="max-w-4xl mx-auto space-y-8 relative z-10">
        <!-- Header -->
        <div class="text-center py-12 mb-8 border-b border-white/10">
            <span class="inline-block py-1 px-3 rounded-full bg-orange-500/10 border border-orange-500/20 text-orange-400 text-xs font-bold tracking-wider mb-4">
                OFFLINE PORTFOLIO
            </span>
            <h1 class="text-4xl md:text-6xl font-bold mb-4 text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-orange-600">
                พอร์ตโฟลิโอของ ${guestName}
            </h1>
            <p class="text-white/60 text-lg">อ่านข้อมูลแบบออฟไลน์ · ส่งออกเมื่อ ${new Date().toLocaleDateString('th-TH')}</p>
        </div>

        ${permissions.includes('profile') ? `
        <div class="glass-card p-6 md:p-8 transform transition hover:scale-[1.01] hover:border-white/20">
            <h2 class="text-xl font-bold text-white flex items-center gap-3 mb-6">
                <div class="icon-circle bg-blue-500/20 text-blue-400">
                    <svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                </div>
                ข้อมูลส่วนตัว
            </h2>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div class="bg-black/20 p-5 rounded-2xl border border-white/5">
                    <p class="text-sm text-white/50 mb-2">ชื่อ-นามสกุล</p>
                    <p class="font-medium text-lg">${guestName}</p>
                </div>
                <div class="bg-black/20 p-5 rounded-2xl border border-white/5">
                    <p class="text-sm text-white/50 mb-2">สถานะนักศึกษา</p>
                    <div class="inline-flex items-center gap-2 bg-green-500/10 px-3 py-1 rounded-full border border-green-500/20">
                        <span class="w-2 h-2 rounded-full bg-green-400"></span>
                        <p class="font-medium text-green-400 text-sm">กำลังศึกษา</p>
                    </div>
                </div>
            </div>
        </div>
        ` : ''}

        ${permissions.includes('registration') ? `
        <div class="glass-card p-6 md:p-8 transform transition hover:scale-[1.01] hover:border-white/20">
            <h2 class="text-xl font-bold text-white flex items-center gap-3 mb-6">
                <div class="icon-circle bg-purple-500/20 text-purple-400">
                    <svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                </div>
                ทะเบียนและตารางเรียน
            </h2>
            <div class="bg-black/20 p-8 rounded-2xl text-center border border-dashed border-white/20">
                <p class="text-white/80 font-medium">ตารางเรียนภาคเรียนปัจจุบัน: ปกติ</p>
                <p class="text-sm mt-2 text-white/40">หน่วยกิตลงทะเบียนรวม: 18 หน่วยกิต</p>
            </div>
        </div>
        ` : ''}

        ${permissions.includes('grade') ? `
        <div class="glass-card p-6 md:p-8 transform transition hover:scale-[1.01] hover:border-white/20">
            <h2 class="text-xl font-bold text-white flex items-center gap-3 mb-6">
                <div class="icon-circle bg-green-500/20 text-green-400">
                    <svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
                </div>
                ผลการเรียน
            </h2>
            <div class="space-y-3">
                <div class="bg-black/20 p-5 rounded-2xl border border-white/5 flex justify-between items-center transition hover:bg-white/5">
                    <div>
                        <p class="font-medium text-lg">วิชา 040613041 - AI DEVELOPMENT</p>
                        <p class="text-sm text-white/50 mt-1">3 หน่วยกิต</p>
                    </div>
                    <div class="w-12 h-12 rounded-full bg-green-500/10 text-green-400 flex items-center justify-center font-bold text-xl border border-green-500/20 shadow-[0_0_15px_rgba(74,222,128,0.2)]">A</div>
                </div>
                <div class="bg-black/20 p-5 rounded-2xl border border-white/5 flex justify-between items-center transition hover:bg-white/5">
                    <div>
                        <p class="font-medium text-lg">วิชา 040613042 - SYSTEM DESIGN</p>
                        <p class="text-sm text-white/50 mt-1">3 หน่วยกิต</p>
                    </div>
                    <div class="w-12 h-12 rounded-full bg-yellow-500/10 text-yellow-500 flex items-center justify-center font-bold text-xl border border-yellow-500/20 shadow-[0_0_15px_rgba(234,179,8,0.2)]">B+</div>
                </div>
            </div>
        </div>
        ` : ''}

        <!-- Footer -->
        <div class="text-center py-10 text-white/30 text-sm border-t border-white/5 mt-12">
            <p>Powered by Vision Net · Redesigned with ❤️</p>
            <p class="mt-2 text-xs opacity-50">Generated Offline Static Version</p>
        </div>
    </div>
</body>
</html>
        `;

        return new NextResponse(htmlContent, {
            headers: {
                'Content-Type': 'text/html; charset=utf-8',
                'Content-Disposition': 'attachment; filename="portfolio_export.html"'
            }
        });
    } catch (error) {
        console.error('Export HTML Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
