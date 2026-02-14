/**
 * Test MULTIPLE encryption approaches against LoginAD
 */
const axios = require('axios');
const CryptoJS = require('crypto-js');

const BASE_URL = 'https://reg4.kmutnb.ac.th/regapiweb2/api/th';
const ENCRYPT_SECRET_KEY = 'mySecretKeyHere';
const AES_KEY = 'sQeWwhHUKB3VTrwXijHsufC1S2l19upM';

// Approach 1: encryptData (PBKDF2 + AES-CBC with salt+iv+ciphertext)
function encryptData(plaintext) {
    const salt = CryptoJS.lib.WordArray.random(16);
    const derivedKey = CryptoJS.PBKDF2(ENCRYPT_SECRET_KEY, salt, {
        keySize: 8,
        iterations: 100
    });
    const iv = CryptoJS.lib.WordArray.random(16);
    const encrypted = CryptoJS.AES.encrypt(plaintext, derivedKey, {
        iv: iv,
        padding: CryptoJS.pad.Pkcs7,
        mode: CryptoJS.mode.CBC
    });
    return CryptoJS.enc.Base64.stringify(
        salt.concat(iv).concat(encrypted.ciphertext)
    );
}

// Approach 2: encryptAES (simpler CryptoJS passphrase mode)
function encryptAES(plaintext) {
    return CryptoJS.AES.encrypt(plaintext, AES_KEY).toString();
}

async function test(username, password) {
    console.log('Getting token...');
    const tokenRes = await axios.get(`${BASE_URL}/Validate/tokenservice`, { validateStatus: () => true });
    const token = tokenRes.data?.token;
    if (!token) { console.log('No token!', tokenRes.data); return; }
    console.log('Token:', token.substring(0, 30) + '...\n');

    const credentials = JSON.stringify({ username, password });

    // Test different credential formats
    const formats = [
        { name: 'encryptData({username,password})', data: encryptData(credentials) },
        { name: 'encryptAES({username,password})', data: encryptAES(credentials) },
        { name: 'encryptData(username:password)', data: encryptData(`${username}:${password}`) },
        { name: 'encryptAES(username:password)', data: encryptAES(`${username}:${password}`) },
        { name: 'encryptData({user,pass})', data: encryptData(JSON.stringify({ user: username, pass: password })) },
        { name: 'encryptData({usercode,pass})', data: encryptData(JSON.stringify({ usercode: username, password: password })) },
    ];

    for (const fmt of formats) {
        const body = '{"param" : "' + fmt.data + '"}';
        try {
            const res = await axios.post(`${BASE_URL}/Account/LoginAD`, body, {
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                validateStatus: () => true
            });
            const status = res.status === 200 ? '✅ 200' : `❌ ${res.status}`;
            const data = JSON.stringify(res.data).substring(0, 100);
            console.log(`[${status}] ${fmt.name}`);
            console.log(`         ${data}\n`);
        } catch (e) {
            console.log(`[ERR] ${fmt.name}: ${e.message}\n`);
        }
    }
}

const user = process.argv[2] || 's6701091611290';
const pass = process.argv[3] || '035037603za';
test(user, pass);
