import { NextResponse } from 'next/server';

export async function POST() {
    return NextResponse.json({
        success: false,
        code: 'FEATURE_DISABLED',
        message: 'ระบบประเมินอัตโนมัติถูกปิดใช้งานชั่วคราวระหว่างปรับปรุงความปลอดภัย'
    }, { status: 503 });
}
