/**
 * Inspect the full LoginAD response structure
 */
const crypto = require('crypto');
const axios = require('axios');

const BASE_URL = 'https://reg4.kmutnb.ac.th/regapiweb2/api/th';

function encryptData(plaintext) {
    const salt = crypto.randomBytes(16);
    const derivedKey = crypto.pbkdf2Sync('mySecretKeyHere', salt, 100, 32, 'sha1');
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-cbc', derivedKey, iv);
    const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    return Buffer.concat([salt, iv, encrypted]).toString('base64');
}

async function inspect(username, password) {
    // Get IP
    const ipRes = await axios.get('https://api.ipify.org/?format=json');
    const ip = ipRes.data.ip;

    // Get token
    const tokenRes = await axios.get(`${BASE_URL}/Validate/tokenservice`);
    const token = tokenRes.data.token;

    // Login
    const userObj = { username, password, ip };
    const encryptedParam = encryptData(JSON.stringify(userObj));
    const body = '{"param" : "' + encryptedParam + '"}';

    const loginRes = await axios.post(`${BASE_URL}/Account/LoginAD`, body, {
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }
    });

    console.log('=== LoginAD Response ===');
    console.log(JSON.stringify(loginRes.data, null, 2));

    // Now try to get student info using the tokens from login response
    const { token: webToken, tokenuser } = loginRes.data;

    if (webToken) {
        console.log('\n=== Trying Getacadstd with webToken ===');
        try {
            const acadRes = await axios.get(`${BASE_URL}/Schg/Getacadstd`, {
                headers: { 'Authorization': `Bearer ${webToken}` },
                validateStatus: () => true
            });
            console.log('Status:', acadRes.status);
            console.log(JSON.stringify(acadRes.data, null, 2));
        } catch (e) {
            console.log('Error:', e.message);
        }
    }

    if (tokenuser) {
        console.log('\n=== Trying Getacadstd with tokenuser ===');
        try {
            const acadRes2 = await axios.get(`${BASE_URL}/Schg/Getacadstd`, {
                headers: { 'Authorization': `Bearer ${tokenuser}` },
                validateStatus: () => true
            });
            console.log('Status:', acadRes2.status);
            console.log(JSON.stringify(acadRes2.data, null, 2));
        } catch (e) {
            console.log('Error:', e.message);
        }
    }
}

const user = process.argv[2] || 's6701091611290';
const pass = process.argv[3] || '035037603za';
inspect(user, pass);
