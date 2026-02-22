const crypto = require('crypto');
const axios = require('axios');
const https = require('https');
require('dotenv').config({ path: '.env.local' });

const agent = new https.Agent({ rejectUnauthorized: false });
const SECRET_KEY = "mySecretKeyHere";

// C# Rfc2898DeriveBytes style: SHA1, key(32) + iv(16) derived together
// The Angular code sends: base64(salt + iv + ciphertext)
// But in C# style, IV is derived, so maybe format is: base64(salt + ciphertext)?
// Let's try both

function encryptV1(plaintext) {
    // salt(16) + ciphertext (iv derived from PBKDF2)
    const salt = crypto.randomBytes(16);
    const derived = crypto.pbkdf2Sync(SECRET_KEY, salt, 100, 48, 'sha1');
    const key = derived.subarray(0, 32);
    const iv = derived.subarray(32, 48);
    const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
    let enc = cipher.update(plaintext, 'utf8');
    enc = Buffer.concat([enc, cipher.final()]);
    return Buffer.concat([salt, enc]).toString('base64');
}

function encryptV2(plaintext) {
    // salt(16) + iv(16 random) + ciphertext, but key derived with SHA1
    const salt = crypto.randomBytes(16);
    const key = crypto.pbkdf2Sync(SECRET_KEY, salt, 100, 32, 'sha1');
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
    let enc = cipher.update(plaintext, 'utf8');
    enc = Buffer.concat([enc, cipher.final()]);
    return Buffer.concat([salt, iv, enc]).toString('base64');
}

function encryptV3(plaintext) {
    // salt(16) + ciphertext, iv derived with SHA1, keySize = 48 bytes total
    // But what if server expects salt(8 bytes) not 16?
    const salt = crypto.randomBytes(8);
    const derived = crypto.pbkdf2Sync(SECRET_KEY, salt, 100, 48, 'sha1');
    const key = derived.subarray(0, 32);
    const iv = derived.subarray(32, 48);
    const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
    let enc = cipher.update(plaintext, 'utf8');
    enc = Buffer.concat([enc, cipher.final()]);
    return Buffer.concat([salt, enc]).toString('base64');
}

async function test() {
    const loginRes = await axios.post('http://localhost:3000/api/auth/login', {
        username: process.env.REG_USERNAME, password: process.env.REG_PASSWORD
    });
    const token = loginRes.headers['set-cookie'].find(c => c.startsWith('reg_token=')).split(';')[0].split('=')[1];
    const headers = { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' };

    const testUrl = 'https://reg2.kmutnb.ac.th/regapiweb2/api/th/Account/LoginAD';
    // Fix payload to match what Angular actually sends for login
    const payloads = [
        JSON.stringify({ user_id: 's6701091611290', password: '035037603za' }),
        JSON.stringify({ userid: 's6701091611290', password: '035037603za' }),
        JSON.stringify({ username: 's6701091611290', password: '035037603za' }),
    ];

    const methods = [
        { name: 'V1: SHA1 key+iv derived, salt(16)+ct', fn: encryptV1 },
        { name: 'V2: SHA1 key only, salt(16)+iv(16)+ct', fn: encryptV2 },
        { name: 'V3: SHA1 key+iv derived, salt(8)+ct', fn: encryptV3 },
    ];

    for (const payload of payloads) {
        console.log(`\n=== Payload: ${payload.substring(0, 60)} ===`);
        for (const method of methods) {
            console.log(`\n${method.name}:`);
            try {
                const encrypted = method.fn(payload);
                const body = JSON.stringify({ param: encrypted });
                const res = await axios.post(testUrl, body, { headers, httpsAgent: agent, validateStatus: () => true, timeout: 5000 });
                const msg = JSON.stringify(res.data).substring(0, 200);
                console.log(`  ${res.status} | ${msg}`);
            } catch (e) { console.log(`  Error: ${e.message}`); }
        }
    }
}

test().catch(console.error);
