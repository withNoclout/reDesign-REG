// Full end-to-end test: DB check + reg2 login test
const crypto = require('crypto');
const axios = require('axios');

require('dotenv').config({ path: '.env.local' });

const { createClient } = require('@supabase/supabase-js');

const TEST_USERNAME = process.env.REG_USERNAME;
const TEST_PASSWORD = process.env.REG_PASSWORD;

const getSecretKey = () => {
    const secret = process.env.AUTO_EVAL_SECRET_KEY || process.env.ENCRYPT_SECRET_KEY || 'fallback_dev_key_only_change_in_prod';
    return crypto.createHash('sha256').update(String(secret)).digest();
};

function decryptPassword(encryptedData, ivHex) {
    const iv = Buffer.from(ivHex, 'hex');
    const decipher = crypto.createDecipheriv('aes-256-cbc', getSecretKey(), iv);
    let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
}

async function testReg2Login(username, password) {
    console.log(`\n--- Testing reg2 login with: uid=${username}, pwd=${password} ---`);

    try {
        const loginData = new URLSearchParams();
        loginData.append('f_uid', username);
        loginData.append('f_pwd', password);

        const loginRes = await axios.post('https://reg2.kmutnb.ac.th/registrar/login_chk', loginData.toString(), {
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            },
            validateStatus: s => true,
            maxRedirects: 0
        });

        console.log('HTTP Status:', loginRes.status);
        console.log('Location Header:', loginRes.headers['location'] || 'N/A');

        const cookies = loginRes.headers['set-cookie'] || [];
        console.log('Cookies received:', cookies.length);
        cookies.forEach(c => console.log('  Cookie:', c.split(';')[0]));

        const sessionCookie = cookies.find(c => c.includes('ASP.NET_SessionId'));

        if (sessionCookie) {
            console.log('✅ ASP.NET_SessionId found - Login likely succeeded');

            // Try to access the evaluation page
            const authCookie = sessionCookie.split(';')[0];
            try {
                const testPage = await axios.get('https://reg2.kmutnb.ac.th/registrar/evaluateofficer', {
                    headers: { 'Cookie': authCookie, 'User-Agent': 'Mozilla/5.0' },
                    validateStatus: s => true,
                    maxRedirects: 5
                });
                console.log('Evaluation page status:', testPage.status);
                console.log('Page content length:', (testPage.data || '').length);
                // Check if we got redirected to login (session invalid)
                if ((testPage.data || '').includes('login') && testPage.status === 200) {
                    console.log('⚠️ Page contains "login" keyword - might have been redirected to login page');
                } else {
                    console.log('✅ Evaluation page loaded successfully');
                }
            } catch (err) {
                console.log('❌ Failed to access evaluation page:', err.message);
            }
        } else {
            console.log('❌ No ASP.NET_SessionId - Login failed');
            // Check response body for clues
            const body = (loginRes.data || '').toString().substring(0, 500);
            console.log('Response body (first 500 chars):', body);
        }
    } catch (err) {
        console.log('❌ Network error:', err.message);
    }
}

async function main() {
    console.log('=== REG2 Login Diagnostic ===');
    console.log('ENV username:', TEST_USERNAME);
    console.log('ENV password:', TEST_PASSWORD);

    // Step 1: Test direct login with known credentials
    console.log('\n========================================');
    console.log('STEP 1: Direct login with ENV credentials');
    console.log('========================================');
    await testReg2Login(TEST_USERNAME, TEST_PASSWORD);

    // Step 2: Check if the std_code format matters (with/without 's' prefix)
    const bareCode = TEST_USERNAME.replace(/^s/, '');
    if (bareCode !== TEST_USERNAME) {
        console.log('\n========================================');
        console.log('STEP 2: Try login without "s" prefix');
        console.log('========================================');
        await testReg2Login(bareCode, TEST_PASSWORD);
    }

    // Step 3: Check database
    console.log('\n========================================');
    console.log('STEP 3: Check Database Credentials');
    console.log('========================================');
    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

    // Try both with and without 's' prefix
    for (const code of [TEST_USERNAME, bareCode]) {
        const { data, error } = await supabase
            .from('user_credentials')
            .select('*')
            .eq('user_code', code)
            .single();

        if (data) {
            console.log(`\n✅ Found credentials for user_code="${code}":`);
            console.log('  encrypted_password:', data.encrypted_password ? data.encrypted_password.substring(0, 30) + '...' : 'NULL');
            console.log('  iv:', data.iv || 'NULL');
            console.log('  is_auto_eval_enabled:', data.is_auto_eval_enabled);

            if (data.encrypted_password && data.iv) {
                try {
                    const decrypted = decryptPassword(data.encrypted_password, data.iv);
                    console.log('  Decrypted password:', decrypted);
                    console.log('  Matches ENV:', decrypted === TEST_PASSWORD ? '✅' : '❌');

                    // Test login with decrypted password
                    console.log('\n  → Testing reg2 login with DB-decrypted password...');
                    await testReg2Login(code, decrypted);
                } catch (decErr) {
                    console.log('  ❌ Decrypt failed:', decErr.message);
                }
            }
        } else {
            console.log(`❌ No record for user_code="${code}": ${error?.message || 'unknown'}`);
        }
    }

    // Also list all records in user_credentials
    console.log('\n========================================');
    console.log('STEP 4: List ALL user_credentials');
    console.log('========================================');
    const { data: allCreds } = await supabase.from('user_credentials').select('user_code, is_auto_eval_enabled, encrypted_password, iv').limit(10);
    if (allCreds && allCreds.length > 0) {
        allCreds.forEach(c => {
            console.log(`  user_code=${c.user_code}, auto_eval=${c.is_auto_eval_enabled}, has_pw=${!!c.encrypted_password}, has_iv=${!!c.iv}`);
        });
    } else {
        console.log('  (empty table)');
    }
}

main().catch(console.error);
