// Use Node.js native crypto to replicate Angular's encryption exactly
const crypto = require('crypto');
const CryptoJS = require('crypto-js');
const axios = require('axios');
const https = require('https');
const zlib = require('zlib');
require('dotenv').config({ path: '.env.local' });

const agent = new https.Agent({ rejectUnauthorized: false });
const SECRET_KEY = "mySecretKeyHere";

// Method 1: Use CryptoJS identically to Angular (browser CryptoJS)
function encryptWithCryptoJS(plaintext) {
    const salt = CryptoJS.lib.WordArray.random(16);
    const key = CryptoJS.PBKDF2(SECRET_KEY, salt, { keySize: 8, iterations: 100 });
    const iv = CryptoJS.lib.WordArray.random(16);
    const encrypted = CryptoJS.AES.encrypt(plaintext, key, { iv, padding: CryptoJS.pad.Pkcs7, mode: CryptoJS.mode.CBC });
    return CryptoJS.enc.Base64.stringify(salt.concat(iv).concat(encrypted.ciphertext));
}

// Method 2: Use Node.js native crypto
function encryptWithNodeCrypto(plaintext) {
    const salt = crypto.randomBytes(16);
    // PBKDF2: keySize:8 in CryptoJS = 8 words = 32 bytes = 256 bits
    const key = crypto.pbkdf2Sync(SECRET_KEY, salt, 100, 32, 'sha1'); // CryptoJS PBKDF2 uses SHA1 by default
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
    let encrypted = cipher.update(plaintext, 'utf8');
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    // Combine: salt(16) + iv(16) + ciphertext
    const combined = Buffer.concat([salt, iv, encrypted]);
    return combined.toString('base64');
}

async function testBothEncryptions() {
    // Login
    const loginRes = await axios.post('http://localhost:3000/api/auth/login', {
        username: process.env.REG_USERNAME,
        password: process.env.REG_PASSWORD
    });
    const token = loginRes.headers['set-cookie'].find(c => c.startsWith('reg_token=')).split(';')[0].split('=')[1];
    const headers = { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' };

    // Get a new unevaluated course first
    const listUrl = 'https://reg3.kmutnb.ac.th/regapiweb1/api/th/Evaluateofficer/Class';
    const listRes = await axios.get(listUrl, { headers, httpsAgent: agent });
    const courses = JSON.parse(zlib.gunzipSync(Buffer.from(listRes.data.result, 'base64')).toString());

    let target = null;
    for (const course of courses) {
        if (course.instructor) {
            for (const inst of course.instructor) {
                if (inst.evaluatestatus === 0) {
                    target = { classid: course.classid, evaluateid: inst.evaluateid, officerid: inst.officerid, coursename: course.coursename };
                    break;
                }
            }
        }
        if (target) break;
    }

    if (!target) {
        console.log('No unevaluated courses found! All are already evaluated.');
        return;
    }

    console.log(`Target: ${target.coursename} (classid=${target.classid}, evaluateid=${target.evaluateid}, officerid=${target.officerid})`);

    // Get questions
    const qUrl = `https://reg3.kmutnb.ac.th/regapiweb1/api/th/Evaluateofficerform/Evaluatequestion/${target.classid}/${target.evaluateid}/${target.officerid}`;
    const qRes = await axios.get(qUrl, { headers, httpsAgent: agent });
    const questions = JSON.parse(zlib.gunzipSync(Buffer.from(qRes.data.result, 'base64')).toString());

    const formValue = {};
    questions.forEach(q => {
        if (q.questiontype === 'H') return;
        if (q.questiontype === 'Q') formValue[q.questiontype + '' + q.questionid] = '5';
        else if (q.questiontype === 'C') formValue[q.questiontype + '' + q.questionid] = q.description || '';
    });
    formValue['Ctxt'] = 'สอนดีมากครับ';
    formValue['complaints'] = '';

    const jsonStr = JSON.stringify(formValue);
    console.log('Payload:', jsonStr.substring(0, 100) + '...');

    // Test both encryption methods
    const methods = [
        { name: 'CryptoJS', encrypt: encryptWithCryptoJS },
        { name: 'Node Crypto (SHA1)', encrypt: encryptWithNodeCrypto },
    ];

    for (const method of methods) {
        console.log(`\n--- Testing ${method.name} ---`);
        const encrypted = method.encrypt(jsonStr);
        const body = JSON.stringify({ param: encrypted });

        const url = `https://reg2.kmutnb.ac.th/regapiweb2/api/th/Evaluateofficerform/Addanswer/${target.evaluateid}/${target.classid}/${target.officerid}/1`;
        console.log(`POST ${url}`);
        try {
            const res = await axios.post(url, body, { headers, httpsAgent: agent, validateStatus: () => true, timeout: 5000 });
            console.log(`Status: ${res.status}`);
            console.log('Response:', typeof res.data === 'string' ? res.data.substring(0, 100) : JSON.stringify(res.data));
        } catch (e) {
            console.log('Error:', e.message);
        }
    }
}

testBothEncryptions().catch(console.error);
