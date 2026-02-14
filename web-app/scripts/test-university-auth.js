const axios = require('axios');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const https = require('https');

// Load Env
const envPath = path.resolve(__dirname, '../.env.local');
let env = {};
if (fs.existsSync(envPath)) {
    const envConfig = fs.readFileSync(envPath, 'utf8');
    envConfig.split('\n').forEach(line => {
        const [key, value] = line.split('=');
        if (key && value) env[key.trim()] = value.trim();
    });
}

const USERNAME = env.REG_USERNAME;
const PASSWORD = env.REG_PASSWORD;
const BASE_URL = 'https://reg4.kmutnb.ac.th/regapiweb2/api/th';

console.log('🚀 Starting Auth Diagnosis...');
console.log(`User: ${USERNAME}`);
console.log(`Target: ${BASE_URL}`);

// Encrypt Helper matches route.js logic
function encryptData(plaintext) {
    const ENCRYPT_SECRET_KEY = env.ENCRYPT_SECRET_KEY || 'mySecretKeyHere';
    const salt = crypto.randomBytes(16);
    const derivedKey = crypto.pbkdf2Sync(ENCRYPT_SECRET_KEY, salt, 100, 32, 'sha1');
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-cbc', derivedKey, iv);
    cipher.setAutoPadding(true);
    const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    return Buffer.concat([salt, iv, encrypted]).toString('base64');
}

// Ignore self-signed certs if any
const agent = new https.Agent({ rejectUnauthorized: false });

