import { NextResponse } from 'next/server';

// In-memory store for development only. In production, use Redis or Database.
const mockOtpStore = global.mockOtpStore || {};
if (process.env.NODE_ENV !== 'production') {
    global.mockOtpStore = mockOtpStore;
}

export async function POST(request) {
    try {
        const { email, usercode } = await request.json();
        if (!email || !usercode) {
            return NextResponse.json({ success: false, message: 'Missing email or usercode' }, { status: 400 });
        }

        // Generate 6 digit OTP
        const otp = Math.floor(100000 + Math.random() * 900000).toString();

        // Save to store with 5 min expiration
        mockOtpStore[usercode] = {
            otp,
            expiresAt: Date.now() + 5 * 60 * 1000
        };

        // MOCK: Log to console instead of sending real email to avoid cost during development
        console.log(`\n\n=========================================\n`);
        console.log(`[REAL 2FA SIMULATION] Sending Email to: ${email}`);
        console.log(`[REAL 2FA SIMULATION] Your OTP is: ${otp}`);
        console.log(`\n=========================================\n\n`);

        return NextResponse.json({ success: true, message: `ระบบได้จำลองส่ง OTP ไปยังอีเมล ${email} เรียบร้อยแล้ว (รหัสทดสอบดูได้ที่ Server Console)` });
    } catch (e) {
        return NextResponse.json({ success: false, message: e.message }, { status: 500 });
    }
}

export async function PUT(request) {
    try {
        const { usercode, otp } = await request.json();
        const record = mockOtpStore[usercode];

        if (!record) {
            return NextResponse.json({ success: false, message: 'ไม่พบคำขอ OTP โปรดส่งใหม่' }, { status: 400 });
        }
        if (Date.now() > record.expiresAt) {
            delete mockOtpStore[usercode];
            return NextResponse.json({ success: false, message: 'รหัส OTP หมดอายุแล้ว' }, { status: 400 });
        }
        if (record.otp !== otp) {
            return NextResponse.json({ success: false, message: 'รหัส OTP ไม่ถูกต้อง' }, { status: 400 });
        }

        // Success
        delete mockOtpStore[usercode];
        return NextResponse.json({ success: true, message: 'ยืนยันตัวตนสำเร็จ' });
    } catch (e) {
        return NextResponse.json({ success: false, message: e.message }, { status: 500 });
    }
}
