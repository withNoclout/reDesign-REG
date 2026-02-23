const axios = require('axios');
const https = require('https');
const crypto = require('crypto');
const zlib = require('zlib');
const { promisify } = require('util');
const gunzip = promisify(zlib.gunzip);

require('dotenv').config({ path: '.env.local' });

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

const agent = new https.Agent({ rejectUnauthorized: false });

async function run() {
    const BASE_URL = 'https://reg4.kmutnb.ac.th/regapiweb2/api/th';
    let res = await axios.get(`${BASE_URL}/Validate/tokenservice`, { httpsAgent: agent });
    const token = res.data.token;

    const creds = JSON.stringify({ username: process.env.REG_USERNAME, password: process.env.REG_PASSWORD, ip: "" });
    const reqBody = { param: encryptForReg(creds) };
    res = await axios.post(`${BASE_URL}/Account/LoginAD`, reqBody, { headers: { Authorization: `Bearer ${token}` }, httpsAgent: agent });
    const bearer = res.data.token;
    const authHeaders = { Authorization: `Bearer ${bearer}`, "User-Agent": "Mozilla", "Content-Type": "application/json" };

    const REG3_BASE = 'https://reg3.kmutnb.ac.th/regapiweb1/api/th';
    res = await axios.get(`${REG3_BASE}/Evaluateofficer/Class`, { headers: authHeaders, httpsAgent: agent });

    const decompressedClass = await gunzip(Buffer.from(res.data.result, 'base64'));
    const courses = JSON.parse(decompressedClass.toString());

    let target = null;
    for (const c of courses) {
        if (c.instructor) {
            target = c.instructor.find(i => i.evaluatestatus === 0);
            if (target) {
                target = { classId: c.classid, evaluateId: target.evaluateid, officerId: target.officerid };
                break;
            }
        }
    }

    if (!target) { console.log('No targets!'); return; }
    console.log('Target:', target);

    const REG2_BASE = 'https://reg2.kmutnb.ac.th/regapiweb3/api/th';
    const qUrl = `${REG2_BASE}/Evaluateofficerform/Evaluatequestion/${target.classId}/${target.evaluateId}/${target.officerId}`;
    res = await axios.get(qUrl, { headers: authHeaders, httpsAgent: agent });
    const decompressedQ = await gunzip(Buffer.from(res.data.result, 'base64'));
    const questions = JSON.parse(decompressedQ.toString());

    // Build payload EXACTLY like Angular
    const payload = {};
    questions.forEach(q => {
        if (q.questiontype === 'H') return;
        if (q.questiontype === 'Q') payload[q.questiontype + '' + q.questionid] = '5';
        else if (q.questiontype === 'C') payload[q.questiontype + '' + q.questionid] = q.description || '';
        else if (q.questiontype === 'M' && q.evaluatechoice) {
            q.evaluatechoice.forEach(c => {
                payload[q.questiontype + '' + q.questionid + c.choiceid] = c.check || false;
                if (c.choicetype === 'T') payload[q.questiontype + '' + q.questionid + c.choiceid + 'txt'] = c.chkdescription || '';
            });
        }
    });
    payload['Ctxt'] = questions[0]?.feedback || '';
    payload['complaints'] = questions[0]?.complaints || '';

    const addUrl = `${REG2_BASE}/Evaluateofficerform/Addanswer/${target.evaluateId}/${target.classId}/${target.officerId}/1`;
    console.log('Testing Addanswer URL:', addUrl);

    // Encrypt payload
    const bodyObj = { param: encryptForReg(JSON.stringify(payload)) };

    const addRes = await axios.post(addUrl, bodyObj, { headers: authHeaders, httpsAgent: agent, validateStatus: () => true });
    console.log('Addanswer Status:', addRes.status);

    if (addRes.status === 200) {
        const commitUrl = `${REG2_BASE}/Evaluateofficerform/commit/${target.classId}/${target.evaluateId}/${target.officerId}`;
        const commitBody = { param: encryptForReg(JSON.stringify({ classid: target.classId, evaluateid: target.evaluateId, officerid: target.officerId })) };
        const commitRes = await axios.post(commitUrl, commitBody, { headers: authHeaders, httpsAgent: agent, validateStatus: () => true });
        console.log('Commit Status:', commitRes.status);
    }
}

run().catch(console.error);
