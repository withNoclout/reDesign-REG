const axios = require('axios');
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

const BASE_URL = 'https://reg4.kmutnb.ac.th/regapiweb2/api/th';
const USERNAME = env.REG_USERNAME;
const PASSWORD = env.REG_PASSWORD;

const agent = new https.Agent({ rejectUnauthorized: false });

async function run() {
    try {
        console.log('--- Auth ---');
        // 1. Get Token
        const tokenRes = await axios.get(`${BASE_URL}/Validate/tokenservice`, { httpsAgent: agent });
        const serviceToken = tokenRes.data.token;

        // 2. Login
        const crypto = require('crypto');
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

        const credentials = JSON.stringify({ username: USERNAME, password: PASSWORD, ip: '127.0.0.1' });
        const encryptedParam = encryptData(credentials);

        const loginRes = await axios.post(`${BASE_URL}/Account/LoginAD`,
            { param: encryptedParam },
            {
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${serviceToken}`
                },
                httpsAgent: agent
            }
        );
        const userToken = loginRes.data.token;
        console.log('Logged in. Token prefix:', userToken.substring(0, 10));

        // 3. Test Enroll/Week
        console.log('\n--- Checking Enroll/Week ---');
        try {
            const res = await axios.get(`${BASE_URL}/Enroll/Week`, {
                headers: { 'Authorization': `Bearer ${userToken}` },
                httpsAgent: agent // Important for self-signed
            });
            console.log('Status:', res.status);
            console.log('Data:', JSON.stringify(res.data, null, 2));
        } catch (e) {
            console.log('Enroll/Week Error:', e.message);
            if (e.response) console.log('Response:', e.response.data);
        }

    } catch (e) {
        console.error('Fatal Error:', e.message);
    }
}

run();