async function runTest() {
    try {
        // 1. Get Token Service
        console.log('\n1️⃣ Calling tokenservice...');
        const tokenRes = await axios.get(`${BASE_URL}/Validate/tokenservice`, { httpsAgent: agent });
        const serviceToken = tokenRes.data.token;

        if (!serviceToken) {
            console.error('❌ Failed to get service token');
            return;
        }
        console.log('✅ Service Token received');

        // 2. Login AD
        console.log('\n2️⃣ Calling LoginAD...');
        const credentials = JSON.stringify({ username: USERNAME, password: PASSWORD, ip: '127.0.0.1' });
        const encryptedParam = encryptData(credentials);

        const loginRes = await axios.post(`${BASE_URL}/Account/LoginAD`,
            { param: encryptedParam },
            {
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${serviceToken}`
                },
                httpsAgent: agent,
                validateStatus: status => true
            }
        );

        console.log(`Login Status: ${loginRes.status}`);

        if (loginRes.status !== 200 || !loginRes.data.token) {
            console.error('❌ Login Failed:', loginRes.data);
            return;
        }

        const userToken = loginRes.data.token;
        console.log('✅ Login Success! User Token received.');
        console.log(`Token: ${userToken.substring(0, 20)}...`);

        // 3. Test Getacadstd with "Authorization: Bearer"
        console.log('\n3️⃣ Testing "Authorization: Bearer" header...');
        try {
            const res1 = await axios.get(`${BASE_URL}/Schg/Getacadstd`, {
                headers: { 'Authorization': `Bearer ${userToken}` },
                httpsAgent: agent,
                validateStatus: status => true
            });
            console.log(`Status: ${res1.status}`);
            if (res1.status === 200) {
                console.log('✅ SUCCESS! Getacadstd Data:', JSON.stringify(res1.data, null, 2));
            } else {
                console.log('❌ FAILED. Response:', JSON.stringify(res1.data).substring(0, 100));
            }
        } catch (e) {
            console.log('❌ Error:', e.message);
        }

        // 4. Test Getacadstd with "token" header
        console.log('\n4️⃣ Testing "token" header...');
        try {
            const res2 = await axios.get(`${BASE_URL}/Schg/Getacadstd`, {
                headers: { 'token': userToken },
                httpsAgent: agent,
                validateStatus: status => true
            });
            console.log(`Status: ${res2.status}`);
            if (res2.status === 200) {
                console.log('✅ SUCCESS! Data:', JSON.stringify(res2.data).substring(0, 100));
            } else {
                console.log('❌ FAILED. Response:', JSON.stringify(res2.data).substring(0, 100));
            }
        } catch (e) {
            console.log('❌ Error:', e.message);
        }

        // 5. Test Getstudentinfo with Bearer
        console.log('\n5️⃣ Testing Getstudentinfo (Bearer)...');
        try {
            const res3 = await axios.get(`${BASE_URL}/Schg/Getstudentinfo`, {
                headers: { 'Authorization': `Bearer ${userToken}` },
                httpsAgent: agent,
                validateStatus: status => true
            });
            console.log(`Status: ${res3.status}`);
            if (res3.status === 200) {
                console.log('✅ SUCCESS! Student Info Data:', JSON.stringify(res3.data, null, 2));
            } else {
                console.log('❌ FAILED. Response:', JSON.stringify(res3.data).substring(0, 200));
            }
        } catch (e) {
            console.log('❌ Error:', e.message);
        }

        // 8. Test Schg/All
        console.log('\n8️⃣ Testing Schg/All (Bearer)...');
        try {
            const res6 = await axios.get(`${BASE_URL}/Schg/All`, {
                headers: { 'Authorization': `Bearer ${userToken}` },
                httpsAgent: agent,
                validateStatus: status => true
            });
            console.log(`Status: ${res6.status}`);
            if (res6.status === 200 && res6.data) {
                console.log(`✅ SUCCESS! Body length: ${JSON.stringify(res6.data).length}`);
                console.log('Sample Data (Keys):', Object.keys(res6.data));
            } else {
                console.log('❌ FAILED/EMPTY. Response:', JSON.stringify(res6.data).substring(0, 100));
            }
        } catch (e) {
            console.log('❌ Error:', e.message);
        }

        // 9. Test Schg/Getacad
        console.log('\n9️⃣ Testing Schg/Getacad (Bearer)...');
        try {
            const res7 = await axios.get(`${BASE_URL}/Schg/Getacad`, {
                headers: { 'Authorization': `Bearer ${userToken}` },
                httpsAgent: agent,
                validateStatus: status => true
            });
            console.log(`Status: ${res7.status}`);
            if (res7.status === 200 && res7.data) {
                console.log(`✅ SUCCESS! Body length: ${JSON.stringify(res7.data).length}`);
                console.log('Sample Data (Keys):', Object.keys(res7.data));
            } else {
                console.log('❌ FAILED/EMPTY. Response:', JSON.stringify(res7.data).substring(0, 100));
            }
        } catch (e) {
            console.log('❌ Error:', e.message);
        }

        // 10. Test Bioentryconfig/Getbioentryconfig/I (User Suggested)
        console.log('\n🔟 Testing Bioentryconfig/Getbioentryconfig/I (Bearer)...');
        try {
            // Note: The screenshot showed reg1, but we use reg4. They are mirrors.
            const res8 = await axios.get(`${BASE_URL}/Bioentryconfig/Getbioentryconfig/I`, {
                headers: { 'Authorization': `Bearer ${userToken}` },
                httpsAgent: agent,
                validateStatus: status => true
            });
            console.log(`Status: ${res8.status}`);
            if (res8.status === 200 && Array.isArray(res8.data)) {
                console.log(`✅ SUCCESS! Body length: ${JSON.stringify(res8.data).length}`);
                console.log(`✅ SUCCESS! Found ${res8.data.length} items.`);

                // Search for keywords
                const keywords = ['ที่ปรึกษา', 'Advisor', 'คณะ', 'Faculty', 'สาขา', 'Department', 'Major', 'ปี', 'Year'];
                const found = res8.data.filter(item => {
                    const val = JSON.stringify(item);
                    return keywords.some(k => val.includes(k));
                });

                console.log(`Found ${found.length} items matching keywords:`, JSON.stringify(found, null, 2));

            } else {
                console.log('❌ FAILED/EMPTY. Response:', JSON.stringify(res8.data).substring(0, 100));
            }
        } catch (e) {
            console.log('❌ Error:', e.message);
        }

    } catch (err) {
        console.error('❌ Fatal Error:', err.message);
        if (err.response) console.error('Response:', err.response.data);
    }
}

runTest();
