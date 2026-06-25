import { NextResponse } from 'next/server';

const DISABLED_RESPONSE = {
    success: false,
    code: 'FEATURE_DISABLED',
    message: 'ระบบประเมินอัตโนมัติถูกปิดใช้งานชั่วคราวระหว่างปรับปรุงความปลอดภัย'
};

export async function GET() {
    return NextResponse.json(DISABLED_RESPONSE, { status: 503 });
}

export async function POST() {
    return NextResponse.json(DISABLED_RESPONSE, { status: 503 });
}