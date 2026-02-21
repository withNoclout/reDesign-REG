// Test script to verify credential encryption/decryption and reg2 login
import dotenv from 'dotenv';
import crypto from 'crypto';
import axios from 'axios';
import { createClient } from '@supabase/supabase-js';

dotenv.config({ path: '.env.local' });

const TEST_USERNAME = process.env.REG_USERNAME;
const TEST_PASSWORD = process.env.REG_PASSWORD;

// ---- Replicate cryptoUtils logic ----
const getSecretKey = () => {
    const secret = process.env.AUTO_EVAL_SECRET_KEY || process.env.ENCRYPT_SECRET_KEY || 'fallback_dev_key_only_change_in_prod';
    return crypto.createHash('sha256').update(String(secret)).digest();
};

const ALGORITHM = 'aes-256-cbc';

function encryptPassword(text) {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(ALGORITHM, getSecretKey(), iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return { iv: iv.toString('hex'), encryptedData: encrypted };
}

function decryptPassword(encryptedData, ivHex) {
    const iv = Buffer.from(ivHex, 'hex');
    const decipher = crypto.createDecipheriv(ALGORITHM, getSecretKey(), iv);
    let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
}

// ---- Main Test ----
async function main() {
    console.log('=== Testing Credential Flow ===');
    console.log('Test User:', TEST_USERNAME);
    console.log('Test Password (raw):', TEST_PASSWORD);
    console.log('ENCRYPT_SECRET_KEY:', process.env.ENCRYPT_SECRET_KEY ? '✅ Set' : '❌ Not set');

    // 1. Encrypt + Decrypt cycle
    console.log('\n--- Step 1: Encrypt → Decrypt Cycle ---');
    const { iv, encryptedData } = encryptPassword(TEST_PASSWORD);
    console.log('IV:', iv);
    console.log('Encrypted:', encryptedData);
    const decrypted = decryptPassword(encryptedData, iv);
    console.log('Decrypted:', decrypted);
    console.log('Match:', decrypted === TEST_PASSWORD ? '✅ PASS' : '❌ FAIL');

    // 2. Check what's in Database
    console.log('\n--- Step 2: Check Database Credentials ---');
    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
    const { data: cred, error: credError } = await supabase
        .from('user_credentials')
        .select('*')
        .eq('user_code', TEST_USERNAME)
        .single();

    if (credError) {
        console.log('❌ No DB credential found:', credError.message);
        console.log('   → This means the user has not logged in since the seamless capture was added.');
        console.log('   → Solution: User must Logout then Login again.');
    } else {
        console.log('✅ DB credential found for user:', cred.user_code);
        console.log('   encrypted_password:', cred.encrypted_password ? cred.encrypted_password.substring(0, 20) + '...' : 'NULL');
        console.log('   iv:', cred.iv || 'NULL');
        console.log('   is_auto_eval_enabled:', cred.is_auto_eval_enabled);

        if (cred.encrypted_password && cred.iv) {
            const dbDecrypted = decryptPassword(cred.encrypted_password, cred.iv);
            console.log('   Decrypted from DB:', dbDecrypted);
            console.log('   Matches env password:', dbDecrypted === TEST_PASSWORD ? '✅ PASS' : '❌ FAIL');

            // 3. Try to login to reg2 with decrypted password
            console.log('\n--- Step 3: Test Login to reg2 ---');
            try {
                const loginData = new URLSearchParams();
                loginData.append('f_uid', TEST_USERNAME);
                loginData.append('f_pwd', dbDecrypted);

                const loginRes = await axios.post('https://reg2.kmutnb.ac.th/registrar/login_chk', loginData.toString(), {
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                    validateStatus: s => s < 500,
                    maxRedirects: 0
                });

                console.log('   reg2 login status:', loginRes.status);
                const cookies = loginRes.headers['set-cookie'] || [];
                const sessionCookie = cookies.find(c => c.includes('ASP.NET_SessionId'));
                if (sessionCookie) {
                    console.log('   ✅ Got ASP.NET_SessionId cookie');
                    console.log('   Cookie:', sessionCookie.split(';')[0]);
                } else {
                    console.log('   ❌ No ASP.NET_SessionId cookie found');
                    console.log('   All cookies:', cookies);
                    console.log('   Response Location:', loginRes.headers['location'] || 'N/A');
                }
            } catch (err) {
                console.log('   ❌ reg2 login error:', err.message);
            }
        } else {
            console.log('   ❌ Encrypted password or IV is null in database');
        }
    }
}

main().catch(console.error);
