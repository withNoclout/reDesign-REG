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
        console.log('--- Auth ---');
        // 1. Get Token
        const tokenRes = await axios.get(`${BASE_URL}/Validate/tokenservice`, { httpsAgent: agent });
        const serviceToken = tokenRes.data.token;

        // 2. Login
        const credentials = JSON.stringify({ username: USERNAME, password: PASSWORD, ip: '127.0.0.1' });
        // Encrypt Helper 
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
        console.log('Logged in.\n');

        // B. Deep check Grade/Showgrade for Exam Data
        console.log('--- Checking Grade/Showgrade ---');
        try {
            const grades = await axios.get(`${BASE_URL}/Grade/Showgrade`, {
                headers: { 'Authorization': `Bearer ${userToken}` },
                httpsAgent: agent
            });
            console.log('Status:', grades.status);

            // Find current semester (highest year/sem)
            if (Array.isArray(grades.data)) {
                // Find most recent
                const current = grades.data.reduce((latest, current) => {
                    const lcode = parseInt(latest.acadyear) * 10 + parseInt(latest.semester);
                    const ccode = parseInt(current.acadyear) * 10 + parseInt(current.semester);
                    return ccode > lcode ? current : latest;
                }, grades.data[0]);

                console.log(`Current Sem: ${current.acadyear}/${current.semester}`);

                // Inspect Courses deeply
                if (current.subjects) {
                    console.log('--- Inspecting Current Subjects ---');
                    // Just dump keys of first subject
                    const sub = current.subjects[0];
                    console.log('Subject Keys:', Object.keys(sub));

                    // Search for "exam", "test", "date"
                    const keywords = ['exam', 'test', 'date', 'room', 'สอบ', 'เวลา'];
                    const found = Object.keys(sub).filter(k => keywords.some(kw => k.toLowerCase().includes(kw)));
                    console.log('Potentially Relevant Keys:', found);

                    if (found.length > 0) {
                        console.log('Example Values:', found.map(k => `${k}: ${sub[k]}`));
                    }
                }
            }
        } catch (e) { console.log('Grade/Showgrade Error:', e.message); }

        // C. Speculative: Enroll/ClassSchedule (This is a common name)
        console.log('\n--- Checking Enroll/ClassSchedule ---');
        try {
            const cs = await axios.get(`${BASE_URL}/Enroll/ClassSchedule`, {
                headers: { 'Authorization': `Bearer ${userToken}` },
                httpsAgent: agent,
                validateStatus: () => true
            });
            console.log('Status:', cs.status);
        } catch (e) { console.log('Error:', e.message); }

        // D. Speculative: Schg/GetClassSchedule
        console.log('\n--- Checking Schg/GetClassSchedule ---');
        try {
            const cs2 = await axios.get(`${BASE_URL}/Schg/GetClassSchedule`, {
                headers: { 'Authorization': `Bearer ${userToken}` },
                httpsAgent: agent,
                validateStatus: () => true
            });
            console.log('Status:', cs2.status);
            if (cs2.status === 200) {
                console.log(JSON.stringify(cs2.data).substring(0, 200));
            }
        } catch (e) { console.log('Error:', e.message); }

    } catch (e) {
        console.error('Fatal Error:', e.message);
    }
}

run();
