import { NextResponse } from 'next/server';
import axios from 'axios';
import crypto from 'crypto';

// Rate limiting storage (in-memory for prototype, should use Redis in production)
const rateLimitStore = new Map();
const RATE_LIMIT_WINDOW = 15 * 60 * 1000; // 15 minutes
const MAX_ATTEMPTS = 5;

function checkRateLimit(ip) {
    const now = Date.now();
    const attempts = rateLimitStore.get(ip) || { count: 0, resetTime: now + RATE_LIMIT_WINDOW };

    if (now > attempts.resetTime) {
        // Reset if window expired
        rateLimitStore.set(ip, { count: 0, resetTime: now + RATE_LIMIT_WINDOW });
        return { allowed: true, attempts: 0, resetTime: now + RATE_LIMIT_WINDOW };
    }

    if (attempts.count >= MAX_ATTEMPTS) {
        return { allowed: false, attempts: attempts.count, resetTime: attempts.resetTime };
    }

    return { allowed: true, attempts: attempts.count, resetTime: attempts.resetTime };
}

function incrementRateLimit(ip) {
    const attempts = rateLimitStore.get(ip) || { count: 0, resetTime: Date.now() + RATE_LIMIT_WINDOW };
    attempts.count++;
    rateLimitStore.set(ip, attempts);
}

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
        const ip = request.headers.get('x-forwarded-for') ||
            request.headers.get('x-real-ip') ||
            'unknown';

        // Check rate limit
        const rateLimit = checkRateLimit(ip);
        if (!rateLimit.allowed) {
            const minutesLeft = Math.ceil((rateLimit.resetTime - Date.now()) / 60000);
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

        // Encryption function using native Node.js crypto (matches .NET server-side decryption)
        function encryptData(plaintext) {
            const ENCRYPT_SECRET_KEY = process.env.ENCRYPT_SECRET_KEY || 'mySecretKeyHere';
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
            // Step 0: Get client's public IP (same as Angular app)
            let clientIp = '';
            try {
                const ipResponse = await axios.get('https://api.ipify.org/?format=json', { timeout: 3000 });
                clientIp = ipResponse.data?.ip || '';
            } catch (ipErr) {
                console.warn('[API] Could not get public IP:', ipErr.message);
            }

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

            // Step 2: Encrypt credentials with IP (matches Angular app's user object)
            const credentialsJson = JSON.stringify({ username, password, ip: clientIp });
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
                const userData = {
                    ...userProfile,
                    img: apiData.img || apiData.navimg || '',
                    navimg: apiData.navimg || '',
                };

                const response = NextResponse.json({
                    success: true,
                    message: 'เข้าสู่ระบบสำเร็จ',
                    data: userData
                });

                // Store API token in HttpOnly cookie for future proxy calls
                if (apiData.token) {
                    response.cookies.set('reg_token', apiData.token, {
                        httpOnly: true,
                        secure: process.env.NODE_ENV === 'production',
                        path: '/',
                        sameSite: 'lax',
                        maxAge: 60 * 55 // ~55 minutes (token expires in ~1hr)
                    });
                }

                return response;
            } else {
                console.warn('[API] LoginAD non-200 status:', loginResponse.status, loginResponse.data);
                incrementRateLimit(ip);
                const remainingAttempts = MAX_ATTEMPTS - rateLimit.attempts - 1;

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
        incrementRateLimit(ip);

        const remainingAttempts = MAX_ATTEMPTS - rateLimit.attempts - 1;
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
