'use client';

export default function GradeError({ error, reset }) {
    return (
        <main className="main-content">
            <div className="bg-image"></div>
            <div className="bg-overlay"></div>
            <div className="flex items-center justify-center min-h-screen">
                <div className="text-white text-center max-w-md mx-auto p-8">
                    <div className="text-6xl mb-6">⚠️</div>
                    <h2 className="text-2xl font-bold mb-3 font-prompt">
                        เกิดข้อผิดพลาดในหน้าผลการเรียน
                    </h2>
                    <p className="text-white/60 mb-6 text-sm">
                        {error?.message || 'ไม่สามารถแสดงผลการเรียนได้'}
                    </p>
                    <button
                        onClick={reset}
                        className="px-6 py-3 bg-[#ff5722] hover:bg-[#e64a19] text-white rounded-xl transition-colors font-medium"
                    >
                        ลองใหม่
                    </button>
                </div>
            </div>
        </main>
    );
}
