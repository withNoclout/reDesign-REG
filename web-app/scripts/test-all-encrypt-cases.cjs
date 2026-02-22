const crypto = require('crypto');
const CryptoJS = require('crypto-js');
const axios = require('axios');
const https = require('https');
require('dotenv').config({ path: '.env.local' });

const agent = new https.Agent({ rejectUnauthorized: false });
const SECRET_KEY = "mySecretKeyHere";

// Case 1: Node crypto with SHA256 (CryptoJS default)
function encryptSHA256(plaintext) {
    const salt = crypto.randomBytes(16);
    const key = crypto.pbkdf2Sync(SECRET_KEY, salt, 100, 32, 'sha256');
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
    let enc = cipher.update(plaintext, 'utf8');
    enc = Buffer.concat([enc, cipher.final()]);
    return Buffer.concat([salt, iv, enc]).toString('base64');
}

// Case 2: Node crypto with SHA1
function encryptSHA1(plaintext) {
    const salt = crypto.randomBytes(16);
    const key = crypto.pbkdf2Sync(SECRET_KEY, salt, 100, 32, 'sha1');
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
    let enc = cipher.update(plaintext, 'utf8');
    enc = Buffer.concat([enc, cipher.final()]);
    return Buffer.concat([salt, iv, enc]).toString('base64');
}

// Case 3: CryptoJS with explicit SHA256 hasher
function encryptCryptoJSSHA256(plaintext) {
    const salt = CryptoJS.lib.WordArray.random(16);
    const key = CryptoJS.PBKDF2(SECRET_KEY, salt, { keySize: 8, iterations: 100, hasher: CryptoJS.algo.SHA256 });
    const iv = CryptoJS.lib.WordArray.random(16);
    const encrypted = CryptoJS.AES.encrypt(plaintext, key, { iv, padding: CryptoJS.pad.Pkcs7, mode: CryptoJS.mode.CBC });
    return CryptoJS.enc.Base64.stringify(salt.concat(iv).concat(encrypted.ciphertext));
}

// Case 4: CryptoJS with SHA1 hasher
function encryptCryptoJSSHA1(plaintext) {
    const salt = CryptoJS.lib.WordArray.random(16);
    const key = CryptoJS.PBKDF2(SECRET_KEY, salt, { keySize: 8, iterations: 100, hasher: CryptoJS.algo.SHA1 });
    const iv = CryptoJS.lib.WordArray.random(16);
    const encrypted = CryptoJS.AES.encrypt(plaintext, key, { iv, padding: CryptoJS.pad.Pkcs7, mode: CryptoJS.mode.CBC });
    return CryptoJS.enc.Base64.stringify(salt.concat(iv).concat(encrypted.ciphertext));
}

// Case 5: Use the simpler encryptAES method (passphrase-based, AESkey)
function encryptAESSimple(plaintext) {
    const AESkey = "sQeWwhHUKB3VTrwXijHsufC1S2l19upM";
    return CryptoJS.AES.encrypt(plaintext, AESkey).toString();
}

async function testAllCases() {
    // Login first
    const loginRes = await axios.post('http://localhost:3000/api/auth/login', {
        username: process.env.REG_USERNAME, password: process.env.REG_PASSWORD
    });
    const token = loginRes.headers['set-cookie'].find(c => c.startsWith('reg_token=')).split(';')[0].split('=')[1];
    const headers = { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' };

    // Simple test payload: commit with empty body (like the Angular commit which sends {})
    const simplePayload = JSON.stringify({});

    const methods = [
        { name: 'Case 1: Node SHA256', fn: encryptSHA256 },
        { name: 'Case 2: Node SHA1', fn: encryptSHA1 },
        { name: 'Case 3: CryptoJS SHA256', fn: encryptCryptoJSSHA256 },
        { name: 'Case 4: CryptoJS SHA1', fn: encryptCryptoJSSHA1 },
        { name: 'Case 5: Simple AES (AESkey)', fn: encryptAESSimple },
    ];

    // Use a test endpoint that doesn't mutate data - use Evaluategroup GET equivalent
    // Actually, let's test with a known safe POST: login endpoint
    const testUrl = 'https://reg2.kmutnb.ac.th/regapiweb2/api/th/Account/LoginAD';
    const loginPayload = JSON.stringify({ user_id: process.env.REG_USERNAME, password: process.env.REG_PASSWORD });

    for (const method of methods) {
        console.log(`\n${method.name}:`);
        try {
            const encrypted = method.fn(loginPayload);
            const body = JSON.stringify({ param: encrypted });
            const res = await axios.post(testUrl, body, { headers, httpsAgent: agent, validateStatus: () => true, timeout: 5000 });
            const status = res.status;
            const msg = typeof res.data === 'string' ? res.data.substring(0, 80) : JSON.stringify(res.data).substring(0, 150);
            console.log(`  Status: ${status} | ${msg}`);
            if (status === 200 && !JSON.stringify(res.data).includes('Padding')) {
                console.log('  ✅✅✅ THIS METHOD WORKS! ✅✅✅');
            }
        } catch (e) {
            console.log(`  Error: ${e.message}`);
        }
    }
}

testAllCases().catch(console.error);
