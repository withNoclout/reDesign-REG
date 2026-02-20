import { NextResponse } from 'next/server';
import axios from 'axios';
import crypto from 'crypto';
import { createRateLimiter, getClientIp } from '@/lib/rateLimit';
import { getServiceSupabase } from '@/lib/supabase';

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

        // Encryption function using native Node.js crypto (matches .NET server-side decryption)
        function encryptData(plaintext) {
            const salt = crypto.randomBytes(16);
            // PBKDF2 with SHA1, 32 bytes (256-bit key), 100 iterations
            const derivedKey = crypto.pbkdf2Sync(ENCRYPT_SECRET_KEY, salt, 100, 32, 'sha1');
            const iv = crypto.randomBytes(16);
            const cipher = crypto.createCipheriv('aes-256-cbc', derivedKey, iv);
            cipher.setAutoPadding(true); // PKCS7 padding
            const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
            // Output: Base64(salt + iv + ciphertext)
            return Buffer.concat([salt, iv, encrypted]).toString('base64');
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
            console.log('[API] Got JWT token:', token.substring(0, 30) + '...');

            // Step 2: Encrypt credentials with server IP (matches Angular app's user object)
            const credentialsJson = JSON.stringify({ username, password, ip: serverIp });
            const encryptedParam = encryptData(credentialsJson);
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

                // Decode tokenuser JWT to extract user profile
                let userProfile = {};
                try {
                    const tokenuser = apiData.tokenuser;
                    if (tokenuser) {
                        const payloadBase64 = tokenuser.split('.')[1];
                        const payloadJson = Buffer.from(payloadBase64, 'base64url').toString('utf-8');
                        const decoded = JSON.parse(payloadJson);
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
                        };
                    }
                } catch (decodeErr) {
                    console.warn('[API] Failed to decode tokenuser JWT:', decodeErr.message);
                }

                // Build user data for frontend (no raw JWTs exposed)
                let persistedProfileImage = '';
                if (userProfile.usercode) {
                    try {
                        const supabase = getServiceSupabase();
                        const { data: profileImageRow } = await supabase
                            .from('user_verifications')
                            .select('profile_image_url')
                            .eq('user_code', String(userProfile.usercode))
                            .single();
                        persistedProfileImage = profileImageRow?.profile_image_url || '';
                    } catch (imgErr) {
                        console.warn('[API] profile image fetch failed (non-blocking):', imgErr.message);
                    }
                }

                const fallbackImg = apiData.img || apiData.navimg || '';
                const userData = {
                    ...userProfile,
                    img: persistedProfileImage || fallbackImg,
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

                // Store Student Code in Cookie for Offline/Cache Fallback
                if (userData.usercode) {
                    response.cookies.set('std_code', userData.usercode, {
                        httpOnly: true,
                        secure: process.env.NODE_ENV === 'production',
                        path: '/',
                        sameSite: 'lax',
                        maxAge: 60 * 60 * 24 * 30 // 30 Days (Persistent for cache)
                    });
                }

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
