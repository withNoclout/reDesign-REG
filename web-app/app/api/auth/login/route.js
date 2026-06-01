import { NextResponse } from 'next/server';
import axios from 'axios';
import { getServiceSupabase } from '@/lib/supabase';
import { AUTH_IDENTITY_COOKIE_MAX_AGE_SECONDS, AUTH_IDENTITY_COOKIE_NAME, createSignedAuthIdentityCookie } from '@/lib/auth';
import { createRateLimiter, getClientIp } from '@/lib/rateLimit';
import { encryptForReg } from '@/lib/regCipherUtils';
import crypto from 'crypto';

// Shared rate limiter instance for login (5 attempts per 15 minutes)
const loginLimiter = createRateLimiter({
    namespace: 'login',
    maxAttempts: 5,
    windowMs: 15 * 60 * 1000,
});

// Skipping external IP fetch for performance optimization (saving ~300ms)
const getServerIp = () => '';


function generateSecureToken() {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

function validateInput(value) {
    if (!value || typeof value !== 'string') return false;
    // Remove any potentially harmful characters
    const sanitized = value.trim().replace(/[<>\"'&]/g, '');
    if (sanitized.length !== value.length) return false;
    if (sanitized.length < 3 || sanitized.length > 100) return false;
    return true;
}

export async function POST(request) {
    try {
        const { username, password } = await request.json();

        // Validate input
        if (!validateInput(username) || !validateInput(password)) {
            return NextResponse.json(
                { success: false, message: 'ข้อมูลไม่ถูกต้อง กรุณาตรวจสอบอีกครั้ง' },
                { status: 400 }
            );
        }

        // Get client IP for rate limiting
        const ip = getClientIp(request);

        // Check rate limit
        const rateLimit = loginLimiter.check(ip);
        if (!rateLimit.allowed) {
            const minutesLeft = Math.ceil(rateLimit.retryAfterMs / 60000);
            return NextResponse.json(
                {
                    success: false,
                    message: `คุณพยายามเข้าสู่ระบบมากเกินไป กรุณารอ ${minutesLeft} นาที`
                },
                { status: 429 }
            );
        }

        // Log attempt without exposing username (security best practice)
        const userHash = username.substring(0, 3) + '***';
        console.log(`[API] Login attempt for user: ${userHash} from IP: ${ip}`);

        // --- REAL API INTEGRATION (regapiweb2) ---
        const BASE_URL = 'https://reg4.kmutnb.ac.th/regapiweb2/api/th';

        // Validate encryption key early
        const ENCRYPT_SECRET_KEY = process.env.ENCRYPT_SECRET_KEY;
        if (!ENCRYPT_SECRET_KEY) {
            console.error('[API] ENCRYPT_SECRET_KEY is not set in environment');
            return NextResponse.json(
                { success: false, message: 'Server configuration error' },
                { status: 500 }
            );
        }

        try {
            // Step 0: Get server's public IP (skipped for performance)
            const serverIp = getServerIp();

            // Step 1: Get JWT Token from tokenservice
            console.log('[API] 1. Calling tokenservice...');
            console.time('Login-TokenService'); // Start timer for token service
            const tokenResponse = await axios.get(`${BASE_URL}/Validate/tokenservice`, {
                validateStatus: status => status < 500
            });
            console.timeEnd('Login-TokenService'); // End timer for token service

            console.log('[API] Token Service Status:', tokenResponse.status);
            const token = tokenResponse.data?.token;

            if (!token) {
                console.error('[API] No token from tokenservice:', JSON.stringify(tokenResponse.data).substring(0, 200));
                throw new Error('tokenservice did not return a valid token');
            }

            // Step 2: Encrypt credentials with server IP (matches Angular app's user object)
            const credentialsJson = JSON.stringify({ username, password, ip: serverIp });
            const encryptedParam = encryptForReg(credentialsJson);
            console.log('[API] 2. Encrypted param length:', encryptedParam.length);

            // Build the request body as a raw JSON string (matching the Angular app)
            const requestBody = '{"param" : "' + encryptedParam + '"}';

            console.log('[API] 3. Calling LoginAD with Bearer token...');
            const loginResponse = await axios.post(
                `${BASE_URL}/Account/LoginAD`,
                requestBody,
                {
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    validateStatus: status => status < 500
                }
            );

            console.log('[API] LoginAD Status:', loginResponse.status);
            console.log('[API] LoginAD Response:', JSON.stringify(loginResponse.data).substring(0, 500));

            if (loginResponse.status === 200 && loginResponse.data) {
                // Success!
                console.log('[API] ✅ LoginAD SUCCESS!');

                const apiData = loginResponse.data;

                // Decode upstream JWTs and bind the authenticated user identity to the session
                let userProfile = {};
                let identityCookieValue = null;
                try {
                    const tokenuser = apiData.tokenuser;
                    if (!tokenuser) {
                        throw new Error('No tokenuser in response');
                    }
                    if (!apiData.token) {
                        throw new Error('No token in response');
                    }

                    const tokenUserPayloadBase64 = tokenuser.split('.')[1];
                    const tokenUserPayloadJson = Buffer.from(tokenUserPayloadBase64, 'base64url').toString('utf-8');
                    const decoded = JSON.parse(tokenUserPayloadJson);

                    const tokenPayloadBase64 = apiData.token.split('.')[1];
                    const tokenPayloadJson = Buffer.from(tokenPayloadBase64, 'base64url').toString('utf-8');
                    const decodedToken = JSON.parse(tokenPayloadJson);

                    if (!decoded.usercode || !decodedToken.session) {
                        throw new Error('Missing secure identity claims in upstream tokens');
                    }

                    identityCookieValue = createSignedAuthIdentityCookie({
                        userCode: decoded.usercode,
                        session: decodedToken.session
                    });

                    userProfile = {
                        username: decoded.username || '',
                        usernameeng: decoded.usernameeng || '',
                        name: decoded.name || '',
                        nameeng: decoded.nameeng || '',
                        email: decoded.email || '',
                        usercode: decoded.usercode || '',
                        userid: decoded.userid || '',
                        userstatus: decoded.userstatus || '',
                        userstatusdes: decoded.userstatusdes || '',
                        statusdes: decoded.statusdes || '',
                        statusdeseng: decoded.statusdeseng || '',
                        role: decoded.role || [],
                        reportdate: decoded.reportdate || '',
                        img: apiData.img || apiData.navimg || '',
                    };

                    // ----------------------------------------------------------------
                    // REGISTRATION / PROFILE IMAGE DATABASE LOGIC
                    // ----------------------------------------------------------------
                    let finalImageUrl = userProfile.img;

                    try {
                        const supabase = getServiceSupabase();
                        const normalizedUsercode = userProfile.usercode.startsWith('s') ? userProfile.usercode.substring(1) : userProfile.usercode;

                        const { data: existingStudent, error: selectError } = await supabase
                            .from('students')
                            .select('profile_image_url, is_custom_image')
                            .eq('usercode', normalizedUsercode)
                            .single();

                        if (selectError && selectError.code !== 'PGRST116') {
                            console.error('[API] Supabase Select Error:', selectError);
                        }

                        if (existingStudent) {
                            if (existingStudent.is_custom_image === 1) {
                                finalImageUrl = existingStudent.profile_image_url;
                            } else {
                                await supabase.from('students')
                                    .update({ profile_image_url: userProfile.img })
                                    .eq('usercode', userProfile.usercode);
                            }
                        } else {
                            const { error: insertError } = await supabase
                                .from('students')
                                .insert({
                                    usercode: normalizedUsercode,
                                    name: userProfile.name,
                                    nameeng: userProfile.nameeng,
                                    email: userProfile.email,
                                    profile_image_url: userProfile.img,
                                    is_custom_image: 0
                                });

                            if (insertError) console.error('[API] Supabase Insert Error:', insertError);
                        }

                        userProfile.img = finalImageUrl;
                    } catch (dbError) {
                        console.error('[API] Database operation failed during login:', dbError);
                    }
                } catch (decodeErr) {
                    console.error('[API] Failed to establish secure session identity:', decodeErr.message);
                    return NextResponse.json(
                        { success: false, message: 'ไม่สามารถสร้าง session ที่ปลอดภัยได้ กรุณาลองใหม่อีกครั้ง' },
                        { status: 502 }
                    );
                }


                // Build user data for frontend (no raw JWTs exposed)
                const fallbackImg = apiData.img || apiData.navimg || '';
                const userData = {
                    ...userProfile,
                    // If userProfile.img is somehow empty, fall back to what the API returned directly
                    img: userProfile.img || fallbackImg,
                    originalImg: fallbackImg,
                    navimg: apiData.navimg || '',
                };

                const response = NextResponse.json({
                    success: true,
                    message: 'เข้าสู่ระบบสำเร็จ',
                    data: userData
                });

                // Store API token in HttpOnly cookie
                if (apiData.token) {
                    response.cookies.set('reg_token', apiData.token, {
                        httpOnly: true,
                        secure: process.env.NODE_ENV === 'production',
                        path: '/',
                        sameSite: 'lax',
                        maxAge: 60 * 55 // ~55 minutes
                    });
                }

                // Store server-signed identity bound to the validated upstream session
                response.cookies.set(AUTH_IDENTITY_COOKIE_NAME, identityCookieValue, {
                    httpOnly: true,
                    secure: process.env.NODE_ENV === 'production',
                    path: '/',
                    sameSite: 'lax',
                    maxAge: AUTH_IDENTITY_COOKIE_MAX_AGE_SECONDS
                });

                // Clear the legacy identity cookie during the cutover.
                response.cookies.set('std_code', '', {
                    httpOnly: true,
                    secure: process.env.NODE_ENV === 'production',
                    path: '/',
                    sameSite: 'lax',
                    maxAge: 0
                });

                // Upsert user_directory for searchable user directory
                if (userData.usercode) {
                    try {
                        const supabase = getServiceSupabase();
                        await supabase.from('user_directory').upsert({
                            user_code: userData.usercode,
                            name_th: userData.username || '',
                            name_en: userData.usernameeng || '',
                            email: userData.email || '',
                            faculty: '',
                            avatar_url: userData.img || '',
                            last_login: new Date().toISOString(),
                        }, { onConflict: 'user_code' });
                    } catch (upsertErr) {
                        console.warn('[API] user_directory upsert failed (non-blocking):', upsertErr.message);
                    }
                }

                return response;
            } else {
                console.warn('[API] LoginAD non-200 status:', loginResponse.status, loginResponse.data);
                loginLimiter.increment(ip);
                const remainingAttempts = rateLimit.remaining - 1;

                // Server returns 404 for auth failures (with {result: "..."})
                // Also handle standard 401
                if (loginResponse.status === 401 || loginResponse.status === 404) {
                    const serverMsg = loginResponse.data?.result || '';
                    const isLocked = serverMsg.includes('Lock');
                    return NextResponse.json(
                        {
                            success: false,
                            message: isLocked
                                ? 'บัญชีถูกล็อค กรุณาลองใหม่ภายหลัง'
                                : remainingAttempts > 0
                                    ? `รหัสผู้ใช้หรือรหัสผ่านไม่ถูกต้อง (คงเหลือ ${remainingAttempts} ครั้ง)`
                                    : 'รหัสผู้ใช้หรือรหัสผ่านไม่ถูกต้อง',
                            apiStatus: loginResponse.status,
                            serverError: serverMsg
                        },
                        { status: 401 }
                    );
                }
                // Other unexpected statuses
                return NextResponse.json(
                    { success: false, message: 'เกิดข้อผิดพลาดจากระบบทะเบียน', apiStatus: loginResponse.status },
                    { status: loginResponse.status }
                );
            }

        } catch (realApiErr) {
            console.error('[API] Real Integration Error:', realApiErr.message);
            if (realApiErr.response) {
                console.error('[API] Response data:', JSON.stringify(realApiErr.response.data).substring(0, 300));
            }
            // Fall through to final error
        }




        // --- REAL API SUCCESS HANDLER (Future) ---
        // if (apiResponse && apiResponse.status === 200) { ... }

        // Increment rate limit on failed attempt
        loginLimiter.increment(ip);

        const remainingAttempts = rateLimit.remaining - 1;
        const warningMessage = remainingAttempts > 0
            ? `รหัสผู้ใช้หรือรหัสผ่านไม่ถูกต้อง (คงเหลือ ${remainingAttempts} ครั้ง)`
            : 'รหัสผู้ใช้หรือรหัสผ่านไม่ถูกต้อง';

        console.log('[API] Login failed');
        return NextResponse.json(
            { success: false, message: warningMessage },
            { status: 401 }
        );

    } catch (error) {
        console.error('[API] Login Error:', error.message);
        return NextResponse.json(
            { success: false, message: 'เกิดข้อผิดพลาดในการเชื่อมต่อกับระบบทะเบียน' },
            { status: 500 }
        );
    }
}
