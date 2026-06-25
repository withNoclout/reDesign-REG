import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';
import bcrypt from 'bcryptjs';

// In-memory store for development. In production, use Redis or Supabase.
const otpStore = global.__otpStore || {};
if (!global.__otpStore) global.__otpStore = otpStore;

// Rate limit store: track last send time per usercode
const rateLimitStore = global.__otpRateLimit || {};
if (!global.__otpRateLimit) global.__otpRateLimit = rateLimitStore;

const OTP_EXPIRY_MS = 5 * 60 * 1000; // 5 minutes
const RATE_LIMIT_MS = 60 * 1000;      // 1 minute between sends

// Configure Nodemailer transporter
function getTransporter() {
    const user = process.env.GMAIL_USER;
    const pass = process.env.GMAIL_APP_PASSWORD;

    if (!user || !pass) {
        console.warn('[OTP] GMAIL_USER or GMAIL_APP_PASSWORD not set. Falling back to console-only mode.');
        return null;
    }

    return nodemailer.createTransport({
        service: 'gmail',
        auth: { user, pass },
    });
}

function generateOtp() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

function buildEmailHtml(otp, userName) {
    return `
    <div style="font-family: 'Segoe UI', Tahoma, Geneva, sans-serif; max-width: 480px; margin: 0 auto; background: #1a1c29; border-radius: 16px; overflow: hidden; border: 1px solid rgba(255,255,255,0.1);">
        <div style="background: linear-gradient(135deg, #2196F3, #6366f1); padding: 32px 24px; text-align: center;">
            <h1 style="color: #fff; margin: 0; font-size: 22px; font-weight: 700;">REG KMUTNB</h1>
            <p style="color: rgba(255,255,255,0.8); margin: 8px 0 0; font-size: 13px;">ระบบยืนยันตัวตนด้วยอีเมล</p>
        </div>
        <div style="padding: 32px 24px; text-align: center;">
            <p style="color: rgba(255,255,255,0.7); font-size: 14px; margin: 0 0 8px;">สวัสดีคุณ ${userName || 'ผู้ใช้งาน'},</p>
            <p style="color: rgba(255,255,255,0.6); font-size: 13px; margin: 0 0 24px;">รหัส OTP สำหรับยืนยันตัวตนของคุณคือ:</p>
            <div style="background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.15); border-radius: 12px; padding: 20px; margin: 0 auto; max-width: 240px;">
                <span style="color: #ff5722; font-size: 36px; font-weight: 800; letter-spacing: 8px; font-family: 'Courier New', monospace;">${otp}</span>
            </div>
            <p style="color: rgba(255,255,255,0.4); font-size: 12px; margin: 20px 0 0;">รหัสนี้จะหมดอายุภายใน <strong style="color: rgba(255,255,255,0.7);">5 นาที</strong></p>
            <p style="color: rgba(255,255,255,0.3); font-size: 11px; margin: 16px 0 0;">หากคุณไม่ได้ร้องขอรหัสนี้ กรุณาเพิกเฉยอีเมลฉบับนี้</p>
        </div>
        <div style="background: rgba(255,255,255,0.03); padding: 16px 24px; text-align: center; border-top: 1px solid rgba(255,255,255,0.05);">
            <p style="color: rgba(255,255,255,0.25); font-size: 10px; margin: 0;">Powered by REG KMUTNB · Redesigned with ❤️</p>
        </div>
    </div>`;
}

// ─── SEND OTP ────────────────────────────────────────────────────────
export async function POST(request) {
    try {
        const { email, usercode, userName } = await request.json();
        if (!email || !usercode) {
            return NextResponse.json({ success: false, message: 'Missing email or usercode' }, { status: 400 });
        }

        // Rate limiting
        const lastSent = rateLimitStore[usercode];
        if (lastSent && Date.now() - lastSent < RATE_LIMIT_MS) {
            const waitSec = Math.ceil((RATE_LIMIT_MS - (Date.now() - lastSent)) / 1000);
            return NextResponse.json({
                success: false,
                message: `กรุณารอ ${waitSec} วินาทีก่อนส่ง OTP อีกครั้ง`
            }, { status: 429 });
        }

        const otp = generateOtp();
        const hashedOtp = await bcrypt.hash(otp, 10);

        // Store hashed OTP
        otpStore[usercode] = {
            hashedOtp,
            email,
            expiresAt: Date.now() + OTP_EXPIRY_MS,
            attempts: 0,
        };
        rateLimitStore[usercode] = Date.now();

        // Try to send real email
        const transporter = getTransporter();
        if (transporter) {
            try {
                await transporter.sendMail({
                    from: `"REG KMUTNB" <${process.env.GMAIL_USER}>`,
                    to: email,
                    subject: `[REG KMUTNB] รหัสยืนยันตัวตน: ${otp}`,
                    html: buildEmailHtml(otp, userName),
                });
                console.log(`[OTP] ✅ Email sent to ${email}`);
                return NextResponse.json({
                    success: true,
                    message: `ส่งรหัส OTP ไปยังอีเมล ${email} เรียบร้อยแล้ว`,
                    sent_via: 'email',
                });
            } catch (mailErr) {
                console.error('[OTP] ❌ Email send failed:', mailErr.message);
                // Fall through to console-only mode
            }
        }

        // Fallback: Console-only mode (no Gmail configured or send failed)
        console.log(`\n=========================================`);
        console.log(`[OTP FALLBACK] Email: ${email}`);
        console.log(`[OTP FALLBACK] Code:  ${otp}`);
        console.log(`=========================================\n`);

        return NextResponse.json({
            success: true,
            message: `ระบบได้จำลองส่ง OTP ไปยังอีเมล ${email} เรียบร้อยแล้ว (ดู OTP ที่ Server Console)`,
            sent_via: 'console',
        });

    } catch (e) {
        console.error('[OTP] Error:', e);
        return NextResponse.json({ success: false, message: e.message }, { status: 500 });
    }
}

// ─── VERIFY OTP ──────────────────────────────────────────────────────
export async function PUT(request) {
    try {
        const { usercode, otp } = await request.json();
        if (!usercode || !otp) {
            return NextResponse.json({ success: false, message: 'Missing usercode or otp' }, { status: 400 });
        }

        const record = otpStore[usercode];

        if (!record) {
            return NextResponse.json({ success: false, message: 'ไม่พบคำขอ OTP โปรดส่งใหม่' }, { status: 400 });
        }

        // Check expiry
        if (Date.now() > record.expiresAt) {
            delete otpStore[usercode];
            return NextResponse.json({ success: false, message: 'รหัส OTP หมดอายุแล้ว กรุณาส่งใหม่' }, { status: 400 });
        }

        // Brute-force protection: max 5 attempts
        if (record.attempts >= 5) {
            delete otpStore[usercode];
            return NextResponse.json({ success: false, message: 'ลองผิดเกินจำนวนครั้งที่กำหนด กรุณาส่ง OTP ใหม่' }, { status: 429 });
        }

        record.attempts += 1;

        // Compare with hashed OTP
        const isMatch = await bcrypt.compare(otp, record.hashedOtp);
        if (!isMatch) {
            return NextResponse.json({
                success: false,
                message: `รหัส OTP ไม่ถูกต้อง (เหลืออีก ${5 - record.attempts} ครั้ง)`
            }, { status: 400 });
        }

        // ✅ Success
        delete otpStore[usercode];
        return NextResponse.json({ success: true, message: 'ยืนยันตัวตนสำเร็จ' });

    } catch (e) {
        console.error('[OTP Verify] Error:', e);
        return NextResponse.json({ success: false, message: e.message }, { status: 500 });
    }
}
