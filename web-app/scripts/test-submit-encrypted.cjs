const axios = require('axios');
const https = require('https');
const zlib = require('zlib');
const CryptoJS = require('crypto-js');
require('dotenv').config({ path: '.env.local' });

const agent = new https.Agent({ rejectUnauthorized: false });

// Replicate Angular's encrypt.encryptData() exactly
function encryptData(plaintext) {
    const encryptSecretKey = "mySecretKeyHere";
    // 1. Generate random 16-byte salt
    const salt = CryptoJS.lib.WordArray.random(16);
    // 2. Derive key using PBKDF2
    const key = CryptoJS.PBKDF2(encryptSecretKey, salt, { keySize: 8, iterations: 100 });
    // 3. Generate random 16-byte IV
    const iv = CryptoJS.lib.WordArray.random(16);
    // 4. AES-CBC encrypt
    const encrypted = CryptoJS.AES.encrypt(plaintext, key, { iv: iv, padding: CryptoJS.pad.Pkcs7, mode: CryptoJS.mode.CBC });
    // 5. Return Base64(salt + iv + ciphertext)
    return CryptoJS.enc.Base64.stringify(salt.concat(iv).concat(encrypted.ciphertext));
}

async function testEncryptedPost() {
    try {
        const loginRes = await axios.post('http://localhost:3000/api/auth/login', {
            username: process.env.REG_USERNAME,
            password: process.env.REG_PASSWORD
        });
        const token = loginRes.headers['set-cookie'].find(c => c.startsWith('reg_token=')).split(';')[0].split('=')[1];
        const headers = { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' };

        const classid = '305594';
        const evaluateid = '125';
        const officerid = '2795';

        // Get questions
        const qUrl = `https://reg3.kmutnb.ac.th/regapiweb1/api/th/Evaluateofficerform/Evaluatequestion/${classid}/${evaluateid}/${officerid}`;
        const qRes = await axios.get(qUrl, { headers, httpsAgent: agent });
        const questions = JSON.parse(zlib.gunzipSync(Buffer.from(qRes.data.result, 'base64')).toString());

        // Build payload like Angular frm.value
        const formValue = {};
        questions.forEach(q => {
            if (q.questiontype === 'H') return;
            if (q.questiontype === 'Q') {
                formValue[q.questiontype + '' + q.questionid] = '5';
            } else if (q.questiontype === 'C') {
                formValue[q.questiontype + '' + q.questionid] = q.description || '';
            }
        });
        formValue['Ctxt'] = 'สอนดีมากครับ';
        formValue['complaints'] = '';

        console.log('Form Value:', JSON.stringify(formValue));

        // Encrypt like Angular does
        const jsonStr = JSON.stringify(formValue);
        const encrypted = encryptData(jsonStr);
        const body = `{"param" : "${encrypted}"}`;

        console.log('\nEncrypted body (first 100 chars):', body.substring(0, 100) + '...');

        // Test on all servers
        const servers = [
            'https://reg2.kmutnb.ac.th/regapiweb1/api/th',
            'https://reg2.kmutnb.ac.th/regapiweb2/api/th',
            'https://reg3.kmutnb.ac.th/regapiweb1/api/th',
            'https://reg4.kmutnb.ac.th/regapiweb2/api/th',
        ];

        for (const server of servers) {
            const addUrl = `${server}/Evaluateofficerform/Addanswer/${evaluateid}/${classid}/${officerid}/1`;
            console.log(`\nPOST ${addUrl}`);
            try {
                const addRes = await axios.post(addUrl, body, {
                    headers,
                    httpsAgent: agent,
                    validateStatus: () => true,
                    timeout: 5000
                });
                console.log(`  Status: ${addRes.status}`);
                if (addRes.status === 200) {
                    console.log('  ✅ SUCCESS:', JSON.stringify(addRes.data));
                } else {
                    console.log('  Response:', typeof addRes.data === 'string' ? addRes.data.substring(0, 100) : JSON.stringify(addRes.data));
                }
            } catch (e) {
                console.log('  Error:', e.message);
            }
        }

    } catch (e) {
        console.error(e.message);
    }
}

testEncryptedPost();
