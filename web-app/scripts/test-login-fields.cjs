const crypto = require('crypto');
const axios = require('axios');
const https = require('https');
require('dotenv').config({ path: '.env.local' });

const agent = new https.Agent({ rejectUnauthorized: false });
const SECRET_KEY = "mySecretKeyHere";

// WINNER: V2 = SHA1, salt(16) + iv(16) + ciphertext
function encryptForReg(plaintext) {
    const salt = crypto.randomBytes(16);
    const key = crypto.pbkdf2Sync(SECRET_KEY, salt, 100, 32, 'sha1');
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
    let enc = cipher.update(plaintext, 'utf8');
    enc = Buffer.concat([enc, cipher.final()]);
    return Buffer.concat([salt, iv, enc]).toString('base64');
}

async function testLogin() {
    const loginRes = await axios.post('http://localhost:3000/api/auth/login', {
        username: process.env.REG_USERNAME, password: process.env.REG_PASSWORD
    });
    const token = loginRes.headers['set-cookie'].find(c => c.startsWith('reg_token=')).split(';')[0].split('=')[1];
    const headers = { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' };

    const testUrl = 'https://reg2.kmutnb.ac.th/regapiweb2/api/th/Account/LoginAD';

    // Try different field names
    const payloads = [
        { username: 's6701091611290', password: '035037603za' },
        { UserName: 's6701091611290', Password: '035037603za' },
        { userName: 's6701091611290', passWord: '035037603za' },
    ];

    for (const payload of payloads) {
        const jsonStr = JSON.stringify(payload);
        const encrypted = encryptForReg(jsonStr);
        const body = JSON.stringify({ param: encrypted });

        console.log(`\nPayload: ${jsonStr}`);
        try {
            const res = await axios.post(testUrl, body, { headers, httpsAgent: agent, validateStatus: () => true, timeout: 5000 });
            console.log(`  ${res.status}`);
            const d = res.data;
            if (d.userid && d.userid > 0) {
                console.log('  ✅ LOGIN SUCCESS!');
                console.log('  User:', JSON.stringify(d).substring(0, 300));
            } else {
                console.log('  Data:', JSON.stringify(d).substring(0, 200));
            }
        } catch (e) { console.log(`  Error: ${e.message}`); }
    }
}

testLogin().catch(console.error);
