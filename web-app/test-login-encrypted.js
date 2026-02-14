/**
 * Test with native Node.js crypto (exact .NET compatibility)
 * Also testing CryptoJS side-by-side for comparison
 */
const crypto = require('crypto');
const axios = require('axios');
const CryptoJS = require('crypto-js');

const BASE_URL = 'https://reg4.kmutnb.ac.th/regapiweb2/api/th';
const SECRET_KEY = 'mySecretKeyHere';

// Native Node.js implementation
function encryptDataNative(plaintext) {
    const salt = crypto.randomBytes(16);
    // PBKDF2: keySize 8 in CryptoJS = 8 * 4 = 32 bytes = 256 bits
    const derivedKey = crypto.pbkdf2Sync(SECRET_KEY, salt, 100, 32, 'sha1');
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-cbc', derivedKey, iv);
    cipher.setAutoPadding(true); // PKCS7
    const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    // Base64(salt + iv + ciphertext)
    return Buffer.concat([salt, iv, encrypted]).toString('base64');
}

// CryptoJS implementation (same as Angular)
function encryptDataCryptoJS(plaintext) {
    const salt = CryptoJS.lib.WordArray.random(16);
    const derivedKey = CryptoJS.PBKDF2(SECRET_KEY, salt, { keySize: 8, iterations: 100 });
    const iv = CryptoJS.lib.WordArray.random(16);
    const encrypted = CryptoJS.AES.encrypt(plaintext, derivedKey, {
        iv, padding: CryptoJS.pad.Pkcs7, mode: CryptoJS.mode.CBC
    });
    return CryptoJS.enc.Base64.stringify(salt.concat(iv).concat(encrypted.ciphertext));
}

// Verify CryptoJS PBKDF2 uses SHA1 (default)
// CryptoJS default hasher for PBKDF2 is SHA1, should match .NET
const testSalt = CryptoJS.enc.Hex.parse('000102030405060708090a0b0c0d0e0f');
const testKey = CryptoJS.PBKDF2(SECRET_KEY, testSalt, { keySize: 8, iterations: 100 });
const nativeKey = crypto.pbkdf2Sync(SECRET_KEY, Buffer.from('000102030405060708090a0b0c0d0e0f', 'hex'), 100, 32, 'sha1');
console.log('CryptoJS PBKDF2:', testKey.toString(CryptoJS.enc.Hex));
console.log('Native PBKDF2:  ', nativeKey.toString('hex'));
console.log('Keys match:', testKey.toString(CryptoJS.enc.Hex) === nativeKey.toString('hex'));

async function test(username, password) {
    console.log('\n=== TESTING BOTH IMPLEMENTATIONS ===\n');

    // Get IP
    const ipRes = await axios.get('https://api.ipify.org/?format=json');
    const ip = ipRes.data.ip;

    // Get token
    const tokenRes = await axios.get(`${BASE_URL}/Validate/tokenservice`, { validateStatus: () => true });
    const token = tokenRes.data?.token;
    if (!token) { console.log('No token!', tokenRes.data); return; }
    console.log('Token:', token.substring(0, 30) + '...');

    const userObj = { username, password, ip };
    const plaintext = JSON.stringify(userObj);
    console.log('Plaintext:', plaintext);

    // Test with native crypto  
    console.log('\n--- Native crypto test ---');
    const nativeEncrypted = encryptDataNative(plaintext);
    const nativeBody = '{"param" : "' + nativeEncrypted + '"}';
    const nativeRes = await axios.post(`${BASE_URL}/Account/LoginAD`, nativeBody, {
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        validateStatus: () => true
    });
    console.log('Status:', nativeRes.status, '|', JSON.stringify(nativeRes.data).substring(0, 200));

    // Test with CryptoJS
    console.log('\n--- CryptoJS test ---');
    const cryptojsEncrypted = encryptDataCryptoJS(plaintext);
    const cryptojsBody = '{"param" : "' + cryptojsEncrypted + '"}';
    const cryptojsRes = await axios.post(`${BASE_URL}/Account/LoginAD`, cryptojsBody, {
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        validateStatus: () => true
    });
    console.log('Status:', cryptojsRes.status, '|', JSON.stringify(cryptojsRes.data).substring(0, 200));

    // Also try with SHA256 for native (in case server uses SHA256)
    console.log('\n--- Native crypto SHA256 test ---');
    const salt256 = crypto.randomBytes(16);
    const key256 = crypto.pbkdf2Sync(SECRET_KEY, salt256, 100, 32, 'sha256');
    const iv256 = crypto.randomBytes(16);
    const cipher256 = crypto.createCipheriv('aes-256-cbc', key256, iv256);
    const enc256 = Buffer.concat([cipher256.update(plaintext, 'utf8'), cipher256.final()]);
    const encrypted256 = Buffer.concat([salt256, iv256, enc256]).toString('base64');
    const body256 = '{"param" : "' + encrypted256 + '"}';
    const res256 = await axios.post(`${BASE_URL}/Account/LoginAD`, body256, {
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        validateStatus: () => true
    });
    console.log('Status:', res256.status, '|', JSON.stringify(res256.data).substring(0, 200));

    // Also try with SHA512
    console.log('\n--- Native crypto SHA512 test ---');
    const salt512 = crypto.randomBytes(16);
    const key512 = crypto.pbkdf2Sync(SECRET_KEY, salt512, 100, 32, 'sha512');
    const iv512 = crypto.randomBytes(16);
    const cipher512 = crypto.createCipheriv('aes-256-cbc', key512, iv512);
    const enc512 = Buffer.concat([cipher512.update(plaintext, 'utf8'), cipher512.final()]);
    const encrypted512 = Buffer.concat([salt512, iv512, enc512]).toString('base64');
    const body512 = '{"param" : "' + encrypted512 + '"}';
    const res512 = await axios.post(`${BASE_URL}/Account/LoginAD`, body512, {
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        validateStatus: () => true
    });
    console.log('Status:', res512.status, '|', JSON.stringify(res512.data).substring(0, 200));
}

const user = process.argv[2] || 's6701091611290';
const pass = process.argv[3] || '035037603za';
test(user, pass);
