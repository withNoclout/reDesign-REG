const axios = require('axios');
const https = require('https');
const fs = require('fs');
const path = require('path');

const agent = new https.Agent({ rejectUnauthorized: false });

async function test() {
    const BASE_URL = 'http://localhost:3000';
    
    console.log('=== Testing Schedule Page ===\n');
    
    // Test 1: API returns data (no auth → mock data)
    try {
        const apiRes = await axios.get(`${BASE_URL}/api/student/schedule`);
        console.log('✅ API responds:', apiRes.status);
        console.log('   Success:', apiRes.data.success);
        console.log('   Data items:', apiRes.data.data?.length || 0);
        console.log('   Semester:', apiRes.data.semester);
    } catch (e) {
        console.log('❌ API error:', e.message);
    }
    
    // Test 2: External API (with credentials)
    console.log('\n=== Testing External REG API ===');
    const REG_BASE = 'https://reg4.kmutnb.ac.th/regapiweb2/api/th';
    
    const envPath = path.resolve(__dirname, '../.env.local');
    let USERNAME, PASSWORD, ENCRYPT_KEY;
    if (fs.existsSync(envPath)) {
        const envConfig = fs.readFileSync(envPath, 'utf8');
        envConfig.split('\n').forEach(line => {
            const [key, value] = line.split('=');
            if (key?.trim() === 'REG_USERNAME') USERNAME = value?.trim();
            if (key?.trim() === 'REG_PASSWORD') PASSWORD = value?.trim();
            if (key?.trim() === 'ENCRYPT_SECRET_KEY') ENCRYPT_KEY = value?.trim();
        });
    }
    
    if (!USERNAME || !PASSWORD) {
        console.log('⚠️  No credentials — skipping');
        return;
    }
    
    try {
        const tokenRes = await axios.get(`${REG_BASE}/Validate/tokenservice`, { httpsAgent: agent });
        const serviceToken = tokenRes.data.token;
        console.log('✅ Got service token');
        
        const crypto = require('crypto');
        function encryptData(plaintext) {
            const salt = crypto.randomBytes(16);
            const derivedKey = crypto.pbkdf2Sync(ENCRYPT_KEY, salt, 100, 32, 'sha1');
            const iv = crypto.randomBytes(16);
            const cipher = crypto.createCipheriv('aes-256-cbc', derivedKey, iv);
            cipher.setAutoPadding(true);
            const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
            return Buffer.concat([salt, iv, encrypted]).toString('base64');
        }
        
        const credentials = JSON.stringify({ username: USERNAME, password: PASSWORD, ip: '127.0.0.1' });
        const encryptedParam = encryptData(credentials);
        
        const loginRes = await axios.post(`${REG_BASE}/Account/LoginAD`,
            { param: encryptedParam },
            { headers: { 'Authorization': `Bearer ${serviceToken}`, 'Content-Type': 'application/json' }, httpsAgent: agent }
        );
        const userToken = loginRes.data.token;
        console.log('✅ Logged in');
        
        const scheduleRes = await axios.get(`${REG_BASE}/Enroll/Week`, {
            headers: { 'Authorization': `Bearer ${userToken}` },
            httpsAgent: agent,
            validateStatus: () => true
        });
        
        console.log('\n📅 Enroll/Week:');
        console.log('   Status:', scheduleRes.status);
        if (scheduleRes.status === 200) {
            console.log('   Type:', Array.isArray(scheduleRes.data) ? 'Array' : typeof scheduleRes.data);
            console.log('   Items:', scheduleRes.data?.length || 0);
            if (Array.isArray(scheduleRes.data) && scheduleRes.data.length > 0) {
                console.log('   Sample:', JSON.stringify(scheduleRes.data[0], null, 2));
            } else {
                console.log('   Data:', JSON.stringify(scheduleRes.data, null, 2).substring(0, 200));
            }
        } else {
            console.log('   Error:', scheduleRes.data);
        }
        
    } catch (e) {
        console.log('❌ External API error:', e.message);
        if (e.response) console.log('   Status:', e.response.status, e.response.data);
    }
}

test();
