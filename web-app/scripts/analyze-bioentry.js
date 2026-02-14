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

// Ignore self-signed certs if any
const agent = new https.Agent({ rejectUnauthorized: false });

async function run() {
    try {
        // 1. Get Token
        const tokenRes = await axios.get(`${BASE_URL}/Validate/tokenservice`, { httpsAgent: agent });
        const serviceToken = tokenRes.data.token;

        // 2. Login
        const credentials = JSON.stringify({ username: USERNAME, password: PASSWORD, ip: '127.0.0.1' });
        // Encrypt Helper (Simplified from previous script)
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

        // 3. Fetch Bioentry
        console.log('Fetching Bioentryconfig/I...');
        const res = await axios.get(`${BASE_URL}/Bioentryconfig/Getbioentryconfig/I`, {
            headers: { 'Authorization': `Bearer ${userToken}` },
            httpsAgent: agent
        });

        if (res.status === 200 && Array.isArray(res.data)) {
            console.log(`Found ${res.data.length} items.`);

            // Analyze fields
            const targets = ['ที่ปรึกษา', 'Advisor', 'อาจารย์', 'คณะ', 'Faculty', 'สาขา', 'Department', 'Major', 'หลักสูตร', 'Curriculum'];

            const matches = res.data.filter(item => {
                const name = item.bioentryname || '';
                return targets.some(t => name.includes(t));
            });

            console.log('--- Matches ---');
            matches.forEach(m => {
                console.log(`Name: ${m.bioentryname}`);
                console.log(`Value (Default): ${m.biodefaultvalue}`);
                // Check combolist if default is ID
                if (m.biodefaultvalue && Array.isArray(m.combolist) && m.combolist.length > 0) {
                    const selected = m.combolist.find(c => c.valueid == m.biodefaultvalue);
                    if (selected) console.log(`Decoded Value: ${selected.label}`);
                }
                console.log('---');
            });

            // Also check for "Advisor 2", "Advisor 3" specifically by incrementing ID or pattern matching

        } else {
            console.log('Failed or not array:', res.status);
        }

    } catch (e) {
        console.error('Error:', e.message);
        if (e.response) console.error('Response:', e.response.data);
    }
}

run();
