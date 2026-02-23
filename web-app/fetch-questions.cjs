const axios = require('axios');
const crypto = require('crypto');
require('dotenv').config({ path: '.env.local' });
const https = require('https');

function encryptForReg(plaintext) {
    const ENCRYPT_SECRET_KEY = process.env.ENCRYPT_SECRET_KEY;
    const salt = crypto.randomBytes(16);
    const derivedKey = crypto.pbkdf2Sync(ENCRYPT_SECRET_KEY, salt, 100, 32, 'sha1');
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-cbc', derivedKey, iv);
    cipher.setAutoPadding(true);
    const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    return Buffer.concat([salt, iv, encrypted]).toString('base64');
}

async function run() {
    const agent = new https.Agent({ rejectUnauthorized: false });
    const BASE_URL = 'https://reg4.kmutnb.ac.th/regapiweb2/api/th';

    console.log('1. Get token...');
    let res = await axios.get(`${BASE_URL}/Validate/tokenservice`, { httpsAgent: agent });
    const token = res.data.token;

    console.log('2. Login...');
    const creds = JSON.stringify({ username: process.env.REG_USERNAME, password: process.env.REG_PASSWORD, ip: "" });
    const reqBody = { param: encryptForReg(creds) };
    res = await axios.post(`${BASE_URL}/Account/LoginAD`, reqBody, {
        headers: { Authorization: `Bearer ${token}` },
        httpsAgent: agent
    });
    const authHeaders = { Authorization: `Bearer ${res.data.token}`, "User-Agent": "Mozilla" };

    console.log('3. List courses to find an evaluation to do');
    const REG3_BASE_URL = 'https://reg3.kmutnb.ac.th/regapiweb1/api/th';
    const REG2_BASE_URL = 'https://reg2.kmutnb.ac.th/regapiweb3/api/th';
    const listUrl = `${REG2_BASE_URL}/Evaluateofficerform`; // Not sure if this works without param, try reg3
    const evalList = await axios.get(`${REG2_BASE_URL}/Evaluateofficerform/Evaluatelist`, { headers: authHeaders, httpsAgent: agent, validateStatus: () => true });
    
    console.log('Eval List:', evalList.data);

    // Pick first incomplete evaluation
    // We need classId, evaluateId, officerId
}
run().catch(console.error);
