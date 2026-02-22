const crypto = require('crypto');
const axios = require('axios');
const https = require('https');
require('dotenv').config({ path: '.env.local' });

const agent = new https.Agent({ rejectUnauthorized: false });
const SECRET_KEY = "mySecretKeyHere";

function encrypt(plaintext, keyLen, hasher) {
    const salt = crypto.randomBytes(16);
    const key = crypto.pbkdf2Sync(SECRET_KEY, salt, 100, keyLen, hasher);
    const iv = crypto.randomBytes(16);
    const algo = keyLen === 16 ? 'aes-128-cbc' : keyLen === 24 ? 'aes-192-cbc' : 'aes-256-cbc';
    const cipher = crypto.createCipheriv(algo, key, iv);
    let enc = cipher.update(plaintext, 'utf8');
    enc = Buffer.concat([enc, cipher.final()]);
    return Buffer.concat([salt, iv, enc]).toString('base64');
}

// Also try: CryptoJS PBKDF2 default keySize:8 might be 8*4=32 bytes BUT
// what if the C# server uses Rfc2898DeriveBytes which by default uses SHA1?
// And the keySize in bytes for AES-256 is 32.
// Let me also try: what if the server key is NOT "mySecretKeyHere" but something else?

// Let's also try the AESkey directly as a raw key (not PBKDF2)
function encryptWithRawKey(plaintext) {
    const AESkey = "sQeWwhHUKB3VTrwXijHsufC1S2l19upM"; // 32 chars = 256 bits
    const key = Buffer.from(AESkey, 'utf8');
    const iv = crypto.randomBytes(16);
    // No salt prefix, just iv + ciphertext
    const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
    let enc = cipher.update(plaintext, 'utf8');
    enc = Buffer.concat([enc, cipher.final()]);
    // Try: salt(16 zeros) + iv + ciphertext
    const salt = Buffer.alloc(16, 0);
    return Buffer.concat([salt, iv, enc]).toString('base64');
}

// What if server uses Rfc2898DeriveBytes (C# default SHA1, 256-bit key, 128-bit IV from derivation)?
// In C# .NET: new Rfc2898DeriveBytes(password, salt, iterations)
// Then: key = db.GetBytes(32), iv = db.GetBytes(16) — key AND iv derived together!
function encryptCSharpStyle(plaintext) {
    const salt = crypto.randomBytes(16);
    // In C# Rfc2898DeriveBytes, GetBytes returns next N bytes from the stream
    // So key(32) + iv(16) = 48 bytes total from PBKDF2
    const derived = crypto.pbkdf2Sync(SECRET_KEY, salt, 100, 48, 'sha1');
    const key = derived.subarray(0, 32);
    const iv = derived.subarray(32, 48);
    const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
    let enc = cipher.update(plaintext, 'utf8');
    enc = Buffer.concat([enc, cipher.final()]);
    // Output: salt(16) + ciphertext (NO separate IV because it's derived)
    return Buffer.concat([salt, enc]).toString('base64');
}

// C# style but SHA256
function encryptCSharpStyleSHA256(plaintext) {
    const salt = crypto.randomBytes(16);
    const derived = crypto.pbkdf2Sync(SECRET_KEY, salt, 100, 48, 'sha256');
    const key = derived.subarray(0, 32);
    const iv = derived.subarray(32, 48);
    const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
    let enc = cipher.update(plaintext, 'utf8');
    enc = Buffer.concat([enc, cipher.final()]);
    return Buffer.concat([salt, enc]).toString('base64');
}

async function testKeySizes() {
    const loginRes = await axios.post('http://localhost:3000/api/auth/login', {
        username: process.env.REG_USERNAME, password: process.env.REG_PASSWORD
    });
    const token = loginRes.headers['set-cookie'].find(c => c.startsWith('reg_token=')).split(';')[0].split('=')[1];
    const headers = { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' };

    const testUrl = 'https://reg2.kmutnb.ac.th/regapiweb2/api/th/Account/LoginAD';
    const loginPayload = JSON.stringify({ user_id: 's6701091611290', password: '035037603za' });

    const cases = [
        { name: 'SHA256 32B key', fn: () => encrypt(loginPayload, 32, 'sha256') },
        { name: 'SHA256 16B key (AES-128)', fn: () => encrypt(loginPayload, 16, 'sha256') },
        { name: 'Raw AESkey', fn: () => encryptWithRawKey(loginPayload) },
        { name: 'C# Style SHA1 (key+iv derived)', fn: () => encryptCSharpStyle(loginPayload) },
        { name: 'C# Style SHA256 (key+iv derived)', fn: () => encryptCSharpStyleSHA256(loginPayload) },
    ];

    for (const c of cases) {
        console.log(`\n${c.name}:`);
        try {
            const encrypted = c.fn();
            const body = JSON.stringify({ param: encrypted });
            const res = await axios.post(testUrl, body, { headers, httpsAgent: agent, validateStatus: () => true, timeout: 5000 });
            const msg = typeof res.data === 'string' ? res.data.substring(0, 80) : JSON.stringify(res.data).substring(0, 150);
            console.log(`  ${res.status} | ${msg}`);
            if (res.status === 200 && !JSON.stringify(res.data).includes('Padding') && !JSON.stringify(res.data).includes('null reference')) {
                console.log('  ✅✅✅ WORKS! ✅✅✅');
            }
        } catch (e) { console.log(`  Error: ${e.message}`); }
    }
}

testKeySizes().catch(console.error);
