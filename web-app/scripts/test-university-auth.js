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
                console.log('✅ SUCCESS! Data:', JSON.stringify(res1.data).substring(0, 100));
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

    } catch (err) {
        console.error('❌ Fatal Error:', err.message);
        if (err.response) console.error('Response:', err.response.data);
    }
}

runTest();
